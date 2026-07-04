// ============================================================
// Config Module - Threshold configuration
// ============================================================

var ConfigModule = (function() {
    function init() {
        loadFromSupabase().then(function() { render(); });
    }
    function destroy() {}

    function loadFromSupabase() {
        var inv = AppState.get('currentInv') || 0;
        var deviceId = inv + 1;
        return ApiService.sbQuery('configuracion', 'dispositivo_id=eq.' + deviceId).then(function(rows) {
            if (rows && rows.length > 0 && rows[0].umbrales) {
                AppState.set('umbrales', rows[0].umbrales);
                AppState.persistUmbrales();
                console.log('[CONFIG] Umbrales cargados desde Supabase');
            }
        }).catch(function(e) {
            console.error('[CONFIG] Error cargando umbrales:', e);
        });
    }

    function render() {
        var el = document.getElementById('view-config');
        if (!el) return;
        var u = AppState.get('umbrales') || {};

        el.innerHTML = '<div class="panel"><div class="panel-header"><span class="material-icons-round">settings</span><h3>Configuracion de Umbrales</h3><div class="panel-tag">SYS//CONFIG</div></div>' +
            '<div class="config-grid">' +
            configItem('Temperatura', u.temp, '\u00B0C', 'cfg-temp', 'thermostat', '#ef4444') +
            configItem('Humedad Ambiente', u.humAmb, '%', 'cfg-hum', 'air', '#3b82f6') +
            configItem('Humedad Suelo', u.humSuelo, '%', 'cfg-humsuelo', 'water_drop', '#22c55e') +
            configItem('pH Suelo', u.ph, 'pH', 'cfg-ph', 'science', '#f59e0b') +
            '</div>' +
            '<div style="padding:16px;text-align:center;"><button class="brutalist-btn btn-save" id="btnSaveConfig"><span class="material-icons-round">save</span> Guardar Configuracion</button></div>' +
            '</div>';

        var btn = document.getElementById('btnSaveConfig');
        if (btn) btn.addEventListener('click', save);
    }

    function configItem(label, range, unit, prefix, icon, color) {
        return '<div class="config-item" style="border-left:3px solid ' + color + ';padding-left:12px;">' +
            '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">' +
            '<span class="material-icons-round" style="font-size:18px;color:' + color + ';">' + icon + '</span>' +
            '<span class="section-title" style="font-size:13px;">' + label + '</span>' +
            '</div>' +
            '<div class="input-group"><span class="input-unit">Min</span><input type="number" id="' + prefix + '-min" value="' + (range ? range.min : 0) + '" step="0.1"><span class="input-unit">' + unit + '</span></div>' +
            '<div class="input-group" style="margin-top:4px;"><span class="input-unit">Max</span><input type="number" id="' + prefix + '-max" value="' + (range ? range.max : 100) + '" step="0.1"><span class="input-unit">' + unit + '</span></div>' +
            '</div>';
    }

    function val(id, fallback) {
        var el = document.getElementById(id);
        return el ? parseFloat(el.value) : fallback;
    }

    function save() {
        var umbrales = {
            temp: { min: val('cfg-temp-min', 15), max: val('cfg-temp-max', 30) },
            humAmb: { min: val('cfg-hum-min', 30), max: val('cfg-hum-max', 85) },
            humSuelo: { min: val('cfg-humsuelo-min', 40), max: val('cfg-humsuelo-max', 80) },
            ph: { min: val('cfg-ph-min', 5.5), max: val('cfg-ph-max', 7.5) }
        };
        AppState.set('umbrales', umbrales);
        AppState.persistUmbrales();
        EventBus.emit('config:saved', umbrales);

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

        var btn = document.getElementById('btnSaveConfig');
        if (btn) {
            var orig = btn.innerHTML;
            btn.innerHTML = '<span class="material-icons-round">check</span> Guardado';
            btn.style.background = '#16a34a';
            setTimeout(function() { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
        }
    }

    return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') window.ConfigModule = ConfigModule;
