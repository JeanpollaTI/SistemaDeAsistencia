import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaCreditCard, FaTimes } from 'react-icons/fa';
import PremiumCardForm from "../COMPONENTE/PremiumCardForm";

import "./Perfil.css"; // Importa tu archivo de estilos

/**
 * Componente Perfil. Muestra la información del usuario.
 * Recibe 'user', 'logout', y 'getProfileImageUrl' como props desde App.js.
 */
function Perfil({ user, logout, getProfileImageUrl }) {
  const navigate = useNavigate();
  const [schoolData, setSchoolData] = useState(null);
  const [loadingPay, setLoadingPay] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cardData, setCardData] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchSchoolInfo();
    }
  }, [user]);

  const fetchSchoolInfo = async () => {
    const token = localStorage.getItem("token");
    if (!token || !user?.school_id) return;
    try {
      const res = await axios.get(`${API_URL}/schools/${user.school_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchoolData(res.data);
    } catch (err) {
      console.error("Error al obtener info de la escuela:", err);
    }
  };

  const handleRenewal = async () => {
    if (!cardData || !cardData.cardNumber || !cardData.cardMonth || !cardData.cardYear || !cardData.cardCvv) {
      setPaymentError("Por favor completa todos los datos de la tarjeta.");
      return;
    }
    
    // Validar formato básico
    if (cardData.cardNumber.replace(/\s/g, '').length < 13) {
      setPaymentError("El número de tarjeta no es válido.");
      return;
    }
    
    const token = localStorage.getItem("token");
    if (!token || !user?.school_id) return;

    try {
      setLoadingPay(true);
      setPaymentError("");
      
      const res = await axios.post(`${API_URL}/api/stripe/process-renewal`, 
        { schoolId: user.school_id, cardData },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        alert("¡Renovación exitosa!");
        setShowPaymentModal(false);
        fetchSchoolInfo(); // Refrescar info de la escuela
      }
    } catch (err) {
      console.error("Error al procesar renovación:", err);
      const errorMsg = err.response?.data?.error || err.response?.data?.msg || err.message || "Error al procesar el pago. Por favor intenta de nuevo.";
      setPaymentError(errorMsg);
    } finally {
      setLoadingPay(false);
    }
  };

  // Si no se recibe el objeto 'user' (es null o undefined), redirigir a login.
  if (!user) {
    navigate('/login');
    return null;
  }

  const handleEdit = () => navigate("/editar-perfil");

  const handleLogout = logout || (() => { console.log("Logout simulado."); navigate('/'); });

  // Determinar la URL de la imagen
  // La lógica principal está en getProfileImageUrl (en AuthContext)
  const imageUrl = getProfileImageUrl
    ? getProfileImageUrl(user.foto)
    : 'https://placehold.co/150x150/AAAAAA/FFFFFF?text=Perfil';

  return (
    <div className="perfil-page">
      <div className="perfil-container">
        <h2>Mi Perfil</h2>

        <div className="profile-horizontal-layout">
          <img
            src={imageUrl}
            alt="Perfil"
            className="profile-img-large"
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              objectFit: 'cover',
              background: 'none',
              border: '4px solid #00CBCB',
              margin: '0'
            }}
          />

          <div className="perfil-info" style={{ textAlign: 'left', flex: 1, color: '#000000' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '15px', color: '#00CBCB' }}>Datos Personales</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Nombre:</strong> {user.nombre || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Edad:</strong> {user.edad || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Email:</strong> {user.email || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Sexo:</strong> {user.sexo || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Celular:</strong> {user.celular || "N/A"}</p>
            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Rol:</strong> <span style={{ textTransform: 'capitalize', fontWeight: '600', color: '#000000' }}>{user.role || "N/A"}</span></p>
          </div>
        </div>

        <div className="perfil-buttons" style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%', marginTop: '20px' }}>
          <button className="btn-edit" onClick={handleEdit} style={{ background: '#00CBCB', width: 'auto' }}>EDITAR PERFIL</button>
          <button className="btn-logout" onClick={handleLogout} style={{ background: '#e53935', width: 'auto' }}>CERRAR SESIÓN</button>
        </div>

        {user?.role === 'admin' && schoolData && (
          <div className="subscription-section" style={{ marginTop: '30px', padding: '20px', borderRadius: '12px', background: '#f8f9fa', border: '1px solid #eee' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#333' }}>
              <FaCreditCard style={{ color: '#00CBCB' }} /> Mi Suscripción
            </h3>
            
            <div className="subscription-details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
              <div className="sub-stat-card" style={{ padding: '15px', borderRadius: '10px', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>Estado</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                  {schoolData.subscription?.status === 'active' ? (
                    <><FaCheckCircle style={{ color: '#27ae60' }} /> <span style={{ color: '#27ae60', fontWeight: 'bold' }}>ACTIVO</span></>
                  ) : (
                    <><FaExclamationTriangle style={{ color: '#e74c3c' }} /> <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>SUSPENDIDO</span></>
                  )}
                </div>
              </div>

              {schoolData.subscription?.nextBilling && (
                <div className="sub-stat-card" style={{ padding: '15px', borderRadius: '10px', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>Próximo Pago</p>
                  <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: '#2c3e50' }}>
                    {new Date(schoolData.subscription.nextBilling).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}

              <div className="sub-stat-card" style={{ padding: '15px', borderRadius: '10px', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>Días Restantes</p>
                <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: '#00CBCB', fontSize: '1.2rem' }}>
                  {(() => {
                    const diff = new Date(schoolData.subscription?.nextBilling) - new Date();
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    return days > 0 ? days : 0;
                  })()} DÍAS
                </p>
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <button 
                className="btn-renew" 
                onClick={() => setShowPaymentModal(true)}
                disabled={loadingPay}
                style={{ 
                  background: 'linear-gradient(135deg, #00CBCB, #3498db)', 
                  border: 'none', 
                  color: '#fff', 
                  padding: '12px 25px', 
                  borderRadius: '10px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FaCreditCard /> RENOVAR O PAGAR MENSUALIDAD
              </button>
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '10px' }}>
                * Al hacer clic, serás redirigido a Stripe para completar tu pago de forma segura.
              </p>
            </div>
          </div>
        )}

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
              <h2 style={{ color: '#00CBCB', marginBottom: '10px', textAlign: 'center' }}>Renovar Suscripción</h2>
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
                          margin: '0 auto' /* Centered */
                      }}>
                          <p style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Mensualidad Scholaris</p>
                          <div style={{ fontSize: '3rem', fontWeight: '800', margin: '10px 0' }}>$700.00</div>
                          <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Válido por 1 mes adicional</p>
                      </div>
                      
                      <div className="security-badges" style={{ marginTop: '25px', display: 'flex', justifyContent: 'center', gap: '25px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                              <FaCheckCircle style={{ color: '#00CBCB' }} /> Facturación automática disponible
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                              <FaCheckCircle style={{ color: '#00CBCB' }} /> Procesado por Stripe Inc.
                          </div>
                      </div>
                  </div>

                  <div className="renewal-form-panel" style={{ width: '100%', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '25px' }}>
                      <PremiumCardForm onCardChange={(data) => setCardData(data)} />
                      
                      {paymentError && (
                        <div className="error-message" style={{ background: 'rgba(255, 0, 0, 0.1)', border: '1px solid #ff4d4d', color: '#ff4d4d', padding: '12px', borderRadius: '10px', marginTop: '20px', fontSize: '0.9rem' }}>
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
    </div>
  );
}

export default Perfil;
