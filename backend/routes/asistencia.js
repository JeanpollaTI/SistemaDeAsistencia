import express from "express";
import Asistencia from "../models/Asistencia.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import mongoose from "mongoose"; // Necesario para la validación de ObjectId

const router = express.Router();

// [GET] /asistencia?grupoId=...&asignatura=...&profesorId=...
// Obtiene el registro de asistencia para una clase específica.
router.get("/", authMiddleware, async (req, res) => {
    try {
        const { grupoId, asignatura, profesorId: profesorIdQuery } = req.query;

        // Determina el ID del profesor: si es admin y proporciona profesorIdQuery, úsalo. Si no, usa el ID del usuario logueado.
        const idDelProfesor = (req.user.role === 'admin' && profesorIdQuery && mongoose.Types.ObjectId.isValid(profesorIdQuery)) 
            ? profesorIdQuery 
            : req.user.id; // CLAVE: Usamos req.user.id que es el estándar de MongoDB y del token.

        if (!grupoId || !asignatura || !idDelProfesor) {
            return res.status(400).json({ error: "Faltan datos para la búsqueda de asistencia." });
        }
        
        const registroAsistencia = await Asistencia.findOne({
            profesor: idDelProfesor, // Busca por el ID correcto.
            grupo: grupoId,
            asignatura: asignatura,
        });

        if (!registroAsistencia) {
            // Si no existe, devuelve nulo para que el frontend pueda crear una nueva.
            return res.status(200).json(null);
        }

        res.json(registroAsistencia);

    } catch (err) {
        console.error("Error en [GET /asistencia]:", err);
        res.status(500).json({ error: "Error al obtener la asistencia." });
    }
});


// [PUT] /asistencia - Crea o actualiza un registro de asistencia.
router.put("/", authMiddleware, async (req, res) => {
    try {
        const { grupoId, asignatura, registros, diasPorBimestre } = req.body;
        const profesorId = req.user.id; // CORRECCIÓN: Se usa req.user.id del token

        if (!grupoId || !asignatura) {
            return res.status(400).json({ error: "Faltan datos para guardar la asistencia." });
        }

        const filter = { 
            grupo: grupoId, 
            profesor: profesorId, 
            asignatura: asignatura 
        };

        const update = { 
            registros: registros || {}, 
            diasPorBimestre: diasPorBimestre || {} 
        };
        
        // Opciones: new=true devuelve el documento actualizado, upsert=true lo crea si no existe.
        const options = { new: true, upsert: true, runValidators: true };

        const asistenciaGuardada = await Asistencia.findOneAndUpdate(filter, update, options);
        
        res.json(asistenciaGuardada);

    } catch (err) {
        console.error("Error en [PUT /asistencia]:", err);
        res.status(500).json({ error: "Error al guardar la asistencia." });
    }
});


export { router as asistenciaRouter };