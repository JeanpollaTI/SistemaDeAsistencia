import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaTrash, FaPalette, FaUserTie } from 'react-icons/fa';

const COLOR_PRESETS = [
    { name: 'Verde', value: '#22c55e' },
    { name: 'Rojo', value: '#ef4444' },
    { name: 'Amarillo', value: '#f59e0b' },
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Morado', value: '#a855f7' },
    { name: 'Gris', value: '#6b7280' }
];

const TableBuilderModal = ({ isOpen, onClose, onSave, initialData, profesores = [], grupos = [] }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [rowType, setRowType] = useState('STUDENTS');
    const [authorizedTeachers, setAuthorizedTeachers] = useState([]);
    const [groupAssignments, setGroupAssignments] = useState([]);
    const [columns, setColumns] = useState([]);

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
            setColumns(initialData.columns ? JSON.parse(JSON.stringify(initialData.columns)) : []);
        } else {
            setTitle('');
            setDescription('');
            setRowType('STUDENTS');
            setAuthorizedTeachers([]);
            setGroupAssignments([]);
            setColumns([
                {
                    key: 'p1',
                    label: 'Tabla 1',
                    type: 'BOOLEAN_STATUS',
                    statusOptions: [
                        { key: 'O', label: 'O', color: '#22c55e' },
                        { key: 'I', label: 'I', color: '#ef4444' },
                        { key: 'S', label: 'S', color: '#f59e0b' }
                    ]
                }
            ]);
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleAddColumn = () => {
        const newKey = `col_${Date.now()}`;
        setColumns([
            ...columns,
            {
                key: newKey,
                label: `Columna ${columns.length + 1}`,
                type: 'BOOLEAN_STATUS',
                statusOptions: [
                    { key: 'O', label: 'O', color: '#22c55e' },
                    { key: 'I', label: 'I', color: '#ef4444' },
                    { key: 'S', label: 'S', color: '#f59e0b' }
                ]
            }
        ]);
    };

    const handleRemoveColumn = (index) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const handleColumnChange = (index, field, value) => {
        const updated = [...columns];
        updated[index][field] = value;
        if (field === 'type' && value === 'BOOLEAN_STATUS' && (!updated[index].statusOptions || updated[index].statusOptions.length === 0)) {
            updated[index].statusOptions = [
                { key: 'O', label: 'O', color: '#22c55e' },
                { key: 'I', label: 'I', color: '#ef4444' },
                { key: 'S', label: 'S', color: '#f59e0b' }
            ];
        }
        setColumns(updated);
    };

    const handleAddStatusOption = (colIndex) => {
        const updated = [...columns];
        if (!updated[colIndex].statusOptions) updated[colIndex].statusOptions = [];
        const optNum = updated[colIndex].statusOptions.length + 1;
        updated[colIndex].statusOptions.push({
            key: `E${optNum}`,
            label: `E${optNum}`,
            color: '#3b82f6'
        });
        setColumns(updated);
    };

    const handleRemoveStatusOption = (colIndex, optIndex) => {
        const updated = [...columns];
        updated[colIndex].statusOptions = updated[colIndex].statusOptions.filter((_, i) => i !== optIndex);
        setColumns(updated);
    };

    const handleStatusOptionChange = (colIndex, optIndex, field, value) => {
        const updated = [...columns];
        updated[colIndex].statusOptions[optIndex][field] = value;
        if (field === 'label') {
            updated[colIndex].statusOptions[optIndex].key = value;
        }
        setColumns(updated);
    };

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
            alert('Por favor ingresa un título para la tabla.');
            return;
        }
        if (columns.length === 0) {
            alert('Debes agregar al menos una columna a la tabla.');
            return;
        }
        onSave({
            _id: initialData?._id,
            title: title.trim(),
            description: description.trim(),
            rowType,
            authorizedTeachers,
            groupAssignments,
            columns
        });
    };

    return (
        <div className="ext-modal-overlay">
            <div className="ext-modal-content">
                <div className="ext-modal-header">
                    <h2>{initialData ? '✏️ Configuración de Tabla / Extensión' : '✨ Crear Nueva Tabla / Extensión'}</h2>
                    <button className="ext-modal-close" onClick={onClose}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} className="ext-modal-body">
                    <div className="ext-form-group">
                        <label>Nombre de la Tabla / Extensión *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej. Tablas Matemáticas, Caligrafía, Lectura..."
                            required
                        />
                    </div>

                    <div className="ext-form-group">
                        <label>Descripción u Instrucciones</label>
                        <textarea
                            rows="2"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Descripción opcional del objetivo de esta tabla..."
                        />
                    </div>

                    <div className="ext-form-group">
                        <label>Modo de Evaluación</label>
                        <select value={rowType} onChange={(e) => setRowType(e.target.value)}>
                            <option value="STUDENTS">Evaluación por Alumnos (Aplica a todos los grupos del plantel)</option>
                            <option value="GROUPS">Evaluación General por Grupos del Plantel</option>
                        </select>
                    </div>

                    {/* Teachers Authorization */}
                    <div className="ext-form-group">
                        <label>Profesores Autorizados Globalmente (Evalúan Todos los Grupos)</label>
                        <p className="ext-help-text">Los administradores siempre tienen permiso total. Marca aquí los profesores con permiso global:</p>
                        <div className="ext-teachers-grid">
                            {profesores.map(p => (
                                <label key={p._id} className={`ext-teacher-chip ${authorizedTeachers.includes(p._id) ? 'selected' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={authorizedTeachers.includes(p._id)}
                                        onChange={() => toggleGlobalTeacher(p._id)}
                                    />
                                    <span>{p.nombre}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Per-Group Teacher Assignments */}
                    {rowType === 'STUDENTS' && grupos.length > 0 && (
                        <div className="ext-form-group">
                            <label><FaUserTie /> Asignación de Docente Evaluador por Grupo</label>
                            <p className="ext-help-text">Selecciona qué profesor evaluará cada grupo específico:</p>
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
                                                            {p.nombre.split(' ')[0]}
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

                    <hr className="ext-divider" />

                    <div className="ext-columns-section">
                        <div className="ext-section-header">
                            <h3>📊 Columnas de la Tabla ({columns.length})</h3>
                            <button type="button" className="ext-btn ext-btn-sm ext-btn-outline" onClick={handleAddColumn}>
                                <FaPlus /> Agregar Columna
                            </button>
                        </div>

                        {columns.map((col, idx) => (
                            <div key={idx} className="ext-column-card">
                                <div className="ext-column-card-header">
                                    <span className="ext-col-badge">Columna #{idx + 1}</span>
                                    {columns.length > 1 && (
                                        <button type="button" className="ext-btn-icon text-red" onClick={() => handleRemoveColumn(idx)}>
                                            <FaTrash />
                                        </button>
                                    )}
                                </div>

                                <div className="ext-form-row">
                                    <div className="ext-form-group third">
                                        <label>Encabezado / Periodo</label>
                                        <input
                                            type="text"
                                            value={col.groupHeader || ''}
                                            onChange={(e) => handleColumnChange(idx, 'groupHeader', e.target.value)}
                                            placeholder="Ej. Primer periodo, 1er Trimestre..."
                                        />
                                    </div>
                                    <div className="ext-form-group third">
                                        <label>Nombre de Columna *</label>
                                        <input
                                            type="text"
                                            value={col.label}
                                            onChange={(e) => handleColumnChange(idx, 'label', e.target.value)}
                                            placeholder="Ej. 1, 2, Tabla 1..."
                                            required
                                        />
                                    </div>
                                    <div className="ext-form-group third">
                                        <label>Tipo de Campo</label>
                                        <select value={col.type} onChange={(e) => handleColumnChange(idx, 'type', e.target.value)}>
                                            <option value="BOOLEAN_STATUS">Botón Cíclico (Códigos Cortos)</option>
                                            <option value="TEXT">Texto Libre</option>
                                            <option value="NUMBER">Número (0-10)</option>
                                            <option value="PERCENTAGE">Porcentaje (%)</option>
                                        </select>
                                    </div>
                                </div>

                                {col.type === 'BOOLEAN_STATUS' && (
                                    <div className="ext-status-options-block">
                                        <div className="ext-options-header">
                                            <span>Simbología / Botones del Clic (Letras Cortas):</span>
                                            <button type="button" className="ext-btn-link" onClick={() => handleAddStatusOption(idx)}>
                                                + Nueva Letra/Código
                                            </button>
                                        </div>
                                        {(col.statusOptions || []).map((opt, optIdx) => (
                                            <div key={optIdx} className="ext-status-option-row">
                                                <input
                                                    type="text"
                                                    value={opt.label}
                                                    onChange={(e) => handleStatusOptionChange(idx, optIdx, 'label', e.target.value)}
                                                    placeholder="Letra o código (ej. O, I, S, SÍ, NO)"
                                                    maxLength="4"
                                                    style={{ width: '80px', textTransform: 'uppercase', textAlign: 'center', fontWeight: 'bold' }}
                                                    required
                                                />
                                                <div className="ext-color-picker-wrap">
                                                    <FaPalette className="ext-palette-icon" />
                                                    <input
                                                        type="color"
                                                        value={opt.color || '#22c55e'}
                                                        onChange={(e) => handleStatusOptionChange(idx, optIdx, 'color', e.target.value)}
                                                    />
                                                </div>
                                                <div className="ext-color-presets">
                                                    {COLOR_PRESETS.map(preset => (
                                                        <span
                                                            key={preset.value}
                                                            className={`ext-preset-dot ${opt.color === preset.value ? 'active' : ''}`}
                                                            style={{ backgroundColor: preset.value }}
                                                            onClick={() => handleStatusOptionChange(idx, optIdx, 'color', preset.value)}
                                                            title={preset.name}
                                                        />
                                                    ))}
                                                </div>
                                                {(col.statusOptions || []).length > 1 && (
                                                    <button type="button" className="ext-btn-icon text-red" onClick={() => handleRemoveStatusOption(idx, optIdx)}>
                                                        <FaTrash />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="ext-modal-footer">
                        <button type="button" className="ext-btn ext-btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="ext-btn ext-btn-primary">
                            💾 Guardar Tabla / Extensión
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TableBuilderModal;
