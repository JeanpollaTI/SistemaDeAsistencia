import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaCamera } from "react-icons/fa";
import "./RegisterProfesor.css";

// La URL de la API ahora apunta a tu servidor en Render (Vercel la leerá desde .env)
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

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

        // Verificar si existe un admin al cargar el componente
        useEffect(() => {
                const storedToken = localStorage.getItem("token");
                if (storedToken) setToken(storedToken);

                // Esta ruta en el backend debería devolver todos los usuarios para verificar si hay admins.
                // Asumimos que es /auth/users o una ruta similar protegida.
                axios
                        .get(`${API_URL}/auth/profesores`, { // Usamos una ruta que sabemos que existe y está protegida
                                headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
                        })
                        .then((res) => {
                                // Esta lógica es para el caso hipotético de registrar el primer admin.
                                // Si ya hay usuarios, asumimos que al menos un admin existe.
                                if (res.data.length === 0) {
                                        setFirstAdmin(true);
                                }
                        })
                        .catch(() => {
                                // Si no hay token, esta llamada fallará, lo cual es esperado para un no-admin.
                                // Si hay token de admin pero falla, podría ser un problema del servidor.
                                console.log("No se pudo verificar la lista de usuarios (puede ser normal si no eres admin).");
                        });
        }, []);

        const handleChange = (e) =>
                setForm({ ...form, [e.target.name]: e.target.value });
        const handleFile = (e) => setFoto(e.target.files[0]);

        const handleSubmit = async (e) => {
                e.preventDefault();
                setMsg("");

                if (!token && !firstAdmin)
                        return setMsg("No tienes permisos de administrador para registrar usuarios.");

                const { nombre, edad, sexo, email, password } = form;
                if (!nombre || !edad || !sexo || !email || !password)
                        return setMsg("Todos los campos son obligatorios.");

                if (
                        !email.toLowerCase().endsWith("@gmail.com") &&
                        !email.toLowerCase().endsWith("@iea.edu.mx")
                )
                        return setMsg("El correo debe ser @gmail.com o @iea.edu.mx");

                if (isNaN(edad) || edad < 18) return setMsg("La edad mínima es 18.");

                try {
                        setIsSubmitting(true);
                        const formData = new FormData();

                        const finalForm = { ...form, role: firstAdmin ? "admin" : form.role };
                        finalForm.email = finalForm.email.toLowerCase().trim();
                        finalForm.celular = finalForm.celular?.trim() || "";
                        finalForm.fechaRegistro = new Date().toISOString(); // Send current date

                        Object.keys(finalForm).forEach((key) =>
                                formData.append(key, finalForm[key])
                        );
                        if (foto) formData.append("foto", foto);

                        const headers = { "Content-Type": "multipart/form-data" };
                        if (token) headers.Authorization = `Bearer ${token}`;

                        const res = await axios.post(`${API_URL}/auth/register`, formData, { headers });

                        setMsg(res.data.msg || "Usuario registrado correctamente");
                        setForm({ nombre: "", edad: "", sexo: "Masculino", email: "", celular: "", password: "", role: "profesor" });
                        setFoto(null);

                        setTimeout(() => navigate("/"), 2000);
                } catch (err) {
                        setMsg(err.response?.data?.msg || "Error: Ya existe la cuenta o el servidor no responde.");
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
                                                <img src={URL.createObjectURL(foto)} alt="Perfil" className="profile-img" />
                                        ) : (
                                                <div className="profile-img placeholder">
                                                        <FaCamera size={40} />
                                                </div>
                                        )}
                                </div>

                                <label htmlFor="file-upload" className="upload-label">Seleccionar foto</label>
                                <input id="file-upload" type="file" onChange={handleFile} />

                                <form className="register-form" onSubmit={handleSubmit}>
                                        <input placeholder="Nombre" name="nombre" value={form.nombre} onChange={handleChange} required />
                                        <input placeholder="Edad" name="edad" type="number" value={form.edad} onChange={handleChange} required />
                                        <select name="sexo" value={form.sexo} onChange={handleChange}>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Femenino">Femenino</option>
                                                <option value="Otro">Otro</option>
                                        </select>
                                        <input placeholder="Email" name="email" type="email" value={form.email} onChange={handleChange} required />
                                        <input placeholder="Celular" name="celular" value={form.celular} onChange={handleChange} />
                                        <input placeholder="Password" name="password" type="password" value={form.password} onChange={handleChange} required />

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
