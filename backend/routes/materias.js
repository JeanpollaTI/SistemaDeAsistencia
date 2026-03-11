import express from "express";
import Materia from "../models/Materia.js";
import User from "../models/User.js";
import Grupo from "../models/Grupo.js"; // Importar modelo Grupo para actualizaciones en cascada
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware.js";
import { schoolMiddleware } from "../middlewares/schoolMiddleware.js";

const materiasRouter = express.Router();

// GET all materias
materiasRouter.get("/", authMiddleware, schoolMiddleware, async (req, res) => {
    try {
        const school_id = req.user.school_id;

        // Si no hay materias para ESTA escuela, poblamos con las de por defecto
        const count = await Materia.countDocuments({ school_id });
        if (count === 0) {
            const defaultMaterias = [
                "ESPAÑOL I", "ESPAÑOL II", "ESPAÑOL III", "INGLES I", "INGLES II", "INGLES III", "ARTES I", "ARTES II", "ARTES III",
                "MATEMATICAS I", "MATEMATICAS II", "MATEMATICAS III", "BIOLOGIA I", "FISICA II", "QUIMICA III", "GEOGRAFIA I",
                "HISTORIA I", "HISTORIA II", "HISTORIA III", "FORMACION CIVICA Y ETICA I", "FORMACION CIVICA Y ETICA II", "FORMACION CIVICA Y ETICA III",
                "TECNOLOGIA", "EDUCACION FISICA I", "EDUCACION FISICA II", "EDUCACION FISICA III",
                "INTEGRACION CURRICULAR I", "INTEGRACION CURRICULAR II", "INTEGRACION CURRICULAR III",
                "TUTORIA I", "TUTORIA II", "TUTORIA III"
            ];

            // Usamos un bucle para insertar una por una y evitar que falle toda la operación
            for (const nombre of defaultMaterias) {
                try {
                    await Materia.findOneAndUpdate(
                        { nombre, school_id },
                        { nombre, school_id },
                        { upsert: true }
                    );
                } catch (e) {
                    console.warn(`No se pudo crear/verificar materia ${nombre}: ${e.message}`);
                    // Si el error es 11000 y el índice es nombre_1, intentamos borrarlo de nuevo
                    if (e.code === 11000 && e.message.includes("nombre_1")) {
                        await Materia.collection.dropIndex("nombre_1").catch(() => { });
                    }
                }
            }
        }

        const materias = await Materia.find({ school_id }).sort({ nombre: 1 });
        res.json(materias);
    } catch (error) {
        console.error("Error al obtener materias:", error);
        res.status(500).json({ error: "Error al obtener materias", details: error.message });
    }
});

// POST new materia (admin only)
materiasRouter.post("/", authMiddleware, isAdmin, schoolMiddleware, async (req, res) => {
    try {
        const { nombre } = req.body;
        const school_id = req.user.school_id;
        if (!nombre) return res.status(400).json({ error: "Nombre es requerido" });

        const nuevaMateria = new Materia({ nombre, school_id });
        await nuevaMateria.save();
        res.status(201).json(nuevaMateria);
    } catch (error) {
        console.error("Error al crear materia:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "La materia ya existe" });
        }
        res.status(500).json({ error: "Error al crear materia", details: error.message });
    }
});

// PUT update materia (admin only) - CASCADING UPDATE
materiasRouter.put("/:id", authMiddleware, isAdmin, schoolMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body; // Nuevo nombre
        const school_id = req.user.school_id;

        if (!nombre) return res.status(400).json({ error: "Nombre es requerido" });

        const materia = await Materia.findOne({ _id: id, school_id });
        if (!materia) return res.status(404).json({ error: "Materia no encontrada" });

        const oldName = materia.nombre;

        // Actualizar el nombre en la colección de Materias
        materia.nombre = nombre;
        await materia.save();

        // Actualizar el nombre en todos los usuarios (profesores) que tengan esta materia asignada
        await User.updateMany(
            { asignaturas: oldName, school_id },
            { $set: { "asignaturas.$": nombre } }
        );

        // Actualizar el nombre en GRUPOS (profesoresAsignados)
        await Grupo.updateMany(
            { "profesoresAsignados.asignatura": oldName, school_id },
            { $set: { "profesoresAsignados.$.asignatura": nombre } }
        );
        // Actualizar el nombre en GRUPOS (ordenMaterias)
        await Grupo.updateMany(
            { ordenMaterias: oldName, school_id },
            { $set: { "ordenMaterias.$": nombre } }
        );

        res.json({ msg: "Materia actualizada correctamente y sincronizada con profesores", materia });
    } catch (error) {
        console.error("Error al actualizar materia:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "Ya existe una materia con ese nombre" });
        }
        res.status(500).json({ error: "Error al actualizar materia" });
    }
});

// DELETE materia (admin only) - CASCADING DELETE
materiasRouter.delete("/:id", authMiddleware, isAdmin, schoolMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const school_id = req.user.school_id;

        const materia = await Materia.findOne({ _id: id, school_id });
        if (!materia) return res.status(404).json({ error: "Materia no encontrada" });

        const materiaName = materia.nombre;

        // Eliminamos la materia de la colección principal
        await Materia.findOneAndDelete({ _id: id, school_id });

        // Eliminamos la materia de los arrays 'asignaturas' de todos los profesores
        await User.updateMany(
            { asignaturas: materiaName, school_id },
            { $pull: { asignaturas: materiaName } }
        );

        // Eliminamos la materia de las asignaciones de todos los GRUPOS y del ordenMaterias
        await Grupo.updateMany(
            { "profesoresAsignados.asignatura": materiaName, school_id },
            { $pull: { profesoresAsignados: { asignatura: materiaName } } }
        );
        // También quitamos del ordenMaterias si existe
        await Grupo.updateMany(
            { ordenMaterias: materiaName, school_id },
            { $pull: { ordenMaterias: materiaName } }
        );

        res.json({ msg: "Materia eliminada y desasignada de todos los profesores" });
    } catch (error) {
        console.error("Error al eliminar materia:", error);
        res.status(500).json({ error: "Error al eliminar materia" });
    }
});

// DEBUG: Listar índices (solo para diagnóstico)
materiasRouter.get("/debug/indexes", async (req, res) => {
    try {
        const Materia = mongoose.model("Materia");
        const Grupo = mongoose.model("Grupo");
        const User = mongoose.model("User");

        const indexes = {
            materias: await Materia.collection.indexes(),
            grupos: await Grupo.collection.indexes(),
            usuarios: await User.collection.indexes()
        };
        res.json(indexes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export { materiasRouter };
