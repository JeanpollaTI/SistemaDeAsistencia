import express from "express";
import User from "../models/User.js";
// Se asume que verifyToken y verifyAdmin están importados de su archivo (ej: ./auth.js)
import { verifyToken, verifyAdmin } from "./auth.js"; 
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary"; 
import { v2 as cloudinary } from "cloudinary"; 
// No necesitamos path ni fs en este router ya que Cloudinary se encarga del almacenamiento.

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
    folder: "sistema-asistencia/fotos-profesores", // Carpeta en Cloudinary
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 300, height: 300, crop: "fill" }], // Opcional: redimensionar
  },
});
const upload = multer({ storage });

// ---------------- Helper para obtener Public ID de Cloudinary ----------------
// Función para extraer el ID público con el folder para el borrado
const getCloudinaryPublicId = (url) => {
    if (!url || url.includes("default.png") || !url.includes("cloudinary.com")) return null; 
    
    const parts = url.split('/');
    const publicIdWithExt = parts[parts.length - 1]; 
    const publicId = publicIdWithExt.split('.')[0]; 
    
    // Retorna el publicId completo con la carpeta, que es requerido para el borrado
    return `sistema-asistencia/fotos-profesores/${publicId}`; 
};

// ---------------- Helper para formatear fecha (necesario para GET) ----------------
const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};


// ----------------- RUTAS -----------------

// GET: Todos los profesores (admin)
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const profesores = await User.find({ role: "profesor" }).select(
      "nombre email celular edad sexo foto asignaturas createdAt"
    );

    const formatted = profesores.map((prof) => ({
      ...prof.toObject(),
      fechaRegistro: formatDate(prof.createdAt), // Usando el helper
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener profesores", error: err.message });
  }
});

// PUT: Actualizar asignaturas de un profesor (admin)
router.put("/:id/asignaturas", verifyAdmin, async (req, res) => {
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

    // LÓGICA CLOUDINARY: Eliminar foto de la nube
    const publicId = getCloudinaryPublicId(profesor.foto);
    if (publicId) await cloudinary.uploader.destroy(publicId);

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar profesor", error: err.message });
  }
});

// ----------------- EDITAR PERFIL (usuarios logueados) -----------------
router.put("/editar-perfil", verifyToken, upload.single("foto"), async (req, res) => {
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
      const publicId = getCloudinaryPublicId(user.foto);
      if (publicId) await cloudinary.uploader.destroy(publicId); 
      
      // 2. Guardar la nueva URL (req.file.path)
      user.foto = req.file.path;
    }

    await user.save();
    
    // Devolvemos el usuario sin el password
    const userObject = user.toObject();
    delete userObject.password;
    
    res.json({ msg: "Perfil actualizado correctamente", user: userObject });
  } catch (err) {
    console.error("Error al actualizar perfil:", err);
    // CLOUDINARY CLEANUP: Si el error ocurrió después del upload PERO antes del save a MongoDB.
    if (req.file) await cloudinary.uploader.destroy(req.file.filename);
    res.status(500).json({ msg: "Error al actualizar perfil", error: err.message });
  }
});

// ---------------- Obtener perfil propio ----------------
router.get("/mi-perfil", verifyToken, async (req, res) => {
  try {
    // Usamos el middleware para obtener req.user, pero seleccionamos todo excepto el password
    const user = await User.findById(req.user.id).select("-password"); 
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    
    // Formatear la fecha antes de enviar
    const userObject = user.toObject();
    userObject.fechaRegistro = formatDate(user.createdAt);
    
    res.json(userObject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener perfil", error: err.message });
  }
});

export default router;