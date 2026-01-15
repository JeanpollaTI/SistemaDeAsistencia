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
<<<<<<< HEAD
}, { _id: false });
=======
}, {_id: false});
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba


// Define el esquema principal del Grupo.
const GrupoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre del grupo es obligatorio"],
      trim: true,
      unique: true,
    },
<<<<<<< HEAD
    asesor: {
      type: String, // Nombre del asesor del grupo
      default: "",
    },
=======
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
    alumnos: {
      type: [AlumnoSchema], // Un array de documentos de Alumno
      default: [],
    },
    profesoresAsignados: {
      type: [AsignacionSchema], // Un array de documentos de Asignacion
      default: [],
    },
<<<<<<< HEAD
    ordenMaterias: {
      type: [String], // Array de nombres de materias en orden
      default: [],
    },
=======
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba

    // --- IMPORTANTE ---
    // Los campos 'criterios' y 'calificaciones' han sido eliminados de este modelo.
    // Ahora residen en el nuevo modelo 'Calificacion' para permitir que cada
    // profesor tenga su propio registro de calificaciones por materia.
<<<<<<< HEAD

=======
    
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
  }
);

const Grupo = mongoose.model("Grupo", GrupoSchema);
export default Grupo;
