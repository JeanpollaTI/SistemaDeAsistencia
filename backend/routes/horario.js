import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary"; 
import { CloudinaryStorage } from "multer-storage-cloudinary"; 

import Horario from "../models/Horario.js";
import { verifyToken, verifyAdmin } from "./auth.js";
import { sendEmail } from "../utils/sendEmail.js";

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
      resource_type: "image", 
      public_id: `horario_img_${anio}_${Date.now()}`, 
      allowed_formats: ["jpg", "png", "jpeg"], 
    };
  },
});
const uploadImage = multer({ storage: storageImage });

// Helper
const parseJSON = (input) => {
  if (!input) return {};
  if (typeof input === "object") return input;
  try { return JSON.parse(input); } catch { return {}; }
};

// ----------------- CRUD Horario ------------------

// Crear o actualizar horario (con imagen opcional)
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
        if (horario.imageUrl) {
            const parts = horario.imageUrl.split('/');
            const publicIdWithExt = parts[parts.length - 1]; 
            const publicId = publicIdWithExt.split('.')[0]; 
            const fullPublicId = `sistema-asistencia/horarios-imagenes/${publicId}`;

            // resource_type: 'image' para borrar imágenes
            await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' });
        }
        
        // 2. Guardar la nueva URL (req.file.path contiene la URL completa de Cloudinary)
        horario.imageUrl = req.file.path;
    }

    await horario.save();
    res.json({ success: true, horario: { ...horario.toObject(), imageUrl: horario.imageUrl } }); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:anio", verifyToken, async (req, res) => {
  try {
    const horario = await Horario.findOne({ anio: req.params.anio });
    if (!horario) return res.json({ datos: {}, leyenda: {}, imageUrl: null }); 
    res.json({ datos: horario.datos, leyenda: horario.leyenda, imageUrl: horario.imageUrl || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
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
    if (horario.imageUrl) {
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

// --- RUTA PARA ENVIAR HORARIO POR CORREO ---
// Nota: Se utiliza sendEmail para enviar un adjunto (PDF) generado en el cliente
router.post("/enviar", verifyAdmin, async (req, res) => {
    const { to, subject, body, pdfData, fileName } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0 || !pdfData) {
        return res.status(400).json({ error: 'Faltan destinatarios o los datos del PDF.' });
    }

    try {
        // Prepara el archivo adjunto para SendGrid/Nodemailer
        const attachment = {
            content: pdfData,
            filename: fileName || 'Horario.pdf',
            type: 'application/pdf',
            disposition: 'attachment',
        };

        // Usa la función de sendEmail para enviar el correo
        await sendEmail(to, subject, body, [attachment]);

        res.status(200).json({ message: 'Horario enviado a los profesores exitosamente.' });

    } catch (error) {
        console.error('Error al enviar el horario por correo:', error);
        res.status(500).json({ error: 'Hubo un error en el servidor al intentar enviar el correo.' });
    }
});

export { router as horarioRouter };
