/**
 * CLIENTE SUPABASE
 * =================
 * REST API + Realtime
 * 3 sensores por maceta: Temp, HumAmb, HumSuelo
 */

const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const SupabaseClient = {

    async query(table, params = '') {
        const url = `${CONFIG.SUPABASE_URL}/rest/v1/${table}?${params}`;
        try {
            const resp = await fetch(url, {
                headers: {
                    'apikey': CONFIG.SUPABASE_KEY,
                    'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                }
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (e) {
            console.error(`Query error [${table}]:`, e);
            return null;
        }
    },

    async insert(table, data) {
        const url = `${CONFIG.SUPABASE_URL}/rest/v1/${table}`;
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': CONFIG.SUPABASE_KEY,
                    'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify(data),
            });
            return resp.ok;
        } catch (e) {
            console.error(`Insert error [${table}]:`, e);
            return false;
        }
    },

    async healthCheck() {
        try {
            const resp = await fetch(
                `${CONFIG.SUPABASE_URL}/rest/v1/sectores?select=id&limit=1`,
                { headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}` } }
            );
            return resp.ok;
        } catch {
            return false;
        }
    },

    async getLecturas(invIndex, limit = 50) {
        const dispositivoId = invIndex + 1;
        const ids = [];
        for (let m = 1; m <= CONFIG.MACETAS_POR_INV; m++) {
            ids.push(CONFIG.getSensorId(dispositivoId, m, 1));
            ids.push(CONFIG.getSensorId(dispositivoId, m, 2));
            ids.push(CONFIG.getSensorId(dispositivoId, m, 3));
        }
        return this.query('monitoreo_lecturas',
            `sensor_id=in.(${ids.join(',')})&order=fecha_hora.desc&limit=${limit}`
        );
    },

    async getActuadores(invIndex) {
        const ids = [
            CONFIG.ACTUADOR_IDS.bomba[invIndex],
            CONFIG.ACTUADOR_IDS.ventilador[invIndex],
            CONFIG.ACTUADOR_IDS.pulverizador[invIndex],
            CONFIG.ACTUADOR_IDS.buzzer[invIndex],
        ];
        return this.query('actuadores', `id=in.(${ids.join(',')})`);
    },

    async enviarComando(actuadorId, nombre, pin, estado) {
        const dispositivoId = Math.ceil(actuadorId / 4);
        return this.insert('control_actuadores', {
            actuador_id: actuadorId,
            dispositivo_id: dispositivoId,
            nombre_actuador: nombre,
            pin_conexion: `GPIO${pin}`,
            estado_solicitado: estado,
            estado_actual: 'PENDIENTE',
            enviado_por: 'WEB',
        });
    },

    subscribeLecturas(invIndex, callback) {
        return sb
            .channel('lecturas-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'monitoreo_lecturas',
            }, (payload) => {
                callback(payload.new);
            })
            .subscribe();
    },

    subscribeActuadores(invIndex, callback) {
        const actuadorIds = [
            CONFIG.ACTUADOR_IDS.bomba[invIndex],
            CONFIG.ACTUADOR_IDS.ventilador[invIndex],
            CONFIG.ACTUADOR_IDS.pulverizador[invIndex],
            CONFIG.ACTUADOR_IDS.buzzer[invIndex],
        ];
        return sb
            .channel('actuadores-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'actuadores',
            }, (payload) => {
                if (actuadorIds.includes(payload.new.id)) {
                    callback(payload.new);
                }
            })
            .subscribe();
    },

    unsubscribe() {
        sb.removeAllChannels();
    },
};
