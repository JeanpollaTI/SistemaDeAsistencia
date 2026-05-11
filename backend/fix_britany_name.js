import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Grupo from './models/Grupo.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://jeanpollaromero:Sistemas1@cluster0.zps3i.mongodb.net/asistencia?retryWrites=true&w=majority';

async function fixBritanyName() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Conectado a MongoDB para corregir el nombre de Britany.");

        // Buscar en todos los grupos alumnos que tengan nombres similares a Britannia o Britania
        const grupos = await Grupo.find({
            "alumnos.nombre": { $regex: /Britan(ia|nia)/i }
        });

        console.log(`Encontrados ${grupos.length} grupos con posibles errores en el nombre.`);

        for (const grupo of grupos) {
            let modificado = false;
            grupo.alumnos.forEach(alumno => {
                if (/Britan(ia|nia)/i.test(alumno.nombre)) {
                    console.log(`Corrigiendo en grupo ${grupo.nombre}: ${alumno.nombre} -> BRITANY ANGELY`);
                    alumno.nombre = "BRITANY ANGELY";
                    modificado = true;
                }
                // También corregir el apellido si es necesario (vimos MARIN vs MARINA)
                if (alumno.apellidoMaterno && alumno.apellidoMaterno.toUpperCase() === "MARINA") {
                    console.log(`Corrigiendo apellido materno: MARINA -> MARIN`);
                    alumno.apellidoMaterno = "MARIN";
                    modificado = true;
                }
            });

            if (modificado) {
                await grupo.save();
                console.log(`Grupo ${grupo.nombre} actualizado.`);
            }
        }

        console.log("Proceso de corrección finalizado.");
        process.exit(0);
    } catch (error) {
        console.error("Error al ejecutar el script:", error);
        process.exit(1);
    }
}

fixBritanyName();
