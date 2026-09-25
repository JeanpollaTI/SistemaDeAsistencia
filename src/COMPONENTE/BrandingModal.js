import React, { useState, useRef, useEffect } from 'react';
import './BrandingModal.css';

const BrandingModal = ({ initialData = {}, onConfirm, onClose, title }) => {
    const [directorName, setDirectorName] = useState(() => {
        return initialData?.directorName || localStorage.getItem('current_director_name') || '';
    });
    const [logoPreview, setLogoPreview] = useState(() => {
        return initialData?.logoUrl || '';
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (initialData?.directorName && !directorName) {
            setDirectorName(initialData.directorName);
        }
        if (initialData?.logoUrl && !logoPreview) {
            setLogoPreview(initialData.logoUrl);
        }
    }, [initialData]);

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

        if (directorName.trim()) {
            localStorage.setItem('current_director_name', directorName.trim());
        }

        setIsProcessing(true);
        try {
            onConfirm({
                directorName: directorName.trim() || 'Dirección de la Escuela',
                logoUrl: logoPreview || ''
            });
        } catch (err) {
            setError("Error al procesar la información del reporte.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="branding-modal-overlay" onClick={onClose}>
            <div className="branding-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{title || 'Configuración del Reporte PDF'}</h3>
                <p style={{ fontSize: '0.88rem', color: '#aaa', marginBottom: '15px' }}>
                    Confirma el nombre de la persona responsable de la firma. El logo guardado de la escuela se incluirá automáticamente.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="branding-input-group">
                        <label>Nombre del Director(a) / Firma:</label>
                        <input
                            type="text"
                            value={directorName}
                            onChange={(e) => setDirectorName(e.target.value)}
                            placeholder="Ej: Profr. Juan Pérez"
                            autoFocus
                        />
                    </div>

                    <div className="branding-input-group">
                        <label>Logo Institucional:</label>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            style={{ display: 'none' }} 
                        />

                        {logoPreview ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,203,203,0.3)' }}>
                                <div style={{ width: '45px', height: '45px', background: '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    <img src={logoPreview} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                </div>
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                    <span style={{ fontSize: '0.82rem', color: '#00cbcb', fontWeight: 'bold', display: 'block' }}>✓ Logo guardado en la escuela</span>
                                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Cargado desde los ajustes de la institución</span>
                                </div>
                                <button 
                                    type="button" 
                                    className="branding-file-trigger" 
                                    onClick={triggerFileInput}
                                    style={{ fontSize: '0.8rem', padding: '5px 10px' }}
                                >
                                    Cambiar
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)' }}>
                                <span style={{ fontSize: '0.82rem', color: '#aaa' }}>Sin logo (el reporte se generará en blanco)</span>
                                <button 
                                    type="button" 
                                    className="branding-file-trigger" 
                                    onClick={triggerFileInput}
                                    style={{ fontSize: '0.8rem', padding: '5px 10px' }}
                                >
                                    Añadir Logo
                                </button>
                            </div>
                        )}
                    </div>

                    {error && <div className="branding-error-message">{error}</div>}

                    <div className="branding-modal-actions">
                        <button 
                            type="submit" 
                            className="branding-button primary" 
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Generando...' : 'Confirmar y Descargar PDF'}
                        </button>
                        <button type="button" className="branding-button secondary" onClick={onClose}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BrandingModal;
