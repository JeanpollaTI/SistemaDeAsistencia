import React, { useState, useEffect } from 'react';
// import * as XLSX from 'xlsx'; // Removed dependency
import { FaFileExcel, FaCheck, FaTimes, FaExclamationTriangle, FaMagic } from 'react-icons/fa';
import './Calificaciones.css';

export default function ImportModal({ onClose, onImport, materias, alumnos, mode = 'general', criterios = [], numTareas = {}, customTaskNames = {} }) {
    // const [file, setFile] = useState(null); // Removed file state
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

    const handlePaste = (e) => {
        const text = e.target.value;
        setPasteData(text);
        if (text) processPasteData(text);
    };

    const processPasteData = (text) => {
        setIsProcessing(true);
        // Excel copies as Tab-Separated Values (TSV)
        // Rows are newlines, columns are tabs
        const rows = text.split(/\r\n|\n|\r/);
        const data = rows.map(row => row.split('\t'));

        // Remove empty trailing rows
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
        }
        setIsProcessing(false);
    };

    // 🌟 Re-run auto match if headers change manually
    useEffect(() => {
        if (headers.length > 0) {
            // Re-detect 'Nombre' column if headers change
            // Priority: "NOMBRE DEL ALUMNO", then "NOMBRE", etc.
            const nameKeywords = ['NOMBRE DEL ALUMNO', 'ALUMNO', 'ESTUDIANTE', 'NOMBRE', 'NAME'];

            let nameIdx = -1;
            // Try explicit strict match first
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

    const detectHeaderRow = (data) => {
        // Broaden search for header row with STRICTER rules to avoid "Nombre del Docente"
        // We require 'ALUMNO' or 'LISTA' or 'ESTUDIANTE' which are typical of the TABLE header.
        const keywords = ['ALUMNO', 'ESTUDIANTE', 'APELLIDO', 'FULL NAME', 'LISTA', 'NO. DE LISTA', 'NÚMERO DE LISTA'];
        const secondaryKeywords = ['NOMBRE']; // "NOMBRE" by itself is too risky (matches "Nombre del Docente")
        const specificKeywords = ['NOMBRE DEL ALUMNO', 'NOMBRE DEL ALUMNO (A)']; // Very strong signal

        for (let i = 0; i < Math.min(data.length, 100); i++) {
            const row = data[i];
            if (Array.isArray(row)) {

                // Check for very specific strong keywords first (Layout specific)
                const hasSpecific = row.some(cell => {
                    if (!cell || typeof cell !== 'string') return false;
                    return specificKeywords.some(k => cell.toUpperCase().includes(k));
                });
                if (hasSpecific) return i;

                // Check for primary strong keywords
                const hasPrimary = row.some(cell => {
                    if (!cell || typeof cell !== 'string') return false;
                    const upper = cell.toUpperCase();
                    return keywords.some(k => upper.includes(k));
                });

                // Check for "NOMBRE" specifically if combined with valid table structure (multiple columns)
                const hasSecondary = row.some(cell => {
                    if (!cell || typeof cell !== 'string') return false;
                    const upper = cell.toUpperCase();
                    return secondaryKeywords.some(k => upper.includes(k));
                });

                // Confirm it's a likely header row:
                // 1. Has a primary keyword (ALUMNO, LISTA) - Strongest signal
                // 2. OR Has "NOMBRE" AND has at least 3 non-empty cells (to avoid single metadata lines like "Nombre Prof: ...")
                const nonEmptyCount = row.filter(c => c).length;

                if (hasPrimary) return i;
                if (hasSecondary && nonEmptyCount > 3) return i;
            }
        }
        return 0; // Fallback
    };

    const normalizeText = (text) => {
        if (!text) return '';
        return text.toString().toUpperCase()
            .replace(/[\r\n]+/g, " ") // 🌟 CRITICAL: Replace newlines with spaces (for vertical headers)
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z0-9\s]/g, "")
            .replace(/\s+/g, ' ').trim();
    };

    // --- AUTO MATCHING ---
    useEffect(() => {
        if (mode === 'trabajos' && headers.length > 0) {
            autoMatchColumns();
        }
    }, [headers, mode, criterios, numTareas]);

    const autoMatchColumns = () => {
        console.log("Auto-matching columns...", { headers, criterios });
        const newMapping = {};

        // 1. Find the "Name" column index to start Positional Matching
        const nameKeywords = ['NOMBRE', 'ALUMNO', 'ESTUDIANTE', 'NAME'];
        let nameColIndex = headers.findIndex(h => {
            if (!h || typeof h !== 'string') return false;
            return nameKeywords.some(k => h.toUpperCase().includes(k));
        });
        if (nameColIndex === -1) nameColIndex = 0; // Fallback

        // Get candidate columns (those to the right of Name)
        // Filter out obvious metadata columns
        const candidateIndices = [];
        const ignoreKeywords = ['ASISTENCIA', 'FALTAS', 'TOTAL', 'PROMEDIO', 'OBSERVACIONES', 'RIESGO', 'DOCENTE', 'DISCIPLINA', 'GRADO', 'GRUPO', 'NO. DE LISTA', '#'];

        headers.forEach((h, idx) => {
            if (idx > nameColIndex) {
                const normH = normalizeText(h);
                const isIgnored = ignoreKeywords.some(bad => normH.includes(bad));
                // Only consider non-empty headers, or headers that look like numbers (1, 2, 3...)
                if (!isIgnored && h) {
                    candidateIndices.push({ idx, name: h });
                }
            }
        });

        // POINTERS
        let candidatePointer = 0; // Points to the next available Excel column

        // Iterate through System Tasks (Ordered by Criterio then TaskIndex)
        // We want to fill them sequentially.
        criterios.forEach(criterio => {
            const maxTareas = numTareas[criterio.nombre] || 10;
            const normCriterio = normalizeText(criterio.nombre);

            for (let i = 0; i < maxTareas; i++) {
                const systemKey = `${criterio.nombre}-${i}`;
                const customName = customTaskNames[systemKey];
                const taskNumber = (i + 1).toString();

                let matchedHeader = null;

                // --- STRATEGY 1: EXPLICIT MATCH (Strongest) ---
                // Search ALL headers (not just candidates) for a strong name match
                matchedHeader = headers.find(h => {
                    if (!h || typeof h !== 'string') return false;
                    const normH = normalizeText(h);
                    if (ignoreKeywords.some(bad => normH.includes(bad))) return false;

                    // Custom Name Match
                    if (customName) {
                        const normCustom = normalizeText(customName);
                        if (normH.includes(normCustom)) return true;
                    }

                    // Specific Criterio Match (e.g. "Examen")
                    // If the criterion is "Examen", look for "Examen" header
                    if (normCriterio === 'EXAMEN' && normH.includes('EXAMEN')) return true;

                    // "Tarea 1" specific match
                    if (normH.includes(`TAREA ${taskNumber}`) || normH.includes(`TRABAJO ${taskNumber}`)) return true;

                    return false;
                });


                // --- STRATEGY 3: Positional Fallback ---
                // If we didn't find an explicit match name
                // We assume the use wants the columns exactly as they appear in Excel to the right of Name
                // But we must skip known non-task columns.
                if (!matchedHeader && candidatePointer < candidateIndices.length) {
                    const nextCandidate = candidateIndices[candidatePointer];
                    const normCand = normalizeText(nextCandidate.name);
                    const candIsNumber = /^\d+$/.test(normCand); // Is just digits?

                    // Heuristic: If candidate is "EXAMEN" but we are in "TAREAS", skip it?
                    // Unless "TAREAS" is the only criterion.

                    if (normCriterio === 'EXAMEN' && normCand.includes('EXAMEN')) {
                        matchedHeader = nextCandidate.name;
                        candidatePointer++;
                    } else if (normCriterio !== 'EXAMEN' && normCand.includes('EXAMEN')) {
                        // Skip this candidate for non-exam criteria
                        // Do NOT increment pointer, just don't match this one to Tarea X
                        // Actually, we should PROBABLY increment pointer so we don't get stuck?
                        // If we skip it, we need to check the next candidate for THIS task.
                        // Ideally we find 'Examen' later.

                        // Let's iterate forward in candidates to find a "safe" one?
                        // For simplicity, if we hit "EXAMEN", we skip it for "TAREAS".
                        candidatePointer++;
                        // check next?
                        if (candidatePointer < candidateIndices.length) {
                            const nextNext = candidateIndices[candidatePointer];
                            matchedHeader = nextNext.name;
                            candidatePointer++;
                        }
                    } else {
                        // Default sequential assignment
                        matchedHeader = nextCandidate.name;
                        candidatePointer++;
                    }
                }

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
            if (!rawName) continue; // Skip empty rows

            const normExcelName = normalizeText(rawName);
            if (normExcelName.length < 3) continue; // Skip junk rows

            // --- IMPROVED MATCHING STRATEGY ---
            let bestMatch = null;
            let maxScore = 0;

            alumnos.forEach(a => {
                const sysFullName = normalizeText(`${a.apellidoPaterno} ${a.apellidoMaterno || ''} ${a.nombre}`);

                // 1. Exact Match
                if (sysFullName === normExcelName) {
                    bestMatch = a;
                    maxScore = 100;
                    return;
                }

                if (maxScore === 100) return;

                // 2. Token Matching (Score based)
                const sysTokens = sysFullName.split(' ').filter(t => t.length > 2);
                const excelTokens = normExcelName.split(' ').filter(t => t.length > 2);

                let hitCount = 0;
                sysTokens.forEach(st => {
                    if (excelTokens.includes(st)) hitCount++;
                });

                // Calculate score: Hits / (Total Tokens in System Name)
                const score = hitCount / sysTokens.length;

                // Threshold: 0.7 (Allows for missing middle name or slight diff)
                // Also require at least 2 hits if names are long to avoid false positives with just one common name
                if (score > 0.6 && score > maxScore) {
                    // Additional check: Ensure surname matches?
                    // Usually usually good enough if > 70% match
                    maxScore = score;
                    bestMatch = a;
                }
            });


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

                        // Extract Header Name for Task Naming
                        const headerName = headers[colIdx];
                        const cleanHeaderName = headerName ? headerName.toString().replace(/[\r\n]+/g, " ").trim() : "";

                        if (!isNaN(parsed)) {
                            gradesObj[sysKey] = {
                                value: parsed,
                                taskName: cleanHeaderName
                            };
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

                {!sheetData.length && (
                    <div className="upload-area" style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                        <FaFileExcel size={40} color="#27ae60" style={{ marginBottom: '10px' }} />
                        <p style={{ marginBottom: '10px' }}>Copia tus celdas de Excel (Ctrl+C) y pégalas aquí (Ctrl+V)</p>
                        <textarea
                            value={pasteData}
                            onChange={(e) => handlePaste(e)}
                            placeholder="Pega aquí los datos de Excel..."
                            style={{
                                width: '100%',
                                height: '150px',
                                padding: '10px',
                                borderRadius: '5px',
                                border: '1px solid #ddd',
                                fontFamily: 'monospace',
                                fontSize: '0.8rem'
                            }}
                        />
                    </div>
                )}

                {sheetData.length > 0 && (
                    <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="left-panel" style={{ overflowY: 'auto', maxHeight: '500px' }}>
                            <p><b>Datos cargados:</b> {sheetData.length} filas</p>

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


                            {/* 🌟 New Manual Header Row Control */}
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
                                                // Trigger re-match? The useEffect on 'headers' will handle it.
                                            }
                                        }}
                                        style={{ width: '80px', padding: '5px' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', color: '#666', alignSelf: 'center' }}>
                                        Si no aparecen las columnas, ajusta este número.
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
                                                Object.entries(item).filter(([k]) => k.includes('-')).map(([key, val]) => {
                                                    // Handle new object structure { value, taskName } or legacy number
                                                    const gradeVal = typeof val === 'object' ? val.value : val;

                                                    return (
                                                        <span key={key} style={{ background: '#e0e0e0', padding: '2px 5px', borderRadius: '3px' }}>
                                                            {key.split('-')[0].substr(0, 3)} T{parseInt(key.split('-')[1]) + 1}: <b>{gradeVal}</b>
                                                        </span>
                                                    );
                                                })
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
                    <button className="button-secondary" onClick={() => {
                        setPasteData('');
                        setSheetData([]);
                        setHeaders([]);
                        onClose();
                    }}>Cancelar</button>
                    <button className="button" onClick={handleImportClick} disabled={previewData.length === 0}>
                        Importar {previewData.length} Alumnos
                    </button>
                </div>
            </div>
        </div>
    );
}
