import express from 'express';
import School from '../models/School.js';
import { authMiddleware, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET school by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
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

export default router;
