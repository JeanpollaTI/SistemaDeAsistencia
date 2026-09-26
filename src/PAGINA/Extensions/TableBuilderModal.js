import React, { useState, useEffect } from 'react';
import { FaTimes, FaRocket, FaTable, FaUserGraduate, FaUsers } from 'react-icons/fa';

const TableBuilderModal = ({ isOpen, onClose, onSave, initialData, profesores = [], grupos = [] }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [rowType, setRowType] = useState('STUDENTS');
    const [authorizedTeachers, setAuthorizedTeachers] = useState([]);
    const [groupAssignments, setGroupAssignments] = useState([]);

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title || '');
            setDescription(initialData.description || '');
            setRowType(initialData.rowType || 'STUDENTS');
            setAuthorizedTeachers(
                (initialData.authorizedTeachers || []).map(t => typeof t === 'object' ? t._id : t)
            );
            setGroupAssignments(
                (initialData.groupAssignments || []).map(ga => ({
                    groupId: typeof ga.groupId === 'object' ? ga.groupId._id : ga.groupId,
                    teachers: (ga.teachers || []).map(t => typeof t === 'object' ? t._id : t)
                }))
            );
        } else {
            setTitle('');
            setDescription('');
            setRowType('STUDENTS');
            setAuthorizedTeachers([]);
            setGroupAssignments([]);
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const toggleGlobalTeacher = (teacherId) => {
        if (authorizedTeachers.includes(teacherId)) {
            setAuthorizedTeachers(authorizedTeachers.filter(id => id !== teacherId));
        } else {
            setAuthorizedTeachers([...authorizedTeachers, teacherId]);
        }
    };

    const toggleGroupTeacher = (groupId, teacherId) => {
        const existingAssign = groupAssignments.find(ga => ga.groupId === groupId);
        let updatedGroupAssignments = [...groupAssignments];

        if (!existingAssign) {
            updatedGroupAssignments.push({ groupId, teachers: [teacherId] });
        } else {
            const hasTeacher = existingAssign.teachers.includes(teacherId);
            const updatedTeachers = hasTeacher
                ? existingAssign.teachers.filter(id => id !== teacherId)
                : [...existingAssign.teachers, teacherId];

            updatedGroupAssignments = updatedGroupAssignments.map(ga =>
                ga.groupId === groupId ? { ...ga, teachers: updatedTeachers } : ga
            );
        }
        setGroupAssignments(updatedGroupAssignments);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) {
            return;
        }

        // Default initial columns for new tables if not editing existing
        const initialCols = initialData?.columns || [
            {
                key: 'p1_t1',
                label: '1',
                groupHeader: 'Primer periodo',
                type: 'BOOLEAN_STATUS',
                statusOptions: [
                    { key: 'I', label: 'I', color: '#ef4444' },
                    { key: 'O', label: 'O', color: '#22c55e' },
                    { key: 'S', label: 'S', color: '#f59e0b' }
                ]
            },
            {
                key: 'p1_t2',
                label: '2',
                groupHeader: 'Primer periodo',
                type: 'BOOLEAN_STATUS',
                statusOptions: [
                    { key: 'I', label: 'I', color: '#ef4444' },
                    { key: 'O', label: 'O', color: '#22c55e' },
                    { key: 'S', label: 'S', color: '#f59e0b' }
                ]
            },
            {
                key: 'observaciones',
                label: 'Observaciones',
                groupHeader: 'Notas',
                type: 'TEXT',
                statusOptions: []
            }
        ];

        onSave({
            _id: initialData?._id,
            title: title.trim(),
            description: description.trim(),
            rowType,
            authorizedTeachers,
            groupAssignments,
            columns: initialCols
        });
    };

    const selectAllGlobalTeachers = () => {
        setAuthorizedTeachers(profesores.map(p => p._id));
    };

    const deselectAllGlobalTeachers = () => {
        setAuthorizedTeachers([]);
    };

    const selectAllGroupsAllTeachers = () => {
        const allProfIds = profesores.map(p => p._id);
        const newGroupAssignments = grupos.map(g => ({
            groupId: g._id,
            teachers: allProfIds
        }));
        setGroupAssignments(newGroupAssignments);
    };

    const deselectAllGroupsTeachers = () => {
        setGroupAssignments([]);
    };

    const formatProfesorName = (p) => {
        if (!p) return '';
        if (typeof p === 'string') return p;
        const pat = p.apellidoPaterno ? p.apellidoPaterno.trim() : '';
        const mat = p.apellidoMaterno ? p.apellidoMaterno.trim() : '';
        const nom = p.nombre ? p.nombre.trim() : '';
        if (pat || mat) return `${nom} ${pat} ${mat}`.replace(/\s+/g, ' ').trim();
        return nom || p.email || '';
    };

    return (
        <div className="ext-modal-overlay">
            <div className="ext-modal-content ext-modal-compact">
                <div className="ext-modal-header">
                    <h2>
                        {initialData ? '⚙️ Configuración de Extensión' : '🚀 Nueva Tabla / Extensión'}
                    </h2>
                    <button className="ext-modal-close" onClick={onClose}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} className="ext-modal-body">
                    <div className="ext-form-group">
                        <label>Nombre de la Extensión *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej. Caligrafía, Reflexión Serena, Lectura..."
                            autoFocus
                            required
                        />
                    </div>

                    <div className="ext-form-group">
                        <label>Descripción / Instrucciones (Opcional)</label>
                        <textarea
                            rows="2"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Breve propósito u objetivo de esta actividad..."
                        />
                    </div>

                    <div className="ext-form-group">
                        <label>¿Cómo se evaluará esta tabla?</label>
                        <div className="ext-type-selector-cards">
                            <div
                                className={`ext-type-card ${rowType === 'STUDENTS' ? 'active' : ''}`}
                                onClick={() => setRowType('STUDENTS')}
                            >
                                <FaUserGraduate className="ext-type-icon" />
                                <div>
                                    <strong>Por Alumnos</strong>
                                    <p>Evaluación individual por alumno en los grupos del plantel.</p>
                                </div>
                            </div>

                            <div
                                className={`ext-type-card ${rowType === 'GROUPS' ? 'active' : ''}`}
                                onClick={() => setRowType('GROUPS')}
                            >
                                <FaUsers className="ext-type-icon" />
                                <div>
                                    <strong>Por Grupos</strong>
                                    <p>Evaluación general por cada grupo del plantel.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Teachers RBAC */}
                    <div className="ext-form-group">
                        <div className="ext-section-header-flex">
                            <label>Profesores Autorizados (Permiso Global)</label>
                            <div className="ext-quick-select-btns">
                                <button type="button" className="ext-btn-link-sm" onClick={selectAllGlobalTeachers}>
                                    ✓ Seleccionar Todos
                                </button>
                                <button type="button" className="ext-btn-link-sm text-red" onClick={deselectAllGlobalTeachers}>
                                    ✕ Desmarcar Todos
                                </button>
                            </div>
                        </div>
                        <p className="ext-help-text">Los administradores siempre tienen acceso completo. Marca los profesores con permiso:</p>
                        <div className="ext-teachers-grid">
                            {profesores.map(p => (
                                <label key={p._id} className={`ext-teacher-chip ${authorizedTeachers.includes(p._id) ? 'selected' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={authorizedTeachers.includes(p._id)}
                                        onChange={() => toggleGlobalTeacher(p._id)}
                                    />
                                    <span>{formatProfesorName(p)}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Per-group teacher assignments if students mode */}
                    {rowType === 'STUDENTS' && grupos.length > 0 && (
                        <div className="ext-form-group">
                            <div className="ext-section-header-flex">
                                <label>Docentes Evaluadores por Grupo</label>
                                <div className="ext-quick-select-btns">
                                    <button type="button" className="ext-btn-link-sm" onClick={selectAllGroupsAllTeachers}>
                                        👥 Seleccionar Todos los Grupos
                                    </button>
                                    <button type="button" className="ext-btn-link-sm text-red" onClick={deselectAllGroupsTeachers}>
                                        ✕ Desmarcar Grupos
                                    </button>
                                </div>
                            </div>
                            <div className="ext-group-assign-list">
                                {grupos.map(g => {
                                    const assign = groupAssignments.find(ga => ga.groupId === g._id);
                                    const selectedTeachers = assign ? assign.teachers : [];

                                    return (
                                        <div key={g._id} className="ext-group-assign-row">
                                            <span className="ext-group-name-tag">{g.nombre}</span>
                                            <div className="ext-group-teachers-chips">
                                                {profesores.map(p => {
                                                    const isChecked = selectedTeachers.includes(p._id);
                                                    return (
                                                        <label
                                                            key={p._id}
                                                            className={`ext-teacher-mini-chip ${isChecked ? 'active' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleGroupTeacher(g._id, p._id)}
                                                            />
                                                            {formatProfesorName(p)}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="ext-modal-footer">
                        <button type="button" className="ext-btn ext-btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="ext-btn ext-btn-primary">
                            <FaRocket /> {initialData ? '💾 Guardar Cambios' : 'Comenzar a Diseñar 🚀'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TableBuilderModal;
