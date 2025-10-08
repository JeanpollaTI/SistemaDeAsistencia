import multer from "multer";
import { v2 as cloudinary } from "cloudinary"; // Importamos el core de Cloudinary
import { CloudinaryStorage } from "multer-storage-cloudinary"; // Importamos el motor de almacenamiento

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
// Asegúrate de que las variables CLOUDINARY_CLOUD_NAME, API_KEY y API_SECRET 
// estén configuradas en tu entorno de Render.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// NUEVO: Storage de Multer para subir PDFs directamente a Cloudinary
const storagePdf = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const anio = req.body.anio || "unknown";
    return {
        // CRUCIAL: Definir el folder y el resource_type como 'raw' para PDFs
        folder: "sistema-asistencia/pdf-horarios", 
        resource_type: "raw", 
        public_id: `horario_${anio}_${Date.now()}`, 
        allowed_formats: ["pdf"],
    };
  },
});

export const uploadPdf = multer({ storage: storagePdf });