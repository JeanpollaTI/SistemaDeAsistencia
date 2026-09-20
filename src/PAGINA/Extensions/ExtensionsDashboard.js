import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaTable, FaUsers, FaUserGraduate, FaEdit, FaTrash, FaSpinner, FaEye, FaLock, FaCheck } from 'react-icons/fa';
import apiClient from '../../api/apiClient';
import TableBuilderModal from './TableBuilderModal';
import './Extensions.css';

const ExtensionsDashboard = ({ user }) => {
    const navigate = useNavigate();

    const [extensions, setExtensions] = useState([]);
    const [profesores, setProfesores] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    const fetchExtensions = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get('/api/extensions');
            setExtensions(res.data.extensions || []);
            setProfesores(res.data.profesores || []);
            setGrupos(res.data.grupos || []);
        } catch (err) {
            console.error('Error al cargar extensiones:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExtensions();
    }, [fetchExtensions]);

    const handleCreateNew = () => {
        setEditingTemplate(null);
        setIsModalOpen(true);
    };

    const handleEdit = (ext) => {
        setEditingTemplate(ext);
        setIsModalOpen(true);
    };

    const handleDelete = async (extId, extTitle) => {
        if (!window.confirm(`¿Estás seguro de eliminar la extensión "${extTitle}"? Esta acción no se puede deshacer y se borrarán todos los datos capturados.`)) {
            return;
        }

        try {
            await apiClient.delete(`/api/extensions/${extId}`);
            fetchExtensions();
        } catch (err) {
            console.error('Error al eliminar extensión:', err);
            alert('Error al eliminar la extensión: ' + (err.response?.data?.msg || err.message));
        }
    };

    const handleSaveTemplate = async (templateData) => {
        try {
            if (templateData._id) {
                await apiClient.put(`/api/extensions/${templateData._id}`, templateData);
            } else {
                await apiClient.post('/api/extensions', templateData);
            }
            setIsModalOpen(false);
            fetchExtensions();
        } catch (err) {
            console.error('Error al guardar plantilla:', err);
            alert('Error al guardar la extensión: ' + (err.response?.data?.msg || err.message));
        }
    };

    return (
        <div className="ext-dashboard-container">
            {/* Top Hero Banner */}
            <div className="ext-hero-banner">
                <div className="ext-hero-content">
                    <h1>🧩 Extensiones y Tablas de Seguimiento</h1>
                    <p>
                        Módulos y actividades de seguimiento del plantel (Caligrafía, Reflexión Serena, Tablas Matemáticas, PMC, etc.).
                    </p>
                </div>
                {isAdmin && (
                    <button className="ext-btn ext-btn-primary ext-btn-lg" onClick={handleCreateNew}>
                        <FaPlus /> + Nueva Tabla / Extensión
                    </button>
                )}
            </div>

            {loading ? (
                <div className="ext-loading-container">
                    <FaSpinner className="ext-spinner" />
                    <p>Cargando extensiones...</p>
                </div>
            ) : extensions.length === 0 ? (
                <div className="ext-empty-state">
                    <FaTable className="ext-empty-icon" />
                    <h3>No hay extensiones o tablas personalizadas registradas</h3>
                    <p>Crea la primera tabla de seguimiento para evaluar alumnos o grupos del plantel.</p>
                    {isAdmin && (
                        <button className="ext-btn ext-btn-primary" onClick={handleCreateNew}>
                            <FaPlus /> Crear Tabla
                        </button>
                    )}
                </div>
            ) : (
                <div className="ext-cards-grid">
                    {extensions.map((ext) => {
                        const isUserAuthorized = isAdmin || (ext.authorizedTeachers || []).some(
                            t => (typeof t === 'object' ? t._id : t) === user?._id
                        );

                        return (
                            <div key={ext._id} className="ext-card">
                                <div className="ext-card-header">
                                    <div className="ext-card-title-row">
                                        <FaTable className="ext-card-icon" />
                                        <h3 className="ext-card-title">{ext.title}</h3>
                                    </div>
                                    <span className={`ext-type-badge ${ext.rowType === 'STUDENTS' ? 'badge-student' : 'badge-group'}`}>
                                        {ext.rowType === 'STUDENTS' ? <><FaUserGraduate /> Por Alumnos</> : <><FaUsers /> Por Grupos</>}
                                    </span>
                                </div>

                                <div className="ext-card-body">
                                    {ext.description && <p className="ext-card-desc">{ext.description}</p>}

                                    <div className="ext-card-meta">
                                        {ext.rowType === 'STUDENTS' && (
                                            <div className="ext-meta-item">
                                                <strong>Grupo:</strong> {ext.assignedGroupId?.nombre || 'Sin asignar'}
                                            </div>
                                        )}

                                        <div className="ext-meta-item">
                                            <strong>Columnas ({ext.columns?.length || 0}):</strong>
                                            <div className="ext-cols-preview">
                                                {(ext.columns || []).slice(0, 4).map((c) => (
                                                    <span key={c.key} className="ext-col-chip">{c.label}</span>
                                                ))}
                                                {(ext.columns || []).length > 4 && (
                                                    <span className="ext-col-chip ext-more">+{ext.columns.length - 4} más</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="ext-meta-item">
                                            <strong>Encargados:</strong>
                                            {ext.authorizedTeachers && ext.authorizedTeachers.length > 0 ? (
                                                <span className="ext-teachers-list">
                                                    {ext.authorizedTeachers.map(t => t.nombre || t).join(', ')}
                                                </span>
                                            ) : (
                                                <span className="ext-text-muted">Solo Administradores</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="ext-card-footer">
                                    <button
                                        className="ext-btn ext-btn-primary ext-flex-1"
                                        onClick={() => navigate(`/extensiones/${ext._id}`)}
                                    >
                                        {isUserAuthorized ? <><FaEye /> Abrir Matriz (Edición)</> : <><FaLock /> Vista Previa</>}
                                    </button>

                                    {isAdmin && (
                                        <div className="ext-admin-card-actions">
                                            <button
                                                className="ext-btn-icon-bg edit"
                                                onClick={() => handleEdit(ext)}
                                                title="Editar Configuración de Tabla"
                                            >
                                                <FaEdit />
                                            </button>
                                            {!ext.isBuiltIn && (
                                                <button
                                                    className="ext-btn-icon-bg delete"
                                                    onClick={() => handleDelete(ext._id, ext.title)}
                                                    title="Eliminar Extensión"
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <TableBuilderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTemplate}
                initialData={editingTemplate}
                profesores={profesores}
                grupos={grupos}
            />
        </div>
    );
};

export default ExtensionsDashboard;
