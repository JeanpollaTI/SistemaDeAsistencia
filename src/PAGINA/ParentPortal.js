import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaGraduationCap, FaUser, FaIdCard, FaCalendarAlt, FaStar } from 'react-icons/fa';
import './ParentPortal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ParentPortal() {
    const [loginData, setLoginData] = useState({ email: '', matricula: '' });
    const [token, setToken] = useState(sessionStorage.getItem('parentToken'));
    const [alumno, setAlumno] = useState(() => {
        const saved = sessionStorage.getItem('alumnoData');
        try {
            return (saved && saved !== 'undefined') ? JSON.parse(saved) : null;
        } catch (err) {
            console.error("Error parsing alumnoData:", err);
            return null;
        }
    });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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
        } catch (err) {
            console.error("Error al obtener datos:", err);
            setError("No se pudieron cargar los datos acadmicos.");
            if (err.response?.status === 401) handleLogout();
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await axios.post(`${API_URL}/api/portal-padres/login`, loginData);
            setToken(res.data.token);
            setAlumno(res.data.alumno);
            sessionStorage.setItem('parentToken', res.data.token);
            sessionStorage.setItem('alumnoData', JSON.stringify(res.data.alumno));
            // Fetch data immediately with the new token
            fetchData(res.data.token);
        } catch (err) {
            setError(err.response?.data?.msg || "Error al iniciar sesión.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setAlumno(null);
        setData(null);
        sessionStorage.removeItem('parentToken');
        sessionStorage.removeItem('alumnoData');
    };

    if (!token) {
        return (
            <div className="portal-login-container">
                <div className="portal-login-card">
                    <FaGraduationCap className="portal-logo-icon" />
                    <h2>Portal de Padres y Alumnos</h2>
                    <p>Ingresa los datos para consultar el progreso académico.</p>

                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <FaUser className="input-icon" />
                            <input
                                type="email"
                                placeholder="Correo registrado"
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
                        {error && <p className="portal-error">{error}</p>}
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
                <div className="portal-user-info">
                    <div className="avatar">{(alumno?.nombre || "A").substring(0, 1)}</div>
                    <div>
                        <h3>{alumno?.nombre} {alumno?.apellidoPaterno}</h3>
                        <p>Matrícula: {alumno?.matricula} | Grupo: {alumno?.grupo}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="logout-btn">Cerrar Sesión</button>
            </header>

            <main className="portal-content">
                <section className="portal-section">
                    <div className="section-header">
                        <FaStar className="section-icon" />
                        <h2>Calificaciones</h2>
                    </div>

                    <div className="portal-student-name-display">
                        <FaUser className="student-icon" />
                        <span>{alumno?.nombre} {alumno?.apellidoPaterno} {alumno?.apellidoMaterno}</span>
                    </div>

                    {loading ? <p>Cargando calificaciones...</p> : (
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
                    )}
                </section>

                <section className="portal-section inactive">
                    <div className="section-header">
                        <FaCalendarAlt className="section-icon" />
                        <h2>Asistencia (Próximamente)</h2>
                    </div>
                    <p className="placeholder-text">El detalle de asistencia se habilitará en la siguiente actualización.</p>
                </section>
            </main>
        </div>
    );
}

export default ParentPortal;
