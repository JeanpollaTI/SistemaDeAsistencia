import React from 'react';
import { FaExclamationTriangle, FaTrashAlt, FaInfoCircle, FaCheck, FaTimes } from 'react-icons/fa';
import './Notificacion.css';

function ConfirmacionModal({
  isOpen,
  onClose,
  onConfirm,
  mensaje,
  title = "⚠️ Confirmación",
  confirmText = "Sí, Eliminar",
  cancelText = "Cancelar",
  tipo = "danger" // 'danger' | 'warning' | 'info'
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-confirm" onClick={onClose}>
      <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon-badge ${tipo}`}>
          {tipo === 'danger' ? <FaTrashAlt /> :
           tipo === 'warning' ? <FaExclamationTriangle /> : <FaInfoCircle />}
        </div>
        <h4>{title}</h4>
        <p>{mensaje}</p>
        <div className="confirm-modal-actions">
          <button
            className={`btn ${tipo === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            <FaCheck style={{ marginRight: '6px' }} /> {confirmText}
          </button>
          <button className="btn btn-cancel" onClick={onClose}>
            <FaTimes style={{ marginRight: '6px' }} /> {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmacionModal;