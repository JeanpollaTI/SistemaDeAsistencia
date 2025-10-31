import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs"; // <-- AÑADIDO: Para encriptar contraseñas
import { verifyToken, verifyAdmin } from "./auth.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "sistema-asistencia/fotos-profesores",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 300, height: 300, crop: "fill" }],
  },
});
const upload = multer({ storage });

// ----------------- HELPERS -----------------
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
    return `sistema-asistencia/fotos-profesores/${publicId}`;
};

// ---------------------------------------------------------------
// ---- ✅ RUTAS AÑADIDAS PARA COMPLETAR LA LÓGICA DE USUARIOS ----
// ---------------------------------------------------------------

// POST: Registrar un nuevo profesor (admin)
router.post("/registrar-profesor", verifyAdmin, upload.single("foto"), async (req, res) => {
    try {
        // 1. Obtener datos del cuerpo de la solicitud
        const { nombre, email, password, edad, sexo, celular } = req.body;

        // 2. Validar que los campos esenciales no estén vacíos
        if (!nombre || !email || !password || !celular) {
            return res.status(400).json({ msg: "Los campos nombre, email, contraseña y celular son obligatorios." });
        }

        // 3. Revisar si ya existe un usuario con ese email o celular
        const existingUser = await User.findOne({ $or: [{ email }, { celular }] });
        if (existingUser) {
            return res.status(400).json({ msg: "El email o el celular ya están registrados." });
        }

        // 4. Encriptar la contraseña antes de guardarla
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 5. Crear el nuevo usuario
        const newUser = new User({
            nombre,
            email,
            password: hashedPassword,
            edad,
            sexo,
            celular,
            role: 'profesor', // Rol fijo para esta ruta
            foto: req.file ? req.file.path : 'URL_DE_FOTO_POR_DEFECTO.png' // Asigna la URL de Cloudinary o una por defecto
        });

        // 6. Guardar el usuario en la base de datos
        await newUser.save();

        res.status(201).json({ msg: "Profesor registrado exitosamente." });

    } catch (err) {
        // 7. MANEJO DE ERRORES MEJORADO
        console.error('---- ERROR DETALLADO AL REGISTRAR PROFESOR ----');
        console.error(err); // Esto imprimirá el error completo en la consola del servidor

        // Si el guardado en la BD falla pero la foto ya se subió, la eliminamos
        if (req.file) {
            await cloudinary.uploader.destroy(req.file.filename);
        }

        res.status(500).json({ msg: "Error en el servidor al registrar al profesor", error: err.message });
    }
});

// GET: Obtener perfil propio (usuarios logueados)
router.get("/mi-perfil", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password"); // req.user.id viene del token
        if (!user) {
            return res.status(404).json({ msg: "Usuario no encontrado" });
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Error al obtener el perfil", error: err.message });
    }
});


// ----------------- RUTAS EXISTENTES -----------------

// GET: Todos los profesores (admin)
router.get("/profesores", verifyAdmin, async (req, res) => {
  try {
    const profesores = await User.find({ role: "profesor" }).select(
      "nombre email celular edad sexo foto asignaturas createdAt"
    );

    const formatted = profesores.map((prof) => ({
      ...prof.toObject(),
      fechaRegistro: formatDate(prof.createdAt),
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener profesores", error: err.message });
  }
});

// PUT: Actualizar asignaturas de un profesor (admin)
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

// DELETE: Eliminar profesor (admin)
router.delete("/profesores/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const profesor = await User.findById(id);
    if (!profesor) return res.status(404).json({ msg: "Profesor no encontrado" });

    // LÓGICA CLOUDINARY: Borrar la foto de la nube
    const publicId = getCloudinaryPublicId(profesor.foto);
    if (publicId) {
        await cloudinary.uploader.destroy(publicId);
    }

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar profesor", error: err.message });
  }
});

// PUT: Editar perfil propio (usuarios logueados)
router.put("/editar-perfil", verifyToken, upload.single("foto"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, edad, email, sexo, celular } = req.body;

    if (!nombre || !edad || !email || !sexo || !celular) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    const updateData = { nombre, edad, email, sexo, celular };

    // LÓGICA CLOUDINARY: Actualizar foto
    if (req.file) {
      // Eliminar foto antigua de Cloudinary
      const publicId = getCloudinaryPublicId(user.foto);
      if (publicId) {
          await cloudinary.uploader.destroy(publicId);
      }
      // Guardar la nueva URL
      updateData.foto = req.file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) return res.status(404).json({ msg: "No se pudo actualizar el usuario" });

    res.json({ msg: "Perfil actualizado correctamente", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al editar perfil", error: err.message });
  }
});

export default router;