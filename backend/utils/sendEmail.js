import sgMail from '@sendgrid/mail';

// Asignamos la API Key de SendGrid al módulo, se leerá de process.env.EMAIL_PASS
sgMail.setApiKey(process.env.EMAIL_PASS);

/**
 * Envía un correo electrónico usando la API de SendGrid (Protocolo HTTP)
 *
 * @param {string|string[]} to - Correo(s) del destinatario. Acepta una cadena o un array.
 * @param {string} subject - Asunto del correo
 * @param {string} html - Contenido HTML del correo
 * @param {Array} attachments - Opcional, archivos adjuntos [{ filename, content, encoding, contentType }]
 */
export const sendEmail = async (to, subject, html, attachments = []) => {
    if (!to) throw new Error("Debe especificar el destinatario del correo");
    if (!subject) throw new Error("Debe especificar el asunto del correo");

    // Convertir el formato de Nodemailer attachments al formato requerido por SendGrid
    // Asumimos que los PDFs vienen en Base64
    const sendgridAttachments = attachments.map(att => ({
        content: att.content, 
        filename: att.filename,
        type: att.contentType, // SendGrid usa 'type' en lugar de 'contentType'
        disposition: 'attachment',
        encoding: att.encoding || 'base64' // Aseguramos que se especifique la codificación
    }));

    const msg = {
        to: to,
        // Usamos la variable EMAIL_FROM para el remitente verificado (Ej: "Secundaria N9 <correo@ejemplo.com>")
        from: process.env.EMAIL_FROM, 
        subject: subject,
        html: html,
        attachments: sendgridAttachments.length > 0 ? sendgridAttachments : undefined,
    };

    try {
        // Enviar el correo usando la API HTTP
        const info = await sgMail.send(msg);
        console.log("Correo enviado via SendGrid API. Response:", info);
        return info;
    } catch (err) {
        // Manejo de error seguro y detallado para diagnosticar problemas de API Key/Remitente
        console.error(
            "Error enviando correo via SendGrid API. Detalles:", 
            // Accede al cuerpo del error si está disponible, si no, usa el objeto de error
            err.response && err.response.body ? err.response.body : err
        );
        throw new Error("No se pudo enviar el correo");
    }
};