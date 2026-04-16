import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaCreditCard, FaTimes } from 'react-icons/fa';

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
  const [paymentError, setPaymentError] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
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

  useEffect(() => {
    if (!schoolData?.subscription?.nextBilling) return;

    const interval = setInterval(() => {
      const diff = new Date(schoolData.subscription.nextBilling) - new Date();
      if (diff <= 0) {
        setTimeLeft("0d 00h 00m 00s (Expirado)");
        clearInterval(interval);
        window.location.reload(); // Forzar actualización para que el backend suspenda la sesión instántaneamente
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      const fHours = hours.toString().padStart(2, '0');
      const fMinutes = minutes.toString().padStart(2, '0');
      const fSeconds = seconds.toString().padStart(2, '0');

      setTimeLeft(`${days}d ${fHours}h ${fMinutes}m ${fSeconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [schoolData]);

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
      console.error("Error al procesar renovación:", err);
      const errorMsg = err.response?.data?.error || err.response?.data?.msg || err.message || "Error al iniciar el pago. Por favor intenta de nuevo.";
      setPaymentError(errorMsg);
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
                  ) : schoolData.subscription?.status === 'trial' ? (
                    <><FaCheckCircle style={{ color: '#00CBCB' }} /> <span style={{ color: '#00CBCB', fontWeight: 'bold' }}>PRUEBA GRATUITA</span></>
                  ) : (
                    <><FaExclamationTriangle style={{ color: '#e74c3c' }} /> <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>SUSPENDIDO</span></>
                  )}
                </div>
              </div>

              {schoolData.subscription?.nextBilling && (
                <div className="sub-stat-card" style={{ padding: '15px', borderRadius: '10px', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                    {schoolData.subscription?.status === 'trial' ? 'Fin de Prueba' : 'Próximo Pago'}
                  </p>
                  <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: '#2c3e50' }}>
                    {new Date(schoolData.subscription.nextBilling).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}

              <div className="sub-stat-card" style={{ padding: '15px', borderRadius: '10px', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>Tiempo Restante</p>
                <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: '#00CBCB', fontSize: '1.2rem', fontFamily: 'monospace' }}>
                  {timeLeft || "Calculando..."}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'left', background: 'rgba(0, 203, 203, 0.05)', padding: '15px', borderRadius: '10px' }}>
              <p style={{ color: '#333', fontSize: '0.95rem', marginBottom: '10px' }}>
                <b>¿Deseas renovar tu mensualidad?</b>
              </p>
              <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '15px' }}>
                Scholaris utiliza ahora un sistema de gestión directa. Por favor <b>contacta con tu supervisor</b> sobre la suscripción para realizar tu pago y reactivar el servicio:
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a 
                  href={`https://wa.me/521234567890?text=Hola,%20quisiera%20renovar%20mi%20suscripción:%20${user?.school_name}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-renew" 
                  style={{ background: '#25D366', textDecoration: 'none', fontSize: '0.8rem', padding: '8px 15px' }}
                >
                  WHATSAPP
                </a>
                <a 
                  href={`mailto:thejeanpollo@gmail.com?subject=Renovación%20Scholaris%20-%20${user?.school_name}`}
                  className="btn-renew" 
                  style={{ background: '#00CBCB', textDecoration: 'none', fontSize: '0.8rem', padding: '8px 15px' }}
                >
                  CORREO
                </a>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'admin' && schoolData?.subscription?.status === 'trial' && (
            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0,203,203,0.1)', borderRadius: '10px', textAlign: 'center', border: '1px solid #00CBCB' }}>
                <p style={{ color: '#00CBCB', fontSize: '1rem', fontWeight: 'bold' }}>
                    🎁 ¡REGALO DE BIENVENIDA! <br/>
                    Obtén 3 días de PRUEBA GRATUITA sin compromiso.
                </p>
            </div>
        )}
      </div>
    </div>
  );
}

export default Perfil;
