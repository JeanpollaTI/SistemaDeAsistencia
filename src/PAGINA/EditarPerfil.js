import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "./AuthContext"; // Importar el contexto
import "./EditarPerfil.css";

// --- URL de la API desde variables de entorno ---
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function EditarPerfil({ user }) {
  const navigate = useNavigate();

  // Obtener la función login (setter para el usuario) y la función de URL del contexto
  const { login, getProfileImageUrl } = useContext(AuthContext);

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
      const token = localStorage.getItem("token");
      if (!token) return setError("No estás autenticado. Por favor, inicia sesión nuevamente.");

      const data = new FormData();
      Object.keys(formData).forEach((key) => data.append(key, formData[key]));
      if (foto) data.append("foto", foto); // 'foto' es el nombre que espera Multer en el backend

      // --- RUTA DE API ---
      const res = await axios.put(`${API_URL}/auth/editar-perfil`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const updatedUser = res.data.user || res.data;

      // Actualizar el estado global del usuario
      login(updatedUser, token);

      setSuccess("Perfil actualizado correctamente.");

      setTimeout(() => navigate("/perfil"), 1500);
    } catch (err) {
      console.error(err);
      const backendMsg = err.response?.data?.msg || "";
      if (backendMsg.includes("Email already in use")) {
        setError("El correo ingresado ya está registrado. Por favor, utiliza otro.");
      } else if (backendMsg.includes("Celular already in use")) {
        setError("El número de celular ya está registrado. Por favor, utiliza otro.");
      } else {
        setError("Error al actualizar perfil. Intenta nuevamente.");
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
      const token = localStorage.getItem("token");
      await axios.put(`${API_URL}/auth/change-password`, passwordData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPasswordMessage({ type: "success", text: "Contraseña actualizada exitosamente." });
      setPasswordData({ currentPassword: "", newPassword: "" });
      setShowPasswordForm(false);
    } catch (err) {
      console.error(err);
      setPasswordMessage({ type: "error", text: err.response?.data?.msg || "Error al cambiar la contraseña." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editar-perfil-page">
      <div className="editar-perfil-card">
        <h2>Editar Perfil</h2>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        {/* Imagen de perfil y botón de cambio de foto */}
        <img src={fotoPreview} alt="Preview" className="profile-img-large" />

        <div style={{ marginBottom: "15px" }}>
          <label className="btn-edit" style={{ cursor: "pointer" }}>
            Cambiar Foto
            <input type="file" onChange={handleFileChange} accept="image/*" style={{ display: "none" }} />
          </label>
        </div>

        {/* Formulario de edición */}
        <form onSubmit={handleSubmit}>
          <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre" />
          <input type="number" name="edad" value={formData.edad} onChange={handleChange} placeholder="Edad" />
          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" />

          <select name="sexo" value={formData.sexo} onChange={handleChange}>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="Otro">Otro</option>
          </select>

          <input type="text" name="celular" value={formData.celular} onChange={handleChange} placeholder="Celular" />

          {/* Botones de acción */}
          <div className="editar-perfil-buttons">
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
            <button type="button" className="btn-cancel" onClick={() => navigate("/perfil")}>
              Cancelar
            </button>
          </div>
        </form>

        <hr className="divider" style={{ margin: "20px 0", borderTop: "1px solid #ccc" }} />

        {/* Sección de Cambio de Contraseña */}
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            className="btn-toggle-password"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            style={{ background: "none", border: "none", color: "#3498db", cursor: "pointer", textDecoration: "underline" }}
          >
            {showPasswordForm ? "Cancelar cambio de contraseña" : "Cambiar Contraseña"}
          </button>
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordChange} style={{ marginTop: "15px", border: "1px solid #eee", padding: "15px", borderRadius: "8px" }}>
            <h4>Cambiar Contraseña</h4>
            {passwordMessage.text && <p className={passwordMessage.type === 'error' ? 'error' : 'success'}>{passwordMessage.text}</p>}

            <input
              type="password"
              placeholder="Contraseña Actual"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Nueva Contraseña"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              required
            />

            <button type="submit" className="btn-save" disabled={loading} style={{ marginTop: "10px", width: "100%" }}>
              Actualizar Contraseña
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default EditarPerfil;