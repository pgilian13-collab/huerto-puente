// ============================================================
// Config Module - Threshold configuration
// ============================================================

var ConfigModule = (function() {
    function init() { render(); }
    function destroy() {}

    function render() {
        var el = document.getElementById('view-config');
        if (!el) return;
        var u = AppState.get('umbrales') || {};

        el.innerHTML = '<div class="panel"><div class="panel-header"><span class="material-icons-round">settings</span><h3>Configuracion de Umbrales</h3><div class="panel-tag">SYS//CONFIG</div></div>' +
            '<div class="config-grid">' +
            configItem('Temperatura', u.temp, 'C', 'cfg-temp') +
            configItem('Humedad Ambiente', u.humAmb, '%', 'cfg-hum') +
            configItem('pH Suelo', u.ph, 'pH', 'cfg-ph') +
            '</div>' +
            '<div style="padding:16px;text-align:center;"><button class="brutalist-btn btn-save" id="btnSaveConfig"><span class="material-icons-round">save</span> Guardar Configuracion</button></div>' +
            '</div>';

        document.getElementById('btnSaveConfig').addEventListener('click', save);
    }

    function configItem(label, range, unit, prefix) {
        return '<div class="config-item"><div class="section-title" style="font-size:13px;margin-bottom:8px;">' + label + '</div>' +
            '<div class="input-group"><span class="input-unit">Min</span><input type="number" id="' + prefix + '-min" value="' + (range ? range.min : 0) + '" step="0.1"><span class="input-unit">' + unit + '</span></div>' +
            '<div class="input-group"><span class="input-unit">Max</span><input type="number" id="' + prefix + '-max" value="' + (range ? range.max : 100) + '" step="0.1"><span class="input-unit">' + unit + '</span></div>' +
            '</div>';
    }

    function save() {
        var umbrales = {
            temp: { min: parseFloat(document.getElementById('cfg-temp-min').value), max: parseFloat(document.getElementById('cfg-temp-max').value) },
            humAmb: { min: parseFloat(document.getElementById('cfg-hum-min').value), max: parseFloat(document.getElementById('cfg-hum-max').value) },
            humSuelo: { min: parseFloat(document.getElementById('cfg-humsuelo-min') ? document.getElementById('cfg-humsuelo-min').value : 40), max: parseFloat(document.getElementById('cfg-humsuelo-max') ? document.getElementById('cfg-humsuelo-max').value : 80) },
            ph: { min: parseFloat(document.getElementById('cfg-ph-min').value), max: parseFloat(document.getElementById('cfg-ph-max').value) }
        };
        AppState.set('umbrales', umbrales);
        AppState.persistUmbrales();
        EventBus.emit('config:saved', umbrales);
    }

    return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') window.ConfigModule = ConfigModule;
