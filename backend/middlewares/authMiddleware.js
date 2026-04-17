// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SystemStatus from "../models/SystemStatus.js";

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("authMiddleware: Fallo por Header ausente o malformado:", authHeader ? "Presente pero no Bearer" : "Ausente");
    return res.status(401).json({ error: "No autorizado, falta token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Traemos el usuario completo
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });

    // Inyectamos el school_id. Prioridad: base de datos > token
    // Esto asegura que si el usuario cambia de escuela o se corrige su ID, surta efecto inmediato.
    const school_id = user.school_id || decoded.school_id || null;

    req.user = user;
    req.user.school_id = school_id;

    // --- 🌟 CHEQUEO DE MODO MANTENIMIENTO 🌟 ---
    // Si no es superadmin, verificar si el sistema está bajo mantenimiento
    if (user.role !== 'superadmin') {
        const settings = await SystemStatus.getSettings();
        if (settings.maintenanceMode) {
            return res.status(503).json({ 
                maintenance: true, 
                msg: 'El sistema se encuentra en mantenimiento global. Intente más tarde.' 
            });
        }
    }

    next();
  } catch (err) {
    console.error("Error authMiddleware:", err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expirado", expired: true });
    }
    res.status(401).json({ error: "Token inválido" });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "superadmin")) {
    next();
  } else {
    res.status(403).json({ error: "Acceso denegado, solo admin" });
  }
};

export const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "superadmin") {
    next();
  } else {
    res.status(403).json({ error: "Acceso denegado, solo el Administrador Global" });
  }
};
