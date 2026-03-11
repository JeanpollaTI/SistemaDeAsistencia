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
                    price: process.env.STRIPE_PRICE_ID,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
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

    const stripeClient = getStripe();

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const { schoolId } = session.metadata;
            const subscriptionId = session.subscription;

            // Obtener detalles de la suscripción para conocer la fecha de vencimiento
            const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
            const nextBilling = new Date(subscription.current_period_end * 1000);

            await School.findByIdAndUpdate(schoolId, {
                'subscription.status': 'active',
                'subscription.nextBilling': nextBilling,
                'subscription.stripeId': subscriptionId
            });

            console.log(`✅ Escuela ${schoolId} activada vía Checkout.`);
            break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.created': {
            const subscription = event.data.object;
            // Intentar encontrar la escuela por el ID de suscripción de Stripe
            const school = await School.findOne({ 'subscription.stripeId': subscription.id });

            if (school) {
                const nextBilling = new Date(subscription.current_period_end * 1000);
                const status = (subscription.status === 'active' || subscription.status === 'trialing') ? 'active' : 'suspended';

                await School.findByIdAndUpdate(school._id, {
                    'subscription.status': status,
                    'subscription.nextBilling': nextBilling
                });
                console.log(`🔄 Suscripción de escuela ${school._id} actualizada: ${status}`);
            }
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const school = await School.findOne({ 'subscription.stripeId': subscription.id });

            if (school) {
                await School.findByIdAndUpdate(school._id, {
                    'subscription.status': 'suspended'
                });
                console.log(`❌ Suscripción de escuela ${school._id} cancelada.`);
            }
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

/**
 * @route   POST /api/stripe/process-renewal
 * @desc    Procesa el pago de renovación directamente con cardData
 */
router.post('/process-renewal', authMiddleware, async (req, res) => {
    try {
        const { schoolId, cardData } = req.body;
        if (!cardData) return res.status(400).json({ error: "Datos de tarjeta faltantes" });

        const school = await School.findById(schoolId);
        if (!school) return res.status(404).json({ error: "Escuela no encontrada" });

        const stripeClient = getStripe();

        // 1. Crear Token de tarjeta
        const token = await stripeClient.tokens.create({
            card: {
                number: cardData.cardNumber.replace(/\s/g, ''),
                exp_month: parseInt(cardData.cardMonth),
                exp_year: parseInt(cardData.cardYear),
                cvc: cardData.cardCvv,
                name: cardData.cardName
            },
        });

        // 2. Si la escuela ya tiene un stripeId, intentamos cargar a ese cliente o crear uno nuevo
        let customerId = school.subscription?.stripeId ? null : null; // Simplificamos: creamos cliente por transacción o usamos el existente
        
        // Mejor flujo: Crear un PaymentMethod y adjuntarlo al cliente, o simplemente cobrar una vez si es "one-shot"
        // Según el usuario: "será de un pago... renovar el pago o la suscripción"
        
        // Creamos un cargo único para renovación (o suscripción manual)
        const charge = await stripeClient.charges.create({
            amount: 70000, // $700.00 MXN
            currency: 'mxn',
            source: token.id,
            description: `Renovación de suscripción para ${school.name}`,
            metadata: { schoolId: schoolId.toString() }
        });

        if (charge.status === 'succeeded') {
            // Actualizar fecha de vencimiento (30 días más)
            const currentExpire = school.subscription?.nextBilling || new Date();
            const newExpire = new Date(Math.max(currentExpire.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);

            await School.findByIdAndUpdate(schoolId, {
                'subscription.status': 'active',
                'subscription.nextBilling': newExpire
            });

            return res.json({ success: true, msg: "Pago procesado correctamente." });
        } else {
            return res.status(400).json({ error: "El pago no pudo ser procesado." });
        }

    } catch (err) {
        console.error("Error en renovación Stripe:", err);
        res.status(500).json({ error: err.message || "Error al procesar el pago." });
    }
});

export default router;
