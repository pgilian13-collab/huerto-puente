/**
 * CONFIGURACION DEL PROYECTO
 * ==========================
 * 5 Invernaderos x (2 compartidos + 4 Macetas x 2) = 50 Sensores
 * 5 Invernaderos x (4 Macetas x 3 Actuadores + 1 Buzzer) = 65 Actuadores
 *
 * Layout por invernadero (10 IDs):
 *   +0: temp (compartido)
 *   +1: hum_amb (compartido)
 *   +2: hum_suelo MAC-1
 *   +3: ph MAC-1
 *   +4: hum_suelo MAC-2
 *   +5: ph MAC-2
 *   +6: hum_suelo MAC-3
 *   +7: ph MAC-3
 *   +8: hum_suelo MAC-4
 *   +9: ph MAC-4
 */

const CONFIG = {
    SUPABASE_URL: 'https://nzicdhwoficzsafhdxmq.supabase.co',
    SUPABASE_ANON_KEY: 'TU_SUPABASE_ANON_KEY_AQUI',
    BRIDGE_URL: 'https://huerto-puente.onrender.com',
    BRIDGE_KEY: 'huerto-ccss-2026',

    DISPOSITIVOS: [
        { id: 1, nombre: 'INV-01', macetas: 4 },
        { id: 2, nombre: 'INV-02', macetas: 4 },
        { id: 3, nombre: 'INV-03', macetas: 4 },
        { id: 4, nombre: 'INV-04', macetas: 4 },
        { id: 5, nombre: 'INV-05', macetas: 4 },
    ],

    MACETAS_POR_INV: 4,
    SENSORES_COMPARTIDOS: 2,
    SENSORES_POR_MACETA: 2,
    SENSORES_POR_DISP: 10,

    getSensoresCompartidos(deviceId) {
        const base = (deviceId - 1) * 10;
        return { temp: base + 0, hum_amb: base + 1 };
    },

    getSensoresMaceta(deviceId, macetaNum) {
        const base = (deviceId - 1) * 10 + 2 + (macetaNum - 1) * 2;
        return { hum_suelo: base, ph: base + 1 };
    },

    getTodosSensoresMaceta(deviceId, macetaNum) {
        const shared = this.getSensoresCompartidos(deviceId);
        const mac = this.getSensoresMaceta(deviceId, macetaNum);
        return {
            temp: shared.temp,
            hum_amb: shared.hum_amb,
            hum_suelo: mac.hum_suelo,
            ph: mac.ph,
        };
    },

    getSensoresDispositivo(dispositivoId) {
        const shared = this.getSensoresCompartidos(dispositivoId);
        const sensores = [];
        for (let m = 1; m <= this.MACETAS_POR_INV; m++) {
            const mac = this.getSensoresMaceta(dispositivoId, m);
            sensores.push({ maceta: m, ...shared, ...mac });
        }
        return sensores;
    },

    getAllSensorIds(deviceId) {
        const ids = [];
        const shared = this.getSensoresCompartidos(deviceId);
        ids.push(shared.temp, shared.hum_amb);
        for (let m = 1; m <= this.MACETAS_POR_INV; m++) {
            const mac = this.getSensoresMaceta(deviceId, m);
            ids.push(mac.hum_suelo, mac.ph);
        }
        return ids;
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
