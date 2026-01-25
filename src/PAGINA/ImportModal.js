import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FaUpload, FaFileExcel, FaCheck, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import './Calificaciones.css'; // Reusing existing styles or add specific ones

export default function ImportModal({ onClose, onImport, materias, alumnos }) {
    const [file, setFile] = useState(null);
    const [sheetData, setSheetData] = useState([]);
    const [headerRowIndex, setHeaderRowIndex] = useState(-1);
    const [headers, setHeaders] = useState([]);

    // Selection States
    const [selectedMateria, setSelectedMateria] = useState('');
    const [selectedTrimestre, setSelectedTrimestre] = useState('0'); // 0, 1, 2 (Indices)
    const [colName, setColName] = useState('');
    const [colGrade, setColGrade] = useState('');

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
                // Try to auto-select columns
                const nameIdx = data[idx].findIndex(h => h && h.toString().toUpperCase().includes('NOMBRE DEL ALUMNO'));
                if (nameIdx !== -1) setColName(data[idx][nameIdx]);
            }
            setIsProcessing(false);
        };
        reader.readAsBinaryString(f);
    };

    const detectHeaderRow = (data) => {
        // Look for "NOMBRE DEL ALUMNO" in first 50 rows
        for (let i = 0; i < Math.min(data.length, 50); i++) {
            const row = data[i];
            if (row.some(cell => cell && cell.toString().toUpperCase().includes('NOMBRE DEL ALUMNO'))) {
                return i;
            }
        }
        return 0; // Fallback
    };

    const normalizeText = (text) => {
        if (!text) return '';
        return text.toString().toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/\s+/g, ' ').trim(); // Remove extra spaces
    };

    const generatePreview = () => {
        if (!selectedMateria || !colName || !colGrade) return;

        const nameIdx = headers.indexOf(colName);
        const gradeIdx = headers.indexOf(colGrade);

        if (nameIdx === -1 || gradeIdx === -1) return;

        const matches = [];

        // Process rows AFTER the header
        for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            const rawName = row[nameIdx];
            const rawGrade = row[gradeIdx];

            if (!rawName) continue; // Skip empty names

            const normExcelName = normalizeText(rawName);

            // Fuzzy Match with System Alumnos
            let bestMatch = null;

            // 1. Exact Match (Normalized)
            bestMatch = alumnos.find(a => {
                const fullName = normalizeText(`${a.apellidoPaterno} ${a.apellidoMaterno || ''} ${a.nombre}`);
                return fullName === normExcelName;
            });

            // 2. Token Set Match (if exact match fails)
            // "PEREZ LOPEZ JUAN" vs "JUAN PEREZ LOPEZ"
            if (!bestMatch) {
                bestMatch = alumnos.find(a => {
                    const systemName = normalizeText(`${a.apellidoPaterno} ${a.apellidoMaterno || ''} ${a.nombre}`);
                    const sysTokens = systemName.split(' ');
                    const excelTokens = normExcelName.split(' ');
                    if (sysTokens.length < 2 || excelTokens.length < 2) return false;

                    // Check if ALL tokens from the shorter name appear in the longer one
                    return sysTokens.every(t => excelTokens.includes(t)) || excelTokens.every(t => sysTokens.includes(t));
                });
            }

            if (bestMatch) {
                // Parse Grade
                let parsedGrade = parseFloat(rawGrade);
                if (isNaN(parsedGrade)) parsedGrade = null;

                matches.push({
                    alumnoId: bestMatch._id,
                    systemName: `${bestMatch.apellidoPaterno} ${bestMatch.apellidoMaterno} ${bestMatch.nombre}`,
                    excelName: rawName,
                    grade: parsedGrade,
                    oldGrade: 'N/A' // Parent can fill this if needed, or simply overwrite
                });
            }
        }
        setPreviewData(matches);
    };

    const handleImportClick = () => {
        if (previewData.length === 0) return;
        onImport(previewData, selectedMateria, parseInt(selectedTrimestre));
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content import-modal" style={{ maxWidth: '800px', width: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3>Importar Calificaciones desde Excel</h3>
                    <button className="modal-close" onClick={onClose} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
                </div>

                {/* STEP 1: UPLOAD */}
                {!file && (
                    <div className="upload-area" style={{
                        border: '2px dashed #ccc', padding: '40px', textAlign: 'center', cursor: 'pointer', borderRadius: '8px',
                        backgroundColor: '#fafafa'
                    }}>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} style={{ display: 'none' }} id="excel-upload" />
                        <label htmlFor="excel-upload" style={{ cursor: 'pointer', width: '100%', height: '100%', display: 'block' }}>
                            <FaFileExcel size={50} color="#27ae60" style={{ marginBottom: '10px' }} />
                            <p>Haz clic para subir tu archivo Excel</p>
                            <span style={{ fontSize: '0.9rem', color: '#777' }}>Buscaremos "NOMBRE DEL ALUMNO" automáticamente</span>
                        </label>
                    </div>
                )}

                {/* STEP 2: CONFIGURATION */}
                {file && (
                    <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="left-panel">
                            <p><b>Archivo:</b> {file.name}</p>

                            <label>Materia destino:</label>
                            <select value={selectedMateria} onChange={e => setSelectedMateria(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px' }}>
                                <option value="">-- Selecciona Materia --</option>
                                {materias.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>

                            <label>Trimestre destino:</label>
                            <select value={selectedTrimestre} onChange={e => setSelectedTrimestre(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px' }}>
                                <option value="0">Trimestre 1</option>
                                <option value="1">Trimestre 2</option>
                                <option value="2">Trimestre 3</option>
                            </select>

                            <hr />

                            <label>Columna Nombre:</label>
                            <select value={colName} onChange={e => setColName(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px' }}>
                                <option value="">-- Selecciona Columna --</option>
                                {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                            </select>

                            <label>Columna Calificación:</label>
                            <select value={colGrade} onChange={e => setColGrade(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px' }}>
                                <option value="">-- Selecciona Columna --</option>
                                {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                            </select>

                            <button
                                className="button"
                                style={{ marginTop: '10px', width: '100%' }}
                                disabled={!selectedMateria || !colName || !colGrade}
                                onClick={generatePreview}
                            >
                                Vista Previa
                            </button>
                            <button onClick={() => setFile(null)} style={{ marginTop: '10px', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#e74c3c' }}>Cambiar Archivo</button>
                        </div>

                        <div className="right-panel" style={{ borderLeft: '1px solid #eee', paddingLeft: '20px' }}>
                            <h4>Vista Previa ({previewData.length} alumnos encontrados)</h4>
                            <div className="preview-list" style={{ maxHeight: '300px', overflowY: 'auto', background: '#f9f9f9', padding: '10px', borderRadius: '4px' }}>
                                {previewData.length === 0 ? (
                                    <p style={{ color: '#999', fontSize: '0.9rem' }}>Configura las columnas y haz clic en Vista Previa.</p>
                                ) : (
                                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                                <th>Alumno (Sistema)</th>
                                                <th>Excel</th>
                                                <th>Calif.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '4px' }}>{item.systemName}</td>
                                                    <td style={{ padding: '4px', color: '#777' }}>{item.excelName}</td>
                                                    <td style={{ padding: '4px', fontWeight: 'bold', color: item.grade < 6 ? 'red' : 'green' }}>
                                                        {item.grade !== null ? item.grade : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="button-secondary" onClick={onClose}>Cancelar</button>
                    <button className="button" onClick={handleImportClick} disabled={previewData.length === 0}>
                        Importar {previewData.length} Calificaciones
                    </button>
                </div>
            </div>
        </div>
    );
}
