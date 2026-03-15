import express from 'express';
import { sendEmail } from '../utils/sendEmail.js';
import { authMiddleware, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// POST /api/enviar-boleta
router.post('/enviar-boleta', authMiddleware, async (req, res) => {
    const { to, subject, body, pdfData } = req.body;

    if (!to || !subject || !body || !pdfData) {
        return res.status(400).json({ error: 'Faltan datos para enviar el correo.' });
    }

    // Preparamos el array de attachments para Nodemailer
    const attachments = [
        {
            filename: 'Boleta_de_Calificaciones.pdf',
            content: pdfData,
            contentType: 'application/pdf',
            encoding: 'base64' // Aseguramos que sepa que es base64 si no viene buffer
        }
    ];

    try {
        await sendEmail(to, subject, body, attachments);
        res.status(200).json({ message: 'Boleta enviada exitosamente por correo.' });
    } catch (error) {
        console.error('Error al enviar boleta por correo:', error);
        res.status(500).json({ error: 'Hubo un error en el servidor al intentar enviar el correo.' });
    }
});


// POST /api/enviar-horario
router.post('/enviar-horario', authMiddleware, isAdmin, async (req, res) => {
    const { to, subject, body, pdfData, fileName } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0 || !pdfData) {
        return res.status(400).json({ error: 'Faltan destinatarios o datos del PDF.' });
    }

    const attachments = [
        {
            filename: fileName || 'Horario.pdf',
            content: pdfData,
            contentType: 'application/pdf',
            encoding: 'base64'
        }
    ];

    try {
        await sendEmail(to, subject, body, attachments);
        res.status(200).json({ message: 'Horario enviado a los profesores exitosamente.' });
    } catch (error) {
        console.error('Error al enviar el horario por correo:', error);
        res.status(500).json({ error: 'Hubo un error en el servidor al intentar enviar el correo.' });
    }
});

export { router as emailRouter };
