import sgMail from '@sendgrid/mail';

// Asignamos la API Key de SendGrid al módulo, se leerá de process.env.EMAIL_PASS
sgMail.setApiKey(process.env.EMAIL_PASS);

/**
 * Envía un correo electrónico usando la API de SendGrid (Protocolo HTTP)
 *
 * @param {string} to - Correo del destinatario
 * @param {string} subject - Asunto del correo
 * @param {string} html - Contenido HTML del correo
 * @param {Array} attachments - Opcional, archivos adjuntos [{ filename, content, encoding, contentType }]
 */
export const sendEmail = async (to, subject, html, attachments = []) => {
    if (!to) throw new Error("Debe especificar el destinatario del correo");
    if (!subject) throw new Error("Debe especificar el asunto del correo");

    // Convertir el formato de Nodemailer attachments al formato requerido por SendGrid
    const sendgridAttachments = attachments.map(att => ({
        content: att.content, // Asumimos que ya está en base64 o en string
        filename: att.filename,
        type: att.contentType, // SendGrid usa 'type' en lugar de 'contentType'
        disposition: 'attachment'
    }));

    const msg = {
        to: to,
        // SendGrid solo necesita el correo electrónico verificado de la variable EMAIL_FROM.
        from: process.env.EMAIL_FROM, 
        subject: subject,
        html: html,
        attachments: sendgridAttachments.length > 0 ? sendgridAttachments : undefined,
    };

    try {
        // Enviar el correo usando la API HTTP
        const info = await sgMail.send(msg);
        console.log("Correo enviado via SendGrid API:", info);
        return info;
    } catch (err) {
        // Los errores de SendGrid son muy detallados y se encuentran en err.response.body
        console.error("Error enviando correo via SendGrid API:", err.response ? JSON.parse(err.response.body) : err);
        throw new Error("No se pudo enviar el correo");
    }
};