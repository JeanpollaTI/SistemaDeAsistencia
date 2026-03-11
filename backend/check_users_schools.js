import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import School from './models/School.js';

dotenv.config({ path: '../.env' }); // Retry loading from root
dotenv.config(); // If also in backend

async function check() {
    try {
        // Fallback for MONGODB_URI if MONGO_URI is used
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) {
            console.error("MONGO_URI is missing from environment variables.");
            process.exit(1);
        }
        await mongoose.connect(uri);
        console.log("Connected to DB");
        
        const users = await User.find({}).populate('school_id');
        console.log(`Found ${users.length} users:`);
        users.forEach(u => {
            console.log(`- Email: ${u.email}, Role: ${u.role}, School: ${u.school_id?.name} (ID: ${u.school_id?._id})`);
        });
        
        const schools = await School.find({});
        console.log(`\nFound ${schools.length} total schools in DB:`);
        schools.forEach(s => {
            console.log(`- ${s.name} (ID: ${s._id})`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Check failed:", err);
        process.exit(1);
    }
}

check();
