import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from './backend/models/School.js';

dotenv.config();

const checkSchool = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const school = await School.findOne({ name: /Secundaria General Número 9/i });
        if (school) {
            console.log("School found:", JSON.stringify(school, null, 2));
            const now = new Date();
            const nextBilling = new Date(school.subscription?.nextBilling);
            const diff = nextBilling - now;
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            console.log("Current time:", now.toISOString());
            console.log("Next billing:", nextBilling.toISOString());
            console.log("Diff (ms):", diff);
            console.log("Calculated days:", days);
        } else {
            console.log("School not found");
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
};

checkSchool();
