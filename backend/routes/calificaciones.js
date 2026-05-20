import express from 'express';
// ✅ CORRECCIÓN FINAL: Usamos importación por defecto, ya que models/Calificacion.js usa 'export default'.
import Calificacion from '../models/Calificacion.js';
import Grupo from '../models/Grupo.js';
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

/**
 * @route   POST /calificaciones/migrar
 * @desc    Migra criterios y calificaciones de un trimestre a otro.
 * @access  Private (Profesores)
 */
router.post('/migrar', authMiddleware, schoolMiddleware, async (req, res) => {
  const { grupoId, asignatura, origenBimestre, destinoBimestre, accionConflictos, accionOrigen } = req.body;
  const school_id = req.user.school_id;

  if (!grupoId || !asignatura || !origenBimestre || !destinoBimestre) {
    return res.status(400).json({ msg: 'Faltan parámetros requeridos para la migración.' });
  }

  try {
    const registro = await Calificacion.findOne({ grupo: grupoId, asignatura, school_id });
    if (!registro) {
      return res.status(404).json({ msg: 'No se encontró registro de calificaciones para este grupo y asignatura.' });
    }

    // Obtener los criterios de origen
    const criteriosOrigen = registro.criterios?.[origenBimestre] || [];
    if (criteriosOrigen.length === 0) {
      return res.status(400).json({ msg: `El Trimestre ${origenBimestre} de origen no tiene criterios definidos.` });
    }

    // Realizar una copia de criterios a destino
    const nuevosCriterios = { ...registro.criterios };
    nuevosCriterios[destinoBimestre] = JSON.parse(JSON.stringify(criteriosOrigen));

    // Realizar la copia de calificaciones por alumno
    const nuevasCalificaciones = { ...registro.calificaciones };
    
    // Recorrer los alumnos en calificaciones
    for (const alumnoId of Object.keys(nuevasCalificaciones)) {
      if (!nuevasCalificaciones[alumnoId]) nuevasCalificaciones[alumnoId] = {};
      
      const califOrigen = nuevasCalificaciones[alumnoId][origenBimestre] || {};
      const califDestino = nuevasCalificaciones[alumnoId][destinoBimestre] || {};

      if (accionConflictos === 'overwrite') {
        // Sobrescribimos completamente
        nuevasCalificaciones[alumnoId][destinoBimestre] = JSON.parse(JSON.stringify(califOrigen));
      } else {
        // Merge: solo copiamos si no existe en destino, o combinamos
        const mergeCalif = { ...califDestino };
        for (const criterio of Object.keys(califOrigen)) {
          if (!mergeCalif[criterio]) {
            mergeCalif[criterio] = JSON.parse(JSON.stringify(califOrigen[criterio]));
          } else {
            // Si el criterio ya existe en el destino, mergeamos las tareas
            const tareasOrigen = califOrigen[criterio] || {};
            const tareasDestino = mergeCalif[criterio] || {};
            const mergeTareas = { ...tareasDestino };
            for (const tareaIndex of Object.keys(tareasOrigen)) {
              if (tareasOrigen[tareaIndex] !== null && (mergeTareas[tareaIndex] === undefined || mergeTareas[tareaIndex] === null)) {
                mergeTareas[tareaIndex] = JSON.parse(JSON.stringify(tareasOrigen[tareaIndex]));
              }
            }
            mergeCalif[criterio] = mergeTareas;
          }
        }
        // También observaciones
        if (califOrigen.OBSERVACIONES && !mergeCalif.OBSERVACIONES) {
          mergeCalif.OBSERVACIONES = califOrigen.OBSERVACIONES;
        }
        nuevasCalificaciones[alumnoId][destinoBimestre] = mergeCalif;
      }

      // Si accionOrigen === 'clear', limpiamos el trimestre origen del alumno
      if (accionOrigen === 'clear') {
        delete nuevasCalificaciones[alumnoId][origenBimestre];
      }
    }

    // Si accionOrigen === 'clear', limpiamos los criterios origen
    if (accionOrigen === 'clear') {
      nuevosCriterios[origenBimestre] = [];
    }

    registro.criterios = nuevosCriterios;
    registro.calificaciones = nuevasCalificaciones;
    
    // Marcar como modificado
    registro.markModified('criterios');
    registro.markModified('calificaciones');

    await registro.save();

    res.status(200).json({
      msg: `Calificaciones del Trimestre ${origenBimestre} migradas al Trimestre ${destinoBimestre} exitosamente.`,
      data: registro
    });
  } catch (error) {
    console.error("Error al migrar calificaciones:", error.message);
    res.status(500).send('Error del Servidor');
  }
});

/**
 * @route   POST /calificaciones/corte
 * @desc    Crea o elimina un corte (congelamiento) de calificaciones para una asignatura de un grupo en un trimestre específico.
 * @access  Private (Profesores)
 */
router.post('/corte', authMiddleware, schoolMiddleware, async (req, res) => {
  const { grupoId, asignatura, trimestre, accion } = req.body;
  const school_id = req.user.school_id;

  if (!grupoId || !asignatura || !trimestre || !accion) {
    return res.status(400).json({ msg: 'Faltan parámetros requeridos (grupoId, asignatura, trimestre, accion).' });
  }

  try {
    const registro = await Calificacion.findOne({ grupo: grupoId, asignatura, school_id });
    if (!registro) {
      return res.status(404).json({ msg: 'No se encontró el registro de calificaciones.' });
    }

    const trimestreKey = String(trimestre);

    if (accion === 'crear') {
      // Obtener el grupo para listar alumnos
      const grupo = await Grupo.findById(grupoId).select('alumnos');
      if (!grupo) {
        return res.status(404).json({ msg: 'No se encontró el grupo.' });
      }

      const alumnos = grupo.alumnos || [];
      const criteriosActivos = registro.criterios?.[trimestreKey] || [];

      if (criteriosActivos.length === 0) {
        return res.status(400).json({ msg: `No hay criterios definidos para el Trimestre ${trimestre} para realizar el corte.` });
      }

      // Calcular el promedio ponderado de cada alumno en este instante
      const promedios = {};
      const numTareasConfig = registro.numTareas || {};
      const calificacionesMateria = registro.calificaciones || {};

      // Función auxiliar para redondear según las reglas de la escuela
      const redondearCalificacion = (val) => {
        if (typeof val !== 'number' || val <= 0) return 0;
        const valUnaDecimal = Math.round(val * 10) / 10;
        if (valUnaDecimal >= 5 && valUnaDecimal < 6) return 5;
        return Math.max(5, Math.round(valUnaDecimal));
      };

      alumnos.forEach(alumno => {
        const alumnoId = alumno._id.toString();
        const calificacionesAlumnoEnBimestre = calificacionesMateria[alumnoId]?.[trimestreKey];

        if (!calificacionesAlumnoEnBimestre || typeof calificacionesAlumnoEnBimestre !== 'object') {
          promedios[alumnoId] = null;
          return;
        }

        let promedioPonderado = 0;
        let pesoTotalAplicable = 0;

        criteriosActivos.forEach(criterio => {
          if (!criterio || !criterio.nombre || typeof criterio.porcentaje !== 'number') return;

          const calificacionesCriterio = calificacionesAlumnoEnBimestre[criterio.nombre] || {};
          const maxTareas = numTareasConfig[criterio.nombre] || 999;

          const notasValidas = Object.keys(calificacionesCriterio)
            .filter(index => {
              const idx = parseInt(index);
              return idx < maxTareas && 
                     calificacionesCriterio[index] && 
                     typeof calificacionesCriterio[index].nota === 'number';
            })
            .map(index => calificacionesCriterio[index].nota);

          if (notasValidas.length > 0) {
            const promedioCriterio = notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length;
            promedioPonderado += promedioCriterio * (criterio.porcentaje / 100);
            pesoTotalAplicable += (criterio.porcentaje / 100);
          }
        });

        if (pesoTotalAplicable === 0) {
          promedios[alumnoId] = null;
        } else {
          const promedioFinal = promedioPonderado / pesoTotalAplicable;
          promedios[alumnoId] = promedioFinal > 0 ? redondearCalificacion(promedioFinal) : null;
        }
      });

      // Crear el corte en el registro
      if (!registro.cortes) registro.cortes = {};
      registro.cortes[trimestreKey] = {
        fecha: new Date(),
        promedios
      };

      registro.markModified('cortes');
      await registro.save();

      return res.status(200).json({
        msg: `Corte de calificaciones para el Trimestre ${trimestre} realizado con éxito.`,
        data: registro
      });

    } else if (accion === 'eliminar') {
      if (registro.cortes && registro.cortes[trimestreKey]) {
        const nuevosCortes = { ...registro.cortes };
        delete nuevosCortes[trimestreKey];
        registro.cortes = nuevosCortes;
        registro.markModified('cortes');
        await registro.save();
      }

      return res.status(200).json({
        msg: `Corte de calificaciones para el Trimestre ${trimestre} eliminado con éxito.`,
        data: registro
      });
    } else {
      return res.status(400).json({ msg: 'Acción no válida. Usar "crear" o "eliminar".' });
    }

  } catch (error) {
    console.error("Error al gestionar corte de calificaciones:", error.message);
    res.status(500).send('Error del Servidor');
  }
});

export { router as calificacionesRouter };
