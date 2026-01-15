import mongoose from 'mongoose';

const CalificacionSchema = new mongoose.Schema({
<<<<<<< HEAD
    // Vínculo con el grupo
    grupo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Grupo',
        required: true,
    },
    // La materia
    asignatura: {
        type: String,
        required: true,
        trim: true,
    },
    // Campo para almacenar criterios por trimestre (objeto mixto)
    criterios: {
        type: mongoose.Schema.Types.Mixed, 
        default: { 1: [], 2: [], 3: [] } 
    },
    // Objeto para almacenar calificaciones por alumno y trimestre
    calificaciones: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

=======
  // Vínculo con el grupo al que pertenecen estas calificaciones
  grupo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grupo',
    required: true,
  },
  // La materia a la que corresponden estas calificaciones. Esencial para la unicidad.
  asignatura: {
    type: String,
    required: true,
    trim: true,
  },
  // Criterios de evaluación para esta materia específica
  criterios: [{
    _id: false,
    nombre: String,
    porcentaje: Number
  }],
  // Objeto con las calificaciones detalladas que el profesor ingresa
  calificaciones: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// ÍNDICE COMPUESTO: Esta es la corrección clave.
// Asegura que la COMBINACIÓN de 'grupo' y 'asignatura' sea única.
// Esto permite múltiples documentos para el mismo grupo, siempre que la asignatura sea diferente.
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
CalificacionSchema.index({ grupo: 1, asignatura: 1 }, { unique: true });

const Calificacion = mongoose.model("Calificacion", CalificacionSchema);

<<<<<<< HEAD
// ✅ Exportación por defecto
export default Calificacion;
=======
export default Calificacion;
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
