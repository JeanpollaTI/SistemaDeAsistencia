import axios from 'axios';

// Creamos una instancia de Axios con una configuración base.
// Aquí es el ÚNICO lugar donde vivirá la URL de tu backend.
const apiClient = axios.create({
  baseURL: 'https://sistema-asistencia-api.onrender.com', // ¡La URL que te dio Render!
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;