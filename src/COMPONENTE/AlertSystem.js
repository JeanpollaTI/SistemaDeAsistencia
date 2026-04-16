import React from 'react';
import { useNotification } from './NotificationContext';
import { FaCheckCircle, FaInfoCircle, FaExclamationTriangle, FaTimesCircle, FaThumbsUp, FaTimes, FaMagic } from 'react-icons/fa';
import './AlertSystem.css';

const AlertSystem = () => {
    const { alerts, removeAlert } = useNotification();

    if (alerts.length === 0) return null;

    return (
        <div className="alert-system-container">
            {alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} onRemove={() => removeAlert(alert.id)} />
            ))}
        </div>
    );
};

const AlertItem = ({ alert, onRemove }) => {
    const [isClosing, setIsClosing] = React.useState(false);

    const handleRemove = () => {
        setIsClosing(true);
        setTimeout(onRemove, 500); // Wait for animation
    };

    const getIcon = () => {
        switch (alert.type) {
            case 'success': return <FaCheckCircle className="start-icon animated faa-tada" />;
            case 'info': return <FaInfoCircle className="start-icon animated faa-shake" />;
            case 'warning': return <FaExclamationTriangle className="start-icon animated faa-flash" />;
            case 'danger': return <FaTimesCircle className="start-icon animated faa-pulse" />;
            case 'primary': return <FaThumbsUp className="start-icon animated faa-bounce" />;
            case 'update': return <FaMagic className="start-icon animated faa-tada" />;
            default: return <FaInfoCircle className="start-icon" />;
        }
    };

    const getTitle = () => {
        switch (alert.type) {
            case 'success': return '¡Excelente!';
            case 'info': return 'Nota:';
            case 'warning': return 'Advertencia:';
            case 'danger': return 'Error:';
            case 'primary': return 'Información:';
            case 'update': return '✨ ¡NUEVA MEJORA!';
            default: return 'Aviso:';
        }
    };

    return (
        <div className={`alert fade alert-simple alert-${alert.type} ${isClosing ? 'closing' : 'show'}`} role="alert">
            <button type="button" className="close" onClick={handleRemove}>
                <FaTimes />
            </button>
            {getIcon()}
            <strong className="font__weight-semibold">{getTitle()}</strong> {alert.message}
        </div>
    );
};

export default AlertSystem;
