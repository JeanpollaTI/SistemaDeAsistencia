import express from 'express';
import CustomTableTemplate from '../models/CustomTableTemplate.js';
import CustomTableRowData from '../models/CustomTableRowData.js';
import Grupo from '../models/Grupo.js';
import User from '../models/User.js';
import TablaMatematica from '../models/TablaMatematica.js';
import { authMiddleware, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

const standardStatusOptions = [
    { key: 'I', label: 'I', color: '#ef4444' }, // I = Incompleta
    { key: 'O', label: 'O', color: '#22c55e' }, // O = En orden
    { key: 'S', label: 'S', color: '#f59e0b' }  // S = Salteadas
];

const buildDefaultTablasMatematicasColumns = () => {
    const cols = [];
    // Primer periodo (1..5)
    for (let i = 1; i <= 5; i++) {
        cols.push({
            key: `p1_t${i}`,
            label: `${i}`,
            groupHeader: 'Primer periodo',
            type: 'BOOLEAN_STATUS',
            statusOptions: standardStatusOptions
        });
    }
    // Segundo Periodo (1..5)
    for (let i = 1; i <= 5; i++) {
        cols.push({
            key: `p2_t${i}`,
            label: `${i}`,
            groupHeader: 'Segundo Periodo',
            type: 'BOOLEAN_STATUS',
            statusOptions: standardStatusOptions
        });
    }
    // Tercer Periodo (6..10)
    for (let i = 6; i <= 10; i++) {
        cols.push({
            key: `p3_t${i}`,
            label: `${i}`,
            groupHeader: 'Tercer Periodo',
            type: 'BOOLEAN_STATUS',
            statusOptions: standardStatusOptions
        });
    }
    // Observaciones
    cols.push({
        key: 'observaciones',
        label: 'Observaciones',
        groupHeader: 'Notas',
        type: 'TEXT',
        statusOptions: []
    });
    return cols;
};

// Helper to seed or upgrade default "Tablas Matemáticas"
const ensureDefaultTemplates = async (schoolId) => {
    let builtIn = await CustomTableTemplate.findOne({ school_id: schoolId, title: 'Tablas Matemáticas' });
    const defaultCols = buildDefaultTablasMatematicasColumns();

    if (!builtIn) {
        builtIn = await CustomTableTemplate.create({
            school_id: schoolId,
            title: 'Tablas Matemáticas',
            description: 'Seguimiento continuo por periodos del dominio de tablas de multiplicar.',
            rowType: 'STUDENTS',
            assignedGroupId: null,
            authorizedTeachers: [],
            columns: defaultCols,
            isBuiltIn: true
        });
    } else {
        // Upgrade builtIn columns to include groupHeader period structure if missing
        const hasPeriods = builtIn.columns.some(c => c.groupHeader && c.groupHeader.includes('periodo'));
        if (!hasPeriods) {
            builtIn.columns = defaultCols;
            await builtIn.save();
        }
    }

    // Migrate old TablaMatematica if exists
    try {
        const oldRecords = await TablaMatematica.find({ school_id: schoolId });
        for (const oldRec of oldRecords) {
            if (oldRec.evaluaciones && oldRec.evaluaciones.length > 0) {
                for (const ev of oldRec.evaluaciones) {
                    if (ev.alumno_id && ev.registros) {
                        const dataObj = {};
                        const rawMap = ev.registros instanceof Map ? Object.fromEntries(ev.registros) : ev.registros;
                        for (const [k, val] of Object.entries(rawMap || {})) {
                            let mappedVal = val;
                            if (val === 'En orden') mappedVal = 'O';
                            else if (val === 'Incompleta') mappedVal = 'I';
                            else if (val === 'Salteadas') mappedVal = 'S';

                            // Map legacy p1..p5 to p1_t1..p1_t5, p6..p7 to p2_t1..p2_t2
                            if (k.startsWith('p')) {
                                const num = parseInt(k.replace('p', ''), 10);
                                if (!isNaN(num)) {
                                    if (num <= 5) dataObj[`p1_t${num}`] = mappedVal;
                                    else dataObj[`p2_t${num - 5}`] = mappedVal;
                                } else {
                                    dataObj[k] = mappedVal;
                                }
                            } else {
                                dataObj[k] = mappedVal;
                            }
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
    } catch (err) {
        console.error('Error migrando TablaMatematica antigua:', err);
    }
};

// GET /api/extensions/active-status - Check if extensions are active for user's school
router.get('/active-status', authMiddleware, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        if (!schoolId) return res.json({ hasExtensions: false });
        const count = await CustomTableTemplate.countDocuments({ school_id: schoolId, isActive: true });
        res.json({ hasExtensions: count > 0, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/extensions - List all extension templates & metadata
router.get('/', authMiddleware, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        if (!schoolId) return res.status(400).json({ msg: 'Usuario no tiene escuela asignada' });

        await ensureDefaultTemplates(schoolId);

        const extensions = await CustomTableTemplate.find({ school_id: schoolId, isActive: true })
            .populate('assignedGroupId', 'nombre')
            .populate('authorizedTeachers', 'nombre email role')
            .populate('groupAssignments.groupId', 'nombre')
            .populate('groupAssignments.teachers', 'nombre email role')
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

// GET /api/extensions/:id - Get detailed view and spreadsheet data (supports ?groupId=...)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        const requestedGroupId = req.query.groupId;

        const template = await CustomTableTemplate.findOne({ _id: req.params.id, school_id: schoolId })
            .populate('assignedGroupId')
            .populate('authorizedTeachers', 'nombre email role')
            .populate('groupAssignments.groupId', 'nombre')
            .populate('groupAssignments.teachers', 'nombre email role')
            .lean();

        if (!template) {
            return res.status(404).json({ msg: 'Tabla o extensión no encontrada' });
        }

        // Fetch all active groups for school
        const allSchoolGroups = await Grupo.find({ school_id: schoolId }).sort({ nombre: 1 }).lean();
        allSchoolGroups.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));

        let selectedGroup = null;
        if (template.rowType === 'STUDENTS') {
            if (requestedGroupId) {
                selectedGroup = allSchoolGroups.find(g => g._id.toString() === requestedGroupId.toString());
            }
            if (!selectedGroup && template.assignedGroupId) {
                selectedGroup = allSchoolGroups.find(g => g._id.toString() === template.assignedGroupId._id.toString());
            }
            if (!selectedGroup && allSchoolGroups.length > 0) {
                selectedGroup = allSchoolGroups[0];
            }
        }

        // Fetch row data captured
        const rowDataRecords = await CustomTableRowData.find({
            tableId: template._id,
            school_id: schoolId
        }).lean();

        const dataMap = {};
        const colorMap = {};
        rowDataRecords.forEach(r => {
            const dataObj = {};
            if (r.data instanceof Map) {
                r.data.forEach((val, key) => { dataObj[key] = val; });
            } else if (r.data && typeof r.data === 'object') {
                for (const [k, v] of Object.entries(r.data)) {
                    if (v === 'En orden') dataObj[k] = 'O';
                    else if (v === 'Incompleta') dataObj[k] = 'I';
                    else if (v === 'Salteadas') dataObj[k] = 'S';
                    else dataObj[k] = v;
                }
            }
            dataMap[r.rowEntityId] = dataObj;
            if (r.rowColorTag) colorMap[r.rowEntityId] = r.rowColorTag;
        });

        let rows = [];
        if (template.rowType === 'STUDENTS') {
            if (selectedGroup && selectedGroup.alumnos) {
                rows = selectedGroup.alumnos.map(al => ({
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
            rows = allSchoolGroups.map(g => ({
                entityId: g._id.toString(),
                name: g.nombre,
                asesor: g.asesor || '',
                aula: g.aula || '',
                data: dataMap[g._id.toString()] || {},
                rowColorTag: colorMap[g._id.toString()] || ''
            }));
        }

        const isUserAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        let isAuthorizedTeacher = template.authorizedTeachers.some(
            t => (typeof t === 'object' ? t._id : t).toString() === req.user._id.toString()
        );

        if (!isAuthorizedTeacher && selectedGroup && template.groupAssignments) {
            const groupAssign = template.groupAssignments.find(
                ga => (typeof ga.groupId === 'object' ? ga.groupId._id : ga.groupId).toString() === selectedGroup._id.toString()
            );
            if (groupAssign && groupAssign.teachers) {
                isAuthorizedTeacher = groupAssign.teachers.some(
                    t => (typeof t === 'object' ? t._id : t).toString() === req.user._id.toString()
                );
            }
        }

        const canEdit = isUserAdmin || isAuthorizedTeacher;

        res.json({
            template,
            rows,
            groups: allSchoolGroups,
            selectedGroup: selectedGroup ? { _id: selectedGroup._id, nombre: selectedGroup.nombre, asesor: selectedGroup.asesor } : null,
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
        const { title, description, rowType, assignedGroupId, authorizedTeachers, groupAssignments, columns } = req.body;

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
            groupAssignments: Array.isArray(groupAssignments) ? groupAssignments : [],
            columns
        });

        await template.save();

        const populated = await CustomTableTemplate.findById(template._id)
            .populate('assignedGroupId', 'nombre')
            .populate('authorizedTeachers', 'nombre email role')
            .populate('groupAssignments.groupId', 'nombre')
            .populate('groupAssignments.teachers', 'nombre email role');

        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/extensions/:id - Update extension template (Admin only)
router.put('/:id', authMiddleware, isAdmin, async (req, res) => {
    try {
        const schoolId = req.user.school_id;
        const { title, description, rowType, assignedGroupId, authorizedTeachers, groupAssignments, columns } = req.body;

        const template = await CustomTableTemplate.findOne({ _id: req.params.id, school_id: schoolId });
        if (!template) {
            return res.status(404).json({ msg: 'Extensión no encontrada' });
        }

        if (title) template.title = title;
        if (description !== undefined) template.description = description;
        if (rowType) template.rowType = rowType;
        template.assignedGroupId = assignedGroupId || null;
        if (Array.isArray(authorizedTeachers)) template.authorizedTeachers = authorizedTeachers;
        if (Array.isArray(groupAssignments)) template.groupAssignments = groupAssignments;
        if (Array.isArray(columns)) template.columns = columns;

        await template.save();

        const populated = await CustomTableTemplate.findById(template._id)
            .populate('assignedGroupId', 'nombre')
            .populate('authorizedTeachers', 'nombre email role')
            .populate('groupAssignments.groupId', 'nombre')
            .populate('groupAssignments.teachers', 'nombre email role');

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
        const { rowEntityId, groupId, colKey, value, rowColorTag, rowEntityName } = req.body;

        if (!rowEntityId) {
            return res.status(400).json({ msg: 'Identificador de fila obligatorio' });
        }

        const template = await CustomTableTemplate.findOne({ _id: req.params.id, school_id: schoolId });
        if (!template) {
            return res.status(404).json({ msg: 'Tabla o extensión no encontrada' });
        }

        // Authorization check
        const isUserAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        let isAuthorizedTeacher = template.authorizedTeachers.some(
            t => t.toString() === req.user._id.toString()
        );

        if (!isAuthorizedTeacher && groupId && template.groupAssignments) {
            const groupAssign = template.groupAssignments.find(
                ga => (typeof ga.groupId === 'object' ? ga.groupId._id : ga.groupId).toString() === groupId.toString()
            );
            if (groupAssign && groupAssign.teachers) {
                isAuthorizedTeacher = groupAssign.teachers.some(
                    t => (typeof t === 'object' ? t._id : t).toString() === req.user._id.toString()
                );
            }
        }

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
                groupId: groupId || null,
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
