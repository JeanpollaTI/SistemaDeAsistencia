import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./EditarPerfil.css";

function EditarPerfil({ user, setUser }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: "",
    edad: "",
    email: "",
    sexo: "Masculino",
    celular: "",
  });

  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("/default-profile.png");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre || "",
        edad: user.edad || "",
        email: user.email || "",
        sexo: user.sexo || "Masculino",
        celular: user.celular || "",
      });

      setFotoPreview(
        user.foto && !user.foto.includes("default.png")
          ? user.foto.startsWith("http")
            ? user.foto
            : `http://localhost:5000${user.foto.startsWith("/") ? "" : "/"}${user.foto}`
          : "/default-profile.png"
      );
    }
  }, [user]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
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
      if (foto) data.append("foto", foto);

      const res = await axios.put("http://localhost:5000/profesores/editar-perfil", data, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      const updatedUser = res.data.user || res.data;
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
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

  return (
    <div className="editar-perfil-page">
      <div className="editar-perfil-card">
        <h2>Editar Perfil</h2>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <img src={fotoPreview} alt="Preview" className="profile-img-large" />

        <div style={{ marginBottom: "15px" }}>
          <label className="btn-edit" style={{ marginRight: "10px", cursor: "pointer" }}>
            Cambiar Foto
            <input type="file" onChange={handleFileChange} accept="image/*" style={{ display: "none" }} />
          </label>
        </div>

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

          <div className="editar-perfil-buttons">
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
            <button type="button" className="btn-cancel" onClick={() => navigate("/perfil")}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditarPerfil;
