import School from "../models/School.js";

export const schoolMiddleware = async (req, res, next) => {
    try {
        // El id de la escuela ya debería venir en el objeto req.user
        if (!req.user || !req.user.school_id) {
            console.warn("schoolMiddleware: Missing school_id in req.user", req.user); // DEBUG
            return res.status(200).json({
                error: "SCHOOL_REQUIRED",
                msg: "No se ha identificado la escuela. Por favor, realice la migración inicial."
            });
        }

        const schoolId = req.user.school_id;

        // Verificar si la escuela existe
        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(200).json({
                error: "SCHOOL_NOT_FOUND",
                msg: "La institución asignada no existe en el sistema."
            });
        }

        if (school.subscription.status === "suspended") {
            return res.status(403).json({
                error: "Servicio Suspendido",
                msg: "El acceso ha sido bloqueado por falta de pago. Contacte al administrador de la plataforma.",
                subscriptionStatus: "suspended"
            });
        }

        // Guardar la información de la escuela en el request para uso posterior
        req.school = school;

        next();
    } catch (err) {
        console.error("Error en schoolMiddleware:", err);
        res.status(500).json({ error: "Error en el servidor al validar la institución." });
    }
};
