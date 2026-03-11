import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios"; // Importamos axios para consistencia
import "./Password.css";

// La URL de la API ahora apunta a tu servidor en Render
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function Password() {
      const [step, setStep] = useState(1);
      const [email, setEmail] = useState("");
      const [token, setToken] = useState("");
      const [newPassword, setNewPassword] = useState("");
      const [message, setMessage] = useState("");
      const [loading, setLoading] = useState(false);
      const [isError, setIsError] = useState(false);

      const navigate = useNavigate();

      const handleSendToken = async (e) => {
            e.preventDefault();
            setLoading(true);
            setMessage("");
            setIsError(false);

            try {
                  // Usamos axios en lugar de fetch
                  const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
                  setMessage(res.data.msg); // El backend devuelve 'msg'
                  setStep(2);
            } catch (err) {
                  console.error(err);
                  setIsError(true);
                  setMessage(err.response?.data?.msg || "Error enviando el correo. Intenta nuevamente.");
            } finally {
                  setLoading(false);
            }
      };

      const handleResetPassword = async (e) => {
            e.preventDefault();
            setLoading(true);
            setMessage("");
            setIsError(false);

            try {
                  // Usamos axios en lugar de fetch
                  const res = await axios.post(`${API_URL}/auth/reset-password`, { email, token, newPassword });
                  setMessage(res.data.msg);

                  // Limpiamos el formulario y redirigimos al login
                  setEmail("");
                  setToken("");
                  setNewPassword("");
                  setTimeout(() => {
                        navigate("/login");
                  }, 2000);

            } catch (err) {
                  console.error(err);
                  setIsError(true);
                  setMessage(err.response?.data?.msg || "Error al restablecer la contraseña.");
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

                        {/* Muestra el mensaje con un color diferente si es un error */}
                        {message && <p className={`message ${isError ? 'error' : 'success'}`}>{message}</p>}

                        <div style={{ marginTop: '20px' }}>
                              <a href="/login" onClick={(e) => { e.preventDefault(); navigate("/login"); }} className="back-to-login">
                                    &larr; Regresar al Login
                              </a>
                        </div>
                  </div>
            </div>
      );
}

export default Password;
