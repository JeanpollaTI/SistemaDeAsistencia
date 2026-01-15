import express from "express";
import User from "../models/User.js";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";
import multer from "multer";
import bcrypt from "bcryptjs";
import cloudinary from '../config/cloudinary.js';

const profesoresRouter = express.Router();

// Configuración Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper Cloudinary
const getCloudinaryPublicId = (url) => {
  if (!url || url.includes("default.png") || !url.includes("cloudinary")) return null;
  const parts = url.split('/');
  const publicIdWithExt = parts[parts.length - 1];
  const publicId = publicIdWithExt.split('.')[0];
  return `perfiles/${publicId}`;
};

// ---------------- Obtener todos los profesores (solo admin) ----------------
profesoresRouter.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const profesores = await User.find({ role: "profesor" }).select("-password");
    res.json(profesores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener profesores" });
  }
});

// ---------------- Registrar un nuevo profesor (solo admin) ----------------
profesoresRouter.post("/registrar", authMiddleware, isAdmin, upload.single("foto"), async (req, res) => {
  try {
    const { nombre, email, password, celular, edad, sexo } = req.body;

    if (!nombre || !email || !password || !celular || !edad || !sexo) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ msg: "El correo electrónico ya está en uso" });

    const celularExists = await User.findOne({ celular });
    if (celularExists) return res.status(400).json({ msg: "El número de celular ya está en uso" });

    let fotoUrl = "URL_DE_IMAGEN_POR_DEFECTO.png";
    if (req.file) {
      const publicId = `perfiles/profesor-${Date.now()}`;
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: "perfiles",
        public_id: publicId,
        overwrite: true
      });
      fotoUrl = result.secure_url;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      nombre,
      email,
      password: hashedPassword,
      celular,
      edad,
      sexo,
      role: "profesor",
      foto: fotoUrl,
    });

    await newUser.save();
    res.status(201).json({ msg: "Profesor registrado exitosamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error en el servidor al registrar al profesor", error: error.message });
  }
});

// ---------------- Obtener un solo profesor por ID (admin) ----------------
profesoresRouter.get("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const profesor = await User.findOne({ _id: req.params.id, role: "profesor" }).select("-password");
    if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });
    res.json(profesor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el profesor" });
  }
});

// ---------------- Actualizar asignaturas de un profesor (solo admin) ----------------
profesoresRouter.put("/:id/asignaturas", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { asignaturas } = req.body;
    const profesor = await User.findById(req.params.id);
    if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });

    profesor.asignaturas = asignaturas || [];
    await profesor.save();

    res.json({ msg: "Asignaturas actualizadas correctamente", asignaturas: profesor.asignaturas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar asignaturas" });
  }
});

// ---------------- Eliminar profesor (solo admin) ----------------
profesoresRouter.delete("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const profesor = await User.findById(req.params.id);
    if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });

    const publicId = getCloudinaryPublicId(profesor.foto);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.warn("Advertencia al eliminar imagen:", e);
      }
    }

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar profesor" });
  }
});

// ---------------- Editar perfil propio (CON CLOUDINARY) ----------------
profesoresRouter.put("/editar-perfil", authMiddleware, upload.single("foto"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, email, celular, edad, sexo } = req.body;
    let fotoUrl = null;

    if (!nombre || !email || !celular || !edad || !sexo)
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    if (email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ msg: "El correo ya está en uso" });
    }
    if (celular !== user.celular) {
      const celularExists = await User.findOne({ celular });
      if (celularExists) return res.status(400).json({ msg: "El celular ya está en uso" });
    }

    if (req.file) {
      const publicId = `perfiles/user-${userId}`;
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: "perfiles",
        public_id: publicId,
        overwrite: true
      });
      fotoUrl = result.secure_url;
    }

    user.nombre = nombre;
    user.email = email;
    user.celular = celular;
    user.edad = edad;
    user.sexo = sexo;

    if (fotoUrl) user.foto = fotoUrl;

    await user.save();
    res.json({ msg: "Perfil actualizado correctamente", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al actualizar perfil o subir foto", error: err.message });
  }
});

// ---------------- Obtener perfil propio ----------------
profesoresRouter.get("/mi-perfil", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener perfil", error: err.message });
  }
});

export { profesoresRouter };
