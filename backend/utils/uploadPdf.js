import multer from "multer";
import fs from "fs";
import path from "path";

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

export const uploadPdf = multer({ storage: storagePdf });
