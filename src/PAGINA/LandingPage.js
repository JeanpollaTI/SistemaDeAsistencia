import React, { useEffect, useRef } from 'react';
import './LandingPage.css';
import { useNavigate } from 'react-router-dom';
import { FaGraduationCap, FaSchool, FaUsers, FaArrowRight } from 'react-icons/fa';

const LandingPage = () => {
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const effectRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const initEffect = async () => {
            try {
                // Importación dinámica del componente de Three.js
                const module = await import("https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js");
                const TubesCursor = module.default;

                if (isMounted && canvasRef.current) {
                    effectRef.current = TubesCursor(canvasRef.current, {
                        tubes: {
                            colors: ["#00CBCB", "#007A7A", "#B8E2F2"],
                            lights: {
                                intensity: 200,
                                colors: ["#00CBCB", "#00B5B5", "#007A7A", "#60aed5"]
                            }
                        }
                    });

                    const handleRandomize = () => {
                        if (effectRef.current) {
                            const randomColorsArray = (count) => 
                                new Array(count).fill(0).map(() => 
                                    "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
                                );
                            
                            effectRef.current.tubes.setColors(randomColorsArray(3));
                            effectRef.current.tubes.setLightsColors(randomColorsArray(4));
                        }
                    };

                    document.body.addEventListener('click', handleRandomize);

                    return () => {
                        document.body.removeEventListener('click', handleRandomize);
                        // Limpieza si el componente de Three.js lo requiere (tubes1 no suele exponer destroy pero se limpia el canvas)
                    };
                }
            } catch (error) {
                console.error("Error loading TubesCursor:", error);
            }
        };

        initEffect();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div className="landing-container dark-theme">
            <canvas id="canvas" ref={canvasRef}></canvas>
            
            {/* Hero Section */}
            <section className="hero-section" id="home">
                <div className="hero-content">
                    <h1>Gestión Escolar Inteligente</h1>
                    <p className="hero-description">
                        Controla asistencias, calificaciones y mantén una comunicación fluida
                        con padres de familia en una sola plataforma segura y en tiempo real.
                    </p>

                    <div className="cta-group">
                        <button className="cta-button secondary glass" onClick={() => navigate('/login')}>
                            <span className="cta-label">
                                <FaGraduationCap /> Portal de mi escuela
                            </span>
                            <span className="cta-arrow">ACCESO <FaArrowRight /></span>
                        </button>

                        <button className="cta-button secondary teal-dark" onClick={() => navigate('/portal-padres')}>
                            <span className="cta-label">
                                <FaUsers /> Portal de Padres
                            </span>
                            <span className="cta-arrow">ALUMNOS <FaArrowRight /></span>
                        </button>

                        <button className="cta-button primary" onClick={() => navigate('/register-school')}>
                            <span className="cta-label">
                                <FaSchool /> Registrar mi escuela
                            </span>
                            <span className="cta-arrow">NUEVA ESCUELA <FaArrowRight /></span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section" id="gestion">
                <div className="container">
                    <h2 className="section-title">Todo lo que tu institución necesita</h2>
                    <div className="features-grid">
                        <div className="feature-card glass">
                            <div className="feature-icon">📊</div>
                            <h3>Control de Calificaciones</h3>
                            <p>Genera boletas y sábanas de resultados automáticamente con el periodo de evaluación que tú elijas.</p>
                        </div>
                        <div className="feature-card glass">
                            <div className="feature-icon">⏰</div>
                            <h3>Listas de Asistencia</h3>
                            <p>Registro rápido por grupo y profesor, monitorea la puntualidad de tus alumnos en tiempo real.</p>
                        </div>
                        <div className="feature-card glass">
                            <div className="feature-icon">☁️</div>
                            <h3>Infraestructura Cloud</h3>
                            <p>Accede a tus datos desde cualquier dispositivo. La información está siempre segura y respaldada.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-logo">
                    <FaGraduationCap />
                    <strong className="brand-name">SCHOLARIS</strong>
                </div>
                <p className="footer-copy">© 2026 Scholaris. Todos los derechos reservados.</p>
            </footer>
        </div>
    );
};

export default LandingPage;
