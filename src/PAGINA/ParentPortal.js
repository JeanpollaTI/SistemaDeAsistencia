import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaGraduationCap, FaUser, FaIdCard, FaCalendarAlt, FaStar, FaSchool, FaSignOutAlt, FaLink } from 'react-icons/fa';
import { useNotification } from '../COMPONENTE/NotificationContext';
import DynamicBackground from '../COMPONENTE/DynamicBackground';
import LoadingOverlay from '../COMPONENTE/LoadingOverlay';
import './ParentPortal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ParentPortal() {
    const { showAlert } = useNotification();
    const [loginData, setLoginData] = useState({ email: '', matricula: '' });
    const [token, setToken] = useState(null);
    const [alumno, setAlumno] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [linkingInfo, setLinkingInfo] = useState(null);

    useEffect(() => {
        if (token) {
            fetchData(token);
        }
    }, [token]);

    const fetchData = async (tokenOverride) => {
        const activeToken = tokenOverride || token;
        if (!activeToken) return;

        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/portal-padres/mis-datos`, {
                headers: { Authorization: `Bearer ${activeToken}` }
            });
            setData(res.data);
            showAlert("Datos académicos actualizados.", "success");
        } catch (err) {
            console.error("Error al obtener datos:", err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                showAlert(err.response?.data?.msg || "Acceso denegado.", "danger");
                handleLogout();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/portal-padres/login`, loginData);

            if (res.data.requiresLinking) {
                setLinkingInfo(res.data);
                return;
            }

            setToken(res.data.token);
            setAlumno(res.data.alumno);
            showAlert(res.data.msg || `Bienvenido, padre/tutor de ${res.data.alumno.nombre}`, "success");
            fetchData(res.data.token);
        } catch (err) {
            showAlert(err.response?.data?.msg || "Error al iniciar sesión.", "danger");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmLink = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/portal-padres/login`, {
                ...loginData,
                confirmLink: true
            });

            setToken(res.data.token);
            setAlumno(res.data.alumno);
            setLinkingInfo(null);
            showAlert("¡Cuenta vinculada exitosamente! Bienvenido.", "success");
            fetchData(res.data.token);
        } catch (err) {
            showAlert(err.response?.data?.msg || "Error al vincular la cuenta.", "danger");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setAlumno(null);
        setData(null);
        setLinkingInfo(null);
        showAlert("Sesión de consulta cerrada.", "info");
    };

    if (!token) {
        return (
            <div className="portal-login-container dark-theme">
                {loading && <LoadingOverlay message="Procesando datos..." />}
                <DynamicBackground />
                <div className="portal-login-card glass">
                    <FaGraduationCap className="portal-logo-icon" />
                    <h2>Portal de Padres y Alumnos</h2>
                    <p>Ingresa tus datos para consultar el progreso académico.</p>

                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <FaUser className="input-icon" />
                            <input
                                type="text"
                                placeholder="Correo o Teléfono"
                                value={loginData.email}
                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <FaIdCard className="input-icon" />
                            <input
                                type="text"
                                placeholder="Matrícula dada por la escuela"
                                value={loginData.matricula}
                                onChange={(e) => setLoginData({ ...loginData, matricula: e.target.value })}
                                required
                            />
                        </div>
                        <button type="submit" className="portal-btn" disabled={loading}>
                            {loading ? "Cargando..." : "Entrar al Portal"}
                        </button>
                    </form>
                </div>

                {/* MODAL DE CONFIRMACIÓN DE VINCULACIÓN EN PRIMERA VEZ */}
                {linkingInfo && (
                    <div className="linking-modal-overlay">
                        <div className="linking-modal-card glass">
                            <div className="linking-icon-wrapper">
                                <FaLink className="linking-icon" />
                            </div>
                            <h3>🔗 Vincular Cuenta de Tutor</h3>
                            <p className="linking-subtitle">
                                Es la primera vez que ingresas con esta matrícula. ¿Deseas vincular tu <strong>{linkingInfo.identifierType}</strong> para tus próximos accesos?
                            </p>

                            <div className="linking-details-box">
                                <div className="detail-item">
                                    <span className="detail-label">Alumno:</span>
                                    <span className="detail-value highlight">{linkingInfo.alumno.nombre}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Matrícula:</span>
                                    <span className="detail-value">{linkingInfo.alumno.matricula}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Grupo:</span>
                                    <span className="detail-value">{linkingInfo.alumno.grupo}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Escuela:</span>
                                    <span className="detail-value">{linkingInfo.alumno.escuela}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">{linkingInfo.identifierType === 'correo electrónico' ? 'Correo a vincular:' : 'Teléfono a vincular:'}</span>
                                    <span className="detail-value link-target">{linkingInfo.identifier}</span>
                                </div>
                            </div>

                            <div className="linking-actions">
                                <button
                                    type="button"
                                    className="portal-btn btn-confirm-link"
                                    onClick={handleConfirmLink}
                                    disabled={loading}
                                >
                                    {loading ? "Vinculando..." : "✅ Sí, vincular y entrar"}
                                </button>
                                <button
                                    type="button"
                                    className="btn-cancel-link"
                                    onClick={() => setLinkingInfo(null)}
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="portal-dashboard">
            <header className="portal-header">
                <div className="portal-logo-section">
                    <FaSchool className="portal-logo" />
                    <div className="portal-brand">
                        <h1>Portal de Padres y Alumnos</h1>
                        <span>Sistema de Gestión Escolar | {data?.escuela || alumno?.escuela || "Institución"}</span>
                    </div>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                    <FaSignOutAlt /> Cerrar Consulta
                </button>
            </header>

            <main className="portal-content">
                <section className="portal-section">
                    <div className="section-header">
                        <FaStar className="section-icon" />
                        <h2>Calificaciones</h2>
                    </div>

                    {loading && <LoadingOverlay message="Cargando tus datos..." />}

                    <div className="portal-student-name-display">
                        <FaUser className="student-icon" />
                        <div className="student-details">
                            <span className="student-name">{alumno?.nombre}</span>
                            <span className="student-group">{alumno?.grupo} | Matrícula: {alumno?.matricula}</span>
                        </div>
                    </div>

                    <div className="portal-table-container">
                        <table className="portal-table">
                            <thead>
                                <tr>
                                    <th>Asignatura</th>
                                    <th>Trim 1</th>
                                    <th>Trim 2</th>
                                    <th>Trim 3</th>
                                    <th>Promedio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.calificaciones?.map((cal, idx) => {
                                    const grades = Object.values(cal.bimestres || {}).filter(v => v !== null);
                                    const avg = grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) : "---";

                                    return (
                                        <tr key={idx}>
                                            <td>{cal.asignatura}</td>
                                            <td>{cal.bimestres[1] || "---"}</td>
                                            <td>{cal.bimestres[2] || "---"}</td>
                                            <td>{cal.bimestres[3] || "---"}</td>
                                            <td className="final-grade">{avg}</td>
                                        </tr>
                                    );
                                })}
                                {(!data?.calificaciones || data.calificaciones.length === 0) && (
                                    <tr><td colSpan="5">No hay calificaciones registradas aún.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="portal-section">
                    <div className="section-header">
                        <FaCalendarAlt className="section-icon" />
                        <h2>Asistencia Detallada</h2>
                    </div>
                    <div className="portal-table-container">
                        <table className="portal-table">
                            <thead>
                                <tr>
                                    <th>Asignatura</th>
                                    <th style={{ textAlign: 'center' }}>Presentes</th>
                                    <th style={{ textAlign: 'center' }}>Faltas</th>
                                    <th style={{ textAlign: 'center' }}>Retardos</th>
                                    <th style={{ textAlign: 'center' }}>Justificados</th>
                                    <th style={{ textAlign: 'center' }}>Total Reg.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.asistencias?.map((asis, idx) => (
                                    <tr key={idx}>
                                        <td>{asis.asignatura}</td>
                                        <td style={{ textAlign: 'center', color: '#27ae60', fontWeight: 'bold' }}>{asis.presentes}</td>
                                        <td style={{ textAlign: 'center', color: '#e74c3c', fontWeight: 'bold' }}>{asis.faltas}</td>
                                        <td style={{ textAlign: 'center', color: '#00CBCB', fontWeight: 'bold' }}>{asis.retardos}</td>
                                        <td style={{ textAlign: 'center', color: '#3498db', fontWeight: 'bold' }}>{asis.justificados}</td>
                                        <td style={{ textAlign: 'center' }}>{asis.totales}</td>
                                    </tr>
                                ))}
                                {(!data?.asistencias || data.asistencias.length === 0) && (
                                    <tr><td colSpan="5" className="placeholder-text">No hay registros de asistencia aún.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="portal-footer-actions">
                    <button onClick={handleLogout} className="logout-btn-large">
                        Cerrar Consulta
                    </button>
                    <p className="footer-note">Cierre la consulta si está en un equipo compartido.</p>
                </div>
            </main>
        </div>
    );
}

export default ParentPortal;
