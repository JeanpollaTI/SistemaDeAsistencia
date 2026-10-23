import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import ReflexionSerena, {
  GRUPOS_REFLEXION_SERENA,
  MESES_CICLO_ESCOLAR,
} from "../models/ReflexionSerena.js";
import CustomTableTemplate from "../models/CustomTableTemplate.js";
import User from "../models/User.js";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Helper: obtiene el mes predeterminado según el número de semana (1 a 40, iniciando en Septiembre)
export const getMesPorSemana = (semanaNum) => {
  const s = Math.max(1, Math.min(40, Number(semanaNum) || 1));
  const mesIndex = Math.min(9, Math.floor((s - 1) / 4));
  return MESES_CICLO_ESCOLAR[mesIndex] || "Septiembre";
};

// Normaliza nombres de grupos (ej: "1A" -> "1° A", "1°A" -> "1° A")
export const normalizeGrupoReflexion = (raw = "") => {
  const clean = String(raw)
    .toUpperCase()
    .replace(/[°º\s-]/g, "")
    .trim();
  const match = clean.match(/^([123])([ABCDE])$/);
  if (match) {
    return `${match[1]}° ${match[2]}`;
  }
  return GRUPOS_REFLEXION_SERENA.includes(raw) ? raw : null;
};

// Sincroniza y obtiene la plantilla de Extensión "Reflexión Serena" para mantener compatibilidad en el panel de Extensiones
const syncReflexionTemplate = async (schoolId) => {
  let template = await CustomTableTemplate.findOne({
    school_id: schoolId,
    title: { $regex: /reflexi[oó]n\s*serena/i },
  });

  if (template) {
    let changed = false;
    if (template.rowType !== "GROUPS") {
      template.rowType = "GROUPS";
      changed = true;
    }
    // Si la plantilla tenía docentes en groupAssignments pero no en authorizedTeachers, migrarlos a authorizedTeachers y User.esCapturistaReflexion
    const teacherIdsSet = new Set(
      (template.authorizedTeachers || []).map((t) =>
        String(typeof t === "object" ? t._id : t)
      )
    );
    if (Array.isArray(template.groupAssignments)) {
      template.groupAssignments.forEach((ga) => {
        (ga.teachers || []).forEach((t) => {
          const idStr = String(typeof t === "object" ? t._id : t);
          if (idStr && mongoose.Types.ObjectId.isValid(idStr)) {
            teacherIdsSet.add(idStr);
          }
        });
      });
    }

    const teacherIdsArr = Array.from(teacherIdsSet);
    if (teacherIdsArr.length > 0) {
      await User.updateMany(
        { _id: { $in: teacherIdsArr }, school_id: schoolId },
        { $set: { esCapturistaReflexion: true } }
      );
      if (teacherIdsArr.length !== (template.authorizedTeachers || []).length) {
        template.authorizedTeachers = teacherIdsArr;
        changed = true;
      }
    }

    if (changed) {
      await template.save();
    }
  }

  return template;
};

// Verifica si el usuario actual tiene permiso de captura/edición en Reflexión Serena
const checkCanEditReflexion = async (user, template) => {
  if (!user) return false;
  if (user.role === "admin" || user.role === "superadmin") return true;

  const dbUser = await User.findById(user._id).select("esCapturistaReflexion role").lean();
  if (dbUser?.esCapturistaReflexion) return true;

  if (template && Array.isArray(template.authorizedTeachers)) {
    const uid = String(user._id);
    if (
      template.authorizedTeachers.some(
        (t) => String(typeof t === "object" ? t._id : t) === uid
      )
    ) {
      return true;
    }
  }

  return false;
};

// ============================================================================
// [GET] /api/reflexion-serena
// Obtiene registros por ciclo escolar (y opcionalmente semana), lista de los 15 grupos,
// capturistas asignadas y permisos del usuario actual
// ============================================================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) {
      return res.status(400).json({ msg: "Usuario no tiene escuela asignada" });
    }

    const cicloEscolar = req.query.cicloEscolar || "2025-2026";
    const semanaQuery = req.query.semana ? Number(req.query.semana) : null;

    const template = await syncReflexionTemplate(schoolId);
    const canEdit = await checkCanEditReflexion(req.user, template);

    const filter = { school_id: schoolId, cicloEscolar };
    if (semanaQuery && semanaQuery >= 1 && semanaQuery <= 40) {
      filter.semana = semanaQuery;
    }

    const registros = await ReflexionSerena.find(filter)
      .populate("registradoPor", "nombre apellidoPaterno apellidoMaterno email")
      .sort({ semana: 1, grupo: 1 })
      .lean();

    const profesores = await User.find({
      school_id: schoolId,
      role: { $in: ["profesor", "admin"] },
    })
      .select("_id nombre apellidoPaterno apellidoMaterno email role esCapturistaReflexion asignaturas")
      .sort({ nombre: 1 })
      .lean();

    const capturistas = profesores.filter((p) => p.esCapturistaReflexion);

    res.json({
      grupos: GRUPOS_REFLEXION_SERENA,
      meses: MESES_CICLO_ESCOLAR,
      cicloEscolar,
      registros,
      profesores,
      capturistas,
      canEdit,
      templateId: template?._id || null,
      attachedFiles: template?.attachedFiles || [],
    });
  } catch (err) {
    console.error("Error en GET /api/reflexion-serena:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// [POST] /api/reflexion-serena/bulk-semana
// Captura rápida y masiva (Bulk Update) de los 15 grupos para una semana (1-40)
// ============================================================================
router.post("/bulk-semana", authMiddleware, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) {
      return res.status(400).json({ msg: "Usuario no tiene escuela asignada" });
    }

    const template = await syncReflexionTemplate(schoolId);
    const canEdit = await checkCanEditReflexion(req.user, template);
    if (!canEdit) {
      return res.status(403).json({
        msg: "No tienes permisos de Capturista de Reflexión Serena para registrar o modificar datos.",
      });
    }

    const {
      semana,
      mes,
      cicloEscolar = "2025-2026",
      capturas = [],
    } = req.body;

    const semanaNum = Number(semana);
    if (!semanaNum || semanaNum < 1 || semanaNum > 40) {
      return res.status(400).json({
        msg: "La semana debe ser un número válido entre 1 y 40.",
      });
    }

    const mesFinal =
      mes && MESES_CICLO_ESCOLAR.includes(mes)
        ? mes
        : getMesPorSemana(semanaNum);

    if (!Array.isArray(capturas)) {
      return res.status(400).json({ msg: "El formato de capturas es inválido." });
    }

    const dbUser = await User.findById(req.user._id)
      .select("nombre apellidoPaterno apellidoMaterno email")
      .lean();
    const autorNombre = dbUser
      ? `${dbUser.nombre || ""} ${dbUser.apellidoPaterno || ""} ${dbUser.apellidoMaterno || ""}`
          .replace(/\s+/g, " ")
          .trim() || dbUser.email
      : "Capturista";

    const bulkOps = [];

    for (const item of capturas) {
      const grupoNorm = normalizeGrupoReflexion(item.grupo);
      if (!grupoNorm) continue;

      // Si el valor viene vacío o nulo, eliminamos el registro de esa semana/grupo si existía
      if (
        item.porcentaje === "" ||
        item.porcentaje === null ||
        item.porcentaje === undefined
      ) {
        bulkOps.push({
          deleteOne: {
            filter: {
              school_id: new mongoose.Types.ObjectId(schoolId),
              cicloEscolar,
              semana: semanaNum,
              grupo: grupoNorm,
            },
          },
        });
        continue;
      }

      const pct = Number(item.porcentaje);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({
          msg: `El porcentaje para el grupo ${grupoNorm} debe estar entre 0 y 100.`,
        });
      }

      bulkOps.push({
        updateOne: {
          filter: {
            school_id: new mongoose.Types.ObjectId(schoolId),
            cicloEscolar,
            semana: semanaNum,
            grupo: grupoNorm,
          },
          update: {
            $set: {
              school_id: new mongoose.Types.ObjectId(schoolId),
              grupo: grupoNorm,
              semana: semanaNum,
              mes: mesFinal,
              porcentaje: Math.round(pct * 10) / 10,
              cicloEscolar,
              registradoPor: req.user._id,
              registradoPorNombre: autorNombre,
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await ReflexionSerena.bulkWrite(bulkOps);
    }

    const registrosSemana = await ReflexionSerena.find({
      school_id: schoolId,
      cicloEscolar,
      semana: semanaNum,
    })
      .sort({ grupo: 1 })
      .lean();

    res.json({
      msg: `Captura de la Semana ${semanaNum} (${mesFinal}) guardada correctamente.`,
      semana: semanaNum,
      mes: mesFinal,
      registrosSemana,
    });
  } catch (err) {
    console.error("Error en POST /api/reflexion-serena/bulk-semana:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// [GET] /api/reflexion-serena/resumen-mensual
// Calcula automáticamente con Aggregation Pipeline el promedio y total mensual
// por cada uno de los 15 grupos y el promedio general por mes y anual
// ============================================================================
router.get("/resumen-mensual", authMiddleware, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) {
      return res.status(400).json({ msg: "Usuario no tiene escuela asignada" });
    }

    const cicloEscolar = req.query.cicloEscolar || "2025-2026";
    const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

    // 1. Aggregation Pipeline: Promedio y sumatoria mensual por grupo
    const agregacionMensualPorGrupo = await ReflexionSerena.aggregate([
      {
        $match: {
          school_id: schoolObjectId,
          cicloEscolar,
        },
      },
      {
        $group: {
          _id: {
            grupo: "$grupo",
            mes: "$mes",
          },
          promedioMensual: { $avg: "$porcentaje" },
          totalPuntos: { $sum: "$porcentaje" },
          semanasCapturadas: { $sum: 1 },
          minPorcentaje: { $min: "$porcentaje" },
          maxPorcentaje: { $max: "$porcentaje" },
        },
      },
      {
        $project: {
          _id: 0,
          grupo: "$_id.grupo",
          mes: "$_id.mes",
          promedioMensual: { $round: ["$promedioMensual", 1] },
          totalPuntos: { $round: ["$totalPuntos", 1] },
          semanasCapturadas: 1,
          minPorcentaje: 1,
          maxPorcentaje: 1,
        },
      },
      {
        $sort: { grupo: 1, mes: 1 },
      },
    ]);

    // 2. Aggregation Pipeline: Promedio anual acumulado por grupo
    const agregacionAnualPorGrupo = await ReflexionSerena.aggregate([
      {
        $match: {
          school_id: schoolObjectId,
          cicloEscolar,
        },
      },
      {
        $group: {
          _id: "$grupo",
          promedioAnual: { $avg: "$porcentaje" },
          totalAnual: { $sum: "$porcentaje" },
          totalSemanasCapturadas: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          grupo: "$_id",
          promedioAnual: { $round: ["$promedioAnual", 1] },
          totalAnual: { $round: ["$totalAnual", 1] },
          totalSemanasCapturadas: 1,
        },
      },
    ]);

    // 3. Aggregation Pipeline: Promedio institucional por mes (los 15 grupos combinados)
    const agregacionInstitucionalPorMes = await ReflexionSerena.aggregate([
      {
        $match: {
          school_id: schoolObjectId,
          cicloEscolar,
        },
      },
      {
        $group: {
          _id: "$mes",
          promedioInstitucional: { $avg: "$porcentaje" },
          registrosCapturados: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          mes: "$_id",
          promedioInstitucional: { $round: ["$promedioInstitucional", 1] },
          registrosCapturados: 1,
        },
      },
    ]);

    // Construir matriz estructurada para los 15 grupos x 10 meses
    const matrizGrupos = GRUPOS_REFLEXION_SERENA.map((grupoNombre) => {
      const mesesData = {};
      MESES_CICLO_ESCOLAR.forEach((m) => {
        const found = agregacionMensualPorGrupo.find(
          (item) => item.grupo === grupoNombre && item.mes === m
        );
        mesesData[m] = found
          ? {
              promedio: found.promedioMensual,
              total: found.totalPuntos,
              semanasCapturadas: found.semanasCapturadas,
            }
          : null;
      });

      const anualFound = agregacionAnualPorGrupo.find(
        (item) => item.grupo === grupoNombre
      );

      return {
        grupo: grupoNombre,
        grado: grupoNombre.charAt(0),
        meses: mesesData,
        promedioAnual: anualFound ? anualFound.promedioAnual : null,
        totalSemanasCapturadas: anualFound
          ? anualFound.totalSemanasCapturadas
          : 0,
      };
    });

    const promediosPorMes = {};
    MESES_CICLO_ESCOLAR.forEach((m) => {
      const found = agregacionInstitucionalPorMes.find((item) => item.mes === m);
      promediosPorMes[m] = found ? found.promedioInstitucional : null;
    });

    res.json({
      cicloEscolar,
      grupos: GRUPOS_REFLEXION_SERENA,
      meses: MESES_CICLO_ESCOLAR,
      matrizGrupos,
      promediosPorMes,
      agregacionMensualPorGrupo,
      agregacionAnualPorGrupo,
    });
  } catch (err) {
    console.error("Error en GET /api/reflexion-serena/resumen-mensual:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// [POST] /api/reflexion-serena/capturistas (Solo Admin/Directivo)
// Asigna o actualiza qué docentes tienen el rol/permiso de "Capturista de Reflexión Serena"
// ============================================================================
router.post("/capturistas", authMiddleware, isAdmin, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const { teacherIds = [] } = req.body;

    if (!Array.isArray(teacherIds)) {
      return res.status(400).json({ msg: "Lista de docentes inválida." });
    }

    const validIds = teacherIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    // 1. Quitar permiso a todos los usuarios de la escuela que no estén en validIds
    await User.updateMany(
      { school_id: schoolId },
      { $set: { esCapturistaReflexion: false } }
    );

    // 2. Activar permiso a las docentes seleccionadas
    if (validIds.length > 0) {
      await User.updateMany(
        { _id: { $in: validIds }, school_id: schoolId },
        { $set: { esCapturistaReflexion: true } }
      );
    }

    // 3. Sincronizar también con la plantilla de extensión "Reflexión Serena" si existe
    const template = await CustomTableTemplate.findOne({
      school_id: schoolId,
      title: { $regex: /reflexi[oó]n\s*serena/i },
    });
    if (template) {
      template.authorizedTeachers = validIds;
      template.rowType = "GROUPS";
      await template.save();
    }

    const capturistasActualizadas = await User.find({
      school_id: schoolId,
      esCapturistaReflexion: true,
    })
      .select("_id nombre apellidoPaterno apellidoMaterno email role esCapturistaReflexion")
      .lean();

    res.json({
      msg: "Permisos de Capturista de Reflexión Serena actualizados correctamente.",
      capturistas: capturistasActualizadas,
    });
  } catch (err) {
    console.error("Error en POST /api/reflexion-serena/capturistas:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// [POST] /api/reflexion-serena/alta-capturista (Solo Admin/Directivo)
// Permite dar de alta a una nueva docente directamente con el rol/permiso
// de "Capturista de Reflexión Serena"
// ============================================================================
router.post("/alta-capturista", authMiddleware, isAdmin, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const { nombre, email, password, celular } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        msg: "Nombre completo, correo electrónico y contraseña son obligatorios.",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        msg: "La contraseña debe tener al menos 6 caracteres.",
      });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      // Si ya existe en la misma escuela, simplemente le otorgamos el permiso de Capturista
      if (String(existing.school_id) === String(schoolId)) {
        existing.esCapturistaReflexion = true;
        await existing.save();

        const template = await CustomTableTemplate.findOne({
          school_id: schoolId,
          title: { $regex: /reflexi[oó]n\s*serena/i },
        });
        if (template) {
          const existsInTemplate = (template.authorizedTeachers || []).some(
            (id) => String(id) === String(existing._id)
          );
          if (!existsInTemplate) {
            template.authorizedTeachers.push(existing._id);
            await template.save();
          }
        }

        return res.json({
          msg: `La docente ${existing.nombre} ya estaba registrada y se le ha asignado el permiso de Capturista de Reflexión Serena.`,
          capturista: existing,
        });
      }
      return res.status(400).json({
        msg: "Ese correo electrónico ya está registrado en otra institución.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const nuevaDocente = new User({
      nombre: nombre.trim(),
      email: cleanEmail,
      password: hashedPassword,
      celular: celular ? String(celular).trim() : undefined,
      role: "profesor",
      school_id: schoolId,
      asignaturas: ["Reflexión Serena"],
      esCapturistaReflexion: true,
    });

    await nuevaDocente.save();

    // Sincronizar con la tarjeta de extensión si existe
    const template = await CustomTableTemplate.findOne({
      school_id: schoolId,
      title: { $regex: /reflexi[oó]n\s*serena/i },
    });
    if (template) {
      template.authorizedTeachers.push(nuevaDocente._id);
      template.rowType = "GROUPS";
      await template.save();
    }

    res.status(201).json({
      msg: `Docente "${nuevaDocente.nombre}" dada de alta exitosamente como Capturista de Reflexión Serena.`,
      capturista: {
        _id: nuevaDocente._id,
        nombre: nuevaDocente.nombre,
        email: nuevaDocente.email,
        role: nuevaDocente.role,
        esCapturistaReflexion: true,
      },
    });
  } catch (err) {
    console.error("Error en POST /api/reflexion-serena/alta-capturista:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
