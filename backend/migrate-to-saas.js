import mongoose from "mongoose";
import dotenv from "dotenv";
import School from "./models/School.js";
import User from "./models/User.js";
import Grupo from "./models/Grupo.js";
import Calificacion from "./models/Calificacion.js";
import Asistencia from "./models/Asistencia.js";
import Horario from "./models/Horario.js";
import Materia from "./models/Materia.js";

dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for migration...");

        // 1. Create the initial school
        let school = await School.findOne({ name: "Secundaria General Número 9" });
        if (!school) {
            school = new School({
                name: "Secundaria General Número 9",
                type: "Secundaria",
                evaluationPeriod: "Trimestre", // Default for many Mexican schools
                config: {
                    scaleMax: 10
                }
            });
            await school.save();
            console.log("Created school: Secundaria General Número 9");
        } else {
            console.log("School already exists.");
        }

        const schoolId = school._id;

        // 2. Update all existing records with the new schoolId
        console.log("Updating Users...");
        await User.updateMany({ school_id: { $exists: false } }, { $set: { school_id: schoolId } });

        console.log("Updating Grupos...");
        await Grupo.updateMany({ school_id: { $exists: false } }, { $set: { school_id: schoolId } });

        console.log("Updating Calificaciones...");
        await Calificacion.updateMany({ school_id: { $exists: false } }, { $set: { school_id: schoolId } });

        console.log("Updating Asistencias...");
        await Asistencia.updateMany({ school_id: { $exists: false } }, { $set: { school_id: schoolId } });

        console.log("Updating Horarios...");
        await Horario.updateMany({ school_id: { $exists: false } }, { $set: { school_id: schoolId } });

        console.log("Updating Materias...");
        await Materia.updateMany({ school_id: { $exists: false } }, { $set: { school_id: schoolId } });

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
};

migrate();
