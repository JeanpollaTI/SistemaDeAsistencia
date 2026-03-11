import React, { useState, useRef } from 'react';
import './BrandingModal.css';

const BrandingModal = ({ onConfirm, onClose, title }) => {
    const [directorName, setDirectorName] = useState('');
    const [logoPreview, setLogoPreview] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError("Por favor, selecciona un archivo de imagen válido.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
                setLogoPreview(readerEvent.target.result);
                setError(null);
            };
            reader.onerror = () => setError("Error al leer el archivo.");
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!directorName.trim()) {
            setError("El nombre del director es obligatorio.");
            return;
        }

        if (!logoPreview) {
            setError("Debes subir un logo (archivo de imagen).");
            return;
        }

        setIsProcessing(true);
        try {
            // No extra validation needed for local Base64, but we could wrap it
            onConfirm({
                directorName,
                logoUrl: logoPreview
            });
        } catch (err) {
            setError("Error al procesar el logo. Intenta con otra imagen.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="branding-modal-overlay" onClick={onClose}>
            <div className="branding-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{title || 'Configuración del Reporte'}</h3>
                <p>Configura el branding para este PDF (Se requiere director y logo):</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="branding-input-group">
                        <label>Nombre del Director(a):</label>
                        <input
                            type="text"
                            value={directorName}
                            onChange={(e) => setDirectorName(e.target.value)}
                            placeholder="Ej: Profr. Juan Pérez"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="branding-input-group">
                        <label>Logo de la Institución:</label>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            style={{ display: 'none' }} 
                        />
                        <button 
                            type="button" 
                            className="branding-file-trigger" 
                            onClick={triggerFileInput}
                        >
                            {logoPreview ? 'Cambiar Logo' : 'Seleccionar Logo'}
                        </button>
                    </div>

                    {logoPreview && (
                        <div className="branding-preview-container">
                            <p>Vista previa del logo:</p>
                            <img src={logoPreview} alt="Preview" className="branding-logo-preview" />
                        </div>
                    )}

                    {error && <div className="branding-error-message">{error}</div>}

                    <div className="branding-modal-actions">
                        <button 
                            type="submit" 
                            className="branding-button primary" 
                            disabled={isProcessing || !directorName.trim() || !logoPreview}
                        >
                            {isProcessing ? 'Procesando...' : 'Confirmar y Descargar'}
                        </button>
                        <button type="button" className="branding-button secondary" onClick={onClose}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BrandingModal;
