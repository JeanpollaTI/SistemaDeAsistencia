import mongoose from 'mongoose';
import User from './models/User.js';
import School from './models/School.js';
import Materia from './models/Materia.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const MONGO_URI = process.env.MONGO_URI;

async function run() {
    try {
        await mongoose.connect(MONGO_URI);

        const user = await User.findOne({ nombre: { $regex: /jeanpollo/i } }).populate('school_id');
        if (!user) {
            console.log('User "jeanpollo" not found anywhere.');
        } else {
            console.log('User "jeanpollo" found:');
            console.log(' - School:', user.school_id ? user.school_id.name : 'NO SCHOOL');
            console.log(' - Role:', user.role);
            console.log(' - createdAt:', user.createdAt);

            const materias = await Materia.find({ school_id: user.school_id._id });
            console.log(`Found ${materias.length} materias for this school.`);
            if (materias.length > 0) {
                console.log('Deleting materias for this school...');
                await Materia.deleteMany({ school_id: user.school_id._id });
                console.log('Done.');
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
