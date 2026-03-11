import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde el nivel superior (backend/)
dotenv.config({ path: path.join(__dirname, '../.env') });

const fixIndexes = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected.");

        const db = mongoose.connection.db;

        const cleanup = async (collectionName, indexName) => {
            const collection = db.collection(collectionName);
            const indexes = await collection.indexes();
            if (indexes.some(idx => idx.name === indexName)) {
                console.log(`Dropping '${indexName}' from '${collectionName}'...`);
                await collection.dropIndex(indexName);
                console.log(`✅ Index dropped from ${collectionName}.`);
            } else {
                console.log(`ℹ️ Index '${indexName}' not found in ${collectionName}.`);
            }
        };

        // Cleanup problematic global indexes
        await cleanup('users', 'celular_1');
        await cleanup('grupos', 'nombre_1');
        await cleanup('materias', 'nombre_1');

        console.log("\nCleanup finished. Compound indexes defined in schemas will be created on server restart.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error fixing indexes:", err);
        process.exit(1);
    }
};

fixIndexes();
