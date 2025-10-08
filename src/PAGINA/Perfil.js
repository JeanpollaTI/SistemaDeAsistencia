import React from "react";
import { useNavigate } from "react-router-dom";
// 1. IMPORTAMOS apiClient PARA OBTENER LA URL BASE DEL SERVIDOR
import apiClient from '../api/apiClient';
import "./Perfil.css";

function Perfil({ user, onLogout }) {
  const navigate = useNavigate();

  if (!user) return null;

  // 2. LÓGICA DE IMAGEN ACTUALIZADA
  // Ahora la URL de la imagen se construye dinámicamente usando la
  // dirección de nuestro backend (sea localhost o la de Render).
  const profileImgUrl = user.foto && !user.foto.includes("default.png")
    ? user.foto.startsWith("http")
      ? user.foto
      : `${apiClient.defaults.baseURL}${user.foto.startsWith("/") ? "" : "/"}${user.foto}`
    : `${apiClient.defaults.baseURL}/uploads/fotos/default.png`;


  const handleEdit = () => navigate("/editar-perfil");

  return (
    <div className="perfil-page">
      <div className="perfil-container">
        <h2>Perfil de Usuario</h2>
        <img src={profileImgUrl} alt="Perfil" className="profile-img-large" />

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
