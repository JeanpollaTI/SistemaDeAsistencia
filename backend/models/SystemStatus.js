import mongoose from 'mongoose';

const SystemStatusSchema = new mongoose.Schema({
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Asegurar que solo exista un documento de configuración
SystemStatusSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({ maintenanceMode: false });
    }
    return settings;
};

const SystemStatus = mongoose.model('SystemStatus', SystemStatusSchema);
export default SystemStatus;
