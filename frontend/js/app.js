/**
 * APP PRINCIPAL - HUERTO UNIVERSITARIO UNHEVAL
 * ==============================================
 * 5 Invernaderos x 4 Macetas x 4 Sensores = 100 Sensores
 * 5 Invernaderos x (4 Macetas x 3 Actuadores + 1 Buzzer) = 65 Actuadores
 */

let currentInv = 0;
let currentMaceta = 1;
let chart = null;
let pollTimer = null;
let realtimeSub = null;
let vistaTabla = false;
let historicoTimer = null;

// ============================================================
// INICIALIZACION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[APP] Iniciando Huerto Inteligente...');

    const connected = await SupabaseClient.healthCheck();
    const dot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const liveIndicator = document.getElementById('liveIndicator');

    if (connected) {
        dot.classList.add('online');
        statusText.textContent = 'Conectado';
        liveIndicator.style.display = 'flex';
    } else {
        dot.classList.remove('online');
        statusText.textContent = 'Sin conexion';
        liveIndicator.style.display = 'none';
    }

    initMacetaTabs();
    await cargarDatos();
    initChart();
    iniciarRealtime();
    iniciarAutoRefreshHistorico();

    pollTimer = setInterval(cargarDatos, CONFIG.POLL_INTERVAL);
    console.log('[APP] Iniciado');

    const loader = document.getElementById('loader');
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 500);

    initSensorModals();

    const fab = document.getElementById('fabConfig');
    const modal = document.getElementById('configModal');
    const closeBtn = document.getElementById('modalClose');

    if (fab && modal) {
        fab.addEventListener('click', () => {
            modal.classList.add('active');
        });
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }
});

// ============================================================
// MACETA TABS
// ============================================================

function initMacetaTabs() {
    const container = document.getElementById('macetaTabs');
    if (!container) return;

    container.innerHTML = '';
    for (let m = 1; m <= CONFIG.MACETAS_POR_INV; m++) {
        const btn = document.createElement('button');
        btn.className = `maceta-tab ${m === currentMaceta ? 'active' : ''}`;
        btn.setAttribute('data-maceta', m);
        btn.textContent = `MAC-${String(m).padStart(2, '0')}`;
        btn.onclick = () => selectMaceta(m);
        container.appendChild(btn);
    }
}

function selectMaceta(macetaNum) {
    currentMaceta = macetaNum;

    document.querySelectorAll('.maceta-tab').forEach((tab) => {
        const tabNum = parseInt(tab.getAttribute('data-maceta'));
        tab.classList.toggle('active', tabNum === macetaNum);
    });

    cargarDatos();
    cargarHistorico();
    iniciarRealtime();
}

// ============================================================
// REALTIME
// ============================================================

function iniciarRealtime() {
    if (realtimeSub) SupabaseClient.unsubscribe();

    const dispositivoId = currentInv + 1;

    realtimeSub = SupabaseClient.subscribeLecturas(currentInv, (lectura) => {
        const sid = lectura.sensor_id;
        const val = parseFloat(lectura.valor_lectura);

        const ids = CONFIG.getSensoresMaceta(dispositivoId, currentMaceta);
        const expectedIds = [ids.temp, ids.hum_amb, ids.hum_suelo, ids.ph];

        if (!expectedIds.includes(sid)) return;

        if (sid === ids.temp) {
            document.getElementById('temp').textContent = val.toFixed(1);
            setSensorStatus('tempStatus', getTempStatus(val));
        } else if (sid === ids.hum_amb) {
            document.getElementById('humAmb').textContent = val.toFixed(1);
            setSensorStatus('humAmbStatus', getHumAmbStatus(val));
        } else if (sid === ids.hum_suelo) {
            document.getElementById('humSuelo').textContent = val.toFixed(0);
            setSensorStatus('humSueloStatus', getHumSueloStatus(val));
        } else if (sid === ids.ph) {
            document.getElementById('ph').textContent = val.toFixed(1);
            setSensorStatus('phStatus', getPhStatus(val));
        }

        console.log(`[RT] Sensor ${sid} (MAC${currentMaceta}) -> ${val}`);
    });

    SupabaseClient.subscribeActuadores(currentInv, (act) => {
        updateActuadorUI(act);
        console.log(`[RT] ${act.nombre} -> ${act.estado_actual}`);
    });
}

// ============================================================
// SELECCION DE INVERNADERO
// ============================================================

function selectInvernadero(index) {
    currentInv = index;
    currentMaceta = 1;

    document.querySelectorAll('.inv-tab').forEach((tab) => {
        const tabIndex = parseInt(tab.getAttribute('data-inv'));
        tab.classList.toggle('active', tabIndex === index);
    });

    initMacetaTabs();
    cargarDatos();
    cargarHistorico();
    iniciarRealtime();
}

// ============================================================
// CARGAR DATOS
// ============================================================

async function cargarDatos() {
    const dispositivoId = currentInv + 1;
    const ids = CONFIG.getSensoresMaceta(dispositivoId, currentMaceta);

    const lecturas = await SupabaseClient.query('monitoreo_lecturas',
        `sensor_id=in.(${ids.temp},${ids.hum_amb},${ids.hum_suelo},${ids.ph})&order=fecha_hora.desc&limit=4`
    );

    if (lecturas && lecturas.length > 0) {
        const data = {};
        lecturas.forEach(l => {
            if (l.sensor_id === ids.temp) data.temp = l.valor_lectura;
            if (l.sensor_id === ids.hum_amb) data.humAmb = l.valor_lectura;
            if (l.sensor_id === ids.hum_suelo) data.humSuelo = l.valor_lectura;
            if (l.sensor_id === ids.ph) data.ph = l.valor_lectura;
        });
        actualizarSensores(data);
    } else {
        resetSensores();
    }

    const actuadores = await SupabaseClient.getActuadores(currentInv);
    if (actuadores) {
        actualizarActuadores(actuadores);
    } else {
        resetActuadores();
    }
}

// ============================================================
// UI SENSORES
// ============================================================

function resetSensores() {
    ['temp', 'humAmb', 'humSuelo', 'ph'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
    ['tempStatus', 'humAmbStatus', 'humSueloStatus', 'phStatus'].forEach(id => {
        setSensorStatus(id, '');
    });
}

function resetActuadores() {
    ['bomba', 'ventilador', 'pulverizador', 'buzzer'].forEach(nombre => {
        const btn = document.getElementById(`btn-${nombre}`);
        const card = document.getElementById(`act-${nombre}`);
        const led = document.getElementById(`${nombre}-led`);
        const fill = document.getElementById(`${nombre}-fill`);
        const lastEl = document.getElementById(`${nombre}-last`);
        if (btn) {
            btn.innerHTML = `<span class="material-icons-round">power_settings_new</span><span class="btn-label">OFF</span>`;
            btn.className = 'brutalist-btn off';
        }
        if (card) card.classList.remove('active');
        if (led) led.classList.remove('active');
        if (fill) fill.style.width = '0%';
        if (lastEl) lastEl.textContent = '--:--';
    });
}

function actualizarSensores(data) {
    if (data.temp !== undefined) {
        document.getElementById('temp').textContent = data.temp.toFixed(1);
        setSensorStatus('tempStatus', getTempStatus(data.temp));
    }
    if (data.humAmb !== undefined) {
        document.getElementById('humAmb').textContent = data.humAmb.toFixed(1);
        setSensorStatus('humAmbStatus', getHumAmbStatus(data.humAmb));
    }
    if (data.humSuelo !== undefined) {
        document.getElementById('humSuelo').textContent = data.humSuelo.toFixed(0);
        setSensorStatus('humSueloStatus', getHumSueloStatus(data.humSuelo));
    }
    if (data.ph !== undefined) {
        document.getElementById('ph').textContent = data.ph.toFixed(1);
        setSensorStatus('phStatus', getPhStatus(data.ph));
    }
}

function getTempStatus(val) {
    if (val > 35 || val < 10) return 'critical';
    if (val > 30 || val < 15) return 'warning';
    return '';
}

function getHumAmbStatus(val) {
    if (val > 85 || val < 20) return 'critical';
    if (val > 75 || val < 30) return 'warning';
    return '';
}

function getHumSueloStatus(val) {
    if (val < 30) return 'critical';
    if (val < 40 || val > 80) return 'warning';
    return '';
}

function getPhStatus(val) {
    if (val < 4.5 || val > 9.0) return 'critical';
    if (val < 5.5 || val > 7.5) return 'warning';
    return '';
}

function setSensorStatus(elementId, status) {
    const el = document.getElementById(elementId);
    if (el) el.className = 'card-status ' + status;
}

// ============================================================
// UI ACTUADORES
// ============================================================

function actualizarActuadores(actuadores) {
    actuadores.forEach(act => {
        updateActuadorUI(act);
    });
}

function updateActuadorUI(act) {
    const btn = document.getElementById(`btn-${act.nombre}`);
    const card = document.getElementById(`act-${act.nombre}`);
    if (!btn) return;

    const isOn = act.estado_actual === 'ON';
    const now = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

    btn.innerHTML = `<span class="material-icons-round">power_settings_new</span><span class="btn-label">${isOn ? 'ON' : 'OFF'}</span>`;
    btn.className = `brutalist-btn ${isOn ? 'on' : 'off'}`;
    if (card) card.classList.toggle('active', isOn);

    const led = document.getElementById(`${act.nombre}-led`);
    const fill = document.getElementById(`${act.nombre}-fill`);
    const lastEl = document.getElementById(`${act.nombre}-last`);
    if (led) led.classList.toggle('active', isOn);
    if (fill) fill.style.width = isOn ? '100%' : '0%';
    if (lastEl && isOn) lastEl.textContent = now;
}

// ============================================================
// TOGGLE ACTUADOR
// ============================================================

async function toggleActuador(nombre, macetaNum) {
    const btn = document.getElementById(`btn-${nombre}`);
    const isOn = btn.classList.contains('on');
    const nuevoEstado = isOn ? 'OFF' : 'ON';
    const dispositivoId = currentInv + 1;

    let actuadorId, pin;
    if (nombre === 'buzzer') {
        actuadorId = CONFIG.getBuzzerId(dispositivoId);
        pin = 26;
    } else {
        actuadorId = CONFIG.getActuadorId(dispositivoId, macetaNum, nombre === 'bomba' ? 1 : nombre === 'ventilador' ? 2 : 3);
        pin = CONFIG.PIN_MAP[macetaNum][nombre];
    }

    const ok = await SupabaseClient.enviarComando(actuadorId, nombre, pin, nuevoEstado, dispositivoId);

    if (ok) {
        const now = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

        btn.innerHTML = `<span class="material-icons-round">power_settings_new</span><span class="btn-label">${nuevoEstado}</span>`;
        btn.className = `brutalist-btn ${nuevoEstado === 'ON' ? 'on' : 'off'}`;
        document.getElementById(`act-${nombre}`).classList.toggle('active', nuevoEstado === 'ON');

        const led = document.getElementById(`${nombre}-led`);
        const fill = document.getElementById(`${nombre}-fill`);
        const lastEl = document.getElementById(`${nombre}-last`);
        if (led) led.classList.toggle('active', nuevoEstado === 'ON');
        if (fill) fill.style.width = nuevoEstado === 'ON' ? '100%' : '0%';
        if (lastEl && nuevoEstado === 'ON') lastEl.textContent = now;
    }
}

// ============================================================
// GUARDAR CONFIGURACION
// ============================================================

async function guardarConfig() {
    const config = {
        temp_min: parseFloat(document.getElementById('cfg-temp-min').value),
        temp_max: parseFloat(document.getElementById('cfg-temp-max').value),
        hum_suelo_min: parseFloat(document.getElementById('cfg-hum-min').value),
        hum_suelo_max: parseFloat(document.getElementById('cfg-hum-max').value),
        ph_min: parseFloat(document.getElementById('cfg-ph-min').value),
        ph_max: parseFloat(document.getElementById('cfg-ph-max').value),
    };
    localStorage.setItem('huerto_config', JSON.stringify(config));

    const btn = document.querySelector('.btn-save');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round">check</span> Guardado';
    btn.style.background = '#16a34a';
    setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
    }, 2000);
}

// ============================================================
// CHART
// ============================================================

function initChart() {
    const ctx = document.getElementById('chartHistorico').getContext('2d');

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    borderWidth: 2,
                },
                {
                    label: 'Humedad Suelo (%)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    borderWidth: 2,
                },
                {
                    label: 'Humedad Ambiente (%)',
                    data: [],
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    borderWidth: 2,
                },
                {
                    label: 'pH',
                    data: [],
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    borderWidth: 2,
                    yAxisID: 'y1',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyle: 'circle' },
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                },
            },
            scales: {
                x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.5)' } },
                y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.5)' }, min: 0, max: 100 },
                y1: {
                    position: 'right',
                    ticks: { color: '#a855f7', font: { size: 10 } },
                    grid: { drawOnChartArea: false },
                    min: 0, max: 14,
                },
            },
        },
    });

    cargarHistorico();
}

async function cargarHistorico() {
    const dispositivoId = currentInv + 1;
    const ids = CONFIG.getSensoresMaceta(dispositivoId, currentMaceta);

    const lecturas = await SupabaseClient.query('monitoreo_lecturas',
        `sensor_id=in.(${ids.temp},${ids.hum_amb},${ids.hum_suelo},${ids.ph})&order=fecha_hora.desc&limit=${CONFIG.CHART_POINTS}`
    );
    if (!lecturas || lecturas.length === 0) return;

    const temporal = {};
    lecturas.forEach(l => {
        const fecha = new Date(l.fecha_hora);
        const ts = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
        const tsFull = fecha.toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Lima' });
        if (!temporal[ts]) temporal[ts] = { full: tsFull };
        if (l.sensor_id === ids.temp) temporal[ts].temp = l.valor_lectura;
        if (l.sensor_id === ids.hum_amb) temporal[ts].humAmb = l.valor_lectura;
        if (l.sensor_id === ids.hum_suelo) temporal[ts].humSuelo = l.valor_lectura;
        if (l.sensor_id === ids.ph) temporal[ts].ph = l.valor_lectura;
    });

    const labels = Object.keys(temporal).reverse();
    chart.data.labels = labels;
    chart.data.datasets[0].data = labels.map(k => temporal[k].temp || null);
    chart.data.datasets[1].data = labels.map(k => temporal[k].humSuelo || null);
    chart.data.datasets[2].data = labels.map(k => temporal[k].humAmb || null);
    chart.data.datasets[3].data = labels.map(k => temporal[k].ph || null);
    chart.update();

    const tbody = document.getElementById('dataTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        labels.forEach(k => {
            const d = temporal[k];
            tbody.innerHTML += `<tr>
                <td>${d.full || k}</td>
                <td>${d.temp !== undefined ? d.temp.toFixed(1) : '-'}</td>
                <td>${d.humAmb !== undefined ? d.humAmb.toFixed(1) : '-'}</td>
                <td>${d.humSuelo !== undefined ? d.humSuelo.toFixed(0) : '-'}</td>
                <td>${d.ph !== undefined ? d.ph.toFixed(2) : '-'}</td>
            </tr>`;
        });
    }

    const label = document.getElementById('autoRefreshLabel');
    if (label) {
        const now = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Lima' });
        label.textContent = 'Auto 10s | ' + now;
    }
}

function iniciarAutoRefreshHistorico() {
    if (historicoTimer) clearInterval(historicoTimer);
    historicoTimer = setInterval(cargarHistorico, 10000);
}

function toggleVistaDatos() {
    vistaTabla = !vistaTabla;
    const chartEl = document.getElementById('chartContainer');
    const tableEl = document.getElementById('dataTableContainer');
    const btn = document.getElementById('btnToggleData');

    if (vistaTabla) {
        chartEl.style.display = 'none';
        tableEl.style.display = 'block';
        btn.innerHTML = '<span class="material-icons-round">show_chart</span><span>Grafico</span>';
    } else {
        chartEl.style.display = 'block';
        tableEl.style.display = 'none';
        btn.innerHTML = '<span class="material-icons-round">table_chart</span><span>Tabla</span>';
    }
}

// ============================================================
// CARGAR CONFIG GUARDADA
// ============================================================

(function loadConfig() {
    const saved = localStorage.getItem('huerto_config');
    if (saved) {
        const c = JSON.parse(saved);
        document.getElementById('cfg-temp-min').value = c.temp_min;
        document.getElementById('cfg-temp-max').value = c.temp_max;
        document.getElementById('cfg-hum-min').value = c.hum_suelo_min;
        document.getElementById('cfg-hum-max').value = c.hum_suelo_max;
        if (c.ph_min !== undefined) document.getElementById('cfg-ph-min').value = c.ph_min;
        if (c.ph_max !== undefined) document.getElementById('cfg-ph-max').value = c.ph_max;
    }
})();

// ============================================================
// MODAL DETALLE SENSOR - CLICK EN TARJETA
// ============================================================

let sensorChart = null;
let sensorModalData = [];

const SENSOR_CONFIG = {
    temp:     { icon: 'thermostat',             label: 'Temperatura',      unit: '°C',  color: '#ef4444', key: 'temp' },
    hum_amb:  { icon: 'water_drop',             label: 'Humedad Ambiente', unit: '%',   color: '#06b6d4', key: 'hum_amb' },
    hum_suelo:{ icon: 'grass',                  label: 'Humedad Suelo',    unit: '%',   color: '#22c55e', key: 'hum_suelo' },
    ph:       { icon: 'science',                label: 'pH Suelo',         unit: 'pH',  color: '#a855f7', key: 'ph' }
};

function initSensorModals() {
    const cards = document.querySelectorAll('.sensor-card');
    cards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const tipo = card.dataset.sensor;
            if (tipo && SENSOR_CONFIG[tipo]) abrirSensorModal(tipo);
        });
    });

    const closeBtn = document.getElementById('sensorModalClose');
    const modal = document.getElementById('sensorModal');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    document.getElementById('sensorTabTabla').addEventListener('click', () => switchSensorView('tabla'));
    document.getElementById('sensorTabGrafico').addEventListener('click', () => switchSensorView('grafico'));
}

function switchSensorView(view) {
    document.getElementById('sensorTabTabla').classList.toggle('active', view === 'tabla');
    document.getElementById('sensorTabGrafico').classList.toggle('active', view === 'grafico');
    document.getElementById('sensorTablaView').style.display = view === 'tabla' ? 'block' : 'none';
    document.getElementById('sensorGraficoView').style.display = view === 'grafico' ? 'block' : 'none';
    if (view === 'grafico' && sensorChart) sensorChart.update();
}

function getSensorEstado(valor, tipo) {
    const c = CONFIG;
    if (tipo === 'temp') {
        if (valor < c.TEMP_MIN || valor > c.TEMP_MAX) return valor < c.TEMP_MIN - 3 || valor > c.TEMP_MAX + 3 ? 'danger' : 'alert';
    } else if (tipo === 'hum_suelo') {
        if (valor < c.HUM_SUELO_MIN || valor > c.HUM_SUELO_MAX) return valor < c.HUM_SUELO_MIN - 10 || valor > c.HUM_SUELO_MAX + 10 ? 'danger' : 'alert';
    } else if (tipo === 'ph') {
        if (valor < c.PH_MIN || valor > c.PH_MAX) return valor < c.PH_MIN - 0.5 || valor > c.PH_MAX + 0.5 ? 'danger' : 'alert';
    } else if (tipo === 'hum_amb') {
        if (valor < 30 || valor > 85) return valor < 20 || valor > 90 ? 'danger' : 'alert';
    }
    return 'ok';
}

async function abrirSensorModal(tipo) {
    const cfg = SENSOR_CONFIG[tipo];
    const dispositivoId = currentInv + 1;
    const ids = CONFIG.getSensoresMaceta(dispositivoId, currentMaceta);
    const sensorId = ids[cfg.key];

    document.getElementById('sensorModalIcon').textContent = cfg.icon;
    document.getElementById('sensorModalTitle').textContent = cfg.label + ' - Maceta ' + currentMaceta;
    document.getElementById('sensorTablaCol').textContent = cfg.label + ' (' + cfg.unit + ')';
    document.getElementById('sensorModal').classList.add('active');
    switchSensorView('tabla');

    const lecturas = await SupabaseClient.query('monitoreo_lecturas',
        `sensor_id=eq.${sensorId}&order=fecha_hora.desc&limit=100`
    );

    sensorModalData = (lecturas || []).reverse();
    renderSensorTabla(sensorModalData, cfg);
    renderSensorGrafico(sensorModalData, cfg);
    renderSensorStats(sensorModalData, cfg);
}

function renderSensorTabla(data, cfg) {
    const tbody = document.getElementById('sensorTablaBody');
    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary);">Sin datos</td></tr>';
        return;
    }
    data.forEach(l => {
        const estado = getSensorEstado(l.valor_lectura, cfg.key);
        const fecha = new Date(l.fecha_hora);
        const ts = fecha.toLocaleString('es-PE', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone:'America/Lima' });
        const estadoLabel = estado === 'ok' ? 'Estable' : estado === 'alert' ? 'Alerta' : 'Peligro';
        tbody.innerHTML += `<tr class="row-${estado}">
            <td>${ts}</td>
            <td>${l.valor_lectura.toFixed(cfg.key === 'ph' ? 2 : 1)} ${cfg.unit}</td>
            <td><span class="sensor-estado-badge ${estado}">${estadoLabel}</span></td>
        </tr>`;
    });
}

function renderSensorGrafico(data, cfg) {
    const ctx = document.getElementById('sensorChart');
    if (sensorChart) sensorChart.destroy();

    const labels = data.map(l => {
        const d = new Date(l.fecha_hora);
        return d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit', timeZone:'America/Lima' });
    });
    const values = data.map(l => l.valor_lectura);

    const bgColors = data.map(l => {
        const e = getSensorEstado(l.valor_lectura, cfg.key);
        return e === 'ok' ? 'rgba(34,197,94,0.15)' : e === 'alert' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.25)';
    });

    const limitMin = cfg.key === 'temp' ? CONFIG.TEMP_MIN : cfg.key === 'hum_suelo' ? CONFIG.HUM_SUELO_MIN : cfg.key === 'ph' ? CONFIG.PH_MIN : 30;
    const limitMax = cfg.key === 'temp' ? CONFIG.TEMP_MAX : cfg.key === 'hum_suelo' ? CONFIG.HUM_SUELO_MAX : cfg.key === 'ph' ? CONFIG.PH_MAX : 85;

    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: cfg.label,
                data: values,
                borderColor: cfg.color,
                backgroundColor: bgColors,
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: data.map(l => {
                    const e = getSensorEstado(l.valor_lectura, cfg.key);
                    return e === 'ok' ? '#22c55e' : e === 'alert' ? '#f59e0b' : '#ef4444';
                }),
                pointBorderColor: data.map(l => {
                    const e = getSensorEstado(l.valor_lectura, cfg.key);
                    return e === 'ok' ? '#22c55e' : e === 'alert' ? '#f59e0b' : '#ef4444';
                }),
                fill: true,
                tension: 0.3
            }, {
                label: 'Min',
                data: Array(labels.length).fill(limitMin),
                borderColor: 'rgba(245,158,11,0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            }, {
                label: 'Max',
                data: Array(labels.length).fill(limitMax),
                borderColor: 'rgba(239,68,68,0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: '#aaa', font: { family: 'JetBrains Mono', size: 10 } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ctx.dataset.label + ': ' + (ctx.parsed.y !== null ? ctx.parsed.y.toFixed(cfg.key === 'ph' ? 2 : 1) : '-') + ' ' + cfg.unit
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#666', font: { family: 'JetBrains Mono', size: 9 }, maxRotation: 45 }, grid: { color: '#1a1a1a' } },
                y: { ticks: { color: '#666', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: '#1a1a1a' } }
            }
        }
    });
}

function renderSensorStats(data, cfg) {
    const container = document.getElementById('sensorStats');
    if (data.length === 0) { container.innerHTML = ''; return; }
    const vals = data.map(l => l.valor_lectura);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const alertCount = data.filter(l => getSensorEstado(l.valor_lectura, cfg.key) !== 'ok').length;
    const okCount = data.length - alertCount;

    container.innerHTML = `
        <div class="sensor-stat-item"><div class="stat-dot ok"></div>Min: ${min.toFixed(cfg.key === 'ph' ? 2 : 1)}${cfg.unit}</div>
        <div class="sensor-stat-item"><div class="stat-dot alert"></div>Max: ${max.toFixed(cfg.key === 'ph' ? 2 : 1)}${cfg.unit}</div>
        <div class="sensor-stat-item"><div class="stat-dot ok"></div>Prom: ${avg.toFixed(cfg.key === 'ph' ? 2 : 1)}${cfg.unit}</div>
        <div class="sensor-stat-item"><div class="stat-dot ok"></div>Estables: ${okCount}</div>
        <div class="sensor-stat-item"><div class="stat-dot danger"></div>Alertas: ${alertCount}</div>
    `;
}

// ============================================================
// MODO SIMULACION - LAZO CERRADO
// ============================================================

let overrideTimer = null;
let overrideStartTime = 0;
const OVERRIDE_DURATION = 60000; // 60 segundos para estabilizar

/**
 * Enviar alerta de simulacion al ESP32 via Supabase
 * @param {string} tipoAlerta - Tipo de alerta (sequia, ph_bajo, ph_alto, temp_alta, hum_baja)
 * @param {string} sensorTipo - Tipo de sensor (hum_suelo, ph, temp, hum_amb)
 * @param {number} valorForzado - Valor critico a forzar
 */
async function enviarAlerta(tipoAlerta, sensorTipo, valorForzado) {
    const maceta = currentMaceta;
    const dispositivoId = currentInv + 1;
    
    console.log(`[SIM] Enviando alerta: ${tipoAlerta} -> ${sensorTipo} = ${valorForzado} (MAC-${maceta}, DEV-${dispositivoId})`);
    console.log(`[SIM] SupabaseClient defined:`, typeof SupabaseClient);
    console.log(`[SIM] insert method:`, typeof SupabaseClient.insert);
    
    try {
        // Insertar en tabla simulacion_alertas via Supabase REST
        const result = await SupabaseClient.insert('simulacion_alertas', {
            tipo_alerta: tipoAlerta,
            sensor_tipo: sensorTipo,
            valor_forzado: valorForzado,
            maceta_numero: maceta,
            dispositivo_id: dispositivoId,
            activa: true
        });
        
        if (result) {
            // Mostrar indicador visual
            mostrarOverrideStatus(tipoAlerta, sensorTipo, valorForzado);
            
            // Cambiar color de la tarjeta del sensor afectado
            resaltarSensor(sensorTipo, true);
            
            console.log(`[SIM] Alerta enviada exitosamente`);
        } else {
            console.error(`[SIM] Error al enviar alerta`);
        }
    } catch (error) {
        console.error('[SIM] Error:', error);
    }
}

/**
 * Mostrar indicador de override activo con barra de progreso
 */
function mostrarOverrideStatus(tipoAlerta, sensorTipo, valorForzado) {
    const statusDiv = document.getElementById('overrideStatus');
    const infoSpan = document.getElementById('overrideInfo');
    const progressBar = document.getElementById('overrideProgressBar');
    
    const labels = {
        'sequia': 'SEQUIA - Humedad Suelo',
        'ph_bajo': 'pH BAJO',
        'ph_alto': 'pH ALTO',
        'temp_alta': 'TEMPERATURA ALTA',
        'hum_baja': 'HUMEDAD AMBIENTE BAJA'
    };
    
    infoSpan.textContent = `${labels[tipoAlerta]} -> ${valorForzado}`;
    statusDiv.style.display = 'flex';
    
    const btnMap = {
        'sequia': 'btn-sim-sequia',
        'ph_bajo': 'btn-sim-phbajo',
        'ph_alto': 'btn-sim-phalto',
        'temp_alta': 'btn-sim-phalt',
        'hum_baja': 'btn-sim-humbaja'
    };
    
    const btn = document.getElementById(btnMap[tipoAlerta]);
    if (btn) btn.classList.add('sim-active');
    
    overrideStartTime = Date.now();
    if (overrideTimer) clearInterval(overrideTimer);
    
    overrideTimer = setInterval(() => {
        const elapsed = Date.now() - overrideStartTime;
        const progress = Math.min((elapsed / OVERRIDE_DURATION) * 100, 100);
        progressBar.style.width = `${progress}%`;
        
        if (progress >= 100) {
            clearInterval(overrideTimer);
            ocultarOverrideStatus();
            resaltarSensor(sensorTipo, false);
            if (btn) btn.classList.remove('sim-active');
        }
    }, 100);
}

/**
 * Ocultar indicador de override
 */
function ocultarOverrideStatus() {
    const statusDiv = document.getElementById('overrideStatus');
    const progressBar = document.getElementById('overrideProgressBar');
    
    statusDiv.style.display = 'none';
    statusDiv.classList.remove('pulse-animation');
    progressBar.style.width = '0%';
    
    if (overrideTimer) {
        clearInterval(overrideTimer);
        overrideTimer = null;
    }
}

/**
 * Resaltar tarjeta de sensor con color de override
 */
function resaltarSensor(sensorTipo, activar) {
    const cards = document.querySelectorAll('.sensor-card');
    cards.forEach(card => {
        if (card.dataset.sensor === sensorTipo) {
            if (activar) {
                card.classList.add('sensor-override');
            } else {
                card.classList.remove('sensor-override');
            }
        }
    });
}
