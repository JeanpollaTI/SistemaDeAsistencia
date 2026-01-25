import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FaUpload, FaFileExcel, FaCheck, FaTimes, FaExclamationTriangle, FaMagic } from 'react-icons/fa';
import './Calificaciones.css';

export default function ImportModal({ onClose, onImport, materias, alumnos, mode = 'general', criterios = [], numTareas = {}, customTaskNames = {} }) {
    const [file, setFile] = useState(null);
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

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) {
            setFile(f);
            parseExcel(f);
        }
    };

    const parseExcel = (f) => {
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0]; // Assume first sheet
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            setSheetData(data);

            // Auto-detect header row
            const idx = detectHeaderRow(data);
            if (idx !== -1) {
                setHeaderRowIndex(idx);
                setHeaders(data[idx]);
                // Try to auto-select "Nombre" column
                const nameKeywords = ['NOMBRE', 'ALUMNO', 'ESTUDIANTE', 'NAME'];
                const nameIdx = data[idx].findIndex(h => {
                    if (!h || typeof h !== 'string') return false;
                    const upper = h.toUpperCase();
                    return nameKeywords.some(k => upper.includes(k));
                });
                if (nameIdx !== -1) setColName(data[idx][nameIdx]);
            }
            setIsProcessing(false);
        };
        reader.readAsBinaryString(f);
    };

    const detectHeaderRow = (data) => {
        // Broaden search for header row
        const keywords = ['NOMBRE', 'ALUMNO', 'ESTUDIANTE', 'NAME', 'APELLIDO', 'FULL NAME'];

        for (let i = 0; i < Math.min(data.length, 50); i++) {
            const row = data[i];
            if (Array.isArray(row)) {
                // Check if any cell in the row contains one of our keywords
                const hasKeyword = row.some(cell => {
                    if (!cell || typeof cell !== 'string') return false;
                    const upper = cell.toUpperCase();
                    return keywords.some(k => upper.includes(k));
                });

                if (hasKeyword) return i;
            }
        }
        return 0; // Fallback to first row
    };

    const normalizeText = (text) => {
        if (!text) return '';
        return text.toString().toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z0-9\s]/g, "") // Remove special chars just in case
            .replace(/\s+/g, ' ').trim();
    };

    // --- AUTO MATCHING ---
    useEffect(() => {
        if (mode === 'trabajos' && headers.length > 0) {
            autoMatchColumns();
        }
    }, [headers, mode]);

    const autoMatchColumns = () => {
        console.log("Auto-matching columns...", { headers, criterios });
        const newMapping = {};

        criterios.forEach(criterio => {
            const maxTareas = numTareas[criterio.nombre] || 10;
            const normCriterio = normalizeText(criterio.nombre); // e.g. "TAREAS" or "EXAMEN"

            for (let i = 0; i < maxTareas; i++) {
                const systemKey = `${criterio.nombre}-${i}`;
                const customName = customTaskNames[systemKey];

                // Define search tokens
                const taskLabelShort = `T${i + 1}`; // "T1"
                const taskLabelFull = `TAREA ${i + 1}`; // "TAREA 1"

                // Find matching header
                const matchedHeader = headers.find(h => {
                    if (!h || typeof h !== 'string') return false;
                    const normH = normalizeText(h);

                    // 1. IGNORE Explicitly specific columns that cause noise
                    const ignoreKeywords = ['ASISTENCIA', 'FALTAS', 'TOTAL', 'PROMEDIO'];
                    if (ignoreKeywords.some(bad => normH.includes(bad))) return false;

                    // 2. Custom Name Match (High Priority)
                    if (customName) {
                        const normCustom = normalizeText(customName);
                        if (normH.includes(normCustom) || normCustom.includes(normH)) return true;
                    }

                    // 3. Logic:
                    // A. Exact criterion match ("Examen" matches "Examen") for first item
                    //    Only valid if it's the first task (i=0) because a single column "Examen" should map to Examen-0
                    if (i === 0 && (normH === normCriterio || normH.includes(normCriterio))) {
                        // Careful: "Tareas" shouldn't match "Total Tareas" or "Promedio Tareas" (handled by ignore)
                        // But "Examen" should match "Examen"
                        return true;
                    }

                    // B. "Tarea 1", "T1" generic matching
                    //    Only valid if the criterion name is essentially "Tareas" or "Trabajos"
                    //    OR if the user just has "T1" in their excel and we assume it maps to the first criterion's T1.
                    //    This is risky if there are multiple criteria with T1. 
                    //    So let's be strict: "Criterion + T1" or just "T1" if it's the dominant pattern.

                    // Match "Tareas T1", "Trabajo 1", "Crit 1"
                    if (normH.includes(normCriterio) && (normH.includes(taskLabelShort) || normH.includes(taskLabelFull))) return true;

                    // C. Generic Fallback: If header IS exactly "Tarea 1" or "T1"
                    if (normH === taskLabelShort || normH === taskLabelFull) return true;

                    return false;
                });

                if (matchedHeader) {
                    newMapping[systemKey] = matchedHeader;
                }
            }
        });

        console.log("New Mapping:", newMapping);
        setColumnMapping(prev => ({ ...prev, ...newMapping }));
    };


    const generatePreview = () => {
        if (!colName) return;
        if (mode === 'general' && !colGrade) return;
        if (mode === 'trabajos' && Object.keys(columnMapping).length === 0) return;

        const nameIdx = headers.indexOf(colName);
        if (nameIdx === -1) return;

        // Prepare index map for bulk import
        // Key: SystemKey (Crit-Idx), Value: Excel Column Index
        const columnMapIndices = {};
        if (mode === 'trabajos') {
            Object.entries(columnMapping).forEach(([key, headerName]) => {
                const idx = headers.indexOf(headerName);
                if (idx !== -1) columnMapIndices[key] = idx;
            });
        } else {
            // General mode single column
            const idx = headers.indexOf(colGrade);
            if (idx !== -1) columnMapIndices['general'] = idx;
        }

        const matches = [];

        for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            const rawName = row[nameIdx];
            if (!rawName) continue;

            const normExcelName = normalizeText(rawName);
            let bestMatch = alumnos.find(a => {
                const fullName = normalizeText(`${a.apellidoPaterno} ${a.apellidoMaterno || ''} ${a.nombre}`);
                return fullName === normExcelName;
            });

            if (!bestMatch) {
                bestMatch = alumnos.find(a => {
                    const systemName = normalizeText(`${a.apellidoPaterno} ${a.apellidoMaterno || ''} ${a.nombre}`);
                    const sysTokens = systemName.split(' ');
                    const excelTokens = normExcelName.split(' ');
                    if (sysTokens.length < 2 || excelTokens.length < 2) return false;
                    return sysTokens.every(t => excelTokens.includes(t)) || excelTokens.every(t => sysTokens.includes(t));
                });
            }

            if (bestMatch) {
                // Extract grades
                const gradesObj = {};

                if (mode === 'general') {
                    const rawG = row[columnMapIndices['general']];
                    let parsed = parseFloat(rawG);
                    if (!isNaN(parsed)) gradesObj['grade'] = parsed;
                } else {
                    // Bulk Mode
                    Object.entries(columnMapIndices).forEach(([sysKey, colIdx]) => {
                        const rawG = row[colIdx];
                        let parsed = parseFloat(rawG);
                        if (!isNaN(parsed)) {
                            gradesObj[sysKey] = parsed;
                        }
                    });
                }

                if (Object.keys(gradesObj).length > 0) {
                    matches.push({
                        alumnoId: bestMatch._id,
                        systemName: `${bestMatch.apellidoPaterno} ${bestMatch.apellidoMaterno || ''} ${bestMatch.nombre}`,
                        excelName: rawName,
                        ...gradesObj
                    });
                }
            }
        }
        setPreviewData(matches);
    };

    const handleImportClick = () => {
        if (previewData.length === 0) return;

        if (mode === 'general') {
            // Transform back to simple array for general import
            const simpleData = previewData.map(d => ({ alumnoId: d.alumnoId, grade: d.grade }));
            onImport(simpleData, selectedMateria, parseInt(selectedTrimestre));
        } else {
            // Bulk Export
            // We pass the RAW previewData which contains keys like "Tareas-0": 10
            onImport(previewData);
        }
    };

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

                {!file && (
                    <div className="upload-area" style={{ border: '2px dashed #ccc', padding: '40px', textAlign: 'center', cursor: 'pointer', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} style={{ display: 'none' }} id="excel-upload" />
                        <label htmlFor="excel-upload" style={{ cursor: 'pointer', display: 'block' }}>
                            <FaFileExcel size={50} color="#27ae60" style={{ marginBottom: '10px' }} />
                            <p>Subir Archivo Excel</p>
                        </label>
                    </div>
                )}

                {file && (
                    <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="left-panel" style={{ overflowY: 'auto', maxHeight: '500px' }}>
                            <p><b>Archivo:</b> {file.name}</p>

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
                                    <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>Asocia las columnas del Excel con las tareas del sistema.</p>

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
                                Vista Previa
                            </button>
                        </div>

                        <div className="right-panel" style={{ borderLeft: '1px solid #eee', paddingLeft: '20px' }}>
                            <h4>Vista Previa ({previewData.length})</h4>
                            <div className="preview-list" style={{ maxHeight: '400px', overflowY: 'auto', background: '#f9f9f9', padding: '10px' }}>
                                {previewData.slice(0, 10).map((item, idx) => (
                                    <div key={idx} style={{ borderBottom: '1px solid #ddd', padding: '5px 0', fontSize: '0.85rem' }}>
                                        <strong>{item.systemName}</strong>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px' }}>
                                            {mode === 'general' ? (
                                                <span className={item.grade < 6 ? 'badge-danger' : 'badge-success'}>Calif: {item.grade}</span>
                                            ) : (
                                                Object.entries(item).filter(([k]) => k.includes('-')).map(([key, val]) => (
                                                    <span key={key} style={{ background: '#e0e0e0', padding: '2px 5px', borderRadius: '3px' }}>
                                                        {key.split('-')[0].substr(0, 3)} T{parseInt(key.split('-')[1]) + 1}: <b>{val}</b>
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {previewData.length > 10 && <p>... y {previewData.length - 10} más.</p>}
                            </div>
                        </div>
                    </div>
                )}
                <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="button-secondary" onClick={onClose}>Cancelar</button>
                    <button className="button" onClick={handleImportClick} disabled={previewData.length === 0}>
                        Importar {previewData.length} Alumnos
                    </button>
                </div>
            </div>
        </div>
    );
}
