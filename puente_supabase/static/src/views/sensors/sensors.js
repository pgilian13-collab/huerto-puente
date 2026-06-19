// ============================================================
// Sensors Module - Data table view
// ============================================================

var SensorsModule = (function() {
    var pollTimer = null;

    function init() { render(); loadData(); startPolling(); }
    function destroy() { stopPolling(); }

    function render() {
        var el = document.getElementById('view-tabla');
        if (!el) return;
        el.innerHTML = '<div class="panel"><div class="panel-header"><span class="material-icons-round">table_chart</span><h3>Tabla de Sensores</h3><div class="panel-tag">DATA//TABLE</div></div>' +
            '<div class="data-table-container"><table class="data-table"><thead><tr><th>Sensor</th><th>Tipo</th><th>Valor</th><th>Unidad</th><th>Estado</th><th>Fecha</th></tr></thead><tbody id="viewTablaBody"></tbody></table></div></div>';
    }

    function loadData() {
        var inv = AppState.get('currentInv') || 0;
        SensorService.fetchLatest(inv).then(function(data) {
            updateTable(data);
        });
    }

    function updateTable(data) {
        var tbody = document.getElementById('viewTablaBody');
        if (!tbody) return;
        var inv = AppState.get('currentInv') || 0;
        var ids = SensorService.getSensorIds(inv + 1);
        var html = '';
        var types = ['Temperatura', 'Humedad Amb', 'Hum Suelo M1', 'pH M1', 'Hum Suelo M2', 'pH M2', 'Hum Suelo M3', 'pH M3', 'Hum Suelo M4', 'pH M4'];
        var units = ['C', '%', '%', 'pH', '%', 'pH', '%', 'pH', '%', 'pH'];

        ids.forEach(function(id, i) {
            var row = data[id];
            if (!row) return;
            var val = parseFloat(row.valor_lectura);
            var status = 'row-ok';
            if (val < 0 || val > 100) status = 'row-danger';
            html += '<tr class="' + status + '"><td>Sensor-' + id + '</td><td>' + types[i] + '</td><td>' + val.toFixed(1) + '</td><td>' + units[i] + '</td><td><span class="sensor-estado-badge ok">OK</span></td><td>' + new Date(row.fecha_hora).toLocaleTimeString() + '</td></tr>';
        });
        tbody.innerHTML = html || '<tr><td colspan="6" class="table-empty">Sin datos disponibles</td></tr>';
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(loadData, 5000);
    }

    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

    return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') window.SensorsModule = SensorsModule;
