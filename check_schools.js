import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from './backend/models/School.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");
        const schools = await School.find({});
        console.log(`Found ${schools.length} schools:`);
        schools.forEach(s => {
            console.log(`- ID: ${s._id}, Name: ${s.name}, Director: ${s.directorName}, Logo: ${s.config?.logoUrl}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
