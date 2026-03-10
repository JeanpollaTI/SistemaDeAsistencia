import React, { useState, useEffect, useContext } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";

// Componentes y Contexto (Asegúrate de que AuthContext.js y PrivateRoute.js estén en la carpeta PAGINA/)
import { AuthProvider, AuthContext } from "./PAGINA/AuthContext";
import PrivateRoute from "./PAGINA/PrivateRoute";

// Componentes de Páginas
import Home from "./PAGINA/Home";
import Login from "./PAGINA/Login";
import RegisterProfesor from "./PAGINA/RegisterProfesor";
import Perfil from "./PAGINA/Perfil";
import EditarPerfil from "./PAGINA/EditarPerfil";
import Password from "./PAGINA/Password"; // Usado para restablecer contraseña
import Horario from "./PAGINA/Horario";
import Grupo from "./PAGINA/Grupo";
import Trabajos from "./PAGINA/Trabajos";
import Calificaciones from "./PAGINA/Calificaciones";
import LandingPage from "./PAGINA/LandingPage";
import RegisterSchool from "./PAGINA/RegisterSchool";
import ParentPortal from "./PAGINA/ParentPortal";
import {
    FaGraduationCap, FaMoon, FaSun, FaSignOutAlt, FaUserCircle,
    FaThLarge, FaUsers, FaCalendarAlt, FaChartBar, FaTasks,
    FaUserPlus, FaChevronDown
} from 'react-icons/fa';

// Estilos y logo (Asegúrate de que Home.css esté en PAGINA/ y logo.png en src/)
import "./App.css";
import "./PAGINA/Home.css";
import logo from "./logo.png";

/**
 * Componente principal de la aplicación.
 * Utiliza el AuthContext para gestionar el estado del usuario.
 */
function App() {
    // Obtenemos el estado y las funciones del Contexto de Autenticación
    // Este hook solo funciona porque App está envuelto en AuthProvider (ver AppWrapper al final)
    const { user, loading, getProfileImageUrl, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    // Estado para el Tema (Claro/Oscuro)
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Aplicar el tema al root del documento
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
    const toggleDropdown = () => setDropdownOpen(prev => !prev);
    const closeDropdown = () => setDropdownOpen(false);

    // Cerrar menú al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownOpen && !event.target.closest('.user-pill') && !event.target.closest('.dropdown-menu')) {
                closeDropdown();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    // Hook para manejar el scroll a secciones específicas después de la navegación
    useEffect(() => {
        if (location.state?.scrollTo) {
            const section = document.getElementById(location.state.scrollTo);
            if (section) {
                // Se ajusta el scroll para dejar espacio al header fijo (70px)
                window.scrollTo({ top: section.offsetTop - 70, behavior: "smooth" });
            }
        }
        closeDropdown(); // Cierra el menú al cambiar de ruta
    }, [location]);

    // Efecto para el título dinámico
    useEffect(() => {
        if (user && user.school_name) {
            document.title = user.school_name;
        } else {
            document.title = "Scholaris";
        }
    }, [user, location.pathname]);

    // Muestra un loader mientras se verifica la sesión inicial (especialmente útil para Firebase/Auth)
    if (loading) {
        return (
            <div className="loading-screen flex items-center justify-center h-screen bg-gray-50 text-xl text-gray-700">
                Cargando la sesión...
            </div>
        );
    }

    // Función para manejar la navegación a secciones de la página de inicio o a otras rutas
    const handleNavClick = (e, id) => {
        e?.preventDefault();
        // Si no estamos en la página de inicio, navegamos a Home con el estado de scroll
        if (location.pathname !== "/") {
            navigate("/", { state: { scrollTo: id } });
        } else {
            // Si ya estamos en Home, simplemente hacemos scroll
            const section = document.getElementById(id);
            if (section) {
                window.scrollTo({ top: section.offsetTop - 70, behavior: "smooth" });
            }
        }
    };

    // Función para renderizar el menú de navegación dinámicamente según el rol
    const renderMenu = () => {
        if (!user) {
            // Menú público (Scholaris)
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
        }

        const handleMenuAction = (sec) => {
            if (sec.path) {
                navigate(sec.path);
            } else {
                handleNavClick(null, sec.id);
            }
            closeDropdown();
        };

        const sections = [...baseSections, ...roleSections];

        return (
            <div className="nav-right-container">
                {/* User Pill Button */}
                <div className={`user-pill ${dropdownOpen ? 'active' : ''}`} onClick={toggleDropdown}>
                    <img
                        src={getProfileImageUrl(user.foto)}
                        alt="Perfil"
                        className="user-pill-img"
                    />
                    <span className="user-pill-name">{user.nombre.split(' ')[0]}</span>
                    <FaChevronDown className="user-pill-arrow" />
                </div>

                {/* Menú Desplegable Vertical */}
                <div className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
                    <div className="dropdown-header">
                        <p className="dropdown-header-name">{user.nombre}</p>
                        <p className="dropdown-header-email">{user.email}</p>
                    </div>

                    {sections.map((sec) => (
                        <button
                            key={sec.id}
                            className="nav-link-dropdown"
                            onClick={() => handleMenuAction(sec)}
                        >
                            {sec.icon} {sec.label}
                        </button>
                    ))}

                    {user?.role === "admin" && (
                        <button className="nav-link-dropdown" onClick={() => { navigate("/register-profesor"); closeDropdown(); }}>
                            <FaUserPlus /> REGISTRAR PROFESOR
                        </button>
                    )}

                    <button className="nav-link-dropdown" onClick={() => { navigate("/perfil"); closeDropdown(); }}>
                        <FaUserCircle /> MI PERFIL
                    </button>

                    <button className="nav-link-dropdown" onClick={() => { toggleTheme(); closeDropdown(); }}>
                        {theme === 'light' ? <FaMoon /> : <FaSun />} {theme === 'light' ? 'MODO OSCURO' : 'MODO CLARO'}
                    </button>

                    <button className="nav-link-dropdown logout" onClick={() => { logout(); closeDropdown(); }}>
                        <FaSignOutAlt /> CERRAR SESIÓN
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div>
            {/* Header y Navigación */}
            <header className="header" id="header">
                <nav className="nav container">
                    {/* Logo SCHOLARIS */}
                    <a href="#home" className="nav-logo" onClick={(e) => handleNavClick(e, "home")} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffffff', textDecoration: 'none' }}>
                        <img
                            src={`${process.env.PUBLIC_URL}/logo.png`}
                            alt="Scholaris Logo"
                            style={{
                                width: '50px',
                                height: '50px',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 0 8px rgba(0, 203, 203, 0.4))'
                            }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '1px' }}>
                                SCHOLARIS
                            </span>
                            <span style={{ fontSize: '0.65rem', fontWeight: '400', opacity: '0.8', letterSpacing: '0.5px' }}>
                                {user && user.school_name ? user.school_name.toUpperCase() : "SISTEMA ACADÉMICO"}
                            </span>
                        </div>
                    </a>
                    <div className="nav-menu" id="nav-menu">
                        {renderMenu()}
                    </div>
                </nav>
            </header>

            {/* Contenido principal y Rutas */}
            <main>
                <Routes>
                    {/* Rutas Públicas */}
                    <Route path="/" element={user ? <Home user={user} /> : <LandingPage />} />
                    <Route path="/register-school" element={user ? <Navigate to="/" /> : <RegisterSchool />} />
                    {/* Si el usuario está logueado, redirige a Home */}
                    <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
                    <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <Password />} />
                    <Route path="/no-autorizado" element={<div>No tienes permiso para ver esta página.</div>} />
                    <Route path="/portal-padres" element={<ParentPortal />} />

                    {/* Rutas Protegidas (Requieren autenticación) */}
                    <Route path="/perfil" element={<PrivateRoute><Perfil user={user} logout={logout} getProfileImageUrl={getProfileImageUrl} /></PrivateRoute>} />
                    <Route path="/editar-perfil" element={<PrivateRoute><EditarPerfil user={user} /></PrivateRoute>} />

                    {/* Rutas con Rol Específico (Usan el componente PrivateRoute con requiredRole) */}

                    {/* Ruta para Admin y Profesor */}
                    <Route path="/horario" element={<PrivateRoute requiredRole={["admin", "profesor"]}><Horario user={user} /></PrivateRoute>} />
                    <Route path="/grupo" element={<PrivateRoute requiredRole={["admin", "profesor"]}><Grupo user={user} /></PrivateRoute>} />

                    {/* Rutas solo para profesores */}
                    <Route path="/trabajos" element={<PrivateRoute requiredRole="profesor"><Trabajos user={user} /></PrivateRoute>} />

                    {/* Rutas solo para admin */}
                    <Route path="/register-profesor" element={<PrivateRoute requiredRole="admin"><RegisterProfesor user={user} /></PrivateRoute>} />
                    <Route path="/calificaciones" element={<PrivateRoute requiredRole="admin"><Calificaciones user={user} /></PrivateRoute>} />

                    {/* Redirección para rutas no encontradas (404) */}
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
}

/**
 * Wrapper que envuelve el componente App en el AuthProvider.
 * ESTO ES CRÍTICO para que el useContext(AuthContext) funcione dentro de App.
 */
const AppWrapper = () => (
    <AuthProvider>
        <App />
    </AuthProvider>
);

export default AppWrapper;
