import React, { useEffect } from 'react';
import './Notificacion.css';

function Notificacion({ mensaje, tipo, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!mensaje) return null;

  return (
    <div className={`notificacion ${tipo}`}>
      {mensaje}
    </div>
  );
}

export default Notificacion;