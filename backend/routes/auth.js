import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary"; // CLOUDINARY: Para configurar y eliminar
import { CloudinaryStorage } from "multer-storage-cloudinary"; // CLOUDINARY: Para el storage de Multer
import crypto from "crypto";

import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// NUEVO: Storage de Multer para subir a Cloudinary (Reemplaza diskStorage)
const storageFotos = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "sistema-asistencia/fotos-profesores", // Carpeta de destino
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});
const uploadFotos = multer({ storage: storageFotos });

// Reset tokens (Mantenido en memoria)
const resetTokens = {};

// Helpers
const formatDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

// Helper para obtener Public ID de Cloudinary
const getCloudinaryPublicId = (url) => {
    if (!url || url.includes("default.png") || !url.includes("cloudinary.com")) return null;
    const parts = url.split('/');
    const publicIdWithExt = parts[parts.length - 1];
    const publicId = publicIdWithExt.split('.')[0];
    return `sistema-asistencia/fotos-profesores/${publicId}`; 
};

// ----------------- MIDDLEWARE JWT (VERIFICACIÓN) -----------------
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No hay token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ msg: "Token expirado", error: err.name });
    }
    return res.status(401).json({ msg: "Token inválido" });
  }
};

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== "admin")
      return res.status(403).json({ msg: "No tienes permisos" });
    next();
  });
};

// ----------------- RUTAS DE AUTENTICACIÓN ------------------

// Register
router.post("/register", verifyAdmin, uploadFotos.single("foto"), async (req, res) => {
  try {
    let { nombre, edad, sexo, email, celular, password, role } = req.body;
    email = email.toLowerCase();

    const existingUser = await User.findOne({ $or: [{ email }, { celular }] });
    if (existingUser) {
        // CLOUDINARY CLEANUP: Si el usuario existe, borrar la foto que se subió temporalmente.
        if (req.file) await cloudinary.uploader.destroy(req.file.filename); 
        return res.status(400).json({ msg: "Usuario ya existe" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // CLOUDINARY: Guarda la URL completa
    const fotoUrl = req.file ? req.file.path : "/uploads/fotos/default.png";

    const newUser = new User({ nombre, edad, sexo, email, celular, password: hashedPassword, role: role || "profesor", foto: fotoUrl });
    await newUser.save();

    res.status(201).json({ msg: "Usuario registrado correctamente", user: newUser });
  } catch (err) {
    console.error(err);
    // CLOUDINARY CLEANUP: Borrar la foto si el save a MongoDB falla.
    if (req.file) await cloudinary.uploader.destroy(req.file.filename);
    res.status(500).json({ msg: "Error en el servidor", error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    // CORRECCIÓN CRUCIAL: Añadir .select('+password') para obtener el hash (soluciona Illegal arguments)
    const user = await User.findOne({ $or: [{ email: identifier }, { celular: identifier }] }).select('+password'); 
    
    if (!user) return res.status(400).json({ msg: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password); 
    if (!isMatch) return res.status(400).json({ msg: "Contraseña incorrecta" });

    // Aumentamos la expiración para reducir el error 'jwt expired'
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" }); // Expira en 7 días

    // Devolvemos el usuario sin el password
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password; 

    res.json({
      token,
      user: { 
        id: user._id, nombre: user.nombre, edad: user.edad, sexo: user.sexo, email: user.email, celular: user.celular, role: user.role, foto: user.foto, asignaturas: user.asignaturas || [], fechaRegistro: formatDate(user.createdAt) 
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error en el servidor", error: err.message });
  }
});

// Forgot password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Debe proporcionar un correo" });

    // Forzamos la inclusión del password para el hashing en reset-password
    const user = await User.findOne({ email }).select('+password'); 
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    const token = crypto.randomBytes(4).toString("hex");
    resetTokens[email] = { token, expires: Date.now() + 15 * 60 * 1000 };

    await sendEmail(email, "Recuperación de contraseña", `<p>Tu código es: <b>${token}</b></p>`);
    res.json({ msg: "Código enviado a tu correo" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error enviando el correo", error: err.message });
  }
});

// Reset password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    const savedToken = resetTokens[email];
    if (!savedToken || savedToken.token !== token || Date.now() > savedToken.expires)
      return res.status(400).json({ msg: "Token inválido o expirado" });

    // Forzamos la selección del password para asegurar que podemos hashear la nueva
    const user = await User.findOne({ email }).select('+password'); 
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    delete resetTokens[email];
    res.json({ msg: "Contraseña restablecida exitosamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al restablecer la contraseña", error: err.message });
  }
});

// ---------------- RUTAS ADMIN / PROFESORES -----------------

// GET: Todos los profesores
router.get("/profesores", verifyAdmin, async (req, res) => {
  try {
    const profesores = await User.find({ role: "profesor" }).select(
      "nombre email celular edad sexo foto asignaturas createdAt"
    );

    const formatted = profesores.map((prof) => ({
      ...prof.toObject(),
      fechaRegistro: formatDate(prof.createdAt),
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener profesores", error: err.message });
  }
});

// PUT: Actualizar asignaturas de un profesor
router.put("/profesores/:id/asignaturas", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { asignaturas } = req.body;

    const profesor = await User.findById(id);
    if (!profesor) return res.status(404).json({ msg: "Profesor no encontrado" });

    profesor.asignaturas = asignaturas || [];
    await profesor.save();

    res.json({ msg: "Asignaturas actualizadas correctamente", asignaturas: profesor.asignaturas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al actualizar asignaturas", error: err.message });
  }
});

// DELETE: Eliminar profesor
router.delete("/profesores/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const profesor = await User.findById(id);
    if (!profesor) return res.status(404).json({ msg: "Profesor no encontrado" });

    // LÓGICA CLOUDINARY: Borrar la foto de la nube
    if (profesor.foto && !profesor.foto.includes("default.png")) {
      const publicId = getCloudinaryPublicId(profesor.foto);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    }

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar profesor", error: err.message });
  }
});


export { router as authRouter, verifyToken, verifyAdmin };