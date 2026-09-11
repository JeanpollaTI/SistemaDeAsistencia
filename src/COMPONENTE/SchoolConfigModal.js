import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from './NotificationContext';
import { FaTimes, FaSave, FaCogs, FaCalendarAlt } from 'react-icons/fa';
import './SchoolConfigModal.css';

const SchoolConfigModal = ({ isOpen, onClose, school, onSave }) => {
    const { addNotification } = useNotification() || {};
    const [loading, setLoading] = useState(false);
    const [evaluationPeriod, setEvaluationPeriod] = useState('Bimestre');
    const [roundingConfig, setRoundingConfig] = useState({
        enabled: false,
        threshold: 0.5,
        roundFailing: false
    });

    useEffect(() => {
        if (school) {
            if (school.evaluationPeriod) {
                setEvaluationPeriod(school.evaluationPeriod);
            }
            if (school.config && school.config.rounding) {
                setRoundingConfig({
                    enabled: !!school.config.rounding.enabled,
                    threshold: school.config.rounding.threshold ?? 0.5,
                    roundFailing: !!school.config.rounding.roundFailing
                });
            }
        }
    }, [school, isOpen]);

    if (!isOpen || !school) return null;

    const handleSave = async () => {
        setLoading(true);
        try {
            const updatedConfig = {
                ...school.config,
                rounding: roundingConfig
            };

            const response = await apiClient.put(`/schools/${school._id}`, {
                name: school.name,
                type: school.type,
                evaluationPeriod: evaluationPeriod,
                directorName: school.directorName,
                config: updatedConfig
            });

            if (addNotification) {
                addNotification('Configuración de la escuela guardada correctamente', 'success');
            }
            if (onSave) onSave(response.data);
            onClose();
        } catch (err) {
            console.error(err);
            if (addNotification) {
                addNotification('Error al guardar la configuración de la escuela', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="school-config-overlay" onClick={onClose}>
            <div className="school-config-modal" onClick={(e) => e.stopPropagation()}>
                <header className="school-config-header">
                    <h2><FaCogs className="header-icon" /> Configuración de la Escuela</h2>
                    <button className="close-btn" onClick={onClose} title="Cerrar">&times;</button>
                </header>

                <div className="school-config-body">
                    <p className="school-config-subtitle">
                        Personaliza los periodos de evaluación y reglas de redondeo exclusivas para <strong>{school.name}</strong>.
                    </p>

                    {/* SECCIÓN 1: SISTEMA DE PERIODOS ACADÉMICOS */}
                    <div className="config-section">
                        <label className="config-label">
                            <FaCalendarAlt style={{ color: '#00cbcb', marginRight: '6px' }} />
                            Sistema de Periodos de Evaluación
                        </label>
                        <p className="config-desc">
                            Selecciona cómo se estructura el ciclo académico de tu institución (parciales, trimestres, bimestres, etc.).
                        </p>

                        <div className="form-group" style={{ marginTop: '12px' }}>
                            <select
                                value={evaluationPeriod}
                                onChange={(e) => setEvaluationPeriod(e.target.value)}
                                className="config-select"
                            >
                                <option value="Parcial">Parciales / Periodos (1°, 2°, 3°, ...)</option>
                                <option value="Bimestre">Bimestral (1°, 2°, 3°, 4°, 5° Bimestre)</option>
                                <option value="Trimestre">Trimestral (1°, 2°, 3° Trimestre)</option>
                                <option value="Cuatrimestre">Cuatrimestral (1°, 2°, 3° Cuatrimestre)</option>
                                <option value="Semestre">Semestral (1°, 2° Semestre)</option>
                            </select>
                        </div>
                    </div>

                    {/* SECCIÓN 2: REDONDEO DE CALIFICACIONES */}
                    <div className="config-section" style={{ marginTop: '1.2rem' }}>
                        <div className="toggle-row">
                            <div>
                                <label className="config-label">Activar Redondeo de Calificaciones</label>
                                <p className="config-desc">Aplica reglas automáticas de redondeo al calcular promedios.</p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={roundingConfig.enabled}
                                    onChange={(e) => setRoundingConfig({ ...roundingConfig, enabled: e.target.checked })}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        {roundingConfig.enabled && (
                            <div className="rounding-details animated-fade">
                                <div className="form-group">
                                    <label className="config-label-sub">Umbral de Redondeo Aprobatorio (≥ 6.0)</label>
                                    <p className="field-hint">
                                        Ejemplo: Con umbral 0.5, calificaciones como 6.5 suben a 7, mientras 6.4 se mantiene en 6.4.
                                    </p>
                                    <select
                                        value={roundingConfig.threshold}
                                        onChange={(e) => setRoundingConfig({ ...roundingConfig, threshold: parseFloat(e.target.value) })}
                                        className="config-select"
                                    >
                                        <option value={0.5}>0.5 (ej. 6.5 ➔ 7.0)</option>
                                        <option value={0.6}>0.6 (ej. 6.6 ➔ 7.0)</option>
                                        <option value={0.51}>A partir de .51 (ej. 6.51 ➔ 7.0)</option>
                                    </select>
                                </div>

                                <div className="toggle-row border-top">
                                    <div>
                                        <label className="config-label">Redondear Reprobatorios (&lt; 6.0)</label>
                                        <p className="config-desc">
                                            Si está desactivado, 5.6 o 5.9 no subirán a 6 (se mantiene reprobatoria).
                                        </p>
                                    </div>
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={roundingConfig.roundFailing}
                                            onChange={(e) => setRoundingConfig({ ...roundingConfig, roundFailing: e.target.checked })}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="school-config-footer">
                    <button className="school-config-btn btn-cancel" onClick={onClose} disabled={loading}>
                        <FaTimes /> Cancelar
                    </button>
                    <button className="school-config-btn btn-save" onClick={handleSave} disabled={loading}>
                        <FaSave /> {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SchoolConfigModal;
