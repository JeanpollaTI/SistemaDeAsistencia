import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function discoverData() {
    try {
        const uri = process.env.MONGO_URI;
        const conn = await mongoose.connect(uri);
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();

        console.log('Available Databases:', dbs.databases.map(d => d.name));

        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            if (['admin', 'local', 'config'].includes(dbName)) continue;

            console.log(`\n--- Inspecting Database: ${dbName} ---`);
            const db = conn.connection.useDb(dbName);
            const collections = await db.db.listCollections().toArray();

            for (const coll of collections) {
                const count = await db.collection(coll.name).countDocuments();
                if (count > 0) {
                    console.log(`Collection: ${coll.name} - Documents: ${count}`);
                    // Sample one document to see the structure if it's potentially student data
                    if (coll.name.toLowerCase().includes('alum') || coll.name.toLowerCase().includes('estudio') || coll.name.toLowerCase().includes('calif')) {
                        const sample = await db.collection(coll.name).findOne();
                        console.log(`Sample from ${coll.name}:`, JSON.stringify(sample, null, 2).substring(0, 500) + '...');
                    }
                }
            }
        }

    } catch (err) {
        console.error('Discovery Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

discoverData();
