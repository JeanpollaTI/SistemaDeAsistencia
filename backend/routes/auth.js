import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// Multer fotos
const storageFotos = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "uploads/fotos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) =>
    cb(null, "foto-" + Date.now() + path.extname(file.originalname)),
});
const uploadFotos = multer({ storage: storageFotos });

// JWT middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No hay token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
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

// Reset tokens
const resetTokens = {};

// Helpers
const formatDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

// ----------------- RUTAS ------------------

// Register
router.post("/register", verifyAdmin, uploadFotos.single("foto"), async (req, res) => {
  try {
    let { nombre, edad, sexo, email, celular, password, role } = req.body;
    email = email.toLowerCase();

    const existingUser = await User.findOne({ $or: [{ email }, { celular }] });
    if (existingUser) return res.status(400).json({ msg: "Usuario ya existe" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const fotoUrl = req.file ? `/uploads/fotos/${req.file.filename}` : "/uploads/fotos/default.png";

    const newUser = new User({ nombre, edad, sexo, email, celular, password: hashedPassword, role: role || "profesor", foto: fotoUrl });
    await newUser.save();

    res.status(201).json({ msg: "Usuario registrado correctamente", user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error en el servidor", error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ email: identifier }, { celular: identifier }] });
    if (!user) return res.status(400).json({ msg: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });

    res.json({
      token,
      user: { id: user._id, nombre: user.nombre, edad: user.edad, sexo: user.sexo, email: user.email, celular: user.celular, role: user.role, foto: user.foto, asignaturas: user.asignaturas || [], fechaRegistro: formatDate(user.createdAt) }
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

    const user = await User.findOne({ email });
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

    // 👇 elimina la foto del servidor
    if (profesor.foto && profesor.foto !== "/uploads/fotos/default.png") {
      const fotoPath = path.join(process.cwd(), profesor.foto);
      if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
    }

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar profesor", error: err.message });
  }
});

export { router as authRouter, verifyToken, verifyAdmin };
