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
            throw new Error("Stripe API Key missing");
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
            logoUrl
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

        // 2. Crear la Institución con Prueba Gratuita (3 días)
        const school = new School({
            name: schoolName,
            type: schoolType,
            evaluationPeriod: evaluationPeriod,
            config: {
                logoUrl: logoUrl || "",
                scaleMax: 10
            },
            subscription: {
                status: "trial", // Estado inicial: Prueba
                nextBilling: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 días desde hoy
            }
        });

        await school.save();

        // 3. Crear sesión de Stripe Checkout
        const stripeClient = getStripe();
        let sessionUrl = null;

        if (!stripeClient) {
            return res.status(500).json({ msg: "Error de configuración en la pasarela de pagos." });
        }

        try {
            const session = await stripeClient.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price: process.env.STRIPE_PRICE_ID,
                    quantity: 1,
                }],
                mode: 'subscription',
                success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?payment=success`,
                cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register-school?payment=cancel`,
                customer_email: email.toLowerCase(),
                metadata: { schoolId: school._id.toString() }
            });

            sessionUrl = session.url;

        } catch (paymentErr) {
            console.error("Error al crear sesión de Stripe Checkout (Modo Prueba - 3 días):", paymentErr.message);
            // IMPORTANTE: No eliminamos la escuela ni bloqueamos el registro.
            sessionUrl = null;
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

        // 4. Retornar éxito e ID, más la URL de Stripe para continuar
        res.status(201).json({
            msg: "Registro institucional iniciado.",
            schoolId: school._id,
            adminId: adminUser._id,
            url: sessionUrl
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
