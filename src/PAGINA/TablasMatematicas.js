import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from '../COMPONENTE/NotificationContext';
import { FaSave, FaUserCheck, FaCalculator } from 'react-icons/fa';
import './TablasMatematicas.css';

const GRUPOS_TABLAS = [
    '1A', '1B', '1C', '1D', '1E',
    '2A', '2B', '2C', '2D', '2E',
    '3A', '3B', '3C', '3D', '3E'
];

const PERIODOS_CONFIG = [
    {
        name: 'Primer periodo',
        key: 'p1',
        tablas: [1, 2, 3, 4, 5]
    },
    {
        name: 'Segundo Periodo',
        key: 'p2',
        tablas: [1, 2, 3, 4, 5]
    },
    {
        name: 'Tercer Periodo',
        key: 'p3',
        tablas: [6, 7, 8, 9, 10]
    }
];

const OPTIONS = [
    { value: '', label: '- Sin evaluar -', colorClass: 'badge-empty' },
    { value: 'Incompleta', label: 'Incompleta', colorClass: 'badge-incompleta' },
    { value: 'En orden', label: 'En orden', colorClass: 'badge-enorden' },
    { value: 'Salteadas', label: 'Salteadas', colorClass: 'badge-salteadas' }
];

const TablasMatematicas = ({ user }) => {
    const { addNotification } = useNotification() || {};
    const [selectedGrupo, setSelectedGrupo] = useState('1A');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [profesoresList, setProfesoresList] = useState([]);
    const [alumnosGrupo, setAlumnosGrupo] = useState([]);
    const [selectedEvaluadorId, setSelectedEvaluadorId] = useState('');
    
    // Matrix data: { [alumno_id]: { [p_t_key]: "Incompleta" | "En orden" | "Salteadas" | "" } }
    const [matrix, setMatrix] = useState({});

    // Fetch all math tables records and group roster
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tablasRes, gruposRes] = await Promise.all([
                apiClient.get('/api/tablas-matematicas'),
                apiClient.get('/grupos')
            ]);

            const fetchedTablas = tablasRes.data.tablas || [];
            setProfesoresList(tablasRes.data.profesores || []);

            // Store groups roster from /grupos
            const allGrupos = gruposRes.data || [];
            const currentGrupoData = allGrupos.find(g => g.nombre.toUpperCase() === selectedGrupo.toUpperCase());
            
            const alumnos = currentGrupoData?.alumnos || [];
            setAlumnosGrupo(alumnos);

            // Populate current group's evaluator and matrix
            const currentRecord = fetchedTablas.find(t => t.grupoNombre === selectedGrupo);
            if (currentRecord) {
                const evalId = currentRecord.evaluador_id?._id || currentRecord.evaluador_id || '';
                setSelectedEvaluadorId(evalId);

                const existingMatrix = {};
                (currentRecord.evaluaciones || []).forEach(ev => {
                    const reg = ev.registros;
                    let obj = {};
                    if (reg instanceof Map) {
                        obj = Object.fromEntries(reg);
                    } else if (reg && typeof reg === 'object') {
                        obj = { ...reg };
                    }
                    existingMatrix[ev.alumno_id] = obj;
                });
                setMatrix(existingMatrix);
            } else {
                setSelectedEvaluadorId('');
                setMatrix({});
            }
        } catch (err) {
            console.error("Error al cargar datos de Tablas Matemáticas:", err);
            if (addNotification) addNotification('Error al cargar datos de Tablas Matemáticas', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedGrupo, addNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEvaluadorChange = async (e) => {
        const newEvaluadorId = e.target.value;
        setSelectedEvaluadorId(newEvaluadorId);
        try {
            await apiClient.post('/api/tablas-matematicas/evaluador', {
                grupoNombre: selectedGrupo,
                evaluador_id: newEvaluadorId || null
            });
            if (addNotification) addNotification(`Evaluador actualizado para ${selectedGrupo}`, 'success');
        } catch (err) {
            console.error(err);
            if (addNotification) addNotification('Error al asignar evaluador', 'error');
        }
    };

    const handleCellChange = (alumnoId, cellKey, value) => {
        setMatrix(prev => ({
            ...prev,
            [alumnoId]: {
                ...(prev[alumnoId] || {}),
                [cellKey]: value
            }
        }));
    };

    const handleSaveEvaluations = async () => {
        setSaving(true);
        try {
            const evaluacionesArray = alumnosGrupo.map(alumno => {
                const id = String(alumno._id || alumno.id);
                const regMap = matrix[id] || {};
                return {
                    alumno_id: id,
                    alumnoNombre: `${alumno.nombre} ${alumno.apellidoPaterno || ''} ${alumno.apellidoMaterno || ''}`.trim(),
                    registros: regMap
                };
            });

            await apiClient.post('/api/tablas-matematicas/evaluar', {
                grupoNombre: selectedGrupo,
                evaluaciones: evaluacionesArray
            });

            if (addNotification) addNotification(`Tablas Matemáticas de ${selectedGrupo} guardadas con éxito`, 'success');
        } catch (err) {
            console.error(err);
            if (addNotification) addNotification('Error al guardar las evaluaciones', 'error');
        } finally {
            setSaving(false);
        }
    };

    const isAdminUser = user && (user.role === 'admin' || user.role === 'superadmin');

    return (
        <div className="tablas-matematicas-page">
            <header className="tablas-header">
                <h1><FaCalculator className="header-icon" /> Evaluación de Tablas Matemáticas</h1>
                <p>Captura por periodos y tablas (Incompleta, En orden, Salteadas) por cada grupo.</p>
            </header>

            {/* BARRA DE PESTAÑAS DE GRUPOS (1A a 3E) */}
            <div className="grupos-tabs-container">
                {GRUPOS_TABLAS.map(grupo => (
                    <button
                        key={grupo}
                        className={`tab-btn ${selectedGrupo === grupo ? 'active' : ''}`}
                        onClick={() => setSelectedGrupo(grupo)}
                    >
                        {grupo}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading-state">Cargando la matriz del grupo {selectedGrupo}...</div>
            ) : (
                <div className="tablas-content-card">
                    <div className="grupo-meta-bar">
                        <h2>Grupo {selectedGrupo}</h2>
                        
                        <div className="evaluador-select-container">
                            <label><FaUserCheck /> Docente Evaluador:</label>
                            {isAdminUser ? (
                                <select
                                    value={selectedEvaluadorId}
                                    onChange={handleEvaluadorChange}
                                    className="evaluador-select"
                                >
                                    <option value="">-- Sin Evaluador Asignado --</option>
                                    {profesoresList.map(prof => (
                                        <option key={prof._id} value={prof._id}>
                                            {prof.nombre} ({prof.email})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span className="evaluador-name">
                                    {profesoresList.find(p => p._id === selectedEvaluadorId)?.nombre || 'Sin asignar'}
                                </span>
                            )}
                        </div>
                    </div>

                    {alumnosGrupo.length === 0 ? (
                        <div className="empty-roster-msg">
                            No hay alumnos registrados en el grupo {selectedGrupo}.
                        </div>
                    ) : (
                        <div className="matrix-table-wrapper">
                            <table className="matrix-table">
                                <thead>
                                    {/* Fila 1 de Encabezados: N°, Nombre y Periodos */}
                                    <tr>
                                        <th rowSpan="2" className="sticky-col num-col">N°</th>
                                        <th rowSpan="2" className="sticky-col name-col">NOMBRE DEL ALUMNO</th>
                                        {PERIODOS_CONFIG.map(p => (
                                            <th key={p.key} colSpan={p.tablas.length} className="periodo-header">
                                                {p.name}
                                            </th>
                                        ))}
                                    </tr>
                                    {/* Fila 2 de Encabezados: Números de Tablas */}
                                    <tr>
                                        {PERIODOS_CONFIG.map(p => (
                                            p.tablas.map((tNum, idx) => (
                                                <th key={`${p.key}_${tNum}_${idx}`} className="tabla-num-header">
                                                    {tNum}
                                                </th>
                                            ))
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {alumnosGrupo.map((alumno, index) => {
                                        const id = String(alumno._id || alumno.id);
                                        const alumnoMatrix = matrix[id] || {};

                                        return (
                                            <tr key={id}>
                                                <td className="sticky-col num-col">{index + 1}</td>
                                                <td className="sticky-col name-col">
                                                    {alumno.nombre} {alumno.apellidoPaterno} {alumno.apellidoMaterno}
                                                </td>
                                                {PERIODOS_CONFIG.map(p => (
                                                    p.tablas.map((tNum, idx) => {
                                                        const cellKey = `${p.key}_t${tNum}_i${idx}`;
                                                        const val = alumnoMatrix[cellKey] || '';
                                                        const matchedOpt = OPTIONS.find(o => o.value === val) || OPTIONS[0];

                                                        return (
                                                            <td key={cellKey} className="matrix-cell">
                                                                <select
                                                                    value={val}
                                                                    onChange={(e) => handleCellChange(id, cellKey, e.target.value)}
                                                                    className={`status-select ${matchedOpt.colorClass}`}
                                                                >
                                                                    {OPTIONS.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>
                                                                            {opt.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                        );
                                                    })
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className="actions-bar">
                                <button
                                    className="btn-save-tablas"
                                    onClick={handleSaveEvaluations}
                                    disabled={saving}
                                >
                                    <FaSave /> {saving ? 'Guardando...' : `Guardar Tablas Matemáticas (${selectedGrupo})`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TablasMatematicas;
