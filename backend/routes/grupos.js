import express from "express";
import mongoose from "mongoose";
import Grupo from "../models/Grupo.js";
import Calificacion from "../models/Calificacion.js";
import Asistencia from "../models/Asistencia.js";
import School from "../models/School.js";
import Counter from "../models/Counter.js";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";
import { schoolMiddleware } from "../middlewares/schoolMiddleware.js";

const router = express.Router();

// FunciÃ³n auxiliar para obtener la siguiente matrÃ­cula formateada (0001, 0002...)
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

        if (!nombre) {
            return res.status(400).json({ error: "El nombre del grupo es obligatorio." });
        }
        const grupoExistente = await Grupo.findOne({ nombre, school_id });
        if (grupoExistente) {
            return res.status(400).json({ error: "Ya existe un grupo con ese nombre en esta escuela." });
        }

        const alumnosProcesados = await Promise.all((alumnos || []).map(async alumno => {
            const data = { ...alumno };
            // Si es un alumno nuevo o no tiene matrÃ­cula, le asignamos una
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
            aula: req.body.aula || '',
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
router.put("/:id/asignar-profesores", authMiddleware, isAdmin, schoolMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { asignaciones } = req.body;
        const school_id = req.user.school_id;

        const grupo = await Grupo.findOne({ _id: id, school_id });
        if (!grupo) {
            return res.status(404).json({ error: "Grupo no encontrado o no pertenece a su institución." });
        }

        // Filtrar asignaciones nulas o incompletas y validar ObjectIds
        const asignacionesValidas = (asignaciones || []).filter((a, index) => {
            if (!a.profesor || !a.asignatura) {
                console.warn(`[WARN] Asignación ${index} incompleta en grupo ${id}`);
                return false;
            }
            
            // Extraer ID de forma robusta por si viene como objeto o string
            const profId = a.profesor?._id || a.profesor?.id || a.profesor;
            const isValidProf = profId && mongoose.Types.ObjectId.isValid(profId) && String(profId) !== 'null';
            
            if (!isValidProf) {
                console.warn(`[WARN] Profesor ID inválido (${profId}) en asignación ${index} del grupo ${id}`);
                return false;
            }

            // Normalizar el formato para guardar (asegurarse de que sea el ID)
            a.profesor = profId;
            return true;
        });

        grupo.profesoresAsignados = asignacionesValidas;
        await grupo.save();

        const grupoActualizado = await Grupo.findById(id).populate({
            path: 'profesoresAsignados.profesor',
            select: 'nombre email foto'
        });

        res.json(grupoActualizado);
    } catch (err) {
        console.error("Error en [PUT /grupos/:id/asignar-profesores]:", err);
        res.status(500).json({ error: "Error al asignar profesores.", details: err.message });
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
                // Asignar matrÃ­cula a alumnos nuevos que no la tengan
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
        grupo.aula = req.body.aula !== undefined ? req.body.aula : grupo.aula;

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
            return res.status(400).json({ error: "ID de grupo no vÃ¡lido." });
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

        if (!profesorId) {
            console.error("[ERROR] Intento de acceso a mis-grupos sin ID de usuario válido.");
            return res.status(401).json({ error: "No se pudo identificar al profesor. Por favor, reinicie sesión." });
        }

        // Buscamos coincidencia tanto por ObjectId como por String para maximizar compatibilidad.
        // Esto previene fallos si el ID en el array fue guardado accidentalmente como String.
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
        
        // Log informativo para depuración (ayuda a rastrear si un profesor no ve sus grupos)
        console.log(`[DEBUG] mis-grupos: Profesor ${profesorStringId} - Encontrados: ${gruposAsignados.length}`);
        
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

        // ValidaciÃ³n de ID para prevenir el error de Mongoose
        if (!mongoose.Types.ObjectId.isValid(grupoId)) {
            return res.status(400).json({ msg: "ID de grupo no vÃ¡lido." });
        }

        const grupo = await Grupo.findById(grupoId).select('alumnos profesoresAsignados ordenMaterias');
        if (!grupo) {
            return res.status(404).json({ msg: "Grupo no encontrado" });
        }

        // 1. Obtener TODOS los registros de calificaciÃ³n asociados a este grupo
        const registros = await Calificacion.find({ grupo: grupoId });

        const calificacionesAdmin = {};
        const { alumnos } = grupo;

        // Usamos las asignaturas del grupo para saber quÃ© materias esperar
        // Combinamos las asignadas con las que estÃ¡n en el orden guardado (para no perder ninguna)
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

        // 3. Iterar sobre cada registro de calificaciÃ³n (cada materia)
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

                    // Si no hay criterios definidos, se considera que no hay calificaciÃ³n
                    if (criteriosActivos.length === 0) return null;

                    // Recuperar configuraciÃ³n de tareas visibles (numTareas)
                    const numTareasConfig = registro.numTareas || {};

                    const calificacionesAlumnoEnBimestre = calificacionesMateria?.[alumnoId]?.[bimestreKey];
                    if (!calificacionesAlumnoEnBimestre) {
                        return null;
                    }

                    let promedioPonderado = 0;
                    let pesoTotalAplicable = 0; // ðŸŒŸ FIX: Track total weight of active criteria

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

                    // Solo devolvemos la calificaciÃ³n si el total de criterios definidos suma 100 (sanity check), 
                    // PERO el cÃ¡lculo se basa en el peso aplicable actual.
                    // const totalPorcentaje = criteriosActivos.reduce((sum, c) => sum + (c.porcentaje || 0), 0);
                    // if (totalPorcentaje !== 100) return null; // Relaxing this strict check might be good, but keeping for safety.

                    if (pesoTotalAplicable === 0) return null; // No active grades

                    // Rescale: (WeightedSum / TotalWeight)
                    const promedioFinal = promedioPonderado / pesoTotalAplicable;

                    // Solo se reporta la calificaciÃ³n si es mayor a 0 (para evitar 0s falsos)
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

// [GET] /grupos/global-search - Buscador inteligente de alumnos y grupos
router.get("/global-search", authMiddleware, schoolMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        const school_id = req.user.school_id;
        const isProfesor = req.user.role === "profesor";

        if (!q || q.length < 2) {
            return res.json([]);
        }

        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        
        const synonyms = {
            "primero": "1", "segundo": "2", "tercero": "3",
            "primer": "1", "segund": "2", "tercer": "3"
        };

        let processedQ = q.toLowerCase();
        Object.keys(synonyms).forEach(s => {
            processedQ = processedQ.replace(new RegExp(s, 'g'), synonyms[s]);
        });

        const terms = processedQ.trim().split(/\s+/).map(t => new RegExp(t, 'i'));
        const normalizedQ = normalize(processedQ);

        let query = { school_id };
        // Si es profesor, solo buscar en sus grupos asignados
        if (isProfesor) {
            query.$or = [
                { 'profesoresAsignados.profesor': req.user._id },
                { 'profesoresAsignados.profesor': req.user._id.toString() }
            ];
        }

        const grupos = await Grupo.find(query).select('nombre alumnos profesoresAsignados aula');
        
        const results = [];
        grupos.forEach(grupo => {
            const grupoNombreNorm = normalize(grupo.nombre);
            const aulaNorm = grupo.aula ? normalize(grupo.aula) : '';
            
            const grupoMatchScore = terms.filter(t => t.test(grupo.nombre)).length;
            const fullGrupoMatch = grupoNombreNorm.includes(normalizedQ) || normalizedQ.includes(grupoNombreNorm) || (aulaNorm && (aulaNorm.includes(normalizedQ) || normalizedQ.includes(aulaNorm)));
            const materiasMatch = grupo.profesoresAsignados?.some(pa => normalize(pa.asignatura).includes(normalizedQ));
            
            grupo.alumnos.forEach(alumno => {
                const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;
                const alumnoMatchCount = terms.filter(t => t.test(nombreCompleto)).length;
                const alumnoNorm = normalize(nombreCompleto);
                
                if (
                    (alumnoMatchCount + grupoMatchScore >= terms.length) || 
                    (fullGrupoMatch && (alumnoMatchCount > 0 || terms.length <= 1)) ||
                    (alumnoNorm.includes(normalizedQ)) ||
                    (materiasMatch)
                ) {
                    let asignatura = null;
                    if (req.user.role === 'profesor' && grupo.profesoresAsignados) {
                        const asig = grupo.profesoresAsignados.find(pa => {
                            const pId = pa.profesor?.id || pa.profesor?._id || pa.profesor;
                            return String(pId) === String(req.user.id);
                        });
                        asignatura = asig ? asig.asignatura : null;
                    }

                    results.push({
                        type: 'alumno',
                        id: alumno._id,
                        nombre: nombreCompleto,
                        matricula: alumno.matricula,
                        grupo: grupo.nombre,
                        aula: grupo.aula || '',
                        grupoId: grupo._id,
                        asignatura
                    });
                }
            });
        });

        res.json(results.slice(0, 10));
    } catch (err) {
        console.error("Error en global-search:", err);
        res.status(500).json({ error: "Error en la búsqueda." });
    }
});

// [GET] /grupos/alumno/:alumnoId/ficha - Obtener ficha completa del alumno (Asistencia + Calificaciones)
router.get("/alumno/:alumnoId/ficha", authMiddleware, schoolMiddleware, async (req, res) => {
    try {
        const { alumnoId } = req.params;
        const school_id = req.user.school_id;

        const grupo = await Grupo.findOne({ 
            "alumnos._id": alumnoId,
            school_id 
        }).populate('profesoresAsignados.profesor', 'nombre');

        if (!grupo) {
            return res.status(404).json({ error: "Alumno no encontrado o no pertenece a su instituciÃ³n." });
        }

        const alumno = grupo.alumnos.id(alumnoId);
        const school = await School.findById(school_id).select('name');

        // 2. Obtener Calificaciones
        const calificacionesRaw = await Calificacion.find({ grupo: grupo._id, school_id });
        
        const redondearCalificacion = (val) => {
            if (typeof val !== 'number' || val <= 0) return 0;
            const valUnaDecimal = Math.round(val * 10) / 10;
            if (valUnaDecimal >= 5 && valUnaDecimal < 6) return 5;
            return Math.max(5, Math.round(valUnaDecimal));
        };

        const calificaciones = calificacionesRaw.map(reg => {
            const bimestres = {};
            const { criterios: criteriosPorBimestre, calificaciones: calificacionesMateria, numTareas: numTareasConfig } = reg;

            [1, 2, 3].forEach(bimestre => {
                const bimestreKey = String(bimestre);
                const criteriosActivos = criteriosPorBimestre?.[bimestreKey] || [];
                const calificacionesAlumnoEnBimestre = calificacionesMateria?.[alumnoId]?.[bimestreKey];

                if (!calificacionesAlumnoEnBimestre || Object.keys(calificacionesAlumnoEnBimestre).length === 0) {
                    bimestres[bimestre] = null;
                    return;
                }

                let promedioPonderado = 0;
                let pesoTotalAplicable = 0;

                criteriosActivos.forEach(criterio => {
                    const calificacionesCriterio = calificacionesAlumnoEnBimestre[criterio.nombre] || {};
                    const maxTareas = numTareasConfig?.[criterio.nombre] || 999;
                    const notasValidas = Object.keys(calificacionesCriterio)
                        .filter(index => parseInt(index) < maxTareas && calificacionesCriterio[index] && typeof calificacionesCriterio[index].nota === 'number')
                        .map(index => calificacionesCriterio[index].nota);

                    if (notasValidas.length > 0) {
                        const promedioCriterio = notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length;
                        promedioPonderado += promedioCriterio * (criterio.porcentaje / 100);
                        pesoTotalAplicable += (criterio.porcentaje / 100);
                    }
                });

                bimestres[bimestre] = pesoTotalAplicable === 0 ? null : redondearCalificacion(promedioPonderado / pesoTotalAplicable);
            });

            return { asignatura: reg.asignatura, bimestres };
        });

        // 3. Obtener Asistencias
        const asistenciasRaw = await Asistencia.find({ grupo: grupo._id, school_id });
        const asistenciasDetalle = asistenciasRaw.map(asis => {
            let presentes = 0, faltas = 0, retardos = 0, justificados = 0, totales = 0;
            if (asis.registros) {
                asis.registros.forEach((valor, clave) => {
                    if (clave.startsWith(String(alumnoId))) {
                        totales++;
                        if (valor.estado === 'P') presentes++;
                        if (valor.estado === 'F') faltas++;
                        if (valor.estado === 'R') retardos++;
                        if (valor.estado === 'J') justificados++;
                    }
                });
            }
            return { asignatura: asis.asignatura, presentes, faltas, retardos, justificados, totales };
        });

        let userAsignatura = null;
        if (req.user.role === 'profesor' && grupo.profesoresAsignados) {
            const asig = grupo.profesoresAsignados.find(pa => {
                const pId = pa.profesor?.id || pa.profesor?._id || pa.profesor;
                return String(pId) === String(req.user.id);
            });
            userAsignatura = asig ? asig.asignatura : null;
        }

        res.json({
            alumno: {
                id: alumno._id,
                nombre: `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`,
                matricula: alumno.matricula,
                grupo: grupo.nombre,
                grupoId: grupo._id,
                escuela: school?.name,
                userAsignatura // Para navegaciÃ³n rÃ¡pida
            },
            calificaciones,
            asistencias: asistenciasDetalle
        });

    } catch (err) {
        console.error("Error al obtener ficha del alumno:", err);
        res.status(500).json({ error: "Error al obtener la informaciÃ³n del alumno." });
    }
});



// [GET] /grupos/:id/analytics - Estadísticas de rendimiento del grupo
router.get("/:id/analytics", authMiddleware, isAdmin, schoolMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const school_id = req.user.school_id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "ID de grupo no válido." });
        }

        const grupo = await Grupo.findOne({ _id: id, school_id }).select('alumnos');
        if (!grupo) {
            return res.status(404).json({ error: "Grupo no encontrado." });
        }

        // --- 1. AGREGAR ASISTENCIA ---
        const asistencias = await Asistencia.find({ grupo: id, school_id });
        let totalPresentes = 0;
        let totalFaltas = 0;

        asistencias.forEach(reg => {
            if (reg.registros) {
                const entries = (reg.registros instanceof Map) ? Array.from(reg.registros.values()) : Object.values(reg.registros);
                for (const item of entries) {
                    if (['P', 'R', 'J'].includes(item.estado)) totalPresentes++;
                    else if (item.estado === 'F') totalFaltas++;
                }
            }
        });

        const attendanceData = [
            { name: 'Asistencias', value: totalPresentes, color: '#00cbcb' },
            { name: 'Faltas', value: totalFaltas, color: '#ff6b6b' }
        ];

        // --- 2. AGREGAR CALIFICACIONES (DESEMPEÑO) ---
        const calificacionesRaw = await Calificacion.find({ grupo: id, school_id });
        const promediosAlumnos = {}; 

        calificacionesRaw.forEach(reg => {
            const { calificaciones: califMateria, criterios: criteriosMateria, numTareas: configTareas } = reg;
            
            grupo.alumnos.forEach(alumno => {
                const aId = alumno._id.toString();
                let sumaPuntosMateria = 0;
                let pesoSumaMateria = 0;

                [1, 2, 3].forEach(bim => {
                    const bimKey = String(bim);
                    const criteriosActivos = criteriosMateria?.[bimKey] || [];
                    const califAlumnoBim = califMateria?.[aId]?.[bimKey];

                    if (califAlumnoBim) {
                        criteriosActivos.forEach(crit => {
                            const notasCrit = califAlumnoBim[crit.nombre] || {};
                            const maxT = configTareas?.[crit.nombre] || 999;
                            const validas = Object.keys(notasCrit)
                                .filter(idx => parseInt(idx) < maxT && notasCrit[idx] && typeof notasCrit[idx].nota === 'number')
                                .map(idx => notasCrit[idx].nota);

                            if (validas.length > 0) {
                                const promCrit = validas.reduce((a, b) => a + b, 0) / validas.length;
                                sumaPuntosMateria += promCrit * (crit.porcentaje / 100);
                                pesoSumaMateria += (crit.porcentaje / 100);
                            }
                        });
                    }
                });

                if (pesoSumaMateria > 0) {
                    const promMateria = sumaPuntosMateria / pesoSumaMateria;
                    if (!promediosAlumnos[aId]) promediosAlumnos[aId] = { sum: 0, count: 0 };
                    promediosAlumnos[aId].sum += promMateria;
                    promediosAlumnos[aId].count += 1;
                }
            });
        });

        const stats = { excelente: 0, bien: 0, suficiente: 0, insuficiente: 0 };
        Object.values(promediosAlumnos).forEach(p => {
            const finalProm = p.sum / p.count;
            if (finalProm >= 9) stats.excelente++;
            else if (finalProm >= 8) stats.bien++;
            else if (finalProm >= 6) stats.suficiente++;
            else stats.insuficiente++;
        });

        const performanceData = [
            { name: 'Excelente (9-10)', value: stats.excelente, color: '#00cbcb' },
            { name: 'Bien (8-8.9)', value: stats.bien, color: '#4cc9f0' },
            { name: 'Suficiente (6-7.9)', value: stats.suficiente, color: '#f9c74f' },
            { name: 'Insuficiente (<6)', value: stats.insuficiente, color: '#ff6b6b' }
        ];

        res.json({
            attendanceData,
            performanceData,
            summary: {
                totalAttendance: totalPresentes + totalFaltas,
                attendanceRate: (totalPresentes + totalFaltas) > 0 ? (totalPresentes / (totalPresentes + totalFaltas) * 100).toFixed(1) : 0,
                totalStudentsEvaluated: Object.keys(promediosAlumnos).length
            }
        });

    } catch (err) {
        console.error("Error en analytics:", err);
        res.status(500).json({ error: "Error al calcular analíticas." });
    }
});

export { router as gruposRouter };
