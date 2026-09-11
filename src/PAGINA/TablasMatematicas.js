import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from '../COMPONENTE/NotificationContext';
import { FaSave, FaUserCheck, FaCalculator, FaSearch, FaChevronDown, FaExclamationTriangle, FaEye } from 'react-icons/fa';
import './TablasMatematicas.css';

const GRUPOS_TABLAS = [
    '1A', '1B', '1C', '1D', '1E',
    '2A', '2B', '2C', '2D', '2E',
    '3A', '3B', '3C', '3D', '3E'
];

const PERIODOS_CONFIG = [
    { name: 'Primer periodo', key: 'p1', tablas: [1, 2, 3, 4, 5] },
    { name: 'Segundo Periodo', key: 'p2', tablas: [1, 2, 3, 4, 5] },
    { name: 'Tercer Periodo', key: 'p3', tablas: [6, 7, 8, 9, 10] },
    { name: 'Cuarto Periodo', key: 'p4', tablas: [1, 2, 3, 4, 5] },
    { name: 'Quinto Periodo', key: 'p5', tablas: [1, 2, 3, 4, 5] },
    { name: 'Sexto Periodo', key: 'p6', tablas: [6, 7, 8, 9, 10] },
    { name: 'Séptimo Periodo', key: 'p7', tablas: [6, 7, 8, 9, 10] }
];

const STATUS_CYCLE = ['', 'Incompleta', 'En orden', 'Salteadas'];

const OPTIONS = [
    { value: '', label: '-', fullText: 'Sin evaluar', colorClass: 'badge-empty' },
    { value: 'Incompleta', label: 'I', fullText: 'Incompleta', colorClass: 'badge-incompleta' },
    { value: 'En orden', label: 'O', fullText: 'En orden', colorClass: 'badge-enorden' },
    { value: 'Salteadas', label: 'S', fullText: 'Salteadas', colorClass: 'badge-salteadas' }
];

const TablasMatematicas = ({ user }) => {
    const { addNotification } = useNotification() || {};
    const [selectedGrupo, setSelectedGrupo] = useState('1A');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAdminTablePreview, setShowAdminTablePreview] = useState(false);
    
    const [allTablasData, setAllTablasData] = useState([]);
    const [profesoresList, setProfesoresList] = useState([]);
    const [searchTeacherTerm, setSearchTeacherTerm] = useState('');
    const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
    const [alumnosGrupo, setAlumnosGrupo] = useState([]);
    const [selectedEvaluadorId, setSelectedEvaluadorId] = useState('');
    
    const comboboxRef = useRef(null);

    // Matrix data: { [alumno_id]: { [p_t_key]: "Incompleta" | "En orden" | "Salteadas" | "" } }
    const [matrix, setMatrix] = useState({});

    const isAdminUser = user && (user.role === 'admin' || user.role === 'superadmin');
    const isProfesorUser = user && user.role === 'profesor';

    // Close combobox dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
                setIsTeacherDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch all math tables records and group roster
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tablasRes, gruposRes] = await Promise.all([
                apiClient.get('/api/tablas-matematicas'),
                apiClient.get('/grupos')
            ]);

            const fetchedTablas = tablasRes.data.tablas || [];
            setAllTablasData(fetchedTablas);

            const profs = tablasRes.data.profesores || [];
            setProfesoresList(profs);

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

                const assignedProf = profs.find(p => p._id === evalId);
                setSearchTeacherTerm(assignedProf ? `${assignedProf.nombre} (${assignedProf.email})` : '');

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
                setSearchTeacherTerm('');
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

    // Find assigned groups for current teacher
    const teacherAssignedGrupos = GRUPOS_TABLAS.filter(grupoNombre => {
        const record = allTablasData.find(t => t.grupoNombre === grupoNombre);
        if (!record) return false;

        const evalId = record.evaluador_id?._id || record.evaluador_id || '';
        const currentUserId = String(user?._id || user?.id || '');

        if (String(evalId) === currentUserId) return true;

        if (Array.isArray(record.evaluadores)) {
            return record.evaluadores.some(e => String(e._id || e) === currentUserId);
        }

        return false;
    });

    // Ensure selectedGrupo is valid for profesor
    useEffect(() => {
        if (isProfesorUser && teacherAssignedGrupos.length > 0 && !teacherAssignedGrupos.includes(selectedGrupo)) {
            setSelectedGrupo(teacherAssignedGrupos[0]);
        }
    }, [isProfesorUser, teacherAssignedGrupos, selectedGrupo]);

    const handleSelectEvaluador = async (evaluadorId) => {
        setSelectedEvaluadorId(evaluadorId);
        const prof = profesoresList.find(p => p._id === evaluadorId);
        setSearchTeacherTerm(prof ? `${prof.nombre} (${prof.email})` : '');
        setIsTeacherDropdownOpen(false);

        try {
            await apiClient.post('/api/tablas-matematicas/evaluador', {
                grupoNombre: selectedGrupo,
                evaluador_id: evaluadorId || null
            });
            if (addNotification) addNotification(`Evaluador actualizado para ${selectedGrupo}`, 'success');
            fetchData();
        } catch (err) {
            console.error(err);
            if (addNotification) addNotification('Error al asignar evaluador', 'error');
        }
    };

    const handleCellClick = (alumnoId, cellKey) => {
        // La administradora en vista previa NO puede modificar los valores. Solo el docente asignado.
        if (!isProfesorUser) return;

        setMatrix(prev => {
            const currentVal = prev[alumnoId]?.[cellKey] || '';
            const currentIndex = STATUS_CYCLE.indexOf(currentVal);
            const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
            const nextVal = STATUS_CYCLE[nextIndex];

            return {
                ...prev,
                [alumnoId]: {
                    ...(prev[alumnoId] || {}),
                    [cellKey]: nextVal
                }
            };
        });
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

    const filteredProfesores = profesoresList.filter(prof => {
        if (!searchTeacherTerm.trim()) return true;
        const term = searchTeacherTerm.toLowerCase();
        const nameMatch = prof.nombre?.toLowerCase().includes(term);
        const emailMatch = prof.email?.toLowerCase().includes(term);
        return nameMatch || emailMatch;
    });

    // Calculate group performance stats for Admin View
    const totalCells = alumnosGrupo.length * 35;
    let evaluatedCount = 0;
    let counts = { I: 0, O: 0, S: 0, empty: 0 };

    alumnosGrupo.forEach(alumno => {
        const id = String(alumno._id || alumno.id);
        const alumnoObj = matrix[id] || {};
        PERIODOS_CONFIG.forEach(p => {
            p.tablas.forEach((tNum, idx) => {
                const cellKey = `${p.key}_t${tNum}_i${idx}`;
                const val = alumnoObj[cellKey] || '';
                if (val === 'Incompleta') counts.I++;
                else if (val === 'En orden') counts.O++;
                else if (val === 'Salteadas') counts.S++;
                else counts.empty++;

                if (val) evaluatedCount++;
            });
        });
    });

    const progressPercent = totalCells > 0 ? Math.round((evaluatedCount / totalCells) * 100) : 0;
    const assignedProfesorObj = profesoresList.find(p => p._id === selectedEvaluadorId);

    // Groups available to show in tab bar
    const availableTabs = isAdminUser ? GRUPOS_TABLAS : teacherAssignedGrupos;

    return (
        <div className="tablas-matematicas-page">
            <header className="tablas-header">
                <h1><FaCalculator className="header-icon" /> Evaluación de Tablas Matemáticas</h1>
                <p>
                    {isAdminUser 
                        ? 'Asignación de docentes evaluadores y seguimiento del rendimiento por grupo.' 
                        : 'Captura rápida con clics por 7 periodos (Incompleta, En orden, Salteadas) de tus grupos asignados.'}
                </p>
            </header>

            {/* UNASSIGNED TEACHER NOTICE */}
            {isProfesorUser && teacherAssignedGrupos.length === 0 && !loading && (
                <div className="unassigned-notice-card animated-fade">
                    <div className="unassigned-icon"><FaExclamationTriangle /></div>
                    <h2>No tienes ningún grupo asignado</h2>
                    <p>
                        Actualmente no cuentas con ningún grupo asignado para evaluar las Tablas Matemáticas. 
                        Por favor, solicita a tu <strong>Administrador o Supervisor</strong> de la escuela que te asigne los grupos correspondientes.
                    </p>
                </div>
            )}

            {/* BARRA DE PESTAÑAS DE GRUPOS */}
            {availableTabs.length > 0 && (
                <div className="grupos-tabs-container">
                    {availableTabs.map(grupo => (
                        <button
                            key={grupo}
                            className={`tab-btn ${selectedGrupo === grupo ? 'active' : ''}`}
                            onClick={() => setSelectedGrupo(grupo)}
                        >
                            {grupo}
                        </button>
                    ))}
                </div>
            )}

            {loading && availableTabs.length > 0 && (
                <div className="loading-state">Cargando datos del grupo {selectedGrupo}...</div>
            )}

            {!loading && availableTabs.length > 0 && (
                <div className="tablas-content-card">
                    <div className="grupo-meta-bar">
                        <h2>Grupo {selectedGrupo}</h2>
                        
                        {/* ASIGNACIÓN DE DOCENTE (ADMIN SOLAMENTE) */}
                        {isAdminUser && (
                            <div className="evaluador-select-container">
                                <label><FaUserCheck /> Asignar Evaluador:</label>
                                <div className="evaluador-fused-combobox" ref={comboboxRef}>
                                    <div className="combobox-input-wrapper">
                                        <FaSearch className="combobox-icon" />
                                        <input
                                            type="text"
                                            className="combobox-input"
                                            placeholder="Buscar docente para asignar..."
                                            value={searchTeacherTerm}
                                            onFocus={() => setIsTeacherDropdownOpen(true)}
                                            onChange={(e) => {
                                                setSearchTeacherTerm(e.target.value);
                                                setIsTeacherDropdownOpen(true);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="combobox-toggle-arrow"
                                            onClick={() => setIsTeacherDropdownOpen(prev => !prev)}
                                            title="Desplegar docentes"
                                        >
                                            <FaChevronDown />
                                        </button>
                                    </div>

                                    {isTeacherDropdownOpen && (
                                        <ul className="combobox-dropdown-list">
                                            <li
                                                className={`combobox-item ${!selectedEvaluadorId ? 'selected' : ''}`}
                                                onClick={() => handleSelectEvaluador('')}
                                            >
                                                -- Sin Evaluador Asignado --
                                            </li>
                                            {filteredProfesores.length > 0 ? (
                                                filteredProfesores.map(prof => (
                                                    <li
                                                        key={prof._id}
                                                        className={`combobox-item ${selectedEvaluadorId === prof._id ? 'selected' : ''}`}
                                                        onClick={() => handleSelectEvaluador(prof._id)}
                                                    >
                                                        <span className="prof-name">{prof.nombre}</span>
                                                        <span className="prof-email"> ({prof.email})</span>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="combobox-no-results">
                                                    Sin resultados para "{searchTeacherTerm}"
                                                </li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* DOCENTE ASIGNADO (DOCENTE O ADMIN) */}
                        {!isAdminUser && (
                            <div className="evaluador-select-container">
                                <label><FaUserCheck /> Evaluador Asignado:</label>
                                <span className="evaluador-name">
                                    {assignedProfesorObj?.nombre || 'Sin asignar'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* VISTA ADMINISTRADOR: RESUMEN Y RENDIMIENTO DEL GRUPO */}
                    {isAdminUser && (
                        <div className="admin-performance-dashboard">
                            <div className="performance-cards-grid">
                                <div className="perf-card">
                                    <span className="perf-label">Docente Evaluador</span>
                                    <strong className="perf-value-text">
                                        {assignedProfesorObj ? assignedProfesorObj.nombre : 'Sin Asignar'}
                                    </strong>
                                    {assignedProfesorObj && (
                                        <span className="perf-subtext">{assignedProfesorObj.email}</span>
                                    )}
                                </div>

                                <div className="perf-card">
                                    <span className="perf-label">Alumnos Registrados</span>
                                    <strong className="perf-value-num">{alumnosGrupo.length}</strong>
                                    <span className="perf-subtext">Alumnos en {selectedGrupo}</span>
                                </div>

                                <div className="perf-card">
                                    <span className="perf-label">Avance de Evaluación</span>
                                    <strong className="perf-value-num">{progressPercent}%</strong>
                                    <div className="progress-bar-container">
                                        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                                    </div>
                                </div>

                                <div className="perf-card">
                                    <span className="perf-label">Desglose de Calificaciones</span>
                                    <div className="perf-metrics-row">
                                        <span className="badge-item badge-salteadas">🟢 S: {counts.S}</span>
                                        <span className="badge-item badge-enorden">🟡 O: {counts.O}</span>
                                        <span className="badge-item badge-incompleta">🔴 I: {counts.I}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="admin-preview-toggle-bar">
                                <button
                                    type="button"
                                    className="btn-toggle-preview"
                                    onClick={() => setShowAdminTablePreview(prev => !prev)}
                                >
                                    <FaEye /> {showAdminTablePreview ? 'Ocultar Vista Previa de Tabla' : 'Ver Vista Previa de Tabla de Evaluaciones'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* VISTA TABLA DE EVALUACIÓN (PROFESORES O ADMIN PREVIEW) */}
                    {(isProfesorUser || (isAdminUser && showAdminTablePreview)) && (
                        <>
                            <div className="table-legend-bar">
                                <span className="legend-title">
                                    {isAdminUser ? 'Vista Previa (Solo Lectura - El administrador no altera valores):' : 'Modo Clics:'}
                                </span>
                                <span className="legend-item badge-incompleta">1 Clic ➔ 🔴 <strong>I</strong> (Incompleta)</span>
                                <span className="legend-item badge-enorden">2 Clics ➔ 🟡 <strong>O</strong> (En orden)</span>
                                <span className="legend-item badge-salteadas">3 Clics ➔ 🟢 <strong>S</strong> (Salteadas)</span>
                                <span className="legend-item badge-empty">4 Clics ➔ ⚪ <strong>-</strong> (Limpiar)</span>
                            </div>

                            {alumnosGrupo.length === 0 ? (
                                <div className="empty-roster-msg">
                                    No hay alumnos registrados en el grupo {selectedGrupo}.
                                </div>
                            ) : (
                                <div className="matrix-table-wrapper">
                                    <table className="matrix-table">
                                        <thead>
                                            <tr>
                                                <th rowSpan="2" className="sticky-col num-col">N°</th>
                                                <th rowSpan="2" className="sticky-col name-col">NOMBRE DEL ALUMNO</th>
                                                {PERIODOS_CONFIG.map(p => (
                                                    <th key={p.key} colSpan={p.tablas.length} className="periodo-header">
                                                        {p.name}
                                                    </th>
                                                ))}
                                            </tr>
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
                                                const fullStudentName = `${alumno.nombre} ${alumno.apellidoPaterno || ''} ${alumno.apellidoMaterno || ''}`.trim();

                                                return (
                                                    <tr key={id}>
                                                        <td className="sticky-col num-col">{index + 1}</td>
                                                        <td className="sticky-col name-col" title={fullStudentName}>
                                                            {fullStudentName}
                                                        </td>
                                                        {PERIODOS_CONFIG.map(p => (
                                                            p.tablas.map((tNum, idx) => {
                                                                const cellKey = `${p.key}_t${tNum}_i${idx}`;
                                                                const val = alumnoMatrix[cellKey] || '';
                                                                const matchedOpt = OPTIONS.find(o => o.value === val) || OPTIONS[0];

                                                                return (
                                                                    <td key={cellKey} className="matrix-cell">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleCellClick(id, cellKey)}
                                                                            disabled={!isProfesorUser}
                                                                            className={`status-btn ${matchedOpt.colorClass} ${!isProfesorUser ? 'readonly-btn' : ''}`}
                                                                            title={
                                                                                isProfesorUser
                                                                                    ? `${matchedOpt.fullText} (Tabla ${tNum} - ${p.name}). Clic para cambiar.`
                                                                                    : `${matchedOpt.fullText} (Tabla ${tNum} - ${p.name}) - Solo Lectura`
                                                                            }
                                                                        >
                                                                            {matchedOpt.label}
                                                                        </button>
                                                                    </td>
                                                                );
                                                            })
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* BOTÓN FLOTANTE CIRCULAR FIJO EN LA ESQUINA INFERIOR DERECHA (SOLO PARA DOCENTES QUE EVALÚAN) */}
            {isProfesorUser && (
                <button
                    type="button"
                    className="btn-save-fab"
                    onClick={handleSaveEvaluations}
                    disabled={saving}
                    title={`Guardar Tablas Matemáticas (${selectedGrupo})`}
                >
                    <FaSave className="fab-icon" />
                </button>
            )}
        </div>
    );
};

export default TablasMatematicas;
