import mongoose from "mongoose";

const evaluacionSchema = new mongoose.Schema({
    alumno_id: { type: String, required: true },
    alumnoNombre: { type: String, required: true },
    // Matrix storage: p1..p7 (t1..t10)
    // Values: "Incompleta" | "En orden" | "Salteadas" | ""
    registros: {
        type: Map,
        of: String,
        default: {}
    },
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
        evaluadores: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        cortesConfig: {
            type: Map,
            of: String,
            default: {
                p1: "1-5",
                p2: "1-5",
                p3: "1-5",
                p4: "1-5",
                p5: "6-10",
                p6: "6-10",
                p7: "6-10"
            }
        },
        evaluaciones: [evaluacionSchema],
    },
    {
        timestamps: true,
    }
);

tablaMatematicaSchema.index({ school_id: 1, grupoNombre: 1 }, { unique: true });

export default mongoose.model("TablaMatematica", tablaMatematicaSchema);
