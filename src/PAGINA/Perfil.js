import React from "react";
import { useNavigate } from "react-router-dom";
// CORRECCIÓN DE RUTA: Ajustamos la importación. 
// Desde PAGINA/ sale a src/ y entra a api/.
import apiClient from '../api/apiClient'; 
import "./Perfil.css";

// Path por defecto que está en tu modelo de MongoDB
const DEFAULT_IMG_PATH = "/uploads/fotos/default.png"; 

function Perfil({ user, onLogout }) {
  const navigate = useNavigate();

  if (!user) return null;

  // --------------------------------------------------------------------------
  // LÓGICA DE IMAGEN CORREGIDA PARA CLOUDINARY
  // Si la foto no es la por defecto, la usamos directamente (es la URL de Cloudinary).
  const profileImgUrl = 
    user.foto && user.foto !== DEFAULT_IMG_PATH
      ? user.foto 
      // Si es la ruta por defecto, concatenamos para que se cargue desde el backend.
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
            // Manejo de error para la imagen
            onError={(e) => { 
                e.target.onerror = null; 
                e.target.src = `${apiClient.defaults.baseURL}${DEFAULT_IMG_PATH}` 
            }}
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