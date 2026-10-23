import mongoose from "mongoose";

export const GRUPOS_REFLEXION_SERENA = [
  "1° A", "1° B", "1° C", "1° D", "1° E",
  "2° A", "2° B", "2° C", "2° D", "2° E",
  "3° A", "3° B", "3° C", "3° D", "3° E"
];

export const MESES_CICLO_ESCOLAR = [
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio"
];

const reflexionSerenaSchema = new mongoose.Schema(
  {
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    grupo: {
      type: String,
      required: [true, "El grupo es obligatorio"],
      enum: GRUPOS_REFLEXION_SERENA,
      trim: true,
    },
    semana: {
      type: Number,
      required: [true, "La semana es obligatoria (1 a 40)"],
      min: [1, "La semana mínima es 1"],
      max: [40, "La semana máxima es 40"],
    },
    mes: {
      type: String,
      required: [true, "El mes es obligatorio"],
      enum: MESES_CICLO_ESCOLAR,
      trim: true,
    },
    porcentaje: {
      type: Number,
      required: [true, "El porcentaje de cumplimiento es obligatorio"],
      min: [0, "El porcentaje mínimo es 0"],
      max: [100, "El porcentaje máximo es 100"],
    },
    cicloEscolar: {
      type: String,
      required: true,
      default: "2025-2026",
      trim: true,
    },
    registradoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    registradoPorNombre: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índice único por escuela, ciclo escolar, semana y grupo para captura masiva (upsert)
reflexionSerenaSchema.index(
  { school_id: 1, cicloEscolar: 1, semana: 1, grupo: 1 },
  { unique: true }
);

export default mongoose.model("ReflexionSerena", reflexionSerenaSchema);
