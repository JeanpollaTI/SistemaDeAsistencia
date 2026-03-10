import express from "express";
import Grupo from "../models/Grupo.js";
import Calificacion from "../models/Calificacion.js";
import Asistencia from "../models/Asistencia.js";
import School from "../models/School.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const router = express.Router();

// [POST] /portal-padres/login
router.post("/login", async (req, res) => {
    try {
        const { email, identifier, matricula } = req.body;
        const loginId = (identifier || email || "").toLowerCase().trim();

        if (!loginId || !matricula) {
            return res.status(400).json({ msg: "Correo/Teléfono y Matrícula son obligatorios." });
        }

        // Buscar el grupo que contenga al alumno con ese email/teléfono y matrícula
        const grupo = await Grupo.findOne({
            $or: [
                { "alumnos.emailPadre": loginId },
                { "alumnos.telefonoPadre": loginId }
            ],
            "alumnos.matricula": matricula
        });

        if (!grupo) {
            return res.status(404).json({ msg: "No se encontró ningún alumno con esos datos." });
        }

        const alumno = grupo.alumnos.find(a =>
            (a.emailPadre === loginId || a.telefonoPadre === loginId) && a.matricula === matricula
        );

        // Obtener nombre de la escuela
        const school = await School.findById(grupo.school_id).select('name');

        // Generar un token especial para el padre
        const token = jwt.sign(
            {
                id: alumno._id,
                role: 'padre',
                school_id: grupo.school_id,
                grupo_id: grupo._id,
                matricula: alumno.matricula
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            alumno: {
                id: alumno._id,
                nombre: alumno.nombre,
                apellidoPaterno: alumno.apellidoPaterno,
                apellidoMaterno: alumno.apellidoMaterno,
                matricula: alumno.matricula,
                grupo: grupo.nombre,
                escuela: school?.name || "Institución no encontrada"
            }
        });
    } catch (err) {
        console.error("Error en login de padres:", err);
        res.status(500).json({ msg: "Error en el servidor al iniciar sesión." });
    }
});

// Middleware para verificar token de padre
const verifyParentToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "No autorizado" });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        if (req.user.role !== 'padre') return res.status(403).json({ msg: "Acceso denegado" });
        next();
    } catch (err) {
        res.status(401).json({ msg: "Token inválido o expirado" });
    }
};

// [GET] /portal-padres/mis-datos
router.get("/mis-datos", verifyParentToken, async (req, res) => {
    try {
        const { id, grupo_id, school_id } = req.user;

        const gId = new mongoose.Types.ObjectId(grupo_id);
        const sId = new mongoose.Types.ObjectId(school_id);

        // Fetch School name
        const school = await School.findById(sId).select('name');

        // 1. Obtener calificaciones
        const calificacionesRaw = await Calificacion.find({
            grupo: gId,
            school_id: sId
        });

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
                const calificacionesAlumnoEnBimestre = calificacionesMateria?.[id]?.[bimestreKey];

                if (!calificacionesAlumnoEnBimestre || Object.keys(calificacionesAlumnoEnBimestre).length === 0) {
                    bimestres[bimestre] = null;
                    return;
                }

                if (!criteriosActivos || criteriosActivos.length === 0) {
                    let sumaTotal = 0;
                    let numNotas = 0;
                    Object.values(calificacionesAlumnoEnBimestre).forEach(criterioGrades => {
                        Object.values(criterioGrades).forEach(entrada => {
                            if (entrada && typeof entrada.nota === 'number') {
                                sumaTotal += entrada.nota;
                                numNotas++;
                            }
                        });
                    });
                    bimestres[bimestre] = numNotas === 0 ? null : redondearCalificacion(sumaTotal / numNotas);
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

        // 2. Obtener asistencias detalladas
        const asistenciasRaw = await Asistencia.find({
            grupo: gId,
            school_id: sId
        });

        const asistenciasDetalle = asistenciasRaw.map(asis => {
            let presentes = 0;
            let faltas = 0;
            let retardos = 0;
            let justificados = 0;
            let totales = 0;

            // Iterar sobre los registros mapeados del alumno
            // El formato de clave es: alumnoId-b{bimestre}-d{dia}
            if (asis.registros) {
                asis.registros.forEach((valor, clave) => {
                    if (clave.startsWith(String(id))) {
                        totales++;
                        if (valor.estado === 'P') presentes++;
                        if (valor.estado === 'F') faltas++;
                        if (valor.estado === 'R') retardos++;
                        if (valor.estado === 'J') justificados++;
                    }
                });
            }

            return {
                asignatura: asis.asignatura,
                presentes,
                faltas,
                retardos,
                justificados,
                totales
            };
        });

        res.json({
            escuela: school?.name || "Institución",
            calificaciones,
            asistencias: asistenciasDetalle
        });

    } catch (err) {
        console.error("Error al obtener datos del portal de padres:", err);
        res.status(500).json({ msg: "Error al obtener la información." });
    }
});

export default router;
