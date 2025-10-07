import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import Horario from "../models/Horario.js";
import { verifyToken, verifyAdmin } from "./auth.js";

const router = express.Router();

// Multer PDF
const storagePdf = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "uploads/pdfHorarios");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const anio = req.body.anio || "unknown";
    cb(null, `horario_${anio}_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadPdf = multer({ storage: storagePdf });

// Helper
const parseJSON = (input) => {
  if (!input) return {};
  if (typeof input === "object") return input;
  try { return JSON.parse(input); } catch { return {}; }
};

// CRUD Horario
router.post("/", verifyAdmin, uploadPdf.single("pdf"), async (req, res) => {
  try {
    const { anio, datos, leyenda } = req.body;
    if (!anio) return res.status(400).json({ msg: "Debe especificar el año" });

    let horario = await Horario.findOne({ anio }) || new Horario({ anio });
    horario.datos = parseJSON(datos);
    horario.leyenda = parseJSON(leyenda);

    if (req.file) {
      if (horario.pdfUrl) fs.existsSync(horario.pdfUrl) && fs.unlinkSync(path.join(process.cwd(), horario.pdfUrl));
      horario.pdfUrl = `/uploads/pdfHorarios/${req.file.filename}`;
    }

    await horario.save();
    res.json({ success: true, horario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:anio", verifyToken, async (req, res) => {
  try {
    const horario = await Horario.findOne({ anio: req.params.anio });
    if (!horario) return res.json({ datos: {}, leyenda: {}, pdfUrl: null });
    res.json({ datos: horario.datos, leyenda: horario.leyenda, pdfUrl: horario.pdfUrl || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const horarios = await Horario.find().select("anio pdfUrl").sort({ anio: -1 });
    res.json(horarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error obteniendo horarios", error: err.message });
  }
});

router.delete("/:anio", verifyAdmin, async (req, res) => {
  try {
    const horario = await Horario.findOne({ anio: req.params.anio });
    if (!horario) return res.status(404).json({ msg: "Horario no encontrado" });

    if (horario.pdfUrl) {
      const pdfPath = path.join(process.cwd(), horario.pdfUrl);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    }

    await Horario.deleteOne({ anio: req.params.anio });
    res.json({ msg: `Horario del año ${req.params.anio} eliminado correctamente` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error eliminando horario", error: err.message });
  }
});

export { router as horarioRouter };
