import React from 'react';
import { FaTools, FaExclamationTriangle, FaSchool } from 'react-icons/fa';
import './MaintenanceScreen.css';

const MaintenanceScreen = () => {
    return (
        <div className="maintenance-container">
            <div className="maintenance-glass">
                <div className="maintenance-icon-wrapper">
                    <FaTools className="main-icon" />
                    <div className="warning-badge">
                        <FaExclamationTriangle />
                    </div>
                </div>
                
                <h1 className="maintenance-title">Servicio en Mantenimiento</h1>
                <p className="maintenance-message">
                    Actualmente se está dando mantenimiento a la página para mejorar tu experiencia. 
                    El acceso está restringido temporalmente.
                </p>
                
                <div className="maintenance-info">
                    <p>Por favor, regrese más tarde o consulte con su supervisor si tiene alguna duda urgente.</p>
                </div>

                <div className="maintenance-footer">
                    <FaSchool className="school-icon" />
                    <span>Sistema de Gestión Académica</span>
                </div>
            </div>
            
            <div className="background-decorations">
                <div className="circle-1"></div>
                <div className="circle-2"></div>
            </div>
        </div>
    );
};

export default MaintenanceScreen;
