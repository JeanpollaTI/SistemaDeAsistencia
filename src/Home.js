import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// 1. RUTA CORREGIDA: Apunta correctamente a la carpeta api/ usando './'
import apiClient from './api/apiClient'; 
import "./Home.css";

// Ruta por defecto que existe en el servidor (coincide con el modelo)
const DEFAULT_IMG_PATH = "/uploads/fotos/default.png";

function Home({ user, handleNavClick }) {
  const navigate = useNavigate();
  const [profesores, setProfesores] = useState([]);
  const [selectedProfesor, setSelectedProfesor] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [asignaturasSelect, setAsignaturasSelect] = useState([]);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const materias = [
    "MATEMATICAS COOR.ACADEMICA", "TUTORIA", "ESPAÑOL", "INGLES TUTORIA", "INGLES",
    "MATEMATICAS", "CIENCIAS I", "CIENCIAS II", "CIENCIAS III", "ELECTRONICA",
    "INDUSTRIA DEL VESTIDO", "DISEÑO ARQUIT.", "INFORMATICA", "GEOGRAFIA-HISTORIA TUTORIA",
    "HISTORIA", "F.CIVICA y ETICA", "F.CIVICA y ETICA-A.C", "F.CIVICA y ETICA-A.C TUTORIA",
    "ARTES(MUSICA)", "EDUCACION FISICA",
  ];

  useEffect(() => {
    const navMenu = document.getElementById("nav-menu");
    const navToggle = document.getElementById("nav-toggle");
    const navClose = document.getElementById("nav-close");
    // Corrección de sintaxis de event listener
    if (navToggle) navToggle.addEventListener("click", () => navMenu.classList.add("show-menu"));
    if (navClose) navClose.addEventListener("click", () => navMenu.classList.remove("show-menu"));
    
    const scrollHeader = () => {
      const header = document.getElementById("header");
      if(header) {
        if (window.scrollY >= 80) header.classList.add("scroll-header");
        else header.classList.remove("scroll-header");
      }
    };
    window.addEventListener("scroll", scrollHeader);
    return () => window.removeEventListener("scroll", scrollHeader);
  }, []);

  useEffect(() => {
    if (user?.role === "admin") fetchProfesores();
  }, [user]);

  const fetchProfesores = () => {
    const token = localStorage.getItem("token");
    if (!token) return console.error("⚠️ No hay token guardado.");
    
    // 2. CÓDIGO MÁS LIMPIO: Usando apiClient
    apiClient.get("/auth/profesores", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setProfesores(res.data || []))
      .catch((err) => console.error("Error al obtener profesores:", err));
  };

  const openModal = (profesor) => {
    setSelectedProfesor(profesor);
    setAsignaturasSelect(profesor.asignaturas || []);
    setModalVisible(true);
    setConfirmDeleteVisible(false);
  };

  const closeModal = () => {
    setSelectedProfesor(null);
    setModalVisible(false);
    setConfirmDeleteVisible(false);
    setAsignaturasSelect([]);
  };

  // 3. URLs CENTRALIZADAS (CORREGIDA): La lógica de la imagen es simplificada
  const profileImgUrl = (foto) => {
    // Si la foto es la ruta por defecto, concatenamos la URL del servidor.
    if (foto === DEFAULT_IMG_PATH || !foto) {
        return `${apiClient.defaults.baseURL}${DEFAULT_IMG_PATH}`;
    }
    // Si no es la ruta por defecto, es la URL completa de Cloudinary y la usamos directamente.
    return foto;
  };

  const handleAsignaturasChange = (materia) => {
    setAsignaturasSelect((prev) =>
      prev.includes(materia) ? prev.filter((m) => m !== materia) : [...prev, materia]
    );
  };

  // Funciones que faltaban
  const guardarAsignaturas = () => {
    if (!selectedProfesor) return;
    const token = localStorage.getItem("token");
    
    apiClient.put(`/profesores/${selectedProfesor._id}/asignaturas`, { asignaturas: asignaturasSelect }, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        fetchProfesores();
        closeModal();
      })
      .catch((err) => console.error("Error al guardar asignaturas:", err));
  };

  const handleDeleteClick = () => setConfirmDeleteVisible(true);

  const confirmDelete = () => {
    if (!selectedProfesor) return;
    const token = localStorage.getItem("token");
    
    apiClient.delete(`/profesores/${selectedProfesor._id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        fetchProfesores();
        closeModal();
      })
      .catch((err) => console.error("Error al eliminar profesor:", err));
  };

  const cancelDelete = () => setConfirmDeleteVisible(false);
  
  const primerNombre = user?.nombre ? user.nombre.split(" ")[0] : "";
  
  // --------------------------------------------------------------------------
  // LÓGICA DE DETENER FUGA DE CONTENIDO EN RUTAS SECUNDARIAS
  // Si la ruta no es la raíz, la lógica de renderizado del componente Home NO debe ejecutarse.
  // Sin la prop 'location' aquí, esta función se movería a App.js
  // (Asumiendo que App.js se encarga de la guarda estructural)
  // --------------------------------------------------------------------------

  return (
    <div>
      {/* HOME */}
      <section className="home section" id="home">
        <div className="home-container container grid">
          <div className="home-data">
            <h1 className="home-title">
              {user ? (
                <>Bienvenido <span className="user-name-gold">{primerNombre}</span> al sistema de <span>asistencia</span></>
              ) : (
                <>Bienvenido al sistema de <span>asistencia</span></>
              )}
            </h1>
            {!user && <p>Por favor inicia sesión para acceder a todas las funciones.</p>}
          </div>
        </div>
      </section>
      
      {/* PROFESORES ADMIN */}
      {user?.role === "admin" && (
        <section className="profesores section" id="profesores">
          <h2 className="section-title">Perfiles de Profesores</h2>
          <div className="profesores-table-container">
            <table className="profesores-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Asignaturas</th>
                  <th>Fecha de Registro</th>
                  <th>Perfil</th>
                </tr>
              </thead>
              <tbody>
                {profesores.map((prof) => (
                  <tr key={prof._id}>
                    <td>{prof.nombre}</td>
                    <td>{prof.asignaturas?.join(", ") || "No asignada"}</td>
                    <td>{prof.createdAt ? new Date(prof.createdAt).toLocaleDateString() : "N/A"}</td>
                    <td><button className="btn-ver-perfil" onClick={() => openModal(prof)}>Ver perfil</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL PROFESOR */}
      {modalVisible && selectedProfesor && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            <img 
                src={profileImgUrl(selectedProfesor.foto)} 
                alt={selectedProfesor.nombre} 
                className="profile-img-modal" 
                onError={(e) => { e.target.onerror = null; e.target.src = `${apiClient.defaults.baseURL}${DEFAULT_IMG_PATH}` }}
            />
            <h3>{selectedProfesor.nombre}</h3>
            
            <div className="profesor-details">
                <p><b>Correo:</b> {selectedProfesor.email}</p>
                <p><b>Celular:</b> {selectedProfesor.celular}</p>
                <p><b>Edad:</b> {selectedProfesor.edad}</p>
                <p><b>Sexo:</b> {selectedProfesor.sexo}</p>
            </div>

            <p className="asignaturas-title"><b>Asignaturas:</b></p>
            <div className="checkbox-group">
              {materias.map((m) => (
                <label key={m} className="checkbox-label">
                  <input type="checkbox" value={m} checked={asignaturasSelect.includes(m)} onChange={() => handleAsignaturasChange(m)} />
                  <span>{m}</span>
                </label>
              ))}
            </div>
            
            <div className="modal-actions">
                <button className="btn-guardar" onClick={guardarAsignaturas}>Guardar asignaturas</button>
                <button className="btn-eliminar" onClick={handleDeleteClick}>Eliminar profesor</button>
            </div>

            {confirmDeleteVisible && (
              <div className="mini-alert">
                <p>¿Seguro que deseas eliminar a {selectedProfesor.nombre}?</p>
                <div className="mini-alert-buttons">
                  <button className="mini-alert-yes" onClick={confirmDelete}>Sí, Eliminar</button>
                  <button className="mini-alert-no" onClick={cancelDelete}>No</button>
                </div>
              </div>
            )}
            <p className="fecha-registro"><b>Fecha de registro:</b> {selectedProfesor.createdAt ? new Date(selectedProfesor.createdAt).toLocaleDateString() : "N/A"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;