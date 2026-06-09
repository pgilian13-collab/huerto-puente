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

    pollTimer = setInterval(cargarDatos, CONFIG.POLL_INTERVAL);
    console.log('[APP] Iniciado');

    const loader = document.getElementById('loader');
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 500);

    const fab = document.getElementById('fabConfig');
    if (fab) {
        fab.addEventListener('click', () => {
            const panel = document.getElementById('config-panel');
            if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
