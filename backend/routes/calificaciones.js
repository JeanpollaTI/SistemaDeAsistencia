import express from 'express';
<<<<<<< HEAD
// ✅ CORRECCIÓN FINAL: Usamos importación por defecto, ya que models/Calificacion.js usa 'export default'.
import Calificacion from '../models/Calificacion.js'; 
=======
import Calificacion from '../models/Calificacion.js'; // Usando exportación por defecto
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

<<<<<<< HEAD
// --- RUTAS DE PROFESOR ---

/**
 * @route   GET /calificaciones?grupoId=...&asignatura=...
 * @desc    Obtiene los criterios y calificaciones para una materia específica de un grupo (Vista Profesor).
=======
/**
 * @route   GET /calificaciones?grupoId=...&asignatura=...
 * @desc    Obtiene los criterios y calificaciones para una materia específica de un grupo.
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
 * @access  Private (Profesores)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { grupoId, asignatura } = req.query;
    if (!grupoId || !asignatura) {
      return res.status(400).json({ msg: 'Se requieren los parámetros grupoId y asignatura' });
    }

<<<<<<< HEAD
=======
    // Busca el documento de calificación que coincida con el grupo Y la asignatura
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
    const registroDeCalificaciones = await Calificacion.findOne({ 
      grupo: grupoId, 
      asignatura: asignatura 
    });

    if (!registroDeCalificaciones) {
<<<<<<< HEAD
      // ✅ Devolvemos la estructura correcta de objeto (Mixed) para 'criterios'
      return res.json({ 
        criterios: { 1: [], 2: [], 3: [] }, 
        calificaciones: {} 
      });
=======
      // Si no existe, es la primera vez que el profesor abre esta materia.
      // Se devuelve una estructura vacía para que el frontend no falle.
      return res.json({ criterios: [], calificaciones: {} });
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
    }

    res.json(registroDeCalificaciones);

  } catch (error) {
<<<<<<< HEAD
    console.error("Error al obtener calificaciones (Profesor):", error.message);
=======
    console.error("Error al obtener calificaciones:", error.message);
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
    res.status(500).send('Error del Servidor');
  }
});

/**
 * @route   POST /calificaciones
<<<<<<< HEAD
 * @desc    Guarda o actualiza los criterios y calificaciones para una materia de un grupo (Vista Profesor).
=======
 * @desc    Guarda o actualiza los criterios y calificaciones para una materia de un grupo.
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
 * @access  Private (Profesores)
 */
router.post('/', authMiddleware, async (req, res) => {
    const { grupoId, asignatura, criterios, calificaciones } = req.body;
    
    if (!grupoId || !asignatura || !criterios || calificaciones === undefined) {
        return res.status(400).json({ msg: 'Faltan datos requeridos (grupoId, asignatura, criterios, calificaciones)' });
    }

    try {
<<<<<<< HEAD
        const registroActualizado = await Calificacion.findOneAndUpdate(
            { grupo: grupoId, asignatura: asignatura }, 
            { criterios, calificaciones, grupo: grupoId, asignatura: asignatura },
            { upsert: true, new: true, setDefaultsOnInsert: true }
=======
        // Busca un documento por grupo y asignatura, y lo actualiza.
        // Si no lo encuentra, 'upsert: true' crea uno nuevo.
        const registroActualizado = await Calificacion.findOneAndUpdate(
            { grupo: grupoId, asignatura: asignatura }, // El filtro para encontrar el documento correcto
            { criterios, calificaciones, grupo: grupoId, asignatura: asignatura }, // Los datos a guardar/actualizar
            { upsert: true, new: true, setDefaultsOnInsert: true } // Opciones: upsert crea si no existe, new devuelve el doc actualizado
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
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

<<<<<<< HEAD
// Nota: La ruta de administrador /:grupoId/calificaciones-admin DEBE estar en routes/grupos.js

=======
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
export { router as calificacionesRouter };
