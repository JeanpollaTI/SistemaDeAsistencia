import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from './models/School.js';

dotenv.config();

const fixSchool = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error("MONGO_URI not found");
            return;
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const targetDate = new Date("2026-03-20T00:00:00Z");
        const result = await School.updateOne(
            { name: /Secundaria General Número 9/i },
            { $set: { "subscription.nextBilling": targetDate, "subscription.status": "active" } }
        );

        console.log("Update result:", result);

        if (result.matchedCount > 0) {
            const updated = await School.findOne({ name: /Secundaria General Número 9/i });
            console.log("Updated School:", JSON.stringify(updated, null, 2));
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
};

fixSchool();
