import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaGraduationCap,
    FaUser,
    FaIdCard,
    FaCalendarAlt,
    FaStar,
    FaSchool,
    FaSignOutAlt,
    FaLink,
    FaClipboardList,
    FaCheckCircle,
    FaExclamationTriangle,
    FaTimes
} from 'react-icons/fa';
import { useNotification } from '../COMPONENTE/NotificationContext';
import DynamicBackground from '../COMPONENTE/DynamicBackground';
import LoadingOverlay from '../COMPONENTE/LoadingOverlay';
import './ParentPortal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const COMPROMISOS_PREDEFINIDOS = [
    "Enterado(a) del reporte, hablaré con mi hijo(a) y tomaré medidas en casa.",
    "Enterado(a), daré seguimiento puntual a su conducta y cumplimiento escolar.",
    "Enterado(a), me comprometo a reforzar los acuerdos de convivencia desde casa.",
    "Enterado(a), acudiré o me comunicaré con Trabajo Social para dar seguimiento."
];

function ParentPortal() {
    const { showAlert } = useNotification();
    const [loginData, setLoginData] = useState({ email: '', matricula: '' });
    const [token, setToken] = useState(null);
    const [alumno, setAlumno] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [linkingInfo, setLinkingInfo] = useState(null);

    // Estado para el modal de Historial de Reportes de Trabajo Social
    const [showReportesModal, setShowReportesModal] = useState(false);
    const [compromisosPorReporte, setCompromisosPorReporte] = useState({});
    const [confirmingId, setConfirmingId] = useState(null);

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

    const handleConfirmarEnterado = async (incidenciaId) => {
        if (!token || !incidenciaId) return;
        const compromisoSeleccionado =
            compromisosPorReporte[incidenciaId] !== undefined
                ? compromisosPorReporte[incidenciaId]
                : COMPROMISOS_PREDEFINIDOS[0];

        setConfirmingId(incidenciaId);
        try {
            const res = await axios.put(
                `${API_URL}/api/portal-padres/incidencias/${incidenciaId}/enterado`,
                { compromisoPadre: compromisoSeleccionado },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setData(prev => ({
                ...prev,
                incidencias: res.data.incidencias || []
            }));
            showAlert(res.data.msg || "Confirmación de enterado guardada correctamente.", "success");
        } catch (err) {
            console.error("Error al confirmar reporte:", err);
            showAlert(err.response?.data?.msg || "No se pudo registrar la confirmación.", "danger");
        } finally {
            setConfirmingId(null);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setAlumno(null);
        setData(null);
        setLinkingInfo(null);
        setShowReportesModal(false);
        showAlert("Sesión de consulta cerrada.", "info");
    };

    const formatFechaReporte = (fechaStr) => {
        if (!fechaStr) return "Sin fecha registrada";
        const partes = String(fechaStr).split("-");
        if (partes.length === 3) {
            const [anio, mes, dia] = partes;
            const meses = [
                "enero", "febrero", "marzo", "abril", "mayo", "junio",
                "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
            ];
            const mesNombre = meses[parseInt(mes, 10) - 1] || mes;
            return `${parseInt(dia, 10)} de ${mesNombre} de ${anio} (${fechaStr})`;
        }
        return fechaStr;
    };

    const incidencias = Array.isArray(data?.incidencias) ? data.incidencias : [];
    const reportesPendientesEnterado = incidencias.filter(inc => !inc.enteradoPadre).length;

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
                        <div className="portal-student-info-left">
                            <FaUser className="student-icon" />
                            <div className="student-details">
                                <span className="student-name" style={{ color: '#000000' }}>
                                    {alumno?.nombre}
                                </span>
                                <span className="student-group" style={{ color: '#222222' }}>
                                    Grupo: <strong>{alumno?.grupo}</strong> | Matrícula: <strong>{alumno?.matricula}</strong>
                                </span>
                            </div>
                        </div>

                        <div className="portal-student-actions-right">
                            <button
                                type="button"
                                className={`btn-historial-reportes ${incidencias.length > 0 ? (reportesPendientesEnterado > 0 ? 'has-pending' : 'has-reports') : 'is-empty'}`}
                                onClick={() => setShowReportesModal(true)}
                            >
                                <FaClipboardList className="btn-reportes-icon" />
                                <div className="btn-reportes-text">
                                    <span className="btn-reportes-title">Historial de Reportes (Trabajo Social)</span>
                                    <span className="btn-reportes-badge">
                                        {incidencias.length === 0
                                            ? "Vacío (Sin reportes)"
                                            : reportesPendientesEnterado > 0
                                                ? `⚠️ ${incidencias.length} reporte(s) • ${reportesPendientesEnterado} por confirmar de enterado`
                                                : `✅ ${incidencias.length} reporte(s) • Enterado confirmado`}
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {reportesPendientesEnterado > 0 && (
                        <div className="portal-ts-alert-banner" onClick={() => setShowReportesModal(true)}>
                            <div className="portal-ts-alert-content">
                                <FaExclamationTriangle className="portal-ts-alert-icon" />
                                <div>
                                    <strong>Aviso de Trabajo Social:</strong> Su hijo(a) tiene{' '}
                                    <strong>{reportesPendientesEnterado} reporte(s)</strong> pendiente(s) de confirmación de enterado.
                                </div>
                            </div>
                            <button type="button" className="portal-ts-alert-btn">
                                Ver y Confirmar Enterado
                            </button>
                        </div>
                    )}

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
                                    <tr><td colSpan="6" className="placeholder-text">No hay registros de asistencia aún.</td></tr>
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

            {/* MODAL DE HISTORIAL DE REPORTES DE TRABAJO SOCIAL */}
            {showReportesModal && (
                <div className="portal-reportes-modal-overlay" onClick={() => setShowReportesModal(false)}>
                    <div className="portal-reportes-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="portal-reportes-modal-header">
                            <div className="portal-reportes-header-title">
                                <FaClipboardList className="portal-reportes-header-icon" />
                                <div>
                                    <h3>Historial de Reportes — Trabajo Social</h3>
                                    <p>
                                        Alumno(a): <strong>{alumno?.nombre}</strong> | Grupo: <strong>{alumno?.grupo}</strong> | Matrícula: <strong>{alumno?.matricula}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="portal-reportes-close-btn"
                                onClick={() => setShowReportesModal(false)}
                                aria-label="Cerrar historial de reportes"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="portal-reportes-modal-body">
                            {incidencias.length === 0 ? (
                                <div className="portal-reportes-empty">
                                    <FaCheckCircle className="portal-reportes-empty-icon" />
                                    <h4>Historial de Reportes Vacío</h4>
                                    <p>
                                        ¡Excelente! Actualmente <strong>{alumno?.nombre}</strong> no tiene ningún reporte disciplinario, citatorio ni incidencia registrada por parte del departamento de Trabajo Social.
                                    </p>
                                </div>
                            ) : (
                                <div className="portal-reportes-list">
                                    {incidencias.map((inc, index) => {
                                        const compromisoActual =
                                            compromisosPorReporte[inc._id] !== undefined
                                                ? compromisosPorReporte[inc._id]
                                                : COMPROMISOS_PREDEFINIDOS[0];

                                        return (
                                            <div
                                                key={inc._id || index}
                                                className={`portal-reporte-item ${inc.enteradoPadre ? 'is-acknowledged' : 'is-pending-ack'}`}
                                            >
                                                <div className="portal-reporte-top">
                                                    <div className="portal-reporte-badges">
                                                        <span className="portal-reporte-tipo">
                                                            {inc.tipo || "Reporte escolar"}
                                                        </span>
                                                        <span className={`portal-reporte-estatus estatus-${(inc.estatus || 'Pendiente').toLowerCase().replace(/\s+/g, '-')}`}>
                                                            Estatus: {inc.estatus || "Pendiente"}
                                                        </span>
                                                    </div>
                                                    <div className="portal-reporte-fecha">
                                                        📅 <strong>Fecha del reporte:</strong> {formatFechaReporte(inc.fecha)}
                                                    </div>
                                                </div>

                                                <div className="portal-reporte-section">
                                                    <span className="portal-reporte-label">Descripción del reporte:</span>
                                                    <p className="portal-reporte-desc">{inc.descripcion}</p>
                                                </div>

                                                {inc.acciones && (
                                                    <div className="portal-reporte-section acciones-box">
                                                        <span className="portal-reporte-label">Acciones tomadas / Seguimiento por Trabajo Social:</span>
                                                        <p className="portal-reporte-desc">{inc.acciones}</p>
                                                    </div>
                                                )}

                                                {/* SECCIÓN DE ENTERADO Y COMPROMISO DEL PADRE/TUTOR */}
                                                <div className="portal-reporte-ack-box">
                                                    {inc.enteradoPadre ? (
                                                        <div className="portal-reporte-ack-confirmed">
                                                            <div className="ack-confirmed-header">
                                                                <FaCheckCircle className="ack-icon" />
                                                                <span>
                                                                    <strong>Padre / Tutor Enterado</strong>
                                                                    {inc.fechaEnteradoPadre ? ` • Confirmado el ${inc.fechaEnteradoPadre}` : ''}
                                                                </span>
                                                            </div>
                                                            <p className="ack-confirmed-message">
                                                                "{inc.compromisoPadre || 'Enterado(a), tomaré las medidas necesarias en casa.'}"
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="portal-reporte-ack-form">
                                                            <label className="ack-form-label">
                                                                Confirmación de Enterado y Compromiso del Padre/Tutor:
                                                            </label>
                                                            <select
                                                                className="ack-select-preset"
                                                                value={
                                                                    COMPROMISOS_PREDEFINIDOS.includes(compromisoActual)
                                                                        ? compromisoActual
                                                                        : "__custom__"
                                                                }
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setCompromisosPorReporte(prev => ({
                                                                        ...prev,
                                                                        [inc._id]: val === "__custom__" ? "" : val
                                                                    }));
                                                                }}
                                                            >
                                                                {COMPROMISOS_PREDEFINIDOS.map((msg, i) => (
                                                                    <option key={i} value={msg}>{msg}</option>
                                                                ))}
                                                                <option value="__custom__">Escribir otro mensaje de compromiso...</option>
                                                            </select>

                                                            <input
                                                                type="text"
                                                                className="ack-custom-input"
                                                                placeholder="Escribe tu respuesta o compromiso como padre/tutor..."
                                                                value={compromisoActual}
                                                                onChange={(e) =>
                                                                    setCompromisosPorReporte(prev => ({
                                                                        ...prev,
                                                                        [inc._id]: e.target.value
                                                                    }))
                                                                }
                                                            />

                                                            <button
                                                                type="button"
                                                                className="btn-confirmar-enterado"
                                                                disabled={confirmingId === inc._id}
                                                                onClick={() => handleConfirmarEnterado(inc._id)}
                                                            >
                                                                {confirmingId === inc._id
                                                                    ? "Registrando confirmación..."
                                                                    : "✅ Enterado(a), tomaré medidas"}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="portal-reportes-modal-footer">
                            <button
                                type="button"
                                className="portal-reportes-btn-cerrar"
                                onClick={() => setShowReportesModal(false)}
                            >
                                Cerrar Historial
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ParentPortal;
