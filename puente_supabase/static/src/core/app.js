// ============================================================
// App - Main application bootstrap
// ============================================================
// Initializes core services, registers routes, starts router.
// This is the entry point loaded by index.html.
// ============================================================

var App = (function() {
    function init() {
        console.log('[App] Initializing Huerto Inteligente...');

        // 1. Init state from localStorage
        AppState.init();

        // 2. Check auth
        if (!AppState.get('isLoggedIn')) {
            window.location.href = '/login';
            return;
        }

        // 3. Register routes (modules load lazily)
        registerRoutes();

        // 4. Init core UI (sidebar + header)
        EventBus.on('sidebar:navigate', function(view) {
            Router.navigate(view);
        });

        // 5. Listen for device changes
        EventBus.on('device:changed', function(data) {
            AppState.batch({
                currentInv: data.index,
                currentInvId: data.id,
                currentMaceta: 1
            });
            SensorService.init(data.index);
            ActuatorService.fetchActuadores(data.index);
        });

        // 6. Listen for maceta changes
        EventBus.on('maceta:changed', function(data) {
            AppState.set('currentMaceta', data.maceta);
            EventBus.emit('maceta:selected', data);
        });

        // 7. Listen for simulation alerts
        EventBus.on('simulation:alert', function(data) {
            var inv = AppState.get('currentInv') || 0;
            var deviceId = inv + 1;
            var mac = AppState.get('currentMaceta') || 1;
            var payload = {
                tipo_alerta: data.tipo,
                sensor_tipo: data.sensor,
                valor_forzado: data.valor,
                maceta_numero: (data.sensor === 'temp' || data.sensor === 'hum_amb') ? 0 : mac,
                dispositivo_id: deviceId
            };
            ApiService.bridgePost('/api/simulacion/alerta', payload).then(function(res) {
                if (res && res.success) {
                    console.log('[SIM] Alerta enviada: ' + data.tipo);
                } else {
                    console.error('[SIM] Error al enviar alerta');
                }
            });
        });

        // 7. Init greenhouse tabs
        initInvTabs();

        // 8. Start router
        Router.init();

        // 8. Initial data load
        SensorService.init(0);
        ActuatorService.fetchActuadores(0);

        // 9. Init sensor modal
        initSensorModal();

        // 10. Hide loader
        var loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');

        // 11. Update connection status
        updateStatus(true);

        console.log('[App] Ready.');
    }

    function registerRoutes() {
        Router.register('dashboard', {
            load: function(done) {
                ModuleLoader.loadBundle(
                    ['src/views/dashboard/dashboard.js'],
                    ['css/modules/dashboard.css']
                ).then(function() { done(window.DashboardModule); });
            }
        });

        Router.register('tabla', {
            load: function(done) {
                ModuleLoader.loadBundle(
                    ['src/views/sensors/sensors.js'],
                    ['css/modules/sensors.css']
                ).then(function() { done(window.SensorsModule); });
            }
        });

        Router.register('graficos', {
            load: function(done) {
                ModuleLoader.loadBundle(
                    ['src/views/history/history.js'],
                    ['css/modules/history.css']
                ).then(function() { done(window.HistoryModule); });
            }
        });

        Router.register('reportes', {
            load: function(done) {
                ModuleLoader.loadBundle(
                    ['src/views/reports/reports.js'],
                    ['css/modules/reports.css']
                ).then(function() { done(window.ReportsModule); });
            }
        });

        Router.register('juego', {
            load: function(done) {
                ModuleLoader.loadBundle(
                    ['src/views/game/game.js', 'src/views/game/gameModule.js'],
                    ['css/modules/game.css']
                ).then(function() { done(window.GameModule); });
            }
        });

        Router.register('config', {
            load: function(done) {
                ModuleLoader.loadBundle(
                    ['src/views/config/config.js'],
                    ['css/modules/config.css']
                ).then(function() { done(window.ConfigModule); });
            }
        });
    }

    function initInvTabs() {
        var container = document.getElementById('invTabs');
        if (!container) return;
        var names = ['INV-01', 'INV-02', 'INV-03', 'INV-04', 'INV-05'];
        var html = '';
        for (var i = 0; i < 5; i++) {
            html += '<div class="inv-tab' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' + names[i] + '</div>';
        }
        container.innerHTML = html;
        var tabs = container.querySelectorAll('.inv-tab');
        for (var j = 0; j < tabs.length; j++) {
            tabs[j].addEventListener('click', function() {
                var idx = parseInt(this.dataset.index);
                container.querySelectorAll('.inv-tab').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
                EventBus.emit('device:changed', { index: idx, id: idx + 1 });
            });
        }
    }

    function updateStatus(online) {
        AppState.set('isConnected', online);
        var dot = document.getElementById('statusDot');
        var text = document.getElementById('statusText');
        if (dot) dot.classList.toggle('online', online);
        if (text) text.textContent = online ? 'ONLINE' : 'OFFLINE';
    }

    function logout() {
        localStorage.removeItem('huerto_auth');
        AppState.batch({ user: null, isLoggedIn: false, isAdmin: false });
        SensorService.destroy();
        window.location.href = '/login';
    }

    function initSensorModal() {
        var modal = document.getElementById('sensorModal');
        var closeBtn = document.getElementById('sensorModalClose');
        if (closeBtn) closeBtn.addEventListener('click', function() { modal.classList.remove('active'); });
        if (modal) modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.classList.remove('active');
        });

        EventBus.on('sensor-modal:open', function(sensorType) {
            modal.classList.add('active');
            var icons = { temp: 'thermostat', hum_amb: 'air', hum_suelo: 'water_drop', ph: 'science' };
            var labels = { temp: 'Temperatura', hum_amb: 'Humedad Ambiente', hum_suelo: 'Humedad Suelo', ph: 'pH Suelo' };
            document.getElementById('sensorModalIcon').textContent = icons[sensorType] || 'sensors';
            document.getElementById('sensorModalTitle').textContent = labels[sensorType] || 'Sensor';
            loadSensorData(sensorType);
        });

        EventBus.on('sensor-modal:view', function(view) {
            var grafico = document.getElementById('sensorGraficoView');
            var tabla = document.getElementById('sensorTablaView');
            var tabG = document.getElementById('sensorTabGrafico');
            var tabT = document.getElementById('sensorTabTabla');
            if (view === 'tabla') {
                if (grafico) grafico.style.display = 'none';
                if (tabla) tabla.style.display = 'block';
                if (tabG) tabG.classList.remove('active');
                if (tabT) tabT.classList.add('active');
            } else {
                if (grafico) grafico.style.display = 'block';
                if (tabla) tabla.style.display = 'none';
                if (tabG) tabG.classList.add('active');
                if (tabT) tabT.classList.remove('active');
            }
        });
    }

    function loadSensorData(sensorType) {
        var inv = AppState.get('currentInv') || 0;
        SensorService.fetchHistory(inv, 50).then(function(rows) {
            if (!rows || rows.length === 0) return;
            var ids = SensorService.getSensorIds(inv + 1);
            var typeMap = { temp: 0, hum_amb: 1 };
            var idx = typeMap[sensorType];
            if (idx === undefined) {
                var mac = AppState.get('currentMaceta') || 1;
                idx = 2 + (mac - 1) * 2 + (sensorType === 'ph' ? 1 : 0);
            }
            var sensorId = ids[idx];
            var filtered = rows.filter(function(r) { return r.sensor_id === sensorId; });
            renderSensorChart(filtered, sensorType);
            renderSensorStats(filtered);
        });
    }

    function renderSensorChart(data, sensorType) {
        var canvas = document.getElementById('sensorChart');
        if (!canvas) return;
        var colors = { temp: '#ef4444', hum_amb: '#3b82f6', hum_suelo: '#22c55e', ph: '#f59e0b' };
        var chartData = data.map(function(r) { return { x: new Date(r.fecha_hora), y: r.valor_lectura }; }).reverse();

        if (window._sensorChart) window._sensorChart.destroy();
        window._sensorChart = new Chart(canvas, {
            type: 'line',
            data: { datasets: [{ label: sensorType, data: chartData, borderColor: colors[sensorType] || '#22c55e', backgroundColor: (colors[sensorType] || '#22c55e') + '20', tension: 0.3, pointRadius: 1, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', grid: { color: '#1e1e1e' }, ticks: { color: '#666' } }, y: { grid: { color: '#1e1e1e' }, ticks: { color: '#666' } } }, plugins: { legend: { display: false } } }
        });
    }

    function renderSensorStats(data) {
        var el = document.getElementById('sensorStats');
        if (!el || !data.length) return;
        var vals = data.map(function(r) { return r.valor_lectura; });
        var min = Math.min.apply(null, vals);
        var max = Math.max.apply(null, vals);
        var avg = vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
        el.innerHTML = '<div class="sensor-stat-item"><span class="stat-dot ok"></span>Min: ' + min.toFixed(1) + '</div>' +
            '<div class="sensor-stat-item"><span class="stat-dot alert"></span>Max: ' + max.toFixed(1) + '</div>' +
            '<div class="sensor-stat-item"><span class="stat-dot danger"></span>Prom: ' + avg.toFixed(1) + '</div>';
    }

    return { init: init, logout: logout };
})();

if (typeof window !== 'undefined') window.App = App;
