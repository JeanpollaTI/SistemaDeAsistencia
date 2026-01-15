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
<<<<<<< HEAD
    pdfUrl: {
      type: String,
      default: null, // URL del PDF del horario
=======
    // CORRECCIÓN CLAVE: Cambiamos pdfUrl a imageUrl para consistencia
    imageUrl: { 
      type: String,
      default: null, // URL de la imagen del horario (Almacena la URL de Cloudinary)
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
    },
  },
  { timestamps: true } // createdAt y updatedAt automáticos
);

// 🔹 Virtual opcional: fecha de creación legible
HorarioSchema.virtual("fechaCreacionLegible").get(function () {
  const d = this.createdAt;
<<<<<<< HEAD
=======
  // Aseguramos que la fecha exista antes de intentar formatearla
  if (!d) return "N/A";
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
});

// 🔹 Exportar modelo
const Horario = mongoose.model("Horario", HorarioSchema);
<<<<<<< HEAD
export default Horario;
=======
export default Horario;
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
