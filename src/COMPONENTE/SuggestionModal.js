import React, { useState } from 'react';
import apiClient from '../api/apiClient';
import { useNotification } from './NotificationContext';
import './SuggestionModal.css';

const SuggestionModal = ({ isOpen, onClose }) => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const { addNotification } = useNotification();

    const handleSend = async () => {
        if (!content.trim()) return;
        setLoading(true);
        try {
            await apiClient.post('/api/suggestions', { content });
            addNotification('¡Gracias! Tu sugerencia ha sido enviada al equipo global.', 'success');
            setContent('');
            onClose();
        } catch (error) {
            console.error(error);
            addNotification('Error al enviar la sugerencia', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="suggestion-modal-overlay">
            <div className="suggestion-modal">
                <h2>Enviar Sugerencia</h2>
                <p>Tu opinión nos ayuda a mejorar la plataforma para todos.</p>
                <textarea 
                    placeholder="Escribe aquí tu sugerencia o informe de error..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={loading}
                />
                <div className="actions">
                    <button className="btn-cancel" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button className="btn-send" onClick={handleSend} disabled={loading || !content.trim()}>
                        {loading ? 'Enviando...' : 'Enviar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuggestionModal;
