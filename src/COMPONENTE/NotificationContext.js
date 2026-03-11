import React, { createContext, useState, useContext, useCallback } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);

    const showAlert = useCallback((message, type = 'info') => {
        const id = Date.now();
        setAlerts(prev => [...prev, { id, message, type }]);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            setAlerts(prev => prev.filter(alert => alert.id !== id));
        }, 5000);
    }, []);

    const removeAlert = useCallback((id) => {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ showAlert, removeAlert, alerts }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
