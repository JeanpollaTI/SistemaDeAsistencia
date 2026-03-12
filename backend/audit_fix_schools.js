import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from './models/School.js';

dotenv.config();

const auditSchools = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const schools = await School.find({});
        console.log(`Found ${schools.length} schools`);

        for (const school of schools) {
            if (!school.subscription?.nextBilling) {
                console.log(`Fixing missing nextBilling for: ${school.name}`);
                const defaultDate = new Date();
                defaultDate.setDate(defaultDate.getDate() + 30); // 30 days from now
                await School.updateOne({ _id: school._id }, { $set: { "subscription.nextBilling": defaultDate, "subscription.status": "active" } });
            }
        }

        await mongoose.disconnect();
        console.log("Audit and fix completed");
    } catch (err) {
        console.error("Error:", err);
    }
};

auditSchools();
