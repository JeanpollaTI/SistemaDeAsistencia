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

// NUEVO: Storage de Multer para subir IMÁGENES de Horario (PNG/JPG)
const storageImage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const anio = req.body.anio || "unknown";
    return {
        // Carpeta de destino específica para imágenes de horarios
        folder: "sistema-asistencia/horarios-imagenes", 
        resource_type: "image", // CAMBIO CLAVE: 'image' para imágenes (PNG/JPG)
        public_id: `horario_img_${anio}_${Date.now()}`, // Nombre único
        allowed_formats: ["jpg", "jpeg", "png"], // Aceptar formatos comunes de imagen
    };
  },
});

export const uploadImage = multer({ storage: storageImage }); // CAMBIADO: uploadPdf a uploadImage