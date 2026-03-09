import mongoose from "mongoose";

const HorarioSchema = new mongoose.Schema(
  {
    anio: {
      type: String,
      required: [true, "El año es obligatorio"],
      unique: true, // solo un horario por año
      trim: true,
    },
    datos: {
      type: Object,
      default: {}, // guarda toda la información del horario
      required: [true, "Los datos del horario son obligatorios"],
    },
    leyenda: {
      type: Object,
      default: {}, // colores o descripciones de asignaturas
    },
    // CORRECCIÓN CLAVE: Cambiamos pdfUrl a imageUrl para consistencia
    imageUrl: {
      type: String,
      default: null, // URL de la imagen del horario (Almacena la URL de Cloudinary)
    },
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
  },
  { timestamps: true } // createdAt y updatedAt automáticos
);

// ÍNDICE COMPUESTO: Un horario por año por escuela
HorarioSchema.index({ anio: 1, school_id: 1 }, { unique: true });

// 🔹 Virtual opcional: fecha de creación legible
HorarioSchema.virtual("fechaCreacionLegible").get(function () {
  const d = this.createdAt;
  // Aseguramos que la fecha exista antes de intentar formatearla
  if (!d) return "N/A";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
});

// 🔹 Exportar modelo
const Horario = mongoose.model("Horario", HorarioSchema);
export default Horario;
