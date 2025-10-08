import express from 'express';
// Asegúrate de que esta función importe la versión que usa sgMail
import { sendEmail } from '../utils/sendEmail.js'; 
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// POST /api/enviar-boleta
// Esta ruta recibe los datos del frontend y envía el correo con el PDF adjunto.
router.post('/enviar-boleta', authMiddleware, async (req, res) => {
    const { to, subject, body, pdfData } = req.body;

    if (!to || !subject || !body || !pdfData) {
        return res.status(400).json({ error: 'Faltan datos para enviar el correo.' });
    }

    // El frontend envía el PDF en formato Base64. Preparamos el attachment para sendEmail.
    const attachments = [
        {
            filename: 'Boleta_de_Calificaciones.pdf',
            content: pdfData, 
            encoding: 'base64', // Especificamos que el contenido es Base64
            contentType: 'application/pdf' 
        }
    ];

    try {
        // --- LA SOLUCIÓN CLAVE: LLAMAR A LA FUNCIÓN DE API DE SENDGRID ---
        // sendEmail maneja el JWT y la conexión HTTP.
        await sendEmail(to, subject, body, attachments);

        res.status(200).json({ message: 'Boleta enviada exitosamente por correo.' });

    } catch (error) {
        // Los errores de la función centralizada serán capturados aquí.
        // Si hay un error, es un problema de SendGrid (API Key, remitente, etc.).
        console.error('Error al enviar boleta por correo:', error); 
        res.status(500).json({ error: 'Hubo un error en el servidor al intentar enviar el correo.' });
    }
});

export { router as emailRouter };