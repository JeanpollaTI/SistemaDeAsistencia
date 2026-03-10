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
import { FaGraduationCap, FaMoon, FaSun, FaBars, FaTimes, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';

// Estilos y logo (Asegúrate de que Home.css esté en PAGINA/ y logo.png en src/)
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
                        {/* Toggle de Tema Público */}
                        <li>
                            <button className="nav-button theme-toggle-btn" onClick={toggleTheme} title="Cambiar Tema">
                                {theme === 'light' ? <FaMoon /> : <FaSun />}
                            </button>
                        </li>
                    </ul>
                </div>
            );
        }

        const baseSections = [{ id: "home", label: "DASHBOARD" }];
        let roleSections = [];

        if (user?.role === "profesor") {
            // Menú para Profesores
            roleSections = [
                { id: "trabajos", label: "TRABAJOS", path: "/trabajos" },
                { id: "grupo", label: "ASISTENCIA", path: "/grupo" },
            ];
        } else if (user?.role === "admin") {
            // Menú para Administradores
            roleSections = [
                { id: "grupo", label: "GRUPOS", path: "/grupo" },
                { id: "horario", label: "HORARIO GENERAL", path: "/horario" },
                { id: "calificaciones", label: "CALIFICACIONES", path: "/calificaciones" },
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
                {/* Toggle de Tema Privado */}
                <button className="theme-toggle-btn" onClick={toggleTheme} title="Cambiar Tema">
                    {theme === 'light' ? <FaMoon /> : <FaSun />}
                </button>

                {/* Imagen de Perfil */}
                <img
                    src={getProfileImageUrl(user.foto)}
                    alt="Perfil"
                    className="profile-img-small"
                    onClick={() => navigate("/perfil")}
                    style={{ cursor: "pointer" }}
                />

                {/* Icono Hamburguesa */}
                <div className="hamburger-menu" onClick={toggleDropdown}>
                    {dropdownOpen ? <FaTimes /> : <FaBars />}
                </div>

                {/* Menú Desplegable */}
                <div className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
                    <div className="dropdown-info" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                        <p style={{ fontWeight: 'bold', margin: '0', fontSize: '1rem' }}>{user.nombre}</p>
                        <p style={{ margin: '0', fontSize: '0.8rem', opacity: '0.7' }}>{user.email}</p>
                    </div>

                    {sections.map((sec) => (
                        <button
                            key={sec.id}
                            className="nav-link-dropdown"
                            onClick={() => handleMenuAction(sec)}
                        >
                            {sec.label}
                        </button>
                    ))}

                    {user?.role === "admin" && (
                        <button className="nav-link-dropdown" onClick={() => { navigate("/register-profesor"); closeDropdown(); }}>
                            REGISTRAR PROFESOR
                        </button>
                    )}

                    <button className="nav-link-dropdown" onClick={() => { navigate("/perfil"); closeDropdown(); }}>
                        <FaUserCircle /> MI PERFIL
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
                    <a href="#home" className="nav-logo" onClick={(e) => handleNavClick(e, "home")} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 'bold', fontSize: '1.5rem', textDecoration: 'none' }}>
                        <FaGraduationCap style={{ color: '#ffffff', fontSize: '1.8rem' }} />
                        <span style={{ letterSpacing: '1px', fontSize: '1rem', fontWeight: '500' }}>{user && user.school_name ? user.school_name.toUpperCase() : "SCHOLARIS"}</span>
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
