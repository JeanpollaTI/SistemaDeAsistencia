import React from 'react';
import './LandingPage.css';
import { useNavigate } from 'react-router-dom';
import { FaGraduationCap, FaSchool, FaUsers, FaArrowRight } from 'react-icons/fa';
import scholarisHero from '../scholaris_hero.png';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="landing-container">
            {/* Hero Section */}
            <section className="hero-section" id="home">
                <div className="hero-content" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                    <h1>Gestión Escolar Inteligente</h1>
                    <p style={{ textAlign: 'center', margin: '0 auto 40px auto' }}>
                        Controla asistencias, calificaciones y mantén una comunicación fluida
                        con padres de familia en una sola plataforma segura y en tiempo real.
                    </p>

                    <div className="cta-group" style={{ margin: '0 auto', gap: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <button className="cta-button secondary" onClick={() => navigate('/login')}>
                            <span className="cta-label">
                                <FaGraduationCap /> Portal de mi escuela
                            </span>
                            <span className="cta-arrow">ACCESO <FaArrowRight /></span>
                        </button>

                        <button className="cta-button secondary" onClick={() => navigate('/portal-padres')} style={{ background: '#007A7A', color: 'white', borderColor: '#007A7A' }}>
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
                    <h2>Todo lo que tu institución necesita</h2>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">📊</div>
                            <h3>Control de Calificaciones</h3>
                            <p>Genera boletas y sábanas de resultados automáticamente con el periodo de evaluación que tú elijas.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">⏰</div>
                            <h3>Listas de Asistencia</h3>
                            <p>Registro rápido por grupo y profesor, monitorea la puntualidad de tus alumnos en tiempo real.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">☁️</div>
                            <h3>Infraestructura Cloud</h3>
                            <p>Accede a tus datos desde cualquier dispositivo. La información está siempre segura y respaldada.</p>
                        </div>
                    </div>
                </div>
            </section>


            {/* Footer */}
            <footer style={{ padding: '40px 20px', background: '#111827', color: 'white', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1.5rem', marginBottom: '20px' }}>
                    <FaGraduationCap style={{ color: '#ffffff' }} />
                    <strong style={{ color: '#007A7A' }}>SCHOLARIS</strong>
                </div>
                <p style={{ opacity: 0.6 }}>© 2026 Scholaris. Todos los derechos reservados.</p>
            </footer>
        </div>
    );
};

export default LandingPage;
