import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
// Se asume que tienes un AuthContext que provee la información del usuario.
// Si no lo tienes, puedes adaptarlo para que lea el 'user' desde el estado de App.js
import { AuthContext } from "./AuthContext";

/**
 * Un componente de orden superior para proteger rutas.
 * Verifica si un usuario está autenticado y si tiene el rol requerido.
 * @param {React.ReactNode} children - El componente a renderizar si la autorización es exitosa.
 * @param {string|string[]} requiredRole - El rol o roles necesarios para acceder a la ruta.
 */
const PrivateRoute = ({ children, requiredRole }) => {
  // Obtiene el estado de autenticación del contexto
  const { user } = useContext(AuthContext);
  const location = useLocation();

  // 1. Verificar si el usuario está autenticado
  // Si no hay un objeto 'user', significa que no ha iniciado sesión.
  if (!user) {
    // Redirige al usuario a la página de login.
    // 'state={{ from: location }}' guarda la página que intentaba visitar
    // para que puedas redirigirlo de vuelta allí después de un login exitoso.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Verificar si se requiere un rol específico para esta ruta
  if (requiredRole) {
    // Permite pasar un solo rol (string) o varios (array)
    const rolesAllowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Si el rol del usuario actual no está en la lista de roles permitidos...
    if (!rolesAllowed.includes(user.role)) {
      // ...lo redirige a una página de "No Autorizado".
      // Deberás crear este componente para mostrar un mensaje de error.
      return <Navigate to="/no-autorizado" replace />;
    }
  }

  // 3. Si todas las verificaciones pasan, renderiza el componente hijo
  // Esto significa que el usuario está autenticado y tiene el permiso necesario.
  return children;
};

export default PrivateRoute;
