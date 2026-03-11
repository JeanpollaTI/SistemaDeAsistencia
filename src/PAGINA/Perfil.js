import React from "react";
import { useNavigate } from "react-router-dom";

import "./Perfil.css"; // Importa tu archivo de estilos

/**
 * Componente Perfil. Muestra la información del usuario.
 * Recibe 'user', 'logout', y 'getProfileImageUrl' como props desde App.js.
 */
function Perfil({ user, logout, getProfileImageUrl }) {
  const navigate = useNavigate();

  // Si no se recibe el objeto 'user' (es null o undefined), redirigir a login.
  if (!user) {
    navigate('/login');
    return null;
  }

  const handleEdit = () => navigate("/editar-perfil");

  const handleLogout = logout || (() => { console.log("Logout simulado."); navigate('/'); });

  // Determinar la URL de la imagen
  // La lógica principal está en getProfileImageUrl (en AuthContext)
  const imageUrl = getProfileImageUrl
    ? getProfileImageUrl(user.foto)
    : 'https://placehold.co/150x150/AAAAAA/FFFFFF?text=Perfil';

  return (
    <div className="perfil-page">
      <div className="perfil-container">
        <h2>Mi Perfil</h2>

        <div className="profile-horizontal-layout">
          <img
            src={imageUrl}
            alt="Perfil"
            className="profile-img-large"
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              objectFit: 'cover',
              background: 'none',
              border: '4px solid #00CBCB',
              margin: '0'
            }}
          />

          <div className="perfil-info" style={{ textAlign: 'left', flex: 1, color: '#000000' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '15px', color: '#00CBCB' }}>Datos Personales</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Nombre:</strong> {user.nombre || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Edad:</strong> {user.edad || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Email:</strong> {user.email || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Sexo:</strong> {user.sexo || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Celular:</strong> {user.celular || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Rol:</strong> <span style={{ textTransform: 'capitalize', fontWeight: '600', color: '#000000' }}>{user.role || "N/A"}</span></p>
          </div>
        </div>

        <div className="perfil-buttons" style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn-edit" onClick={handleEdit} style={{ background: '#00CBCB', width: 'auto' }}>EDITAR PERFIL</button>
          <button className="btn-logout" onClick={handleLogout} style={{ background: '#e53935', width: 'auto' }}>CERRAR SESIÓN</button>
        </div>
      </div>
    </div>
  );
}

export default Perfil;
