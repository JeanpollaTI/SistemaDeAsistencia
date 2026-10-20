import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from '../COMPONENTE/NotificationContext';
import {
    FaSave,
    FaUserCheck,
    FaCalculator,
    FaSearch,
    FaChevronDown,
    FaExclamationTriangle,
    FaEye,
    FaCog,
    FaUsersCog,
    FaSyncAlt
} from 'react-icons/fa';
import './TablasMatematicas.css';

const GRUPOS_TABLAS_BASE = [
    '1A', '1B', '1C', '1D', '1E',
    '2A', '2B', '2C', '2D', '2E',
    '3A', '3B', '3C', '3D', '3E'
];

const PERIODOS_BASE = [
    { name: '1° Corte (Primer Periodo)', shortName: 'Primer Periodo', key: 'p1', defaultRange: '1-5' },
    { name: '2° Corte (Segundo Periodo)', shortName: 'Segundo Periodo', key: 'p2', defaultRange: '1-5' },
    { name: '3° Corte (Tercer Periodo)', shortName: 'Tercer Periodo', key: 'p3', defaultRange: '1-5' },
    { name: '4° Corte (Cuarto Periodo)', shortName: 'Cuarto Periodo', key: 'p4', defaultRange: '1-5' },
    { name: '5° Corte (Quinto Periodo)', shortName: 'Quinto Periodo', key: 'p5', defaultRange: '6-10' },
    { name: '6° Corte (Sexto Periodo)', shortName: 'Sexto Periodo', key: 'p6', defaultRange: '6-10' },
    { name: '7° Corte (Séptimo Periodo)', shortName: 'Séptimo Periodo', key: 'p7', defaultRange: '6-10' }
];

const DEFAULT_CORTES_CONFIG = {
    p1: '1-5',
    p2: '1-5',
    p3: '1-5',
    p4: '1-5',
    p5: '6-10',
    p6: '6-10',
    p7: '6-10'
};

const getTablasForRange = (rangeStr) => {
    if (rangeStr === '6-10') return [6, 7, 8, 9, 10];
    return [1, 2, 3, 4, 5];
};

const normalizeGroupName = (name = '') =>
    String(name).toUpperCase().replace(/[°º\s-]/g, '').trim();

const formatTeacherFullName = (prof) => {
    if (!prof) return '';
    return `${prof.apellidoPaterno || ''} ${prof.apellidoMaterno || ''} ${prof.nombre || ''}`.replace(/\s+/g, ' ').trim();
};

const STATUS_CYCLE = ['', 'Incompleta', 'En orden', 'Salteadas'];

const OPTIONS = [
    { value: '', label: '-', fullText: 'Sin evaluar', colorClass: 'badge-empty' },
    { value: 'Incompleta', label: 'I', fullText: 'Incompleta', colorClass: 'badge-incompleta' },
    { value: 'En orden', label: 'O', fullText: 'En orden', colorClass: 'badge-enorden' },
    { value: 'Salteadas', label: 'S', fullText: 'Salteadas', colorClass: 'badge-salteadas' }
];

const sortAlumnosWithStatus = (alumnosList = []) => {
    const reg = [];
    const nuevos = [];

    (alumnosList || []).forEach(a => {
        if (a.esNuevoIngreso) {
            nuevos.push(a);
        } else {
            reg.push(a);
        }
    });

    const sortFn = (a, b) => {
        const resP = (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '', undefined, { sensitivity: 'base' });
        if (resP !== 0) return resP;
        const resM = (a.apellidoMaterno || '').localeCompare(b.apellidoMaterno || '', undefined, { sensitivity: 'base' });
        if (resM !== 0) return resM;
        return (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' });
    };

    reg.sort(sortFn);
    nuevos.sort(sortFn);

    return [...reg, ...nuevos];
};

const TablasMatematicas = ({ user }) => {
    const { addNotification } = useNotification() || {};
    const [selectedGrupo, setSelectedGrupo] = useState('1A');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [showAdminTablePreview, setShowAdminTablePreview] = useState(true);
    const [showCortesConfigPanel, setShowCortesConfigPanel] = useState(false);
    const [showBulkAssignPanel, setShowBulkAssignPanel] = useState(false);

    const [allTablasData, setAllTablasData] = useState([]);
    const [allSchoolGrupos, setAllSchoolGrupos] = useState([]);
    const [profesoresList, setProfesoresList] = useState([]);
    const [searchTeacherTerm, setSearchTeacherTerm] = useState('');
    const [isSearchingTeacher, setIsSearchingTeacher] = useState(false);
    const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
    const [alumnosGrupo, setAlumnosGrupo] = useState([]);
    const [selectedEvaluadorId, setSelectedEvaluadorId] = useState('');
    const [cortesConfig, setCortesConfig] = useState({ ...DEFAULT_CORTES_CONFIG });

    const comboboxRef = useRef(null);

    // Matrix data: { [alumno_id]: { [p_t_key]: "Incompleta" | "En orden" | "Salteadas" | "" } }
    const [matrix, setMatrix] = useState({});

    const isAdminUser = user && (user.role === 'admin' || user.role === 'superadmin');
    const isProfesorUser = user && user.role === 'profesor';
    const currentUserId = String(user?._id || user?.id || '');

    // Close combobox dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
                setIsTeacherDropdownOpen(false);
                setIsSearchingTeacher(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Build unified list of groups (base 1A..3E + any custom groups from /grupos)
    const gruposCatalogo = React.useMemo(() => {
        const list = [...GRUPOS_TABLAS_BASE];
        allSchoolGrupos.forEach(g => {
            const norm = normalizeGroupName(g.nombre);
            if (norm && !list.some(item => normalizeGroupName(item) === norm)) {
                list.push(g.nombre.trim());
            }
        });
        return list;
    }, [allSchoolGrupos]);

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

            const allGrupos = gruposRes.data || [];
            setAllSchoolGrupos(allGrupos);

            const normSelected = normalizeGroupName(selectedGrupo);
            const currentGrupoData = allGrupos.find(g => normalizeGroupName(g.nombre) === normSelected);

            const rawAlumnos = currentGrupoData?.alumnos || [];
            const alumnos = sortAlumnosWithStatus(rawAlumnos);
            setAlumnosGrupo(alumnos);

            // Populate current group's evaluator, cortesConfig, and matrix
            const currentRecord = fetchedTablas.find(t => normalizeGroupName(t.grupoNombre) === normSelected);
            if (currentRecord) {
                const evalId = currentRecord.evaluador_id?._id || currentRecord.evaluador_id || '';
                setSelectedEvaluadorId(evalId);

                const assignedProf = profs.find(p => String(p._id) === String(evalId));
                setSearchTeacherTerm(assignedProf ? `${formatTeacherFullName(assignedProf)} (${assignedProf.email})` : '');
                setIsSearchingTeacher(false);

                // Load cortesConfig for this group (or fallback to default 1-4: 1-5, 5-7: 6-10)
                const rawCortes = currentRecord.cortesConfig instanceof Map
                    ? Object.fromEntries(currentRecord.cortesConfig)
                    : (currentRecord.cortesConfig || {});
                setCortesConfig({
                    ...DEFAULT_CORTES_CONFIG,
                    ...rawCortes
                });

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
                setIsSearchingTeacher(false);
                // Check if any other group has a saved cortesConfig in the school, else use default
                const anyRecordWithConfig = fetchedTablas.find(t => t.cortesConfig && Object.keys(t.cortesConfig).length > 0);
                if (anyRecordWithConfig) {
                    const rawCortes = anyRecordWithConfig.cortesConfig instanceof Map
                        ? Object.fromEntries(anyRecordWithConfig.cortesConfig)
                        : (anyRecordWithConfig.cortesConfig || {});
                    setCortesConfig({ ...DEFAULT_CORTES_CONFIG, ...rawCortes });
                } else {
                    setCortesConfig({ ...DEFAULT_CORTES_CONFIG });
                }
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

    // Find assigned groups specifically for this activity for current teacher
    const teacherAssignedGrupos = React.useMemo(() => {
        const assigned = [];
        allTablasData.forEach(record => {
            const evalId = String(record.evaluador_id?._id || record.evaluador_id || '');
            const inEvaluadores = Array.isArray(record.evaluadores) &&
                record.evaluadores.some(e => String(e._id || e) === currentUserId);

            if ((evalId && evalId === currentUserId) || inEvaluadores) {
                if (record.grupoNombre && !assigned.includes(record.grupoNombre)) {
                    assigned.push(record.grupoNombre);
                }
            }
        });
        // Sort following gruposCatalogo order
        return assigned.sort((a, b) => {
            const idxA = gruposCatalogo.findIndex(g => normalizeGroupName(g) === normalizeGroupName(a));
            const idxB = gruposCatalogo.findIndex(g => normalizeGroupName(g) === normalizeGroupName(b));
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
    }, [allTablasData, currentUserId, gruposCatalogo]);

    // Ensure selectedGrupo is valid for profesor (strictly only their assigned groups in Tablas)
    useEffect(() => {
        if (isProfesorUser && teacherAssignedGrupos.length > 0) {
            const hasSelected = teacherAssignedGrupos.some(
                g => normalizeGroupName(g) === normalizeGroupName(selectedGrupo)
            );
            if (!hasSelected) {
                setSelectedGrupo(teacherAssignedGrupos[0]);
            }
        }
    }, [isProfesorUser, teacherAssignedGrupos, selectedGrupo]);

    const handleSelectEvaluador = async (evaluadorId, targetGrupo = selectedGrupo) => {
        if (targetGrupo === selectedGrupo) {
            setSelectedEvaluadorId(evaluadorId);
            const prof = profesoresList.find(p => String(p._id) === String(evaluadorId));
            setSearchTeacherTerm(prof ? `${formatTeacherFullName(prof)} (${prof.email})` : '');
            setIsSearchingTeacher(false);
            setIsTeacherDropdownOpen(false);
        }

        try {
            await apiClient.post('/api/tablas-matematicas/evaluador', {
                grupoNombre: targetGrupo,
                evaluador_id: evaluadorId || null,
                evaluadores: evaluadorId ? [evaluadorId] : []
            });
            if (addNotification) {
                addNotification(
                    evaluadorId
                        ? `Docente evaluador asignado al grupo ${targetGrupo}`
                        : `Se removió el evaluador del grupo ${targetGrupo}`,
                    'success'
                );
            }
            fetchData();
        } catch (err) {
            console.error(err);
            if (addNotification) addNotification('Error al asignar evaluador', 'error');
        }
    };

    const handleChangeCorteRange = (periodoKey, newRange) => {
        setCortesConfig(prev => ({
            ...prev,
            [periodoKey]: newRange
        }));
    };

    const handleSaveCortesConfig = async (applyToAll = true) => {
        setSavingConfig(true);
        try {
            await apiClient.post('/api/tablas-matematicas/config-cortes', {
                grupoNombre: selectedGrupo,
                cortesConfig,
                applyToAll,
                allGrupos: gruposCatalogo
            });
            if (addNotification) {
                addNotification(
                    applyToAll
                        ? 'Configuración de rangos por corte aplicada a todos los grupos'
                        : `Configuración de rangos guardada para el grupo ${selectedGrupo}`,
                    'success'
                );
            }
            fetchData();
        } catch (err) {
            console.error(err);
            if (addNotification) addNotification('Error al guardar configuración de cortes', 'error');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleResetDefaultCortes = () => {
        setCortesConfig({ ...DEFAULT_CORTES_CONFIG });
    };

    // Build dynamic PERIODOS_CONFIG from state cortesConfig
    const periodosActivos = React.useMemo(() => {
        return PERIODOS_BASE.map(p => {
            const range = cortesConfig[p.key] || p.defaultRange;
            return {
                ...p,
                range,
                tablas: getTablasForRange(range)
            };
        });
    }, [cortesConfig]);

    // Helper to read cell value with fallback if range was changed (e.g. p3_t1_i0 vs p3_t6_i0)
    const getCellValue = useCallback((alumnoObj, pKey, tNum, idx) => {
        if (!alumnoObj) return '';
        const exactKey = `${pKey}_t${tNum}_i${idx}`;
        if (alumnoObj[exactKey] !== undefined) return alumnoObj[exactKey];
        // Check fallback key from same period and column index
        const altNum = tNum <= 5 ? tNum + 5 : tNum - 5;
        const altKey = `${pKey}_t${altNum}_i${idx}`;
        return alumnoObj[altKey] || '';
    }, []);

    // Check if user is assigned to currently selected group
    const currentRecord = allTablasData.find(
        t => normalizeGroupName(t.grupoNombre) === normalizeGroupName(selectedGrupo)
    );
    const evalId = currentRecord?.evaluador_id?._id || currentRecord?.evaluador_id || selectedEvaluadorId;

    const isUserAssignedToCurrentGroup =
        (evalId && String(evalId) === currentUserId) ||
        (Array.isArray(currentRecord?.evaluadores) && currentRecord.evaluadores.some(e => String(e._id || e) === currentUserId));

    const canEditCurrentGroup = (isProfesorUser && isUserAssignedToCurrentGroup) || isAdminUser;

    const handleCellClick = (alumnoId, pKey, tNum, idx) => {
        if (!canEditCurrentGroup) return;

        const cellKey = `${pKey}_t${tNum}_i${idx}`;
        const altNum = tNum <= 5 ? tNum + 5 : tNum - 5;
        const altKey = `${pKey}_t${altNum}_i${idx}`;

        setMatrix(prev => {
            const alumnoObj = prev[alumnoId] || {};
            const currentVal = getCellValue(alumnoObj, pKey, tNum, idx);
            const currentIndex = STATUS_CYCLE.indexOf(currentVal);
            const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
            const nextVal = STATUS_CYCLE[nextIndex];

            const updatedAlumno = { ...alumnoObj, [cellKey]: nextVal };
            if (updatedAlumno[altKey] !== undefined) {
                delete updatedAlumno[altKey];
            }

            return {
                ...prev,
                [alumnoId]: updatedAlumno
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
                    alumnoNombre: `${alumno.apellidoPaterno || ''} ${alumno.apellidoMaterno || ''} ${alumno.nombre || ''}`.replace(/\s+/g, ' ').trim(),
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
        if (!isSearchingTeacher || !searchTeacherTerm.trim()) return true;
        const term = searchTeacherTerm.toLowerCase();
        const fullName = formatTeacherFullName(prof).toLowerCase();
        const emailMatch = prof.email?.toLowerCase().includes(term);
        return fullName.includes(term) || emailMatch;
    });

    // Calculate group performance stats
    const totalCells = alumnosGrupo.length * 35;
    let evaluatedCount = 0;
    let counts = { I: 0, O: 0, S: 0, empty: 0 };

    alumnosGrupo.forEach(alumno => {
        const id = String(alumno._id || alumno.id);
        const alumnoObj = matrix[id] || {};
        periodosActivos.forEach(p => {
            p.tablas.forEach((tNum, idx) => {
                const val = getCellValue(alumnoObj, p.key, tNum, idx);
                if (val === 'Incompleta') counts.I++;
                else if (val === 'En orden') counts.O++;
                else if (val === 'Salteadas') counts.S++;
                else counts.empty++;

                if (val) evaluatedCount++;
            });
        });
    });

    const progressPercent = totalCells > 0 ? Math.round((evaluatedCount / totalCells) * 100) : 0;
    const assignedProfesorObj = profesoresList.find(p => String(p._id) === String(selectedEvaluadorId));

    // Groups available to show in tab bar:
    // Admin sees all catalog groups; Profesor ONLY sees groups assigned specifically for Tablas Matemáticas
    const availableTabs = isAdminUser ? gruposCatalogo : teacherAssignedGrupos;

    return (
        <div className="tablas-matematicas-page">
            <header className="tablas-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1><FaCalculator className="header-icon" /> Registro de Tablas (Cálculo Mental)</h1>
                        <p>
                            {isAdminUser
                                ? 'Asignación dinámica Docente-Grupo, configuración de rangos por corte (1-5 / 6-10) y seguimiento de evaluación.'
                                : `Vista exclusiva de tus grupos asignados para evaluación de Cálculo Mental (${teacherAssignedGrupos.length} ${teacherAssignedGrupos.length === 1 ? 'grupo asignado' : 'grupos asignados'}).`}
                        </p>
                    </div>

                    {isAdminUser && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn-toggle-preview"
                                style={{
                                    background: showBulkAssignPanel ? 'linear-gradient(135deg, #00cbcb, #009999)' : '#252538',
                                    color: showBulkAssignPanel ? '#111' : '#00cbcb',
                                    fontWeight: '700'
                                }}
                                onClick={() => setShowBulkAssignPanel(prev => !prev)}
                            >
                                <FaUsersCog /> {showBulkAssignPanel ? 'Ocultar Asignación Docente-Grupo' : 'Asignación Docente-Grupo (Todos)'}
                            </button>
                            <button
                                type="button"
                                className="btn-toggle-preview"
                                style={{
                                    background: showCortesConfigPanel ? 'linear-gradient(135deg, #00cbcb, #009999)' : '#252538',
                                    color: showCortesConfigPanel ? '#111' : '#00cbcb',
                                    fontWeight: '700'
                                }}
                                onClick={() => setShowCortesConfigPanel(prev => !prev)}
                            >
                                <FaCog /> {showCortesConfigPanel ? 'Ocultar Rangos por Corte' : 'Configurar Rangos por Corte (1-5 / 6-10)'}
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* PANEL ADMIN: ASIGNACIÓN RÁPIDA DOCENTE-GRUPO PARA TODOS LOS GRUPOS */}
            {isAdminUser && showBulkAssignPanel && (
                <div className="tablas-content-card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(0, 203, 203, 0.35)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#00cbcb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaUsersCog /> Matriz de Asignación Dinámica Docente-Grupo (Cálculo Mental)
                            </h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#aaa' }}>
                                Selecciona qué docente evalúa a cada grupo en el módulo de Tablas. El docente solo verá en su cuenta los grupos que tenga asignados aquí.
                            </p>
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: '12px',
                        marginTop: '12px'
                    }}>
                        {gruposCatalogo.map(gNombre => {
                            const rec = allTablasData.find(t => normalizeGroupName(t.grupoNombre) === normalizeGroupName(gNombre));
                            const currentEvalId = rec?.evaluador_id?._id || rec?.evaluador_id || '';
                            return (
                                <div
                                    key={gNombre}
                                    style={{
                                        background: normalizeGroupName(selectedGrupo) === normalizeGroupName(gNombre)
                                            ? 'rgba(0, 203, 203, 0.1)'
                                            : '#14141f',
                                        border: normalizeGroupName(selectedGrupo) === normalizeGroupName(gNombre)
                                            ? '1px solid #00cbcb'
                                            : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '10px',
                                        padding: '10px 12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ color: '#00cbcb', fontSize: '0.95rem' }}>Grupo {gNombre}</strong>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            padding: '2px 7px',
                                            borderRadius: '10px',
                                            background: currentEvalId ? 'rgba(39, 174, 96, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                                            color: currentEvalId ? '#2ecc71' : '#888'
                                        }}>
                                            {currentEvalId ? 'Asignado' : 'Sin evaluador'}
                                        </span>
                                    </div>
                                    <select
                                        value={currentEvalId}
                                        onChange={(e) => handleSelectEvaluador(e.target.value, gNombre)}
                                        style={{
                                            width: '100%',
                                            padding: '7px 10px',
                                            borderRadius: '6px',
                                            background: '#1e1e2d',
                                            color: '#fff',
                                            border: '1px solid rgba(0, 203, 203, 0.3)',
                                            fontSize: '0.84rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">-- Sin Docente Asignado --</option>
                                        {profesoresList.map(prof => (
                                            <option key={prof._id} value={prof._id}>
                                                {formatTeacherFullName(prof)} ({prof.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* PANEL ADMIN: CONFIGURACIÓN DE RANGO DE TABLAS POR CORTE (7 CORTES) */}
            {isAdminUser && showCortesConfigPanel && (
                <div className="tablas-content-card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(0, 203, 203, 0.35)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#00cbcb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaCog /> Configuración de Rango de Tablas por Corte (7 Cortes de Evaluación)
                            </h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#aaa' }}>
                                Por defecto, los primeros cortes (1° al 4°) evalúan las tablas del <strong>1 al 5</strong> y la segunda parte del ciclo escolar (5° al 7° corte) evalúa del <strong>6 al 10</strong>. Puedes personalizar cada corte aquí.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn-toggle-preview"
                                onClick={handleResetDefaultCortes}
                                title="Restablecer: Cortes 1 al 4 (Tablas 1-5) y Cortes 5 al 7 (Tablas 6-10)"
                            >
                                <FaSyncAlt /> Estándar (1°-4°: 1 al 5 | 5°-7°: 6 al 10)
                            </button>
                            <button
                                type="button"
                                className="btn-toggle-preview"
                                onClick={() => handleSaveCortesConfig(false)}
                                disabled={savingConfig}
                            >
                                <FaSave /> Guardar solo en {selectedGrupo}
                            </button>
                            <button
                                type="button"
                                className="btn-toggle-preview"
                                style={{ background: 'linear-gradient(135deg, #00cbcb, #009999)', color: '#111', fontWeight: '800' }}
                                onClick={() => handleSaveCortesConfig(true)}
                                disabled={savingConfig}
                            >
                                <FaSave /> {savingConfig ? 'Guardando...' : 'Aplicar a Todos los Grupos'}
                            </button>
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                        gap: '10px'
                    }}>
                        {PERIODOS_BASE.map((p, idx) => {
                            const currentRange = cortesConfig[p.key] || p.defaultRange;
                            const isSecondHalf = idx >= 4;
                            return (
                                <div
                                    key={p.key}
                                    style={{
                                        background: '#14141f',
                                        border: currentRange === '6-10' ? '1px solid rgba(255, 216, 102, 0.45)' : '1px solid rgba(0, 203, 203, 0.35)',
                                        borderRadius: '10px',
                                        padding: '12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ color: '#fff', fontSize: '0.88rem' }}>Corte {idx + 1}</strong>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 6px',
                                            borderRadius: '6px',
                                            background: isSecondHalf ? 'rgba(255, 216, 102, 0.15)' : 'rgba(0, 203, 203, 0.15)',
                                            color: isSecondHalf ? '#ffd866' : '#00cbcb'
                                        }}>
                                            {isSecondHalf ? '2ª Parte Ciclo' : '1ª Parte Ciclo'}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.78rem', color: '#999' }}>{p.shortName}</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleChangeCorteRange(p.key, '1-5')}
                                            style={{
                                                flex: 1,
                                                padding: '6px 4px',
                                                borderRadius: '6px',
                                                fontSize: '0.78rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                border: currentRange === '1-5' ? '1px solid #00cbcb' : '1px solid rgba(255,255,255,0.1)',
                                                background: currentRange === '1-5' ? 'rgba(0, 203, 203, 0.25)' : '#1e1e2d',
                                                color: currentRange === '1-5' ? '#00cbcb' : '#888'
                                            }}
                                        >
                                            Tablas 1 - 5
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleChangeCorteRange(p.key, '6-10')}
                                            style={{
                                                flex: 1,
                                                padding: '6px 4px',
                                                borderRadius: '6px',
                                                fontSize: '0.78rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                border: currentRange === '6-10' ? '1px solid #ffd866' : '1px solid rgba(255,255,255,0.1)',
                                                background: currentRange === '6-10' ? 'rgba(255, 216, 102, 0.22)' : '#1e1e2d',
                                                color: currentRange === '6-10' ? '#ffd866' : '#888'
                                            }}
                                        >
                                            Tablas 6 - 10
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* UNASSIGNED TEACHER NOTICE */}
            {isProfesorUser && teacherAssignedGrupos.length === 0 && !loading && (
                <div className="unassigned-notice-card animated-fade">
                    <div className="unassigned-icon"><FaExclamationTriangle /></div>
                    <h2>No tienes ningún grupo asignado en Registro de Tablas</h2>
                    <p>
                        En este módulo solo se muestran los grupos que tienes asignados específicamente para la evaluación de <strong>Cálculo Mental (Tablas Matemáticas)</strong>, independientemente de tu carga académica general.
                        <br /><br />
                        Solicita a tu <strong>Administrador</strong> que te asigne el grupo o grupos a evaluar desde el panel de administración.
                    </p>
                </div>
            )}

            {/* BARRA DE PESTAÑAS DE GRUPOS */}
            {availableTabs.length > 0 && (
                <div className="grupos-tabs-container">
                    {availableTabs.map(grupo => {
                        const rec = allTablasData.find(t => normalizeGroupName(t.grupoNombre) === normalizeGroupName(grupo));
                        const hasEval = !!(rec?.evaluador_id || (rec?.evaluadores && rec.evaluadores.length > 0));
                        return (
                            <button
                                key={grupo}
                                className={`tab-btn ${normalizeGroupName(selectedGrupo) === normalizeGroupName(grupo) ? 'active' : ''}`}
                                onClick={() => setSelectedGrupo(grupo)}
                                title={isAdminUser ? (hasEval ? `Grupo ${grupo} (Con evaluador asignado)` : `Grupo ${grupo} (Sin evaluador asignado)`) : `Evaluar Grupo ${grupo}`}
                                style={{ position: 'relative' }}
                            >
                                {grupo}
                                {isAdminUser && hasEval && (
                                    <span style={{
                                        display: 'inline-block',
                                        width: '7px',
                                        height: '7px',
                                        borderRadius: '50%',
                                        backgroundColor: normalizeGroupName(selectedGrupo) === normalizeGroupName(grupo) ? '#111' : '#00cbcb',
                                        marginLeft: '5px',
                                        verticalAlign: 'middle'
                                    }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {loading && availableTabs.length > 0 && (
                <div className="loading-state">Cargando datos del grupo {selectedGrupo}...</div>
            )}

            {!loading && availableTabs.length > 0 && (
                <div className="tablas-content-card">
                    <div className="grupo-meta-bar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <h2>Grupo {selectedGrupo}</h2>
                            <span style={{
                                fontSize: '0.82rem',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: 'rgba(0, 203, 203, 0.12)',
                                border: '1px solid rgba(0, 203, 203, 0.3)',
                                color: '#00cbcb',
                                fontWeight: '600'
                            }}>
                                Alumnos: {alumnosGrupo.length}
                            </span>
                        </div>

                        {/* ASIGNACIÓN DE DOCENTE (ADMIN SOLAMENTE) */}
                        {isAdminUser && (
                            <div className="evaluador-select-container">
                                <label><FaUserCheck /> Docente Evaluador de {selectedGrupo}:</label>
                                <div className="evaluador-fused-combobox" ref={comboboxRef} style={{ width: '360px' }}>
                                    <div className="combobox-input-wrapper">
                                        <FaSearch className="combobox-icon" />
                                        <input
                                            type="text"
                                            className="combobox-input"
                                            placeholder="Buscar o seleccionar docente evaluador..."
                                            value={searchTeacherTerm}
                                            onFocus={() => {
                                                setIsTeacherDropdownOpen(true);
                                                setIsSearchingTeacher(false);
                                            }}
                                            onChange={(e) => {
                                                setSearchTeacherTerm(e.target.value);
                                                setIsSearchingTeacher(true);
                                                setIsTeacherDropdownOpen(true);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="combobox-toggle-arrow"
                                            onClick={() => {
                                                setIsTeacherDropdownOpen(prev => !prev);
                                                setIsSearchingTeacher(false);
                                            }}
                                            title="Desplegar lista de docentes"
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
                                                        className={`combobox-item ${String(selectedEvaluadorId) === String(prof._id) ? 'selected' : ''}`}
                                                        onClick={() => handleSelectEvaluador(prof._id)}
                                                    >
                                                        <span className="prof-name">{formatTeacherFullName(prof)}</span>
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

                        {/* DOCENTE ASIGNADO (VISTA DOCENTE) */}
                        {!isAdminUser && (
                            <div className="evaluador-select-container">
                                <label><FaUserCheck /> Docente Evaluador Asignado:</label>
                                <span className="evaluador-name">
                                    {assignedProfesorObj ? formatTeacherFullName(assignedProfesorObj) : (user?.nombre || 'Docente Asignado')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* VISTA ADMINISTRADOR: RESUMEN Y RENDIMIENTO DEL GRUPO */}
                    {isAdminUser && (
                        <div className="admin-performance-dashboard">
                            <div className="performance-cards-grid">
                                <div className="perf-card">
                                    <span className="perf-label">Docente Evaluador ({selectedGrupo})</span>
                                    <strong className="perf-value-text">
                                        {assignedProfesorObj ? formatTeacherFullName(assignedProfesorObj) : 'Sin Asignar'}
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
                                    <FaEye /> {showAdminTablePreview ? 'Ocultar Tabla de Evaluaciones' : 'Mostrar Tabla de Evaluaciones'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* VISTA TABLA DE EVALUACIÓN (7 CORTES) */}
                    {(isProfesorUser || (isAdminUser && showAdminTablePreview)) && (
                        <>
                            <div className="table-legend-bar" style={{ justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <span className="legend-title">
                                        {canEditCurrentGroup ? 'Modo Clics (Captura Activa):' : 'Vista Previa:'}
                                    </span>
                                    <span className="legend-item badge-incompleta">1 Clic ➔ 🔴 <strong>I</strong> (Incompleta)</span>
                                    <span className="legend-item badge-enorden">2 Clics ➔ 🟡 <strong>O</strong> (En orden)</span>
                                    <span className="legend-item badge-salteadas">3 Clics ➔ 🟢 <strong>S</strong> (Salteadas)</span>
                                    <span className="legend-item badge-empty">4 Clics ➔ ⚪ <strong>-</strong> (Limpiar)</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                                    <span>1ª Parte (Cortes 1-4): <strong style={{ color: '#00cbcb' }}>Tablas 1-5</strong></span>
                                    <span style={{ margin: '0 8px' }}>|</span>
                                    <span>2ª Parte (Cortes 5-7): <strong style={{ color: '#ffd866' }}>Tablas 6-10</strong></span>
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
                                            <tr>
                                                <th rowSpan="2" className="sticky-col num-col">N°</th>
                                                <th rowSpan="2" className="sticky-col name-col">NOMBRE DEL ALUMNO</th>
                                                {periodosActivos.map((p, pIdx) => (
                                                    <th
                                                        key={p.key}
                                                        colSpan={p.tablas.length}
                                                        className="periodo-header"
                                                        style={{
                                                            borderBottom: p.range === '6-10' ? '2px solid #ffd866' : '2px solid #00cbcb',
                                                            color: p.range === '6-10' ? '#ffd866' : '#00cbcb'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                            <span>{p.shortName}</span>
                                                            <span style={{
                                                                fontSize: '0.7rem',
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                background: p.range === '6-10' ? 'rgba(255, 216, 102, 0.15)' : 'rgba(0, 203, 203, 0.15)',
                                                                color: p.range === '6-10' ? '#ffd866' : '#00cbcb',
                                                                fontWeight: '700'
                                                            }}>
                                                                Tablas del {p.range.replace('-', ' al ')}
                                                            </span>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                            <tr>
                                                {periodosActivos.map(p => (
                                                    p.tablas.map((tNum, idx) => (
                                                        <th
                                                            key={`${p.key}_${tNum}_${idx}`}
                                                            className="tabla-num-header"
                                                            style={{
                                                                color: p.range === '6-10' ? '#ffd866' : '#e0e0e0'
                                                            }}
                                                        >
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
                                                const fullStudentName = `${alumno.apellidoPaterno || ''} ${alumno.apellidoMaterno || ''} ${alumno.nombre || ''}`.replace(/\s+/g, ' ').trim();
                                                const isFirstNuevo = alumno.esNuevoIngreso && (index === 0 || !alumnosGrupo[index - 1]?.esNuevoIngreso);

                                                return (
                                                    <React.Fragment key={id}>
                                                        {isFirstNuevo && (
                                                            <tr key={`divider_nuevo_${index}`} className="divider-nuevo-ingreso-row">
                                                                <td colSpan={37} style={{
                                                                    background: 'rgba(255, 216, 102, 0.15)',
                                                                    color: '#ffd866',
                                                                    borderTop: '2px solid #ffd866',
                                                                    borderBottom: '2px solid #ffd866',
                                                                    padding: '8px 16px',
                                                                    fontWeight: '800',
                                                                    fontSize: '0.85rem',
                                                                    letterSpacing: '0.5px',
                                                                    textAlign: 'center'
                                                                }}>
                                                                    🌟 ALUMNOS DE NUEVO INGRESO (Ingresaron a mitad de curso)
                                                                </td>
                                                            </tr>
                                                        )}

                                                        <tr className={alumno.esBaja ? 'row-baja' : (alumno.esNuevoIngreso ? 'row-nuevo-ingreso' : '')} style={{ backgroundColor: alumno.esBaja ? 'rgba(255, 77, 77, 0.12)' : (alumno.esNuevoIngreso ? 'rgba(255, 216, 102, 0.08)' : undefined), color: alumno.esBaja ? '#ff4d4d' : undefined }}>
                                                            <td className="sticky-col num-col" style={{ color: alumno.esBaja ? '#ff4d4d' : undefined, fontWeight: alumno.esBaja ? 'bold' : undefined }}>{index + 1}</td>
                                                            <td className="sticky-col name-col" title={fullStudentName} style={{ color: alumno.esBaja ? '#ff4d4d' : undefined }}>
                                                                {fullStudentName}
                                                                {alumno.esBaja ? (
                                                                    <span style={{
                                                                        background: '#570000',
                                                                        color: '#ff4d4d',
                                                                        border: '1px solid #850404',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.7rem',
                                                                        padding: '1px 5px',
                                                                        fontWeight: '800',
                                                                        marginLeft: '6px',
                                                                        display: 'inline-block'
                                                                    }}>
                                                                        🚫 Baja {alumno.fechaBaja ? `(${alumno.fechaBaja})` : ''}
                                                                    </span>
                                                                ) : (alumno.esNuevoIngreso && (
                                                                    <span style={{
                                                                        background: '#574100',
                                                                        color: '#ffd866',
                                                                        border: '1px solid #856404',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.7rem',
                                                                        padding: '1px 5px',
                                                                        fontWeight: '800',
                                                                        marginLeft: '6px',
                                                                        display: 'inline-block'
                                                                    }}>
                                                                        🌟 Nuevo {alumno.fechaIngreso ? `(${alumno.fechaIngreso})` : ''}
                                                                    </span>
                                                                ))}
                                                            </td>
                                                            {periodosActivos.map(p => (
                                                                p.tablas.map((tNum, idx) => {
                                                                    const cellKey = `${p.key}_t${tNum}_i${idx}`;
                                                                    const val = getCellValue(alumnoMatrix, p.key, tNum, idx);
                                                                    const matchedOpt = OPTIONS.find(o => o.value === val) || OPTIONS[0];

                                                                    return (
                                                                        <td key={cellKey} className="matrix-cell">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCellClick(id, p.key, tNum, idx)}
                                                                                disabled={!canEditCurrentGroup}
                                                                                className={`status-btn ${matchedOpt.colorClass} ${!canEditCurrentGroup ? 'readonly-btn' : ''}`}
                                                                                title={
                                                                                    canEditCurrentGroup
                                                                                        ? `${matchedOpt.fullText} (Tabla del ${tNum} - ${p.shortName}). Clic para cambiar.`
                                                                                        : `${matchedOpt.fullText} (Tabla del ${tNum} - ${p.shortName}) - Solo Lectura`
                                                                                }
                                                                            >
                                                                                {matchedOpt.label}
                                                                            </button>
                                                                        </td>
                                                                    );
                                                                })
                                                            ))}
                                                        </tr>
                                                    </React.Fragment>
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

            {/* BOTÓN FLOTANTE CIRCULAR FIJO EN LA ESQUINA INFERIOR DERECHA */}
            {canEditCurrentGroup && availableTabs.length > 0 && (
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
