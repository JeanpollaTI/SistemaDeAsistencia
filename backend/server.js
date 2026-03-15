import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url"; // Necesario para __dirname en ES Modules

// Rutas (usando named exports)
import { authRouter } from "./routes/auth.js";
import { horarioRouter } from "./routes/horario.js";
import { profesoresRouter } from "./routes/profesores.js";
import { gruposRouter } from "./routes/grupos.js";
import { asistenciaRouter } from "./routes/asistencia.js";
import { calificacionesRouter } from "./routes/calificaciones.js";
// <-- AÑADIDO: Importar la nueva ruta para enviar correos -->
import { emailRouter } from "./routes/emailSender.js";
import { materiasRouter } from "./routes/materias.js";
import registrationRouter from "./routes/registration.js";
import stripeRouter from "./routes/stripe.js";
import parentPortalRouter from "./routes/parentPortal.js";
import { schoolMiddleware } from "./middlewares/schoolMiddleware.js";

// --- CONFIGURACIÓN INICIAL ---
const app = express();

// Configuración para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------- MIDDLEWARE -----------------
// Habilita Cross-Origin Resource Sharing para permitir peticiones desde el frontend
app.use(cors());
// Parsea los cuerpos de las peticiones entrantes con formato JSON
// <-- CAMBIO: Se aumenta el límite para aceptar el PDF en formato base64 -->
app.use(express.json({ limit: '10mb' }));
// Parsea los cuerpos de las peticiones entrantes con formato URL-encoded
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (fotos de perfil, etc.) desde la carpeta 'uploads'
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ----------------- RUTAS DE LA API -----------------

app.use("/auth", authRouter);
app.use("/horario", horarioRouter); // Los filtros ya se agregaron en las rutas, pero podríamos ponerlo aquí si todas requieren suscripción activa
app.use("/profesores", profesoresRouter);
app.use("/grupos", gruposRouter);
app.use("/asistencia", asistenciaRouter);
app.use("/calificaciones", calificacionesRouter);
// <-- AÑADIDO: Rutas de Escuelas -->
import schoolRoutes from "./routes/schools.js";
app.use("/schools", schoolRoutes);
app.use("/api/register-school", registrationRouter);
app.use("/api/stripe", stripeRouter);
// <-- AÑADIDO: Usar la nueva ruta para el envío de boletas -->
app.use("/api/materias", materiasRouter);
app.use("/api/portal-padres", parentPortalRouter);
import { authMiddleware } from "./middlewares/authMiddleware.js";
// Esta ruta es genérica para /api y aplica el schoolMiddleware, debe ir después de rutas específicas
app.use("/api", authMiddleware, schoolMiddleware, emailRouter);

// ----------------- MANEJO DE ERRORES -----------------
// Middleware para rutas no encontradas (404 Fallback)
app.use((req, res, next) => {
  res.status(404).json({ msg: "Ruta no encontrada" });
});

// Middleware para manejo de errores globales del servidor
app.use((err, req, res, next) => {
  console.error("Ha ocurrido un error no controlado:", err.stack);
  res.status(500).json({ error: "Ha ocurrido un error interno en el servidor." });
});

// ----------------- CONEXIÓN A MONGODB -----------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado exitosamente"))
  .catch((err) => {
    console.error("❌ Error de conexión con MongoDB:", err);
    process.exit(1); // Detiene la aplicación si no se puede conectar a la BD
  });

// ----------------- INICIO DEL SERVIDOR -----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

export default app;
