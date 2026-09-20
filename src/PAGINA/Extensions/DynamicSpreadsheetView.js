import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaSearch, FaLock, FaCheckCircle, FaSpinner, FaUserClock, FaUserTimes, FaSync, FaExclamationTriangle } from 'react-icons/fa';
import apiClient from '../../api/apiClient';
import './Extensions.css';

const DynamicSpreadsheetView = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [template, setTemplate] = useState(null);
    const [rows, setRows] = useState([]);
    const [canEdit, setCanEdit] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [savingCellKey, setSavingCellKey] = useState(null);
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, NUEVO_INGRESO, BAJA, REZAGO

    const fetchExtensionData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get(`/api/extensions/${id}`);
            setTemplate(res.data.template);
            setRows(res.data.rows);
            setCanEdit(res.data.canEdit);
        } catch (err) {
            console.error('Error al cargar extensión:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchExtensionData();
    }, [fetchExtensionData]);

    const handleCellChange = async (rowEntityId, colKey, newValue, rowEntityName) => {
        if (!canEdit) return;

        // Optimistic update local state
        setRows(prevRows => prevRows.map(row => {
            if (row.entityId === rowEntityId) {
                return {
                    ...row,
                    data: {
                        ...row.data,
                        [colKey]: newValue
                    }
                };
            }
            return row;
        }));

        const cellKey = `${rowEntityId}_${colKey}`;
        setSavingCellKey(cellKey);

        try {
            await apiClient.patch(`/api/extensions/${id}/cell`, {
                rowEntityId,
                colKey,
                value: newValue,
                rowEntityName
            });
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err) {
            console.error('Error al guardar celda:', err);
            // Revert state on failure
            fetchExtensionData();
        } finally {
            setSavingCellKey(null);
        }
    };

    const handleCycleStatus = (rowEntityId, column, currentValue, rowEntityName) => {
        if (!canEdit) return;
        const options = column.statusOptions || [];
        if (options.length === 0) return;

        let nextValue = '';
        const currentIdx = options.findIndex(opt => opt.key === currentValue || opt.label === currentValue);

        if (currentIdx === -1) {
            nextValue = options[0].key;
        } else if (currentIdx === options.length - 1) {
            nextValue = ''; // Clear value on cycle end
        } else {
            nextValue = options[currentIdx + 1].key;
        }

        handleCellChange(rowEntityId, column.key, nextValue, rowEntityName);
    };

    const handleRowColorTagChange = async (rowEntityId, colorTag, rowEntityName) => {
        if (!canEdit) return;

        setRows(prevRows => prevRows.map(row => {
            if (row.entityId === rowEntityId) {
                return { ...row, rowColorTag: colorTag };
            }
            return row;
        }));

        try {
            await apiClient.patch(`/api/extensions/${id}/cell`, {
                rowEntityId,
                rowColorTag: colorTag,
                rowEntityName
            });
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err) {
            console.error('Error al actualizar color de fila:', err);
        }
    };

    if (loading) {
        return (
            <div className="ext-loading-container">
                <FaSpinner className="ext-spinner" />
                <p>Cargando matriz de extensión...</p>
            </div>
        );
    }

    if (!template) {
        return (
            <div className="ext-container">
                <h2>Tabla o Extensión no encontrada</h2>
                <button className="ext-btn ext-btn-primary" onClick={() => navigate('/extensiones')}>
                    Volver a Extensiones
                </button>
            </div>
        );
    }

    const filteredRows = rows.filter(row => {
        const matchesSearch = row.name.toLowerCase().includes(searchTerm.toLowerCase());

        if (filterStatus === 'NUEVO_INGRESO') {
            return matchesSearch && row.esNuevoIngreso;
        }
        if (filterStatus === 'BAJA') {
            return matchesSearch && row.esBaja;
        }
        if (filterStatus === 'REZAGO') {
            return matchesSearch && (row.rowColorTag === '#fca5a5' || row.rowColorTag === '#fef08a');
        }
        return matchesSearch;
    });

    return (
        <div className="ext-spreadsheet-page">
            {/* Top Toolbar Header */}
            <div className="ext-sheet-header">
                <div className="ext-sheet-header-left">
                    <button className="ext-btn-back" onClick={() => navigate('/extensiones')}>
                        <FaArrowLeft /> Extensiones
                    </button>
                    <div>
                        <h1 className="ext-sheet-title">{template.title}</h1>
                        <p className="ext-sheet-subtitle">
                            {template.rowType === 'STUDENTS' ? (
                                <span>Grupo: <strong>{template.assignedGroupId?.nombre || 'General'}</strong></span>
                            ) : (
                                <span>Matriz General por Grupos del Plantel</span>
                            )}
                            {template.description && <span> • {template.description}</span>}
                        </p>
                    </div>
                </div>

                <div className="ext-sheet-header-right">
                    {canEdit ? (
                        <div className="ext-badge-status status-editable">
                            <FaSync className="ext-pulse-icon" /> Modo Edición Activo
                        </div>
                    ) : (
                        <div className="ext-badge-status status-readonly">
                            <FaLock /> Solo Lectura (Preview)
                        </div>
                    )}

                    {lastSavedTime && (
                        <span className="ext-last-saved">
                            <FaCheckCircle className="text-green" /> Guardado {lastSavedTime}
                        </span>
                    )}
                </div>
            </div>

            {!canEdit && (
                <div className="ext-notice-banner">
                    <FaLock />
                    <span>
                        <strong>Vista Previa en Solo Lectura:</strong> No estás asignado como profesor responsable de esta tabla/grupo. Puedes consultar los avances pero no modificar celdas.
                    </span>
                </div>
            )}

            {/* Filter and Search Bar */}
            <div className="ext-controls-bar">
                <div className="ext-search-box">
                    <FaSearch className="ext-search-icon" />
                    <input
                        type="text"
                        placeholder={template.rowType === 'STUDENTS' ? 'Buscar alumno por nombre...' : 'Buscar grupo...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {template.rowType === 'STUDENTS' && (
                    <div className="ext-filter-pills">
                        <button
                            className={`ext-filter-pill ${filterStatus === 'ALL' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('ALL')}
                        >
                            Todos ({rows.length})
                        </button>
                        <button
                            className={`ext-filter-pill yellow ${filterStatus === 'NUEVO_INGRESO' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('NUEVO_INGRESO')}
                        >
                            <FaUserClock /> Nuevos Ingresos ({rows.filter(r => r.esNuevoIngreso).length})
                        </button>
                        <button
                            className={`ext-filter-pill red ${filterStatus === 'BAJA' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('BAJA')}
                        >
                            <FaUserTimes /> Bajas ({rows.filter(r => r.esBaja).length})
                        </button>
                        <button
                            className={`ext-filter-pill warning ${filterStatus === 'REZAGO' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('REZAGO')}
                        >
                            <FaExclamationTriangle /> Con Rezago/Alerta ({rows.filter(r => r.rowColorTag === '#fca5a5' || r.rowColorTag === '#fef08a').length})
                        </button>
                    </div>
                )}
            </div>

            {/* Spreadsheet Matrix Table */}
            <div className="ext-table-container">
                <table className="ext-spreadsheet-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ minWidth: '220px' }}>
                                {template.rowType === 'STUDENTS' ? 'Alumno' : 'Grupo / Plantel'}
                            </th>
                            {template.columns.map((col) => (
                                <th key={col.key} className="ext-col-header">
                                    <div className="ext-col-title">{col.label}</div>
                                    <div className="ext-col-type-tag">
                                        {col.type === 'BOOLEAN_STATUS' && 'Botón Clic'}
                                        {col.type === 'TEXT' && 'Texto'}
                                        {col.type === 'NUMBER' && 'Número'}
                                        {col.type === 'PERCENTAGE' && 'Porcentaje'}
                                    </div>
                                </th>
                            ))}
                            {canEdit && <th style={{ width: '130px' }}>Marcador / Alerta</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={template.columns.length + (canEdit ? 3 : 2)} className="ext-empty-td">
                                    No se encontraron registros que coincidan con la búsqueda.
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row, idx) => {
                                const rowBg = row.rowColorTag || (row.esBaja ? '#fee2e2' : row.esNuevoIngreso ? '#fef9c3' : 'transparent');
                                const isRowSaving = savingCellKey && savingCellKey.startsWith(row.entityId);

                                return (
                                    <tr
                                        key={row.entityId}
                                        style={{ backgroundColor: rowBg }}
                                        className={`${row.esBaja ? 'row-baja' : ''} ${row.esNuevoIngreso ? 'row-nuevo-ingreso' : ''}`}
                                    >
                                        <td className="ext-cell-idx">{idx + 1}</td>
                                        <td className="ext-cell-name">
                                            <div className="ext-student-name-box">
                                                <span className={`ext-name-text ${row.esBaja ? 'line-through' : ''}`}>
                                                    {row.name}
                                                </span>

                                                {row.esNuevoIngreso && (
                                                    <span className="ext-tag tag-yellow" title={row.fechaIngreso ? `Ingresó: ${row.fechaIngreso}` : 'Nuevo Ingreso'}>
                                                        <FaUserClock /> Nuevo {row.fechaIngreso && `(${row.fechaIngreso})`}
                                                    </span>
                                                )}

                                                {row.esBaja && (
                                                    <span className="ext-tag tag-red" title={row.fechaBaja ? `Baja: ${row.fechaBaja}` : 'Dado de baja'}>
                                                        <FaUserTimes /> Baja {row.fechaBaja && `(${row.fechaBaja})`}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {template.columns.map((col) => {
                                            const cellVal = row.data[col.key] || '';
                                            const isSavingThis = savingCellKey === `${row.entityId}_${col.key}`;

                                            return (
                                                <td key={col.key} className="ext-cell-interactive">
                                                    {col.type === 'BOOLEAN_STATUS' && (
                                                        <button
                                                            type="button"
                                                            disabled={!canEdit}
                                                            className="ext-status-pill-btn"
                                                            onClick={() => handleCycleStatus(row.entityId, col, cellVal, row.name)}
                                                            style={getStatusPillStyle(col, cellVal)}
                                                        >
                                                            {isSavingThis ? (
                                                                <FaSpinner className="ext-spinner-sm" />
                                                            ) : (
                                                                getStatusLabel(col, cellVal)
                                                            )}
                                                        </button>
                                                    )}

                                                    {col.type === 'TEXT' && (
                                                        <input
                                                            type="text"
                                                            disabled={!canEdit}
                                                            className="ext-cell-input"
                                                            defaultValue={cellVal}
                                                            placeholder="—"
                                                            onBlur={(e) => {
                                                                if (e.target.value !== cellVal) {
                                                                    handleCellChange(row.entityId, col.key, e.target.value, row.name);
                                                                }
                                                            }}
                                                        />
                                                    )}

                                                    {col.type === 'NUMBER' && (
                                                        <input
                                                            type="number"
                                                            disabled={!canEdit}
                                                            className="ext-cell-input number"
                                                            defaultValue={cellVal}
                                                            placeholder="0"
                                                            onBlur={(e) => {
                                                                if (e.target.value !== cellVal) {
                                                                    handleCellChange(row.entityId, col.key, e.target.value, row.name);
                                                                }
                                                            }}
                                                        />
                                                    )}

                                                    {col.type === 'PERCENTAGE' && (
                                                        <div className="ext-percentage-input-wrap">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                disabled={!canEdit}
                                                                className="ext-cell-input number"
                                                                defaultValue={cellVal}
                                                                placeholder="0"
                                                                onBlur={(e) => {
                                                                    if (e.target.value !== cellVal) {
                                                                        handleCellChange(row.entityId, col.key, e.target.value, row.name);
                                                                    }
                                                                }}
                                                            />
                                                            <span className="ext-pct-symbol">%</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}

                                        {canEdit && (
                                            <td className="ext-cell-actions">
                                                <div className="ext-color-tag-picker">
                                                    <button
                                                        type="button"
                                                        className={`ext-color-dot ${row.rowColorTag === '' ? 'active' : ''}`}
                                                        style={{ backgroundColor: '#e5e7eb' }}
                                                        title="Sin Resaltar"
                                                        onClick={() => handleRowColorTagChange(row.entityId, '', row.name)}
                                                    />
                                                    <button
                                                        type="button"
                                                        className={`ext-color-dot ${row.rowColorTag === '#fef08a' ? 'active' : ''}`}
                                                        style={{ backgroundColor: '#fef08a' }}
                                                        title="Resaltar Amarillo (Atención)"
                                                        onClick={() => handleRowColorTagChange(row.entityId, '#fef08a', row.name)}
                                                    />
                                                    <button
                                                        type="button"
                                                        className={`ext-color-dot ${row.rowColorTag === '#fca5a5' ? 'active' : ''}`}
                                                        style={{ backgroundColor: '#fca5a5' }}
                                                        title="Resaltar Rojo (Urgente / Rezago)"
                                                        onClick={() => handleRowColorTagChange(row.entityId, '#fca5a5', row.name)}
                                                    />
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Helper for status pill style
const getStatusPillStyle = (column, value) => {
    if (!value) return { backgroundColor: 'transparent', color: '#9ca3af', border: '1px dashed #d1d5db' };
    const options = column.statusOptions || [];
    const opt = options.find(o => o.key === value || o.label === value);
    const color = opt ? opt.color : '#3b82f6';
    return {
        backgroundColor: color,
        color: '#ffffff',
        border: `1px solid ${color}`,
        fontWeight: 'bold'
    };
};

// Helper for status pill label
const getStatusLabel = (column, value) => {
    if (!value) return '—';
    const options = column.statusOptions || [];
    const opt = options.find(o => o.key === value || o.label === value);
    return opt ? opt.label : value;
};

export default DynamicSpreadsheetView;
