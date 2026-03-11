import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import DynamicBackground from "../COMPONENTE/DynamicBackground";
import LoadingOverlay from "../COMPONENTE/LoadingOverlay";
import "./Login.css";

// La URL de la API se obtiene de las variables de entorno para flexibilidad
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function Login() {
    const { login } = useContext(AuthContext);

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
            setError("Por favor, ingresa tu correo/teléfono y contraseña.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identifier: identifier.toLowerCase(),
                    password,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.msg || data.error || "Credenciales incorrectas. Por favor, verifica tus datos.");
                setLoading(false);
                return;
            }

            if (!data.token || !data.user) {
                setError("Login fallido: no se recibió una respuesta válida del servidor.");
                setLoading(false);
                return;
            }

            login(data.user, data.token);

            switch (data.user.role) {
                case "admin":
                case "profesor":
                    navigate("/");
                    break;
                default:
                    navigate("/perfil");
                    break;
            }
        } catch (err) {
            console.error("Error en la petición de login:", err);
            setError("No se pudo conectar con el servidor. Inténtalo más tarde.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrapper dark-theme">
            {loading && <LoadingOverlay message="Iniciando Sesión..." />}
            <DynamicBackground />
            <div className="login-container glass">
                <h2>Iniciar Sesión</h2>
                <form onSubmit={handleLogin} noValidate>
                    <div className="form-group">
                        <label htmlFor="identifier">Correo o Teléfono</label>
                        <input
                            id="identifier"
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="Ingresa tu correo o teléfono"
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Contraseña</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Ingresa tu contraseña"
                            required
                            autoComplete="current-password"
                        />
                    </div>
                    {error && <p className="error">{error}</p>}
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? "Ingresando..." : "Iniciar Sesión"}
                    </button>
                </form>


            </div>
        </div>
    );
}

export default Login;
