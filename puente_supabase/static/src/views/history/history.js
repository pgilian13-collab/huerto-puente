// ============================================================
// History Module - Historical chart view
// ============================================================

var HistoryModule = (function() {
    var chart = null;
    var refreshTimer = null;

    function init() { render(); loadData(); startAutoRefresh(); }
    function destroy() { stopAutoRefresh(); if (chart) { chart.destroy(); chart = null; } }

    function render() {
        var el = document.getElementById('view-graficos');
        if (!el) return;
        el.innerHTML = '<div class="panel"><div class="panel-header"><span class="material-icons-round">timeline</span><h3>Historico - Ultimas 24 Horas</h3><div class="panel-header-actions"><div class="panel-tag">SYS//CHART</div></div></div>' +
            '<div class="bottom-grid"><div class="chart-container"><canvas id="chartHistorico"></canvas></div></div>' +
            '<div style="padding:12px;text-align:right;"><button class="brutalist-btn" id="btnRefreshHistorico" style="padding:8px 16px;font-size:12px;"><span class="material-icons-round" style="font-size:16px;">refresh</span> Actualizar</button></div></div>';
        var btn = document.getElementById('btnRefreshHistorico');
        if (btn) btn.addEventListener('click', loadData);
    }

    function loadData() {
        var inv = AppState.get('currentInv') || 0;
        SensorService.fetchHistory(inv, 100).then(function(rows) { renderChart(rows); });
    }

    function renderChart(rows) {
        var canvas = document.getElementById('chartHistorico');
        if (!canvas) return;
        if (chart) chart.destroy();

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

    function startAutoRefresh() { stopAutoRefresh(); refreshTimer = setInterval(loadData, 30000); }
    function stopAutoRefresh() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }

    return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') window.HistoryModule = HistoryModule;
