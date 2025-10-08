import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary"; 
import { CloudinaryStorage } from "multer-storage-cloudinary"; 

import Horario from "../models/Horario.js";
import User from "../models/User.js"; // Necesario para buscar profesores
import { sendEmail } from "../utils/sendEmail.js"; // Necesario para enviar el correo
import { verifyToken, verifyAdmin } from "./auth.js"; 

const router = express.Router();

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
// Cloudinary se configura aquí y es global para todos los routers
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage de Multer para subir IMÁGENES de Horario (Mantenido solo por si es necesario para el frontend)
const storageImage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const anio = req.body.anio || "unknown";
    return {
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

// POST: Guardar datos de horario y/o subir imagen (si el frontend la envía)
// Nota: 'uploadImage.single("imagen")' se mantiene aunque la subida de imagen ya no es obligatoria en este flujo.
router.post("/", verifyAdmin, uploadImage.single("imagen"), async (req, res) => {
  try {
    const { anio, datos, leyenda } = req.body;
    if (!anio) return res.status(400).json({ msg: "Debe especificar el año" }); 

    let horario = await Horario.findOne({ anio }) || new Horario({ anio });
    horario.datos = parseJSON(datos);
    horario.leyenda = parseJSON(leyenda);

    // LÓGICA CLOUDINARY: Actualizar/Reemplazar Imagen
    if (req.file) {
        // 1. Eliminar Imagen antigua
        if (horario.imageUrl) { 
            const parts = horario.imageUrl.split('/');
            const publicIdWithExt = parts[parts.length - 1]; 
            const publicId = publicIdWithExt.split('.')[0]; 
            const fullPublicId = `sistema-asistencia/horarios-imagenes/${publicId}`;

            await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' }); 
        }
        
        // 2. Guardar la nueva URL
        horario.imageUrl = req.file.path; 
    }

    await horario.save();
    res.json({ success: true, horario: { ...horario.toObject(), imageUrl: horario.imageUrl } }); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET: Horario por año
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

// GET: Todos los años de horario
router.get("/", verifyToken, async (req, res) => {
  try {
    const horarios = await Horario.find().select("anio imageUrl").sort({ anio: -1 }); 
    res.json(horarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error obteniendo horarios", error: err.message });
  }
});

// DELETE: Eliminar horario
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

        await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' }); 
    }

    await Horario.deleteOne({ anio: req.params.anio });
    res.json({ msg: `Horario del año ${req.params.anio} eliminado correctamente` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error eliminando horario", error: err.message });
  }
});

// ----------------- RUTA NUEVA: ENVÍO MASIVO POR CORREO -----------------

// POST: Enviar horario (PDF Base64) por correo a los profesores
router.post("/enviar-correo", verifyAdmin, async (req, res) => {
    try {
        // anio se usa para el nombre del archivo. pdfData es el Base64 generado en el frontend.
        const { anio, pdfData, horarioData } = req.body;
        
        if (!pdfData || !horarioData) {
            return res.status(400).json({ msg: "Faltan datos (PDF o Horario) para el envío." });
        }

        // 1. EXTRAER CORREOS de los nombres de la tabla
        // NOTA: Asumimos que horarioData tiene las claves como nombres de profesor
        const profesorNombres = Object.keys(horarioData); 
        const profesores = await User.find({ 
            nombre: { $in: profesorNombres },
            role: "profesor"
        }).select("email nombre"); // Solo necesitamos email y nombre

        // Mapeamos los emails de los profesores encontrados
        const correosDestino = profesores.map(p => p.email);
        
        // Manejamos el caso donde no se encuentren correos
        if (correosDestino.length === 0) {
            // Devolvemos 200 (OK) con un mensaje informativo para no crashar el frontend
            return res.status(200).json({ msg: "No se encontraron profesores en el sistema para enviar el horario." });
        }

        // 2. ADJUNTAR Y ENVIAR
        const attachment = [{
            filename: `Horario_General_${anio}.pdf`,
            content: pdfData, // El contenido PDF en Base64
            encoding: 'base64', 
            contentType: 'application/pdf'
        }];

        // Enviar a todos los correos
        // sendEmail usa SendGrid API (HTTP)
        await sendEmail(
            correosDestino, 
            `Horario General ${anio} - Secundaria N9`,
            `<p>Estimado(a) profesor(a), se adjunta el Horario General correspondiente al año ${anio}.</p>
             <p>Este es un envío automatizado, por favor no responda a este correo.</p>`,
            attachment
        );

        res.json({ success: true, msg: `Horario enviado a ${correosDestino.length} profesores.` });

    } catch (err) {
        // Si sendEmail falla, capturamos el error
        console.error("Error al enviar correos masivos:", err);
        res.status(500).json({ msg: "Error al enviar correos.", error: err.message });
    }
});


export { router as horarioRouter };