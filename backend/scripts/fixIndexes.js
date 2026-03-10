import mongoose from 'mongoose';
import 'dotenv/config';

const fixIndexes = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected.");

        const db = mongoose.connection.db;
        const collection = db.collection('users');

        console.log("Checking indexes for 'users' collection...");
        const indexes = await collection.indexes();
        console.log("Current indexes:", indexes.map(idx => idx.name));

        if (indexes.some(idx => idx.name === 'celular_1')) {
            console.log("Dropping 'celular_1' index...");
            await collection.dropIndex('celular_1');
            console.log("✅ Index dropped successfully.");
        } else {
            console.log("ℹ️ Index 'celular_1' not found. Nothing to do.");
        }

        console.log("Mongoose will recreate the index with 'sparse: true' on next startup.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error fixing indexes:", err);
        process.exit(1);
    }
};

fixIndexes();
