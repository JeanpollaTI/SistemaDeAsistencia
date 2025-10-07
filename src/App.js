import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Home from "./Home";
import Login from "./PAGINA/Login";
import RegisterProfesor from "./PAGINA/RegisterProfesor";
import Perfil from "./PAGINA/Perfil";
import EditarPerfil from "./PAGINA/EditarPerfil";
import Password from "./PAGINA/Password";
import Horario from "./PAGINA/Horario";
import Grupo from "./PAGINA/Grupo";
import Trabajos from "./PAGINA/Trabajos";
import Calificaciones from "./PAGINA/Calificaciones";
import "./App.css";
import logo from "./logo.png";

function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (loggedUser, token) => {
    setUser(loggedUser);
    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(loggedUser));
    }
    navigate("/");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

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
    const sections = [
      { id: "home", label: "INICIO", clickable: true },
      // Menú para el rol de profesor
      ...(user?.role === "profesor"
        ? [
            { id: "trabajos", label: "TRABAJOS", path: "/trabajos" },
            { id: "grupo", label: "ASISTENCIA", path: "/grupo" },
            { id: "horario", label: "HORARIO GENERAL", path: "/horario" },
          ]
        : []),
      // Menú para el rol de administrador
      ...(user?.role === "admin"
        ? [
           
            { id: "grupo", label: "GRUPOS", path: "/grupo" },
            // <-- CAMBIO: Orden definido aquí consistentemente -->
            { id: "horario", label: "HORARIO GENERAL", path: "/horario" },
            { id: "calificaciones", label: "CALIFICACIONES", path: "/calificaciones" },
          ]
        : []),
    ];

    return (
      <div className="nav-menu-right">
        <ul className="nav-list">
          {sections.map((sec) => (
            <li key={sec.id}>
              <button
                className="nav-button nav-link-button"
                onClick={(e) => {
                  if (sec.path) {
                    navigate(sec.path);
                  } else if (sec.clickable) {
                    handleNavClick(e, sec.id);
                  }
                }}
              >
                {sec.label}
              </button>
            </li>
          ))}

          {user?.role === "admin" && (
            <li>
              <button className="nav-button nav-link-button" onClick={() => navigate("/register-profesor")}>
                REGISTRAR PROFESOR
              </button>
            </li>
          )}

          {!user && (
            <li>
              <button className="nav-button nav-link-button" onClick={() => navigate("/login")}>
                INICIAR SESIÓN
              </button>
            </li>
          )}

          {user && (
            <li className="nav-profile">
              <img
                src={
                  user.foto
                    ? `http://localhost:5000${user.foto.startsWith("/") ? "" : "/"}${user.foto}`
                    : "http://localhost:5000/uploads/fotos/default.png"
                }
                alt="Perfil"
                className="profile-img-small"
                onClick={() => navigate("/perfil")}
                style={{ cursor: "pointer" }}
              />
            </li>
          )}
        </ul>
      </div>
    );
  };

  useEffect(() => {
    if (location.state?.scrollTo) {
      const section = document.getElementById(location.state.scrollTo);
      if (section) {
        window.scrollTo({ top: section.offsetTop - 70, behavior: "smooth" });
      }
    }
  }, [location]);

  return (
    <div>
      <header className="header" id="header">
        <nav className="nav container">
          <a href="#home" className="nav-logo" onClick={(e) => handleNavClick(e, "home")}>
            <img
              src={logo}
              alt="logo"
              className="nav-logo-img"
              style={{ height: "120px", marginLeft: "0", display: "block" }}
            />
          </a>
          <div className="nav-menu" id="nav-menu">
            {renderMenu()}
          </div>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home user={user} onLogout={handleLogout} handleNavClick={handleNavClick} />} />
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
          <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <Password />} />
          <Route path="/register-profesor" element={user?.role === "admin" ? <RegisterProfesor user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
          <Route path="/perfil" element={user ? <Perfil user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/editar-perfil" element={user ? <EditarPerfil user={user} setUser={handleUserUpdate} /> : <Navigate to="/login" />} />
          <Route path="/horario" element={user ? <Horario user={user} /> : <Navigate to="/login" />} />
          <Route path="/grupo" element={user ? <Grupo user={user} /> : <Navigate to="/login" />} />
          <Route path="/trabajos" element={user ? <Trabajos user={user} /> : <Navigate to="/login" />} />
          <Route path="/calificaciones" element={user ? <Calificaciones user={user} /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
