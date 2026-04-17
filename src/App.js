import React, { useState, useEffect, useContext } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";

// Componentes y Contexto
import { AuthProvider, AuthContext } from "./PAGINA/AuthContext";
import PrivateRoute from "./PAGINA/PrivateRoute";
import { NotificationProvider, useNotification } from "./COMPONENTE/NotificationContext";
import AlertSystem from "./COMPONENTE/AlertSystem";
import SuggestionModal from "./COMPONENTE/SuggestionModal";
import ConfirmModal from "./COMPONENTE/ConfirmModal";
import apiClient from "./api/apiClient";

// Componentes de Páginas
import Home from "./PAGINA/Home";
import Login from "./PAGINA/Login";
import RegisterProfesor from "./PAGINA/RegisterProfesor";
import Perfil from "./PAGINA/Perfil";
import EditarPerfil from "./PAGINA/EditarPerfil";
import Password from "./PAGINA/Password"; 
import Horario from "./PAGINA/Horario";
import Grupo from "./PAGINA/Grupo";
import Trabajos from "./PAGINA/Trabajos";
import Calificaciones from "./PAGINA/Calificaciones";
import LandingPage from "./PAGINA/LandingPage";
import RegisterSchool from "./PAGINA/RegisterSchool";
import ParentPortal from "./PAGINA/ParentPortal";
import SuspendedScreen from "./PAGINA/SuspendedScreen";
import SuperAdminDashboard from "./PAGINA/SuperAdminDashboard";
import FichaAlumno from "./PAGINA/FichaAlumno";
import MaintenanceScreen from "./PAGINA/MaintenanceScreen";

import SearchBar from "./COMPONENTE/SearchBar";
import {
    FaGraduationCap, FaMoon, FaSun, FaSignOutAlt, FaUserCircle,
    FaThLarge, FaUsers, FaCalendarAlt, FaChartBar, FaTasks,
    FaUserPlus, FaChevronDown, FaBell, FaLightbulb
} from 'react-icons/fa';

// Estilos y logo
import "./App.css";
import "./PAGINA/Home.css";
import logo from "./logo.png";

function App() {
    const { user, loading, getProfileImageUrl, logout } = useContext(AuthContext);
    const { notifications, markAsRead, clearNotifications } = useNotification();
    const navigate = useNavigate();
    const location = useLocation();

    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
    const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
    const [maintenanceActive, setMaintenanceActive] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
    const toggleDropdown = () => {
        setDropdownOpen(prev => !prev);
        setNotifDropdownOpen(false);
    };
    const toggleNotifDropdown = () => {
        setNotifDropdownOpen(prev => !prev);
        setDropdownOpen(false);
    };
    const closeDropdowns = () => {
        setDropdownOpen(false);
        setNotifDropdownOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if ((dropdownOpen || notifDropdownOpen) && !event.target.closest('.user-pill') && !event.target.closest('.dropdown-menu') && !event.target.closest('.notif-pill') && !event.target.closest('.notif-dropdown')) {
                closeDropdowns();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen, notifDropdownOpen]);

    useEffect(() => {
        if (location.state?.scrollTo) {
            const section = document.getElementById(location.state.scrollTo);
            if (section) {
                window.scrollTo({ top: section.offsetTop - 70, behavior: "smooth" });
            }
        }
        closeDropdowns();
    }, [location]);

    useEffect(() => {
        if (user && user.school_name) {
            document.title = user.school_name;
        } else {
            document.title = "Scholaris";
        }
    }, [user, location.pathname]);

    // Fetch System Status (Maintenance)
    useEffect(() => {
        const checkMaintenance = async () => {
            try {
                // Usamos el endpoint público para que funcione sin estar logueado
                const res = await apiClient.get('/api/superadmin/public/status');
                setMaintenanceActive(res.data.maintenanceMode);
            } catch (e) {
                // Si la API devuelve 503, capturamos el flag
                if (e.response?.status === 503 && e.response?.data?.maintenance) {
                    setMaintenanceActive(true);
                }
            }
        };
        checkMaintenance();
        
        // Polling cada 30 segundos
        const interval = setInterval(checkMaintenance, 30000);
        return () => clearInterval(interval);
    }, []);

    // Fetch Global Broadcasts
    const { addNotification } = useNotification();
    useEffect(() => {
        if (user) {
            const fetchBroadcasts = async () => {
                try {
                    const res = await apiClient.get('/api/superadmin/broadcasts/active');
                    res.data.forEach(broadcast => {
                        // Check if we've seen this broadcast in this session/local
                        const seenKey = `broadcast_${broadcast.id}`;
                        if (!localStorage.getItem(seenKey)) {
                            addNotification(`📣 ${broadcast.message}`, broadcast.type);
                            localStorage.setItem(seenKey, 'seen');
                        }
                    });
                } catch (e) { console.error("Error fetching broadcasts", e); }
            };
            fetchBroadcasts();
        }
    }, [user]);

    if (loading) {
        return (
            <div className="loading-screen flex items-center justify-center h-screen bg-gray-50 text-xl text-gray-700">
                Cargando la sesión...
            </div>
        );
    }

    const handleNavClick = (e, id) => {
        e?.preventDefault();
        if (location.pathname !== "/") {
            navigate("/", { state: { scrollTo: id } });
        } else {
            const section = document.getElementById(id);
            if (section) {
                window.scrollTo({ top: section.offsetTop - 70, behavior: "smooth" });
            }
        }
    };

    const renderMenu = () => {
        if (!user) {
            if (location.pathname === "/") return null;
            return (
                <div className="nav-menu-right">
                    <ul className="nav-list">
                        <li><button className="nav-button nav-link-button" onClick={(e) => handleNavClick(e, "home")}>INICIO</button></li>
                        <li><button className="nav-button nav-link-button" onClick={(e) => handleNavClick(e, "gestion")}>GESTIÓN</button></li>
                        <li>
                            <button className="nav-button nav-link-button login-btn-box" onClick={() => navigate("/login")}>
                                INICIAR SESIÓN
                            </button>
                        </li>
                    </ul>
                </div>
            );
        }

        if (user?.subscriptionStatus === "suspended") {
            return (
                <div className="nav-right-container">
                    <button className="nav-link-button" onClick={() => logout()} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff6b6b' }}>
                        <FaSignOutAlt /> SALIR
                    </button>
                </div>
            );
        }

        const baseSections = [{ id: "home", label: "DASHBOARD", icon: <FaThLarge /> }];
        let roleSections = [];

        if (user?.role === "profesor") {
            roleSections = [
                { id: "trabajos", label: "TRABAJOS", path: "/trabajos", icon: <FaTasks /> },
                { id: "grupo", label: "ASISTENCIA", path: "/grupo", icon: <FaUsers /> },
            ];
        } else if (user?.role === "admin") {
            roleSections = [
                { id: "grupo", label: "GRUPOS", path: "/grupo", icon: <FaUsers /> },
                { id: "horario", label: "HORARIO GENERAL", path: "/horario", icon: <FaCalendarAlt /> },
                { id: "calificaciones", label: "CALIFICACIONES", path: "/calificaciones", icon: <FaChartBar /> },
            ];
        } else if (user?.role === "superadmin") {
            roleSections = [
                { id: "manager", label: "ADMIN GLOBAL", path: "/manager-dashboard", icon: <FaThLarge /> },
            ];
        }

        const handleMenuAction = (sec) => {
            if (sec.path) {
                navigate(sec.path);
            } else {
                handleNavClick(null, sec.id);
            }
            closeDropdowns();
        };

        const sections = [...baseSections, ...roleSections];

        return (
            <div className="nav-right-container">
                <div className={`notif-pill ${notifDropdownOpen ? 'active' : ''}`} onClick={toggleNotifDropdown}>
                    <FaBell className="notif-icon" />
                    {notifications.filter(n => !n.read).length > 0 && (
                        <span className="notif-badge">{notifications.filter(n => !n.read).length}</span>
                    )}
                </div>

                <div className={`notif-dropdown ${notifDropdownOpen ? 'show' : ''}`}>
                    <div className="notif-header">
                        <h3>Notificaciones</h3>
                        {notifications.length > 0 && <button onClick={clearNotifications}>Limpiar</button>}
                    </div>
                    <div className="notif-list">
                        {notifications.length > 0 ? notifications.map(n => (
                            <div key={n.id} className={`notif-item ${n.read ? 'read' : 'unread'} ${n.type}`} onClick={() => markAsRead(n.id)}>
                                <div className="notif-content">
                                    <p>{n.message}</p>
                                    <span className="notif-date">{new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        )) : (
                            <p className="notif-empty">No hay notificaciones</p>
                        )}
                    </div>
                </div>

                <div className={`user-pill ${dropdownOpen ? 'active' : ''}`} onClick={toggleDropdown}>
                    <img src={getProfileImageUrl(user.foto)} alt="Perfil" className="user-pill-img" />
                    <span className="user-pill-name">{user.nombre.split(' ')[0]}</span>
                    <FaChevronDown className="user-pill-arrow" />
                </div>

                <div className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
                    <div className="dropdown-header">
                        <p className="dropdown-header-name">{user.nombre}</p>
                        <p className="dropdown-header-email">{user.email}</p>
                    </div>

                    {sections.map((sec) => (
                        <button key={sec.id} className="nav-link-dropdown" onClick={() => handleMenuAction(sec)}>
                            {sec.icon} {sec.label}
                        </button>
                    ))}

                    {user?.role === "admin" && (
                        <button className="nav-link-dropdown" onClick={() => { navigate("/register-profesor"); closeDropdowns(); }}>
                            <FaUserPlus /> REGISTRAR PROFESOR
                        </button>
                    )}

                    <button className="nav-link-dropdown" onClick={() => { navigate("/perfil"); closeDropdowns(); }}>
                        <FaUserCircle /> MI PERFIL
                    </button>

                    {user?.role !== "superadmin" && (
                        <button className="nav-link-dropdown" onClick={() => { setIsSuggestionModalOpen(true); closeDropdowns(); }}>
                            <FaLightbulb /> SUGERENCIAS
                        </button>
                    )}

                    <button className="nav-link-dropdown logout" onClick={() => { logout(); closeDropdowns(); }}>
                        <FaSignOutAlt /> CERRAR SESIÓN
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div>
            <AlertSystem />
            <header className="header" id="header">
                <nav className="nav container" style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0 10px' }}>
                    <div className="nav-left" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                        <a href="#home" className="nav-logo" onClick={(e) => handleNavClick(e, "home")} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 'bold', fontSize: '1.5rem', textDecoration: 'none', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 }}>
                            <img src={logo} alt="Scholaris Logo" style={{ width: '38px', minWidth: '38px', height: 'auto', filter: 'drop-shadow(0 0 5px rgba(0, 203, 203, 0.5))' }} />
                            <span style={{ letterSpacing: '1px', fontSize: '1rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user && user.school_name ? user.school_name.toUpperCase() : "SCHOLARIS"}</span>
                        </a>
                    </div>
                    
                    <div className="nav-center" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                        {user && user.subscriptionStatus !== "suspended" && user.role !== 'superadmin' && <SearchBar />}
                    </div>

                    <div className="nav-menu" id="nav-menu" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {renderMenu()}
                    </div>
                </nav>
            </header>

            <main>
                {/* 🌟 BLOQUEO POR MANTENIMIENTO 🌟 */}
                {maintenanceActive && 
                 user?.role !== 'superadmin' && 
                 location.pathname !== '/' && 
                 location.pathname !== '/login' ? (
                    <Routes>
                        <Route path="/mantenimiento" element={<MaintenanceScreen />} />
                        <Route path="*" element={<Navigate to="/mantenimiento" />} />
                    </Routes>
                ) : user?.subscriptionStatus === "suspended" && user?.role !== "superadmin" ? (
                    <Routes>
                        <Route path="/suspendido" element={<SuspendedScreen />} />
                        <Route path="*" element={<Navigate to="/suspendido" />} />
                    </Routes>
                ) : (
                    <Routes>
                    <Route path="/" element={user ? <Home user={user} /> : <LandingPage />} />
                    <Route path="/register-school" element={user ? <Navigate to="/" /> : <RegisterSchool />} />
                    <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
                    <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <Password />} />
                    <Route path="/no-autorizado" element={<div>No tienes permiso para ver esta página.</div>} />
                    <Route path="/portal-padres" element={<ParentPortal />} />
                    <Route path="/perfil" element={<PrivateRoute><Perfil user={user} logout={logout} getProfileImageUrl={getProfileImageUrl} /></PrivateRoute>} />
                    <Route path="/editar-perfil" element={<PrivateRoute><EditarPerfil user={user} /></PrivateRoute>} />
                    <Route path="/horario" element={<PrivateRoute requiredRole={["admin", "profesor"]}><Horario user={user} /></PrivateRoute>} />
                    <Route path="/grupo" element={<PrivateRoute requiredRole={["admin", "profesor"]}><Grupo user={user} /></PrivateRoute>} />
                    <Route path="/trabajos" element={<PrivateRoute requiredRole="profesor"><Trabajos user={user} /></PrivateRoute>} />
                    <Route path="/register-profesor" element={<PrivateRoute requiredRole="admin"><RegisterProfesor user={user} /></PrivateRoute>} />
                    <Route path="/calificaciones" element={<PrivateRoute requiredRole="admin"><Calificaciones user={user} /></PrivateRoute>} />
                    {/* Nueva Ruta SuperAdmin */}
                    <Route path="/manager-dashboard" element={<PrivateRoute requiredRole="superadmin"><SuperAdminDashboard user={user} /></PrivateRoute>} />
                    <Route path="/alumno/:id" element={<PrivateRoute requiredRole={["admin", "profesor"]}><FichaAlumno /></PrivateRoute>} />
                    <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                )}
            </main>

            <SuggestionModal 
                isOpen={isSuggestionModalOpen} 
                onClose={() => setIsSuggestionModalOpen(false)} 
            />
            <ConfirmModal />
        </div>
    );
}

const AppWrapper = () => (
    <AuthProvider>
        <NotificationProvider>
            <App />
        </NotificationProvider>
    </AuthProvider>
);

export default AppWrapper;
