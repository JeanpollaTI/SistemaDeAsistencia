import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './RegisterSchool.css';
import { FaSchool, FaEnvelope, FaLock, FaImage, FaGraduationCap, FaCalendarAlt, FaCheckCircle, FaArrowRight, FaArrowLeft, FaCreditCard } from 'react-icons/fa';
import DynamicBackground from '../COMPONENTE/DynamicBackground';
import PremiumCardForm from '../COMPONENTE/PremiumCardForm';

const RegisterSchool = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        schoolName: "",
        schoolType: "Secundaria",
        evaluationPeriod: "Trimestre"
    });

    const [cardData, setCardData] = useState({
        cardNumber: '',
        cardName: '',
        cardMonth: '',
        cardYear: '',
        cardCvv: ''
    });

    const handleCardChange = (data) => {
        setCardData(data);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const nextStep = () => {
        if (step === 1) {
            if (!formData.email || !formData.password) {
                setError("Por favor completa las credenciales.");
                return;
            }
            const domain = formData.email.split('@')[1];
            if (domain !== 'gmail.com' && domain !== 'iea.edu.mx') {
                setError("Solo se permiten correos @gmail.com o @iea.edu.mx");
                return;
            }
        }
        if (step === 2 && !formData.schoolName) {
            setError("El nombre de la escuela es obligatorio.");
            return;
        }
        if (step === 3) {
            if (!cardData || !cardData.cardNumber || !cardData.cardMonth || !cardData.cardYear || !cardData.cardCvv) {
                return setError("Por favor completa todos los datos de tu tarjeta.");
            }
            handleSubmit();
            return;
        }
        setStep(step + 1);
        setError("");
    };

    const prevStep = () => setStep(step - 1);

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/register-school/register-institutional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, cardData })
            });

            const data = await response.json();
            if (!response.ok) {
                const detailedError = data.details ? `${data.msg || data.error}: ${data.details}` : (data.msg || data.error || "Error al registrar");
                throw new Error(detailedError);
            }

            alert("¡Institución registrada y activada con éxito!");
            navigate('/login');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="form-step fade-in">
                        <h3><FaLock /> Cuenta del Administrador</h3>
                        <p className="step-desc">Usa un correo institucional o personal para gestionar tu escuela.</p>
                        <div className="input-group">
                            <label><FaEnvelope /> Gmail o IEA.EDU.MX</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="ejemplo@gmail.com"
                            />
                        </div>
                        <div className="input-group">
                            <label><FaLock /> Contraseña Maestra</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Mínimo 8 caracteres"
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="form-step fade-in">
                        <h3><FaSchool /> Datos de la Institución</h3>
                        <p className="step-desc">Ingresa el nombre oficial de tu escuela para comenzar la configuración.</p>
                        <div className="input-group">
                            <label>Nombre Oficial</label>
                            <input
                                type="text"
                                name="schoolName"
                                value={formData.schoolName}
                                onChange={handleChange}
                                placeholder="Ej: Secundaria General No. 9"
                            />
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="form-step fade-in">
                        <h3><FaGraduationCap /> Configuración Académica</h3>
                        <p className="step-desc">Configura el nivel y los periodos de evaluación iniciales.</p>
                        <div className="input-grid">
                            <div className="input-group">
                                <label>Nivel Educativo</label>
                                <select name="schoolType" value={formData.schoolType} onChange={handleChange}>
                                    <option value="Primaria">Primaria</option>
                                    <option value="Secundaria">Secundaria</option>
                                    <option value="Preparatoria">Preparatoria</option>
                                    <option value="Universidad">Universidad</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label><FaCalendarAlt /> Periodo de Evaluación</label>
                                <select name="evaluationPeriod" value={formData.evaluationPeriod} onChange={handleChange}>
                                    <option value="Bimestre">Bimestral</option>
                                    <option value="Trimestre">Trimestral</option>
                                    <option value="Cuatrimestre">Cuatrimestral</option>
                                </select>
                            </div>
                        </div>
                        <div className="payment-section fade-in" style={{ 
                            marginTop: '2.5rem', 
                            border: '1px solid rgba(255,255,255,0.2)', 
                            backgroundColor: 'rgba(0, 122, 122, 0.4)',
                            padding: '2.5rem',
                            borderRadius: '20px',
                            backdropFilter: 'blur(15px)'
                        }}>
                            <h3 style={{ justifyContent: 'center', marginBottom: '2rem', textAlign: 'center' }}>
                                <FaCreditCard /> Método de Pago Seguro
                            </h3>
                            
                            <div className="payment-horizontal-layout" style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', alignItems: 'flex-start' }}>
                                <div className="payment-summary-box" style={{ flex: '1', minWidth: '300px' }}>
                                    <div className="payment-preview" style={{ 
                                        padding: '2rem', 
                                        borderRadius: '15px', 
                                        background: 'linear-gradient(135deg, rgba(0, 122, 122, 0.8), rgba(0, 203, 203, 0.8))',
                                        color: 'white',
                                        textAlign: 'center',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                                    }}>
                                        <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '10px' }}>Suscripción Scholaris Premium</p>
                                        <div className="price-tag" style={{ fontSize: '2.8rem', fontWeight: '800', margin: '0.5rem 0' }}>$700.00 <span style={{ fontSize: '1rem', verticalAlign: 'middle' }}>MXN/mes</span></div>
                                        <p style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: '15px' }}>
                                            Acceso total a gestión escolar, reportes dinámicos y portal de padres en vivo.
                                        </p>
                                    </div>
                                    <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                                        <p style={{ color: 'white', fontSize: '0.85rem' }}>
                                            * Los datos de tu tarjeta están protegidos con encriptación de nivel bancario a través de Stripe. No almacenamos tus credenciales.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="card-form-wrapper" style={{ flex: '1.5', minWidth: '350px' }}>
                                    <PremiumCardForm onCardChange={handleCardChange} />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="register-school-wrapper">
            <DynamicBackground />
            <div className="register-card">
                <div className="wizard-header">
                    <div className="wizard-logo">
                        <FaGraduationCap /> <span>SCHOLARIS</span>
                    </div>
                    <div className="step-indicator">
                        <div className={`dot ${step >= 1 ? 'active' : ''}`}>1</div>
                        <div className={`line ${step >= 2 ? 'active' : ''}`}></div>
                        <div className={`dot ${step >= 2 ? 'active' : ''}`}>2</div>
                        <div className={`line ${step >= 3 ? 'active' : ''}`}></div>
                        <div className={`dot ${step >= 3 ? 'active' : ''}`}>3</div>
                    </div>
                </div>

                <div className="wizard-body">
                    {error && <div className="error-message">{error}</div>}
                    {renderStep()}
                </div>

                {step < 4 && (
                    <div className="wizard-footer">
                        {step > 1 && (
                            <button className="nav-btn prev" onClick={prevStep}>
                                <FaArrowLeft /> Atrás
                            </button>
                        )}
                        <button
                            className="nav-btn next"
                            onClick={nextStep}
                            disabled={loading}
                        >
                            {step === 3 ? (loading ? "Registrando..." : "Registrar y Activar") : "Siguiente"} {step !== 3 && <FaArrowRight />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegisterSchool;
