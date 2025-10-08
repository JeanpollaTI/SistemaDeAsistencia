import express from "express";
import User from "../models/User.js";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary"; // NUEVO
import { v2 as cloudinary } from "cloudinary"; // NUEVO
import path from "path";
import fs from "fs"; // Mantenemos fs y path para manejar la ruta por defecto, aunque ya no se usa para uploads.

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
// Debe estar configurado con las variables de entorno de Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// NUEVO: Storage de Multer para subir a Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "sistema-asistencia/fotos-profesores", // Carpeta de destino
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 300, height: 300, crop: "fill" }],
  },
});
const upload = multer({ storage });

const profesoresRouter = express.Router();

// ---------------- Helper para obtener Public ID de Cloudinary ----------------
const getCloudinaryPublicId = (url) => {
    // URL ejemplo: https://res.cloudinary.com/cloudname/image/upload/v1234/folder/public_id.jpg
    if (!url || url.includes("default.png")) return null;
    const parts = url.split('/');
    const publicIdWithExt = parts[parts.length - 1]; // Obtiene public_id.jpg
    const publicId = publicIdWithExt.split('.')[0];   // Obtiene public_id (sin extensión)
    // El folder debe coincidir con el path definido en storage.params.folder
    return `sistema-asistencia/fotos-profesores/${publicId}`; 
};

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
    if (profesor.foto && profesor.foto !== "/uploads/fotos/default.png") {
      const publicId = getCloudinaryPublicId(profesor.foto);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    }

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

    // Validaciones de email y celular (se mantienen)
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
      // 1. ELIMINAR FOTO ANTIGUA de Cloudinary
      if (user.foto && user.foto !== "/uploads/fotos/default.png") {
        const publicId = getCloudinaryPublicId(user.foto);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }
      
      // 2. Guardar la nueva URL (req.file.path contiene la URL completa de Cloudinary)
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