import axios from 'axios';

// Define la URL base del backend. 
// Utiliza la variable de entorno REACT_APP_API_URL si está definida (ej. en .env)
// Si no está definida, usa 'http://localhost:5000' como fallback.
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

/**
 * Instancia de Axios configurada para manejar todas las peticiones a la API.
 * * NOTA: Esta instancia se exporta para que otros módulos (como AuthContext) 
 * puedan establecer encabezados globales, como el token de autorización.
 */
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para añadir el token de autorización en cada petición
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 403 && error.response.data?.subscriptionStatus === 'suspended') {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const userObj = JSON.parse(userStr);
                    userObj.subscriptionStatus = 'suspended';
                    localStorage.setItem('user', JSON.stringify(userObj));
                } catch(e) {}
            }
            if (window.location.pathname !== '/suspendido') {
                window.location.href = '/suspendido';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
   