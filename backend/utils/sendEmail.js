import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del transporter de Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true para 465, false para otros puertos
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // App Password de Google
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 10000, // Timeouts para evitar cuelgues
    greetingTimeout: 5000,
    socketTimeout: 10000
});

/**
 * Envía un correo electrónico usando Nodemailer.
 * @param {string|string[]} to - Destinatario(s).
 * @param {string} subject - Asunto del correo.
 * @param {string} html - Cuerpo del correo en HTML.
 * @param {Array} attachments - Lista de adjuntos (opcional).
 */
export const sendEmail = async (to, subject, html, attachments = []) => {
    try {
        const mailOptions = {
            from: `"Sistema de Asistencia" <${process.env.GMAIL_USER}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        throw error;
    }
};
