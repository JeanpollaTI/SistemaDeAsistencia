import express from "express";
import Suggestion from "../models/Suggestion.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// POST: Enviar una sugerencia
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ msg: "El contenido es obligatorio" });

    const newSuggestion = new Suggestion({
      author_id: req.user.id,
      school_id: req.user.school_id,
      content,
    });

    await newSuggestion.save();
    res.status(201).json({ msg: "Sugerencia enviada correctamente. ¡Gracias por tu feedback!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al enviar sugerencia", error: err.message });
  }
});

export default router;
