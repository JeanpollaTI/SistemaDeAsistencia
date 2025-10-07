import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
      const res = await fetch("http://localhost:5000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message);
      if (res.ok) setStep(2);
    } catch (err) {
      console.error(err);
      setMessage("Error enviando el correo. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("http://localhost:5000/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const data = await res.json();
      setMessage(data.message);

      if (res.ok) {
        setEmail("");
        setToken("");
        setNewPassword("");
        setStep(1);
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error al restablecer la contraseña.");
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
