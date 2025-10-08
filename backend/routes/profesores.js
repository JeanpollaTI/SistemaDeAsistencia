import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs"; // <-- AÑADIDO: Para encriptar contraseñas
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

const profesoresRouter = express.Router();

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage de Multer para subir a Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "sistema-asistencia/fotos-profesores",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 300, height: 300, crop: "fill" }],
  },
});
const upload = multer({ storage });

// ---------------- Helper para obtener Public ID de Cloudinary ----------------
const getCloudinaryPublicId = (url) => {
  if (!url || url.includes("default.png") || !url.includes("cloudinary.com")) return null;
  const parts = url.split('/');
  const publicIdWithExt = parts[parts.length - 1];
  const publicId = publicIdWithExt.split('.')[0];
  return `sistema-asistencia/fotos-profesores/${publicId}`;
};

// ------------------------------------------------------------------
// ---- ✅ RUTA AÑADIDA: Registrar un nuevo profesor (solo admin) ----
// ------------------------------------------------------------------
profesoresRouter.post("/registrar", authMiddleware, isAdmin, upload.single("foto"), async (req, res) => {
  try {
    // 1. Obtenemos los datos del formulario
    const { nombre, email, password, celular, edad, sexo } = req.body;

    // 2. Validamos que los campos obligatorios no estén vacíos
    if (!nombre || !email || !password || !celular || !edad || !sexo) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    // 3. Verificamos si el email o celular ya existen para evitar duplicados
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ msg: "El correo electrónico ya está en uso" });
    }
    const celularExists = await User.findOne({ celular });
    if (celularExists) {
      return res.status(400).json({ msg: "El número de celular ya está en uso" });
    }

    // 4. Encriptamos la contraseña (¡muy importante!)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Creamos el nuevo usuario con los datos y el rol de "profesor"
    const newUser = new User({
      nombre,
      email,
      password: hashedPassword,
      celular,
      edad,
      sexo,
      role: "profesor", // Asignamos el rol directamente
      foto: req.file ? req.file.path : "URL_DE_IMAGEN_POR_DEFECTO.png", // Usamos la foto de Cloudinary o una por defecto
    });

    // 6. Guardamos el nuevo profesor en la base de datos
    await newUser.save();

    // 7. Enviamos una respuesta de éxito
    res.status(201).json({ msg: "Profesor registrado exitosamente" });

  } catch (error) {
    // ---- 🚨 MANEJO DE ERRORES MEJORADO ----
    // Esto imprimirá el error completo en tus logs de Render para que sepas exactamente qué falló.
    console.error('---- ERROR DETALLADO AL REGISTRAR PROFESOR ----');
    console.error(error);
    console.error('--------------------------------------------');
    res.status(500).json({ msg: "Error en el servidor al registrar al profesor", error: error.message });
  }
});


// ---------------- Obtener todos los profesores (solo admin) ----------------
profesoresRouter.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const profesores = await User.find({ role: "profesor" });
    res.json(profesores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener profesores" });
  }
});

// ---------------- Actualizar asignaturas de un profesor (solo admin) ----------------
profesoresRouter.put("/:id/asignaturas", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { asignaturas } = req.body;
    const profesor = await User.findById(req.params.id);
    if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });

    profesor.asignaturas = asignaturas || [];
    await profesor.save();

    res.json({ msg: "Asignaturas actualizadas correctamente", asignaturas: profesor.asignaturas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar asignaturas" });
  }
});

// ---------------- Eliminar profesor (solo admin) ----------------
profesoresRouter.delete("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const profesor = await User.findById(req.params.id);
    if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });

    // LÓGICA CLOUDINARY: Eliminar foto de la nube
    const publicId = getCloudinaryPublicId(profesor.foto);
    if (publicId) await cloudinary.uploader.destroy(publicId);

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar profesor" });
  }
});

// ---------------- Editar perfil propio ----------------
profesoresRouter.put("/editar-perfil", authMiddleware, upload.single("foto"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, email, celular, edad, sexo } = req.body;

    if (!nombre || !email || !celular || !edad || !sexo)
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    // Validaciones de email y celular
    if (email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ msg: "Email already in use" });
    }
    if (celular !== user.celular) {
      const celularExists = await User.findOne({ celular });
      if (celularExists) return res.status(400).json({ msg: "Celular already in use" });
    }

    user.nombre = nombre;
    user.email = email;
    user.celular = celular;
    user.edad = edad;
    user.sexo = sexo;

    // LÓGICA CLOUDINARY: Subir y Reemplazar foto
    if (req.file) {
      const publicId = getCloudinaryPublicId(user.foto);
      if (publicId) await cloudinary.uploader.destroy(publicId);
      user.foto = req.file.path;
    }

    await user.save();
    res.json({ msg: "Perfil actualizado correctamente", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al actualizar perfil", error: err.message });
  }
});

// ---------------- Obtener perfil propio ----------------
profesoresRouter.get("/mi-perfil", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener perfil", error: err.message });
  }
});

export { profesoresRouter };