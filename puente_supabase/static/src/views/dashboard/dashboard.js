// ============================================================
// Dashboard Module - Main sensor/actuator overview
// ============================================================

var DashboardModule = (function() {
    function init() {
        render();
        loadData();
        EventBus.on('sensors:updated', onSensorsUpdated);
        EventBus.on('maceta:selected', onMacetaChanged);
    }

    function destroy() {
        EventBus.off('sensors:updated', onSensorsUpdated);
        EventBus.off('maceta:selected', onMacetaChanged);
    }

    function render() {
        var el = document.getElementById('view-dashboard');
        if (!el) return;
        el.innerHTML = buildHTML();
        bindEvents();
    }

    function buildHTML() {
        var inv = AppState.get('currentInvId') || 1;
        var mac = AppState.get('currentMaceta') || 1;

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
            html += '<div class="act-info-item"><span class="act-info-label">Estado</span><span class="act-info-val" id="' + name + '-fill">OFF</span></div>';
            html += '<div class="act-info-item"><span class="act-info-label">Modo</span><span class="act-info-val" id="' + name + '-mode">MANUAL</span></div>';
            html += '</div>';
            html += '<div class="act-status-bar"><div class="act-status-fill" id="' + name + '-fill-bar" style="width:0%"></div></div>';
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
        html += '<div class="sim-card sim-temp"><button class="brutalist-btn sim-btn" id="btn-sim-temp" data-sim="temp" data-sensor="temp"><span class="material-icons-round">thermostat</span><span class="btn-label">TEMP</span></button><div class="sim-input-wrap"><input type="number" class="sim-input" id="val-temp" value="45.0" min="-10" max="60" step="0.1"><span class="sim-unit">C</span></div></div>';
        html += '<div class="sim-card sim-hum"><button class="brutalist-btn sim-btn" id="btn-sim-hum" data-sim="hum_amb" data-sensor="hum_amb"><span class="material-icons-round">air</span><span class="btn-label">HUMEDAD</span></button><div class="sim-input-wrap"><input type="number" class="sim-input" id="val-hum" value="20.0" min="0" max="100" step="0.1"><span class="sim-unit">%</span></div></div>';
        html += '</div></div>';

        return html;
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
    }

    function loadData() {
        var inv = AppState.get('currentInv') || 0;
        SensorService.fetchLatest(inv).then(function(data) {
            AppState.set('sensors', data);
            updateSensors(data);
        });
        ActuatorService.fetchActuadores(inv);
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

    return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') window.DashboardModule = DashboardModule;
