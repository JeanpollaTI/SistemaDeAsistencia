import 'dotenv/config';
import Stripe from 'stripe';

const verify = () => {
    console.log("Checking STRIPE_SECRET_KEY...");
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        console.error("❌ STRIPE_SECRET_KEY is missing!");
        process.exit(1);
    }
    console.log(`✅ STRIPE_SECRET_KEY found: ${key.substring(0, 7)}...`);

    try {
        const stripe = new Stripe(key);
        console.log("✅ Stripe client initialized successfully.");
    } catch (err) {
        console.error("❌ Failed to initialize Stripe client:", err.message);
        process.exit(1);
    }
};

verify();
