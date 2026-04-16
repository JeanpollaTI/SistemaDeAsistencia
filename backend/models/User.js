import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
    },
    edad: {
      type: Number,
      min: [18, "La edad mínima es 18"],
    },
    sexo: {
      type: String,
      enum: ["Masculino", "Femenino", "Otro"],
    },
    celular: {
      type: String,
      trim: true,
      // unique: true, // REMOVIDO: Ahora es único por escuela mediante índice compuesto
      sparse: true,
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
      // Guarda la URL de Cloudinary o la ruta por defecto
      default: "/uploads/fotos/default.png",
    },
    role: {
      type: String,
      enum: ["admin", "profesor", "padre", "superadmin"],
      default: "profesor",
    },
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: function() { return this.role !== 'superadmin'; },
      index: true,
    },
    // Solo para el rol 'padre'
    student_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // En este sistema, los alumnos no son modelos separados por ahora, pero el requerimiento pide vincularlos. 
        // Nota: El diseño actual tiene alumnos dentro de Grupo.js. 
        // Si el usuario confirma, podríamos necesitar un modelo Student o usar IDs de alumnos dentro de grupos.
      },
    ],
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: [6, "La contraseña debe tener al menos 6 caracteres"],
      select: false, // CLAVE: No se envía en consultas Find por defecto
    },
    asignaturas: {
      type: [String],
      default: [],
    },
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
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

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

// Índice compuesto: Celular único POR escuela (opcional, si se prefiere)
userSchema.index({ celular: 1, school_id: 1 }, { unique: true, sparse: true });

export default mongoose.model("User", userSchema);
