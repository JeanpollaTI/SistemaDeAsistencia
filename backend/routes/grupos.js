import express from "express";
import Grupo from "../models/Grupo.js";
import Calificacion from "../models/Calificacion.js";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";
import mongoose from "mongoose"; // Necesario para validar IDs

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

        const nuevoGrupo = new Grupo({ nombre, alumnos: alumnosProcesados });
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

        // Filtramos para asegurar que solo se envíen asignaciones con profesorId válido si el modelo lo requiere
        // (Aunque tu modelo AsignacionSchema ya tiene 'required: true' para profesor, validamos en el router)
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

        const alumnosProcesados = alumnos.map(alumno => {
            if (alumno._id && String(alumno._id).startsWith('new-')) {
                const { _id, ...restoDelAlumno } = alumno;
                return restoDelAlumno;
            }
            return alumno;
        });

        grupo.nombre = nombre || grupo.nombre;
        grupo.alumnos = alumnosProcesados || grupo.alumnos;
        
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
        // Validación de ID para prevenir errores de tipo Mongoose
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
        const profesorId = req.user.id; // Obtenemos el ID del token
        
        // CORRECCIÓN CLAVE: Validación del ID antes de la consulta
        if (!profesorId || !mongoose.Types.ObjectId.isValid(profesorId)) {
             return res.status(401).json({ error: "ID de profesor no válido o faltante en el token." });
        }
        
        const query = Grupo.find({ 'profesoresAsignados.profesor': profesorId })
            .populate({
                path: 'profesoresAsignados.profesor',
                select: 'nombre email foto'
            });

        if (req.query.populate === 'alumnos') {
            // Asumiendo que alumnos son subdocumentos, este populate no es necesario,
            // pero si son referencias, se mantiene.
            // Para alumnos como subdocumentos, se mantendría la estructura.
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

        const grupo = await Grupo.findById(grupoId).select('alumnos');
        if (!grupo) {
            return res.status(404).json({ msg: "Grupo no encontrado" });
        }

        // 1. Obtener TODOS los registros de calificación asociados a este grupo
        const registros = await Calificacion.find({ grupo: grupoId });

        const calificacionesAdmin = {};
        const { alumnos } = grupo;

        // 2. Inicializar la estructura para cada alumno
        alumnos.forEach(alumno => {
            // Prevenimos error si alumno._id no existe (aunque no debería)
            const alumnoId = alumno._id ? alumno._id.toString() : null; 
            if(alumnoId) {
                calificacionesAdmin[alumnoId] = {};
            }
        });

        // 3. Iterar sobre cada registro de calificación (cada materia)
        registros.forEach(registro => {
            const { asignatura, criterios, calificaciones: calificacionesMateria } = registro;

            if (!criterios || criterios.length === 0) return; // Si una materia no tiene criterios, se omite

            // 4. Calcular el promedio ponderado para cada alumno en esta materia
            alumnos.forEach(alumno => {
                const alumnoId = alumno._id.toString();
                if (!calificacionesAdmin[alumnoId]) return; // Saltamos si el ID es inválido o no inicializado
                
                const promediosBimestrales = [1, 2, 3].map(bimestre => {
                    const calificacionesAlumnoEnBimestre = calificacionesMateria?.[alumnoId]?.[bimestre];
                    if (!calificacionesAlumnoEnBimestre) {
                        return null; // No hay calificaciones para este alumno en este bimestre
                    }
                    
                    let promedioPonderado = 0;
                    criterios.forEach(criterio => {
                        const notasCriterio = calificacionesAlumnoEnBimestre[criterio.nombre] || {};
                        
                        const notasValidas = Object.values(notasCriterio)
                            .filter(e => e && typeof e.nota === 'number')
                            .map(e => e.nota);
                        
                        let promedioCriterio = 0;
                        if (notasValidas.length > 0) {
                            promedioCriterio = notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length;
                        }
                        
                        promedioPonderado += promedioCriterio * (criterio.porcentaje / 100);
                    });
                    
                    // Retorna el promedio con un decimal o null si es 0 o no válido
                    return promedioPonderado > 0 ? parseFloat(promedioPonderado.toFixed(1)) : null;
                });

                // 5. Asignar el array de promedios [bim1, bim2, bim3] a la materia correspondiente
                calificacionesAdmin[alumnoId][asignatura] = promediosBimestrales;
            });
        });

        res.json(calificacionesAdmin);

    } catch (err) {
        // En caso de un error de Mongoose, lo capturamos
        console.error("Error procesando calificaciones para admin:", err.message);
        res.status(500).json({ error: "Error del Servidor: Falla al procesar las calificaciones." });
    }
});


export { router as gruposRouter };