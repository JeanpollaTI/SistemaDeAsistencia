import express from 'express';
import School from '../models/School.js';
import User from '../models/User.js';
import Grupo from '../models/Grupo.js';
import Calificacion from '../models/Calificacion.js';
import Asistencia from '../models/Asistencia.js';
import Horario from '../models/Horario.js';
import Materia from '../models/Materia.js';
import { authMiddleware, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET school by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        if (!req.params.id || req.params.id === 'undefined') {
            return res.status(400).json({ msg: 'ID de escuela inválido' });
        }
        const school = await School.findById(req.params.id);
        if (!school) return res.status(404).json({ msg: 'Escuela no encontrada' });

        // Verificación de seguridad: solo el admin de esa escuela puede verla
        if (req.user.role !== 'superadmin' && req.user.school_id.toString() !== school._id.toString()) {
            return res.status(403).json({ msg: 'Acceso denegado' });
        }

        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE school
router.put('/:id', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { name, type, evaluationPeriod, config } = req.body;

        // Verificación de seguridad
        if (req.user.school_id.toString() !== req.params.id) {
            return res.status(403).json({ msg: 'Solo puedes editar tu propia escuela' });
        }

        const school = await School.findByIdAndUpdate(
            req.params.id,
            { name, type, evaluationPeriod, config },
            { new: true }
        );

        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// EMERGENCY MIGRATION ROUTE
// This route can be called once to tag all existing data with a default school
router.post('/emergency-migrate', async (req, res) => {
    try {
        const { secret } = req.body;
        // Basic security using the JWT_SECRET as a key
        if (!secret || secret !== process.env.JWT_SECRET) {
            return res.status(401).json({ msg: 'Unauthorized' });
        }

        console.log("Starting emergency migration...");

        // 1. Create or find the default school
        let school = await School.findOne({ name: "Secundaria General Número 9" });
        if (!school) {
            school = new School({
                name: "Secundaria General Número 9",
                type: "Secundaria",
                evaluationPeriod: "Trimestre",
                config: { scaleMax: 10 }
            });
            await school.save();
        }

        const schoolId = school._id;

        // 2. Update all models
        const models = [User, Grupo, Calificacion, Asistencia, Horario, Materia];
        const results = {};

        for (const Model of models) {
            const result = await Model.updateMany(
                { school_id: { $exists: false } },
                { $set: { school_id: schoolId } }
            );
            results[Model.modelName] = result.modifiedCount;
        }

        res.json({ msg: 'Migration completed', results });
    } catch (err) {
        console.error("Migration error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
