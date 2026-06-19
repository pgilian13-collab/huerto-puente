// ============================================================
// Reports Module - Time-based analytics
// ============================================================

var ReportsModule = (function() {
    function init() { render(); }
    function destroy() {}

    function render() {
        var el = document.getElementById('view-reportes');
        if (!el) return;
        el.innerHTML = '<div class="panel"><div class="panel-header"><span class="material-icons-round">assessment</span><h3>Reportes de Tiempo</h3><div class="panel-tag">SYS//REPORTS</div></div>' +
            '<div class="reportes-grid">' +
            reportCard('schedule', 'Tiempo Activo', '23h 45m', '#22c55e') +
            reportCard('warning', 'Alertas Hoy', '12', '#f59e0b') +
            reportCard('water_drop', 'Riegos Realizados', '8', '#3b82f6') +
            reportCard('autorenew', 'Ciclos Completos', '3', '#a855f7') +
            '</div></div>';
    }

    function reportCard(icon, label, value, color) {
        return '<div class="reporte-card"><div class="reporte-icon" style="color:' + color + '"><span class="material-icons-round">' + icon + '</span></div><div class="reporte-label">' + label + '</div><div class="reporte-value">' + value + '</div></div>';
    }

    return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') window.ReportsModule = ReportsModule;
