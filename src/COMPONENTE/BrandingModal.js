import React, { useState, useEffect } from 'react';
import './BrandingModal.css';

const BrandingModal = ({ initialData, onConfirm, onClose, title }) => {
    const [directorName, setDirectorName] = useState(''); // FORZAR VACÍO
    const [logoUrl, setLogoUrl] = useState('');
    const [logoPreview, setLogoPreview] = useState(null);
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState(null);
    const [logoSource, setLogoSource] = useState('url'); // 'url' or 'file'

    const validateImage = (src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => resolve(src);
            img.onerror = () => reject(new Error("No se pudo cargar la imagen. Verifica la URL o el archivo."));
            img.src = src;
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
                setLogoPreview(readerEvent.target.result);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!directorName.trim()) {
            setError("El nombre del director es obligatorio.");
            return;
        }

        const finalLogo = logoSource === 'url' ? logoUrl : logoPreview;
        if (!finalLogo) {
            setError("Debes proporcionar un logo (URL o archivo).");
            return;
        }

        setIsValidating(true);
        try {
            await validateImage(finalLogo);
            onConfirm({
                directorName,
                logoUrl: finalLogo
            });
        } catch (err) {
            setError("Error con la imagen: Es posible que la URL no permita ser usada (CORS) o el archivo sea inválido. Intenta subir el archivo directamente.");
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <div className="branding-modal-overlay" onClick={onClose}>
            <div className="branding-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{title || 'Configuración del Reporte'}</h3>
                <p>Ingresa los datos para este reporte (No hay valores por defecto):</p>
                
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
                        <div className="branding-toggle-group">
                            <button 
                                type="button"
                                className={`branding-toggle-btn ${logoSource === 'url' ? 'active' : ''}`}
                                onClick={() => setLogoSource('url')}
                            >
                                URL de Imagen
                            </button>
                            <button 
                                type="button"
                                className={`branding-toggle-btn ${logoSource === 'file' ? 'active' : ''}`}
                                onClick={() => setLogoSource('file')}
                            >
                                Subir Archivo
                            </button>
                        </div>

                        {logoSource === 'url' ? (
                            <input
                                type="text"
                                value={logoUrl}
                                onChange={(e) => {
                                    setLogoUrl(e.target.value);
                                    setLogoPreview(e.target.value);
                                }}
                                placeholder="https://..."
                                style={{ marginTop: '10px' }}
                            />
                        ) : (
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                style={{ marginTop: '10px', color: '#ccc' }}
                            />
                        )}
                    </div>

                    {logoPreview && (
                        <div className="branding-preview-container">
                            <p>Vista previa del logo:</p>
                            <img src={logoPreview} alt="Preview" className="branding-logo-preview" onError={() => setError("URL de imagen no válida")} />
                        </div>
                    )}

                    {error && <div className="branding-error-message">{error}</div>}

                    <div className="branding-modal-actions">
                        <button 
                            type="submit" 
                            className="branding-button primary" 
                            disabled={isValidating}
                        >
                            {isValidating ? 'Validando...' : 'Continuar y Descargar'}
                        </button>
                        <button type="button" className="branding-button secondary" onClick={onClose}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BrandingModal;
