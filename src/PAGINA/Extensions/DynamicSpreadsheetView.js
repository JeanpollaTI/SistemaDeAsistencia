import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaSearch, FaLock, FaCheckCircle, FaSpinner, FaUserClock, FaUserTimes, FaSync, FaExclamationTriangle, FaInfoCircle, FaThList, FaPlus } from 'react-icons/fa';
import apiClient from '../../api/apiClient';
import './Extensions.css';

const DynamicSpreadsheetView = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [template, setTemplate] = useState(null);
    const [rows, setRows] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [canEdit, setCanEdit] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [savingCellKey, setSavingCellKey] = useState(null);
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [filterStatus, setFilterStatus] = useState('ALL');

    const selectedGroupRef = useRef(selectedGroup);
    selectedGroupRef.current = selectedGroup;

    const fetchExtensionData = useCallback(async (targetGroupId = null, isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const activeGroupId = targetGroupId || (selectedGroupRef.current ? selectedGroupRef.current._id : null);
            const url = activeGroupId ? `/api/extensions/${id}?groupId=${activeGroupId}` : `/api/extensions/${id}`;

            const res = await apiClient.get(url);
            setTemplate(res.data.template);
            setRows(res.data.rows || []);
            setGroups(res.data.groups || []);
            setSelectedGroup(res.data.selectedGroup || null);
            setCanEdit(res.data.canEdit);
        } catch (err) {
            console.error('Error al cargar extensión:', err);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchExtensionData();
    }, [fetchExtensionData]);

    // Background auto-sync polling every 12 seconds for multi-user consistency
    useEffect(() => {
        const interval = setInterval(() => {
            if (!savingCellKey) {
                fetchExtensionData(null, true);
            }
        }, 12000);
        return () => clearInterval(interval);
    }, [fetchExtensionData, savingCellKey]);

    const handleSelectGroupTab = (groupId) => {
        if (selectedGroup && selectedGroup._id === groupId) return;
        fetchExtensionData(groupId);
    };

    const handleCellChange = async (rowEntityId, colKey, newValue, rowEntityName) => {
        if (!canEdit) return;

        // Optimistic update
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
                groupId: selectedGroup?._id || null,
                colKey,
                value: newValue,
                rowEntityName
            });
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err) {
            console.error('Error al guardar celda:', err);
            fetchExtensionData(selectedGroup?._id, true);
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
            nextValue = ''; // Reset to empty
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
                groupId: selectedGroup?._id || null,
                rowColorTag: colorTag,
                rowEntityName
            });
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err) {
            console.error('Error al actualizar color de fila:', err);
        }
    };

    const handleRenameColumn = async (colKey, currentLabel) => {
        if (!canEdit) return;
        const newLabel = window.prompt(`Cambiar etiqueta de la columna (${currentLabel}):`, currentLabel);
        if (!newLabel || newLabel.trim() === '' || newLabel.trim() === currentLabel) return;

        try {
            await apiClient.patch(`/api/extensions/${id}/column-label`, {
                colKey,
                newLabel: newLabel.trim()
            });
            fetchExtensionData(selectedGroup?._id, true);
        } catch (err) {
            console.error('Error al renombrar columna:', err);
            alert('Error al renombrar columna');
        }
    };

    const handleAddNewColumn = async (targetGroupHeader = 'Primer periodo') => {
        if (!canEdit) return;
        const label = window.prompt(`Etiqueta para la nueva columna en "${targetGroupHeader}" (ej. 6, 7, Extra):`, '');
        if (label === null) return;

        try {
            await apiClient.post(`/api/extensions/${id}/add-column`, {
                label: label.trim(),
                groupHeader: targetGroupHeader,
                type: 'BOOLEAN_STATUS'
            });
            fetchExtensionData(selectedGroup?._id, true);
        } catch (err) {
            console.error('Error al agregar columna:', err);
            alert('Error al agregar columna');
        }
    };

    if (loading) {
        return (
            <div className="ext-loading-container">
                <FaSpinner className="ext-spinner" />
                <p>Cargando matriz de datos...</p>
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

    // Filter rows based on search & status pill
    const filteredRows = rows.filter(row => {
        const matchesSearch = row.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (filterStatus === 'NUEVO_INGRESO') return matchesSearch && row.esNuevoIngreso;
        if (filterStatus === 'BAJA') return matchesSearch && row.esBaja;
        if (filterStatus === 'REZAGO') return matchesSearch && (row.rowColorTag === '#fca5a5' || row.rowColorTag === '#fef08a');
        return matchesSearch;
    });

    // Extract status options for top legend bar
    const booleanCols = template.columns.filter(c => c.type === 'BOOLEAN_STATUS');
    const legendOptions = booleanCols.length > 0 ? booleanCols[0].statusOptions || [] : [];

    // Calculate grouped headers for two-tier header row (Periodos)
    const hasGroupHeaders = template.columns.some(c => c.groupHeader && c.groupHeader.trim() !== '');
    const groupedHeaders = [];
    if (hasGroupHeaders) {
        let currentHeader = null;
        let currentSpan = 0;
        template.columns.forEach(col => {
            const gh = col.groupHeader || '';
            if (gh === currentHeader) {
                currentSpan++;
            } else {
                if (currentHeader !== null) {
                    groupedHeaders.push({ title: currentHeader, colSpan: currentSpan });
                }
                currentHeader = gh;
                currentSpan = 1;
            }
        });
        if (currentHeader !== null) {
            groupedHeaders.push({ title: currentHeader, colSpan: currentSpan });
        }
    }

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
                                <span>Grupo Seleccionado: <strong>{selectedGroup ? selectedGroup.nombre : 'General'}</strong></span>
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
                            <FaSync className="ext-pulse-icon" /> Modo Edición (Grupo {selectedGroup?.nombre || ''})
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

            {/* GROUP SELECTION TABS BAR (1A, 1B, 1C... 3E) */}
            {template.rowType === 'STUDENTS' && groups.length > 0 && (
                <div className="ext-groups-tab-bar">
                    <div className="ext-groups-tab-header">
                        <FaThList /> <span>Seleccionar Grupo:</span>
                    </div>
                    <div className="ext-groups-tabs-scroll">
                        {groups.map(g => {
                            const isSelected = selectedGroup && selectedGroup._id === g._id;
                            return (
                                <button
                                    key={g._id}
                                    type="button"
                                    className={`ext-group-tab-btn ${isSelected ? 'active' : ''}`}
                                    onClick={() => handleSelectGroupTab(g._id)}
                                >
                                    {g.nombre}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SYMBOL LEGEND BAR (I: Incompleta, O: En orden, S: Salteadas) */}
            {legendOptions.length > 0 && (
                <div className="ext-legend-bar">
                    <div className="ext-legend-title">
                        <FaInfoCircle /> <span>Simbología de Evaluación:</span>
                    </div>
                    <div className="ext-legend-items">
                        {legendOptions.map(opt => (
                            <div key={opt.key} className="ext-legend-item">
                                <span className="ext-legend-pill" style={{ backgroundColor: opt.color }}>
                                    {opt.label}
                                </span>
                                <span className="ext-legend-desc">
                                    {opt.key === 'I' || opt.label === 'I' ? 'Incompleta 🔴' :
                                     opt.key === 'O' || opt.label === 'O' ? 'En orden 🟢' :
                                     opt.key === 'S' || opt.label === 'S' ? 'Salteadas 🟡' : opt.key}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!canEdit && (
                <div className="ext-notice-banner">
                    <FaLock />
                    <span>
                        <strong>Vista Previa en Solo Lectura:</strong> No estás asignado como profesor evaluador de este grupo ({selectedGroup?.nombre || ''}). Puedes consultar los avances pero no modificar celdas.
                    </span>
                </div>
            )}

            {/* Filter and Search Bar */}
            <div className="ext-controls-bar">
                <div className="ext-search-box">
                    <FaSearch className="ext-search-icon" />
                    <input
                        type="text"
                        placeholder={template.rowType === 'STUDENTS' ? `Buscar en ${selectedGroup?.nombre || 'grupo'}...` : 'Buscar grupo...'}
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
                            <FaUserClock /> Nuevos ({rows.filter(r => r.esNuevoIngreso).length})
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
                            <FaExclamationTriangle /> Con Rezago ({rows.filter(r => r.rowColorTag === '#fca5a5' || r.rowColorTag === '#fef08a').length})
                        </button>
                    </div>
                )}
            </div>

            {/* Spreadsheet Matrix Table */}
            <div className="ext-table-container">
                <table className="ext-spreadsheet-table">
                    <thead>
                        {hasGroupHeaders ? (
                            <>
                                <tr>
                                    <th rowSpan={2} style={{ width: '45px' }}>#</th>
                                    <th rowSpan={2} className="ext-sticky-name-header" style={{ minWidth: '240px' }}>
                                        {template.rowType === 'STUDENTS' ? `NOMBRE DEL ALUMNO (${selectedGroup?.nombre || ''})` : 'GRUPO / PLANTEL'}
                                    </th>
                                    {groupedHeaders.map((gh, gIdx) => (
                                        <th key={gIdx} colSpan={gh.colSpan} className="ext-period-header-cell">
                                            <div className="ext-period-header-inner">
                                                <span>{gh.title || 'General'}</span>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        className="ext-btn-add-period-col"
                                                        onClick={() => handleAddNewColumn(gh.title)}
                                                        title={`Agregar nueva columna a ${gh.title}`}
                                                    >
                                                        <FaPlus /> +
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    {canEdit && <th rowSpan={2} style={{ width: '130px' }}>MARCADOR</th>}
                                </tr>
                                <tr>
                                    {template.columns.map((col) => (
                                        <th
                                            key={col.key}
                                            className={`ext-col-header ${canEdit ? 'editable-col-header' : ''}`}
                                            onClick={() => handleRenameColumn(col.key, col.label)}
                                            title={canEdit ? 'Haz clic para cambiar la etiqueta de esta columna' : ''}
                                        >
                                            <div className="ext-col-title">
                                                {col.label}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </>
                        ) : (
                            <tr>
                                <th style={{ width: '45px' }}>#</th>
                                <th className="ext-sticky-name-header" style={{ minWidth: '240px' }}>
                                    {template.rowType === 'STUDENTS' ? `NOMBRE DEL ALUMNO (${selectedGroup?.nombre || ''})` : 'GRUPO / PLANTEL'}
                                </th>
                                {template.columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={`ext-col-header ${canEdit ? 'editable-col-header' : ''}`}
                                        onClick={() => handleRenameColumn(col.key, col.label)}
                                        title={canEdit ? 'Haz clic para cambiar la etiqueta de esta columna' : ''}
                                    >
                                        <div className="ext-col-title">
                                            {col.label}
                                        </div>
                                    </th>
                                ))}
                                {canEdit && (
                                    <th
                                        className="ext-add-col-header-btn"
                                        onClick={() => handleAddNewColumn('General')}
                                        title="Agregar nueva columna"
                                    >
                                        <FaPlus />
                                    </th>
                                )}
                                {canEdit && <th style={{ width: '130px' }}>MARCADOR</th>}
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={template.columns.length + (canEdit ? 3 : 2)} className="ext-empty-td">
                                    No hay alumnos en el grupo {selectedGroup?.nombre || ''} que coincidan con la búsqueda.
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row, idx) => {
                                const rowBg = row.rowColorTag || (row.esBaja ? '#fee2e2' : row.esNuevoIngreso ? '#fef9c3' : 'transparent');
                                return (
                                    <tr
                                        key={row.entityId}
                                        style={{ backgroundColor: rowBg }}
                                        className={`${row.esBaja ? 'row-baja' : ''} ${row.esNuevoIngreso ? 'row-nuevo-ingreso' : ''}`}
                                    >
                                        <td className="ext-cell-idx">{idx + 1}</td>
                                        <td className="ext-cell-name ext-sticky-name-cell">
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
    if (!value) return { backgroundColor: 'transparent', color: '#9ca3af', border: '1px dashed #cbd5e1' };
    const options = column.statusOptions || [];
    const opt = options.find(o => o.key === value || o.label === value);
    const color = opt ? opt.color : (value === 'I' ? '#ef4444' : value === 'O' ? '#22c55e' : value === 'S' ? '#f59e0b' : '#3b82f6');
    return {
        backgroundColor: color,
        color: '#ffffff',
        border: `1px solid ${color}`,
        fontWeight: 'bold',
        fontSize: '0.9rem'
    };
};

// Helper for status pill label
const getStatusLabel = (column, value) => {
    if (!value) return '—';
    const options = column.statusOptions || [];
    const opt = options.find(o => o.key === value || o.label === value);
    if (opt) return opt.label;
    if (value === 'En orden') return 'O';
    if (value === 'Incompleta') return 'I';
    if (value === 'Salteadas') return 'S';
    return value;
};

export default DynamicSpreadsheetView;
