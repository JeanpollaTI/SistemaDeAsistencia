import mongoose from "mongoose";
import "dotenv/config";
import Grupo from "../models/Grupo.js";
import Counter from "../models/Counter.js";

const assignMatriculas = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected.");

        // 1. Reset Counter
        console.log("Resetting 'alumnos' counter to 0...");
        await Counter.findOneAndUpdate(
            { id: 'alumnos' },
            { seq: 0 },
            { upsert: true }
        );

        // 2. Fetch all groups sorted by name
        const grupos = await Grupo.find({}).sort({ nombre: 1 });
        console.log(`Found ${grupos.length} groups.`);

        let totalStudents = 0;
        let currentSeq = 0;

        for (const grupo of grupos) {
            console.log(`Processing group: ${grupo.nombre}...`);
            let changed = false;

            for (const alumno of grupo.alumnos) {
                currentSeq++;
                const newMatricula = currentSeq.toString().padStart(4, '0');

                // Assign or Update matricula
                alumno.matricula = newMatricula;
                changed = true;
                totalStudents++;
            }

            if (changed) {
                await grupo.save();
                console.log(`  Updated ${grupo.alumnos.length} students in ${grupo.nombre}.`);
            }
        }

        // 3. Update counter to the final value
        await Counter.findOneAndUpdate(
            { id: 'alumnos' },
            { seq: currentSeq }
        );

        console.log(`\n✅ Finished! Assigned matriculas to ${totalStudents} students.`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Error during migration:", err);
        process.exit(1);
    }
};

assignMatriculas();
