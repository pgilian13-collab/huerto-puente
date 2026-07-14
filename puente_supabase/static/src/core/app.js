// ============================================================
// App - Main application bootstrap
// ============================================================
// Initializes core services, registers routes, starts router.
// This is the entry point loaded by index.html.
// ============================================================

var App = (function() {
    var lastSensorDataTime = 0;
    var connectivityTimer = null;
    var CONNECTIVITY_TIMEOUT = 15000;

    function init() {
        console.log('[App] Initializing Huerto Inteligente...');

        // 1. Init state from localStorage
        AppState.init();

        // 2. Check auth
        if (!AppState.get('isLoggedIn')) {
            window.location.href = '/login';
            return;
        }

        // 3. Init particles background
        initParticles();

        // 4. Register routes (modules load lazily)
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
            if (typeof DashboardModule !== 'undefined' && DashboardModule.loadConfigFromSupabase) {
                DashboardModule.loadConfigFromSupabase(data.index);
            }
        });

        // 6. Listen for maceta changes
        EventBus.on('maceta:changed', function(data) {
            AppState.set('currentMaceta', data.maceta);
            EventBus.emit('maceta:selected', data);
        });

        // 6b. Sidebar invernadero tab changed
        EventBus.on('sidebar:selectInv', function(idx) {
            if (typeof idx !== 'number') return;
            AppState.batch({
                currentInv: idx,
                currentInvId: idx + 1,
                currentMaceta: 1
            });
            SensorService.init(idx);
            ActuatorService.fetchActuadores(idx);
            if (typeof DashboardModule !== 'undefined') {
                DashboardModule.setSkeletonActive(true);
                DashboardModule.init();
                setTimeout(function() { DashboardModule.initTooltips(); }, 700);
            }
        });

        // 7. Listen for simulation alerts
        EventBus.on('simulation:alert', function(data) {
            var umbrales = AppState.get('umbrales') || {};
            var umbralMap = {
                temp: umbrales.temp,
                hum_amb: umbrales.humAmb,
                hum_suelo: umbrales.humSuelo,
                ph: umbrales.ph
            };
            var u = umbralMap[data.sensor];
            if (u && data.valor >= u.min && data.valor <= u.max) {
                console.log('[SIM] Valor ' + data.valor + ' dentro de rango seguro [' + u.min + '-' + u.max + ']. Simulacion no aplicada.');
                showToast('Valor dentro de rango seguro — simulacion no aplicada', 'info');
                return;
            }

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
                    if (typeof OverrideManager !== 'undefined') {
                        OverrideManager.add(data.sensor, payload.maceta_numero, data.valor);
                    }
                } else {
                    console.error('[SIM] Error al enviar alerta');
                }
            });
        });

        // 8. Listen for actuator toggle
        EventBus.on('actuator:toggle', function(actuatorName) {
            var inv = AppState.get('currentInv') || 0;
            var deviceId = inv + 1;
            var mac = AppState.get('currentMaceta') || 1;
            var map = AppState.get('actuadoresMap') || {};
            var act = map[mac + '_' + actuatorName];

            // Fallback: buzzer (maceta_num=0)
            if (!act && actuatorName === 'buzzer') {
                var actuators = AppState.get('actuators') || [];
                for (var i = 0; i < actuators.length; i++) {
                    if (actuators[i].nombre === 'buzzer') {
                        act = actuators[i];
                        break;
                    }
                }
            }

            if (!act) {
                console.error('[ACT] Actuador no encontrado:', actuatorName, 'MAC-' + mac);
                return;
            }
            var currentBtn = document.getElementById('btn-' + actuatorName);
            var isOn = currentBtn && currentBtn.classList.contains('on');
            var newEstado = isOn ? 'OFF' : 'ON';

            // Show PENDIENTE status
            var modeEl = document.getElementById(actuatorName + '-mode');
            if (modeEl) { modeEl.textContent = 'Esperando...'; modeEl.style.color = '#FFD600'; }

            ActuatorService.toggleActuador(act.id, act.nombre, act.pin_conexion, newEstado, deviceId).then(function(res) {
                if (res && res.success) {
                    // Show ENVIADO status
                    if (modeEl) { modeEl.textContent = 'Enviado'; modeEl.style.color = '#00BF'; }
                    console.log('[ACT] ' + actuatorName + ' -> ' + newEstado);
                    // Clear after 3s
                    setTimeout(function() {
                        if (modeEl) { modeEl.textContent = 'MANUAL'; modeEl.style.color = ''; }
                    }, 3000);
                } else {
                    if (modeEl) { modeEl.textContent = 'Error'; modeEl.style.color = '#FF4545'; }
                    setTimeout(function() {
                        if (modeEl) { modeEl.textContent = 'MANUAL'; modeEl.style.color = ''; }
                    }, 3000);
                }
            });
        });

        // 9. Listen for sensor data → update connectivity timestamp
        EventBus.on('sensors:updated', function() {
            lastSensorDataTime = Date.now();
            setLiveStatus(true);
        });

        // 10. Start router
        Router.init();

        // 11. Initial data load
        SensorService.init(0);
        ActuatorService.fetchActuadores(0);

        // 12. Init sensor modal
        initSensorModal();
        initGlobalModalHandlers();

        // 13. Hide loader
        var loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');

        // 14. Update connection status
        updateStatus(true);

        // 15. Start connectivity checker
        startConnectivityChecker();

        console.log('[App] Ready.');
    }

    function startConnectivityChecker() {
        if (connectivityTimer) clearInterval(connectivityTimer);
        connectivityTimer = setInterval(function() {
            if (lastSensorDataTime === 0) return;
            var elapsed = Date.now() - lastSensorDataTime;
            setLiveStatus(elapsed < CONNECTIVITY_TIMEOUT);
        }, 5000);
    }

    function setLiveStatus(connected) {
        var indicator = document.getElementById('liveIndicator');
        var text = document.getElementById('liveText');
        if (!indicator) return;
        if (connected) {
            indicator.classList.remove('disconnected');
            if (text) text.textContent = 'LIVE';
        } else {
            indicator.classList.add('disconnected');
            if (text) text.textContent = 'OFFLINE';
        }
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

        // graficos and config are now part of dashboard
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
                    []
                ).then(function() { done(window.ConfigModule); });
            }
        });
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
        if (!modal) return;
        if (closeBtn) closeBtn.addEventListener('click', function() { modal.classList.remove('active'); });
        modal.addEventListener('click', function(e) {
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

    // ============================================================
    // GLOBAL MODAL MANAGER - Escape key + backdrop click universal
    // ============================================================

    var MODAL_IDS = ['sensorModal', 'configModal', 'addPlantModal', 'recPlantModal'];

    function closeAllModals() {
        MODAL_IDS.forEach(function(id) {
            var m = document.getElementById(id);
            if (m && m.classList.contains('active')) {
                m.classList.remove('active');
            }
        });
    }

    function closeTopModal() {
        for (var i = MODAL_IDS.length - 1; i >= 0; i--) {
            var m = document.getElementById(MODAL_IDS[i]);
            if (m && m.classList.contains('active')) {
                m.classList.remove('active');
                return;
            }
        }
    }

    function initGlobalModalHandlers() {
        // Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                closeTopModal();
            }
        });

        // Backdrop click para TODOS los modales (idempotente)
        MODAL_IDS.forEach(function(id) {
            var modal = document.getElementById(id);
            if (!modal) return;
            // Verificar si ya tiene listener (no duplicar)
            if (!modal._backdropWired) {
                modal.addEventListener('click', function(e) {
                    if (e.target === modal) modal.classList.remove('active');
                });
                modal._backdropWired = true;
            }
        });

        // configModal: agregar boton cerrar con id (ya tiene onclick en HTML,
        // pero agregamos tambien un listener para Escape + backdrop)
        var cfgClose = document.getElementById('configModalClose');
        if (!cfgClose && document.getElementById('configModal')) {
            // Si el HTML usa onclick inline, no necesitamos mas
        }
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
            renderSensorTable(filtered, sensorType);
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

    function renderSensorTable(data, sensorType) {
        var tbody = document.getElementById('sensorTablaBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-secondary);">Sin datos</td></tr>';
            return;
        }
        var units = { temp: '\u00B0C', hum_amb: '%', hum_suelo: '%', ph: 'pH' };
        var decimals = (sensorType === 'ph') ? 2 : 1;
        data.forEach(function(r) {
            var fecha = new Date(r.fecha_hora);
            var ts = fecha.toLocaleString('es-PE', {
                month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZone: 'America/Lima'
            });
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + ts + '</td><td>' + parseFloat(r.valor_lectura).toFixed(decimals) + ' ' + (units[sensorType] || '') + '</td>';
            tbody.appendChild(tr);
        });
    }

    function showToast(message, type) {
        var existing = document.querySelector('.sim-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'sim-toast sim-toast-' + (type || 'info');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function() { toast.classList.add('show'); }, 10);
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    }

    function initParticles() {
        try {
            var canvas = document.getElementById('particleCanvas');
            if (!canvas) return;
            var ctx = canvas.getContext('2d');
            var particles = [];
            var w, h;

            function resize() {
                w = canvas.width = window.innerWidth;
                h = canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);

            for (var i = 0; i < 50; i++) {
                particles.push({
                    x: Math.random() * (canvas.width || w),
                    y: Math.random() * (canvas.height || h),
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    size: Math.random() * 1.5 + 0.5,
                    alpha: Math.random() * 0.4 + 0.1
                });
            }

            function draw() {
                ctx.clearRect(0, 0, w, h);
                for (var j = 0; j < particles.length; j++) {
                    var p = particles[j];
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.x < 0 || p.x > w) p.vx *= -1;
                    if (p.y < 0 || p.y > h) p.vy *= -1;
                    ctx.fillStyle = 'rgba(180,180,200,' + p.alpha + ')';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
                requestAnimationFrame(draw);
            }
            draw();
        } catch (e) {
            console.warn('[PARTICLES] init failed:', e);
        }
    }

    return { init: init, logout: logout, showToast: showToast, closeAllModals: closeAllModals, closeTopModal: closeTopModal };
})();

if (typeof window !== 'undefined') window.App = App;
