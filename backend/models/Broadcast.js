import mongoose from "mongoose";

const broadcastSchema = new mongoose.Schema(
  {
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: [true, "El mensaje del comunicado es obligatorio"],
    },
    type: {
      type: String,
      enum: ["info", "success", "warning", "update"],
      default: "update",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
    },
  },
  {
    timestamps: true,
  }
);

broadcastSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Broadcast", broadcastSchema);
