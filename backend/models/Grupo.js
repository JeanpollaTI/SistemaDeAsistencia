import mongoose from "mongoose";

// Define un esquema para un alumno individual.
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
  emailPadre: {
    type: String,
    trim: true,
    lowercase: true,
    default: "",
  },
  telefonoPadre: {
    type: String,
    trim: true,
    default: "",
  },
  matricula: {
    type: String,
    // unique: true, // REMOVIDO: Ahora es único por escuela (se valida en la lógica si es necesario o se deja por matricula global)
    sparse: true,
    trim: true,
  }
});

// Define el esquema para una asignación (Profesor + Asignatura).
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
}, { _id: false });


// Define el esquema principal del Grupo.
const GrupoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre del grupo es obligatorio"],
      trim: true,
      // unique: true, // REMOVIDO: Ahora es único por escuela mediante índice compuesto
    },
    asesor: {
      type: String, // Nombre del asesor del grupo
      default: "",
    },
    aula: {
      type: String, // Salón o aula física
      default: "",
      trim: true
    },
    alumnos: {
      type: [AlumnoSchema], // Un array de documentos de Alumno
      default: [],
    },
    profesoresAsignados: {
      type: [AsignacionSchema], // Un array de documentos de Asignacion
      default: [],
    },
    ordenMaterias: {
      type: [String], // Array de nombres de materias en orden
      default: [],
    },
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },

    // --- IMPORTANTE ---
    // Los campos 'criterios' y 'calificaciones' han sido eliminados de este modelo.
    // Ahora residen en el nuevo modelo 'Calificacion'.
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
  }
);
// Índice compuesto: Nombre de grupo único POR escuela
GrupoSchema.index({ nombre: 1, school_id: 1 }, { unique: true });

const Grupo = mongoose.model("Grupo", GrupoSchema);
export default Grupo;
