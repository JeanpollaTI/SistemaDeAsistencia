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
    // Este campo ahora almacenará la URL web pública de la imagen o el PDF generado.
    imageUrl: { 
      type: String,
      default: null, // URL de la imagen del horario (Almacena la URL de Cloudinary)
    },
  },
  { 
    timestamps: true, // Añade createdAt y updatedAt
    toJSON: { virtuals: true }, // Asegura que los virtuales se incluyan en la respuesta JSON
    toObject: { virtuals: true }
  }
);

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