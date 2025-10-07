// --- IMPORTACIÓN DE MÓDULOS ---
// Usamos 'import' gracias a "type": "module" en package.json
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url"; // Necesario para __dirname en ES Modules

// --- IMPORTACIÓN DE RUTAS ---
// Se asume que cada archivo de ruta exporta su router correctamente
import { authRouter } from "./routes/auth.js";
import { horarioRouter } from "./routes/horario.js";
import { profesoresRouter } from "./routes/profesores.js";
import { gruposRouter } from "./routes/grupos.js";
import { asistenciaRouter } from "./routes/asistencia.js";
import { calificacionesRouter } from "./routes/calificaciones.js";
import { emailRouter } from "./routes/emailSender.js";

// --- CONFIGURACIÓN INICIAL ---
dotenv.config(); // Carga las variables de entorno desde el archivo .env
const app = express();

// Configuración para obtener la ruta del directorio actual (__dirname) en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------- MIDDLEWARE (CÓDIGO QUE SE EJECUTA ANTES DE LAS RUTAS) -----------------

// 1. Habilita Cross-Origin Resource Sharing para permitir peticiones desde otros dominios (tu frontend)
app.use(cors());

// 2. Parsea (interpreta) los cuerpos de las peticiones entrantes con formato JSON
// Se aumenta el límite a 10mb para poder recibir archivos grandes como PDFs en base64
app.use(express.json({ limit: '10mb' }));

// 3. Parsea los cuerpos con formato URL-encoded (típicamente de formularios)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Sirve archivos estáticos (imágenes, CSS, etc.) desde una carpeta pública.
// En este caso, las fotos de perfil se podrán acceder desde la URL /uploads/nombre-del-archivo.jpg
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ----------------- RUTAS DE LA API (ENDPOINTS) -----------------
// Asocia cada ruta base con su respectivo router
app.use("/auth", authRouter);
app.use("/horario", horarioRouter);
app.use("/profesores", profesoresRouter);
app.use("/grupos", gruposRouter);
app.use("/asistencia", asistenciaRouter);
app.use("/calificaciones", calificacionesRouter);
app.use("/api", emailRouter); // Ruta para el envío de correos/boletas

// ----------------- MANEJO DE ERRORES -----------------

// Middleware para rutas no encontradas (Error 404)
// Si ninguna de las rutas anteriores coincide, se ejecutará este middleware
app.use((req, res, next) => {
  res.status(404).json({ msg: "Ruta no encontrada. Por favor, verifica la URL." });
});

// Middleware para manejo de errores globales del servidor (Error 500)
// Si ocurre un error en cualquier parte del servidor, este lo atrapará
app.use((err, req, res, next) => {
  console.error("Ha ocurrido un error no controlado:", err.stack);
  res.status(500).json({ error: "Error interno en el servidor. Inténtalo de nuevo más tarde." });
});

// ----------------- CONEXIÓN A LA BASE DE DATOS (MONGODB) -----------------
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ Error: La variable de entorno MONGO_URI no está definida.");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado exitosamente"))
  .catch((err) => {
    console.error("❌ Error de conexión con MongoDB:", err);
    process.exit(1); // Detiene la aplicación si no se puede conectar a la BD
  });

// ----------------- INICIO DEL SERVIDOR -----------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`   Acceso local: http://localhost:${PORT}`);
});

// Exportar la app puede ser útil para testing, pero no es necesario para iniciar el servidor
export default app;
