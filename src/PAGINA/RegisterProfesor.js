import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./RegisterProfesor.css";

const API_URL = "http://localhost:5000/auth";

export default function RegisterProfesor() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: "",
    edad: "",
    sexo: "Masculino",
    email: "",
    celular: "",
    password: "",
    role: "profesor",
  });
  const [foto, setFoto] = useState(null);
  const [msg, setMsg] = useState("");
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstAdmin, setFirstAdmin] = useState(false);

  // Verificar si existe admin
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) setToken(storedToken);

    axios
      .get(`${API_URL}/users`, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      })
      .then((res) => {
        const admins = res.data.filter((u) => u.role === "admin");
        if (admins.length === 0) setFirstAdmin(true);
      })
      .catch(() => {
        setMsg("Debes iniciar sesión como admin para registrar usuarios");
      });
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  const handleFile = (e) => setFoto(e.target.files[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!token && !firstAdmin)
      return setMsg("No hay token de admin disponible");

    const { nombre, edad, sexo, email, password } = form;
    if (!nombre || !edad || !sexo || !email || !password)
      return setMsg("Todos los campos son obligatorios");

    if (
      !email.toLowerCase().endsWith("@gmail.com") &&
      !email.toLowerCase().endsWith("@iea.edu.mx")
    )
      return setMsg("El correo debe ser @gmail.com o @iea.edu.mx");

    if (isNaN(edad) || edad < 18) return setMsg("La edad mínima es 18");

    try {
      setIsSubmitting(true);
      const formData = new FormData();

      // Forzar rol a admin si es el primer usuario
      const finalForm = { ...form, role: firstAdmin ? "admin" : form.role };

      // Normalizar email y celular
      finalForm.email = finalForm.email.toLowerCase().trim();
      finalForm.celular = finalForm.celular?.trim() || "";

      // Agregar todos los campos a FormData
      Object.keys(finalForm).forEach((key) =>
        formData.append(key, finalForm[key])
      );
      if (foto) formData.append("foto", foto);

      // Headers
      const headers = { "Content-Type": "multipart/form-data" };
      if (token && !firstAdmin) headers.Authorization = `Bearer ${token}`;

      // Petición POST
      const res = await axios.post(`${API_URL}/register`, formData, { headers });

      setMsg(res.data.msg || "Usuario registrado correctamente");

      // Reset formulario y foto
      setForm({
        nombre: "",
        edad: "",
        sexo: "Masculino",
        email: "",
        celular: "",
        password: "",
        role: "profesor",
      });
      setFoto(null);

      // Redirigir después de 2 segundos
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setMsg(
        err.response?.data?.msg ||
          "Error Ya existe la cuenta: " + err.message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="register-wrapper">
      <div className="register-container">
        <h2>Registrar Usuario</h2>

        {firstAdmin && (
          <p className="message info">
            ⚠️ No hay admins registrados. Este usuario se registrará como administrador.
          </p>
        )}

        <div className="profile-section">
          {foto ? (
            <img
              src={URL.createObjectURL(foto)}
              alt="Perfil"
              className="profile-img"
            />
          ) : (
            <div className="profile-img placeholder">Foto</div>
          )}
        </div>

        <label htmlFor="file-upload" className="upload-label">
          Seleccionar foto
        </label>
        <input id="file-upload" type="file" onChange={handleFile} />

        <form className="register-form" onSubmit={handleSubmit}>
          <input
            placeholder="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            required
          />
          <input
            placeholder="Edad"
            name="edad"
            type="number"
            value={form.edad}
            onChange={handleChange}
            required
          />
          <select name="sexo" value={form.sexo} onChange={handleChange}>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="Otro">Otro</option>
          </select>
          <input
            placeholder="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <input
            placeholder="Celular"
            name="celular"
            value={form.celular}
            onChange={handleChange}
          />
          <input
            placeholder="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />

          {!firstAdmin && (
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="profesor">Profesor</option>
              <option value="admin">Admin</option>
            </select>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar"}
          </button>
        </form>

        {msg && <p className="message">{msg}</p>}
      </div>
    </div>
  );
}
