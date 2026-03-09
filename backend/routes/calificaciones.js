import express from 'express';
// ✅ CORRECCIÓN FINAL: Usamos importación por defecto, ya que models/Calificacion.js usa 'export default'.
import Calificacion from '../models/Calificacion.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { schoolMiddleware } from '../middlewares/schoolMiddleware.js';

const router = express.Router();

/**
 * @route   GET /calificaciones?grupoId=...&asignatura=...
 * @desc    Obtiene los criterios y calificaciones para una materia específica de un grupo (Vista Profesor).
 * @access  Private (Profesores)
 */
router.get('/', authMiddleware, schoolMiddleware, async (req, res) => {
  try {
    const { grupoId, asignatura } = req.query;
    const school_id = req.user.school_id;
    if (!grupoId || !asignatura) {
      return res.status(400).json({ msg: 'Se requieren los parámetros grupoId y asignatura' });
    }

    // Busca el documento de calificación que coincida con el grupo Y la asignatura
    const registroDeCalificaciones = await Calificacion.findOne({
      grupo: grupoId,
      asignatura: asignatura,
      school_id
    });

    if (!registroDeCalificaciones) {
      // ✅ Devolvemos la estructura correcta de objeto (Mixed) para 'criterios'
      return res.json({
        criterios: { 1: [], 2: [], 3: [] },
        calificaciones: {}
      });
    }

    res.json(registroDeCalificaciones);

  } catch (error) {
    console.error("Error al obtener calificaciones (Profesor):", error.message);
    res.status(500).send('Error del Servidor');
  }
});

/**
 * @route   POST /calificaciones
 * @desc    Guarda o actualiza los criterios y calificaciones para una materia de un grupo (Vista Profesor).
 * @access  Private (Profesores)
 */
router.post('/', authMiddleware, schoolMiddleware, async (req, res) => {
  const { grupoId, asignatura, criterios, calificaciones, numTareas } = req.body;
  const school_id = req.user.school_id;

  if (!grupoId || !asignatura || !criterios || calificaciones === undefined) {
    return res.status(400).json({ msg: 'Faltan datos requeridos (grupoId, asignatura, criterios, calificaciones)' });
  }

  try {
    const registroActualizado = await Calificacion.findOneAndUpdate(
      { grupo: grupoId, asignatura: asignatura, school_id },
      { criterios, calificaciones, numTareas, grupo: grupoId, asignatura: asignatura, school_id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
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

export { router as calificacionesRouter };
