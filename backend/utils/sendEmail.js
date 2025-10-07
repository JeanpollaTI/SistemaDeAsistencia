import nodemailer from "nodemailer";

/**
 * Envía un correo electrónico usando los datos del .env
 * @param {string} to - Correo del destinatario
 * @param {string} subject - Asunto del correo
 * @param {string} html - Contenido HTML del correo
 * @param {Array} attachments - Opcional, archivos adjuntos [{ filename, path }]
 */
export const sendEmail = async (to, subject, html, attachments = []) => {
  if (!to) throw new Error("Debe especificar el destinatario del correo");
  if (!subject) throw new Error("Debe especificar el asunto del correo");

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465, // true si usas 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Sistema de Asistencia" <${process.env.EMAIL_USER}>`, // Nombre visible
      to,
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Correo enviado:", info.response);
    return info;
  } catch (err) {
    console.error("Error enviando correo:", err);
    throw new Error("No se pudo enviar el correo");
  }
};
