import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaTrash, FaPalette } from 'react-icons/fa';

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
    const [assignedGroupId, setAssignedGroupId] = useState('');
    const [authorizedTeachers, setAuthorizedTeachers] = useState([]);
    const [columns, setColumns] = useState([]);

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title || '');
            setDescription(initialData.description || '');
            setRowType(initialData.rowType || 'STUDENTS');
            setAssignedGroupId(initialData.assignedGroupId?._id || initialData.assignedGroupId || '');
            setAuthorizedTeachers(
                (initialData.authorizedTeachers || []).map(t => typeof t === 'object' ? t._id : t)
            );
            setColumns(initialData.columns ? JSON.parse(JSON.stringify(initialData.columns)) : []);
        } else {
            setTitle('');
            setDescription('');
            setRowType('STUDENTS');
            setAssignedGroupId(grupos.length > 0 ? grupos[0]._id : '');
            setAuthorizedTeachers([]);
            setColumns([
                {
                    key: 'col_1',
                    label: 'Criterio 1',
                    type: 'BOOLEAN_STATUS',
                    statusOptions: [
                        { key: 'SI', label: 'SÍ', color: '#22c55e' },
                        { key: 'NO', label: 'NO', color: '#ef4444' }
                    ]
                }
            ]);
        }
    }, [initialData, isOpen, grupos]);

    if (!isOpen) return null;

    const handleAddColumn = () => {
        const newKey = `col_${Date.now()}`;
        setColumns([
            ...columns,
            {
                key: newKey,
                label: `Nueva Columna ${columns.length + 1}`,
                type: 'BOOLEAN_STATUS',
                statusOptions: [
                    { key: 'SI', label: 'SÍ', color: '#22c55e' },
                    { key: 'NO', label: 'NO', color: '#ef4444' }
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
                { key: 'SI', label: 'SÍ', color: '#22c55e' },
                { key: 'NO', label: 'NO', color: '#ef4444' }
            ];
        }
        setColumns(updated);
    };

    const handleAddStatusOption = (colIndex) => {
        const updated = [...columns];
        if (!updated[colIndex].statusOptions) updated[colIndex].statusOptions = [];
        const optNum = updated[colIndex].statusOptions.length + 1;
        updated[colIndex].statusOptions.push({
            key: `opt_${optNum}`,
            label: `Estado ${optNum}`,
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

    const toggleTeacher = (teacherId) => {
        if (authorizedTeachers.includes(teacherId)) {
            setAuthorizedTeachers(authorizedTeachers.filter(id => id !== teacherId));
        } else {
            setAuthorizedTeachers([...authorizedTeachers, teacherId]);
        }
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
            assignedGroupId: rowType === 'STUDENTS' ? assignedGroupId : null,
            authorizedTeachers,
            columns
        });
    };

    return (
        <div className="ext-modal-overlay">
            <div className="ext-modal-content">
                <div className="ext-modal-header">
                    <h2>{initialData ? '✏️ Editar Tabla / Extensión' : '✨ Crear Nueva Tabla / Extensión'}</h2>
                    <button className="ext-modal-close" onClick={onClose}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} className="ext-modal-body">
                    <div className="ext-form-group">
                        <label>Título de la Tabla *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej. Caligrafía, Reflexión Serena, PMC, Lectura..."
                            required
                        />
                    </div>

                    <div className="ext-form-group">
                        <label>Descripción u Instrucciones</label>
                        <textarea
                            rows="2"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Breve descripción del propósito de esta tabla..."
                        />
                    </div>

                    <div className="ext-form-row">
                        <div className="ext-form-group half">
                            <label>Tipo de Filas *</label>
                            <select value={rowType} onChange={(e) => setRowType(e.target.value)}>
                                <option value="STUDENTS">Filas por Alumnos de un Grupo</option>
                                <option value="GROUPS">Filas por Grupos del Plantel</option>
                            </select>
                        </div>

                        {rowType === 'STUDENTS' && (
                            <div className="ext-form-group half">
                                <label>Grupo Asignado *</label>
                                <select value={assignedGroupId} onChange={(e) => setAssignedGroupId(e.target.value)} required>
                                    <option value="">-- Seleccionar Grupo --</option>
                                    {grupos.map(g => (
                                        <option key={g._id} value={g._id}>{g.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="ext-form-group">
                        <label>Profesores Encargados de Editar (RBAC)</label>
                        <p className="ext-help-text">Los administradores siempre tienen permiso. Selecciona qué profesores pueden capturar datos en esta tabla:</p>
                        <div className="ext-teachers-grid">
                            {profesores.map(p => (
                                <label key={p._id} className={`ext-teacher-chip ${authorizedTeachers.includes(p._id) ? 'selected' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={authorizedTeachers.includes(p._id)}
                                        onChange={() => toggleTeacher(p._id)}
                                    />
                                    <span>{p.nombre} ({p.role})</span>
                                </label>
                            ))}
                        </div>
                    </div>

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
                                    <div className="ext-form-group half">
                                        <label>Nombre de Columna *</label>
                                        <input
                                            type="text"
                                            value={col.label}
                                            onChange={(e) => handleColumnChange(idx, 'label', e.target.value)}
                                            placeholder="Ej. Septiembre, Calificación, Dificultad..."
                                            required
                                        />
                                    </div>
                                    <div className="ext-form-group half">
                                        <label>Tipo de Campo</label>
                                        <select value={col.type} onChange={(e) => handleColumnChange(idx, 'type', e.target.value)}>
                                            <option value="BOOLEAN_STATUS">Botón Cíclico (Estados con Color)</option>
                                            <option value="TEXT">Texto Libre</option>
                                            <option value="NUMBER">Número</option>
                                            <option value="PERCENTAGE">Porcentaje (%)</option>
                                        </select>
                                    </div>
                                </div>

                                {col.type === 'BOOLEAN_STATUS' && (
                                    <div className="ext-status-options-block">
                                        <div className="ext-options-header">
                                            <span>Opciones del Clic Cíclico:</span>
                                            <button type="button" className="ext-btn-link" onClick={() => handleAddStatusOption(idx)}>
                                                + Nueva Opción
                                            </button>
                                        </div>
                                        {(col.statusOptions || []).map((opt, optIdx) => (
                                            <div key={optIdx} className="ext-status-option-row">
                                                <input
                                                    type="text"
                                                    value={opt.label}
                                                    onChange={(e) => handleStatusOptionChange(idx, optIdx, 'label', e.target.value)}
                                                    placeholder="Etiqueta (ej. SÍ, NO, En orden)"
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
