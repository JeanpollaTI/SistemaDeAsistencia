// backend/scripts/init_superadmin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import "dotenv/config";
import User from "../models/User.js";

const MONGO_URI = process.env.MONGO_URI;
const SUPERADMIN_EMAIL = "thejeanpollo@gmail.com";
const TEMP_PASSWORD = "change_me_immediately_123";

const initSuperAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for SuperAdmin initialization.");

        const existingUser = await User.findOne({ email: SUPERADMIN_EMAIL });
        
        if (existingUser) {
            console.log("SuperAdmin already exists. Updating role to superadmin...");
            existingUser.role = "superadmin";
            // Check if they need a password reset or leave as is if they already set it
            await existingUser.save();
            console.log("Updated existing user to SuperAdmin.");
        } else {
            const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);
            const superAdmin = new User({
                nombre: "Platform Manager",
                email: SUPERADMIN_EMAIL,
                password: hashedPassword,
                role: "superadmin",
                // school_id is not required for superadmin
            });
            await superAdmin.save();
            console.log(`✅ SuperAdmin created successfully with email: ${SUPERADMIN_EMAIL}`);
            console.log(`⚠️ Temporary password: ${TEMP_PASSWORD}`);
        }

        mongoose.connection.close();
    } catch (err) {
        console.error("Error initializing SuperAdmin:", err);
        process.exit(1);
    }
};

initSuperAdmin();
