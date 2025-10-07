import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!identifier || !password) {
      setError("Por favor ingresa correo/teléfono y contraseña");
      setLoading(false);
      return;
    }

    try {
      console.log("Enviando login:", { identifier, password });

      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.toLowerCase(), // normaliza email
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || data.error || "Error en el login");
        setLoading(false);
        return;
      }

      if (!data.token || !data.user) {
        setError("Login fallido: token no recibido");
        setLoading(false);
        return;
      }

      // Guardar token y usuario
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      if (onLogin) onLogin(data.user, data.token);

      // Limpiar inputs
      setIdentifier("");
      setPassword("");

      // Redirigir según rol
      switch (data.user.role) {
        case "admin":
        case "profesor":
          navigate("/"); // Home para admin y profesor
          break;
        default:
          navigate("/perfil"); // Otros usuarios
          break;
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Error en el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <h2>Iniciar Sesión</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Correo o Teléfono</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Ingresa tu correo o teléfono"
              required
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>

        <button
          className="forgot-btn"
          onClick={() => navigate("/forgot-password")}
        >
          Olvidé mi contraseña
        </button>
      </div>
    </div>
  );
}

export default Login;
