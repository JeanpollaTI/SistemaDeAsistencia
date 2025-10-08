// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * @desc Middleware principal para verificar el JWT en cada petición protegida.
 * @access Private
 */
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado, falta token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Traemos el usuario completo, excluyendo la contraseña
    const user = await User.findById(decoded.id).select("-password"); 
    
    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });

    // Añadimos el objeto user completo al request
    req.user = user;

    next();
  } catch (err) {
    console.error("Error authMiddleware:", err);
    
    // CORRECCIÓN CLAVE: Manejo explícito del token expirado para el frontend
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expirado. Por favor, inicia sesión de nuevo." });
    }

    res.status(401).json({ error: "Token inválido" });
  }
};

/**
 * @desc Middleware para verificar si el usuario logueado tiene el rol de 'admin'.
 * @access Restricted
 */
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    // 403 Forbidden - El usuario está autenticado, pero no tiene los permisos necesarios.
    res.status(403).json({ error: "Acceso denegado, solo admin" });
  }
};