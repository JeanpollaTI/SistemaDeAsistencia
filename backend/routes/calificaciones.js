import express from 'express';
import Calificacion from '../models/Calificacion.js'; // Usando exportación por defecto
import { authMiddleware, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /calificaciones?grupoId=...&asignatura=...
 * @desc    Obtiene los criterios y calificaciones para una materia específica de un grupo.
 * @access  Private (Profesores)
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { grupoId, asignatura } = req.query;
        if (!grupoId || !asignatura) {
            return res.status(400).json({ msg: 'Se requieren los parámetros grupoId y asignatura' });
        }

        // Busca el documento de calificación que coincida con el grupo Y la asignatura
        const registroDeCalificaciones = await Calificacion.findOne({ 
            grupo: grupoId, 
            asignatura: asignatura 
        });

        if (!registroDeCalificaciones) {
            // Si no existe, es la primera vez que el profesor abre esta materia.
            return res.json({ criterios: [], calificaciones: {} });
        }

        res.json(registroDeCalificaciones);

    } catch (error) {
        console.error("Error al obtener calificaciones:", error.message);
        res.status(500).send('Error del Servidor');
    }
});

/**
 * @route   POST /calificaciones
 * @desc    Guarda o actualiza los criterios y calificaciones para una materia de un grupo.
 * @access  Private (Profesores)
 */
router.post('/', authMiddleware, async (req, res) => {
    const { grupoId, asignatura, criterios, calificaciones } = req.body;
    
    // Validamos que calificaciones NO sea estrictamente 'undefined'
    if (!grupoId || !asignatura || !criterios || calificaciones === undefined) {
        return res.status(400).json({ msg: 'Faltan datos requeridos (grupoId, asignatura, criterios, calificaciones)' });
    }

    try {
        // Busca un documento por grupo y asignatura, y lo actualiza.
        const registroActualizado = await Calificacion.findOneAndUpdate(
            { grupo: grupoId, asignatura: asignatura }, // El filtro para encontrar el documento correcto
            { criterios, calificaciones, grupo: grupoId, asignatura: asignatura }, // Los datos a guardar/actualizar
            { upsert: true, new: true, setDefaultsOnInsert: true } // Opciones: upsert crea si no existe, new devuelve el doc actualizado
        );
        
        res.status(200).json({ 
            msg: 'Calificaciones guardadas exitosamente',
            data: registroActualizado 
        });

    } catch (error) {
        console.error("Error al guardar calificaciones:", error.message);
        res.status(500).send('Error del Servidor');
    }
});

// -----------------------------------------------------
// --- NUEVAS RUTAS AÑADIDAS ---
// -----------------------------------------------------

/**
 * @route   DELETE /calificaciones?grupoId=...&asignatura=...
 * @desc    Elimina el registro completo de una asignatura/grupo.
 * @access  Private (Admin)
 */
router.delete('/', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { grupoId, asignatura } = req.query;
        if (!grupoId || !asignatura) {
            return res.status(400).json({ msg: 'Se requieren los parámetros grupoId y asignatura para eliminar el registro.' });
        }

        const resultado = await Calificacion.findOneAndDelete({
            grupo: grupoId,
            asignatura: asignatura
        });

        if (!resultado) {
            return res.status(404).json({ msg: 'Registro de calificación no encontrado.' });
        }

        res.json({ msg: `Registro de ${asignatura} en grupo ${grupoId} eliminado correctamente.` });

    } catch (error) {
        console.error("Error al eliminar registro de calificaciones:", error.message);
        res.status(500).send('Error del Servidor');
    }
});


/**
 * @route   GET /calificaciones/all
 * @desc    Obtiene todos los documentos de calificación (útil para reportes admin/consolidados).
 * @access  Private (Admin)
 */
router.get('/all', authMiddleware, isAdmin, async (req, res) => {
    try {
        const registros = await Calificacion.find()
            .populate('grupo', 'nombre'); // Popula solo el nombre del grupo
        
        res.json(registros);
    } catch (error) {
        console.error("Error al obtener todos los registros:", error.message);
        res.status(500).send('Error del Servidor');
    }
});


export { router as calificacionesRouter };