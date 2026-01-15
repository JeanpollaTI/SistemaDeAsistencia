import express from "express";
import mongoose from "mongoose";
import Grupo from "../models/Grupo.js";
import Calificacion from "../models/Calificacion.js";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// [POST] /grupos - Crear un nuevo grupo (Admin)
router.post("/", authMiddleware, isAdmin, async (req, res) => {
    try {
        const { nombre, alumnos } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: "El nombre del grupo es obligatorio." });
        }
        const grupoExistente = await Grupo.findOne({ nombre });
        if (grupoExistente) {
            return res.status(400).json({ error: "Ya existe un grupo con ese nombre." });
        }

        const alumnosProcesados = (alumnos || []).map(alumno => {
            if (alumno._id && String(alumno._id).startsWith('new-')) {
                const { _id, ...restoDelAlumno } = alumno;
                return restoDelAlumno;
            }
            return alumno;
        });

        const nuevoGrupo = new Grupo({
            nombre,
            asesor: req.body.asesor || '',
            alumnos: alumnosProcesados
        });

        await nuevoGrupo.save();

        res.status(201).json(nuevoGrupo);
    } catch (err) {
        console.error("Error en [POST /grupos]:", err);
        res.status(500).json({ error: "Error en el servidor al crear el grupo." });
    }
});

// [GET] /grupos - Obtener todos los grupos (Admin)
router.get("/", authMiddleware, isAdmin, async (req, res) => {
    try {
        const grupos = await Grupo.find().populate({
            path: 'profesoresAsignados.profesor',
            select: 'nombre email foto'
        });
        res.json(grupos);
    } catch (err) {
        console.error("Error en [GET /grupos]:", err);
        res.status(500).json({ error: "Error al obtener los grupos." });
    }
});

// [PUT] /grupos/:id/asignar-profesores - Asignar profesores y asignaturas (Admin)
router.put("/:id/asignar-profesores", authMiddleware, isAdmin, async (req, res) => {
    try {
        const { asignaciones } = req.body;
        const grupo = await Grupo.findById(req.params.id);

        if (!grupo) {
            return res.status(404).json({ error: "Grupo no encontrado." });
        }

        // Filtramos para asegurar que solo se envíen asignaciones con profesorId válido
        const asignacionesValidas = (asignaciones || []).filter(asig => asig.profesor && mongoose.Types.ObjectId.isValid(asig.profesor));

        grupo.profesoresAsignados = asignacionesValidas;
        await grupo.save();

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
            const alumnosProcesados = alumnos.map(alumno => {
                if (alumno._id && String(alumno._id).startsWith('new-')) {
                    const { _id, ...restoDelAlumno } = alumno;
                    return restoDelAlumno;
                }
                return alumno;
            });
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
router.delete("/:id", authMiddleware, isAdmin, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "ID de grupo no válido." });
        }

        const grupo = await Grupo.findByIdAndDelete(req.params.id);
        if (!grupo) {
            return res.status(404).json({ error: "Grupo no encontrado." });
        }
        // Opcional: Eliminar calificaciones asociadas
        await Calificacion.deleteMany({ grupo: req.params.id });
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

                    const calificacionesAlumnoEnBimestre = calificacionesMateria?.[alumnoId]?.[bimestreKey];
                    if (!calificacionesAlumnoEnBimestre) {
                        return null;
                    }

                    let promedioPonderado = 0;

                    criteriosActivos.forEach(criterio => {
                        const calificacionesCriterio = calificacionesAlumnoEnBimestre[criterio.nombre] || {};

                        const notasValidas = Object.values(calificacionesCriterio)
                            .filter(e => e && typeof e.nota === 'number')
                            .map(e => e.nota);

                        let promedioCriterio = 0;
                        if (notasValidas.length > 0) {
                            promedioCriterio = notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length;
                        }

                        promedioPonderado += promedioCriterio * (criterio.porcentaje / 100);
                    });

                    // Solo devolvemos la calificación si el total de criterios suma 100
                    const totalPorcentaje = criteriosActivos.reduce((sum, c) => sum + (c.porcentaje || 0), 0);

                    if (totalPorcentaje !== 100) return null;

                    // Solo se reporta la calificación si es mayor a 0 (para evitar 0s falsos)
                    return promedioPonderado > 0 ? parseFloat(promedioPonderado.toFixed(1)) : null;
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