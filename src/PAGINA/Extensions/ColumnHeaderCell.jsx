import React, { useState, useRef, useEffect } from 'react';
import {
    FaEllipsisV, FaEdit, FaFont, FaHashtag, FaPercent,
    FaToggleOn, FaCopy, FaTrash, FaPlus, FaCheck, FaTimes
} from 'react-icons/fa';

const ColumnHeaderCell = ({
    col,
    canEdit,
    onRename,
    onChangeType,
    onDuplicate,
    onDelete,
    onUpdateStatusOptions
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState(col.label || '');
    const [showCyclicPanel, setShowCyclicPanel] = useState(col.type === 'BOOLEAN_STATUS');
    const [statusOptions, setStatusOptions] = useState(col.statusOptions || []);

    const menuRef = useRef(null);

    // Sync state when col props update
    useEffect(() => {
        setLabelInput(col.label || '');
        setStatusOptions(col.statusOptions || []);
        setShowCyclicPanel(col.type === 'BOOLEAN_STATUS');
    }, [col]);

    // Close popover on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSaveLabel = () => {
        if (labelInput.trim() && labelInput.trim() !== col.label) {
            onRename(col.key, labelInput.trim());
        }
        setIsEditingLabel(false);
    };

    const handleKeyDownLabel = (e) => {
        if (e.key === 'Enter') handleSaveLabel();
        if (e.key === 'Escape') {
            setLabelInput(col.label || '');
            setIsEditingLabel(false);
        }
    };

    const handleSelectType = (newType) => {
        onChangeType(col.key, newType);
        if (newType === 'BOOLEAN_STATUS') {
            setShowCyclicPanel(true);
        } else {
            setShowCyclicPanel(false);
            setIsOpen(false);
        }
    };

    const handleOptionChange = (optIdx, field, val) => {
        const updated = statusOptions.map((opt, i) => i === optIdx ? { ...opt, [field]: val } : opt);
        setStatusOptions(updated);
    };

    const handleAddOption = () => {
        const newOpt = { key: `OPT_${Date.now()}`, label: 'N', color: '#22c55e' };
        const updated = [...statusOptions, newOpt];
        setStatusOptions(updated);
    };

    const handleRemoveOption = (optIdx) => {
        const updated = statusOptions.filter((_, i) => i !== optIdx);
        setStatusOptions(updated);
    };

    const handleSaveStatusOptions = () => {
        if (onUpdateStatusOptions) {
            onUpdateStatusOptions(col.key, statusOptions);
        }
        setIsOpen(false);
    };

    return (
        <th className="ext-col-header" style={{ position: 'relative' }}>
            <div className="ext-col-header-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px' }}>
                {isEditingLabel ? (
                    <input
                        type="text"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        onBlur={handleSaveLabel}
                        onKeyDown={handleKeyDownLabel}
                        className="ext-inline-header-input"
                        style={{ width: '100%', textAlign: 'center', fontWeight: 'bold' }}
                        autoFocus
                    />
                ) : (
                    <span
                        onClick={() => canEdit && setIsEditingLabel(true)}
                        className="ext-col-title-clickable"
                        style={{ cursor: canEdit ? 'pointer' : 'default', flex: 1, textAlign: 'center' }}
                        title={canEdit ? 'Clic para renombrar' : col.label}
                    >
                        {col.label}
                    </span>
                )}

                {canEdit && (
                    <div ref={menuRef} style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className="ext-col-menu-btn-icon"
                            style={{
                                background: isOpen ? 'rgba(0, 203, 203, 0.2)' : 'transparent',
                                border: 'none',
                                color: isOpen ? '#00cbcb' : '#94a3b8',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Opciones de columna"
                        >
                            <FaEllipsisV style={{ fontSize: '0.85rem' }} />
                        </button>

                        {/* FLOATING CARD DROPDOWN MENU */}
                        {isOpen && (
                            <div className="ext-col-dropdown-floating">
                                <div className="ext-dropdown-title-bar">
                                    <span>⚙️ Configurar Columna</span>
                                    <span style={{ color: '#00cbcb', fontWeight: 'bold' }}>{col.label}</span>
                                </div>

                                {/* Option: Rename */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditingLabel(true);
                                        setIsOpen(false);
                                    }}
                                    className="ext-dropdown-item-btn"
                                >
                                    <FaEdit style={{ color: '#00cbcb' }} />
                                    <span>Renombrar Etiqueta</span>
                                </button>

                                <div className="ext-dropdown-divider" />

                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', margin: '4px 0 2px 4px' }}>
                                    Tipo de Campo:
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleSelectType('TEXT')}
                                    className={`ext-dropdown-item-btn ${col.type === 'TEXT' ? 'active' : ''}`}
                                >
                                    <FaFont style={{ color: '#60a5fa' }} />
                                    <span>Texto / Nota</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectType('NUMBER')}
                                    className={`ext-dropdown-item-btn ${col.type === 'NUMBER' ? 'active' : ''}`}
                                >
                                    <FaHashtag style={{ color: '#fbbf24' }} />
                                    <span>Numérico / Calificación</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectType('PERCENTAGE')}
                                    className={`ext-dropdown-item-btn ${col.type === 'PERCENTAGE' ? 'active' : ''}`}
                                >
                                    <FaPercent style={{ color: '#c084fc' }} />
                                    <span>Porcentaje (%)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectType('BOOLEAN_STATUS')}
                                    className={`ext-dropdown-item-btn ${col.type === 'BOOLEAN_STATUS' ? 'active' : ''}`}
                                >
                                    <FaToggleOn style={{ color: '#34d399' }} />
                                    <span>Botón Cíclico (Códigos Cortos)</span>
                                </button>

                                {/* Mini Subpanel for Cyclic Button Symbology */}
                                {showCyclicPanel && (
                                    <div className="ext-cyclic-subbox">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#00cbcb' }}>
                                            <span>Simbología / Colores:</span>
                                            <button
                                                type="button"
                                                onClick={handleAddOption}
                                                style={{ background: 'transparent', border: 'none', color: '#00cbcb', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                            >
                                                <FaPlus style={{ fontSize: '0.65rem' }} /> Agregar
                                            </button>
                                        </div>

                                        <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {statusOptions.map((opt, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', padding: '4px 6px', borderRadius: '6px', border: '1px solid #334155' }}>
                                                    <input
                                                        type="text"
                                                        maxLength="3"
                                                        value={opt.label || opt.key}
                                                        onChange={(e) => handleOptionChange(idx, 'label', e.target.value.toUpperCase())}
                                                        style={{ width: '36px', background: '#0f172a', color: '#ffffff', textAlign: 'center', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #475569', fontSize: '0.8rem', textTransform: 'uppercase' }}
                                                        placeholder="S"
                                                    />
                                                    <input
                                                        type="color"
                                                        value={opt.color || '#22c55e'}
                                                        onChange={(e) => handleOptionChange(idx, 'color', e.target.value)}
                                                        style={{ width: '26px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                                    />
                                                    {statusOptions.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveOption(idx)}
                                                            style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '1rem', cursor: 'pointer', marginLeft: 'auto' }}
                                                            title="Eliminar opción"
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSaveStatusOptions}
                                            style={{ width: '100%', background: '#00cbcb', color: '#0f172a', fontWeight: 'bold', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}
                                        >
                                            <FaCheck /> Aplicar Simbología
                                        </button>
                                    </div>
                                )}

                                <div className="ext-dropdown-divider" />

                                {/* Option: Duplicate */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        onDuplicate(col.key);
                                        setIsOpen(false);
                                    }}
                                    className="ext-dropdown-item-btn"
                                >
                                    <FaCopy style={{ color: '#94a3b8' }} />
                                    <span>Duplicar Columna</span>
                                </button>

                                {/* Option: Delete */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        onDelete(col.key);
                                        setIsOpen(false);
                                    }}
                                    className="ext-dropdown-item-btn danger"
                                >
                                    <FaTrash style={{ color: '#ef4444' }} />
                                    <span>Eliminar Columna</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </th>
    );
};

export default ColumnHeaderCell;
