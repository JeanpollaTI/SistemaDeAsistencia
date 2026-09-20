import express from 'express';
import CustomTableTemplate from '../models/CustomTableTemplate.js';
import CustomTableRowData from '../models/CustomTableRowData.js';
import Grupo from '../models/Grupo.js';
import User from '../models/User.js';
import TablaMatematica from '../models/TablaMatematica.js';
import { authMiddleware, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Helper to seed default "Tablas Matemáticas" if no tables exist for school
const ensureDefaultTemplates = async (schoolId) => {
    const count = await CustomTableTemplate.countDocuments({ school_id: schoolId });
    if (count === 0) {
        // Seed default "Tablas Matemáticas" template
        const defaultCols = [];
        for (let i = 1; i <= 7; i++) {
            defaultCols.push({
                key: `p${i}`,
                label: `Tabla ${i}`,
                type: 'BOOLEAN_STATUS',
                statusOptions: [
                    { key: 'En orden', label: 'En orden', color: '#22c55e' },
                    { key: 'Incompleta', label: 'Incompleta', color: '#ef4444' },
                    { key: 'Salteadas', label: 'Salteadas', color: '#f59e0b' }
                ]
            });
        }
        defaultCols.push({
            key: 'observaciones',
            label: 'Observaciones',
            type: 'TEXT',
            statusOptions: []
        });

        // Get first group if available
        const firstGroup = await Grupo.findOne({ school_id: schoolId });

        await CustomTableTemplate.create({
            school_id: schoolId,
            title: 'Tablas Matemáticas',
            description: 'Seguimiento continuo del dominio de tablas de multiplicar en los alumnos.',
            rowType: 'STUDENTS',
            assignedGroupId: firstGroup ? firstGroup._id : null,
            authorizedTeachers: [],
            columns: defaultCols,
            isBuiltIn: true
        });

        // Migrate historical TablaMatematica if exists
        try {
            const oldRecords = await TablaMatematica.find({ school_id: schoolId });
            if (oldRecords && oldRecords.length > 0) {
                const builtIn = await CustomTableTemplate.findOne({ school_id: schoolId, title: 'Tablas Matemáticas' });
                if (builtIn) {
                    for (const oldRec of oldRecords) {
                        if (oldRec.evaluaciones && oldRec.evaluaciones.length > 0) {
                            for (const ev of oldRec.evaluaciones) {
                                if (ev.alumno_id && ev.registros) {
                                    const dataObj = {};
                                    if (ev.registros instanceof Map) {
                                        ev.registros.forEach((v, k) => { dataObj[k] = v; });
                                    } else if (typeof ev.registros === 'object') {
                                        Object.assign(dataObj, ev.registros);
                                    }
                                    await CustomTableRowData.updateOne(
                                        { tableId: builtIn._id, rowEntityId: ev.alumno_id },
                                        {
                                            $set: {
                                                tableId: builtIn._id,
                                                school_id: schoolId,
                                                rowEntityId: ev.alumno_id,
                                                rowEntityName: ev.alumnoNombre || '',
                                                data: dataObj
                                            }
                                        },
                                        { upsert: true }
                                    );
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error migrando TablaMatematica antigua:', err);
        }
    }
};

// GET /api/extensions - List all extension templates & metadata
router.get('/', authMiddleware, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        if (!schoolId) return res.status(400).json({ msg: 'Usuario no tiene escuela asignada' });

        await ensureDefaultTemplates(schoolId);

        const extensions = await CustomTableTemplate.find({ school_id: schoolId, isActive: true })
            .populate('assignedGroupId', 'nombre')
            .populate('authorizedTeachers', 'nombre email role')
            .sort({ createdAt: -1 })
            .lean();

        const profesores = await User.find({
            school_id: schoolId,
            role: { $in: ['profesor', 'admin'] }
        }).select('_id nombre email role').sort({ nombre: 1 }).lean();

        const grupos = await Grupo.find({ school_id: schoolId })
            .select('_id nombre asesor')
            .sort({ nombre: 1 }).lean();

        res.json({ extensions, profesores, grupos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/extensions/:id - Get detailed view and spreadsheet data
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        const template = await CustomTableTemplate.findOne({ _id: req.params.id, school_id: schoolId })
            .populate('assignedGroupId')
            .populate('authorizedTeachers', 'nombre email role')
            .lean();

        if (!template) {
            return res.status(404).json({ msg: 'Tabla o extensión no encontrada' });
        }

        // Fetch row data captured
        const rowDataRecords = await CustomTableRowData.find({
            tableId: template._id,
            school_id: schoolId
        }).lean();

        // Build data map keyed by rowEntityId
        const dataMap = {};
        const colorMap = {};
        rowDataRecords.forEach(r => {
            const dataObj = {};
            if (r.data instanceof Map) {
                r.data.forEach((val, key) => { dataObj[key] = val; });
            } else if (r.data && typeof r.data === 'object') {
                Object.assign(dataObj, r.data);
            }
            dataMap[r.rowEntityId] = dataObj;
            if (r.rowColorTag) colorMap[r.rowEntityId] = r.rowColorTag;
        });

        // Generate rows based on rowType
        let rows = [];
        if (template.rowType === 'STUDENTS') {
            let targetGroup = template.assignedGroupId;
            if (targetGroup && targetGroup.alumnos) {
                rows = targetGroup.alumnos.map(al => ({
                    entityId: al._id.toString(),
                    name: `${al.nombre} ${al.apellidoPaterno} ${al.apellidoMaterno || ''}`.trim(),
                    nombre: al.nombre,
                    apellidoPaterno: al.apellidoPaterno,
                    apellidoMaterno: al.apellidoMaterno || '',
                    esNuevoIngreso: !!al.esNuevoIngreso,
                    fechaIngreso: al.fechaIngreso || '',
                    esBaja: !!al.esBaja,
                    fechaBaja: al.fechaBaja || '',
                    data: dataMap[al._id.toString()] || {},
                    rowColorTag: colorMap[al._id.toString()] || ''
                }));
            }
        } else if (template.rowType === 'GROUPS') {
            const allGroups = await Grupo.find({ school_id: schoolId }).sort({ nombre: 1 }).lean();
            rows = allGroups.map(g => ({
                entityId: g._id.toString(),
                name: g.nombre,
                asesor: g.asesor || '',
                aula: g.aula || '',
                data: dataMap[g._id.toString()] || {},
                rowColorTag: colorMap[g._id.toString()] || ''
            }));
        }

        // Determine edit authorization for current user
        const isUserAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        const isAuthorizedTeacher = template.authorizedTeachers.some(
            t => t._id.toString() === req.user._id.toString()
        );
        const canEdit = isUserAdmin || isAuthorizedTeacher;

        res.json({
            template,
            rows,
            canEdit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/extensions - Create new extension template (Admin only)
router.post('/', authMiddleware, isAdmin, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        const { title, description, rowType, assignedGroupId, authorizedTeachers, columns } = req.body;

        if (!title || !columns || !Array.isArray(columns) || columns.length === 0) {
            return res.status(400).json({ msg: 'El título y al menos una columna son obligatorios' });
        }

        const template = new CustomTableTemplate({
            school_id: schoolId,
            title,
            description: description || '',
            rowType: rowType || 'STUDENTS',
            assignedGroupId: assignedGroupId || null,
            authorizedTeachers: Array.isArray(authorizedTeachers) ? authorizedTeachers : [],
            columns
        });

        await template.save();

        const populated = await CustomTableTemplate.findById(template._id)
            .populate('assignedGroupId', 'nombre')
            .populate('authorizedTeachers', 'nombre email role');

        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/extensions/:id - Update extension template (Admin only)
router.put('/:id', authMiddleware, isAdmin, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        const { title, description, rowType, assignedGroupId, authorizedTeachers, columns } = req.body;

        const template = await CustomTableTemplate.findOne({ _id: req.params.id, school_id: schoolId });
        if (!template) {
            return res.status(404).json({ msg: 'Extensión no encontrada' });
        }

        if (title) template.title = title;
        if (description !== undefined) template.description = description;
        if (rowType) template.rowType = rowType;
        template.assignedGroupId = assignedGroupId || null;
        if (Array.isArray(authorizedTeachers)) template.authorizedTeachers = authorizedTeachers;
        if (Array.isArray(columns)) template.columns = columns;

        await template.save();

        const populated = await CustomTableTemplate.findById(template._id)
            .populate('assignedGroupId', 'nombre')
            .populate('authorizedTeachers', 'nombre email role');

        res.json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/extensions/:id - Delete extension template and cell data (Admin only)
router.delete('/:id', authMiddleware, isAdmin, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        const template = await CustomTableTemplate.findOneAndDelete({ _id: req.params.id, school_id: schoolId });

        if (!template) {
            return res.status(404).json({ msg: 'Extensión no encontrada' });
        }

        await CustomTableRowData.deleteMany({ tableId: req.params.id, school_id: schoolId });

        res.json({ msg: 'Extensión eliminada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/extensions/:id/cell - Update cell or row color tag
router.patch('/:id/cell', authMiddleware, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        const { rowEntityId, colKey, value, rowColorTag, rowEntityName } = req.body;

        if (!rowEntityId) {
            return res.status(400).json({ msg: 'Identificador de fila obligatorio' });
        }

        const template = await CustomTableTemplate.findOne({ _id: req.params.id, school_id: schoolId });
        if (!template) {
            return res.status(404).json({ msg: 'Tabla o extensión no encontrada' });
        }

        // Authorization check
        const isUserAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        const isAuthorizedTeacher = template.authorizedTeachers.some(
            t => t.toString() === req.user._id.toString()
        );

        if (!isUserAdmin && !isAuthorizedTeacher) {
            return res.status(403).json({ msg: 'No tienes permiso para modificar esta tabla' });
        }

        let record = await CustomTableRowData.findOne({
            tableId: template._id,
            rowEntityId
        });

        if (!record) {
            record = new CustomTableRowData({
                tableId: template._id,
                school_id: schoolId,
                rowEntityId,
                rowEntityName: rowEntityName || '',
                data: new Map(),
                rowColorTag: rowColorTag || ''
            });
        }

        if (colKey !== undefined) {
            if (!(record.data instanceof Map)) {
                record.data = new Map(Object.entries(record.data || {}));
            }
            if (value === null || value === undefined || value === '') {
                record.data.delete(colKey);
            } else {
                record.data.set(colKey, value);
            }
        }

        if (rowColorTag !== undefined) {
            record.rowColorTag = rowColorTag;
        }

        record.updatedBy = req.user._id;
        await record.save();

        res.json({ msg: 'Celda actualizada', record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
