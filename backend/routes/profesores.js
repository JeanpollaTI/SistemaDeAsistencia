import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
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

// ---------------- Registrar un nuevo profesor (solo admin) ----------------
profesoresRouter.post("/registrar", authMiddleware, isAdmin, upload.single("foto"), async (req, res) => {
  try {
    const { nombre, email, password, celular, edad, sexo } = req.body;

    if (!nombre || !email || !password || !celular || !edad || !sexo) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ msg: "El correo electrónico ya está en uso" });
    }
    const celularExists = await User.findOne({ celular });
    if (celularExists) {
      return res.status(400).json({ msg: "El número de celular ya está en uso" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      nombre,
      email,
      password: hashedPassword,
      celular,
      edad,
      sexo,
      role: "profesor",
      foto: req.file ? req.file.path : "URL_DE_IMAGEN_POR_DEFECTO.png",
    });

    await newUser.save();
    res.status(201).json({ msg: "Profesor registrado exitosamente" });

  } catch (error) {
    console.error('---- ERROR DETALLADO AL REGISTRAR PROFESOR ----');
    console.error(error);
    res.status(500).json({ msg: "Error en el servidor al registrar al profesor", error: error.message });
  }
});

// ---------------- Obtener todos los profesores (solo admin) ----------------
profesoresRouter.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const profesores = await User.find({ role: "profesor" }).select("-password");
    res.json(profesores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener profesores" });
  }
});

// ------------------------------------------------------------------
// ---- ✅ RUTA AÑADIDA: Obtener un solo profesor por ID (admin) ----
// ------------------------------------------------------------------
profesoresRouter.get("/:id", authMiddleware, isAdmin, async (req, res) => {
    try {
        const profesor = await User.findOne({ _id: req.params.id, role: "profesor" }).select("-password");
        
        if (!profesor) {
            return res.status(404).json({ error: "Profesor no encontrado" });
        }
        
        res.json(profesor);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener el profesor" });
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