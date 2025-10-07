import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "./AuthContext";

const PrivateRoute = ({ children, requiredRole }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  // Si no hay usuario autenticado, redirige a login y guarda la ruta actual para redirigir después del login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    // Permite pasar un string o un array de roles permitidos
    const rolesAllowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    // Si el rol del usuario no está en la lista permitida, redirige a "no autorizado"
    if (!rolesAllowed.includes(user.role)) {
      return <Navigate to="/no-autorizado" replace />;
    }
  }

  // Usuario autenticado y con rol permitido (o no se requiere rol)
  return children;
};

export default PrivateRoute;
