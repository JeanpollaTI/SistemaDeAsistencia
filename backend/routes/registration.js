import express from 'express';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import School from '../models/School.js';
import User from '../models/User.js';

const router = express.Router();

let stripe;
const getStripe = () => {
    if (!stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            console.error("❌ STRIPE_SECRET_KEY no está definida.");
            return null;
        }
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
};

/**
 * @route   POST /api/schools/register-institutional
 * @desc    Registra una nueva escuela y su administrador principal
 * @access  Public (Inicia proceso de suscripción)
 */
router.post('/register-institutional', async (req, res) => {
    try {
        const {
            email,
            password,
            schoolName,
            schoolType,
            evaluationPeriod,
            logoUrl,
            cardData
        } = req.body;

        // 1. Validaciones básicas
        if (!email || !password || !schoolName || !schoolType || !evaluationPeriod) {
            return res.status(400).json({ msg: "Por favor, completa todos los campos obligatorios." });
        }

        // Validar dominios permitidos
        const allowedDomains = ['gmail.com', 'iea.edu.mx'];
        const domain = email.split('@')[1];
        if (!allowedDomains.includes(domain)) {
            return res.status(400).json({ msg: "Solo se permiten correos @gmail.com o @iea.edu.mx para administradores." });
        }

        // Verificar si el usuario ya existe
        let existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ msg: "El correo ya está registrado en la plataforma." });
        }

        // 2. Crear la Institución (Inicialmente suspendida hasta confirmar pago)
        const school = new School({
            name: schoolName,
            type: schoolType,
            evaluationPeriod: evaluationPeriod,
            config: {
                logoUrl: logoUrl || "",
                scaleMax: 10
            },
            subscription: {
                status: "suspended", // Estado inicial
                nextBilling: new Date()
            }
        });

        await school.save();

        // 3. Procesar Pago con Stripe (Suscripción Directa)
        let stripeSubscriptionId = null;
        let stripeCustomerId = null;
        const stripeClient = getStripe();

        if (!stripeClient) {
            return res.status(500).json({ msg: "Error de configuración en la pasarela de pagos." });
        }

        try {
            // Crear Token de tarjeta (Solo para propósitos de demostración/integración directa con raw data)
            // NOTA: Para producción real, se debe usar Stripe Elements en el frontend.
            const token = await stripeClient.tokens.create({
                card: {
                    number: cardData.cardNumber.replace(/\s/g, ''),
                    exp_month: parseInt(cardData.cardMonth),
                    exp_year: parseInt(cardData.cardYear),
                    cvc: cardData.cardCvv,
                    name: cardData.cardName
                },
            });

            // Crear Cliente
            const customer = await stripeClient.customers.create({
                email: email.toLowerCase(),
                source: token.id,
                name: cardData.cardName,
                metadata: { schoolId: school._id.toString() }
            });
            stripeCustomerId = customer.id;

            // Crear Suscripción
            const subscription = await stripeClient.subscriptions.create({
                customer: customer.id,
                items: [{ price: process.env.STRIPE_PRICE_ID }],
                metadata: { schoolId: school._id.toString() }
            });
            stripeSubscriptionId = subscription.id;

            // Si llegamos aquí, el pago/suscripción fue exitoso o iniciado
            const nextBilling = new Date(subscription.current_period_end * 1000);
            
            school.subscription.status = "active";
            school.subscription.nextBilling = nextBilling;
            school.subscription.stripeId = stripeSubscriptionId;
            await school.save();

        } catch (paymentErr) {
            console.error("Error en procesamiento de pago Stripe:", paymentErr.message);
            // Si el pago falla, eliminamos la escuela recién creada para evitar inconsistencias
            // (Opcional: podrías dejarla como suspendida y pedir pago después)
            await School.findByIdAndDelete(school._id);
            return res.status(400).json({ 
                msg: "Error al procesar el pago de la suscripción.", 
                error: paymentErr.message 
            });
        }

        // 4. Crear el Usuario Administrador ligado a la escuela
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const adminUser = new User({
            nombre: "Administrador", // Se pedirá actualizar luego
            email: email.toLowerCase(),
            password: hashedPassword,
            role: "admin",
            school_id: school._id
        });

        await adminUser.save();

        // 4. Retornar éxito e ID para continuar a Stripe
        res.status(201).json({
            msg: "Registro institucional exitoso.",
            schoolId: school._id,
            adminId: adminUser._id
        });

    } catch (err) {
        console.error("CRITICAL error en registro institucional:", err);
        // Retornar el mensaje específico del error para facilitar el debug en el frontend
        res.status(500).json({
            error: "Error interno del servidor",
            details: err.message,
            msg: "No se pudo completar el registro. Revise los datos o intente más tarde."
        });
    }
});

export default router;
