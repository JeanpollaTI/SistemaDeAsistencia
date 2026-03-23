import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from './models/School.js';

dotenv.config();

const checkSchool = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const school = await School.findOne({ name: /Secundaria General Número 9/i });
        
        if (school) {
            console.log("School found:");
            console.log(JSON.stringify(school, null, 2));
        } else {
            console.log("School 'Secundaria General Número 9' not found.");
            // List all schools to see if name is slightly different
            const allSchools = await School.find({}, 'name');
            console.log("All schools:", allSchools.map(s => s.name));
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
};

checkSchool();
