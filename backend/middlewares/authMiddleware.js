// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado, falta token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Traemos el usuario completo
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });

    // Inyectamos el school_id. Prioridad: token > database
    // Si el token es viejo (no tiene school_id), lo tomamos del documento del usuario.
    const school_id = decoded.school_id || user.school_id || null;

    req.user = user;
    req.user.school_id = school_id;

    next();
  } catch (err) {
    console.error("Error authMiddleware:", err);
    res.status(401).json({ error: "Token inválido" });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Acceso denegado, solo admin" });
  }
};
