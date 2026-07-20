// ============================================================
// Dashboard Module - Complete view with sensors, actuators,
// historical chart, config, and simulation
// ============================================================

var DashboardModule = (function() {
    var chart = null;
    var chartRefreshTimer = null;

    var SENSOR_RANGES = {
        temp:       { label: 'Temperatura',     unit: '\u00B0C', valId: 'temp',      minKey: 'temp_min',          maxKey: 'temp_max',          defMin: 15,  defMax: 30 },
        hum_amb:    { label: 'Humedad Amb',     unit: '%',       valId: 'humAmb',    minKey: 'humAmb_min',         maxKey: 'humAmb_max',         defMin: 30,  defMax: 85 },
        hum_suelo:  { label: 'Humedad Suelo',   unit: '%',       valId: 'humSuelo',  minKey: 'humSuelo_min',       maxKey: 'humSuelo_max',       defMin: 40,  defMax: 80 },
        ph:         { label: 'pH Suelo',        unit: 'pH',      valId: 'ph',        minKey: 'ph_min',             maxKey: 'ph_max',             defMin: 5.5, defMax: 7.5 }
    };

    function getCurrentMacetaConfig() {
        try {
            var inv = AppState.get('currentInv') || 0;
            var mac = AppState.get('currentMaceta') || 1;
            var key = 'huerto_config_inv' + (inv + 1) + '_mac' + mac;
            return JSON.parse(localStorage.getItem(key) || 'null');
        } catch (e) {
            return null;
        }
    }

    function getThreshold(minKey, maxKey, defMin, defMax) {
        var cfg = getCurrentMacetaConfig();
        var min = defMin, max = defMax;
        if (cfg) {
            if (minKey && cfg[minKey] !== undefined) min = cfg[minKey];
            if (maxKey && cfg[maxKey] !== undefined) max = cfg[maxKey];
        }
        return { min: min, max: max };
    }

    function setSkeletonActive(active) {
        try {
            document.querySelectorAll('.sensor-card').forEach(function(card) {
                if (card) card.classList.toggle('skeleton', !!active);
            });
        } catch (e) {}
    }

    function initTooltips() {
        try {
            document.querySelectorAll('.sensor-card[data-sensor]').forEach(function(card) {
                var sensorKey = card.getAttribute('data-sensor');
                if (!sensorKey || !SENSOR_RANGES[sensorKey]) return;
                var info = SENSOR_RANGES[sensorKey];
                var tip = card.querySelector('.sensor-tooltip');
                if (!tip) {
                    tip = document.createElement('div');
                    tip.className = 'sensor-tooltip';
                    card.appendChild(tip);
                }
                var valEl = document.getElementById(info.valId);
                var valTxt = valEl ? (valEl.textContent || '').trim() : '--';
                var th = getThreshold(info.minKey, info.maxKey, info.defMin, info.defMax);
                var status = '';
                if (valTxt && valTxt !== '--' && valTxt !== '-') {
                    var numVal = parseFloat(valTxt);
                    if (!isNaN(numVal)) {
                        if (numVal < th.min || numVal > th.max) status = 'crit';
                        else if (numVal < th.min * 1.1 || numVal > th.max * 0.9) status = 'warn';
                    }
                }
                tip.innerHTML =
                    '<div class="sensor-tooltip-row">' +
                        '<span class="sensor-tooltip-label">Rango</span>' +
                        '<span class="sensor-tooltip-val">' + th.min + ' - ' + th.max + ' ' + info.unit + '</span>' +
                    '</div>' +
                    '<div class="sensor-tooltip-row">' +
                        '<span class="sensor-tooltip-label">Actual</span>' +
                        '<span class="sensor-tooltip-val ' + status + '">' + valTxt + ' ' + info.unit + '</span>' +
                    '</div>';
            });
        } catch (e) {
            console.error('[DASHBOARD] initTooltips:', e);
        }
    }

    function init() {
        render();
        setSkeletonActive(true);
        var p = loadData();
        if (p && typeof p.then === 'function') {
            p.then(function() {
                setSkeletonActive(false);
                initTooltips();
            }).catch(function() {
                setSkeletonActive(false);
            });
        } else {
            setTimeout(function() { setSkeletonActive(false); initTooltips(); }, 600);
        }
        EventBus.on('sensors:updated', onSensorsUpdated);
        EventBus.on('maceta:selected', onMacetaChanged);
        EventBus.on('sidebar:selectInv', onInvernaderoChanged);
        if (typeof OverrideManager !== 'undefined') {
            var origUpdate = OverrideManager.update;
            OverrideManager.update = function() {
                origUpdate.apply(this, arguments);
                updateSimulationBadge();
            };
        }
    }

    function onInvernaderoChanged(idx) {
        var content = document.querySelector('.main-content');
        if (content) content.classList.add('tab-exit');
        setTimeout(function() {
            setSkeletonActive(true);
            render();
            var p = loadData();
            if (p && typeof p.then === 'function') {
                p.then(function() {
                    setSkeletonActive(false);
                    initTooltips();
                }).catch(function() {
                    setSkeletonActive(false);
                });
            } else {
                setTimeout(function() { setSkeletonActive(false); initTooltips(); }, 600);
            }
            if (content) content.classList.remove('tab-exit');
        }, 250);
    }

    function destroy() {
        EventBus.off('sensors:updated', onSensorsUpdated);
        EventBus.off('maceta:selected', onMacetaChanged);
        EventBus.off('sidebar:selectInv', onInvernaderoChanged);
        if (chartRefreshTimer) { clearTimeout(chartRefreshTimer); chartRefreshTimer = null; }
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
        html += '<div class="panel"><div class="panel-header"><span class="material-icons-round">timeline</span><h3>Historico - 24h</h3><div class="panel-header-actions"><div class="panel-tag">SYS//CHART</div><span id="simModeBadge" class="sim-mode-badge" style="display:none;">SIMULACION ACTIVA</span><span id="latencyBadge" class="latency-badge" style="display:none;">LATENCIA: --</span></div></div>';
        html += '<div class="chart-container"><canvas id="chartHistorico"></canvas></div>';
        html += '<div style="padding:12px;text-align:right;"><button class="brutalist-btn" id="btnRefreshChart" style="padding:8px 16px;font-size:12px;"><span class="material-icons-round" style="font-size:16px;">refresh</span> Actualizar</button></div></div>';

        // Config
        html += '<div class="panel"><div class="panel-header"><span class="material-icons-round">settings</span><h3>Configuracion de Umbrales</h3><div class="panel-tag">SYS//CONFIG</div></div>';
        html += '<div class="plant-selector-inline">';
        html += '<label class="config-label"><span class="material-icons-round">eco</span> Planta de esta maceta</label>';
        html += '<div class="plant-selector-row">';
        html += '<div class="plant-search-wrap"><input type="text" id="dashPlantSearchInput" class="plant-search-input" placeholder="Buscar planta del catalogo..."><div class="plant-dropdown plant-dropdown-dash" id="dashPlantDropdown"></div></div>';
        html += '<div class="plant-badge plant-badge-dash" id="dashPlantBadge" style="display:none"><span id="dashPlantBadgeName"></span><button class="plant-badge-remove" id="dashPlantBadgeRemove"><span class="material-icons-round">close</span></button></div>';
        html += '</div>';
        html += '<div class="plant-actions">';
        html += '<button class="brutalist-btn btn-plant-action" id="btnAddPlantDash"><span class="material-icons-round">add_circle</span><span class="btn-label">Agregar Planta</span></button>';
        html += '<button class="brutalist-btn btn-plant-action" id="btnShowRecommendationsDash"><span class="material-icons-round">lightbulb</span><span class="btn-label">Recomendaciones</span></button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="config-grid">';
        html += configItem('Temperatura', u.temp, 'C', 'cfg-temp');
        html += configItem('Humedad Ambiente', u.humAmb, '%', 'cfg-hum');
        html += configItem('Humedad Suelo', u.humSuelo, '%', 'cfg-humsuelo');
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

        // === Plant selector inline en dashboard ===
        bindDashPlantSelector();

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
                setConfigInput('cfg-humsuelo', u.humSuelo);
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
        if (chartRefreshTimer) clearTimeout(chartRefreshTimer);
        chartRefreshTimer = setTimeout(function() { loadChartData(); }, 2000);
    }

    function onMacetaChanged() {
        var data = AppState.get('sensors') || {};
        updateSensors(data);
        loadChartData();
        initTooltips();
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

        setSkeletonActive(false);
        initTooltips();
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
        var timestamps = [];
        if (rows && rows.length > 0) {
            rows.forEach(function(l) {
                var fecha = new Date(l.fecha_hora);
                var ts = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Lima' });
                if (!temporal[ts]) {
                    temporal[ts] = {};
                    timestamps.push({ ts: ts, date: fecha });
                }
                if (l.sensor_id === shared.temp) temporal[ts].temp = l.valor_lectura;
                if (l.sensor_id === shared.hum_amb) temporal[ts].humAmb = l.valor_lectura;
                if (l.sensor_id === macetaIds.hum_suelo) temporal[ts].humSuelo = l.valor_lectura;
                if (l.sensor_id === macetaIds.ph) temporal[ts].ph = l.valor_lectura;
            });
        }

        timestamps.sort(function(a, b) { return a.date - b.date; });
        var labels = timestamps.map(function(t) { return t.ts; });

        if (labels.length === 0) {
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#334155';
            ctx.font = '14px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos disponibles', canvas.width / 2, canvas.height / 2);
            ctx.font = '11px JetBrains Mono';
            ctx.fillStyle = '#64748b';
            ctx.fillText('Esperando datos del ESP32...', canvas.width / 2, canvas.height / 2 + 24);
            return;
        }

        // Gap detection: find regions with no data for > GAP_THRESHOLD ms
        var GAP_THRESHOLD = 30000;
        var gapRegions = [];
        for (var i = 1; i < timestamps.length; i++) {
            var diff = timestamps[i].date - timestamps[i - 1].date;
            if (diff > GAP_THRESHOLD) {
                gapRegions.push({ start: i - 1, end: i });
            }
        }

        // Build gap plugin data
        var gapPlugin = null;
        if (gapRegions.length > 0) {
            gapPlugin = {
                id: 'gapHighlight',
                beforeDraw: function(chart) {
                    var ctx = chart.ctx;
                    var xScale = chart.scales.x;
                    var yScale = chart.scales.y;
                    gapRegions.forEach(function(gap) {
                        var x1 = xScale.getPixelForValue(gap.start);
                        var x2 = xScale.getPixelForValue(gap.end);
                        ctx.save();
                        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                        ctx.fillRect(x1, yScale.top, x2 - x1, yScale.bottom - yScale.top);
                        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
                        ctx.lineWidth = 1;
                        ctx.setLineDash([4, 4]);
                        ctx.beginPath();
                        ctx.moveTo(x1, yScale.top);
                        ctx.lineTo(x1, yScale.bottom);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(x2, yScale.top);
                        ctx.lineTo(x2, yScale.bottom);
                        ctx.stroke();
                        ctx.restore();
                    });
                }
            };
        }

        var chartConfig = {
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
                        borderWidth: 2,
                        spanGaps: false
                    },
                    {
                        label: 'Humedad Suelo (%)',
                        data: labels.map(function(k) { return temporal[k].humSuelo != null ? temporal[k].humSuelo : null; }),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 2,
                        borderWidth: 2,
                        spanGaps: false
                    },
                    {
                        label: 'Humedad Ambiente (%)',
                        data: labels.map(function(k) { return temporal[k].humAmb != null ? temporal[k].humAmb : null; }),
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 2,
                        borderWidth: 2,
                        spanGaps: false
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
                        spanGaps: false,
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
        };

        if (gapPlugin) {
            chartConfig.plugins = [gapPlugin];
        }

        chart = new Chart(canvas, chartConfig);

        // Indicador de modo simulacion
        updateSimulationBadge();
    }

    function updateSimulationBadge() {
        var badge = document.getElementById('simModeBadge');
        if (!badge) return;
        var active = (typeof OverrideManager !== 'undefined' && OverrideManager.getActive)
            ? (OverrideManager.getActive().length > 0)
            : false;
        if (active) {
            badge.style.display = 'inline-flex';
            badge.textContent = 'SIMULACION ACTIVA';
        } else {
            badge.style.display = 'none';
        }
    }

    function updateLatencyBadge(latencyMs) {
        var badge = document.getElementById('latencyBadge');
        if (!badge) return;
        if (latencyMs == null || isNaN(latencyMs)) {
            badge.style.display = 'none';
            return;
        }
        var sec = (latencyMs / 1000).toFixed(1);
        badge.style.display = 'inline-flex';
        badge.textContent = 'LATENCIA: ' + sec + 's';
        badge.className = 'latency-badge';
        if (latencyMs < 5000) {
            badge.classList.add('ok');
        } else if (latencyMs < 15000) {
            badge.classList.add('warn');
        } else {
            badge.classList.add('crit');
        }
    }

    function val(id, fallback) {
        var el = document.getElementById(id);
        return el ? parseFloat(el.value) : fallback;
    }

    function saveConfig() {
        var umbrales = {
            temp: { min: val('cfg-temp-min', 15), max: val('cfg-temp-max', 30) },
            humAmb: { min: val('cfg-hum-min', 30), max: val('cfg-hum-max', 85) },
            humSuelo: { min: val('cfg-humsuelo-min', 40), max: val('cfg-humsuelo-max', 80) },
            ph: { min: val('cfg-ph-min', 5.5), max: val('cfg-ph-max', 7.5) }
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

    return { init: init, destroy: destroy, loadConfigFromSupabase: loadConfigFromSupabase, setSkeletonActive: setSkeletonActive, initTooltips: initTooltips, getThreshold: getThreshold, updateLatencyBadge: updateLatencyBadge };
})();

if (typeof window !== 'undefined') window.DashboardModule = DashboardModule;

// ============================================================
// Plant Selector inline en Dashboard
// ============================================================

function bindDashPlantSelector() {
    var input = document.getElementById('dashPlantSearchInput');
    var dropdown = document.getElementById('dashPlantDropdown');
    var badge = document.getElementById('dashPlantBadge');
    var badgeName = document.getElementById('dashPlantBadgeName');
    var badgeRemove = document.getElementById('dashPlantBadgeRemove');
    var btnAdd = document.getElementById('btnAddPlantDash');
    var btnRec = document.getElementById('btnShowRecommendationsDash');

    if (!input || !dropdown) return;

    function getPlants() {
        return (typeof ConfigModule !== 'undefined' && ConfigModule.allPlants)
            ? ConfigModule.allPlants
            : (window.CATALOGO_PLANTAS || []);
    }

    function normalize(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function renderDropdown(query) {
        var plants = getPlants();
        var q = normalize(query);
        var filtered = plants.filter(function(p) {
            return !q || normalize(p.nombre).indexOf(q) !== -1;
        }).slice(0, 12);
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="plant-dropdown-empty">Sin resultados</div>';
            return;
        }
        dropdown.innerHTML = filtered.map(function(p) {
            return '<div class="plant-dropdown-item" data-id="' + p.id + '">' +
                '<span class="plant-dropdown-name">' + p.nombre + '</span>' +
                '<span class="plant-dropdown-range">' + p.temp_min + '-' + p.temp_max + '\u00B0C</span>' +
                '</div>';
        }).join('');
        var items = dropdown.querySelectorAll('.plant-dropdown-item');
        for (var i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function() {
                var id = parseInt(this.getAttribute('data-id'));
                selectPlantFromCatalog(id);
                dropdown.classList.remove('active');
                input.value = '';
            });
        }
    }

    function selectPlantFromCatalog(id) {
        var plants = getPlants();
        var plant = plants.find(function(p) { return p.id === id; });
        if (!plant) return;
        function setVal(elId, v) {
            var el = document.getElementById(elId);
            if (el) el.value = v;
        }
        setVal('cfg-temp-min', plant.temp_min);
        setVal('cfg-temp-max', plant.temp_max);
        setVal('cfg-hum-min', plant.hum_ambiente_min);
        setVal('cfg-hum-max', plant.hum_ambiente_max);
        setVal('cfg-humsuelo-min', plant.hum_suelo_min);
        setVal('cfg-humsuelo-max', plant.hum_suelo_max);
        setVal('cfg-ph-min', plant.ph_min);
        setVal('cfg-ph-max', plant.ph_max);

        if (badge && badgeName) {
            badgeName.textContent = plant.nombre;
            badge.style.display = 'inline-flex';
        }

        try {
            var inv = (AppState.get('currentInv') || 0) + 1;
            var mac = AppState.get('currentMaceta') || 1;
            var key = 'huerto_planta_inv' + inv + '_mac' + mac;
            localStorage.setItem(key, JSON.stringify(plant));
        } catch (e) {}
    }

    input.addEventListener('input', function() { renderDropdown(input.value); });
    input.addEventListener('focus', function() {
        renderDropdown(input.value);
        dropdown.classList.add('active');
    });
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    if (badgeRemove) {
        badgeRemove.addEventListener('click', function() {
            try {
                var inv = (AppState.get('currentInv') || 0) + 1;
                var mac = AppState.get('currentMaceta') || 1;
                localStorage.removeItem('huerto_planta_inv' + inv + '_mac' + mac);
            } catch (e) {}
            if (badge) badge.style.display = 'none';
        });
    }

    if (btnAdd) btnAdd.addEventListener('click', function() {
        if (typeof ConfigModule !== 'undefined' && ConfigModule.openAddPlantModal) {
            ConfigModule.openAddPlantModal();
        } else {
            var m = document.getElementById('addPlantModal');
            if (m) m.classList.add('active');
        }
    });
    if (btnRec) btnRec.addEventListener('click', function() {
        if (typeof ConfigModule !== 'undefined' && ConfigModule.openRecommendationsModal) {
            ConfigModule.openRecommendationsModal();
        } else {
            var m = document.getElementById('recPlantModal');
            if (m) m.classList.add('active');
        }
    });

    try {
        var inv = (AppState.get('currentInv') || 0) + 1;
        var mac = AppState.get('currentMaceta') || 1;
        var saved = JSON.parse(localStorage.getItem('huerto_planta_inv' + inv + '_mac' + mac) || 'null');
        if (saved && badge && badgeName) {
            badgeName.textContent = saved.nombre;
            badge.style.display = 'inline-flex';
        }
    } catch (e) {}
}

// ============================================================
// OverrideManager - Multi-override visualization
// Tracks up to 4 active overrides with independent progress
// Includes start delay and actuator visual sync
// ============================================================

var OverrideManager = (function() {
    var activeOverrides = [];
    var timer = null;

    var START_DELAY = 30000;

    var SENSOR_META = {
        temp:      { icon: 'thermostat', label: 'Temperatura', unit: '\u00B0C', shared: true },
        hum_amb:   { icon: 'air',        label: 'Humedad Amb', unit: '%',  shared: true },
        hum_suelo: { icon: 'water_drop', label: 'Hum Suelo',   unit: '%',  shared: false },
        ph:        { icon: 'science',    label: 'pH Suelo',    unit: 'pH', shared: false }
    };

    var PHASE_DURATIONS = { degrade: 210000, hold: 20000, recover: 100000 };
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
