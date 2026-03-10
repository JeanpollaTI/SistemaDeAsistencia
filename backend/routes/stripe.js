import express from 'express';
import Stripe from 'stripe';
import School from '../models/School.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();
let stripe;

const getStripe = () => {
    if (!stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            console.error("❌ STRIPE_SECRET_KEY no está definida en las variables de entorno.");
            throw new Error("Stripe API Key missing");
        }
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
};

/**
 * @route   POST /api/stripe/create-checkout-session
 * @desc    Crea una sesión de Stripe para una suscripción mensual de $700 MXN
 */
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
    try {
        const { schoolId } = req.body;
        const school = await School.findById(schoolId);
        if (!school) return res.status(404).json({ msg: "Escuela no encontrada" });

        const stripeClient = getStripe();
        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'mxn',
                        product_data: {
                            name: `Suscripción Mensual Scholaris - ${school.name}`,
                            description: 'Acceso completo a la plataforma de gestión escolar.',
                        },
                        unit_amount: 70000, // $700.00 MXN
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment', // Cambiar a 'subscription' si se usa un Price ID de Stripe
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?payment=success`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?payment=cancel`,
            metadata: {
                schoolId: schoolId.toString(),
            },
        });

        res.json({ id: session.id, url: session.url });
    } catch (err) {
        console.error("Error creating Stripe session:", err);
        res.status(500).json({ error: "No se pudo iniciar el proceso de pago." });
    }
});

/**
 * @route   POST /api/stripe/webhook
 * @desc    Webhook para capturar el pago exitoso y activar la escuela
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const stripeClient = getStripe();
        event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { schoolId } = session.metadata;

        // Activar la escuela y establecer fecha de vencimiento (30 días después)
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);

        await School.findByIdAndUpdate(schoolId, {
            'subscription.status': 'active',
            'subscription.nextBilling': nextBilling,
            'subscription.stripeId': session.id
        });

        console.log(`✅ Escuela ${schoolId} activada satisfactoriamente.`);
    }

    res.json({ received: true });
});

export default router;
