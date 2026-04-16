// src/PAGINA/SuperAdminDashboard.js
import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from '../COMPONENTE/NotificationContext';
import { FaTrash, FaCheckCircle, FaExclamationTriangle, FaClock, FaSyncAlt, FaThList, FaLightbulb, FaBullhorn, FaThumbtack, FaMagic, FaInfoCircle } from 'react-icons/fa';
import './SuperAdminDashboard.css';

const SuperAdminDashboard = ({ user }) => {
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, active: 0, trial: 0, suspended: 0 });
    const { addNotification, showConfirm } = useNotification();
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusForm, setStatusForm] = useState({ status: 'active', days: 30 });

    // New state for Suggestions and Broadcasts
    const [activeTab, setActiveTab] = useState('schools');
    const [suggestions, setSuggestions] = useState([]);
    const [broadcasts, setBroadcasts] = useState([]);
    const [broadcastForm, setBroadcastForm] = useState({ message: '', type: 'update', days: 7 });
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/api/superadmin/schools');
            setSchools(res.data);
            calculateStats(res.data);
        } catch (error) {
            console.error('Error fetching schools:', error);
            addNotification('Error al cargar las escuelas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data) => {
        const statsObj = data.reduce((acc, school) => {
            acc.total++;
            acc[school.subscription.status]++;
            return acc;
        }, { total: 0, active: 0, trial: 0, suspended: 0 });
        setStats(statsObj);
    };

    const fetchSuggestions = async () => {
        try {
            const res = await apiClient.get('/api/superadmin/suggestions');
            setSuggestions(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchBroadcasts = async () => {
        try {
            const res = await apiClient.get('/api/superadmin/broadcasts/active');
            setBroadcasts(res.data);
        } catch (e) { console.error(e); }
    };

    const refreshData = () => {
        if (activeTab === 'schools') fetchSchools();
        if (activeTab === 'suggestions') fetchSuggestions();
        if (activeTab === 'broadcasts') fetchBroadcasts();
    };

    useEffect(() => {
        refreshData();
    }, [activeTab]);

    const openStatusModal = (school) => {
        setSelectedSchool(school);
        setStatusForm({ 
            status: school.subscription.status, 
            days: school.subscription.status === 'suspended' ? 30 : 0 
        });
        setIsModalOpen(true);
    };

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        try {
            await apiClient.put(`/api/superadmin/schools/${selectedSchool._id}/status`, statusForm);
            addNotification(`Estado de ${selectedSchool.name} actualizado`, 'success');
            setIsModalOpen(false);
            fetchSchools();
        } catch (error) {
            addNotification('Error al actualizar estado', 'error');
        }
    };

    const handleDeleteSchool = async (id, name) => {
        showConfirm(
            'ELIMINAR INSTITUCIÓN',
            `¿ESTÁS TOTALMENTE SEGURO? Esta acción eliminará permanentemente la escuela "${name}" y TODOS sus profesores, grupos, alumnos y calificaciones. Esta acción NO se puede deshacer.`,
            async () => {
                try {
                    await apiClient.delete(`/api/superadmin/schools/${id}`);
                    addNotification('Escuela eliminada correctamente', 'success');
                    fetchSchools();
                } catch (error) {
                    addNotification('Error al eliminar escuela', 'error');
                }
            }
        );
    };

    const handlePinSuggestion = async (id) => {
        try {
            await apiClient.put(`/api/superadmin/suggestions/${id}/pin`);
            fetchSuggestions();
        } catch (e) { addNotification('Error al anclar sugerencia', 'error'); }
    };

    const handleDeleteSuggestion = async (id) => {
        showConfirm(
            'Eliminar Sugerencia',
            '¿Deseas eliminar este reporte? Esta acción es permanente.',
            async () => {
                try {
                    await apiClient.delete(`/api/superadmin/suggestions/${id}`);
                    addNotification('Sugerencia eliminada', 'info');
                    fetchSuggestions();
                } catch (e) { addNotification('Error al eliminar', 'error'); }
            }
        );
    };

    const handleSendBroadcast = async (e) => {
        e.preventDefault();
        setIsBroadcasting(true);
        try {
            await apiClient.post('/api/superadmin/broadcast', broadcastForm);
            addNotification('Comunicado enviado a todas las escuelas', 'success');
            setBroadcastForm({ message: '', type: 'update', days: 7 });
            fetchBroadcasts();
        } catch (e) { addNotification('Error al enviar comunicado', 'error'); }
        finally { setIsBroadcasting(false); }
    };

    if (loading && schools.length === 0) {
        return <div className="superadmin-dashboard">Cargando datos globales...</div>;
    }

    return (
        <div className="superadmin-dashboard">
            <div className="dashboard-header">
                <div>
                    <h1>Panel de Gestión Global</h1>
                    <p className="subtitle">Bienvenido, Manager. Control total de la plataforma.</p>
                </div>
                <button className="btn-refresh" onClick={fetchSchools}>
                    <FaSyncAlt /> Refrescar
                </button>
            </div>

            <div className="dashboard-tabs">
                <button className={`tab-btn ${activeTab === 'schools' ? 'active' : ''}`} onClick={() => setActiveTab('schools')}>
                    <FaThList /> Escuelas
                </button>
                <button className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`} onClick={() => setActiveTab('suggestions')}>
                    <FaLightbulb /> Buzón Sugerencias {suggestions.length > 0 && `(${suggestions.length})`}
                </button>
                <button className={`tab-btn ${activeTab === 'broadcasts' ? 'active' : ''}`} onClick={() => setActiveTab('broadcasts')}>
                    <FaBullhorn /> Comunicados
                </button>
            </div>

            {activeTab === 'schools' && (
                <>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <span className="stat-value">{stats.total}</span>
                            <span className="stat-label">Instituciones</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-value" style={{ color: '#22c55e' }}>{stats.active}</span>
                            <span className="stat-label">Activas</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-value" style={{ color: '#eab308' }}>{stats.trial}</span>
                            <span className="stat-label">En Prueba</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-value" style={{ color: '#ef4444' }}>{stats.suspended}</span>
                            <span className="stat-label">Suspendidas</span>
                        </div>
                    </div>

                    <div className="schools-table-container">
                        <table className="schools-table">
                            <thead>
                                <tr>
                                    <th>Institución</th>
                                    <th>Admin / Contacto</th>
                                    <th>Usuarios</th>
                                    <th>Estado</th>
                                    <th>Próximo Pago</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schools.map(school => (
                                    <tr key={school._id}>
                                        <td>
                                            <strong>{school.name}</strong>
                                            <br />
                                            <span className="admin-info">{school.type}</span>
                                        </td>
                                        <td>
                                            {school.adminContact ? (
                                                <div className="admin-info">
                                                    <span className="admin-name">{school.adminContact.nombre}</span>
                                                    <span>{school.adminContact.email}</span>
                                                    <br />
                                                    <span>{school.adminContact.celular}</span>
                                                </div>
                                            ) : <span className="admin-info">Sin admin registrado</span>}
                                        </td>
                                        <td>
                                            <div className="admin-info">
                                                <span>👥 {school.stats.userCount} usuarios</span>
                                                <br />
                                                <span>📚 {school.stats.groupCount} grupos</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge status-${school.subscription.status}`}>
                                                {school.subscription.status === 'active' && <FaCheckCircle />}
                                                {school.subscription.status === 'suspended' && <FaExclamationTriangle />}
                                                {school.subscription.status === 'trial' && <FaClock />}
                                                {' '} {school.subscription.status}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="admin-info">
                                                {school.subscription.nextBilling ? 
                                                    new Date(school.subscription.nextBilling).toLocaleDateString() : 
                                                    'N/A'}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <button 
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => openStatusModal(school)}
                                                >
                                                    Gestionar
                                                </button>
                                                <button 
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleDeleteSchool(school._id, school.name)}
                                                    style={{ padding: '0.4rem', minWidth: '38px' }}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {activeTab === 'suggestions' && (
                <div className="suggestions-section">
                    <h2>Buzón de Retroalimentación</h2>
                    <p>Sugerencias enviadas por usuarios de todas las instituciones.</p>
                    
                    {suggestions.length === 0 ? (
                        <div className="management-card">No hay sugerencias por el momento.</div>
                    ) : (
                        suggestions.map(s => (
                            <div key={s.id} className={`suggestion-item ${s.isPinned ? 'pinned' : ''}`}>
                                <div className="suggestion-content">
                                    <div className="suggestion-meta">
                                        <strong>{s.author_id?.nombre || 'Desconocido'}</strong> ({s.author_id?.role}) de <strong>{s.school_id?.name || 'Sistema'}</strong>
                                        {' • '} {new Date(s.createdAt).toLocaleDateString()}
                                    </div>
                                    <p style={{ margin: '8px 0', fontSize: '1.1rem', color: '#eee' }}>{s.content}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button 
                                        onClick={() => handlePinSuggestion(s.id)}
                                        style={{ background: s.isPinned ? '#f1c40f' : 'transparent', color: s.isPinned ? '#000' : '#888', border: '1px solid #444', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                                        title={s.isPinned ? 'Desanclar' : 'Anclar / Destacar'}
                                    >
                                        <FaThumbtack />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteSuggestion(s.id)}
                                        style={{ background: 'transparent', color: '#ff4d4d', border: '1px solid #444', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                                        title="Eliminar"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'broadcasts' && (
                <div className="broadcasts-section">
                    <div className="management-card">
                        <h2>Nuevo Comunicado Global</h2>
                        <p>Este mensaje aparecerá en el inicio de todas las escuelas.</p>
                        
                        <form onSubmit={handleSendBroadcast} className="broadcast-form">
                            <div className="form-group">
                                <label>Mensaje del Comunicado:</label>
                                <textarea 
                                    className="form-control" 
                                    style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', padding: '12px', minHeight: '100px' }}
                                    value={broadcastForm.message}
                                    onChange={(e) => setBroadcastForm({...broadcastForm, message: e.target.value})}
                                    placeholder="Ej: La plataforma se actualizará este fin de semana para incluir nuevas funciones..."
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ marginBottom: '1rem', display: 'block', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>
                                    Tipo de Comunicado:
                                </label>
                                <div className="alert-selection-grid">
                                    <div 
                                        className={`alert-card-input type-update ${broadcastForm.type === 'update' ? 'selected' : ''}`}
                                        onClick={() => setBroadcastForm({...broadcastForm, type: 'update'})}
                                    >
                                        <FaMagic /> <span>Mejora</span>
                                    </div>
                                    <div 
                                        className={`alert-card-input type-success ${broadcastForm.type === 'success' ? 'selected' : ''}`}
                                        onClick={() => setBroadcastForm({...broadcastForm, type: 'success'})}
                                    >
                                        <FaCheckCircle /> <span>Novedad</span>
                                    </div>
                                    <div 
                                        className={`alert-card-input type-warning ${broadcastForm.type === 'warning' ? 'selected' : ''}`}
                                        onClick={() => setBroadcastForm({...broadcastForm, type: 'warning'})}
                                    >
                                        <FaExclamationTriangle /> <span>Aviso</span>
                                    </div>
                                    <div 
                                        className={`alert-card-input type-info ${broadcastForm.type === 'info' ? 'selected' : ''}`}
                                        onClick={() => setBroadcastForm({...broadcastForm, type: 'info'})}
                                    >
                                        <FaInfoCircle /> <span>Info</span>
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Duración (días):</label>
                                <input 
                                    type="number" 
                                    className="form-control"
                                    value={broadcastForm.days}
                                    onChange={(e) => setBroadcastForm({...broadcastForm, days: parseInt(e.target.value)})}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={isBroadcasting} style={{ width: '100%', marginTop: '1rem', padding: '12px', fontWeight: 'bold' }}>
                                {isBroadcasting ? 'REMITIENDO...' : 'PUBLICAR COMUNICADO GLOBAL'}
                            </button>
                        </form>
                    </div>

                    <div className="management-card">
                        <h3>Historia de Comunicados Recientes</h3>
                        {broadcasts.length === 0 ? <p>No hay comunicados activos.</p> : (
                            broadcasts.map(b => (
                                <div key={b.id} className="broadcast-history-item" style={{ borderLeft: `4px solid var(--status-${b.type || 'info'})` }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 'bold' }}>{b.message}</p>
                                        <small style={{ color: '#888' }}>Publicado el {new Date(b.createdAt).toLocaleDateString()}</small>
                                    </div>
                                    <span className={`status-badge status-${b.type}`}>{b.type}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="status-modal-overlay">
                    <div className="status-modal">
                        <h3>Gestionar Suscripción</h3>
                        <p><strong>Escuela:</strong> {selectedSchool?.name}</p>
                        
                        <form onSubmit={handleUpdateStatus}>
                            <div className="form-group">
                                <label style={{ textAlign: 'center', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                    Selecciona el Nuevo Estado
                                </label>
                                <div className="status-selection-grid">
                                    <div 
                                        className={`status-card-input active-state ${statusForm.status === 'active' ? 'selected' : ''}`}
                                        onClick={() => setStatusForm({...statusForm, status: 'active'})}
                                    >
                                        <FaCheckCircle />
                                        <span>Activa</span>
                                    </div>
                                    <div 
                                        className={`status-card-input trial-state ${statusForm.status === 'trial' ? 'selected' : ''}`}
                                        onClick={() => setStatusForm({...statusForm, status: 'trial'})}
                                    >
                                        <FaClock />
                                        <span>Prueba</span>
                                    </div>
                                    <div 
                                        className={`status-card-input suspended-state ${statusForm.status === 'suspended' ? 'selected' : ''}`}
                                        onClick={() => setStatusForm({...statusForm, status: 'suspended'})}
                                    >
                                        <FaExclamationTriangle />
                                        <span>Suspended</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Extender tiempo (días desde hoy):</label>
                                <input 
                                    type="number"
                                    className="form-control"
                                    value={statusForm.days}
                                    onChange={(e) => setStatusForm({...statusForm, days: parseInt(e.target.value)})}
                                    placeholder="0 para no cambiar fecha"
                                />
                                <small style={{ color: '#aaa' }}>Ej: 30 para un mes, 3 para prueba.</small>
                            </div>

                            <div className="modal-footer-actions">
                                <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="btn-modal-save">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;
