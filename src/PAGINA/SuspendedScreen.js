import React, { useContext, useState } from 'react';
import { AuthContext } from './AuthContext';
import { FaLock, FaExclamationTriangle, FaTimes, FaCreditCard, FaCheckCircle, FaSignOutAlt } from 'react-icons/fa';
import axios from 'axios';
import './SuspendedScreen.css';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const SuspendedScreen = () => {
    const { user, logout, updateUser } = useContext(AuthContext);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [loadingPay, setLoadingPay] = useState(false);
    const [paymentError, setPaymentError] = useState("");

    const handleRenewal = async () => {
        const token = localStorage.getItem("token");
        if (!token || !user?.school_id) return;

        try {
            setLoadingPay(true);
            setPaymentError("");

            const res = await axios.post(`${API_URL}/api/stripe/create-checkout-session`,
                { schoolId: user.school_id },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.url) {
                window.location.href = res.data.url;
            } else {
                throw new Error("No se recibió la URL de pago de Stripe.");
            }
        } catch (err) {
            console.error("Error al iniciar renovación:", err);
            const errorMsg = err.response?.data?.error || err.response?.data?.msg || err.message || "Error al iniciar el proceso de pago.";
            setPaymentError(errorMsg);
        } finally {
            setLoadingPay(false);
        }
    };

    return (
        <div className="suspended-page">
            <div className="suspended-card">
                <div className="suspended-icon-container">
                    <FaLock className="suspended-lock" />
                </div>
                <h2>Suscripción Expirada</h2>
                <p className="suspended-message">
                    El acceso a la plataforma para <strong>{user?.school_name || "su institución"}</strong> se encuentra temporalmente suspendido porque el periodo de suscripción ha finalizado.
                </p>
                <div className="suspended-info-box">
                    <FaExclamationTriangle className="warning-icon" />
                    <span>No te preocupes, <strong>ningún dato ha sido borrado</strong>. Toda la información de alumnos, calificaciones y asistencias está a salvo.</span>
                </div>

                {user?.role === 'admin' ? (
                    <div className="admin-actions">
                        <p className="admin-instruction">Como administrador, puedes renovar la suscripción de inmediato para restablecer el acceso a toda tu institución.</p>
                        <button className="btn-renew-large" onClick={() => setShowPaymentModal(true)}>
                            <FaCreditCard /> RENOVAR AHORA
                        </button>
                    </div>
                ) : (
                    <div className="user-actions">
                        <p className="user-instruction">Por favor, comunícate con el administrador o director de tu escuela para que realice el pago y reactive el servicio para todos.</p>
                    </div>
                )}

                <button className="btn-logout-suspended" onClick={logout}>
                    <FaSignOutAlt /> CERRAR SESIÓN
                </button>
            </div>

            {showPaymentModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content" style={{
                        maxWidth: '850px',
                        width: '95%',
                        padding: '40px',
                        borderRadius: '30px',
                        background: 'rgba(28, 31, 40, 0.98)',
                        backdropFilter: 'blur(30px)',
                        border: '1px solid rgba(0, 203, 203, 0.3)',
                        color: 'white',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
                    }}>
                        <button className="modal-close" onClick={() => setShowPaymentModal(false)} style={{ color: 'white' }}>
                            <FaTimes />
                        </button>
                        <h2 style={{ color: '#00CBCB', marginBottom: '10px', textAlign: 'center' }}>Renovar Suscripción de Institución</h2>
                        <p style={{ color: '#ffffff', marginBottom: '30px', textAlign: 'center', opacity: 0.9, fontSize: '1.1rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                            Tu escuela recuperará el acceso total de forma inmediata al completar el pago.
                        </p>

                        <div className="renewal-horizontal-layout" style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="renewal-info-panel" style={{ flex: '1', minWidth: '300px' }}>
                                <div className="price-card-premium" style={{
                                    background: 'linear-gradient(135deg, #007A7A, #00CBCB)',
                                    padding: '25px',
                                    borderRadius: '15px',
                                    textAlign: 'center',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                                    margin: '0 auto'
                                }}>
                                    <p style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Mensualidad Scholaris</p>
                                    <div style={{ fontSize: '3rem', fontWeight: '800', margin: '10px 0' }}>$850.00</div>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Válido por 1 mes adicional</p>
                                </div>

                                <div className="security-badges" style={{ marginTop: '25px', display: 'flex', justifyContent: 'center', gap: '25px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                                        <FaCheckCircle style={{ color: '#00CBCB' }} /> Facturación automática
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                                        <FaCheckCircle style={{ color: '#00CBCB' }} /> Procesado por Stripe Inc.
                                    </div>
                                </div>
                            </div>

                            <div className="renewal-form-panel" style={{ width: '100%', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '25px', textAlign: 'center' }}>
                                <p style={{ color: 'white', fontSize: '1.05rem', marginBottom: '30px' }}>
                                    Para su seguridad y el cumplimiento de normativas de pagos, será redirigido a la pasarela oficial y segura de Stripe para completar la suscripción.
                                </p>

                                {paymentError && (
                                    <div className="error-message" style={{ background: 'rgba(255, 0, 0, 0.1)', border: '1px solid #ff4d4d', color: '#ff4d4d', padding: '12px', borderRadius: '10px', marginTop: '20px', fontSize: '0.9rem', marginBottom: '20px' }}>
                                        <FaExclamationTriangle /> {paymentError}
                                    </div>
                                )}

                                <div className="modal-actions" style={{ marginTop: '25px' }}>
                                    <button
                                        className="btn-guardar"
                                        onClick={handleRenewal}
                                        disabled={loadingPay}
                                        style={{
                                            width: '100%',
                                            background: '#00CBCB',
                                            padding: '15px',
                                            borderRadius: '12px',
                                            fontSize: '1.1rem',
                                            fontWeight: '700',
                                            letterSpacing: '1px',
                                            boxShadow: '0 5px 15px rgba(0, 203, 203, 0.3)'
                                        }}
                                    >
                                        {loadingPay ? "PROCESANDO PAGO..." : "CONFIRMAR Y PAGAR AHORA"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuspendedScreen;
