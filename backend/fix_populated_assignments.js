import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Grupo from './models/Grupo.js';

dotenv.config({ path: './backend/.env' });

const fixAssignments = async () => {
    try {
        console.log("Conectando a la base de datos...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Conexión exitosa.");

        const grupos = await Grupo.find({});
        console.log(`Analizando ${grupos.length} grupos...`);

        let fixCount = 0;

        for (const grupo of grupos) {
            let hasChanges = false;
            
            const nuevasAsignaciones = grupo.profesoresAsignados.map(asig => {
                // Si el profesor es un objeto (tiene _id o id), lo aplanamos
                const rawId = asig.profesor?._id || asig.profesor?.id || asig.profesor;
                
                if (rawId && typeof asig.profesor === 'object' && !mongoose.Types.ObjectId.isValid(asig.profesor)) {
                    console.log(`[FIX] Aplanando profesor en grupo ${grupo.nombre}: ${rawId}`);
                    hasChanges = true;
                    return {
                        ...asig,
                        profesor: new mongoose.Types.ObjectId(String(rawId))
                    };
                }
                return asig;
            });

            if (hasChanges) {
                grupo.profesoresAsignados = nuevasAsignaciones;
                await grupo.save();
                fixCount++;
            }
        }

        console.log(`Reparación completada. Grupos corregidos: ${fixCount}`);
        await mongoose.disconnect();
    } catch (err) {
        console.error("Error durante la reparación:", err);
    }
};

fixAssignments();
