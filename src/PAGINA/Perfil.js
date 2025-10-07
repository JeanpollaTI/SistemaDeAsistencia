import React from "react";
import { useNavigate } from "react-router-dom";
import "./Perfil.css";

function Perfil({ user, setUser, onLogout }) {
  const navigate = useNavigate();

  if (!user) return null;

  const profileImgUrl = user.foto
    ? `http://localhost:5000${user.foto}`
    : `http://localhost:5000/uploads/fotos/default.png`;

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
