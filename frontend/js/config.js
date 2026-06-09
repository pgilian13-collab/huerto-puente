/**
 * CONFIGURACION DEL PROYECTO
 * ==========================
 * 5 Invernaderos x 4 Macetas x 3 Sensores = 60 Sensores
 * 5 Invernaderos x 4 Actuadores = 20 Actuadores
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
    SENSORES_POR_MACETA: 3,

    // tipo: 1=Temp, 2=HumAmb, 3=HumSuelo
    getSensorId(dispositivoId, macetaNum, tipo) {
        return (dispositivoId - 1) * 12 + (macetaNum - 1) * 3 + tipo;
    },

    getSensoresDispositivo(dispositivoId) {
        const sensores = [];
        for (let m = 1; m <= this.MACETAS_POR_INV; m++) {
            sensores.push({
                maceta: m,
                temp: this.getSensorId(dispositivoId, m, 1),
                hum_amb: this.getSensorId(dispositivoId, m, 2),
                hum_suelo: this.getSensorId(dispositivoId, m, 3),
            });
        }
        return sensores;
    },

    ACTUADOR_IDS: {
        bomba:        [1, 5, 9, 13, 17],
        ventilador:   [2, 6, 10, 14, 18],
        pulverizador: [3, 7, 11, 15, 19],
        buzzer:       [4, 8, 12, 16, 20],
    },

    UMBRALES: {
        temp_min: 15,
        temp_max: 30,
        hum_suelo_min: 40,
        hum_suelo_max: 80,
    },

    POLL_INTERVAL: 5000,
    CHART_POINTS: 48,
};
