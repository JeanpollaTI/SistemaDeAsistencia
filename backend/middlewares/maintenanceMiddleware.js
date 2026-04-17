import SystemStatus from '../models/SystemStatus.js';

export const maintenanceMiddleware = async (req, res, next) => {
    try {
        // Excluir rutas de login y superadmin del chequeo inicial 
        // o permitir que lleguen hasta aquí y filtrar por rol
        const settings = await SystemStatus.getSettings();

        if (settings.maintenanceMode) {
            // El SuperAdmin es el ÚNICO que puede saltarse esto
            if (req.user && req.user.role === 'superadmin') {
                return next();
            }

            // Si es una ruta de "/api/superadmin/maintenance", permitir (por si acaso el token no se cargó bien)
            // Pero normalmente el check de superadmin arriba es suficiente
            if (req.path === '/status' || req.path === '/maintenance') {
                if (req.user && req.user.role === 'superadmin') return next();
            }

            return res.status(503).json({ 
                maintenance: true, 
                msg: 'El sistema se encuentra en mantenimiento global.' 
            });
        }

        next();
    } catch (err) {
        console.error('Error en maintenanceMiddleware:', err);
        next(); // Ante error, permitimos el paso para no bloquear el sistema por un fallo en settings
    }
};
