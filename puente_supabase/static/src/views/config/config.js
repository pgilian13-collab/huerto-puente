// ============================================================
// Config Module - Threshold configuration + Plant catalog
// ============================================================

var ConfigModule = (function() {
    var CATALOGO_PLANTAS = [
        {id:1,nombre:"Acelga",temp_min:10,temp_max:25,hum_suelo_min:60,hum_suelo_max:80,hum_ambiente_min:50,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:2,nombre:"Ajo",temp_min:12,temp_max:25,hum_suelo_min:40,hum_suelo_max:60,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:3,nombre:"Alcachofa",temp_min:10,temp_max:22,hum_suelo_min:60,hum_suelo_max:80,hum_ambiente_min:50,hum_ambiente_max:70,ph_min:6.5,ph_max:7.5},
        {id:4,nombre:"Alfalfa",temp_min:10,temp_max:28,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.5,ph_max:7.5},
        {id:5,nombre:"Apio",temp_min:10,temp_max:22,hum_suelo_min:60,hum_suelo_max:85,hum_ambiente_min:50,hum_ambiente_max:75,ph_min:6.0,ph_max:7.0},
        {id:6,nombre:"Arveja",temp_min:10,temp_max:22,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:7,nombre:"Berenjena",temp_min:18,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:5.5,ph_max:6.5},
        {id:8,nombre:"Berro",temp_min:10,temp_max:20,hum_suelo_min:70,hum_suelo_max:90,hum_ambiente_min:50,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:9,nombre:"Beterraga",temp_min:10,temp_max:24,hum_suelo_min:60,hum_suelo_max:80,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:10,nombre:"Brócoli",temp_min:10,temp_max:22,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:11,nombre:"Cabbage (Repollo)",temp_min:10,temp_max:22,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:12,nombre:"Cebolla",temp_min:12,temp_max:28,hum_suelo_min:40,hum_suelo_max:60,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:13,nombre:"Cebolla de verdeo",temp_min:8,temp_max:25,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:14,nombre:"Choclo (Maíz)",temp_min:18,temp_max:32,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:80,ph_min:5.5,ph_max:7.0},
        {id:15,nombre:"Cilantro",temp_min:10,temp_max:25,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:16,nombre:"Coliflor",temp_min:10,temp_max:22,hum_suelo_min:50,hum_suelo_max:80,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:17,nombre:"Espinaca",temp_min:8,temp_max:22,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:18,nombre:"Frutilla (Fresa)",temp_min:10,temp_max:25,hum_suelo_min:60,hum_suelo_max:80,hum_ambiente_min:50,hum_ambiente_max:75,ph_min:5.5,ph_max:6.5},
        {id:19,nombre:"Garbanzo",temp_min:15,temp_max:30,hum_suelo_min:40,hum_suelo_max:60,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.0,ph_max:7.5},
        {id:20,nombre:"Gilantro",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:21,nombre:"Habas",temp_min:10,temp_max:22,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:22,nombre:"Hierbabuena",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:6.0,ph_max:7.5},
        {id:23,nombre:"Lechuga",temp_min:8,temp_max:22,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:24,nombre:"Lenteja",temp_min:15,temp_max:28,hum_suelo_min:40,hum_suelo_max:60,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.0,ph_max:7.5},
        {id:25,nombre:"Lima (Limón)",temp_min:18,temp_max:32,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:5.5,ph_max:7.0},
        {id:26,nombre:"Mandarina",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:5.5,ph_max:7.0},
        {id:27,nombre:"Manzana",temp_min:10,temp_max:25,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:28,nombre:"Menta",temp_min:10,temp_max:28,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:6.0,ph_max:7.5},
        {id:29,nombre:"Naranja",temp_min:15,temp_max:32,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:5.5,ph_max:7.0},
        {id:30,nombre:"Palta (Aguacate)",temp_min:18,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:5.5,ph_max:7.0},
        {id:31,nombre:"Papa",temp_min:10,temp_max:22,hum_suelo_min:60,hum_suelo_max:80,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:5.0,ph_max:6.5},
        {id:32,nombre:"Pepino",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:5.5,ph_max:7.0},
        {id:33,nombre:"Perejil",temp_min:10,temp_max:25,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:34,nombre:"Pimiento",temp_min:18,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:6.8},
        {id:35,nombre:"Poroto (Frijol)",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:36,nombre:"Radicheta",temp_min:8,temp_max:22,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:37,nombre:"Rabanito",temp_min:8,temp_max:22,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:38,nombre:"Romero",temp_min:10,temp_max:30,hum_suelo_min:30,hum_suelo_max:55,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.0,ph_max:7.5},
        {id:39,nombre:"Rúcula",temp_min:8,temp_max:22,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:40,nombre:"Sandía",temp_min:20,temp_max:35,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:41,nombre:"Soja",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.0},
        {id:42,nombre:"Tomate",temp_min:18,temp_max:30,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:6.0,ph_max:6.8},
        {id:43,nombre:"Tomate cherry",temp_min:18,temp_max:30,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:6.0,ph_max:6.8},
        {id:44,nombre:"Trigo",temp_min:10,temp_max:28,hum_suelo_min:40,hum_suelo_max:65,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.0,ph_max:7.5},
        {id:45,nombre:"Zanahoria",temp_min:10,temp_max:25,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:6.8},
        {id:46,nombre:"Zapallo",temp_min:18,temp_max:32,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:5.5,ph_max:7.0},
        {id:47,nombre:"Zapallito (Italiano)",temp_min:18,temp_max:30,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:5.5,ph_max:7.0},
        {id:48,nombre:"Calabacín",temp_min:18,temp_max:30,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:5.5,ph_max:7.0},
        {id:49,nombre:"Chía",temp_min:15,temp_max:30,hum_suelo_min:40,hum_suelo_max:60,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.0,ph_max:8.0},
        {id:50,nombre:"Eucalipto",temp_min:10,temp_max:35,hum_suelo_min:30,hum_suelo_max:60,hum_ambiente_min:30,hum_ambiente_max:70,ph_min:5.0,ph_max:7.0},
        {id:51,nombre:"Lavanda",temp_min:10,temp_max:30,hum_suelo_min:30,hum_suelo_max:55,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.5,ph_max:8.0},
        {id:52,nombre:"Orquídea",temp_min:15,temp_max:28,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:50,hum_ambiente_max:80,ph_min:5.5,ph_max:6.5},
        {id:53,nombre:"Cactus",temp_min:10,temp_max:40,hum_suelo_min:10,hum_suelo_max:30,hum_ambiente_min:20,hum_ambiente_max:50,ph_min:5.5,ph_max:7.0},
        {id:54,nombre:"Helecho",temp_min:12,temp_max:25,hum_suelo_min:60,hum_suelo_max:85,hum_ambiente_min:50,hum_ambiente_max:80,ph_min:5.0,ph_max:6.5},
        {id:55,nombre:"Girasol",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.0,ph_max:7.5},
        {id:56,nombre:"Rosa",temp_min:12,temp_max:28,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:6.8},
        {id:57,nombre:"Gardenia",temp_min:15,temp_max:28,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:50,hum_ambiente_max:75,ph_min:5.0,ph_max:6.0},
        {id:58,nombre:"Hortensia",temp_min:10,temp_max:25,hum_suelo_min:50,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:4.5,ph_max:6.0},
        {id:59,nombre:"Albahaca",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:60,nombre:"Tomillo",temp_min:10,temp_max:30,hum_suelo_min:30,hum_suelo_max:55,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.0,ph_max:8.0},
        {id:61,nombre:"Orégano",temp_min:10,temp_max:30,hum_suelo_min:30,hum_suelo_max:55,hum_ambiente_min:30,hum_ambiente_max:60,ph_min:6.0,ph_max:8.0},
        {id:62,nombre:"Lemon grass",temp_min:15,temp_max:32,hum_suelo_min:40,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:5.0,ph_max:8.4},
        {id:63,nombre:"Stevia",temp_min:15,temp_max:30,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:6.0,ph_max:7.5},
        {id:64,nombre:"Jengibre",temp_min:20,temp_max:35,hum_suelo_min:50,hum_suelo_max:80,hum_ambiente_min:50,hum_ambiente_max:80,ph_min:5.5,ph_max:6.5},
        {id:65,nombre:"Cúrcuma",temp_min:20,temp_max:35,hum_suelo_min:50,hum_suelo_max:80,hum_ambiente_min:50,hum_ambiente_max:80,ph_min:5.0,ph_max:7.5},
        {id:66,nombre:"Papaya",temp_min:22,temp_max:35,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:50,hum_ambiente_max:80,ph_min:5.5,ph_max:7.0},
        {id:67,nombre:"Plátano (Banano)",temp_min:20,temp_max:35,hum_suelo_min:50,hum_suelo_max:80,hum_ambiente_min:50,hum_ambiente_max:80,ph_min:5.5,ph_max:7.0},
        {id:68,nombre:"Piña",temp_min:20,temp_max:35,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:50,hum_ambiente_max:80,ph_min:4.5,ph_max:5.5},
        {id:69,nombre:"Mango",temp_min:22,temp_max:35,hum_suelo_min:40,hum_suelo_max:65,hum_ambiente_min:40,hum_ambiente_max:70,ph_min:5.5,ph_max:7.5},
        {id:70,nombre:"Guayaba",temp_min:20,temp_max:32,hum_suelo_min:50,hum_suelo_max:70,hum_ambiente_min:40,hum_ambiente_max:75,ph_min:5.0,ph_max:7.0},
        {id:71,nombre:"Cacao",temp_min:20,temp_max:32,hum_suelo_min:60,hum_suelo_max:80,hum_ambiente_min:60,hum_ambiente_max:90,ph_min:5.0,ph_max:7.0}
    ];

    var allPlants = CATALOGO_PLANTAS;

    function init() {
        loadFromSupabase().then(function() { render(); });
        cargarCatalogoPlantas();
    }
    function destroy() {}

    function getConfigKey() {
        var inv = AppState.get('currentInv') || 0;
        var mac = AppState.get('currentMaceta') || 1;
        return 'huerto_config_inv' + (inv + 1) + '_mac' + mac;
    }

    function getPlantaKey() {
        var inv = AppState.get('currentInv') || 0;
        var mac = AppState.get('currentMaceta') || 1;
        return 'huerto_planta_inv' + (inv + 1) + '_mac' + mac;
    }

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

    function loadConfigForCurrentMaceta() {
        var key = getConfigKey();
        try {
            var saved = JSON.parse(localStorage.getItem(key));
            if (saved) {
                AppState.set('umbrales', saved);
                return saved;
            }
        } catch (e) {}
        return null;
    }

    function cargarCatalogoPlantas() {
        ApiService.sbQuery('catalogo_plantas', 'order=nombre.asc&limit=100').then(function(rows) {
            if (rows && rows.length > 0) {
                allPlants = rows.map(function(r) {
                    return {
                        id: r.id, nombre: r.nombre,
                        temp_min: r.temp_min, temp_max: r.temp_max,
                        hum_suelo_min: r.hum_suelo_min, hum_suelo_max: r.hum_suelo_max,
                        hum_ambiente_min: r.hum_ambiente_min, hum_ambiente_max: r.hum_ambiente_max,
                        ph_min: r.ph_min, ph_max: r.ph_max
                    };
                });
                console.log('[CONFIG] Catalogo cargado desde Supabase: ' + allPlants.length + ' plantas');
            }
        }).catch(function(e) {
            console.log('[CONFIG] Catalogo offline, usando array embebido (' + allPlants.length + ' plantas)');
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

        initPlantSelector();
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

        var configKey = getConfigKey();
        try { localStorage.setItem(configKey, JSON.stringify(umbrales)); } catch (e) {}

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

    // ============================================================
    // Plant Selector
    // ============================================================

    function initPlantSelector() {
        var input = document.getElementById('plantSearchInput');
        var dropdown = document.getElementById('plantDropdown');
        var badge = document.getElementById('plantBadge');
        var badgeName = document.getElementById('plantBadgeName');
        var badgeRemove = document.getElementById('plantBadgeRemove');
        if (!input || !dropdown) return;

        var savedPlanta = null;
        try {
            var pk = getPlantaKey();
            var sv = localStorage.getItem(pk);
            if (sv) savedPlanta = JSON.parse(sv);
        } catch (e) {}

        if (savedPlanta && badge && badgeName) {
            badgeName.textContent = savedPlanta.nombre;
            badge.style.display = 'inline-flex';
        }

        input.addEventListener('input', function() {
            renderPlantDropdown(input.value);
        });

        input.addEventListener('focus', function() {
            renderPlantDropdown(input.value);
            dropdown.classList.add('active');
        });

        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        if (badgeRemove) {
            badgeRemove.addEventListener('click', function() {
                var pk = getPlantaKey();
                try { localStorage.removeItem(pk); } catch (e) {}
                badge.style.display = 'none';
            });
        }
    }

    function normalizeText(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function renderPlantDropdown(query) {
        var dropdown = document.getElementById('plantDropdown');
        if (!dropdown) return;
        var q = normalizeText(query);
        var filtered = allPlants.filter(function(p) {
            return !q || normalizeText(p.nombre).indexOf(q) !== -1;
        }).slice(0, 15);

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
                seleccionarPlanta(id);
                dropdown.classList.remove('active');
            });
        }
    }

    function seleccionarPlanta(id) {
        var plant = allPlants.find(function(p) { return p.id === id; });
        if (!plant) return;

        setInput('cfg-temp-min', plant.temp_min);
        setInput('cfg-temp-max', plant.temp_max);
        setInput('cfg-hum-min', plant.hum_ambiente_min);
        setInput('cfg-hum-max', plant.hum_ambiente_max);
        setInput('cfg-humsuelo-min', plant.hum_suelo_min);
        setInput('cfg-humsuelo-max', plant.hum_suelo_max);
        setInput('cfg-ph-min', plant.ph_min);
        setInput('cfg-ph-max', plant.ph_max);

        var badge = document.getElementById('plantBadge');
        var badgeName = document.getElementById('plantBadgeName');
        if (badge && badgeName) {
            badgeName.textContent = plant.nombre;
            badge.style.display = 'inline-flex';
        }

        var pk = getPlantaKey();
        try { localStorage.setItem(pk, JSON.stringify(plant)); } catch (e) {}
    }

    function setInput(id, value) {
        var el = document.getElementById(id);
        if (el) el.value = value;
    }

    return { init: init, destroy: destroy, cargarCatalogoPlantas: cargarCatalogoPlantas };
})();

if (typeof window !== 'undefined') window.ConfigModule = ConfigModule;
