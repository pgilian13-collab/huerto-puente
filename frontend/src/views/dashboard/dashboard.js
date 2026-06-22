// ============================================================
// Dashboard Module - Complete view with sensors, actuators,
// historical chart, config, and simulation
// ============================================================

var DashboardModule = (function() {
    var chart = null;

    function init() {
        render();
        loadData();
        EventBus.on('sensors:updated', onSensorsUpdated);
        EventBus.on('maceta:selected', onMacetaChanged);
    }

    function destroy() {
        EventBus.off('sensors:updated', onSensorsUpdated);
        EventBus.off('maceta:selected', onMacetaChanged);
        if (chart) { chart.destroy(); chart = null; }
    }

    function render() {
        var el = document.getElementById('view-dashboard');
        if (!el) return;
        el.innerHTML = buildHTML();
        bindEvents();
        initChart();
    }

    function buildHTML() {
        var inv = AppState.get('currentInvId') || 1;
        var mac = AppState.get('currentMaceta') || 1;
        var u = AppState.get('umbrales') || {};

        var html = '';

        // Maceta tabs
        html += '<div class="maceta-nav" id="macetaTabs">';
        for (var m = 1; m <= 4; m++) {
            html += '<div class="maceta-tab' + (m === mac ? ' active' : '') + '" data-maceta="' + m + '">MAC-' + m + '</div>';
        }
        html += '</div>';

        // Sensors grid
        html += '<div class="section-title"><span class="material-icons-round">sensors</span> Sensores - INV-0' + inv + ' MAC-' + mac + '</div>';
        html += '<div class="sensors-grid">';
        html += '<div class="sensor-card" data-sensor="temp"><div class="corner-tl"></div><div class="corner-tr"></div><div class="corner-bl"></div><div class="corner-br"></div><div class="rivet rivet-tl"></div><div class="rivet rivet-tr"></div><div class="scan-line"></div><div class="card-top"><div class="card-icon temp"><span class="material-icons-round">thermostat</span></div><div class="card-label">Temperatura</div><div class="card-status" id="tempStatus"><span class="status-text">--</span></div></div><div class="card-value"><span class="value" id="temp">--</span><span class="unit">C</span></div></div>';

        html += '<div class="sensor-card" data-sensor="hum_amb"><div class="corner-tl"></div><div class="corner-tr"></div><div class="corner-bl"></div><div class="corner-br"></div><div class="rivet rivet-tl"></div><div class="rivet rivet-tr"></div><div class="scan-line"></div><div class="card-top"><div class="card-icon hum-amb"><span class="material-icons-round">air</span></div><div class="card-label">Humedad Ambiente</div><div class="card-status" id="humAmbStatus"><span class="status-text">--</span></div></div><div class="card-value"><span class="value" id="humAmb">--</span><span class="unit">%</span></div></div>';

        html += '<div class="sensor-card" data-sensor="hum_suelo"><div class="corner-tl"></div><div class="corner-tr"></div><div class="corner-bl"></div><div class="corner-br"></div><div class="rivet rivet-tl"></div><div class="rivet rivet-tr"></div><div class="scan-line"></div><div class="card-top"><div class="card-icon hum-suelo"><span class="material-icons-round">water_drop</span></div><div class="card-label">Humedad Suelo</div><div class="card-status" id="humSueloStatus"><span class="status-text">--</span></div></div><div class="card-value"><span class="value" id="humSuelo">--</span><span class="unit">%</span></div></div>';

        html += '<div class="sensor-card" data-sensor="ph"><div class="corner-tl"></div><div class="corner-tr"></div><div class="corner-bl"></div><div class="corner-br"></div><div class="rivet rivet-tl"></div><div class="rivet rivet-tr"></div><div class="scan-line"></div><div class="card-top"><div class="card-icon ph"><span class="material-icons-round">science</span></div><div class="card-label">pH Suelo</div><div class="card-status" id="phStatus"><span class="status-text">--</span></div></div><div class="card-value"><span class="value" id="ph">--</span><span class="unit">pH</span></div></div>';
        html += '</div>';

        // Actuators
        html += '<div class="section-title"><span class="material-icons-round">settings_remote</span> Actuadores - MAC-' + mac + '</div>';
        html += '<div class="panel"><div class="panel-header"><span class="material-icons-round">developer_board</span><h3>Control de Actuadores</h3><div class="panel-tag">SYS//CTRL</div></div>';
        html += '<div class="actuators-grid">';

        var actuators = ['bomba', 'ventilador', 'pulverizador'];
        var icons = { bomba: 'water_drop', ventilador: 'air', pulverizador: 'spray' };
        var colors = { bomba: 'act-icon-bomba', ventilador: 'act-icon-vent', pulverizador: 'act-icon-pulv' };

        actuators.forEach(function(name) {
            html += '<div class="act-card" id="act-' + name + '">';
            html += '<div class="act-header"><div class="act-icon-wrap ' + colors[name] + '"><span class="material-icons-round">' + icons[name] + '</span></div>';
            html += '<div class="act-title-block"><div class="act-title">' + name.toUpperCase() + '</div><div class="act-subtitle">MAC-' + mac + '</div></div>';
            html += '<div class="act-status-led" id="' + name + '-led"></div></div>';
            html += '<div class="act-info-grid">';
            html += '<div class="act-info-item"><span class="act-info-label">Estado</span><span class="act-info-val" id="' + name + '-state">OFF</span></div>';
            html += '<div class="act-info-item"><span class="act-info-label">Modo</span><span class="act-info-val" id="' + name + '-mode">MANUAL</span></div>';
            html += '</div>';
            html += '<div class="act-status-bar"><div class="act-status-fill" id="' + name + '-bar" style="width:0%"></div></div>';
            html += '<button class="brutalist-btn off" id="btn-' + name + '" data-actuator="' + name + '"><span class="material-icons-round">power_settings_new</span><span class="btn-label">OFF</span></button>';
            html += '</div>';
        });

        html += '</div></div>';

        // Override container (multi-override)
        html += '<div id="overrideContainer" class="override-container"></div>';

        // Simulation panel
        html += '<div class="panel"><div class="panel-header"><span class="material-icons-round">science</span><h3>Simulacion - Lazo Cerrado</h3><div class="panel-tag">SYS//SIM_CTRL</div></div>';
        html += '<div class="sim-description"><span class="material-icons-round">info</span> Envie alertas de simulacion al ESP32.</div>';
        html += '<div class="alert-buttons">';
        html += '<div class="sim-card sim-sequia"><button class="brutalist-btn sim-btn" id="btn-sim-sequia" data-sim="sequia" data-sensor="hum_suelo"><span class="material-icons-round">water_drop</span><span class="btn-label">SEQUIA</span></button><div class="sim-input-wrap"><input type="number" class="sim-input" id="val-sequia" value="15.0" min="0" max="100" step="0.1"><span class="sim-unit">%</span></div></div>';
        html += '<div class="sim-card sim-ph"><button class="brutalist-btn sim-btn" id="btn-sim-ph" data-sim="ph" data-sensor="ph"><span class="material-icons-round">science</span><span class="btn-label">pH</span></button><div class="sim-input-wrap"><input type="number" class="sim-input" id="val-ph" value="4.5" min="0" max="14" step="0.1"><span class="sim-unit">pH</span></div></div>';
        html += '<div class="sim-card sim-temp"><button class="brutalist-btn sim-btn" id="btn-sim-temp" data-sim="temp" data-sensor="temp"><span class="material-icons-round">thermostat</span><span class="btn-label">TEMP</span></button><div class="sim-badge">COMPARTIDO</div><div class="sim-input-wrap"><input type="number" class="sim-input" id="val-temp" value="45.0" min="-10" max="60" step="0.1"><span class="sim-unit">C</span></div></div>';
        html += '<div class="sim-card sim-hum"><button class="brutalist-btn sim-btn" id="btn-sim-hum" data-sim="hum_amb" data-sensor="hum_amb"><span class="material-icons-round">air</span><span class="btn-label">HUMEDAD</span></button><div class="sim-badge">COMPARTIDO</div><div class="sim-input-wrap"><input type="number" class="sim-input" id="val-hum" value="20.0" min="0" max="100" step="0.1"><span class="sim-unit">%</span></div></div>';
        html += '</div></div>';

        // Bottom grid: Chart + Config
        html += '<div class="bottom-grid">';

        // Historical chart
        html += '<div class="panel"><div class="panel-header"><span class="material-icons-round">timeline</span><h3>Historico - 24h</h3><div class="panel-header-actions"><div class="panel-tag">SYS//CHART</div></div></div>';
        html += '<div class="chart-container"><canvas id="chartHistorico"></canvas></div>';
        html += '<div style="padding:12px;text-align:right;"><button class="brutalist-btn" id="btnRefreshChart" style="padding:8px 16px;font-size:12px;"><span class="material-icons-round" style="font-size:16px;">refresh</span> Actualizar</button></div></div>';

        // Config
        html += '<div class="panel"><div class="panel-header"><span class="material-icons-round">settings</span><h3>Configuracion de Umbrales</h3><div class="panel-tag">SYS//CONFIG</div></div>';
        html += '<div class="config-grid">';
        html += configItem('Temperatura', u.temp, 'C', 'cfg-temp');
        html += configItem('Humedad Ambiente', u.humAmb, '%', 'cfg-hum');
        html += configItem('pH Suelo', u.ph, 'pH', 'cfg-ph');
        html += '</div>';
        html += '<div style="padding:16px;text-align:center;"><button class="brutalist-btn btn-save" id="btnSaveConfig"><span class="material-icons-round">save</span> Guardar Configuracion</button></div>';
        html += '</div>';

        html += '</div>';

        return html;
    }

    function configItem(label, range, unit, prefix) {
        return '<div class="config-item"><div class="section-title" style="font-size:13px;margin-bottom:8px;">' + label + '</div>' +
            '<div class="input-group"><span class="input-unit">Min</span><input type="number" id="' + prefix + '-min" value="' + (range ? range.min : 0) + '" step="0.1"><span class="input-unit">' + unit + '</span></div>' +
            '<div class="input-group"><span class="input-unit">Max</span><input type="number" id="' + prefix + '-max" value="' + (range ? range.max : 100) + '" step="0.1"><span class="input-unit">' + unit + '</span></div>' +
            '</div>';
    }

    function bindEvents() {
        // Maceta tabs
        var macetaTabs = document.querySelectorAll('.maceta-tab');
        for (var i = 0; i < macetaTabs.length; i++) {
            macetaTabs[i].addEventListener('click', function() {
                EventBus.emit('maceta:changed', { maceta: parseInt(this.dataset.maceta) });
                document.querySelectorAll('.maceta-tab').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
            });
        }

        // Sensor cards -> modal
        var sensorCards = document.querySelectorAll('.sensor-card');
        for (var j = 0; j < sensorCards.length; j++) {
            sensorCards[j].addEventListener('click', function() {
                EventBus.emit('sensor-modal:open', this.dataset.sensor);
            });
        }

        // Actuator buttons
        var actBtns = document.querySelectorAll('[data-actuator]');
        for (var k = 0; k < actBtns.length; k++) {
            actBtns[k].addEventListener('click', function() {
                EventBus.emit('actuator:toggle', this.dataset.actuator);
            });
        }

        // Simulation buttons
        var simBtns = document.querySelectorAll('[data-sim]');
        for (var l = 0; l < simBtns.length; l++) {
            simBtns[l].addEventListener('click', function() {
                var tipo = this.dataset.sim;
                var sensor = this.dataset.sensor;
                var input = document.getElementById('val-' + tipo.replace('hum_amb', 'hum'));
                var val = input ? parseFloat(input.value) : 0;
                EventBus.emit('simulation:alert', { tipo: tipo, sensor: sensor, valor: val });
            });
        }

        // Chart refresh button
        var btnRefresh = document.getElementById('btnRefreshChart');
        if (btnRefresh) btnRefresh.addEventListener('click', loadChartData);

        // Config save button
        var btnSave = document.getElementById('btnSaveConfig');
        if (btnSave) btnSave.addEventListener('click', saveConfig);
    }

    function loadData() {
        var inv = AppState.get('currentInv') || 0;
        SensorService.fetchLatest(inv).then(function(data) {
            AppState.set('sensors', data);
            updateSensors(data);
        });
        ActuatorService.fetchActuadores(inv);
        loadChartData();
        loadConfigFromSupabase(inv);
    }

    function loadConfigFromSupabase(invIndex) {
        var deviceId = invIndex + 1;
        ApiService.sbQuery('configuracion', 'dispositivo_id=eq.' + deviceId).then(function(rows) {
            if (rows && rows.length > 0 && rows[0].umbrales) {
                var umbrales = rows[0].umbrales;
                AppState.set('umbrales', umbrales);
                AppState.persistUmbrales();
                var u = umbrales;
                setConfigInput('cfg-temp', u.temp);
                setConfigInput('cfg-hum', u.humAmb);
                setConfigInput('cfg-ph', u.ph);
                console.log('[CONFIG] Umbrales cargados desde Supabase');
            }
        }).catch(function(e) {
            console.error('[CONFIG] Error cargando umbrales:', e);
        });
    }

    function setConfigInput(prefix, range) {
        if (!range) return;
        var minEl = document.getElementById(prefix + '-min');
        var maxEl = document.getElementById(prefix + '-max');
        if (minEl) minEl.value = range.min;
        if (maxEl) maxEl.value = range.max;
    }

    function loadChartData() {
        var inv = AppState.get('currentInv') || 0;
        var mac = AppState.get('currentMaceta') || 1;
        SensorService.fetchHistoryForMaceta(inv, mac, 48).then(function(rows) {
            renderChart(rows);
        });
    }

    function onSensorsUpdated(data) {
        updateSensors(data);
    }

    function onMacetaChanged() {
        var data = AppState.get('sensors') || {};
        updateSensors(data);
        loadChartData();
        if (typeof OverrideManager !== 'undefined') OverrideManager.update();
    }

    function updateSensors(data) {
        var inv = AppState.get('currentInv') || 0;
        var mac = AppState.get('currentMaceta') || 1;
        var ids = SensorService.getMacetaSensorIds(inv + 1, mac);
        var shared = SensorService.getSharedSensorIds(inv + 1);

        var tempRow = data[shared.temp];
        var humAmbRow = data[shared.hum_amb];
        var humSueloRow = data[ids.hum_suelo];
        var phRow = data[ids.ph];

        if (tempRow) setSensor('temp', tempRow.valor_lectura);
        if (humAmbRow) setSensor('humAmb', humAmbRow.valor_lectura);
        if (humSueloRow) setSensor('humSuelo', humSueloRow.valor_lectura);
        if (phRow) setSensor('ph', phRow.valor_lectura);
    }

    function setSensor(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = parseFloat(value).toFixed(1);
    }

    function initChart() {
        setTimeout(loadChartData, 100);
    }

    function renderChart(rows) {
        var canvas = document.getElementById('chartHistorico');
        if (!canvas) return;
        if (chart) chart.destroy();

        var inv = AppState.get('currentInv') || 0;
        var mac = AppState.get('currentMaceta') || 1;
        var shared = SensorService.getSharedSensorIds(inv + 1);
        var macetaIds = SensorService.getMacetaSensorIds(inv + 1, mac);

        var temporal = {};
        if (rows && rows.length > 0) {
            rows.forEach(function(l) {
            var fecha = new Date(l.fecha_hora);
            var ts = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Lima' });
            if (!temporal[ts]) temporal[ts] = {};
            if (l.sensor_id === shared.temp) temporal[ts].temp = l.valor_lectura;
            if (l.sensor_id === shared.hum_amb) temporal[ts].humAmb = l.valor_lectura;
            if (l.sensor_id === macetaIds.hum_suelo) temporal[ts].humSuelo = l.valor_lectura;
            if (l.sensor_id === macetaIds.ph) temporal[ts].ph = l.valor_lectura;
        });
        }

        var labels = Object.keys(temporal).reverse();

        chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Temperatura (\u00B0C)',
                        data: labels.map(function(k) { return temporal[k].temp != null ? temporal[k].temp : null; }),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 2,
                        borderWidth: 2
                    },
                    {
                        label: 'Humedad Suelo (%)',
                        data: labels.map(function(k) { return temporal[k].humSuelo != null ? temporal[k].humSuelo : null; }),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 2,
                        borderWidth: 2
                    },
                    {
                        label: 'Humedad Ambiente (%)',
                        data: labels.map(function(k) { return temporal[k].humAmb != null ? temporal[k].humAmb : null; }),
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 2,
                        borderWidth: 2
                    },
                    {
                        label: 'pH',
                        data: labels.map(function(k) { return temporal[k].ph != null ? temporal[k].ph : null; }),
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 2,
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 }, usePointStyle: true, pointStyle: 'circle' }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: { ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(51,65,85,0.5)' } },
                    y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.5)' }, min: 0, max: 100 },
                    y1: {
                        position: 'right',
                        ticks: { color: '#a855f7', font: { size: 10 } },
                        grid: { drawOnChartArea: false },
                        min: 0, max: 14
                    }
                }
            }
        });
    }

    function saveConfig() {
        var umbrales = {
            temp: { min: parseFloat(document.getElementById('cfg-temp-min').value), max: parseFloat(document.getElementById('cfg-temp-max').value) },
            humAmb: { min: parseFloat(document.getElementById('cfg-hum-min').value), max: parseFloat(document.getElementById('cfg-hum-max').value) },
            humSuelo: { min: 40, max: 80 },
            ph: { min: parseFloat(document.getElementById('cfg-ph-min').value), max: parseFloat(document.getElementById('cfg-ph-max').value) }
        };
        AppState.set('umbrales', umbrales);
        AppState.persistUmbrales();

        var inv = AppState.get('currentInv') || 0;
        var deviceId = inv + 1;
        var payload = { dispositivo_id: deviceId, umbrales: umbrales, updated_at: new Date().toISOString() };
        ApiService.sbQuery('configuracion', 'dispositivo_id=eq.' + deviceId).then(function(existing) {
            if (existing && existing.length > 0) {
                return ApiService.sbPatch('configuracion', existing[0].id, payload);
            } else {
                return ApiService.sbInsert('configuracion', { dispositivo_id: deviceId, umbrales: umbrales });
            }
        }).then(function() {
            console.log('[CONFIG] Umbrales guardados en Supabase');
        }).catch(function(e) {
            console.error('[CONFIG] Error guardando en Supabase:', e);
        });

        var btn = document.querySelector('.btn-save');
        if (btn) {
            var orig = btn.innerHTML;
            btn.innerHTML = '<span class="material-icons-round">check</span> Guardado';
            btn.style.background = '#16a34a';
            setTimeout(function() { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
        }
    }

    return { init: init, destroy: destroy, loadConfigFromSupabase: loadConfigFromSupabase };
})();

if (typeof window !== 'undefined') window.DashboardModule = DashboardModule;

// ============================================================
// OverrideManager - Multi-override visualization
// Tracks up to 4 active overrides with independent progress
// Includes start delay and actuator visual sync
// ============================================================

var OverrideManager = (function() {
    var activeOverrides = [];
    var timer = null;

    var START_DELAY = 60000;

    var SENSOR_META = {
        temp:      { icon: 'thermostat', label: 'Temperatura', unit: '\u00B0C', shared: true },
        hum_amb:   { icon: 'air',        label: 'Humedad Amb', unit: '%',  shared: true },
        hum_suelo: { icon: 'water_drop', label: 'Hum Suelo',   unit: '%',  shared: false },
        ph:        { icon: 'science',    label: 'pH Suelo',    unit: 'pH', shared: false }
    };

    var PHASE_DURATIONS = { degrade: 420000, hold: 40000, recover: 200000 };
    var TOTAL_CYCLE = PHASE_DURATIONS.degrade + PHASE_DURATIONS.hold + PHASE_DURATIONS.recover;

    var ACTUATOR_MAP = {
        hum_suelo: 'bomba',
        temp: 'ventilador',
        hum_amb: 'pulverizador'
    };

    function add(sensor, maceta, valorObjetivo) {
        remove(sensor, maceta);
        activeOverrides.push({
            sensor: sensor,
            maceta: maceta,
            valorObjetivo: valorObjetivo,
            inicio: Date.now() + START_DELAY
        });
        update();
        startTimer();
    }

    function remove(sensor, maceta) {
        activeOverrides = activeOverrides.filter(function(o) {
            return !(o.sensor === sensor && o.maceta === maceta);
        });
    }

    function getPhase(o) {
        var now = Date.now();
        if (now < o.inicio) return 'waiting';
        var elapsed = now - o.inicio;
        if (elapsed < PHASE_DURATIONS.degrade) return 'degrading';
        if (elapsed < PHASE_DURATIONS.degrade + PHASE_DURATIONS.hold) return 'holding';
        if (elapsed < TOTAL_CYCLE) return 'recovering';
        return 'done';
    }

    function getProgress(o) {
        var now = Date.now();
        if (now < o.inicio) {
            return Math.min(100, ((START_DELAY - (o.inicio - now)) / START_DELAY) * 100);
        }
        var elapsed = now - o.inicio;
        return Math.min(100, (elapsed / TOTAL_CYCLE) * 100);
    }

    function update() {
        var mac = AppState.get('currentMaceta') || 1;
        var visible = activeOverrides.filter(function(o) {
            if (o.maceta === 0) return true;
            return o.maceta === mac;
        });
        renderOverrides(visible);
        updateSensorCards(visible);
        updateActuators(visible);
    }

    function renderOverrides(overrides) {
        var container = document.getElementById('overrideContainer');
        if (!container) return;
        if (overrides.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';

        var phaseLabel = {
            waiting: 'ESPERANDO',
            degrading: 'DEGRADANDO',
            holding: 'HOLDING',
            recovering: 'RECUPERANDO'
        };
        var html = '';
        overrides.forEach(function(o) {
            var meta = SENSOR_META[o.sensor];
            var phase = getPhase(o);
            if (phase === 'done') {
                remove(o.sensor, o.maceta);
                return;
            }
            var progress = getProgress(o);
            var macLabel = o.maceta === 0 ? 'Compartido' : 'MAC-' + o.maceta;
            html += '<div class="override-row">';
            html += '<span class="material-icons-round override-icon">' + meta.icon + '</span>';
            html += '<span class="override-label">' + meta.label + ' <span class="override-mac-badge">' + macLabel + '</span></span>';
            html += '<span class="override-phase-label phase-' + phase + '">' + phaseLabel[phase] + '</span>';
            html += '<div class="override-progress"><div class="override-progress-bar bar-' + phase + '" style="width:' + progress + '%"></div></div>';
            html += '</div>';
        });
        container.innerHTML = html;
    }

    function updateSensorCards(overrides) {
        document.querySelectorAll('.sensor-card').forEach(function(c) {
            c.classList.remove('sensor-override');
        });
        overrides.forEach(function(o) {
            var card = document.querySelector('.sensor-card[data-sensor="' + o.sensor + '"]');
            if (card) card.classList.add('sensor-override');
        });
    }

    function updateActuators(overrides) {
        var actuadores = { bomba: false, ventilador: false, pulverizador: false };

        overrides.forEach(function(o) {
            var phase = getPhase(o);
            if (phase === 'recovering') {
                var actName = ACTUATOR_MAP[o.sensor];
                if (actName) actuadores[actName] = true;
            }
        });

        for (var name in actuadores) {
            if (!actuadores.hasOwnProperty(name)) continue;
            var led = document.getElementById(name + '-led');
            var stateEl = document.getElementById(name + '-state');
            var btn = document.getElementById('btn-' + name);
            var bar = document.getElementById(name + '-bar');
            if (actuadores[name]) {
                if (led) led.classList.add('active');
                if (stateEl) stateEl.textContent = 'ON';
                if (btn) {
                    btn.classList.remove('off');
                    btn.classList.add('on');
                    var lbl = btn.querySelector('.btn-label');
                    if (lbl) lbl.textContent = 'ON';
                }
                if (bar) bar.style.width = '100%';
            } else {
                if (led) led.classList.remove('active');
                if (stateEl) stateEl.textContent = 'OFF';
                if (btn) {
                    btn.classList.remove('on');
                    btn.classList.add('off');
                    var lbl2 = btn.querySelector('.btn-label');
                    if (lbl2) lbl2.textContent = 'OFF';
                }
                if (bar) bar.style.width = '0%';
            }
        }
    }

    function startTimer() {
        if (timer) return;
        timer = setInterval(function() {
            activeOverrides = activeOverrides.filter(function(o) {
                return getPhase(o) !== 'done';
            });
            if (activeOverrides.length === 0) {
                clearInterval(timer);
                timer = null;
                document.querySelectorAll('.sensor-card').forEach(function(c) {
                    c.classList.remove('sensor-override');
                });
                updateActuators([]);
            }
            update();
        }, 500);
    }

    function getActive() { return activeOverrides; }

    return { add: add, remove: remove, update: update, getActive: getActive };
})();

if (typeof window !== 'undefined') window.OverrideManager = OverrideManager;
