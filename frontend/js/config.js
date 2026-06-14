/**
 * CONFIGURACION DEL PROYECTO
 * ==========================
 * 5 Invernaderos x 4 Macetas x 4 Sensores = 100 Sensores
 * 5 Invernaderos x (4 Macetas x 3 Actuadores + 1 Buzzer) = 65 Actuadores
 */

const CONFIG = {
    SUPABASE_URL: 'https://nzicdhwoficzsafhdxmq.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aWNkaHdvZmljenNhZmhkeG1xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc4MTg0MywiZXhwIjoyMDk2MzU3ODQzfQ.Al5773jpjE6YiQ_hzyLVAVIzzgk0DkU8xQPMGkjXtOU',
    BRIDGE_URL: 'https://huerto-puente.onrender.com',

    DISPOSITIVOS: [
        { id: 1, nombre: 'INV-01', macetas: 4 },
        { id: 2, nombre: 'INV-02', macetas: 4 },
        { id: 3, nombre: 'INV-03', macetas: 4 },
        { id: 4, nombre: 'INV-04', macetas: 4 },
        { id: 5, nombre: 'INV-05', macetas: 4 },
    ],

    MACETAS_POR_INV: 4,
    SENSORES_POR_MACETA: 4,
    TIPOS_SENSOR: { temp: 1, hum_amb: 2, hum_suelo: 3, ph: 4 },

    getSensorId(dispositivoId, macetaNum, tipo) {
        return (dispositivoId - 1) * 16 + (macetaNum - 1) * 4 + tipo;
    },

    getSensoresMaceta(dispositivoId, macetaNum) {
        return {
            temp:     this.getSensorId(dispositivoId, macetaNum, 1),
            hum_amb:  this.getSensorId(dispositivoId, macetaNum, 2),
            hum_suelo:this.getSensorId(dispositivoId, macetaNum, 3),
            ph:       this.getSensorId(dispositivoId, macetaNum, 4),
        };
    },

    getSensoresDispositivo(dispositivoId) {
        const sensores = [];
        for (let m = 1; m <= this.MACETAS_POR_INV; m++) {
            sensores.push({
                maceta: m,
                ...this.getSensoresMaceta(dispositivoId, m),
            });
        }
        return sensores;
    },

    getActuadorId(dispositivoId, macetaNum, tipo) {
        return (dispositivoId - 1) * 13 + (macetaNum - 1) * 3 + tipo;
    },

    getBuzzerId(dispositivoId) {
        return (dispositivoId - 1) * 13 + 13;
    },

    getActuadoresMaceta(dispositivoId, macetaNum) {
        return {
            bomba:        this.getActuadorId(dispositivoId, macetaNum, 1),
            ventilador:   this.getActuadorId(dispositivoId, macetaNum, 2),
            pulverizador: this.getActuadorId(dispositivoId, macetaNum, 3),
        };
    },

    getActuadoresDispositivo(dispositivoId) {
        const actuadores = [];
        for (let m = 1; m <= this.MACETAS_POR_INV; m++) {
            actuadores.push({
                maceta: m,
                ...this.getActuadoresMaceta(dispositivoId, m),
            });
        }
        actuadores.push({ maceta: 0, buzzer: this.getBuzzerId(dispositivoId) });
        return actuadores;
    },

    PIN_MAP: {
        1: { bomba: 32, ventilador: 14, pulverizador: 5 },
        2: { bomba: 23, ventilador: 0,  pulverizador: 15 },
        3: { bomba: 12, ventilador: 11, pulverizador: 10 },
        4: { bomba: 8,  ventilador: 7,  pulverizador: 6 },
    },

    UMBRALES: {
        temp_min: 15,
        temp_max: 30,
        hum_suelo_min: 40,
        hum_suelo_max: 80,
        ph_min: 5.5,
        ph_max: 7.5,
    },

    POLL_INTERVAL: 5000,
    CHART_POINTS: 48,
};
