import express from 'express';
import TablaMatematica from '../models/TablaMatematica.js';
import User from '../models/User.js';
import { authMiddleware, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

const DEFAULT_CORTES_CONFIG = {
    p1: '1-5',
    p2: '1-5',
    p3: '1-5',
    p4: '1-5',
    p5: '6-10',
    p6: '6-10',
    p7: '6-10'
};

// GET all group evaluations & evaluators for user's school
router.get('/', authMiddleware, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        if (!schoolId) return res.status(400).json({ msg: 'Usuario no tiene escuela asignada' });

        let query = { school_id: schoolId };

        // Si el usuario es profesor, filtrar únicamente los grupos asignados para esta actividad específica
        if (req.user.role === 'profesor') {
            query.$or = [
                { evaluador_id: req.user._id },
                { evaluadores: req.user._id }
            ];
        }

        const tablas = await TablaMatematica.find(query)
            .populate('evaluador_id', 'nombre apellidoPaterno apellidoMaterno email role')
            .populate('evaluadores', 'nombre apellidoPaterno apellidoMaterno email role')
            .lean();

        // Also fetch teachers list for school to populate dropdown options
        const profesores = await User.find({ 
            school_id: schoolId, 
            role: { $in: ['profesor', 'admin'] } 
        }).select('_id nombre apellidoPaterno apellidoMaterno email role').lean();

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

        const cleanEvalId = evaluador_id || null;
        const cleanEvaluadores = Array.isArray(evaluadores)
            ? evaluadores.filter(Boolean)
            : (cleanEvalId ? [cleanEvalId] : []);

        let record = await TablaMatematica.findOne({ school_id: schoolId, grupoNombre });
        if (!record) {
            record = new TablaMatematica({
                school_id: schoolId,
                grupoNombre,
                evaluador_id: cleanEvalId,
                evaluadores: cleanEvaluadores,
                cortesConfig: DEFAULT_CORTES_CONFIG,
                evaluaciones: []
            });
        } else {
            record.evaluador_id = cleanEvalId;
            record.evaluadores = cleanEvaluadores;
        }

        await record.save();
        const populated = await TablaMatematica.findById(record._id)
            .populate('evaluador_id', 'nombre apellidoPaterno apellidoMaterno email role')
            .populate('evaluadores', 'nombre apellidoPaterno apellidoMaterno email role');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST configure table range (1-5 or 6-10) per corte (p1..p7) (Admin only)
router.post('/config-cortes', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { grupoNombre, cortesConfig, applyToAll, allGrupos } = req.body;
        const schoolId = req.user.school_id;

        if (!cortesConfig || typeof cortesConfig !== 'object') {
            return res.status(400).json({ msg: 'Configuración de cortes inválida' });
        }

        const sanitizedConfig = { ...DEFAULT_CORTES_CONFIG };
        ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].forEach(k => {
            if (cortesConfig[k] === '1-5' || cortesConfig[k] === '6-10') {
                sanitizedConfig[k] = cortesConfig[k];
            }
        });

        if (applyToAll) {
            const targetGroups = Array.isArray(allGrupos) && allGrupos.length > 0
                ? allGrupos
                : ['1A', '1B', '1C', '1D', '1E', '2A', '2B', '2C', '2D', '2E', '3A', '3B', '3C', '3D', '3E'];

            await Promise.all(targetGroups.map(async (gName) => {
                let rec = await TablaMatematica.findOne({ school_id: schoolId, grupoNombre: gName });
                if (!rec) {
                    rec = new TablaMatematica({
                        school_id: schoolId,
                        grupoNombre: gName,
                        evaluador_id: null,
                        evaluadores: [],
                        cortesConfig: sanitizedConfig,
                        evaluaciones: []
                    });
                } else {
                    rec.cortesConfig = sanitizedConfig;
                }
                await rec.save();
            }));

            return res.json({ msg: 'Configuración de cortes aplicada a todos los grupos', cortesConfig: sanitizedConfig });
        }

        if (!grupoNombre) {
            return res.status(400).json({ msg: 'El nombre del grupo es obligatorio' });
        }

        let record = await TablaMatematica.findOne({ school_id: schoolId, grupoNombre });
        if (!record) {
            record = new TablaMatematica({
                school_id: schoolId,
                grupoNombre,
                evaluador_id: null,
                evaluadores: [],
                cortesConfig: sanitizedConfig,
                evaluaciones: []
            });
        } else {
            record.cortesConfig = sanitizedConfig;
        }

        await record.save();
        res.json({ msg: `Configuración de cortes actualizada para ${grupoNombre}`, cortesConfig: sanitizedConfig, record });
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
                cortesConfig: DEFAULT_CORTES_CONFIG,
                evaluaciones: []
            });
        }

        // Merge or replace evaluations
        record.evaluaciones = evaluaciones;
        await record.save();

        const populated = await TablaMatematica.findById(record._id)
            .populate('evaluador_id', 'nombre apellidoPaterno apellidoMaterno email role')
            .populate('evaluadores', 'nombre apellidoPaterno apellidoMaterno email role');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
