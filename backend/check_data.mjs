import mongoose from 'mongoose';
import User from './backend/models/User.js';
import School from './backend/models/School.js';
import Materia from './backend/models/Materia.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI not found');
    process.exit(1);
}

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const school = await School.findOne({ name: { $regex: /My Hero/i } });
        if (!school) {
            console.log('School "My Hero" not found');
        } else {
            console.log('School found:', school._id, school.name);

            const user = await User.findOne({ nombre: { $regex: /jean/i }, school_id: school._id });
            if (user) {
                console.log('User "jean..." found:');
                console.log(' - Name:', user.nombre);
                console.log(' - ID:', user._id);
                console.log(' - createdAt:', user.createdAt);
                console.log(' - school_id:', user.school_id);
            } else {
                console.log('User "jean..." not found in school "My Hero"');
            }

            const materias = await Materia.find({ school_id: school._id });
            console.log(`Found ${materias.length} materias for "My Hero":`);
            materias.forEach(m => console.log(' -', m.nombre));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
