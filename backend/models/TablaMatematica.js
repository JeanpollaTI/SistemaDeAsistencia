import mongoose from "mongoose";

const evaluacionSchema = new mongoose.Schema({
    alumno_id: { type: String, required: true },
    alumnoNombre: { type: String, required: true },
    puntaje: { type: Number, default: 0, min: 0, max: 10 },
    observacion: { type: String, default: "" },
    fecha: { type: Date, default: Date.now }
});

const tablaMatematicaSchema = new mongoose.Schema(
    {
        school_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
        },
        grupoNombre: {
            type: String,
            required: true,
            trim: true,
        },
        evaluador_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        evaluaciones: [evaluacionSchema],
    },
    {
        timestamps: true,
    }
);

tablaMatematicaSchema.index({ school_id: 1, grupoNombre: 1 }, { unique: true });

export default mongoose.model("TablaMatematica", tablaMatematicaSchema);
