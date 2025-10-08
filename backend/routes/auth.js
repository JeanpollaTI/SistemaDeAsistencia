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

const storageFotos = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "sistema-asistencia/fotos-profesores", // Carpeta de destino
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});
const uploadFotos = multer({ storage: storageFotos });

// Reset tokens (en memoria)
const resetTokens = {};

// Helpers
const formatDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const getCloudinaryPublicId = (url) => {
  if (!url || url.includes("default.png") || !url.includes("cloudinary")) return null;
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
    if (existingUser) return res.status(400).json({ msg: "Usuario ya existe" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const fotoUrl = req.file ? req.file.path : "/uploads/fotos/default.png";

    const newUser = new User({ nombre, edad, sexo, email, celular, password: hashedPassword, role: role || "profesor", foto: fotoUrl });
    await newUser.save();

    res.status(201).json({ msg: "Usuario registrado correctamente", user: newUser });
  } catch (err) {
    console.error('---- ERROR DETALLADO EN REGISTRO ----');
    console.error(err);
    if (req.file) {
      // Para Cloudinary, el filename es el public_id
      const publicId = req.file.filename;
      await cloudinary.uploader.destroy(publicId);
    }
    res.status(500).json({ msg: "Error en el servidor", error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ email: identifier }, { celular: identifier }] }).select('+password');
    if (!user) return res.status(400).json({ msg: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    res.json({ token, user: userWithoutPassword });
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

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    const token = crypto.randomBytes(4).toString("hex").toUpperCase();
    resetTokens[email] = { token, expires: Date.now() + 15 * 60 * 1000 };

    await sendEmail(email, "Recuperación de contraseña", `<p>Tu código de recuperación es: <b>${token}</b></p>`);
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

    const user = await User.findOne({ email });
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

// -------------------------------------------------------------
// ---- ✅ RUTAS AÑADIDAS: GESTIÓN DEL PERFIL DEL PROPIO USUARIO ----
// -------------------------------------------------------------

// GET: Obtener perfil propio
router.get("/mi-perfil", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener el perfil", error: err.message });
  }
});

// PUT: Editar perfil propio
router.put("/editar-perfil", verifyToken, uploadFotos.single("foto"), async (req, res) => {
  try {
    const { nombre, email, celular, edad, sexo } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    // Validar si el nuevo email o celular ya está en uso por OTRO usuario
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ msg: "El correo ya está en uso" });
    }
    if (celular && celular !== user.celular) {
      const celularExists = await User.findOne({ celular });
      if (celularExists) return res.status(400).json({ msg: "El celular ya está en uso" });
    }

    // Actualizar datos
    user.nombre = nombre || user.nombre;
    user.email = email || user.email;
    user.celular = celular || user.celular;
    user.edad = edad || user.edad;
    user.sexo = sexo || user.sexo;

    // Si se sube una nueva foto, eliminar la anterior y guardar la nueva
    if (req.file) {
      const publicId = getCloudinaryPublicId(user.foto);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
      user.foto = req.file.path;
    }

    const updatedUser = await user.save();
    res.json({ msg: "Perfil actualizado correctamente", user: updatedUser });

  } catch (err) {
    console.error('---- ERROR DETALLADO AL EDITAR PERFIL ----');
    console.error(err);
    res.status(500).json({ msg: "Error al actualizar el perfil", error: err.message });
  }
});


// ---------------- RUTAS DE GESTIÓN DE PROFESORES (SOLO ADMIN) -----------------

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
    res.json({ msg: "Asignaturas actualizadas", asignaturas: profesor.asignaturas });
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

    const publicId = getCloudinaryPublicId(profesor.foto);
    if (publicId) await cloudinary.uploader.destroy(publicId);

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar profesor", error: err.message });
  }
});


export { router as authRouter, verifyToken, verifyAdmin };