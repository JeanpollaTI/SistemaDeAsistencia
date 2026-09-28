import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FaFileExcel, FaTimes, FaUpload, FaCheckCircle, FaSpinner, FaTable, FaUserGraduate, FaUsers } from 'react-icons/fa';
import apiClient from '../../api/apiClient';

const ExcelImportModal = ({ isOpen, onClose, onImportSuccess, profesores = [], grupos = [] }) => {
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [rowType, setRowType] = useState('STUDENTS');
    const [columnsPreview, setColumnsPreview] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen) return null;

    const resetState = () => {
        setFile(null);
        setParsedData(null);
        setTitle('');
        setDescription('');
        setRowType('STUDENTS');
        setColumnsPreview([]);
        setErrorMessage('');
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        setErrorMessage('');
        parseExcelFile(selectedFile);
    };

    const parseExcelFile = (fileToParse) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (!rawRows || rawRows.length === 0) {
                    setErrorMessage('El archivo no contiene filas o datos legibles.');
                    return;
                }

                // 1. Detección de fila de cabecera y título predeterminado
                const fileNameWithoutExt = fileToParse.name.replace(/\.[^/.]+$/, "");
                setTitle(fileNameWithoutExt || 'Tabla Importada');

                // Encontrar la primera fila con múltiples valores no vacíos como cabecera principal
                let headerRowIndex = -1;
                let parentHeaderRowIndex = -1;

                for (let i = 0; i < Math.min(15, rawRows.length); i++) {
                    const nonEmp = rawRows[i].filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
                    if (nonEmp.length >= 2) {
                        // Si la fila actual parece ser cabecera padre (ej: "Primer periodo", "Asistencias")
                        if (headerRowIndex === -1) {
                            headerRowIndex = i;
                        } else if (parentHeaderRowIndex === -1 && i === headerRowIndex + 1) {
                            parentHeaderRowIndex = headerRowIndex;
                            headerRowIndex = i;
                            break;
                        }
                    }
                }

                if (headerRowIndex === -1) {
                    setErrorMessage('No se pudieron detectar columnas de cabecera en el archivo.');
                    return;
                }

                const rawHeaders = rawRows[headerRowIndex];
                const rawParentHeaders = parentHeaderRowIndex >= 0 ? rawRows[parentHeaderRowIndex] : [];

                // 2. Construcción y sanitización de columnas
                const detectedCols = [];
                let currentParentHeader = 'General';

                rawHeaders.forEach((hVal, colIdx) => {
                    const labelStr = String(hVal || '').trim();
                    if (!labelStr && colIdx > 15) return; // ignorar columnas sobrantes en blanco

                    if (parentHeaderRowIndex >= 0 && rawParentHeaders[colIdx]) {
                        const pHeaderStr = String(rawParentHeaders[colIdx]).trim();
                        if (pHeaderStr) currentParentHeader = pHeaderStr;
                    }

                    // Determinar tipo de columna preliminar
                    let colType = 'TEXT';
                    const lowerLabel = labelStr.toLowerCase();

                    if (lowerLabel.includes('%') || lowerLabel.includes('total') || lowerLabel.includes('promedio') || lowerLabel.includes('asistencia')) {
                        colType = 'NUMBER';
                    } else if (['i', 'o', 's'].includes(lowerLabel) || lowerLabel.includes('eval')) {
                        colType = 'BOOLEAN_STATUS';
                    }

                    detectedCols.push({
                        key: `col_${colIdx}_${Date.now()}`,
                        label: labelStr || `Columna ${colIdx + 1}`,
                        groupHeader: currentParentHeader,
                        type: colType,
                        colIdx
                    });
                });

                // 3. Detección automática de rowType ('GROUPS' vs 'STUDENTS')
                const firstColName = String(rawHeaders[0] || '').toLowerCase();
                let detectedRowType = 'STUDENTS';

                if (firstColName.includes('grupo') || firstColName.includes('grado') || firstColName.includes('aula')) {
                    detectedRowType = 'GROUPS';
                } else {
                    // Verificar primeras filas de datos para coincidencia con nombres de grupo
                    for (let r = headerRowIndex + 1; r < Math.min(headerRowIndex + 10, rawRows.length); r++) {
                        const cellVal = String(rawRows[r][0] || '').trim();
                        if (cellVal && (cellVal.match(/^[1-3][°º]?[A-Z]/i) || cellVal.toLowerCase().includes('grupo'))) {
                            detectedRowType = 'GROUPS';
                            break;
                        }
                    }
                }
                setRowType(detectedRowType);
                setColumnsPreview(detectedCols);

                // 4. Depuración y sanitización de filas de datos
                const extractedRows = [];
                let lastParentHeader = 'General';

                for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
                    const rowCells = rawRows[r];
                    const firstCellStr = String(rowCells[0] || '').trim();

                    // Filtrar filas vacías o decorativas de separación de grado ("PRIMER GRADO", "ESCUELA SECUNDARIA...")
                    if (!firstCellStr) continue;
                    const isDividerRow = /^(primer|segundo|tercer|1er|2do|3er)\s+(grado|periodo)/i.test(firstCellStr) ||
                                         /escuela|secundaria|nerv|general/i.test(firstCellStr);
                    if (isDividerRow && rowCells.filter(c => String(c).trim()).length <= 2) {
                        continue;
                    }

                    const rowData = {};
                    detectedCols.forEach(col => {
                        const cellVal = rowCells[col.colIdx];
                        if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '') {
                            rowData[col.key] = String(cellVal).trim();
                        }
                    });

                    extractedRows.push({
                        rowEntityName: firstCellStr,
                        data: rowData
                    });
                }

                setParsedData({
                    headers: rawHeaders,
                    rows: extractedRows
                });

            } catch (err) {
                console.error('Error al procesar hoja de cálculo:', err);
                setErrorMessage('Ocurrió un error al leer el archivo Excel. Verifica que el archivo no esté protegido.');
            }
        };
        reader.readAsArrayBuffer(fileToParse);
    };

    const handleSaveImport = async () => {
        if (!title.trim()) {
            setErrorMessage('El título de la tabla es obligatorio.');
            return;
        }

        if (!columnsPreview || columnsPreview.length === 0) {
            setErrorMessage('No hay columnas definidas para esta tabla.');
            return;
        }

        try {
            setLoading(true);
            setErrorMessage('');

            // Sanitizar columnas eliminando colIdx interno
            const finalColumns = columnsPreview.map(({ key, label, groupHeader, type }) => ({
                key,
                label,
                groupHeader,
                type: type || 'TEXT',
                statusOptions: type === 'BOOLEAN_STATUS' ? [
                    { key: 'I', label: 'I', color: '#ef4444' },
                    { key: 'O', label: 'O', color: '#22c55e' },
                    { key: 'S', label: 'S', color: '#f59e0b' }
                ] : []
            }));

            // 1. Crear el Template en Backend
            const templateRes = await apiClient.post('/api/extensions', {
                title: title.trim(),
                description: description.trim() || `Importado desde archivo Excel (${file?.name || 'Local'})`,
                rowType,
                columns: finalColumns,
                authorizedTeachers: profesores.map(p => p._id) // Por defecto autorizar a profesores
            });

            const createdTemplate = templateRes.data;

            // 2. Si se extrajeron celdas, mapear entityId por grupos o alumnos de la escuela
            if (parsedData && parsedData.rows && parsedData.rows.length > 0 && createdTemplate._id) {
                const batchRowsToSave = [];

                if (rowType === 'GROUPS') {
                    // Emparejar nombre de fila importada con grupos existentes
                    parsedData.rows.forEach(pRow => {
                        const targetGroup = grupos.find(g =>
                            g.nombre.toLowerCase().replace(/\s+/g, '') === pRow.rowEntityName.toLowerCase().replace(/\s+/g, '')
                        );
                        if (targetGroup) {
                            batchRowsToSave.push({
                                rowEntityId: targetGroup._id,
                                rowEntityName: targetGroup.nombre,
                                data: pRow.data
                            });
                        }
                    });
                } else {
                    // Para ALUMNOS: si el nombre coincide o se guarda con identificador de orden
                    parsedData.rows.forEach((pRow, idx) => {
                        batchRowsToSave.push({
                            rowEntityId: `import_row_${idx + 1}`,
                            rowEntityName: pRow.rowEntityName,
                            data: pRow.data
                        });
                    });
                }

                if (batchRowsToSave.length > 0) {
                    await apiClient.post(`/api/extensions/${createdTemplate._id}/batch-cells`, {
                        rows: batchRowsToSave
                    });
                }
            }

            setLoading(false);
            resetState();
            if (onImportSuccess) onImportSuccess(createdTemplate);
        } catch (err) {
            console.error('Error al guardar extensión importada:', err);
            setLoading(false);
            setErrorMessage('Error al guardar la tabla importada: ' + (err.response?.data?.msg || err.message));
        }
    };

    return (
        <div className="ext-modal-overlay">
            <div className="ext-modal-content ext-modal-lg" style={{ maxWidth: '850px' }}>
                <div className="ext-modal-header">
                    <h2>📥 Importar Excel / Recrear Tabla Dinámica</h2>
                    <button className="ext-modal-close-btn" onClick={handleClose}><FaTimes /></button>
                </div>

                <div className="ext-modal-body">
                    {errorMessage && (
                        <div className="ext-notice-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444', color: '#f87171' }}>
                            <span>⚠️ {errorMessage}</span>
                        </div>
                    )}

                    {!parsedData ? (
                        <div className="ext-upload-dropzone" style={{ border: '2px dashed #3b82f6', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', backgroundColor: 'rgba(59, 130, 246, 0.05)', cursor: 'pointer' }}>
                            <FaFileExcel style={{ fontSize: '3rem', color: '#22c55e', marginBottom: '15px' }} />
                            <h3>Selecciona un archivo de Hoja de Cálculo</h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
                                Formatos compatibles: <strong>.xlsx, .xls, .csv</strong> (Hojas de seguimiento de asistencias, porcentajes o grupos)
                            </p>
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                id="excel-file-input"
                            />
                            <label htmlFor="excel-file-input" className="ext-btn ext-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <FaUpload /> Seleccionar Archivo Excel
                            </label>
                        </div>
                    ) : (
                        <div className="ext-import-preview-form">
                            <div className="ext-form-group">
                                <label>Título de la Tabla / Extensión:</label>
                                <input
                                    type="text"
                                    className="ext-input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Seguimiento Asistencia Grados"
                                />
                            </div>

                            <div className="ext-form-group">
                                <label>Descripción u Observaciones:</label>
                                <input
                                    type="text"
                                    className="ext-input"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Ej: Registros semanales importados de Excel"
                                />
                            </div>

                            <div className="ext-form-group">
                                <label>Tipo de Filas Detectado:</label>
                                <div className="ext-radio-group" style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="importRowType"
                                            value="STUDENTS"
                                            checked={rowType === 'STUDENTS'}
                                            onChange={() => setRowType('STUDENTS')}
                                        />
                                        <FaUserGraduate /> Por Alumnos
                                    </label>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="importRowType"
                                            value="GROUPS"
                                            checked={rowType === 'GROUPS'}
                                            onChange={() => setRowType('GROUPS')}
                                        />
                                        <FaUsers /> Por Grupos del Plantel
                                    </label>
                                </div>
                            </div>

                            <div className="ext-preview-summary" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '15px' }}>
                                <h4 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                                    <FaTable /> Vista Previa de Estructura Detectada:
                                </h4>
                                <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                                    • Columnas Detectadas: <strong>{columnsPreview.length}</strong><br />
                                    • Filas de Datos Válidas: <strong>{parsedData.rows.length}</strong>
                                </p>

                                <div className="ext-cols-chips-preview" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                                    {columnsPreview.slice(0, 8).map(c => (
                                        <span key={c.key} className="ext-col-chip" style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            {c.groupHeader ? `[${c.groupHeader}] ` : ''}{c.label}
                                        </span>
                                    ))}
                                    {columnsPreview.length > 8 && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>+{columnsPreview.length - 8} más</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="ext-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                    <button className="ext-btn ext-btn-secondary" onClick={handleClose} disabled={loading}>
                        Cancelar
                    </button>
                    {parsedData && (
                        <button className="ext-btn ext-btn-primary" onClick={handleSaveImport} disabled={loading}>
                            {loading ? <><FaSpinner className="ext-spinner" /> Guardando...</> : <><FaCheckCircle /> Recrear Tabla e Importar Celdas</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExcelImportModal;
