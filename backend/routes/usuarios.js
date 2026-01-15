import express from "express";
import User from "../models/User.js";
<<<<<<< HEAD
// Los middlewares de autenticación deben adaptarse al nombre que uses:
// En el primer ejemplo se usan 'authMiddleware' e 'isAdmin'.
// En el segundo ejemplo se usan 'verifyToken' y 'verifyAdmin'.
// Asumiré que quieres usar 'authMiddleware' e 'isAdmin' del primer ejemplo
// ya que 'profesoresRouter' ya los importaba.
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js"; 
import multer from "multer";
import path from "path"; // Se mantiene por si se necesita lógica de ruta en otros lugares, aunque no para Cloudinary
import fs from "fs"; // Se mantiene por si se necesita lógica de archivos en otros lugares
import cloudinary from '../config/cloudinary.js'; // Importamos la configuración de Cloudinary

const router = express.Router(); // Cambié 'profesoresRouter' a 'router' para mayor generalidad

// ----------------- HELPERS -----------------
/**
 * Formatea una fecha a DD/MM/YYYY.
 * @param {Date | string} date - La fecha a formatear.
 * @returns {string} La fecha formateada o "N/A".
 */
const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    // Asegurarse de que el mes sea +1 ya que es base 0
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// ---------------- INICIO: Configuración Multer para Cloudinary ----------------
// Configuración para que Multer almacene el archivo temporalmente en memoria (Buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage });
// ---------------- FIN: Configuración Multer ----------------

// ---------------- Obtener todos los profesores (solo admin) ----------------
router.get("/profesores", authMiddleware, isAdmin, async (req, res) => {
    try {
        const profesores = await User.find({ role: "profesor" }).select(
            "nombre email celular edad sexo foto asignaturas createdAt"
        );
        
        // Aplicar formato de fecha
        const formatted = profesores.map((prof) => ({
            ...prof.toObject(),
            fechaRegistro: formatDate(prof.createdAt),
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener profesores", msg: err.message });
    }
});

// ---------------- Actualizar asignaturas de un profesor (solo admin) ----------------
router.put("/profesores/:id/asignaturas", authMiddleware, isAdmin, async (req, res) => {
    try {
        const { asignaturas } = req.body;
        const profesor = await User.findById(req.params.id);
        if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });

        profesor.asignaturas = asignaturas || [];
        await profesor.save();

        res.json({ msg: "Asignaturas actualizadas correctamente", asignaturas: profesor.asignaturas });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al actualizar asignaturas", msg: err.message });
    }
});

// ---------------- Eliminar profesor (solo admin) ----------------
router.delete("/profesores/:id", authMiddleware, isAdmin, async (req, res) => {
    try {
        const profesor = await User.findById(req.params.id);
        if (!profesor) return res.status(404).json({ error: "Profesor no encontrado" });

        // Lógica de eliminación de imagen en Cloudinary (opcional, basado en tu implementación de public_id)
        // Si al subir usaste un public_id como `perfiles/user-${profesor._id}`, puedes intentar eliminarlo aquí.
        const defaultUrl = "/uploads/fotos/default.png"; // O la URL de tu imagen por defecto de Cloudinary
        if (profesor.foto && profesor.foto !== defaultUrl && profesor.foto.includes('cloudinary')) {
            try {
                // Si la URL es la de Cloudinary, asumimos que el public_id es 'perfiles/user-ID'
                const publicId = `perfiles/user-${profesor._id}`; 
                // Eliminación asíncrona (no bloquea el flujo si falla, solo advierte)
                await cloudinary.uploader.destroy(publicId); 
            } catch (error) {
                console.warn(`Advertencia: No se pudo eliminar la imagen antigua de Cloudinary (${profesor.foto}).`, error.message);
            }
        }

        await profesor.deleteOne();
        res.json({ msg: "Profesor eliminado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al eliminar profesor", msg: err.message });
    }
});


// ---------------- Editar perfil propio (CON CLOUDINARY) ----------------
router.put("/editar-perfil", authMiddleware, upload.single("foto"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { nombre, email, celular, edad, sexo } = req.body;
        let fotoUrl = null;

        // Validación simplificada
        if (!nombre || !email || !celular || !edad || !sexo)
            return res.status(400).json({ msg: "Todos los campos son obligatorios" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

        // Verificaciones de unicidad de email y celular
        if (email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) return res.status(400).json({ msg: "El correo ya está en uso" });
        }

        if (celular !== user.celular) {
            const celularExists = await User.findOne({ celular });
            if (celularExists) return res.status(400).json({ msg: "El celular ya está en uso" });
        }

        // ------------------ Lógica de Subida a Cloudinary ------------------
        if (req.file) {
            const publicId = `perfiles/user-${userId}`; 

            // 1. Convertir el Buffer del archivo a Data URI
            const b64 = Buffer.from(req.file.buffer).toString("base64");
            let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
            
            // 2. Subir a Cloudinary (la carpeta "perfiles" debe existir o Cloudinary la creará)
            const result = await cloudinary.uploader.upload(dataURI, {
                folder: "perfiles", 
                public_id: publicId, 
                overwrite: true // Reemplaza la imagen si ya existe
            });

            fotoUrl = result.secure_url; // URL de Cloudinary
        }
        // ------------------ FIN Lógica de Subida a Cloudinary ------------------

        // 3. Actualizar campos
        user.nombre = nombre;
        user.email = email;
        user.celular = celular;
        user.edad = edad;
        user.sexo = sexo;

        if (fotoUrl) {
            // Guardamos la URL de Cloudinary
            user.foto = fotoUrl; 
        }

        await user.save();
        // Excluimos la contraseña al devolver el usuario actualizado
        const userWithoutPassword = await User.findById(userId).select("-password"); 
        res.json({ msg: "Perfil actualizado correctamente", user: userWithoutPassword });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Error al actualizar perfil o subir foto", error: err.message });
    }
});

// ---------------- Obtener perfil propio ----------------
router.get("/mi-perfil", authMiddleware, async (req, res) => {
    try {
        // req.user.id viene del middleware authMiddleware/verifyToken
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Error al obtener perfil", error: err.message });
    }
});

=======
import bcrypt from "bcryptjs"; // <-- AÑADIDO: Para encriptar contraseñas
import { verifyToken, verifyAdmin } from "./auth.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// ----------------- CONFIGURACIÓN CLOUDINARY -----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "sistema-asistencia/fotos-profesores",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 300, height: 300, crop: "fill" }],
  },
});
const upload = multer({ storage });

// ----------------- HELPERS -----------------
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

// ---------------------------------------------------------------
// ---- ✅ RUTAS AÑADIDAS PARA COMPLETAR LA LÓGICA DE USUARIOS ----
// ---------------------------------------------------------------

// POST: Registrar un nuevo profesor (admin)
router.post("/registrar-profesor", verifyAdmin, upload.single("foto"), async (req, res) => {
    try {
        // 1. Obtener datos del cuerpo de la solicitud
        const { nombre, email, password, edad, sexo, celular } = req.body;

        // 2. Validar que los campos esenciales no estén vacíos
        if (!nombre || !email || !password || !celular) {
            return res.status(400).json({ msg: "Los campos nombre, email, contraseña y celular son obligatorios." });
        }

        // 3. Revisar si ya existe un usuario con ese email o celular
        const existingUser = await User.findOne({ $or: [{ email }, { celular }] });
        if (existingUser) {
            return res.status(400).json({ msg: "El email o el celular ya están registrados." });
        }

        // 4. Encriptar la contraseña antes de guardarla
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 5. Crear el nuevo usuario
        const newUser = new User({
            nombre,
            email,
            password: hashedPassword,
            edad,
            sexo,
            celular,
            role: 'profesor', // Rol fijo para esta ruta
            foto: req.file ? req.file.path : 'URL_DE_FOTO_POR_DEFECTO.png' // Asigna la URL de Cloudinary o una por defecto
        });

        // 6. Guardar el usuario en la base de datos
        await newUser.save();

        res.status(201).json({ msg: "Profesor registrado exitosamente." });

    } catch (err) {
        // 7. MANEJO DE ERRORES MEJORADO
        console.error('---- ERROR DETALLADO AL REGISTRAR PROFESOR ----');
        console.error(err); // Esto imprimirá el error completo en la consola del servidor

        // Si el guardado en la BD falla pero la foto ya se subió, la eliminamos
        if (req.file) {
            await cloudinary.uploader.destroy(req.file.filename);
        }

        res.status(500).json({ msg: "Error en el servidor al registrar al profesor", error: err.message });
    }
});

// GET: Obtener perfil propio (usuarios logueados)
router.get("/mi-perfil", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password"); // req.user.id viene del token
        if (!user) {
            return res.status(404).json({ msg: "Usuario no encontrado" });
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Error al obtener el perfil", error: err.message });
    }
});


// ----------------- RUTAS EXISTENTES -----------------

// GET: Todos los profesores (admin)
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

// PUT: Actualizar asignaturas de un profesor (admin)
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

// DELETE: Eliminar profesor (admin)
router.delete("/profesores/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const profesor = await User.findById(id);
    if (!profesor) return res.status(404).json({ msg: "Profesor no encontrado" });

    // LÓGICA CLOUDINARY: Borrar la foto de la nube
    const publicId = getCloudinaryPublicId(profesor.foto);
    if (publicId) {
        await cloudinary.uploader.destroy(publicId);
    }

    await profesor.deleteOne();
    res.json({ msg: "Profesor eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar profesor", error: err.message });
  }
});

// PUT: Editar perfil propio (usuarios logueados)
router.put("/editar-perfil", verifyToken, upload.single("foto"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, edad, email, sexo, celular } = req.body;

    if (!nombre || !edad || !email || !sexo || !celular) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    const updateData = { nombre, edad, email, sexo, celular };

    // LÓGICA CLOUDINARY: Actualizar foto
    if (req.file) {
      // Eliminar foto antigua de Cloudinary
      const publicId = getCloudinaryPublicId(user.foto);
      if (publicId) {
          await cloudinary.uploader.destroy(publicId);
      }
      // Guardar la nueva URL
      updateData.foto = req.file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) return res.status(404).json({ msg: "No se pudo actualizar el usuario" });

    res.json({ msg: "Perfil actualizado correctamente", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al editar perfil", error: err.message });
  }
});

>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
export default router;