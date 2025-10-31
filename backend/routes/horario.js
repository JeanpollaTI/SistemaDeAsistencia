import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary"; 
import { CloudinaryStorage } from "multer-storage-cloudinary"; 
// Ya no necesitamos path ni fs para la manipulación local
// import path from "path"; 
// import fs from "fs"; 

import Horario from "../models/Horario.js";
import { verifyToken, verifyAdmin } from "./auth.js"; // Asegúrate de que los middlewares se importen correctamente

const router = express.Router();

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// NUEVO: Storage de Multer para subir IMÁGENES de Horario
const storageImage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const anio = req.body.anio || "unknown";
    return {
      // Carpeta específica para imágenes de horarios
      folder: "sistema-asistencia/horarios-imagenes", 
      resource_type: "image", // CRUCIAL: Cambiado a 'image'
      public_id: `horario_img_${anio}_${Date.now()}`, 
      allowed_formats: ["jpg", "png", "jpeg"], // Aceptar formatos de imagen
    };
  },
});
const uploadImage = multer({ storage: storageImage }); // CAMBIADO: uploadPdf a uploadImage

// Helper
const parseJSON = (input) => {
  if (!input) return {};
  if (typeof input === "object") return input;
  try { return JSON.parse(input); } catch { return {}; }
};

// ----------------- CRUD Horario ------------------

// CAMBIADO: uploadPdf.single("pdf") a uploadImage.single("imagen")
router.post("/", verifyAdmin, uploadImage.single("imagen"), async (req, res) => {
  try {
    const { anio, datos, leyenda } = req.body;
    // Debes enviar anio en el body, incluso si subes solo la imagen
    if (!anio) return res.status(400).json({ msg: "Debe especificar el año" }); 

    // Usamos findOne para evitar duplicados, y luego actualizamos o creamos
    let horario = await Horario.findOne({ anio }) || new Horario({ anio });
    horario.datos = parseJSON(datos);
    horario.leyenda = parseJSON(leyenda);

    // LÓGICA CLOUDINARY: Actualizar/Reemplazar Imagen
    if (req.file) {
        // 1. Eliminar Imagen antigua de Cloudinary si existe (y no es la ruta por defecto)
        if (horario.imageUrl) { // CAMBIADO: pdfUrl a imageUrl
            const parts = horario.imageUrl.split('/');
            const publicIdWithExt = parts[parts.length - 1]; 
            const publicId = publicIdWithExt.split('.')[0]; 
            const fullPublicId = `sistema-asistencia/horarios-imagenes/${publicId}`;

            // resource_type: 'image' para borrar imágenes
            await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' }); // CAMBIADO: 'raw' a 'image'
        }
        
        // 2. Guardar la nueva URL (req.file.path contiene la URL completa de Cloudinary)
        horario.imageUrl = req.file.path; // CAMBIADO: pdfUrl a imageUrl
    }

    await horario.save();
    // CAMBIADO: pdfUrl a imageUrl en la respuesta
    res.json({ success: true, horario: { ...horario.toObject(), imageUrl: horario.imageUrl } }); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:anio", verifyToken, async (req, res) => {
  try {
    const horario = await Horario.findOne({ anio: req.params.anio });
    // CAMBIADO: pdfUrl a imageUrl
    if (!horario) return res.json({ datos: {}, leyenda: {}, imageUrl: null }); 
    res.json({ datos: horario.datos, leyenda: horario.leyenda, imageUrl: horario.imageUrl || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    // CAMBIADO: pdfUrl a imageUrl
    const horarios = await Horario.find().select("anio imageUrl").sort({ anio: -1 }); 
    res.json(horarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error obteniendo horarios", error: err.message });
  }
});

router.delete("/:anio", verifyAdmin, async (req, res) => {
  try {
    const horario = await Horario.findOne({ anio: req.params.anio });
    if (!horario) return res.status(404).json({ msg: "Horario no encontrado" });

    // LÓGICA CLOUDINARY: Eliminar Imagen de la nube
    if (horario.imageUrl) { // CAMBIADO: pdfUrl a imageUrl
        const parts = horario.imageUrl.split('/');
        const publicIdWithExt = parts[parts.length - 1]; 
        const publicId = publicIdWithExt.split('.')[0]; 
        const fullPublicId = `sistema-asistencia/horarios-imagenes/${publicId}`;

        // resource_type: 'image' para borrar imágenes
        await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' }); 
    }

    await Horario.deleteOne({ anio: req.params.anio });
    res.json({ msg: `Horario del año ${req.params.anio} eliminado correctamente` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error eliminando horario", error: err.message });
  }
});

export { router as horarioRouter };