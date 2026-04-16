import mongoose from "mongoose";

const suggestionSchema = new mongoose.Schema(
  {
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    content: {
      type: String,
      required: [true, "El contenido de la sugerencia es obligatorio"],
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Formatear para el frontend
suggestionSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Suggestion", suggestionSchema);
