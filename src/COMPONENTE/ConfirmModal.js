import React from 'react';
import { useNotification } from './NotificationContext';
import './ConfirmModal.css';

const ConfirmModal = () => {
    const { confirmData, closeConfirm } = useNotification();

    if (!confirmData) return null;

    const { title, message, onConfirm, onCancel } = confirmData;

    const handleConfirm = () => {
        if (onConfirm) onConfirm();
        closeConfirm();
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        closeConfirm();
    };

    return (
        <div className="confirm-modal-overlay">
            <div className="confirm-modal">
                <h2>{title || 'Confirmación'}</h2>
                <p>{message}</p>
                <div className="confirm-actions">
                    <button className="btn-confirm-cancel" onClick={handleCancel}>Piénsalo bien</button>
                    <button className="btn-confirm-proceed" onClick={handleConfirm}>Sí, proceder</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
