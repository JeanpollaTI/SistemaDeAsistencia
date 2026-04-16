// backend/routes/superadmin.js
import express from 'express';
import School from '../models/School.js';
import User from '../models/User.js';
import Grupo from '../models/Grupo.js';
import Calificacion from '../models/Calificacion.js';
import Asistencia from '../models/Asistencia.js';
import Horario from '../models/Horario.js';
import Materia from '../models/Materia.js';
import { authMiddleware, isSuperAdmin } from '../middlewares/authMiddleware.js';
import Suggestion from '../models/Suggestion.js';
import Broadcast from '../models/Broadcast.js';

const router = express.Router();

// GET all schools with metadata
router.get('/schools', authMiddleware, isSuperAdmin, async (req, res) => {
    try {
        const schools = await School.find().lean();
        
        // Add user counts for each school
        const schoolsWithStats = await Promise.all(schools.map(async (school) => {
            const userCount = await User.countDocuments({ school_id: school._id });
            const groupCount = await Grupo.countDocuments({ school_id: school._id });
            
            // Find the primary admin (the one who created the school or first admin)
            const admin = await User.findOne({ school_id: school._id, role: 'admin' }).select('nombre email celular');
            
            return {
                ...school,
                stats: {
                    userCount,
                    groupCount
                },
                adminContact: admin
            };
        }));

        res.json(schoolsWithStats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE school subscription status
router.put('/schools/:id/status', authMiddleware, isSuperAdmin, async (req, res) => {
    try {
        const { status, days } = req.body;
        
        if (!['active', 'suspended', 'trial'].includes(status)) {
            return res.status(400).json({ msg: 'Estado de suscripción inválido' });
        }

        const updateData = { 
            'subscription.status': status 
        };

        // If status is active or trial, refresh the nextBilling date
        if (days) {
            updateData['subscription.nextBilling'] = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }

        const school = await School.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!school) return res.status(404).json({ msg: 'Escuela no encontrada' });
        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE school and all associated data
router.delete('/schools/:id', authMiddleware, isSuperAdmin, async (req, res) => {
    try {
        const schoolId = req.params.id;
        
        // 1. Check if school exists
        const school = await School.findById(schoolId);
        if (!school) return res.status(404).json({ msg: 'Escuela no encontrada' });

        // 2. Delete all related data across all models
        const models = [User, Grupo, Calificacion, Asistencia, Horario, Materia];
        const deleteResults = {};

        for (const Model of models) {
            const result = await Model.deleteMany({ school_id: schoolId });
            deleteResults[Model.modelName] = result.deletedCount;
        }

        // 3. Delete the school itself
        await School.findByIdAndDelete(schoolId);

        res.json({ 
            msg: `Escuela "${school.name}" y todos sus datos han sido eliminados.`,
            details: deleteResults 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SUGGESTIONS MANAGEMENT ---

// GET all suggestions
router.get('/suggestions', authMiddleware, isSuperAdmin, async (req, res) => {
    try {
        const suggestions = await Suggestion.find()
            .populate('author_id', 'nombre email role')
            .populate('school_id', 'name')
            .sort({ isPinned: -1, createdAt: -1 });
        res.json(suggestions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT toggle pin
router.put('/suggestions/:id/pin', authMiddleware, isSuperAdmin, async (req, res) => {
    try {
        const suggestion = await Suggestion.findById(req.params.id);
        if (!suggestion) return res.status(404).json({ msg: 'Sugerencia no encontrada' });
        
        suggestion.isPinned = !suggestion.isPinned;
        await suggestion.save();
        res.json(suggestion);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE suggestion
router.delete('/suggestions/:id', authMiddleware, isSuperAdmin, async (req, res) => {
    try {
        await Suggestion.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Sugerencia eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- BROADCAST NOTIFICATIONS ---

// POST broadcast message
router.post('/broadcast', authMiddleware, isSuperAdmin, async (req, res) => {
    try {
        const { message, type, days } = req.body;
        if (!message) return res.status(400).json({ msg: 'Mensaje obligatorio' });

        const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : undefined;

        const broadcast = new Broadcast({
            author_id: req.user.id,
            message,
            type: type || 'update',
            expiresAt
        });

        await broadcast.save();
        res.status(201).json({ msg: 'Comunicado enviado correctamente', broadcast });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET active broadcasts (Public/Auth)
// Note: This could also be in a general notifications router
router.get('/broadcasts/active', authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const broadcasts = await Broadcast.find({
            $or: [
                { expiresAt: { $gt: now } },
                { expiresAt: { $exists: false } },
                { expiresAt: null }
            ]
        }).sort({ createdAt: -1 }).limit(5);
        res.json(broadcasts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
