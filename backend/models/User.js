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
<<<<<<< HEAD
    fechaRegistro: {
      type: Date,
      default: Date.now,
    },
=======
    // Quitamos 'fechaRegistro' ya que 'timestamps: true' lo maneja mejor
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
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
<<<<<<< HEAD
      default: "/uploads/fotos/default.png",
=======
      // Guarda la URL de Cloudinary o la ruta por defecto
      default: "/uploads/fotos/default.png", 
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
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
<<<<<<< HEAD
=======
      select: false, // CLAVE: No se envía en consultas Find por defecto
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
    },
    asignaturas: {
      type: [String],
      default: [],
    },
<<<<<<< HEAD
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password; // nunca mostrar password
        if (!ret.foto) ret.foto = "/uploads/fotos/default.png";
=======
    // Añadidos campos para manejar tokens de reseteo desde la DB (alternativa al objeto 'resetTokens' en memoria)
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true, // Añade createdAt y updatedAt
    toJSON: {
      transform(doc, ret) {
        // Renombramos _id a id para el frontend
        ret.id = ret._id; 
        delete ret._id;
        delete ret.__v; 
        delete ret.password; // nunca mostrar password
        // Asegura la foto por defecto si el campo es nulo
        if (!ret.foto) ret.foto = "/uploads/fotos/default.png"; 
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

<<<<<<< HEAD
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
=======
// -----------------------------------------------------

// 🔹 Método para comparar contraseñas manualmente
userSchema.methods.comparePassword = function (password) {
  // Aseguramos que la contraseña esté seleccionada para la comparación
  return bcrypt.compare(password, this.password);
};

// 🔹 Virtual para fecha legible (usando el campo createdAt que añade timestamps)
userSchema.virtual("fechaRegistroLegible").get(function () {
  const d = this.createdAt || new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
});

export default mongoose.model("User", userSchema);
>>>>>>> 703e5c5995cdad84c053490f64661dcfb8853aba
