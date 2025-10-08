import React from "react";
import { useNavigate } from "react-router-dom";
// Importamos apiClient aunque ya no se usa para concatenar, sino para referencia.
import apiClient from '../api/apiClient'; 
import "./Perfil.css";

// Path por defecto que está en tu modelo de MongoDB
const DEFAULT_IMG_PATH = "/uploads/fotos/default.png"; 

function Perfil({ user, onLogout }) {
  const navigate = useNavigate();

  if (!user) return null;

  // --------------------------------------------------------------------------
  // 2. LÓGICA DE IMAGEN CORREGIDA PARA CLOUDINARY
  // La foto ya es una URL completa (http/s) si no es la por defecto.
  const profileImgUrl = 
    user.foto && user.foto !== DEFAULT_IMG_PATH
      // Si el campo foto NO es la ruta por defecto, la usamos directamente (es la URL de Cloudinary)
      ? user.foto 
      // Si es la ruta por defecto, necesitamos la URL completa del backend
      : `${apiClient.defaults.baseURL}${DEFAULT_IMG_PATH}`; 
  // --------------------------------------------------------------------------


  const handleEdit = () => navigate("/editar-perfil");

  return (
    <div className="perfil-page">
      <div className="perfil-container">
        <h2>Perfil de Usuario</h2>
        <img 
            src={profileImgUrl} 
            alt="Perfil" 
            className="profile-img-large" 
            // Manejo simple de error en caso de que la URL de Cloudinary falle
            onError={(e) => { e.target.onerror = null; e.target.src = `${apiClient.defaults.baseURL}${DEFAULT_IMG_PATH}` }}
        />

        <div className="perfil-info">
          <p><strong>Nombre:</strong> {user.nombre || "N/A"}</p>
          <p><strong>Edad:</strong> {user.edad || "N/A"}</p>
          <p><strong>Email:</strong> {user.email || "N/A"}</p>
          <p><strong>Sexo:</strong> {user.sexo || "N/A"}</p>
          <p><strong>Celular:</strong> {user.celular || "N/A"}</p>
          <p><strong>Rol:</strong> {user.role || "N/A"}</p>
        </div>

        <div className="perfil-buttons">
          <button className="btn-edit" onClick={handleEdit}>EDITAR PERFIL</button>
          <button className="btn-logout" onClick={onLogout}>CERRAR SESIÓN</button>
        </div>
      </div>
    </div>
  );
}

export default Perfil;