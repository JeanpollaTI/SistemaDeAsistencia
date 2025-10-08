import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
// 1. IMPORTACIÓN ACTUALIZADA: Usamos nuestro apiClient.
import apiClient from '../api/apiClient';
import "./Password.css";

function Password() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSendToken = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // 2. CÓDIGO MÁS LIMPIO: Usamos apiClient y solo el endpoint.
      const res = await apiClient.post("/auth/forgot-password", { email });
      setMessage(res.data.message);
      setStep(2); // Avanza al siguiente paso si la petición es exitosa
    } catch (err) {
      console.error(err);
      // Con Axios, los mensajes de error del backend están en err.response.data
      setMessage(err.response?.data?.message || "Error enviando el correo. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // 3. CÓDIGO MÁS LIMPIO: Usamos apiClient y solo el endpoint.
      const res = await apiClient.post("/auth/reset-password", {
        email,
        token,
        newPassword,
      });
      setMessage(res.data.message);

      // Limpiar y redirigir si la contraseña se restableció correctamente
      setEmail("");
      setToken("");
      setNewPassword("");
      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || "Error al restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-wrapper">
      <div className="password-container">
        {step === 1 && (
          <>
            <h2>Recuperar Contraseña</h2>
            <form onSubmit={handleSendToken}>
              <div className="form-group">
                <label>Correo registrado</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ingresa tu correo"
                  required
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Restablecer Contraseña</h2>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>Código recibido</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Ingresa el código"
                  required
                />
              </div>
              <div className="form-group">
                <label>Nueva Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingresa tu nueva contraseña"
                  required
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? "Restableciendo..." : "Restablecer Contraseña"}
              </button>
            </form>
          </>
        )}

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
}

export default Password;
