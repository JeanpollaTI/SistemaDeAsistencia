import mongoose from 'mongoose';

const CalificacionSchema = new mongoose.Schema({
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
  },
  // Almacena el número de tareas visibles por criterio para ignorar 'ghost grades'
  numTareas: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Almacena los cortes oficiales (congelamientos) por trimestre
  cortes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  school_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true,
  }
}, {
  timestamps: true
});

// ÍNDICE COMPUESTO: Asegura que la COMBINACIÓN de 'grupo' y 'asignatura' sea única.
CalificacionSchema.index({ grupo: 1, asignatura: 1 }, { unique: true });

const Calificacion = mongoose.model("Calificacion", CalificacionSchema);

export default Calificacion;
