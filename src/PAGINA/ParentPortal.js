import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaGraduationCap, FaUser, FaIdCard, FaCalendarAlt, FaStar, FaSchool, FaSignOutAlt } from 'react-icons/fa';
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
            showAlert("No se pudieron cargar los datos académicos.", "danger");
            if (err.response?.status === 401) handleLogout();
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/portal-padres/login`, loginData);
            setToken(res.data.token);
            setAlumno(res.data.alumno);
            showAlert(`Bienvenido, padre/tutor de ${res.data.alumno.nombre}`, "success");
            fetchData(res.data.token);
        } catch (err) {
            showAlert(err.response?.data?.msg || "Error al iniciar sesión.", "danger");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setAlumno(null);
        setData(null);
        showAlert("Sesión de consulta cerrada.", "info");
    };

    if (!token) {
        return (
            <div className="portal-login-container dark-theme">
                {loading && <LoadingOverlay message="Ingresando al Portal..." />}
                <DynamicBackground />
                <div className="portal-login-card glass">
                    <FaGraduationCap className="portal-logo-icon" />
                    <h2>Portal de Padres y Alumnos</h2>
                    <p>Ingresa los datos para consultar el progreso académico.</p>

                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <FaUser className="input-icon" />
                            <input
                                type="text"
                                placeholder="Correo o Teléfono registrado"
                                value={loginData.email}
                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <FaIdCard className="input-icon" />
                            <input
                                type="text"
                                placeholder="Matrícula (Ej: 0001)"
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
                            <span className="student-name">{alumno?.nombre} {alumno?.apellidoPaterno} {alumno?.apellidoMaterno}</span>
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
