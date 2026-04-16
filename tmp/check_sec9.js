import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from '../backend/models/School.js';

dotenv.config();

const checkSec9 = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const sec9 = await School.findOne({ name: /Secundaria.*9/i });
        if (sec9) {
            console.log("School found:", JSON.stringify(sec9, null, 2));
        } else {
            console.log("School not found");
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
};

checkSec9();
