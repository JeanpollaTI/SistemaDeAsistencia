import React, { createContext, useState, useContext, useCallback } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [alerts, setAlerts] = useState([]);
    const [notifications, setNotifications] = useState([]);

    const [confirmData, setConfirmData] = useState(null);

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

    const addNotification = useCallback((message, type = 'info') => {
        const id = Date.now();
        setNotifications(prev => [{ id, message, type, date: new Date(), read: false }, ...prev].slice(0, 10)); // Keep last 10
    }, []);

    const showConfirm = useCallback((title, message, onConfirm, onCancel) => {
        setConfirmData({ title, message, onConfirm, onCancel });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmData(null);
    }, []);

    const markAsRead = useCallback((id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    return (
        <NotificationContext.Provider value={{ 
            showAlert, removeAlert, alerts,
            notifications, addNotification, markAsRead, clearNotifications,
            showConfirm, closeConfirm, confirmData
        }}>
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
