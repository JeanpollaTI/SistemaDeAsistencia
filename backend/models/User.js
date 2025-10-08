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
    // Guarda la URL de Cloudinary o la ruta por defecto
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
      select: false, // CRUCIAL para seguridad: no se devuelve por defecto
    },
    asignaturas: {
      type: [String],
      default: [],
    },
    // Campos para manejar la recuperación de contraseña
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true, // Añade createdAt y updatedAt
    toJSON: {
      transform(doc, ret) {
        // Limpieza de datos antes de enviar al frontend
        ret.id = ret._id; 
        delete ret._id;
        delete ret.__v; 
        delete ret.password; 
        if (!ret.foto) ret.foto = "/uploads/fotos/default.png"; 
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// -----------------------------------------------------

// 🔹 Método para comparar contraseñas manualmente
userSchema.methods.comparePassword = function (password) {
  // Aseguramos que la contraseña esté seleccionada para la comparación
  return bcrypt.compare(password, this.password);
};

// 🔹 Virtual para fecha legible
userSchema.virtual("fechaRegistroLegible").get(function () {
  const d = this.createdAt || new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
});

export default mongoose.model("User", userSchema);