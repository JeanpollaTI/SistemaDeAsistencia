import mongoose from 'mongoose';
import dotenv from 'dotenv';
import School from './models/School.js';

dotenv.config();

const activateSchool = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const schoolName = "Secundaria General Número 9";
        
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1); // 1 month from now

        const result = await School.updateOne(
            { name: /Secundaria General Número 9/i },
            { 
                $set: { 
                    "subscription.status": "active",
                    "subscription.nextBilling": nextBilling,
                    "subscription.stripeId": "manual_fix_" + Date.now() // Placeholder since we don't have the real sub ID easily here
                } 
            }
        );

        if (result.matchedCount > 0) {
            console.log(`✅ School '${schoolName}' has been activated.`);
            console.log(`Next billing set to: ${nextBilling}`);
        } else {
            console.log(`❌ School '${schoolName}' not found.`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
};

activateSchool();
