import React, { useState } from 'react';
import './BrandingModal.css';

const BrandingModal = ({ initialData, onConfirm, onClose, title }) => {
    const [directorName, setDirectorName] = useState(initialData?.directorName || '');
    const [logoUrl, setLogoUrl] = useState(initialData?.logoUrl || '');
    const [useCustomLogo, setUseCustomLogo] = useState(!!initialData?.logoUrl);

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm({
            directorName,
            logoUrl: useCustomLogo ? logoUrl : initialData?.defaultLogo // We'll handle local logos if needed
        });
    };

    return (
        <div className="branding-modal-overlay" onClick={onClose}>
            <div className="branding-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{title || 'Configuración del Reporte'}</h3>
                <p>Verifica o ajusta los datos que aparecerán en el PDF:</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="branding-input-group">
                        <label>Nombre del Director(a):</label>
                        <input
                            type="text"
                            value={directorName}
                            onChange={(e) => setDirectorName(e.target.value)}
                            placeholder="Ej: Profr. Juan Pérez"
                            autoFocus
                        />
                    </div>

                    <div className="branding-input-group">
                        <label>Logo de la Institución:</label>
                        <div className="branding-toggle-group">
                            <label className={`branding-toggle ${!useCustomLogo ? 'active' : ''}`}>
                                <input 
                                    type="radio" 
                                    name="logoType" 
                                    checked={!useCustomLogo} 
                                    onChange={() => setUseCustomLogo(false)} 
                                />
                                Logo por Defecto
                            </label>
                            <label className={`branding-toggle ${useCustomLogo ? 'active' : ''}`}>
                                <input 
                                    type="radio" 
                                    name="logoType" 
                                    checked={useCustomLogo} 
                                    onChange={() => setUseCustomLogo(true)} 
                                />
                                URL Personalizada
                            </label>
                        </div>

                        {useCustomLogo && (
                            <input
                                type="text"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://..."
                                style={{ marginTop: '10px' }}
                            />
                        )}
                    </div>

                    <div className="branding-modal-actions">
                        <button type="submit" className="branding-button primary">Continuar y Descargar</button>
                        <button type="button" className="branding-button secondary" onClick={onClose}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BrandingModal;
