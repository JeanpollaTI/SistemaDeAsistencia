import mongoose from "mongoose";
import School from "../models/School.js";

export const schoolMiddleware = async (req, res, next) => {
    try {
        // El id de la escuela ya debería venir en el objeto req.user
        if (!req.user || !req.user.school_id) {
            console.warn("schoolMiddleware: Missing school_id in req.user. Path:", req.path, "User:", req.user?.id || "not identified");
            return res.status(401).json({
                error: "SCHOOL_REQUIRED",
                msg: "No se ha identificado la escuela o la sesión ha expirado."
            });
        }

        const schoolId = req.user.school_id;

        // Validar si el ID es un ObjectId válido para evitar CastError 500
        if (schoolId && !mongoose.Types.ObjectId.isValid(schoolId)) {
            console.error("schoolMiddleware: Invalid schoolId format:", schoolId);
            return res.status(200).json({
                error: "INVALID_SCHOOL_ID",
                msg: "El ID de la institución no es válido. Por favor, contacte a soporte."
            });
        }

        // Verificar si la escuela existe
        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(200).json({
                error: "SCHOOL_NOT_FOUND",
                msg: "La institución asignada no existe en el sistema."
            });
        }

        if (school.subscription?.nextBilling) {
            const nextBillingDate = new Date(school.subscription.nextBilling);
            if (new Date() > nextBillingDate && school.subscription.status !== "suspended") {
                school.subscription.status = "suspended";
                await school.save(); // Modificamos en DB automáticamente al detectarlo expirado.
            }
        }

        if (school?.subscription?.status === "suspended") {
            return res.status(403).json({
                error: "Servicio Suspendido",
                msg: "La prueba gratuita ha terminado o el acceso ha sido bloqueado por falta de pago. Contacte al administrador de la plataforma.",
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
