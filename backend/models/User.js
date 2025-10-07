import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // útil para comparar contraseñas manualmente

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
    },
    edad: {
      type: Number,
      required: [true, "La edad es obligatoria"],
      min: [18, "La edad mínima es 18"],
    },
    fechaRegistro: {
      type: Date,
      default: Date.now,
    },
    sexo: {
      type: String,
      enum: ["Masculino", "Femenino", "Otro"],
      required: [true, "El sexo es obligatorio"],
    },
    celular: {
      type: String,
      required: [true, "El celular es obligatorio"],
      trim: true,
      unique: true,
      match: [/^\d+$/, "El celular debe contener solo dígitos"],
    },
    email: {
      type: String,
      required: [true, "El email es obligatorio"],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        "Por favor ingresa un email válido",
      ],
      unique: true,
    },
    foto: {
      type: String,
      default: "/uploads/fotos/default.png",
    },
    role: {
      type: String,
      enum: ["admin", "profesor"],
      default: "profesor",
    },
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: [6, "La contraseña debe tener al menos 6 caracteres"],
    },
    asignaturas: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password; // nunca mostrar password
        if (!ret.foto) ret.foto = "/uploads/fotos/default.png";
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// 🔹 Método para comparar contraseñas manualmente
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

// 🔹 Virtual para fecha legible
userSchema.virtual("fechaRegistroLegible").get(function () {
  const d = this.fechaRegistro || this.createdAt;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
});

// 🔹 ❌ Middleware de hash eliminado, hash debe hacerse manual al crear/actualizar password

export default mongoose.model("User", userSchema);
