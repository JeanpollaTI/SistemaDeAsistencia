import React from 'react';
import './LoadingOverlay.css';

const LoadingOverlay = ({ message = "Cargando..." }) => {
    return (
        <div className="loading-overlay">
            <div className="tetrominos">
                <div className="tetromino box1"></div>
                <div className="tetromino box2"></div>
                <div className="tetromino box3"></div>
                <div className="tetromino box4"></div>
            </div>
            {message && <p className="loading-message">{message}</p>}
        </div>
    );
};

export default LoadingOverlay;
