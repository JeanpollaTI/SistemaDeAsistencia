import mongoose from "mongoose";

// Define un esquema para un único registro de asistencia.
const AsistenciaRegistroSchema = new mongoose.Schema({
  estado: { type: String, required: true }, // 'P' o 'F'
  fecha: { type: String, required: true },  // 'dd/Mmm/yyyy'
}, {_id: false});

// Define el esquema principal para un registro de Asistencia
// que vincula a un profesor, un grupo y una asignatura.
const AsistenciaSchema = new mongoose.Schema({
  grupo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grupo',
    required: true,
  },
  profesor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  asignatura: {
    type: String,
    required: true,
    trim: true,
  },
  // Usamos un tipo 'Map' para guardar los registros de asistencia.
  // La clave será 'alumnoId-b1-d1' y el valor será { estado, fecha }
  registros: {
    type: Map,
    of: AsistenciaRegistroSchema,
    default: {},
  },
  // También guardamos el número de días por bimestre para esta clase
  diasPorBimestre: {
    type: Map,
    of: Number,
    default: {},
  }
}, { timestamps: true });

// Este índice asegura que no pueda haber dos listas de asistencia duplicadas
// para el mismo grupo, profesor y asignatura.
AsistenciaSchema.index({ grupo: 1, profesor: 1, asignatura: 1 }, { unique: true });

const Asistencia = mongoose.model("Asistencia", AsistenciaSchema);
export default Asistencia;

