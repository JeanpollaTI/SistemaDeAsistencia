import express from 'express';
import TablaMatematica from '../models/TablaMatematica.js';
import User from '../models/User.js';
import { authMiddleware, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET all group evaluations & evaluators for user's school
router.get('/', authMiddleware, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        if (!schoolId) return res.status(400).json({ msg: 'Usuario no tiene escuela asignada' });

        const tablas = await TablaMatematica.find({ school_id: schoolId })
            .populate('evaluador_id', 'nombre email role')
            .populate('evaluadores', 'nombre email role')
            .lean();

        // Also fetch teachers list for school to populate dropdown options
        const profesores = await User.find({ 
            school_id: schoolId, 
            role: { $in: ['profesor', 'admin'] } 
        }).select('_id nombre email role').lean();

        res.json({ tablas, profesores });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST assign evaluator teacher to a group tab (Admin only)
router.post('/evaluador', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { grupoNombre, evaluador_id, evaluadores } = req.body;
        const schoolId = req.user.school_id;

        if (!grupoNombre) {
            return res.status(400).json({ msg: 'El nombre del grupo es obligatorio' });
        }

        let record = await TablaMatematica.findOne({ school_id: schoolId, grupoNombre });
        if (!record) {
            record = new TablaMatematica({
                school_id: schoolId,
                grupoNombre,
                evaluador_id: evaluador_id || null,
                evaluadores: Array.isArray(evaluadores) ? evaluadores : (evaluador_id ? [evaluador_id] : []),
                evaluaciones: []
            });
        } else {
            record.evaluador_id = evaluador_id || null;
            if (Array.isArray(evaluadores)) {
                record.evaluadores = evaluadores;
            } else if (evaluador_id) {
                if (!record.evaluadores) record.evaluadores = [];
                if (!record.evaluadores.includes(evaluador_id)) {
                    record.evaluadores.push(evaluador_id);
                }
            } else {
                record.evaluadores = [];
            }
        }

        await record.save();
        const populated = await TablaMatematica.findById(record._id)
            .populate('evaluador_id', 'nombre email role')
            .populate('evaluadores', 'nombre email role');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST update evaluations for a group
router.post('/evaluar', authMiddleware, async (req, res) => {
    try {
        const { grupoNombre, evaluaciones } = req.body;
        const schoolId = req.user.school_id;

        if (!grupoNombre || !Array.isArray(evaluaciones)) {
            return res.status(400).json({ msg: 'Grupo y lista de evaluaciones válidos requeridos' });
        }

        let record = await TablaMatematica.findOne({ school_id: schoolId, grupoNombre });
        if (!record) {
            record = new TablaMatematica({
                school_id: schoolId,
                grupoNombre,
                evaluador_id: null,
                evaluaciones: []
            });
        }

        // Merge or replace evaluations
        record.evaluaciones = evaluaciones;
        await record.save();

        const populated = await TablaMatematica.findById(record._id)
            .populate('evaluador_id', 'nombre email role')
            .populate('evaluadores', 'nombre email role');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
