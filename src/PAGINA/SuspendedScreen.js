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

                <div className="admin-actions">
                    <h3 style={{ color: '#00CBCB', marginTop: '1.5rem' }}>¿Cómo reactivar el servicio?</h3>
                    <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '15px' }}>
                        Scholaris utiliza ahora un sistema de gestión directa. Por favor <b>contacta con tu supervisor</b> sobre la suscripción para realizar tu pago y reactivar el servicio:
                    </p>
                    
                    <div className="contact-methods" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                        <a 
                            href={`https://wa.me/524491422521?text=Hola,%20quisiera%20renovar%20la%20suscripción%20de%20mi%20escuela:%20${user?.school_name}`} 
                            className="btn-renew-large" 
                            style={{ 
                                background: '#25D366', 
                                textDecoration: 'none', 
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontWeight: '800',
                                textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                            }}
                            target="_blank" 
                            rel="noopener noreferrer"
                        >
                            CONTACTAR POR WHATSAPP
                        </a>
                    </div>
                </div>

                <button className="btn-logout-suspended" onClick={logout}>
                    <FaSignOutAlt /> CERRAR SESIÓN
                </button>
            </div>
        </div>
    );
};

export default SuspendedScreen;
