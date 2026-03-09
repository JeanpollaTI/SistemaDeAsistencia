import express from "express";
import Asistencia from "../models/Asistencia.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { schoolMiddleware } from "../middlewares/schoolMiddleware.js";

const router = express.Router();

// [GET] /asistencia?grupoId=...&asignatura=...&profesorId=...
// Obtiene el registro de asistencia para una clase específica.
router.get("/", authMiddleware, schoolMiddleware, async (req, res) => {
    try {
        const { grupoId, asignatura, profesorId: profesorIdQuery } = req.query;
        const school_id = req.user.school_id;

        // CORRECCIÓN CLAVE: Se usa req.user._id, que es el estándar de MongoDB y del token.
        const idDelProfesor = (req.user.role === 'admin' && profesorIdQuery)
            ? profesorIdQuery
            : req.user._id;

        if (!grupoId || !asignatura || !idDelProfesor) {
            return res.status(400).json({ error: "Faltan datos para la búsqueda de asistencia." });
        }

        const registroAsistencia = await Asistencia.findOne({
            profesor: idDelProfesor, // Busca por el ID correcto.
            grupo: grupoId,
            asignatura: asignatura,
            school_id
        });

        if (!registroAsistencia) {
            return res.status(200).json(null);
        }

        res.json(registroAsistencia);

    } catch (err) {
        console.error("Error en [GET /asistencia]:", err);
        res.status(500).json({ error: "Error al obtener la asistencia." });
    }
});


// [PUT] /asistencia - Crea o actualiza un registro de asistencia.
router.put("/", authMiddleware, schoolMiddleware, async (req, res) => {
    try {
        const { grupoId, asignatura, registros, diasPorBimestre } = req.body;
        const profesorId = req.user._id;
        const school_id = req.user.school_id;

        if (!grupoId || !asignatura) {
            return res.status(400).json({ error: "Faltan datos para guardar la asistencia." });
        }

        const filter = {
            grupo: grupoId,
            profesor: profesorId,
            asignatura: asignatura,
            school_id
        };

        const update = {
            registros: registros || {},
            diasPorBimestre: diasPorBimestre || {}
        };

        const options = { new: true, upsert: true, runValidators: true };

        const asistenciaGuardada = await Asistencia.findOneAndUpdate(filter, update, options);

        res.json(asistenciaGuardada);

    } catch (err) {
        console.error("Error en [PUT /asistencia]:", err);
        res.status(500).json({ error: "Error al guardar la asistencia." });
    }
});


export { router as asistenciaRouter };

