import express from "express";
import User from "../models/User.js";
import { verifyToken, verifyAdmin } from "./auth.js"; // Usando tus middlewares
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary"; // Nuevo: Para almacenar en la nube
import { v2 as cloudinary } from "cloudinary"; // Nuevo: Para configurar y eliminar

const router = express.Router();

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
// Debe estar configurado con las variables de entorno que pusiste en Render
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

// ----------------- HELPERS -----------------
const formatDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

// ----------------- RUTAS -----------------

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

    // LÓGICA CLOUDINARY: Borrar la foto de la nube antes de eliminar el usuario
    if (profesor.foto && !profesor.foto.includes("default.png")) {
        // Se extrae el ID público del archivo de la URL de Cloudinary (ej: 'carpeta/foto-12345')
        const parts = profesor.foto.split('/');
        const publicIdWithExt = parts[parts.length - 1]; // foto-12345.jpg
        const publicId = publicIdWithExt.split('.')[0];   // foto-12345

        // Asumiendo que el folder es 'sistema-asistencia/fotos-profesores'
        const fullPublicId = `sistema-asistencia/fotos-profesores/${publicId}`;

        await cloudinary.uploader.destroy(fullPublicId);
    }

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
    const userId = req.user.id; // viene de verifyToken
    const { nombre, edad, email, sexo, celular } = req.body;

    // Se mantiene la validación de campos obligatorios
    if (!nombre || !edad || !email || !sexo || !celular) {
        return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    const updateData = { nombre, edad, email, sexo, celular };

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    // LÓGICA CLOUDINARY: Actualizar foto
    if (req.file) {
      // 1. ELIMINAR FOTO ANTIGUA de Cloudinary (si existe)
      if (user.foto && !user.foto.includes("default.png")) {
        const parts = user.foto.split('/');
        const publicIdWithExt = parts[parts.length - 1];
        const publicId = publicIdWithExt.split('.')[0];
        const fullPublicId = `sistema-asistencia/fotos-profesores/${publicId}`;
        
        await cloudinary.uploader.destroy(fullPublicId);
      }
      
      // 2. Guardar la nueva URL que viene de Cloudinary
      // Cloudinary almacena la URL completa en req.file.path
      updateData.foto = req.file.path; 
    }
    
    // Actualización de usuario (usamos findByIdAndUpdate para la eficiencia)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) return res.status(404).json({ msg: "Usuario no encontrado" });

    res.json({ msg: "Perfil actualizado correctamente", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al editar perfil", error: err.message });
  }
});

export default router;