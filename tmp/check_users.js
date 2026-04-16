import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from '../backend/models/School.js';
import User from '../backend/models/User.js';

dotenv.config({ path: './backend/.env' });

const checkUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const school = await School.findOne({ name: /Secundaria General Número 9/i });
        if (school) {
            console.log("School found:", school._id);
            const users = await User.find({ school_id: school._id });
            console.log("Users assigned to this school:", JSON.stringify(users, ['_id', 'nombre', 'email', 'role', 'subscriptionStatus'], 2));
        } else {
            console.log("School not found");
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
};

checkUsers();
