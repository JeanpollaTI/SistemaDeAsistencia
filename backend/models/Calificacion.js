import mongoose from 'mongoose';

const CalificacionSchema = new mongoose.Schema({
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
CalificacionSchema.index({ grupo: 1, asignatura: 1 }, { unique: true });

const Calificacion = mongoose.model("Calificacion", CalificacionSchema);

export default Calificacion;
