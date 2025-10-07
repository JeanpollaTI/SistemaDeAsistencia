import express from 'express';
import nodemailer from 'nodemailer';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// POST /api/enviar-boleta
// Esta ruta recibe los datos del frontend y envía el correo con el PDF adjunto.
router.post('/enviar-boleta', authMiddleware, async (req, res) => {
    const { to, subject, body, pdfData } = req.body;

    if (!to || !subject || !body || !pdfData) {
        return res.status(400).json({ error: 'Faltan datos para enviar el correo.' });
    }

    try {
        // 1. Reutiliza la misma configuración de Nodemailer que ya usas para recuperar contraseñas.
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false, // false para el puerto 587
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // 2. Prepara las opciones del correo.
        const mailOptions = {
            from: `"Escuela Secundaria N.9" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: body,
            // 3. ESTA ES LA PARTE CORREGIDA Y CLAVE:
            // Le decimos a Nodemailer que el PDF es contenido en base64, no una ruta de archivo.
            attachments: [
                {
                    filename: 'Boleta_de_Calificaciones.pdf',
                    content: pdfData,     // Se usa 'content' para el string base64
                    encoding: 'base64',   // Se especifica la codificación
                    contentType: 'application/pdf'
                },
            ],
        };

        // 4. Envía el correo.
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Boleta enviada exitosamente por correo.' });

    } catch (error) {
        console.error('Error al enviar boleta por correo:', error);
        res.status(500).json({ error: 'Hubo un error en el servidor al intentar enviar el correo.' });
    }
});

export { router as emailRouter };

