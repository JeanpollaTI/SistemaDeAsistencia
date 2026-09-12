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
    const [loading, setLoading] = useState(false);

    // Initial selections when modal opens or groups change
    useEffect(() => {
        if (isOpen && grupos.length > 0) {
            if (!sourceGrupoId) setSourceGrupoId(grupos[0]._id || grupos[0].id);
            if (!targetGrupoId && grupos.length > 1) setTargetGrupoId(grupos[1]._id || grupos[1].id);
        }
    }, [isOpen, grupos, sourceGrupoId, targetGrupoId]);

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
        if (!targetGrupo) return false;
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

    const handleToggleAll = () => {
        const selectableStudents = sourceAlumnos.filter(a => !isAlreadyInTarget(a));
        const selectableIds = selectableStudents.map(a => String(a._id || a.id));

        const allSelected = selectableIds.every(id => selectedAlumnoIds.includes(id));

        if (allSelected) {
            setSelectedAlumnoIds([]);
        } else {
            setSelectedAlumnoIds(selectableIds);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!sourceGrupoId || !targetGrupoId) {
            if (addNotification) addNotification('Selecciona el grupo origen y el grupo destino', 'warning');
            return;
        }

        if (sourceGrupoId === targetGrupoId) {
            if (addNotification) addNotification('El grupo origen y el grupo destino deben ser diferentes', 'warning');
            return;
        }

        if (selectedAlumnoIds.length === 0) {
            if (addNotification) addNotification('Selecciona al menos un alumno para transferir', 'warning');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/grupos/promover-alumnos`, {
                sourceGrupoId,
                targetGrupoId,
                alumnoIds: selectedAlumnoIds,
                action
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (addNotification) addNotification(res.data.msg || 'Alumnos transferidos correctamente', 'success');
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
                    <h2><FaExchangeAlt className="header-icon" /> Promoción y Copia de Alumnos entre Grupos</h2>
                    <button type="button" className="close-btn" onClick={onClose}>&times;</button>
                </header>

                <form onSubmit={handleSubmit} className="promover-modal-body">
                    <p className="promover-subtitle">
                        Transfiere o copia alumnos de un grado/grupo a otro (ej. 1°A ➔ 2°A). Desmarca a los alumnos que se hayan dado de baja para excluirlos.
                    </p>

                    {/* GRUPO ORIGEN -> GRUPO DESTINO */}
                    <div className="promover-select-grid">
                        <div className="form-group">
                            <label className="promover-label">1. Grupo Origen (De donde salen):</label>
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
                            <label className="promover-label">2. Grupo Destino (A donde entran):</label>
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
                    </div>

                    {/* LISTA DE ALUMNOS DEL GRUPO ORIGEN */}
                    <div className="promover-students-section">
                        <div className="students-section-header">
                            <label className="promover-label">
                                4. Selecciona los alumnos a transferir ({selectedAlumnoIds.length} seleccionados):
                            </label>
                            <button
                                type="button"
                                className="btn-toggle-all"
                                onClick={handleToggleAll}
                            >
                                Seleccionar / Desmarcar Todos
                            </button>
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
