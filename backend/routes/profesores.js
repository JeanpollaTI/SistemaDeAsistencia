import express from "express";
import User from "../models/User.js";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary"; // Cloudinary Storage Engine
import { v2 as cloudinary } from "cloudinary"; // Cloudinary core library
import path from "path";
import fs from "fs"; // Mantenemos fs y path para manejar la ruta por defecto, aunque ya no se usa para uploads.

const profesoresRouter = express.Router();

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

// ---------------- Helper para obtener Public ID de Cloudinary ----------------
// Extrae el ID necesario para borrar el archivo de Cloudinary
const getCloudinaryPublicId = (url) => {
    // Si no es una URL de Cloudinary o es la ruta por defecto, regresa null
    if (!url || url.includes("default.png") || !url.includes("cloudinary.com")) return null; 
    
    // Obtenemos el segmento final (ej: 'public_id.jpg')
    const parts = url.split('/');
    const publicIdWithExt = parts[parts.length - 1]; 
    const publicId = publicIdWithExt.split('.')[0]; 
    
    // Retorna el publicId completo con el folder, que es requerido para el borrado
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

    // Buscamos al usuario antes de actualizar
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
      // 1. ELIMINAR FOTO ANTIGUA de Cloudinary (CRUCIAL para evitar el crash si no hay foto)
      const publicId = getCloudinaryPublicId(user.foto);
      if (publicId) await cloudinary.uploader.destroy(publicId); // Borrado seguro
      
      // 2. Guardar la nueva URL (req.file.path contiene la URL completa de Cloudinary)
      user.foto = req.file.path;
    }

    // Usamos save() para que los triggers y validaciones funcionen
    await user.save();
    
    // Devolvemos el usuario, excluyendo el password por seguridad (select: false en el modelo)
    const userObject = user.toObject();
    delete userObject.password;
    
    res.json({ msg: "Perfil actualizado correctamente", user: userObject });
  } catch (err) {
    console.error("Error al actualizar perfil:", err);
    // CLOUDINARY CLEANUP: Si el error ocurrió después del upload PERO antes del save, borramos la nueva foto.
    if (req.file) await cloudinary.uploader.destroy(req.file.filename);
    res.status(500).json({ msg: "Error al actualizar perfil", error: err.message });
  }
});

// ---------------- Obtener perfil propio ----------------
profesoresRouter.get("/mi-perfil", authMiddleware, async (req, res) => {
  try {
    // Usamos el middleware para obtener req.user, pero seleccionamos todo excepto el password
    const user = await User.findById(req.user.id).select("-password"); 
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener perfil", error: err.message });
  }
});

export { profesoresRouter };