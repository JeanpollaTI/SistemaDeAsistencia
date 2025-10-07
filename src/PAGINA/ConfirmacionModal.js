import React from 'react';
import './Notificacion.css';

function ConfirmacionModal({ isOpen, onClose, onConfirm, mensaje }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-confirm">
      <div className="confirm-modal-content">
        <h4>Confirmación</h4>
        <p>{mensaje}</p>
        <div className="confirm-modal-actions">
          <button className="btn btn-danger" onClick={onConfirm}>
            Sí, Eliminar
          </button>
          <button className="btn btn-cancel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmacionModal;