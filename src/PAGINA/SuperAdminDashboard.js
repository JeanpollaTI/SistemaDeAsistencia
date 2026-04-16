// src/PAGINA/SuperAdminDashboard.js
import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from '../COMPONENTE/NotificationContext';
import { FaTrash, FaCheckCircle, FaExclamationTriangle, FaClock, FaSyncAlt } from 'react-icons/fa';
import './SuperAdminDashboard.css';

const SuperAdminDashboard = ({ user }) => {
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, active: 0, trial: 0, suspended: 0 });
    const { addNotification } = useNotification();
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusForm, setStatusForm] = useState({ status: 'active', days: 30 });

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

    useEffect(() => {
        fetchSchools();
    }, []);

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
        if (window.confirm(`¿ESTÁS SEGURO? Esta acción eliminará permanentemente la escuela "${name}" y TODOS sus profesores, grupos, alumnos y calificaciones. Esta acción NO se puede deshacer.`)) {
            try {
                await apiClient.delete(`/api/superadmin/schools/${id}`);
                addNotification('Escuela eliminada correctamente', 'success');
                fetchSchools();
            } catch (error) {
                addNotification('Error al eliminar escuela', 'error');
            }
        }
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

            {isModalOpen && (
                <div className="status-modal-overlay">
                    <div className="status-modal">
                        <h3>Gestionar Suscripción</h3>
                        <p><strong>Escuela:</strong> {selectedSchool?.name}</p>
                        
                        <form onSubmit={handleUpdateStatus}>
                            <div className="form-group">
                                <label>Nuevo Estado:</label>
                                <select 
                                    className="form-control"
                                    value={statusForm.status}
                                    onChange={(e) => setStatusForm({...statusForm, status: e.target.value})}
                                >
                                    <option value="active">Activa (Acceso Total)</option>
                                    <option value="suspended">Suspendida (Bloqueada)</option>
                                    <option value="trial">Prueba (3 días)</option>
                                </select>
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

                            <div className="actions-cell" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;
