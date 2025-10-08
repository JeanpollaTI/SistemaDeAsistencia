import mongoose from "mongoose";

// Define un esquema para un alumno individual.
// Mongoose generará un _id único para cada alumno.
const AlumnoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, "El nombre del alumno es obligatorio"],
    trim: true,
  },
  apellidoPaterno: {
    type: String,
    required: [true, "El apellido paterno es obligatorio"],
    trim: true,
  },
  apellidoMaterno: {
    type: String,
    trim: true,
    default: "",
  },
});

// Define el esquema para una asignación (Profesor + Asignatura).
// El _id: false es clave para que no cree un ID redundante para cada asignación.
const AsignacionSchema = new mongoose.Schema({
  profesor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Referencia al modelo de Usuario
    required: true,
  },
  asignatura: {
    type: String,
    required: [true, "La asignatura es obligatoria en la asignación"],
    trim: true,
  }
}, {_id: false});


// Define el esquema principal del Grupo.
const GrupoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre del grupo es obligatorio"],
      trim: true,
      unique: true,
    },
    alumnos: {
      type: [AlumnoSchema], // Un array de documentos de Alumno
      default: [],
    },
    profesoresAsignados: {
      type: [AsignacionSchema], // Un array de documentos de Asignacion
      default: [],
    },
    
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
    // Agregamos toJSON y toObject para asegurarnos de que el frontend obtenga los virtuales si existen
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true }
  }
);

const Grupo = mongoose.model("Grupo", GrupoSchema);
export default Grupo;