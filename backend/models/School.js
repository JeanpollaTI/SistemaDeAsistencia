import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "El nombre de la escuela es obligatorio"],
            trim: true,
        },
        type: {
            type: String,
            enum: ["Primaria", "Secundaria", "Preparatoria", "Universidad", "Academia"],
            required: [true, "El tipo de institución es obligatorio"],
        },
        config: {
            logoUrl: { type: String, default: "" },
            primaryColor: { type: String, default: "#1a73e8" },
            scaleMax: { type: Number, enum: [10, 100], default: 10 },
        },
        evaluationPeriod: {
            type: String,
            enum: ["Bimestre", "Trimestre", "Cuatrimestre", "Semestre"],
            required: [true, "El periodo de evaluación es obligatorio"],
        },
        subscription: {
            status: {
                type: String,
                enum: ["active", "suspended"],
                default: "active",
            },
            stripeId: { type: String, default: "" },
            currentPeriodEnd: { type: Date },
            nextBilling: { type: Date },
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("School", schoolSchema);
