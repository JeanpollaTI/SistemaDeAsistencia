import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaUser, FaSchool, FaUsers, FaGraduationCap, FaCalendarAlt, FaStar, FaArrowLeft, FaPrint, FaIdCard } from 'react-icons/fa';
import apiClient from '../api/apiClient';
import LoadingOverlay from '../COMPONENTE/LoadingOverlay';
import './FichaAlumno.css';

const FichaAlumno = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchFicha = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/api/grupos/alumno/${id}/ficha`);
                setData(res.data);
            } catch (err) {
                console.error("Error fetching ficha:", err);
                setError(err.response?.data?.error || "Error al cargar la ficha del alumno.");
            } finally {
                setLoading(false);
            }
        };
        fetchFicha();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <LoadingOverlay message="Cargando ficha del alumno..." />;

    if (error) {
        return (
            <div className="ficha-error-container">
                <div className="error-card glass">
                    <h2>Ups! Algo salió mal</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate(-1)} className="back-btn">
                        <FaArrowLeft /> Volver atrás
                    </button>
                </div>
            </div>
        );
    }

    const { alumno, calificaciones, asistencias } = data;

    return (
        <div className="ficha-page-container">
            <header className="ficha-header no-print">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaArrowLeft /> Volver
                </button>
                <div className="header-actions">
                    <button onClick={handlePrint} className="print-btn">
                        <FaPrint /> Imprimir Ficha
                    </button>
                </div>
            </header>

            <div className="ficha-content printable">
                <div className="ficha-card glass">
                    <div className="student-hero">
                        <div className="avatar-placeholder">
                            <FaUser />
                        </div>
                        <div className="student-main-info">
                            <h1>{alumno.nombre}</h1>
                            <div className="info-grid">
                                <div className="info-item">
                                    <FaIdCard className="icon" />
                                    <span><strong>Matrícula:</strong> {alumno.matricula}</span>
                                </div>
                                <div className="info-item">
                                    <FaUsers className="icon" />
                                    <span><strong>Grupo:</strong> {alumno.grupo}</span>
                                </div>
                                <div className="info-item">
                                    <FaSchool className="icon" />
                                    <span><strong>Escuela:</strong> {alumno.escuela}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ficha-sections">
                        {/* CALIFICACIONES */}
                        <section className="ficha-section">
                            <div className="section-title">
                                <FaStar className="icon" />
                                <h2>Desempeño Académico</h2>
                            </div>
                            <div className="table-responsive">
                                <table className="ficha-table">
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
                                        {calificaciones.map((cal, idx) => {
                                            const activeGrades = Object.values(cal.bimestres).filter(v => v !== null);
                                            const avg = activeGrades.length > 0 ? (activeGrades.reduce((a, b) => a + b, 0) / activeGrades.length).toFixed(1) : '---';
                                            return (
                                                <tr key={idx}>
                                                    <td>{cal.asignatura}</td>
                                                    <td className={cal.bimestres[1] < 6 ? 'reproved' : ''}>{cal.bimestres[1] || '---'}</td>
                                                    <td className={cal.bimestres[2] < 6 ? 'reproved' : ''}>{cal.bimestres[2] || '---'}</td>
                                                    <td className={cal.bimestres[3] < 6 ? 'reproved' : ''}>{cal.bimestres[3] || '---'}</td>
                                                    <td className="final-avg">{avg}</td>
                                                </tr>
                                            );
                                        })}
                                        {calificaciones.length === 0 && (
                                            <tr><td colSpan="5" className="empty-msg">No hay calificaciones registradas.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* ASISTENCIAS */}
                        <section className="ficha-section">
                            <div className="section-title">
                                <FaCalendarAlt className="icon" />
                                <h2>Registro de Asistencia</h2>
                            </div>
                            <div className="table-responsive">
                                <table className="ficha-table">
                                    <thead>
                                        <tr>
                                            <th>Asignatura</th>
                                            <th className="center">Asistencia %</th>
                                            <th className="center">Faltas</th>
                                            <th className="center">Retardos</th>
                                            <th className="center">Justificados</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {asistencias.map((asis, idx) => {
                                            const percentage = asis.totales > 0 ? ((asis.presentes / asis.totales) * 100).toFixed(0) : '---';
                                            return (
                                                <tr key={idx}>
                                                    <td>{asis.asignatura}</td>
                                                    <td className="center">
                                                        <div className="percentage-badge" style={{ backgroundColor: percentage >= 80 ? '#27ae60' : percentage >= 70 ? '#f39c12' : '#e74c3c' }}>
                                                            {percentage}%
                                                        </div>
                                                    </td>
                                                    <td className="center bold reproved">{asis.faltas}</td>
                                                    <td className="center bold warning">{asis.retardos}</td>
                                                    <td className="center bold info">{asis.justificados}</td>
                                                </tr>
                                            );
                                        })}
                                        {asistencias.length === 0 && (
                                            <tr><td colSpan="5" className="empty-msg">No hay registros de asistencia.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FichaAlumno;
