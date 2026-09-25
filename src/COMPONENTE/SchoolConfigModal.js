import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from './NotificationContext';
import { FaTimes, FaSave, FaCogs, FaCalendarAlt, FaUpload, FaTrashAlt, FaImage, FaUserTie } from 'react-icons/fa';
import './SchoolConfigModal.css';

const SchoolConfigModal = ({ isOpen, onClose, school, onSave }) => {
    const { addNotification } = useNotification() || {};
    const [loading, setLoading] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [directorName, setDirectorName] = useState('');
    const [evaluationPeriod, setEvaluationPeriod] = useState('Bimestre');
    const [logoUrl, setLogoUrl] = useState('');
    const [roundingConfig, setRoundingConfig] = useState({
        enabled: false,
        threshold: 0.5,
        roundFailing: false
    });
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (school) {
            setDirectorName(school.directorName || '');
            if (school.evaluationPeriod) {
                setEvaluationPeriod(school.evaluationPeriod);
            }
            if (school.config) {
                setLogoUrl(school.config.logoUrl || '');
                if (school.config.rounding) {
                    setRoundingConfig({
                        enabled: !!school.config.rounding.enabled,
                        threshold: school.config.rounding.threshold ?? 0.5,
                        roundFailing: !!school.config.rounding.roundFailing
                    });
                }
            }
        }
    }, [school, isOpen]);

    if (!isOpen || !school) return null;

    const handleLogoSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            if (addNotification) addNotification('Por favor selecciona un archivo de imagen válido', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64Str = event.target.result;
            setUploadingLogo(true);
            try {
                const res = await apiClient.post(`/schools/${school._id}/logo`, { logoBase64: base64Str });
                const updatedLogo = res.data?.config?.logoUrl || '';
                setLogoUrl(updatedLogo);
                if (addNotification) addNotification('¡Logo de la escuela subido a Cloudinary exitosamente!', 'success');
                if (onSave) onSave(res.data);
            } catch (err) {
                console.error(err);
                if (addNotification) addNotification('Error al subir el logo a Cloudinary', 'error');
            } finally {
                setUploadingLogo(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = async () => {
        setUploadingLogo(true);
        try {
            const res = await apiClient.delete(`/schools/${school._id}/logo`);
            setLogoUrl('');
            if (addNotification) addNotification('Logo removido. Los reportes se generarán en blanco.', 'info');
            if (onSave) onSave(res.data);
        } catch (err) {
            console.error(err);
            if (addNotification) addNotification('Error al eliminar el logo', 'error');
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const updatedConfig = {
                ...school.config,
                logoUrl: logoUrl,
                rounding: roundingConfig
            };

            const response = await apiClient.put(`/schools/${school._id}`, {
                name: school.name,
                type: school.type,
                evaluationPeriod: evaluationPeriod,
                directorName: directorName.trim(),
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
                        Personaliza el logo institucional en Cloudinary, firma y reglas para <strong>{school.name}</strong>.
                    </p>

                    {/* SECCIÓN LOGO INSTITUCIONAL Y FIRMA */}
                    <div className="config-section" style={{ marginBottom: '1.2rem' }}>
                        <label className="config-label">
                            <FaImage style={{ color: '#00cbcb', marginRight: '6px' }} />
                            Logo Institucional de la Escuela (Cloudinary)
                        </label>
                        <p className="config-desc">
                            Sube el logotipo oficial de tu escuela. Se guardará permanentemente en Cloudinary y se utilizará automáticamente en boletas y PDFs sin que los profesores tengan que subirlo cada vez. Si no subes ninguno, los reportes se emitirán sin logo.
                        </p>

                        <div className="logo-upload-container" style={{ marginTop: '12px' }}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleLogoSelect}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />

                            {logoUrl ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', flexWrap: 'wrap' }}>
                                    <div style={{ padding: '6px', background: '#ffffff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '70px', height: '70px' }}>
                                        <img src={logoUrl} alt="Logo Escuela" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: 'bold', display: 'block' }}>✓ Logo guardado en Cloudinary</span>
                                        <span style={{ fontSize: '0.78rem', color: '#aaa' }}>Se incluirá en boletas y reportes PDF automáticamente.</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="school-config-btn btn-cancel"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingLogo}
                                        style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                    >
                                        <FaUpload /> Cambiar
                                    </button>
                                    <button
                                        type="button"
                                        className="school-config-btn btn-cancel"
                                        onClick={handleRemoveLogo}
                                        disabled={uploadingLogo}
                                        style={{ fontSize: '0.85rem', padding: '6px 12px', color: '#ef4444', borderColor: '#ef4444' }}
                                    >
                                        <FaTrashAlt /> Quitar
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', flexWrap: 'wrap' }}>
                                    <div style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px dashed #00cbcb', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '70px', height: '70px', color: '#00cbcb' }}>
                                        <FaImage style={{ fontSize: '1.8rem' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                        <span style={{ fontSize: '0.88rem', color: '#e0e0e0', fontWeight: 'bold', display: 'block' }}>Sin logo guardado</span>
                                        <span style={{ fontSize: '0.78rem', color: '#aaa' }}>Los reportes se generarán en blanco si no subes un logotipo.</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="school-config-btn btn-save"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingLogo}
                                        style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                                    >
                                        <FaUpload /> {uploadingLogo ? 'Subiendo...' : 'Subir Logo a Cloudinary'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* CAMPO DE NOMBRE DE DIRECTOR(A) */}
                        <div style={{ marginTop: '15px' }}>
                            <label className="config-label-sub">
                                <FaUserTie style={{ marginRight: '6px' }} />
                                Nombre del Director(a) / Firma Institucional
                            </label>
                            <input
                                type="text"
                                className="config-select"
                                value={directorName}
                                onChange={(e) => setDirectorName(e.target.value)}
                                placeholder="Ej: Profr. Juan Pérez Gómez"
                                style={{ width: '100%', marginTop: '4px' }}
                            />
                        </div>
                    </div>

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
                    <button className="school-config-btn btn-cancel" onClick={onClose} disabled={loading || uploadingLogo}>
                        <FaTimes /> Cancelar
                    </button>
                    <button className="school-config-btn btn-save" onClick={handleSave} disabled={loading || uploadingLogo}>
                        <FaSave /> {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SchoolConfigModal;
