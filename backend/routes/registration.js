import express from 'express';
import bcrypt from 'bcryptjs';
import School from '../models/School.js';
import User from '../models/User.js';

const router = express.Router();

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

        // 2. Crear la Institución (Cerrada inicialmente hasta el pago, o activa por defecto si así se prefiere)
        const school = new School({
            name: schoolName,
            type: schoolType,
            evaluationPeriod: evaluationPeriod,
            config: {
                logoUrl: logoUrl || "",
                scaleMax: 10
            },
            subscription: {
                status: "suspended", // Se activa tras el pago exitoso en Stripe
                nextBilling: null
            }
        });

        await school.save();

        // 3. Crear el Usuario Administrador ligado a la escuela
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
        console.error("Error en registro institucional:", err);
        res.status(500).json({ error: "Error interno del servidor al registrar la escuela." });
    }
});

export default router;
