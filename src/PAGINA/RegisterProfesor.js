import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// 1. IMPORTAMOS apiClient EN LUGAR DE axios
import apiClient from '../api/apiClient';
import "./RegisterProfesor.css";

// 2. ELIMINAMOS LA CONSTANTE API_URL, YA NO ES NECESARIA

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

    // 3. ACTUALIZAMOS LA PETICIÓN GET PARA USAR apiClient
    // Verificamos si ya hay usuarios. Usamos /auth/profesores si la ruta /auth/users no existe.
    apiClient
      .get(`/auth/profesores`, { // RUTA MÁS PROBABLE: /auth/profesores
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      })
      .then((res) => {
        // Asumimos que la respuesta incluye todos los profesores y quizás admins.
        const allUsers = Array.isArray(res.data) ? res.data : [];
        const admins = allUsers.filter((u) => u.role === "admin");
        
        // Si no se encuentra un token, el backend devuelve 401. 
        // Si el GET es exitoso y no hay admins, registramos el primero.
        if (admins.length === 0) {
            if (!storedToken) {
                setFirstAdmin(true);
            } else {
                setMsg("No hay administrador, por favor registre uno como el primer usuario.");
            }
        }
      })
      .catch((err) => {
        // Manejo de error de conexión o 401
        if (err.response?.status === 401) {
            setMsg("Debes iniciar sesión como administrador para registrar usuarios.");
        } else {
            setMsg("Error de conexión con el servidor. Intenta de nuevo.");
        }
      });
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  const handleFile = (e) => setFoto(e.target.files[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!token && !firstAdmin)
      return setMsg("No estás autenticado. Por favor, inicia sesión.");

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
      const finalForm = { ...form, role: firstAdmin ? "admin" : form.role };
      finalForm.email = finalForm.email.toLowerCase().trim();
      finalForm.celular = finalForm.celular?.trim() || "";

      Object.keys(finalForm).forEach((key) =>
        formData.append(key, finalForm[key])
      );
      if (foto) formData.append("foto", foto);

      const headers = { "Content-Type": "multipart/form-data" };
      if (token && !firstAdmin) headers.Authorization = `Bearer ${token}`;

      // 4. ACTUALIZAMOS LA PETICIÓN POST PARA USAR apiClient
      const res = await apiClient.post(`/auth/register`, formData, { headers });

      setMsg(res.data.msg || "Usuario registrado correctamente");

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

      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
        // Manejo mejorado del error del backend.
        const backendMsg = err.response?.data?.msg;
        if (backendMsg) {
            setMsg(backendMsg);
        } else if (err.message.includes('403')) {
             setMsg("Error de permiso: Solo un administrador puede registrar usuarios.");
        } else {
            setMsg("Error en el servidor. Intenta de nuevo. Detalles: " + err.message);
        }
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
              alt="Preview de Foto"
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