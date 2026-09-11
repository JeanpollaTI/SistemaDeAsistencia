import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from '../COMPONENTE/NotificationContext';
import './TablasMatematicas.css';

const GRUPOS_TABLAS = [
    '1A', '1B', '1C', '1D', '1E',
    '2A', '2B', '2C', '2D', '2E',
    '3A', '3B', '3C', '3D', '3E'
];

const TablasMatematicas = ({ user }) => {
    const { addNotification } = useNotification() || {};
    const [selectedGrupo, setSelectedGrupo] = useState('1A');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [profesoresList, setProfesoresList] = useState([]);
    const [alumnosGrupo, setAlumnosGrupo] = useState([]);
    const [selectedEvaluadorId, setSelectedEvaluadorId] = useState('');
    const [scores, setScores] = useState({}); // { alumno_id: { puntaje: number, observacion: string } }

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

            // Populate current group's evaluator and scores
            const currentRecord = fetchedTablas.find(t => t.grupoNombre === selectedGrupo);
            if (currentRecord) {
                const evalId = currentRecord.evaluador_id?._id || currentRecord.evaluador_id || '';
                setSelectedEvaluadorId(evalId);

                const existingScores = {};
                (currentRecord.evaluaciones || []).forEach(ev => {
                    existingScores[ev.alumno_id] = {
                        puntaje: ev.puntaje ?? 0,
                        observacion: ev.observacion || ''
                    };
                });
                setScores(existingScores);
            } else {
                setSelectedEvaluadorId('');
                setScores({});
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

    const handleScoreChange = (alumnoId, field, value) => {
        setScores(prev => ({
            ...prev,
            [alumnoId]: {
                ...prev[alumnoId],
                [field]: value
            }
        }));
    };

    const handleSaveEvaluations = async () => {
        setSaving(true);
        try {
            const evaluacionesArray = alumnosGrupo.map(alumno => {
                const id = alumno._id || alumno.id;
                const scoreData = scores[id] || { puntaje: 0, observacion: '' };
                return {
                    alumno_id: String(id),
                    alumnoNombre: `${alumno.nombre} ${alumno.apellidoPaterno || ''} ${alumno.apellidoMaterno || ''}`.trim(),
                    puntaje: parseFloat(scoreData.puntaje) || 0,
                    observacion: scoreData.observacion || ''
                };
            });

            await apiClient.post('/api/tablas-matematicas/evaluar', {
                grupoNombre: selectedGrupo,
                evaluaciones: evaluacionesArray
            });

            if (addNotification) addNotification(`Evaluaciones de ${selectedGrupo} guardadas con éxito`, 'success');
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
                <h1>🧮 Evaluación de Tablas Matemáticas</h1>
                <p>Captura y seguimiento de la habilidad en tablas matemáticas por grupo.</p>
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
                <div className="loading-state">Cargando evaluaciones del grupo {selectedGrupo}...</div>
            ) : (
                <div className="tablas-content-card">
                    <div className="grupo-meta-bar">
                        <h2>Grupo {selectedGrupo}</h2>
                        
                        <div className="evaluador-select-container">
                            <label>Docente Evaluador:</label>
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
                        <div className="evaluacion-table-wrapper">
                            <table className="evaluacion-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Nombre del Alumno</th>
                                        <th>Calificación (0 - 10)</th>
                                        <th>Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alumnosGrupo.map((alumno, index) => {
                                        const id = alumno._id || alumno.id;
                                        const scoreObj = scores[id] || { puntaje: 0, observacion: '' };
                                        return (
                                            <tr key={id || index}>
                                                <td>{index + 1}</td>
                                                <td className="alumno-name-cell">
                                                    {alumno.nombre} {alumno.apellidoPaterno} {alumno.apellidoMaterno}
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="10"
                                                        step="0.5"
                                                        value={scoreObj.puntaje}
                                                        onChange={(e) => handleScoreChange(id, 'puntaje', e.target.value)}
                                                        className="score-input"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        placeholder="Comentarios u observaciones..."
                                                        value={scoreObj.observacion}
                                                        onChange={(e) => handleScoreChange(id, 'observacion', e.target.value)}
                                                        className="obs-input"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className="actions-bar">
                                <button
                                    className="btn btn-primary btn-save-tablas"
                                    onClick={handleSaveEvaluations}
                                    disabled={saving}
                                >
                                    {saving ? 'Guardando...' : '💾 Guardar Calificaciones de ' + selectedGrupo}
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
