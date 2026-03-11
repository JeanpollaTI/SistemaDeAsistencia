import express from "express";
import mongoose from "mongoose";
import Grupo from "../models/Grupo.js";
import Calificacion from "../models/Calificacion.js";
import Counter from "../models/Counter.js";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";
import { schoolMiddleware } from "../middlewares/schoolMiddleware.js";

const router = express.Router();

// Función auxiliar para obtener la siguiente matrícula formateada (0001, 0002...)
const getNextMatricula = async () => {
    const counter = await Counter.findOneAndUpdate(
        { id: 'alumnos' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq.toString().padStart(4, '0');
};

// [POST] /grupos - Crear un nuevo grupo (Admin)
router.post("/", authMiddleware, isAdmin, schoolMiddleware, async (req, res) => {
    try {
        const { nombre, alumnos } = req.body;
        const school_id = req.user.school_id;

        // EMERGENCY FIX: Borrar el índice global antiguo si existe
        try {
            await Grupo.collection.dropIndex("nombre_1");
            console.log("✅ Índice 'nombre_1' (global) eliminado de la colección grupos.");
        } catch (e) { /* Ya no existe */ }

        if (!nombre) {
            return res.status(400).json({ error: "El nombre del grupo es obligatorio." });
        }
        const grupoExistente = await Grupo.findOne({ nombre, school_id });
        if (grupoExistente) {
            return res.status(400).json({ error: "Ya existe un grupo con ese nombre en esta escuela." });
        }

        const alumnosProcesados = await Promise.all((alumnos || []).map(async alumno => {
            const data = { ...alumno };
            // Si es un alumno nuevo o no tiene matrícula, le asignamos una
            if (!data.matricula) {
                data.matricula = await getNextMatricula();
            }
            if (data._id && String(data._id).startsWith('new-')) {
                delete data._id;
            }
            return data;
        }));

        const nuevoGrupo = new Grupo({
            nombre,
            asesor: req.body.asesor || '',
            alumnos: alumnosProcesados,
            school_id
        });

        await nuevoGrupo.save();

        const grupoParaEnviar = await Grupo.findById(nuevoGrupo._id).populate({
            path: 'profesoresAsignados.profesor',
            select: 'nombre email foto'
        });

        res.status(201).json(grupoParaEnviar);
    } catch (err) {
        console.error("Error en [POST /grupos]:", err);
        res.status(500).json({ error: "Error en el servidor al crear el grupo.", details: err.message });
    }
});

// [GET] /grupos - Obtener todos los grupos (Admin)
router.get("/", authMiddleware, isAdmin, schoolMiddleware, async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const grupos = await Grupo.find({ school_id }).populate({
            path: 'profesoresAsignados.profesor',
            select: 'nombre email foto'
        });
        res.json(grupos);
    } catch (err) {
        console.error("Error en [GET /grupos]:", err);
        res.status(500).json({ error: "Error al obtener los grupos.", details: err.message });
    }
});

// [PUT] /grupos/:id/asignar-profesores - Asignar profesores y asignaturas (Admin)
router.put("/:id/asignar-profesores", authMiddleware, isAdmin, async (req, res) => {
    try {
        const { asignaciones } = req.body;

        console.log("------------------------------------------");
        console.log(`[PUT /asignar-profesores] Recibido para Grupo ${req.params.id}`);
        console.log("Payload:", JSON.stringify(asignaciones, null, 2));

        const grupo = await Grupo.findById(req.params.id);
        if (!grupo) {
            return res.status(404).json({ error: "Grupo no encontrado" });
        }

        // Filtramos para asegurar que solo se envíen asignaciones con profesorId válido
        const asignacionesValidas = (asignaciones || []).filter(asig => {
            const isValid = asig.profesor && mongoose.Types.ObjectId.isValid(asig.profesor);
            if (!isValid) console.warn("Asignación rechazada (ID inválido):", asig);
            return isValid;
        });

        console.log("Asignaciones Válidas a guardar:", JSON.stringify(asignacionesValidas, null, 2));

        grupo.profesoresAsignados = asignacionesValidas;
        const savedGrupo = await grupo.save();
        console.log("Grupo guardado. profesoresAsignados:", JSON.stringify(savedGrupo.profesoresAsignados, null, 2));
        console.log("------------------------------------------");

        const grupoActualizado = await Grupo.findById(req.params.id).populate({
            path: 'profesoresAsignados.profesor',
            select: 'nombre email foto'
        });

        res.json(grupoActualizado);
    } catch (err) {
        console.error("Error en [PUT /grupos/:id/asignar-profesores]:", err);
        res.status(500).json({ error: "Error al asignar profesores." });
    }
});

// [PUT] /grupos/:id - Actualizar nombre y/o lista de alumnos de un grupo (Admin)
router.put("/:id", authMiddleware, isAdmin, async (req, res) => {
    try {
        const { nombre, alumnos } = req.body;
        const grupo = await Grupo.findById(req.params.id);

        if (!grupo) {
            return res.status(404).json({ error: "Grupo no encontrado." });
        }

        if (alumnos) {
            const alumnosProcesados = await Promise.all(alumnos.map(async alumno => {
                const data = { ...alumno };
                // Asignar matrícula a alumnos nuevos que no la tengan
                if (!data.matricula) {
                    data.matricula = await getNextMatricula();
                }
                if (data._id && String(data._id).startsWith('new-')) {
                    delete data._id;
                }
                return data;
            }));
            grupo.alumnos = alumnosProcesados;
        }

        grupo.nombre = nombre || grupo.nombre;
        grupo.asesor = req.body.asesor !== undefined ? req.body.asesor : grupo.asesor;

        if (req.body.ordenMaterias) {
            grupo.ordenMaterias = req.body.ordenMaterias;
        }

        await grupo.save();

        const grupoActualizado = await Grupo.findById(req.params.id).populate({
            path: 'profesoresAsignados.profesor',
            select: 'nombre email foto'
        });

        res.json(grupoActualizado);
    } catch (err) {
        console.error("Error en [PUT /grupos/:id]:", err);
        res.status(500).json({ error: "Error al actualizar el grupo." });
    }
});

// [DELETE] /grupos/:id - Eliminar un grupo (Admin)
router.delete("/:id", authMiddleware, isAdmin, schoolMiddleware, async (req, res) => {
    try {
        const school_id = req.user.school_id;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "ID de grupo no válido." });
        }

        const grupo = await Grupo.findOneAndDelete({ _id: req.params.id, school_id });
        if (!grupo) {
            return res.status(404).json({ error: "Grupo no encontrado o no pertenece a su escuela." });
        }
        // Opcional: Eliminar calificaciones asociadas
        await Calificacion.deleteMany({ grupo: req.params.id, school_id });
        res.json({ msg: "Grupo y calificaciones asociadas eliminados correctamente." });
    } catch (err) {
        console.error("Error en [DELETE /grupos/:id]:", err);
        res.status(500).json({ error: "Error al eliminar el grupo." });
    }
});

// --- RUTA PARA PROFESORES ---

// [GET] /grupos/mis-grupos - Obtener los grupos asignados al profesor logueado
router.get("/mis-grupos", authMiddleware, async (req, res) => {
    try {
        const profesorId = req.user._id;
        const profesorStringId = String(req.user._id);
        console.log("Buscando grupos para profesor:", { objectId: profesorId, stringId: profesorStringId });

        if (!profesorId) {
            return res.status(401).json({ error: "ID de profesor no válido o faltante en el token." });
        }

        // Buscamos coincidencia tanto por ObjectId como por String para maximizar compatibilidad
        const query = Grupo.find({
            'profesoresAsignados.profesor': { $in: [profesorId, profesorStringId] }
        })
            .populate({
                path: 'profesoresAsignados.profesor',
                select: 'nombre email foto'
            });

        if (req.query.populate === 'alumnos') {
            query.populate('alumnos');
        }

        const gruposAsignados = await query.exec();
        res.json(gruposAsignados);
    } catch (err) {
        console.error("Error en [GET /grupos/mis-grupos]:", err);
        res.status(500).json({ error: "Error al obtener tus grupos asignados." });
    }
});

// --- RUTA RECONSTRUIDA PARA LA VISTA DEL ADMINISTRADOR ---
// [GET] /grupos/:grupoId/calificaciones-admin - Procesa y devuelve calificaciones consolidadas
router.get("/:grupoId/calificaciones-admin", authMiddleware, isAdmin, async (req, res) => {
    try {
        const grupoId = req.params.grupoId;

        // Validación de ID para prevenir el error de Mongoose
        if (!mongoose.Types.ObjectId.isValid(grupoId)) {
            return res.status(400).json({ msg: "ID de grupo no válido." });
        }

        const grupo = await Grupo.findById(grupoId).select('alumnos profesoresAsignados ordenMaterias');
        if (!grupo) {
            return res.status(404).json({ msg: "Grupo no encontrado" });
        }

        // 1. Obtener TODOS los registros de calificación asociados a este grupo
        const registros = await Calificacion.find({ grupo: grupoId });

        const calificacionesAdmin = {};
        const { alumnos } = grupo;

        // Usamos las asignaturas del grupo para saber qué materias esperar
        // Combinamos las asignadas con las que están en el orden guardado (para no perder ninguna)
        const materiasSet = new Set(grupo.profesoresAsignados.map(asig => asig.asignatura));
        if (grupo.ordenMaterias && Array.isArray(grupo.ordenMaterias)) {
            grupo.ordenMaterias.forEach(m => materiasSet.add(m));
        }
        const materiasAsignadas = [...materiasSet];

        // 2. Inicializar la estructura para cada alumno
        alumnos.forEach(alumno => {
            const alumnoId = alumno._id ? alumno._id.toString() : null;
            if (alumnoId) {
                calificacionesAdmin[alumnoId] = {};
                // Inicializar con arrays de 3 nulos para T1, T2, T3
                materiasAsignadas.forEach(materia => {
                    calificacionesAdmin[alumnoId][materia] = [null, null, null];
                });
            }
        });

        // 3. Iterar sobre cada registro de calificación (cada materia)
        registros.forEach(registro => {
            const { asignatura, criterios: criteriosPorBimestre, calificaciones: calificacionesMateria } = registro;

            // 4. Calcular el promedio ponderado para cada alumno en esta materia, por bimestre
            alumnos.forEach(alumno => {
                const alumnoId = alumno._id.toString();
                if (!calificacionesAdmin[alumnoId]) return;

                const promediosBimestrales = [1, 2, 3].map(bimestre => {
                    const bimestreKey = String(bimestre);

                    // OBTENER EL ARRAY DE CRITERIOS CORRECTO PARA ESTE BIMESTRE
                    const criteriosActivos = criteriosPorBimestre?.[bimestreKey] || [];

                    // Si no hay criterios definidos, se considera que no hay calificación
                    if (criteriosActivos.length === 0) return null;

                    // Recuperar configuración de tareas visibles (numTareas)
                    const numTareasConfig = registro.numTareas || {};

                    const calificacionesAlumnoEnBimestre = calificacionesMateria?.[alumnoId]?.[bimestreKey];
                    if (!calificacionesAlumnoEnBimestre) {
                        return null;
                    }

                    let promedioPonderado = 0;
                    let pesoTotalAplicable = 0; // 🌟 FIX: Track total weight of active criteria

                    criteriosActivos.forEach(criterio => {
                        const calificacionesCriterio = calificacionesAlumnoEnBimestre[criterio.nombre] || {};
                        const maxTareas = numTareasConfig[criterio.nombre] || 999; // Si no hay config, asumimos todo visible (safe fallback)

                        const notasValidas = Object.keys(calificacionesCriterio)
                            .filter(index => parseInt(index) < maxTareas && calificacionesCriterio[index] && typeof calificacionesCriterio[index].nota === 'number')
                            .map(index => calificacionesCriterio[index].nota);

                        if (notasValidas.length > 0) {
                            const promedioCriterio = notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length;
                            promedioPonderado += promedioCriterio * (criterio.porcentaje / 100);
                            pesoTotalAplicable += (criterio.porcentaje / 100); // Add weight only if criterion is active
                        }
                    });

                    // Solo devolvemos la calificación si el total de criterios definidos suma 100 (sanity check), 
                    // PERO el cálculo se basa en el peso aplicable actual.
                    // const totalPorcentaje = criteriosActivos.reduce((sum, c) => sum + (c.porcentaje || 0), 0);
                    // if (totalPorcentaje !== 100) return null; // Relaxing this strict check might be good, but keeping for safety.

                    if (pesoTotalAplicable === 0) return null; // No active grades

                    // Rescale: (WeightedSum / TotalWeight)
                    const promedioFinal = promedioPonderado / pesoTotalAplicable;

                    // Solo se reporta la calificación si es mayor a 0 (para evitar 0s falsos)
                    return promedioFinal > 0 ? parseFloat(promedioFinal.toFixed(1)) : null;
                });

                // 5. Asignar el array de promedios [bim1, bim2, bim3] a la materia correspondiente
                calificacionesAdmin[alumnoId][asignatura] = promediosBimestrales;
            });
        });

        res.json(calificacionesAdmin);

    } catch (err) {
        console.error("Error procesando calificaciones para admin:", err.message);
        res.status(500).json({ error: "Error del Servidor: Falla al procesar las calificaciones." });
    }
});


export { router as gruposRouter };