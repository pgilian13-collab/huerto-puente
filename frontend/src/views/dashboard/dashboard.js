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

        // Override status
        html += '<div id="overrideStatus" class="override-status" style="display:none;">';
        html += '<span class="material-icons-round">warning</span><span>OVERRIDE: </span><span id="overrideInfo"></span>';
        html += '<span id="overridePhaseLabel" class="override-phase-label">DEGRADANDO</span>';
        html += '<div class="override-progress"><div class="override-progress-bar" id="overrideProgressBar"></div></div>';
        html += '</div>';

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
    }

    function loadChartData() {
        var inv = AppState.get('currentInv') || 0;
        SensorService.fetchHistory(inv, 100).then(function(rows) { renderChart(rows); });
    }

    function onSensorsUpdated(data) {
        updateSensors(data);
    }

    function onMacetaChanged() {
        var data = AppState.get('sensors') || {};
        updateSensors(data);
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

        if (!rows || rows.length === 0) {
            canvas.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-family:JetBrains Mono;font-size:12px;letter-spacing:1px;">SIN DATOS HISTORICOS</div>';
            return;
        }

        var sensorNames = { temp: 'Temperatura', hum_amb: 'Humedad Amb', hum_suelo: 'Hum Suelo', ph: 'pH' };
        var colors = { temp: '#ef4444', hum_amb: '#3b82f6', hum_suelo: '#22c55e', ph: '#f59e0b' };
        var inv = AppState.get('currentInv') || 0;
        var ids = SensorService.getSensorIds(inv + 1);

        var bySensor = {};
        rows.forEach(function(r) {
            if (!bySensor[r.sensor_id]) bySensor[r.sensor_id] = [];
            bySensor[r.sensor_id].push({ x: new Date(r.fecha_hora), y: r.valor_lectura });
        });

        var datasets = [];
        var typeMap = { 0: 'temp', 1: 'hum_amb', 2: 'hum_suelo', 3: 'ph', 4: 'hum_suelo', 5: 'ph', 6: 'hum_suelo', 7: 'ph', 8: 'hum_suelo', 9: 'ph' };

        ids.forEach(function(id, i) {
            var key = typeMap[i];
            if (bySensor[id]) {
                datasets.push({
                    label: sensorNames[key] + (i > 1 ? ' M' + Math.ceil((i - 1) / 2) : ''),
                    data: bySensor[id].reverse(),
                    borderColor: colors[key],
                    backgroundColor: colors[key] + '20',
                    tension: 0.3,
                    pointRadius: 1
                });
            }
        });

        chart = new Chart(canvas, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { type: 'time', time: { unit: 'hour' }, grid: { color: '#1e1e1e' }, ticks: { color: '#666' } }, y: { grid: { color: '#1e1e1e' }, ticks: { color: '#666' } } },
                plugins: { legend: { labels: { color: '#ccc', font: { family: 'JetBrains Mono', size: 11 } } } }
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
        console.log('[CONFIG] Umbrales guardados');
    }

    return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') window.DashboardModule = DashboardModule;
