import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs"; // Mantenemos fs solo para fines de seguridad si es necesario, pero la lógica de unlink es de Cloudinary.
import { CloudinaryStorage } from "multer-storage-cloudinary"; // Nuevo: Para almacenar en la nube
import { v2 as cloudinary } from "cloudinary"; // Nuevo: Para configurar y eliminar

import Horario from "../models/Horario.js";
import { verifyToken, verifyAdmin } from "./auth.js"; // Asegúrate de que los middlewares se importen correctamente

const router = express.Router();

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
// Debe estar configurado con las variables de entorno de Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// NUEVO: Storage de Multer para subir PDFs a Cloudinary
const storagePdf = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const anio = req.body.anio || "unknown";
    return {
        folder: "sistema-asistencia/pdf-horarios", // Carpeta de destino específica para PDFs
        resource_type: "raw", // CRUCIAL: 'raw' para archivos que no son imágenes (como PDFs)
        public_id: `horario_${anio}_${Date.now()}`, // Nombre único del archivo
        allowed_formats: ["pdf"],
    };
  },
});
const uploadPdf = multer({ storage: storagePdf });

// Helper
const parseJSON = (input) => {
  if (!input) return {};
  if (typeof input === "object") return input;
  try { return JSON.parse(input); } catch { return {}; }
};

// ----------------- CRUD Horario ------------------

router.post("/", verifyAdmin, uploadPdf.single("pdf"), async (req, res) => {
  try {
    const { anio, datos, leyenda } = req.body;
    if (!anio) return res.status(400).json({ msg: "Debe especificar el año" });

    let horario = await Horario.findOne({ anio }) || new Horario({ anio });
    horario.datos = parseJSON(datos);
    horario.leyenda = parseJSON(leyenda);

    // LÓGICA CLOUDINARY: Actualizar/Reemplazar PDF
    if (req.file) {
        // 1. Eliminar PDF antiguo de Cloudinary si existe
        if (horario.pdfUrl) {
            // El public_id está al final de la URL sin la extensión
            const parts = horario.pdfUrl.split('/');
            const publicIdWithExt = parts[parts.length - 1]; 
            const publicId = publicIdWithExt.split('.')[0]; 
            const fullPublicId = `sistema-asistencia/pdf-horarios/${publicId}`;

            await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'raw' });
        }
        
        // 2. Guardar la nueva URL (req.file.path contiene la URL completa)
        horario.pdfUrl = req.file.path;
    }

    await horario.save();
    res.json({ success: true, horario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:anio", verifyToken, async (req, res) => {
  try {
    const horario = await Horario.findOne({ anio: req.params.anio });
    if (!horario) return res.json({ datos: {}, leyenda: {}, pdfUrl: null });
    res.json({ datos: horario.datos, leyenda: horario.leyenda, pdfUrl: horario.pdfUrl || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const horarios = await Horario.find().select("anio pdfUrl").sort({ anio: -1 });
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

    // LÓGICA CLOUDINARY: Eliminar PDF de la nube
    if (horario.pdfUrl) {
        const parts = horario.pdfUrl.split('/');
        const publicIdWithExt = parts[parts.length - 1]; 
        const publicId = publicIdWithExt.split('.')[0]; 
        const fullPublicId = `sistema-asistencia/pdf-horarios/${publicId}`;

        await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'raw' });
    }

    await Horario.deleteOne({ anio: req.params.anio });
    res.json({ msg: `Horario del año ${req.params.anio} eliminado correctamente` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error eliminando horario", error: err.message });
  }
});

export { router as horarioRouter };