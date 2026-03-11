import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SchoolDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SchoolDashboard = () => {
    const [school, setSchool] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notificacion, setNotificacion] = useState({ mensaje: '', tipo: '' });

    const [formData, setFormData] = useState({
        name: '',
        type: '',
        directorName: '',
        evaluationPeriod: '',
        config: {
            logoUrl: '',
            primaryColor: '#b9972b',
            scaleMax: 10
        }
    });

    useEffect(() => {
        fetchSchoolData();
    }, []);

    const fetchSchoolData = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/auth/mi-perfil`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Suponemos que el backend retorna el objeto school poblado o el ID
            // Necesitamos una ruta para obtener data de la escuela específica si no viene en el perfil
            const schoolId = res.data.school_id;
            const schoolRes = await axios.get(`${API_URL}/schools/${schoolId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSchool(schoolRes.data);
            setFormData({
                name: schoolRes.data.name,
                type: schoolRes.data.type,
                directorName: schoolRes.data.directorName || '',
                evaluationPeriod: schoolRes.data.evaluationPeriod,
                config: schoolRes.data.config || { logoUrl: '', primaryColor: '#b9972b', scaleMax: 10 }
            });
        } catch (err) {
            console.error("Error fetching school data:", err);
            mostrarNotificacion("Error al cargar los datos de la escuela", "error");
        } finally {
            setLoading(false);
        }
    };

    const mostrarNotificacion = (mensaje, tipo = 'exito') => {
        setNotificacion({ mensaje, tipo });
        setTimeout(() => setNotificacion({ mensaje: '', tipo: '' }), 3000);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.includes('config.')) {
            const configField = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                config: { ...prev.config, [configField]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/schools/${school._id}`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            mostrarNotificacion("Configuración guardada correctamente");
        } catch (err) {
            console.error("Error saving school data:", err);
            mostrarNotificacion("Error al guardar los cambios", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="loader">Cargando configuración...</div>;

    return (
        <div className="school-dashboard">
            {notificacion.mensaje && (
                <div className={`notificacion-flotante ${notificacion.tipo}`}>
                    {notificacion.mensaje}
                </div>
            )}

            <header className="dashboard-header">
                <h1>Configuración de la Institución</h1>
                <p>Gestiona la identidad y el sistema de evaluación de tu escuela.</p>
            </header>

            <form className="config-form" onSubmit={handleSubmit}>
                <section className="form-section">
                    <h2>Datos Generales</h2>
                    <div className="form-group">
                        <label>Nombre de la Institución</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Nombre del Director (a)</label>
                        <input
                            type="text"
                            name="directorName"
                            value={formData.directorName}
                            onChange={handleChange}
                            placeholder="Nombre completo para firmas"
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Tipo de Institución</label>
                            <select name="type" value={formData.type} onChange={handleChange}>
                                <option value="Primaria">Primaria</option>
                                <option value="Secundaria">Secundaria</option>
                                <option value="Preparatoria">Preparatoria</option>
                                <option value="Universidad">Universidad</option>
                                <option value="Academia">Academia</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Periodo de Evaluación</label>
                            <select name="evaluationPeriod" value={formData.evaluationPeriod} onChange={handleChange}>
                                <option value="Bimestre">Bimestre (5 periodos)</option>
                                <option value="Trimestre">Trimestre (3 periodos)</option>
                                <option value="Cuatrimestre">Cuatrimestre (3 periodos)</option>
                                <option value="Semestre">Semestre (2 periodos)</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Apariencia e Identidad</h2>
                    <div className="form-group">
                        <label>URL del Logo (Opcional)</label>
                        <input
                            type="text"
                            name="config.logoUrl"
                            value={formData.config.logoUrl}
                            onChange={handleChange}
                            placeholder="https://ejemplo.com/logo.png"
                        />
                        <small style={{ color: '#666' }}>Se recomienda una imagen PNG con fondo transparente.</small>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Color Primario</label>
                            <div className="color-picker-wrapper">
                                <input
                                    type="color"
                                    name="config.primaryColor"
                                    value={formData.config.primaryColor}
                                    onChange={handleChange}
                                />
                                <span>{formData.config.primaryColor}</span>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Escala Máxima</label>
                            <select name="config.scaleMax" value={formData.config.scaleMax} onChange={handleChange}>
                                <option value={10}>Escala 10 (Ej: 0 - 10)</option>
                                <option value={100}>Escala 100 (Ej: 0 - 100)</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section className="form-section subscription-info">
                    <h2>Suscripción</h2>
                    <div className="subscription-card">
                        <div className="sub-status">
                            <span className={`badge ${school.subscription?.status}`}>
                                {school.subscription?.status === 'active' ? 'Activa' : 'Suspendida'}
                            </span>
                        </div>
                        <div className="sub-details">
                            <p><strong>ID de Cliente:</strong> {school.subscription?.stripeId || 'N/A'}</p>
                            <p><strong>Próximo Cobro:</strong> {school.subscription?.nextBilling ? new Date(school.subscription.nextBilling).toLocaleDateString() : 'Pendiente'}</p>
                        </div>
                        <button type="button" className="btn-manage-sub">Gestionar en Stripe</button>
                    </div>
                </section>

                <div className="form-actions">
                    <button type="submit" className="btn-save" disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SchoolDashboard;
