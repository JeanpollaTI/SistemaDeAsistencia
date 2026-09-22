import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from './NotificationContext';
import { FaExchangeAlt, FaTimes, FaUserCheck, FaUserMinus, FaCopy, FaArrowRight, FaCheckSquare, FaSquare } from 'react-icons/fa';
import './PromoverAlumnosModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const PromoverAlumnosModal = ({ isOpen, onClose, grupos = [], onSuccess }) => {
    const { addNotification } = useNotification() || {};
    const [sourceGrupoId, setSourceGrupoId] = useState('');
    const [targetGrupoId, setTargetGrupoId] = useState('');
    const [selectedAlumnoIds, setSelectedAlumnoIds] = useState([]);
    const [action, setAction] = useState('copy'); // 'copy' | 'move'
    const [markUnselectedAsBaja, setMarkUnselectedAsBaja] = useState(true);
    const [fechaBaja, setFechaBaja] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    // Initial selections when modal opens or groups change
    const [targetOption, setTargetOption] = useState('NEW'); // 'NEW' | 'EXISTING' | 'GRADUATE'
    const [newTargetGrupoNombre, setNewTargetGrupoNombre] = useState('');

    // Auto-calculate suggested target group name when source group changes
    useEffect(() => {
        const sg = grupos.find(g => String(g._id || g.id) === String(sourceGrupoId));
        if (sg) {
            const name = sg.nombre || '';
            let suggested = '';
            if (name.includes('1')) {
                suggested = name.replace('1', '2');
                setTargetOption('NEW');
            } else if (name.includes('2')) {
                suggested = name.replace('2', '3');
                setTargetOption('NEW');
            } else if (name.includes('3')) {
                suggested = `Egresados ${name}`;
                setTargetOption('GRADUATE');
            } else {
                suggested = `${name} (Nuevo)`;
                setTargetOption('NEW');
            }
            setNewTargetGrupoNombre(suggested);
        }
    }, [sourceGrupoId, grupos]);

    const sourceGrupo = grupos.find(g => String(g._id || g.id) === String(sourceGrupoId));
    const targetGrupo = grupos.find(g => String(g._id || g.id) === String(targetGrupoId));
    const sourceAlumnos = sourceGrupo?.alumnos || [];
    const targetAlumnos = targetGrupo?.alumnos || [];

    // Auto-select active students when source group changes
    useEffect(() => {
        if (sourceAlumnos.length > 0) {
            const allIds = sourceAlumnos.map(a => String(a._id || a.id));
            setSelectedAlumnoIds(allIds);
        } else {
            setSelectedAlumnoIds([]);
        }
    }, [sourceGrupoId]);

    if (!isOpen) return null;

    const isAlreadyInTarget = (alumno) => {
        if (targetOption !== 'EXISTING' || !targetGrupo) return false;
        return targetAlumnos.some(targetA => {
            const sameMatricula = targetA.matricula && alumno.matricula && String(targetA.matricula) === String(alumno.matricula);
            const sameName = targetA.nombre?.trim().toLowerCase() === alumno.nombre?.trim().toLowerCase() &&
                (targetA.apellidoPaterno || '').trim().toLowerCase() === (alumno.apellidoPaterno || '').trim().toLowerCase() &&
                (targetA.apellidoMaterno || '').trim().toLowerCase() === (alumno.apellidoMaterno || '').trim().toLowerCase();
            return sameMatricula || sameName;
        });
    };

    const handleToggleStudent = (id) => {
        setSelectedAlumnoIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!sourceGrupoId) {
            if (addNotification) addNotification('Selecciona el grupo origen', 'warning');
            return;
        }

        if (targetOption === 'NEW' && !newTargetGrupoNombre.trim()) {
            if (addNotification) addNotification('Escribe el nombre del nuevo grupo destino (ej. 2°A)', 'warning');
            return;
        }

        if (targetOption === 'EXISTING' && (!targetGrupoId || sourceGrupoId === targetGrupoId)) {
            if (addNotification) addNotification('Selecciona un grupo destino diferente', 'warning');
            return;
        }

        if (selectedAlumnoIds.length === 0) {
            if (addNotification) addNotification('Selecciona al menos un alumno para transferir/graduar', 'warning');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                sourceGrupoId,
                alumnoIds: selectedAlumnoIds,
                action,
                markUnselectedAsBaja,
                fechaBaja,
                createNewTargetGroup: targetOption === 'NEW',
                newTargetGrupoNombre: targetOption === 'NEW' ? newTargetGrupoNombre.trim() : undefined,
                targetGrupoId: targetOption === 'EXISTING' ? targetGrupoId : undefined,
                isGraduation: targetOption === 'GRADUATE'
            };

            const res = await axios.post(`${API_URL}/grupos/promover-alumnos`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (addNotification) addNotification(res.data.msg || 'Alumnos promovidos correctamente', 'success');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            const errorMsg = err.response?.data?.error || 'Error al promover alumnos entre grupos';
            if (addNotification) addNotification(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="promover-modal-overlay" onClick={onClose}>
            <div className="promover-modal-content" onClick={(e) => e.stopPropagation()}>
                <header className="promover-modal-header">
                    <h2><FaExchangeAlt className="header-icon" /> Promoción y Paso de Grado de Alumnos</h2>
                    <button type="button" className="close-btn" onClick={onClose}>&times;</button>
                </header>

                <form onSubmit={handleSubmit} className="promover-modal-body">
                    <p className="promover-subtitle">
                        Paso de grado para el nuevo ciclo escolar. Crea automáticamente el nuevo grupo destino (ej. 1°A ➔ 2°A) para no mezclar nombres con grupos actuales.
                    </p>

                    {/* SELECCIÓN DE ORIGEN Y TIPO DE DESTINO */}
                    <div className="promover-select-grid">
                        <div className="form-group">
                            <label className="promover-label">1. Grupo Actual Origen:</label>
                            <select
                                className="promover-select"
                                value={sourceGrupoId}
                                onChange={(e) => setSourceGrupoId(e.target.value)}
                            >
                                {grupos.map(g => (
                                    <option key={g._id || g.id} value={g._id || g.id}>
                                        {g.nombre} ({g.alumnos?.length || 0} alumnos)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="promover-arrow">
                            <FaArrowRight />
                        </div>

                        <div className="form-group">
                            <label className="promover-label">2. Modo de Destino para el Nuevo Grado:</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.88rem', color: targetOption === 'NEW' ? '#00cbcb' : '#fff' }}>
                                    <input
                                        type="radio"
                                        name="targetOption"
                                        value="NEW"
                                        checked={targetOption === 'NEW'}
                                        onChange={() => setTargetOption('NEW')}
                                    />
                                    <span>✨ Crear Nuevo Grupo (Sugerido para nuevo ciclo)</span>
                                </label>

                                {targetOption === 'NEW' && (
                                    <input
                                        type="text"
                                        className="promover-select"
                                        value={newTargetGrupoNombre}
                                        onChange={(e) => setNewTargetGrupoNombre(e.target.value)}
                                        placeholder="Nombre del nuevo grupo (ej. 2°A, 3°A)"
                                        style={{ borderColor: '#00cbcb', background: '#111827', color: '#00cbcb', fontWeight: 'bold' }}
                                    />
                                )}

                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.88rem', color: targetOption === 'GRADUATE' ? '#f59e0b' : '#fff' }}>
                                    <input
                                        type="radio"
                                        name="targetOption"
                                        value="GRADUATE"
                                        checked={targetOption === 'GRADUATE'}
                                        onChange={() => setTargetOption('GRADUATE')}
                                    />
                                    <span>🎓 Graduar / Egresar Grupo (Para 3° Grado - Fin de Secundaria)</span>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.88rem', color: targetOption === 'EXISTING' ? '#3b82f6' : '#fff' }}>
                                    <input
                                        type="radio"
                                        name="targetOption"
                                        value="EXISTING"
                                        checked={targetOption === 'EXISTING'}
                                        onChange={() => setTargetOption('EXISTING')}
                                    />
                                    <span>👥 Seleccionar de Lista de Grupos Existentes</span>
                                </label>

                                {targetOption === 'EXISTING' && (
                                    <select
                                        className="promover-select"
                                        value={targetGrupoId}
                                        onChange={(e) => setTargetGrupoId(e.target.value)}
                                    >
                                        {grupos.map(g => (
                                            <option key={g._id || g.id} value={g._id || g.id}>
                                                {g.nombre} ({g.alumnos?.length || 0} alumnos)
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* MODO DE ACCIÓN: COPIAR VS MOVER */}
                    <div className="promover-action-selector">
                        <label className="promover-label">3. Selecciona la acción a realizar:</label>
                        <div className="action-options-row">
                            <label className={`action-card ${action === 'copy' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="promoverAction"
                                    value="copy"
                                    checked={action === 'copy'}
                                    onChange={(e) => setAction(e.target.value)}
                                />
                                <div className="action-card-content">
                                    <strong><FaCopy /> Copiar Alumnos</strong>
                                    <span>Conserva a los alumnos en {sourceGrupo?.nombre || 'Origen'} y agrega una copia a {targetGrupo?.nombre || 'Destino'}.</span>
                                </div>
                            </label>

                            <label className={`action-card ${action === 'move' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="promoverAction"
                                    value="move"
                                    checked={action === 'move'}
                                    onChange={(e) => setAction(e.target.value)}
                                />
                                <div className="action-card-content">
                                    <strong><FaExchangeAlt /> Mover / Promover (Paso de Grado)</strong>
                                    <span>Transfiere los alumnos a {targetGrupo?.nombre || 'Destino'} y los quita de {sourceGrupo?.nombre || 'Origen'}.</span>
                                </div>
                            </label>
                        </div>

                        {/* OPCIÓN: MARCAR COMO BAJA A LOS NO SELECCIONADOS */}
                        <div className="promover-baja-option" style={{ marginTop: '15px', padding: '12px', background: 'rgba(255, 77, 77, 0.08)', borderRadius: '8px', border: '1px solid rgba(255, 77, 77, 0.3)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'bold', color: '#ff4d4d', fontSize: '0.88rem' }}>
                                <input
                                    type="checkbox"
                                    checked={markUnselectedAsBaja}
                                    onChange={(e) => setMarkUnselectedAsBaja(e.target.checked)}
                                    style={{ accentColor: '#ff4d4d', width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <span>🚫 Marcar automáticamente como BAJA en {sourceGrupo?.nombre || 'grupo origen'} a los alumnos no seleccionados</span>
                            </label>
                            {markUnselectedAsBaja && (
                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '28px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#ccc' }}>Fecha de Baja para no seleccionados:</span>
                                    <input
                                        type="date"
                                        value={fechaBaja}
                                        onChange={(e) => setFechaBaja(e.target.value)}
                                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ff4d4d', background: '#1a1a1a', color: '#fff', fontSize: '0.85rem' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LISTA DE ALUMNOS DEL GRUPO ORIGEN */}
                    <div className="promover-students-section">
                        <div className="students-section-header">
                            <label className="promover-label">
                                4. Selecciona los alumnos a transferir ({selectedAlumnoIds.length} de {sourceAlumnos.length} seleccionados):
                            </label>
                            <div className="promover-bulk-actions">
                                <button
                                    type="button"
                                    className="btn-toggle-all select-all"
                                    onClick={() => {
                                        const selectableStudents = sourceAlumnos.filter(a => !isAlreadyInTarget(a));
                                        setSelectedAlumnoIds(selectableStudents.map(a => String(a._id || a.id)));
                                    }}
                                >
                                    <FaUserCheck /> Seleccionar Todos los Alumnos
                                </button>
                                <button
                                    type="button"
                                    className="btn-toggle-all deselect-all"
                                    onClick={() => setSelectedAlumnoIds([])}
                                >
                                    <FaUserMinus /> Desmarcar Todos
                                </button>
                            </div>
                        </div>

                        {sourceAlumnos.length === 0 ? (
                            <div className="empty-students-msg">
                                El grupo {sourceGrupo?.nombre} no tiene alumnos registrados.
                            </div>
                        ) : (
                            <div className="students-checkbox-list">
                                {sourceAlumnos.map((alumno, index) => {
                                    const idStr = String(alumno._id || alumno.id);
                                    const inTarget = isAlreadyInTarget(alumno);
                                    const isSelected = selectedAlumnoIds.includes(idStr);
                                    const fullName = `${alumno.nombre} ${alumno.apellidoPaterno || ''} ${alumno.apellidoMaterno || ''}`.trim();

                                    return (
                                        <div
                                            key={idStr}
                                            className={`student-item-row ${inTarget ? 'already-exists' : ''} ${isSelected ? 'is-selected' : ''}`}
                                            onClick={() => !inTarget && handleToggleStudent(idStr)}
                                        >
                                            <div className="student-check">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    disabled={inTarget}
                                                    onChange={() => handleToggleStudent(idStr)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <span className="student-num">{index + 1}.</span>
                                            <span className="student-name">{fullName}</span>
                                            {alumno.matricula && (
                                                <span className="student-mat">Matrícula: {alumno.matricula}</span>
                                            )}

                                            {inTarget && (
                                                <span className="badge-already-target">
                                                    Ya en {targetGrupo?.nombre}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <footer className="promover-modal-footer">
                        <button
                            type="button"
                            className="btn-modal-cancel"
                            onClick={onClose}
                            disabled={loading}
                        >
                            <FaTimes /> Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn-modal-submit"
                            disabled={loading || selectedAlumnoIds.length === 0}
                        >
                            <FaExchangeAlt /> {loading ? 'Procesando paso de grado...' : `${action === 'move' ? 'Mover' : 'Copiar'} ${selectedAlumnoIds.length} Alumno(s)`}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default PromoverAlumnosModal;
