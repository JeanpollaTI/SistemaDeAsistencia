import React, { useState, useEffect } from 'react';
// import * as XLSX from 'xlsx'; // Removed dependency
import { FaFileExcel, FaCheck, FaTimes, FaExclamationTriangle, FaMagic } from 'react-icons/fa';
import './Calificaciones.css';

export default function ImportModal({ onClose, onImport, materias, alumnos, mode = 'general', criterios = [], numTareas = {}, customTaskNames = {} }) {
    const [sheetData, setSheetData] = useState([]);
    const [headerRowIndex, setHeaderRowIndex] = useState(-1);
    const [headers, setHeaders] = useState([]);

    // Selection States
    const [selectedMateria, setSelectedMateria] = useState('');
    const [selectedTrimestre, setSelectedTrimestre] = useState('0'); // 0, 1, 2 (Indices)

    // Bulk Mapping State (For 'trabajos' mode)
    // Structure: { "Criterio-Index": "ExcelHeaderName" }
    const [columnMapping, setColumnMapping] = useState({});

    const [colName, setColName] = useState('');
    const [colGrade, setColGrade] = useState(''); // For 'general' mode

    // Preview
    const [previewData, setPreviewData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const [pasteData, setPasteData] = useState('');

    const [showAdvanced, setShowAdvanced] = useState(false);

    // 🌟 Auto-Preview Effect
    useEffect(() => {
        if (sheetData.length > 0 && colName) {
            // Debounce slightly to allow states to settle
            const timer = setTimeout(() => {
                if (mode === 'general' && colGrade) {
                    generatePreview();
                } else if (mode === 'trabajos' && Object.keys(columnMapping).length > 0) {
                    generatePreview();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [sheetData, colName, colGrade, columnMapping, mode]);

    const handlePaste = (e) => {
        const text = e.target.value;
        setPasteData(text);
        if (text) {
            // Reset UI states for new paste
            setShowAdvanced(false);
            setPreviewData([]);
            processPasteData(text);
        }
    };

    const processPasteData = (text) => {
        setIsProcessing(true);
        // Excel copies as Tab-Separated Values (TSV)
        const rows = text.split(/\r\n|\n|\r/);
        const data = rows.map(row => row.split('\t'));
        const cleanData = data.filter(r => r.some(c => c && c.trim() !== ''));

        setSheetData(cleanData);

        // Auto-detect header row
        const idx = detectHeaderRow(cleanData);
        if (idx !== -1) {
            setHeaderRowIndex(idx);
            setHeaders(cleanData[idx]);

            // Try to auto-select "Nombre" column
            const nameKeywords = ['NOMBRE', 'ALUMNO', 'ESTUDIANTE', 'NAME'];
            const nameIdx = cleanData[idx].findIndex(h => {
                if (!h || typeof h !== 'string') return false;
                const upper = h.toUpperCase();
                return nameKeywords.some(k => upper.includes(k));
            });
            if (nameIdx !== -1) setColName(cleanData[idx][nameIdx]);

            // If we didn't find a name column, we might want to default to column 0 if it looks like text?
            // checking logic later in useEffect
        }
        setIsProcessing(false);
    };

    // ... (useEffect for headers/autoMatchColumns remains the same) ...
    // ... (detectHeaderRow remains the same) ...
    // ... (normalizeText remains the same) ...
    // ... (autoMatchColumns remains the same) ...
    // ... (generatePreview remains the same) ...

    // Re-run auto match if headers change manually
    useEffect(() => {
        if (headers.length > 0) {
            const nameKeywords = ['NOMBRE DEL ALUMNO', 'ALUMNO', 'ESTUDIANTE', 'NOMBRE', 'NAME'];
            let nameIdx = -1;
            for (const kw of nameKeywords) {
                nameIdx = headers.findIndex(h => {
                    if (!h || typeof h !== 'string') return false;
                    return h.toUpperCase().includes(kw);
                });
                if (nameIdx !== -1) break;
            }
            if (nameIdx !== -1) setColName(headers[nameIdx]);
        }
    }, [headers]);

    // ... (rest of logic)

    const isFormValid = mode === 'general'
        ? (selectedMateria && colName && colGrade)
        : (colName && Object.keys(columnMapping).length > 0);

    return (
        <div className="modal-overlay">
            <div className="modal-content import-modal" style={{ maxWidth: '900px', width: '95%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3>Importar Calificaciones ({mode === 'general' ? 'General' : 'Masiva'})</h3>
                    <button className="modal-close" onClick={onClose} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
                </div>

                {!sheetData.length ? (
                    <div className="upload-area" style={{ border: '2px dashed #ccc', padding: '40px 20px', textAlign: 'center', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                        <FaFileExcel size={50} color="#27ae60" style={{ marginBottom: '15px' }} />
                        <h4 style={{ marginBottom: '10px', color: '#555' }}>Pega aquí tus datos de Excel</h4>
                        <p style={{ marginBottom: '20px', color: '#777' }}>Selecciona las celdas en Excel (Ctrl+C) y pégalas aquí (Ctrl+V)</p>
                        <textarea
                            value={pasteData}
                            onChange={(e) => handlePaste(e)}
                            placeholder=""
                            style={{
                                position: 'absolute', left: '-9999px' // Hidden input to catch paste if needed, or just rely on global paste? 
                                // Actually, user expects to click and paste. We need a visible Textarea.
                            }}
                            autoFocus
                        />
                        <textarea
                            value={pasteData}
                            onChange={(e) => handlePaste(e)}
                            placeholder="Haz clic aquí y presiona Ctrl+V"
                            style={{
                                width: '80%',
                                height: '200px',
                                padding: '15px',
                                borderRadius: '8px',
                                border: '2px solid #ddd',
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                                resize: 'none'
                            }}
                            autoFocus
                        />
                    </div>
                ) : (
                    <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: showAdvanced ? '1fr 1fr' : '1fr', gap: '20px' }}>

                        {/* LEFT PANEL: CONFIGURATION (Hidden by default) */}
                        <div className="left-panel" style={{ display: showAdvanced ? 'block' : 'none', overflowY: 'auto', maxHeight: '500px', borderRight: '1px solid #eee', paddingRight: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4>Configuración Manual</h4>
                                <button onClick={() => setShowAdvanced(false)} style={{ fontSize: '0.8rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>Ocultar</button>
                            </div>
                            <p style={{ fontSize: '0.9rem' }}><b>Datos cargados:</b> {sheetData.length} filas</p>

                            {mode === 'general' && (
                                <>
                                    <label>Materia:</label>
                                    <select value={selectedMateria} onChange={e => setSelectedMateria(e.target.value)} style={{ width: '100%', marginBottom: '10px' }}>
                                        <option value="">-- Selecciona --</option>
                                        {materias.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <label>Trimestre:</label>
                                    <select value={selectedTrimestre} onChange={e => setSelectedTrimestre(e.target.value)} style={{ width: '100%', marginBottom: '10px' }}>
                                        <option value="0">1</option><option value="1">2</option><option value="2">3</option>
                                    </select>
                                </>
                            )}


                            {/* Manual Header Row Control */}
                            <div style={{ marginBottom: '15px', padding: '10px', background: '#ffeaa7', borderRadius: '5px' }}>
                                <label style={{ fontSize: '0.85rem', color: '#d35400', fontWeight: 'bold' }}>Fila de Encabezados (Detectada: {headerRowIndex + 1})</label>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                    <input
                                        type="number"
                                        min="1"
                                        value={headerRowIndex + 1}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) - 1;
                                            if (val >= 0 && sheetData.length > val) {
                                                setHeaderRowIndex(val);
                                                setHeaders(sheetData[val]);
                                            }
                                        }}
                                        style={{ width: '80px', padding: '5px' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', color: '#666', alignSelf: 'center' }}>
                                        Ajusta si los nombres de columna no son correctos.
                                    </span>
                                </div>
                            </div>

                            <label>Columna Nombre:</label>
                            <select value={colName} onChange={e => setColName(e.target.value)} style={{ width: '100%', marginBottom: '15px' }}>
                                <option value="">-- Selecciona --</option>
                                {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                            </select>

                            {mode === 'general' ? (
                                <>
                                    <label>Columna Calificación:</label>
                                    <select value={colGrade} onChange={e => setColGrade(e.target.value)} style={{ width: '100%', marginBottom: '10px' }}>
                                        <option value="">-- Selecciona --</option>
                                        {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                    </select>
                                </>
                            ) : (
                                <div className="bulk-mapping-area">
                                    <h4>Mapeo de Columnas <button onClick={autoMatchColumns} style={{ fontSize: '0.7rem', padding: '2px 5px' }}>Auto-Mapear</button></h4>

                                    {criterios.map(crit => (
                                        <div key={crit.nombre} style={{ marginBottom: '15px', border: '1px solid #eee', padding: '10px', borderRadius: '6px' }}>
                                            <strong style={{ color: 'var(--main-color)' }}>{crit.nombre}</strong>
                                            {Array.from({ length: numTareas[crit.nombre] || 10 }).map((_, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '5px', fontSize: '0.9rem' }}>
                                                    <span>Tarea {idx + 1}:
                                                        {customTaskNames[`${crit.nombre}-${idx}`] && <span style={{ color: '#e67e22', marginLeft: '5px' }}>({customTaskNames[`${crit.nombre}-${idx}`]})</span>}
                                                    </span>
                                                    <select
                                                        value={columnMapping[`${crit.nombre}-${idx}`] || ''}
                                                        onChange={e => setColumnMapping(prev => ({ ...prev, [`${crit.nombre}-${idx}`]: e.target.value }))}
                                                        style={{ width: '50%', padding: '2px' }}
                                                    >
                                                        <option value="">(Ignorar)</option>
                                                        {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button className="button" style={{ marginTop: '10px', width: '100%' }} disabled={!isFormValid} onClick={generatePreview}>
                                Actualizar Vista Previa
                            </button>
                        </div>

                        {/* RIGHT PANEL: PREVIEW (Always Visible) */}
                        <div className="right-panel">

                            {!showAdvanced && (
                                <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0 }}>Vista Previa Automática</h4>
                                    <button onClick={() => setShowAdvanced(true)} style={{ fontSize: '0.9rem', color: 'var(--primary-color)', background: 'none', border: '1px solid var(--primary-color)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}>
                                        Configuración Manual / Avanzada
                                    </button>
                                </div>
                            )}

                            {previewData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#888', background: '#f9f9f9', borderRadius: '8px' }}>
                                    <FaMagic size={30} color="#f39c12" style={{ marginBottom: '10px' }} />
                                    <p>Procesando datos...</p>
                                    <p style={{ fontSize: '0.9rem' }}>Si no aparecen alumnos, verifica la "Configuración Manual".</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span><b>{previewData.length}</b> Alumnos detectados para importar.</span>
                                    </div>

                                    <div className="preview-list" style={{ maxHeight: '400px', overflowY: 'auto', background: '#fff', border: '1px solid #eee', padding: '10px', borderRadius: '8px' }}>
                                        {previewData.slice(0, 50).map((item, idx) => (
                                            <div key={idx} style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 0', fontSize: '0.85rem' }}>
                                                <div style={{ fontWeight: 'bold', color: '#333' }}>{item.systemName}</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
                                                    {mode === 'general' ? (
                                                        <span className={item.grade < 6 ? 'badge-danger' : 'badge-success'}>Calif: {item.grade}</span>
                                                    ) : (
                                                        Object.entries(item).filter(([k]) => k.includes('-')).map(([key, val]) => {
                                                            const gradeVal = typeof val === 'object' ? val.value : val;
                                                            return (
                                                                <span key={key} style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 6px', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid #a5d6a7' }}>
                                                                    T{parseInt(key.split('-')[1]) + 1}: <b>{gradeVal}</b>
                                                                </span>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {previewData.length > 50 && <p style={{ textAlign: 'center', color: '#888', marginTop: '10px' }}>... y {previewData.length - 50} más.</p>}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="button-secondary" onClick={() => {
                        setPasteData('');
                        setSheetData([]);
                        setHeaders([]);
                        setPreviewData([]);
                        onClose();
                    }}>Cancelar</button>
                    {sheetData.length > 0 && (
                        <button className="button" onClick={handleImportClick} disabled={previewData.length === 0} style={{ padding: '10px 30px', fontSize: '1.1rem' }}>
                            <FaCheck style={{ marginRight: '8px' }} /> Confirmar Importación
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
