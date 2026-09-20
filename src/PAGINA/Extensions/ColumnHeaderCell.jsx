import React, { useState, useRef, useEffect } from 'react';
import {
    FaEllipsisV, FaEdit, FaFont, FaHashtag, FaPercent,
    FaToggleOn, FaCopy, FaTrash, FaPlus, FaCheck
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

    // Sync label input when col changes
    useEffect(() => {
        setLabelInput(col.label || '');
        setStatusOptions(col.statusOptions || []);
        setShowCyclicPanel(col.type === 'BOOLEAN_STATUS');
    }, [col]);

    // Close menu when clicking outside
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
        <th className="ext-col-header relative border-r border-b border-slate-800 bg-slate-900/90 text-slate-200 p-2 select-none group">
            <div className="flex items-center justify-between gap-1">
                {isEditingLabel ? (
                    <input
                        type="text"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        onBlur={handleSaveLabel}
                        onKeyDown={handleKeyDownLabel}
                        className="bg-slate-950 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/80 outline-none text-xs w-full text-center shadow-inner"
                        autoFocus
                    />
                ) : (
                    <span
                        onClick={() => canEdit && setIsEditingLabel(true)}
                        className={`font-semibold text-xs text-slate-200 text-center flex-1 truncate ${canEdit ? 'cursor-pointer hover:text-cyan-400 transition-colors' : ''}`}
                        title={canEdit ? 'Clic para renombrar' : col.label}
                    >
                        {col.label}
                    </span>
                )}

                {canEdit && (
                    <div ref={menuRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 rounded transition-colors outline-none"
                            title="Opciones de columna"
                        >
                            <FaEllipsisV className="w-3 h-3" />
                        </button>

                        {/* POPOVER DROPDOWN MENU (Tailwind Clean Dark Theme) */}
                        {isOpen && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-2.5 min-w-[230px] text-xs backdrop-blur-md text-slate-200 text-left animate-in fade-in zoom-in-95 duration-150">
                                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase px-2 py-1 mb-1 border-b border-slate-800 flex justify-between items-center">
                                    <span>Configuración</span>
                                    <span className="text-cyan-400 font-normal truncate max-w-[90px]">{col.label}</span>
                                </div>

                                {/* Option: Rename */}
                                <button
                                    onClick={() => {
                                        setIsEditingLabel(true);
                                        setIsOpen(false);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1.5 text-left rounded-lg text-slate-300 hover:bg-slate-800 hover:text-cyan-300 transition-colors"
                                >
                                    <FaEdit className="text-cyan-400" />
                                    <span>Renombrar Etiqueta</span>
                                </button>

                                <div className="my-1.5 border-t border-slate-800/80" />

                                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">
                                    Tipo de Campo:
                                </div>

                                <button
                                    onClick={() => handleSelectType('TEXT')}
                                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-colors ${col.type === 'TEXT' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <FaFont className="text-blue-400" />
                                    <span>Texto / Nota</span>
                                </button>

                                <button
                                    onClick={() => handleSelectType('NUMBER')}
                                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-colors ${col.type === 'NUMBER' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <FaHashtag className="text-amber-400" />
                                    <span>Numérico / Calificación</span>
                                </button>

                                <button
                                    onClick={() => handleSelectType('PERCENTAGE')}
                                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-colors ${col.type === 'PERCENTAGE' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <FaPercent className="text-purple-400" />
                                    <span>Porcentaje (%)</span>
                                </button>

                                <button
                                    onClick={() => handleSelectType('BOOLEAN_STATUS')}
                                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-colors ${col.type === 'BOOLEAN_STATUS' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <FaToggleOn className="text-emerald-400" />
                                    <span>Botón Cíclico (Códigos Cortos)</span>
                                </button>

                                {/* Mini Subpanel for Cyclic Button Symbology */}
                                {showCyclicPanel && (
                                    <div className="mt-2 p-2 bg-slate-950/80 rounded-lg border border-slate-800 flex flex-col gap-2">
                                        <div className="text-[10px] font-bold text-cyan-400 flex items-center justify-between">
                                            <span>Simbología / Colores:</span>
                                            <button
                                                type="button"
                                                onClick={handleAddOption}
                                                className="text-[10px] text-cyan-300 hover:underline flex items-center gap-1"
                                            >
                                                <FaPlus className="w-2 h-2" /> Agregar
                                            </button>
                                        </div>

                                        <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                                            {statusOptions.map((opt, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5 bg-slate-900 p-1 rounded border border-slate-800">
                                                    <input
                                                        type="text"
                                                        maxLength="3"
                                                        value={opt.label || opt.key}
                                                        onChange={(e) => handleOptionChange(idx, 'label', e.target.value.toUpperCase())}
                                                        className="w-9 bg-slate-950 text-center font-bold text-white px-1 py-0.5 rounded border border-slate-700 text-xs uppercase"
                                                        placeholder="S"
                                                    />
                                                    <input
                                                        type="color"
                                                        value={opt.color || '#22c55e'}
                                                        onChange={(e) => handleOptionChange(idx, 'color', e.target.value)}
                                                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                                                    />
                                                    {statusOptions.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveOption(idx)}
                                                            className="text-rose-400 hover:text-rose-300 ml-auto p-1"
                                                            title="Eliminar opción"
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSaveStatusOptions}
                                            className="w-full mt-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold py-1 px-2 rounded text-[11px] flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <FaCheck className="w-3 h-3" /> Aplicar Simbología
                                        </button>
                                    </div>
                                )}

                                <div className="my-1.5 border-t border-slate-800/80" />

                                {/* Option: Duplicate */}
                                <button
                                    onClick={() => {
                                        onDuplicate(col.key);
                                        setIsOpen(false);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1.5 text-left rounded-lg text-slate-300 hover:bg-slate-800 hover:text-cyan-300 transition-colors"
                                >
                                    <FaCopy className="text-slate-400" />
                                    <span>Duplicar Columna</span>
                                </button>

                                {/* Option: Delete */}
                                <button
                                    onClick={() => {
                                        onDelete(col.key);
                                        setIsOpen(false);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1.5 text-left rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors mt-0.5 font-medium"
                                >
                                    <FaTrash className="text-rose-400" />
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
