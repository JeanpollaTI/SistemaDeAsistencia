import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import apiClient from "../api/apiClient";
import { useNotification } from "../COMPONENTE/NotificationContext";
import "./EditarPerfil.css";

// --- URL de la API desde variables de entorno ---
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function EditarPerfil({ user }) {
  const navigate = useNavigate();

  // Obtener la función login (setter para el usuario) y la función de URL del contexto
  // Obtener la función updateUser y la función de URL del contexto
  const { updateUser, getProfileImageUrl } = useContext(AuthContext);
  const { addNotification } = useNotification();

  const [formData, setFormData] = useState({
    nombre: "",
    edad: "",
    email: "",
    sexo: "Masculino",
    celular: "",
  });

  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados para cambio de contraseña
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "" });
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre || "",
        edad: user.edad || "",
        email: user.email || "",
        sexo: user.sexo || "Masculino",
        celular: user.celular || "",
      });

      // Usa la función centralizada para la previsualización
      setFotoPreview(getProfileImageUrl(user.foto));
    }
  }, [user, getProfileImageUrl]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      // Muestra una previsualización local inmediata
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const { nombre, edad, email, celular } = formData;

    if (!nombre || !edad || !email || !celular) return setError("Todos los campos son obligatorios.");
    if (Number(edad) <= 0) return setError("La edad ingresada no es válida.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("El correo electrónico ingresado no es válido.");
    if (!/^\d+$/.test(celular)) return setError("El número de celular debe contener solo dígitos.");

    try {
      setLoading(true);
      
      const data = new FormData();
      Object.keys(formData).forEach((key) => data.append(key, formData[key]));
      if (foto) data.append("foto", foto);

      // Usamos el apiClient centralizado
      const res = await apiClient.put(`/auth/editar-perfil`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const updatedUser = res.data.user || res.data;

      // Actualizar SOLO el estado del usuario, sin re-logear
      updateUser(updatedUser);

      addNotification("Perfil actualizado correctamente", "success");
      setTimeout(() => navigate("/perfil"), 1000);
    } catch (err) {
      console.error(err);
      const backendMsg = err.response?.data?.msg || err.response?.data?.error || "";
      if (backendMsg.includes("Email already in use") || backendMsg.includes("correo ya está en uso")) {
        addNotification("El correo ingresado ya está registrado.", "error");
      } else if (backendMsg.includes("Celular already in use") || backendMsg.includes("ya está registrado")) {
        addNotification("El número de celular ya está registrado en su escuela.", "error");
      } else {
        addNotification("Error al actualizar perfil. Intenta nuevamente.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: "", text: "" });
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      return setPasswordMessage({ type: "error", text: "Ambos campos son obligatorios." });
    }

    try {
      setLoading(true);
      await apiClient.put(`/auth/change-password`, passwordData);
      addNotification("Contraseña actualizada exitosamente", "success");
      setPasswordData({ currentPassword: "", newPassword: "" });
      setShowPasswordForm(false);
    } catch (err) {
      console.error(err);
      addNotification(err.response?.data?.msg || "Error al cambiar la contraseña", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editar-perfil-page">
      <div className="editar-perfil-card">
        <h2>Editar Perfil</h2>

        <div className="edit-profile-horizontal">
          {/* Lado izquierdo: Foto y Acción */}
          <div className="edit-photo-section">
            <img
              src={fotoPreview}
              alt="Preview"
              className="profile-img-large"
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid #00CBCB',
                margin: '0 0 1rem 0'
              }}
            />
            <label className="btn-edit" style={{ cursor: "pointer", background: '#00CBCB', width: '100%', textAlign: 'center' }}>
              Cambiar Foto
              <input type="file" onChange={handleFileChange} accept="image/*" style={{ display: "none" }} />
            </label>
          </div>

          {/* Lado derecho: Formulario */}
          <div style={{ flex: 1 }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Nombre Completo</label>
                  <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre" style={{ color: '#000' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Edad</label>
                  <input type="number" name="edad" value={formData.edad} onChange={handleChange} placeholder="Edad" style={{ color: '#000' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Email de Contacto</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" style={{ color: '#000' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Género</label>
                  <select name="sexo" value={formData.sexo} onChange={handleChange} style={{ color: '#000' }}>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Teléfono Celular</label>
                  <input type="text" name="celular" value={formData.celular} onChange={handleChange} placeholder="Celular" style={{ color: '#000' }} />
                </div>
              </div>

              {/* Botones de acción dentro del flujo del form o abajo */}
              <div className="editar-perfil-buttons" style={{ justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="submit" className="btn-save" disabled={loading} style={{ background: '#00CBCB', width: 'auto' }}>
                  {loading ? "Guardando..." : "Guardar cambios"}
                </button>
                <button type="button" className="btn-cancel" onClick={() => navigate("/perfil")} style={{ background: '#aaa', width: 'auto' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>

        <hr className="divider" style={{ margin: "20px 0", borderTop: "1px solid #ccc" }} />

        {/* Sección de Cambio de Contraseña */}
        <div style={{ marginTop: '30px', padding: '25px', borderRadius: '16px', background: '#f8f9fa', border: '1px solid #eee', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPasswordForm ? '20px' : '0' }}>
            <h4 style={{ margin: 0, fontFamily: 'Turret Road', color: '#333', textTransform: 'uppercase', letterSpacing: '1px' }}>Seguridad de la Cuenta</h4>
            <button
              type="button"
              className="btn-toggle-password"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              style={{ background: '#00CBCB', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}
            >
              {showPasswordForm ? "CANCELAR" : "CAMBIAR CONTRASEÑA"}
            </button>
          </div>

          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>Para cambiar tu contraseña, ingresa la actual y la nueva a continuación:</p>

              {passwordMessage.text && (
                <div style={{ padding: '10px', borderRadius: '8px', background: passwordMessage.type === 'error' ? '#fff5f5' : '#e8f8f8', color: passwordMessage.type === 'error' ? '#e53935' : '#008b8b', border: `1px solid ${passwordMessage.type === 'error' ? '#ffcdd2' : '#00CBCB'}`, fontSize: '0.85rem' }}>
                  {passwordMessage.text}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>CONTRASEÑA ACTUAL</label>
                <input
                  type="password"
                  placeholder="********"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>NUEVA CONTRASEÑA</label>
                <input
                  type="password"
                  placeholder="********"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}
                  required
                />
              </div>

              <button type="submit" className="btn-save" disabled={loading} style={{ marginTop: "10px", width: "100%", background: 'linear-gradient(135deg, #00CBCB, #3498db)', color: '#fff', borderRadius: '10px', padding: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                {loading ? "ACTUALIZANDO..." : "ACTUALIZAR MI CONTRASEÑA"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditarPerfil;