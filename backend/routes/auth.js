import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";

// Importaciones
import User from "../models/User.js";
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// ----------------- MULTER CONFIG PARA CLOUDINARY -----------------
// Usamos memoryStorage para manejar la subida 'manual' a Cloudinary usando el buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Renombramos para compatibilidad con el código existente
const uploadFotos = upload;

// Helpers
const formatDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const getCloudinaryPublicId = (url) => {
  if (!url || url.includes("default.png") || !url.includes("cloudinary")) return null;
  const parts = url.split('/');
  const publicIdWithExt = parts[parts.length - 1];
  const publicId = publicIdWithExt.split('.')[0];
  // Ajusta la carpeta según tu estructura en Cloudinary:
  return `perfiles/${publicId}`;
};

// ----------------- MIDDLEWARE JWT -----------------
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No hay token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: "Token expirado", error: err.name });
    }
    return res.status(401).json({ msg: "Token inválido" });
  }
};

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== "admin")
      return res.status(403).json({ msg: "No tienes permisos" });
    next();
  });
};

// ----------------- RUTAS DE AUTENTICACIÓN ------------------

// Register
router.post("/register", verifyAdmin, uploadFotos.single("foto"), async (req, res) => {
  try {
    let { nombre, edad, sexo, email, celular, password, role, school_id } = req.body;

    // Si el que registra es un admin de escuela, heredamos su school_id si no se provee
    if (!school_id && req.user && req.user.school_id) {
      school_id = req.user.school_id;
    }

    if (!school_id) return res.status(400).json({ msg: "El ID de la escuela es obligatorio" });

    email = email.toLowerCase();
    let fotoUrl = "/uploads/fotos/default.png"; // Valor por defecto

    const existingUser = await User.findOne({ $or: [{ email }, { celular }] });
    if (existingUser) return res.status(400).json({ msg: "Usuario ya existe" });

    // Lógica de subida a Cloudinary
    if (req.file) {
      const publicId = `perfiles/profesor-${Date.now()}`;
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: "perfiles",
        public_id: publicId,
        overwrite: true
      });

      fotoUrl = result.secure_url;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ nombre, edad, sexo, email, celular, password: hashedPassword, role: role || "profesor", foto: fotoUrl, school_id });
    await newUser.save();

    res.status(201).json({ msg: "Usuario registrado correctamente", user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error en el servidor", error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ email: identifier }, { celular: identifier }] }).select('+password');
    if (!user) return res.status(400).json({ msg: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, role: user.role, school_id: user.school_id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // Devolvemos el usuario formateado explícitamente para asegurar compatibilidad
    res.json({
      token,
      user: {
        id: user._id,
        nombre: user.nombre,
        edad: user.edad,
        sexo: user.sexo,
        email: user.email,
        celular: user.celular,
        role: user.role,
        foto: user.foto,
        school_id: user.school_id,
        asignaturas: user.asignaturas || [],
        fechaRegistro: formatDate(user.createdAt)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error en el servidor", error: err.message });
  }
});

// CAMBIAR CONTRASEÑA (Usuario autenticado cambia su propia contraseña)
router.put("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).select('+password');
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: "La contraseña actual es incorrecta" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ msg: "Contraseña actualizada exitosamente" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al cambiar contraseña", error: err.message });
  }
});

// ADMIN: CAMBIAR CONTRASEÑA DE OTRO USUARIO
// Se requiere que el admin envíe SU propia contraseña para confirmar la acción
router.put("/admin/change-user-password", verifyAdmin, async (req, res) => {
  try {
    const { targetUserId, newPassword, adminPassword } = req.body;
    const adminId = req.user.id;

    // 1. Verificar credenciales del Admin
    const adminUser = await User.findById(adminId).select('+password');
    if (!adminUser) return res.status(404).json({ msg: "Admin no encontrado" });

    const isAdminMatch = await bcrypt.compare(adminPassword, adminUser.password);
    if (!isAdminMatch) return res.status(403).json({ msg: "Contraseña de administrador incorrecta" });

    // 2. Buscar al usuario objetivo y cambiar su contraseña
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ msg: "Usuario objetivo no encontrado" });

    targetUser.password = await bcrypt.hash(newPassword, 10);
    await targetUser.save();

    res.json({ msg: `Contraseña para ${targetUser.nombre} actualizada exitosamente` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error en server al cambiar contraseña de usuario", error: err.message });
  }
});


// ----------------- MI PERFIL -----------------

// GET: Obtener perfil propio
router.get("/mi-perfil", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener el perfil", error: err.message });
  }
});

// ----------------- EDITAR PERFIL (usuarios logueados) CON CLOUDINARY -----------------
router.put("/editar-perfil", verifyToken, uploadFotos.single("foto"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, edad, email, sexo, celular } = req.body;
    let fotoUrl = null;

    // 1. Obtener usuario para validaciones
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    // Validar unicidad de email y celular
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ msg: "El correo ya está en uso" });
    }
    if (celular && celular !== user.celular) {
      const celularExists = await User.findOne({ celular });
      if (celularExists) return res.status(400).json({ msg: "El celular ya está en uso" });
    }

    // 2. Lógica de Subida a Cloudinary
    if (req.file) {
      // Usa el ID del usuario como public_id para que Cloudinary reemplace el archivo anterior
      const publicId = `perfiles/user-${userId}`;

      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: "perfiles",
        public_id: publicId,
        overwrite: true
      });

      fotoUrl = result.secure_url;
    }

    // 3. Preparar datos de actualización
    const updateData = {
      nombre: nombre || user.nombre,
      edad: edad || user.edad,
      email: email || user.email,
      sexo: sexo || user.sexo,
      celular: celular || user.celular,
    };
    if (fotoUrl) updateData.foto = fotoUrl;

    // 4. Actualizar en la base de datos
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) return res.status(404).json({ msg: "Usuario no encontrado" });

    res.json({ msg: "Perfil actualizado correctamente", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al editar perfil o subir foto", error: err.message });
  }
});

// ---------------- RUTAS ADMIN / PROFESORES -----------------

// GET: Todos los profesores
router.get("/profesores", verifyAdmin, async (req, res) => {
  try {
    const profesores = await User.find({ role: "profesor" }).select(
      "nombre email celular edad sexo foto asignaturas createdAt"
    );

    const formatted = profesores.map((prof) => {
      const profObject = prof.toObject();
      return {
        ...profObject,
        correo: profObject.email, // Aliasing para frontend
        fechaRegistro: formatDate(prof.createdAt),
      }
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener profesores", error: err.message });
  }
});

// PUT: Actualizar asignaturas de un profesor
router.put("/profesores/:id/asignaturas", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { asignaturas } = req.body;

    const profesor = await User.findById(id);
    if (!profesor) return res.status(404).json({ msg: "Profesor no encontrado" });

    profesor.asignaturas = asignaturas || [];
    await profesor.save();

    res.json({ msg: "Asignaturas actualizadas correctamente", asignaturas: profesor.asignaturas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al actualizar asignaturas", error: err.message });
  }
});

// DELETE: Eliminar profesor
router.delete("/profesores/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const profesor = await User.findById(id);
    if (!profesor) return res.status(404).json({ msg: "Profesor no encontrado" });

    // Intento de eliminar imagen de Cloudinary si no es la default
    // Esto es opcional y best-effort
    const publicId = getCloudinaryPublicId(profesor.foto);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.warn("No se pudo eliminar la imagen de Cloudinary:", e.message);
      }
    }

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar profesor", error: err.message });
  }
});

export { router as authRouter, verifyToken, verifyAdmin };
