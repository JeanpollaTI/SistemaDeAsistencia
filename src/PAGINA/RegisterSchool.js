import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './RegisterSchool.css';
import { FaSchool, FaEnvelope, FaLock, FaImage, FaGraduationCap, FaCalendarAlt, FaCheckCircle, FaArrowRight, FaArrowLeft } from 'react-icons/fa';

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
        evaluationPeriod: "Trimestre",
        logoUrl: "" // Simularemos la subida o pediremos una URL
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const nextStep = () => {
        if (step === 1) {
            const domain = formData.email.split('@')[1];
            if (!formData.email || !formData.password) {
                setError("Por favor completa las credenciales.");
                return;
            }
            if (domain !== 'gmail.com' && domain !== 'iea.edu.mx') {
                setError("Solo se permiten correos @gmail.com o @iea.edu.mx");
                return;
            }
        }
        if (step === 2 && !formData.schoolName) {
            setError("El nombre de la escuela es obligatorio.");
            return;
        }

        setError("");
        setStep(step + 1);
    };

    const prevStep = () => setStep(step - 1);

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/register-school/register-institutional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (!response.ok) {
                const detailedError = data.details ? `${data.msg || data.error}: ${data.details}` : (data.msg || data.error || "Error al registrar");
                throw new Error(detailedError);
            }

            // Si el registro es exitoso, pasamos al paso de pago (simulado o Stripe redirección)
            setStep(4);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const [cardData, setCardData] = useState({
        number: "",
        name: "",
        expiry: "",
        cvv: "",
        isFlipped: false
    });

    const handleCardChange = (e) => {
        let { name, value } = e.target;
        if (name === 'number') {
            value = value.replace(/\D/g, '').substring(0, 16);
            value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
        }
        if (name === 'expiry') {
            value = value.replace(/\D/g, '').substring(0, 4);
            if (value.length >= 3) value = value.substring(0, 2) + '/' + value.substring(2);
        }
        if (name === 'cvv') value = value.replace(/\D/g, '').substring(0, 4);

        setCardData({ ...cardData, [name]: value });
    };

    const getCardType = (num) => {
        if (/^4/.test(num)) return "VISA";
        if (/^5[1-5]/.test(num)) return "MASTERCARD";
        if (/^3[47]/.test(num)) return "AMEX";
        return "VISA";
    };

    // Renderizado de Pasos
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
                        <p className="step-desc">Ingresa el nombre de tu escuela y sube un logo si lo tienes.</p>
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
                        <div className="input-group">
                            <label><FaImage /> URL del Logo (Opcional)</label>
                            <input
                                type="text"
                                name="logoUrl"
                                value={formData.logoUrl}
                                onChange={handleChange}
                                placeholder="https://..."
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
                        <div className="payment-preview">
                            <p>Costo de suscripción mensual:</p>
                            <div className="price-tag" style={{ fontSize: '2rem', color: '#007a7a', fontWeight: 'bold', margin: '1rem 0' }}>$700 <span>MXN</span></div>
                            <button className="cta-button primary" onClick={nextStep}>
                                Continuar al Pago
                            </button>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="form-step fade-in">
                        <h3><FaCheckCircle style={{ color: '#007a7a' }} /> Pago de Activación</h3>
                        <p className="step-desc">Completa el pago para activar tu institución en Scholaris.</p>

                        <div className="card-wrapper">
                            <div className={`credit-card ${cardData.isFlipped ? 'flipped' : ''}`}>
                                <div className="card-front">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="card-chip"></div>
                                        <div className="card-type">{getCardType(cardData.number)}</div>
                                    </div>
                                    <div className="card-number">
                                        {cardData.number || "#### #### #### ####"}
                                    </div>
                                    <div className="card-bottom">
                                        <div>
                                            <div className="card-label">Titular</div>
                                            <div className="card-holder">{cardData.name.toUpperCase() || "NOMBRE COMPLETO"}</div>
                                        </div>
                                        <div>
                                            <div className="card-label">Expira</div>
                                            <div className="card-date">{cardData.expiry || "MM/YY"}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-back">
                                    <div className="card-black-bar"></div>
                                    <div className="card-label" style={{ textAlign: 'right', marginRight: '30px', marginTop: '15px' }}>CVV</div>
                                    <div className="card-signature-bar">
                                        {cardData.cvv}
                                    </div>
                                    <div className="card-back-type">{getCardType(cardData.number)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Número de Tarjeta</label>
                            <input
                                type="text"
                                name="number"
                                value={cardData.number}
                                onChange={handleCardChange}
                                placeholder="#### #### #### ####"
                                autoComplete="off"
                            />
                        </div>
                        <div className="input-group">
                            <label>Nombre en la Tarjeta</label>
                            <input
                                type="text"
                                name="name"
                                value={cardData.name}
                                onChange={handleCardChange}
                                placeholder="J. PÉREZ"
                                autoComplete="off"
                            />
                        </div>
                        <div className="input-grid" style={{ marginTop: '1rem' }}>
                            <div className="input-group">
                                <label>Fecha (MM/YY)</label>
                                <input
                                    type="text"
                                    name="expiry"
                                    value={cardData.expiry}
                                    onChange={handleCardChange}
                                    placeholder="MM/YY"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="input-group">
                                <label>CVV</label>
                                <input
                                    type="text"
                                    name="cvv"
                                    value={cardData.cvv}
                                    onChange={handleCardChange}
                                    onFocus={() => setCardData({ ...cardData, isFlipped: true })}
                                    onBlur={() => setCardData({ ...cardData, isFlipped: false })}
                                    placeholder="123"
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <button
                            className="cta-button primary"
                            style={{ marginTop: '2rem', width: '100%' }}
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? "Procesando..." : "Confirmar y Pagar $700 MXN"}
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="register-school-wrapper">
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
                        <div className={`line ${step >= 4 ? 'active' : ''}`}></div>
                        <div className={`dot ${step >= 4 ? 'active' : ''}`}>4</div>
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
                            Siguiente <FaArrowRight />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegisterSchool;
```
