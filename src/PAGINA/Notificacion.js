import React, { useEffect } from 'react';
import './Notificacion.css';

/**
 * Un componente reutilizable para mostrar alertas temporales.
 * @param {string} mensaje - El texto a mostrar en la notificación.
 * @param {string} tipo - El tipo de notificación ('success', 'error', 'info'), controla el estilo.
 * @param {function} onClose - La función a llamar para cerrar la notificación.
 */
function Notificacion({ mensaje, tipo, onClose }) {
  useEffect(() => {
    // Inicia un temporizador solo cuando hay un mensaje que mostrar.
    if (mensaje) {
      const timer = setTimeout(() => {
        onClose(); // Llama a la función de cierre después de 3 segundos.
      }, 3000);

      // Limpia el temporizador si el componente se desmonta o el mensaje cambia.
      return () => clearTimeout(timer);
    }
  }, [mensaje, onClose]); // El efecto se ejecuta cada vez que cambia el mensaje.

  // Si no hay mensaje, no renderiza nada.
  if (!mensaje) {
    return null;
  }

  return (
    <div className={`notificacion ${tipo}`}>
      {mensaje}
    </div>
  );
}

export default Notificacion;
