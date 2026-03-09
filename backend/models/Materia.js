import mongoose from "mongoose";

const materiaSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    school_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
        index: true,
    }
});

// Materia única por escuela
materiaSchema.index({ nombre: 1, school_id: 1 }, { unique: true });

const Materia = mongoose.model("Materia", materiaSchema);
export default Materia;
