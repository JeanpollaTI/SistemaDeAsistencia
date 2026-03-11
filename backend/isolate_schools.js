import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import School from './models/School.js';

dotenv.config({ path: '../.env' });
dotenv.config();

async function isolate() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log("Connected to DB");

        // Targeted users to isolate
        const targetEmails = ['lynpdp@gmail.com', 'pollo@gmail.com'];

        for (const email of targetEmails) {
            const user = await User.findOne({ email: email.toLowerCase() }).populate('school_id');
            if (!user) {
                console.log(`User ${email} not found.`);
                continue;
            }

            const oldSchool = user.school_id;
            if (!oldSchool) {
                console.log(`User ${email} has no school assigned.`);
                continue;
            }

            console.log(`Isolating user ${email} from school ${oldSchool.name} (${oldSchool._id})`);

            // Check if anyone else is using this specific school ID
            const otherUsers = await User.countDocuments({ school_id: oldSchool._id, _id: { $ne: user._id } });
            
            if (otherUsers === 0) {
                console.log(`User ${email} is already the only user for this school record. No need to clone.`);
                continue;
            }

            // Create a NEW school record cloning the old one
            const newSchoolData = oldSchool.toObject();
            delete newSchoolData._id;
            delete newSchoolData.__v;
            delete newSchoolData.createdAt;
            delete newSchoolData.updatedAt;

            const newSchool = new School(newSchoolData);
            await newSchool.save();

            // Update the user to point to the new school
            user.school_id = newSchool._id;
            await user.save();

            console.log(`Successfully created new school ${newSchool._id} for user ${email}`);

            // If it's an admin, we might want to move their associated "profesores" too?
            // User 'pollo@gmail.com' has 'pollo1@gmail.com' as profesor?
            if (email === 'pollo@gmail.com') {
                const updatedProf = await User.updateMany(
                    { email: 'pollo1@gmail.com', school_id: oldSchool._id },
                    { school_id: newSchool._id }
                );
                console.log(`Updated ${updatedProf.modifiedCount} associated staff (pollo1@gmail.com)`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error("Isolation failed:", err);
        process.exit(1);
    }
}

isolate();
