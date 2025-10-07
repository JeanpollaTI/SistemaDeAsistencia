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
    pdfUrl: {
      type: String,
      default: null, // URL del PDF del horario
    },
  },
  { timestamps: true } // createdAt y updatedAt automáticos
);

// 🔹 Virtual opcional: fecha de creación legible
HorarioSchema.virtual("fechaCreacionLegible").get(function () {
  const d = this.createdAt;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
});

// 🔹 Exportar modelo
const Horario = mongoose.model("Horario", HorarioSchema);
export default Horario;
