// ============================================================
// Config Module - Threshold configuration + Plant catalog
// ============================================================

var ConfigModule = (function() {
    var CATALOGO_PLANTAS = [
        {id:1,nombre:"Arroz",temp_min:15,temp_max:35,hum_suelo_min:25,hum_suelo_max:79,hum_ambiente_min:46,hum_ambiente_max:74,ph_min:4.8,ph_max:7.7},
        {id:2,nombre:"Trigo",temp_min:19.3,temp_max:29.7,hum_suelo_min:47,hum_suelo_max:82,hum_ambiente_min:58,hum_ambiente_max:93,ph_min:5,ph_max:6.9},
        {id:3,nombre:"Maíz",temp_min:16,temp_max:32.6,hum_suelo_min:38,hum_suelo_max:89,hum_ambiente_min:48,hum_ambiente_max:91,ph_min:5.3,ph_max:7.5},
        {id:4,nombre:"Tomate",temp_min:14,temp_max:38.6,hum_suelo_min:20,hum_suelo_max:75,hum_ambiente_min:40,hum_ambiente_max:94,ph_min:5.5,ph_max:7.6},
        {id:5,nombre:"Papa",temp_min:7.3,temp_max:28.7,hum_suelo_min:23,hum_suelo_max:70,hum_ambiente_min:58,hum_ambiente_max:88,ph_min:4.6,ph_max:7.4},
        {id:6,nombre:"Lechuga",temp_min:7.3,temp_max:31.2,hum_suelo_min:40,hum_suelo_max:84,hum_ambiente_min:42,hum_ambiente_max:85,ph_min:5.7,ph_max:7.2},
        {id:7,nombre:"Pepino",temp_min:5.9,temp_max:36.3,hum_suelo_min:20,hum_suelo_max:68,hum_ambiente_min:46,hum_ambiente_max:80,ph_min:5.4,ph_max:7.1},
        {id:8,nombre:"Zanahoria",temp_min:18,temp_max:28.4,hum_suelo_min:25,hum_suelo_max:73,hum_ambiente_min:59,hum_ambiente_max:93,ph_min:4.6,ph_max:7},
        {id:9,nombre:"Cebolla",temp_min:14,temp_max:26.2,hum_suelo_min:36,hum_suelo_max:62,hum_ambiente_min:59,hum_ambiente_max:92,ph_min:5.8,ph_max:7.9},
        {id:10,nombre:"Ajo",temp_min:15.6,temp_max:29.3,hum_suelo_min:41,hum_suelo_max:61,hum_ambiente_min:51,hum_ambiente_max:71,ph_min:5.9,ph_max:7.7},
        {id:11,nombre:"Fresa",temp_min:7.7,temp_max:38.1,hum_suelo_min:30,hum_suelo_max:65,hum_ambiente_min:53,hum_ambiente_max:74,ph_min:4.8,ph_max:6.8},
        {id:12,nombre:"Arándano",temp_min:7.8,temp_max:37.1,hum_suelo_min:42,hum_suelo_max:65,hum_ambiente_min:55,hum_ambiente_max:85,ph_min:4.5,ph_max:5.5},
        {id:13,nombre:"Rosa",temp_min:9.6,temp_max:27.8,hum_suelo_min:39,hum_suelo_max:68,hum_ambiente_min:56,hum_ambiente_max:80,ph_min:5.1,ph_max:7.6},
        {id:14,nombre:"Tulipán",temp_min:12.9,temp_max:38.4,hum_suelo_min:45,hum_suelo_max:76,hum_ambiente_min:56,hum_ambiente_max:94,ph_min:5.2,ph_max:7.4},
        {id:15,nombre:"Lavanda",temp_min:11.5,temp_max:33.1,hum_suelo_min:40,hum_suelo_max:81,hum_ambiente_min:42,hum_ambiente_max:91,ph_min:5.4,ph_max:7.8},
        {id:16,nombre:"Albahaca",temp_min:9.4,temp_max:37.1,hum_suelo_min:37,hum_suelo_max:80,hum_ambiente_min:50,hum_ambiente_max:91,ph_min:5.1,ph_max:6.7},
        {id:17,nombre:"Menta",temp_min:14.2,temp_max:38.4,hum_suelo_min:23,hum_suelo_max:68,hum_ambiente_min:41,hum_ambiente_max:82,ph_min:5.2,ph_max:7.7},
        {id:18,nombre:"Cilantro",temp_min:7.1,temp_max:29.8,hum_suelo_min:31,hum_suelo_max:89,hum_ambiente_min:51,hum_ambiente_max:80,ph_min:5.6,ph_max:6.8},
        {id:19,nombre:"Espinaca",temp_min:9.4,temp_max:26.7,hum_suelo_min:28,hum_suelo_max:82,hum_ambiente_min:49,hum_ambiente_max:77,ph_min:4.6,ph_max:6.7},
        {id:20,nombre:"Kale",temp_min:10.5,temp_max:28.4,hum_suelo_min:27,hum_suelo_max:77,hum_ambiente_min:58,hum_ambiente_max:71,ph_min:4.9,ph_max:6.7},
        {id:21,nombre:"Brócoli",temp_min:11.8,temp_max:31.4,hum_suelo_min:49,hum_suelo_max:78,hum_ambiente_min:47,hum_ambiente_max:92,ph_min:5.6,ph_max:7.7},
        {id:22,nombre:"Coliflor",temp_min:16.8,temp_max:37.3,hum_suelo_min:32,hum_suelo_max:73,hum_ambiente_min:42,hum_ambiente_max:90,ph_min:5.8,ph_max:7.5},
        {id:23,nombre:"Repollo",temp_min:8,temp_max:37.9,hum_suelo_min:47,hum_suelo_max:67,hum_ambiente_min:43,hum_ambiente_max:95,ph_min:5.3,ph_max:7.3},
        {id:24,nombre:"Pimiento",temp_min:12.7,temp_max:25.1,hum_suelo_min:39,hum_suelo_max:71,hum_ambiente_min:55,hum_ambiente_max:95,ph_min:5.3,ph_max:7},
        {id:25,nombre:"Berenjena",temp_min:13.9,temp_max:32.7,hum_suelo_min:44,hum_suelo_max:83,hum_ambiente_min:52,hum_ambiente_max:84,ph_min:4.7,ph_max:7.8},
        {id:26,nombre:"Calabacín",temp_min:5.7,temp_max:31.3,hum_suelo_min:35,hum_suelo_max:60,hum_ambiente_min:42,hum_ambiente_max:89,ph_min:5.2,ph_max:7.1},
        {id:27,nombre:"Calabaza",temp_min:14.1,temp_max:28.3,hum_suelo_min:37,hum_suelo_max:63,hum_ambiente_min:42,hum_ambiente_max:94,ph_min:5.3,ph_max:7.7},
        {id:28,nombre:"Frijoles",temp_min:7.6,temp_max:26.8,hum_suelo_min:35,hum_suelo_max:61,hum_ambiente_min:54,hum_ambiente_max:91,ph_min:4.9,ph_max:7.2},
        {id:29,nombre:"Guisantes",temp_min:6,temp_max:30.1,hum_suelo_min:26,hum_suelo_max:61,hum_ambiente_min:41,hum_ambiente_max:76,ph_min:4.9,ph_max:7.1},
        {id:30,nombre:"Lentejas",temp_min:19.2,temp_max:39.1,hum_suelo_min:42,hum_suelo_max:86,hum_ambiente_min:56,hum_ambiente_max:81,ph_min:5.1,ph_max:7.2},
        {id:31,nombre:"Garbanzo",temp_min:19.5,temp_max:29.8,hum_suelo_min:28,hum_suelo_max:81,hum_ambiente_min:54,hum_ambiente_max:73,ph_min:4.5,ph_max:7},
        {id:32,nombre:"Soja",temp_min:17.1,temp_max:32.8,hum_suelo_min:21,hum_suelo_max:74,hum_ambiente_min:42,hum_ambiente_max:94,ph_min:5,ph_max:7.6},
        {id:33,nombre:"Girasol",temp_min:9.6,temp_max:35.5,hum_suelo_min:39,hum_suelo_max:63,hum_ambiente_min:42,hum_ambiente_max:85,ph_min:4.8,ph_max:7.3},
        {id:34,nombre:"Café",temp_min:15.3,temp_max:39.6,hum_suelo_min:48,hum_suelo_max:74,hum_ambiente_min:47,hum_ambiente_max:87,ph_min:4.7,ph_max:7.8},
        {id:35,nombre:"Té",temp_min:11.6,temp_max:39.4,hum_suelo_min:49,hum_suelo_max:65,hum_ambiente_min:47,hum_ambiente_max:85,ph_min:5.8,ph_max:7.1},
        {id:36,nombre:"Cacao",temp_min:6.8,temp_max:28.8,hum_suelo_min:47,hum_suelo_max:73,hum_ambiente_min:56,hum_ambiente_max:79,ph_min:5.4,ph_max:7.3},
        {id:37,nombre:"Aguacate",temp_min:12.4,temp_max:32.5,hum_suelo_min:31,hum_suelo_max:72,hum_ambiente_min:59,hum_ambiente_max:73,ph_min:5.5,ph_max:7.9},
        {id:38,nombre:"Mango",temp_min:5.5,temp_max:29.5,hum_suelo_min:20,hum_suelo_max:78,hum_ambiente_min:60,hum_ambiente_max:87,ph_min:5.7,ph_max:7.4},
        {id:39,nombre:"Piña",temp_min:18.6,temp_max:29.3,hum_suelo_min:48,hum_suelo_max:79,hum_ambiente_min:55,hum_ambiente_max:83,ph_min:5.2,ph_max:6.7},
        {id:40,nombre:"Papaya",temp_min:8.9,temp_max:25.6,hum_suelo_min:33,hum_suelo_max:61,hum_ambiente_min:48,hum_ambiente_max:89,ph_min:4.6,ph_max:7.9},
        {id:41,nombre:"Coco",temp_min:14.9,temp_max:34.1,hum_suelo_min:49,hum_suelo_max:71,hum_ambiente_min:42,hum_ambiente_max:83,ph_min:5.3,ph_max:7.4},
        {id:42,nombre:"Limón",temp_min:7.9,temp_max:28.6,hum_suelo_min:23,hum_suelo_max:72,hum_ambiente_min:53,hum_ambiente_max:73,ph_min:4.9,ph_max:6.6},
        {id:43,nombre:"Lima",temp_min:5.7,temp_max:35.9,hum_suelo_min:38,hum_suelo_max:79,hum_ambiente_min:55,hum_ambiente_max:70,ph_min:4.7,ph_max:7.4},
        {id:44,nombre:"Sandía",temp_min:10.8,temp_max:34.5,hum_suelo_min:24,hum_suelo_max:76,hum_ambiente_min:59,hum_ambiente_max:85,ph_min:4.9,ph_max:7.8},
        {id:45,nombre:"Melón",temp_min:9.1,temp_max:34.5,hum_suelo_min:36,hum_suelo_max:88,hum_ambiente_min:47,hum_ambiente_max:80,ph_min:4.7,ph_max:7},
        {id:46,nombre:"Rábano",temp_min:17.4,temp_max:33,hum_suelo_min:46,hum_suelo_max:72,hum_ambiente_min:46,hum_ambiente_max:81,ph_min:4.8,ph_max:7.7},
        {id:47,nombre:"Remolacha",temp_min:10.4,temp_max:26.4,hum_suelo_min:42,hum_suelo_max:89,hum_ambiente_min:57,hum_ambiente_max:93,ph_min:4.9,ph_max:6.7},
        {id:48,nombre:"Espárrago",temp_min:9.2,temp_max:37.5,hum_suelo_min:41,hum_suelo_max:87,hum_ambiente_min:44,hum_ambiente_max:79,ph_min:4.8,ph_max:7.8},
        {id:49,nombre:"Alcachofa",temp_min:13.1,temp_max:29.8,hum_suelo_min:41,hum_suelo_max:66,hum_ambiente_min:59,hum_ambiente_max:83,ph_min:5.8,ph_max:6.7},
        {id:50,nombre:"Apio",temp_min:7.1,temp_max:27.8,hum_suelo_min:31,hum_suelo_max:62,hum_ambiente_min:40,hum_ambiente_max:90,ph_min:4.6,ph_max:7.1},
        {id:51,nombre:"Puerro",temp_min:17,temp_max:25.6,hum_suelo_min:29,hum_suelo_max:63,hum_ambiente_min:59,hum_ambiente_max:80,ph_min:5.3,ph_max:7.7},
        {id:52,nombre:"Hinojo",temp_min:6.1,temp_max:33.9,hum_suelo_min:44,hum_suelo_max:61,hum_ambiente_min:41,hum_ambiente_max:86,ph_min:5.1,ph_max:6.7},
        {id:53,nombre:"Perejil",temp_min:19.8,temp_max:35.2,hum_suelo_min:44,hum_suelo_max:63,hum_ambiente_min:58,hum_ambiente_max:92,ph_min:6,ph_max:6.8},
        {id:54,nombre:"Tomillo",temp_min:16.6,temp_max:25.2,hum_suelo_min:46,hum_suelo_max:80,hum_ambiente_min:51,hum_ambiente_max:94,ph_min:4.7,ph_max:7.6},
        {id:55,nombre:"Romero",temp_min:8,temp_max:32.7,hum_suelo_min:47,hum_suelo_max:62,hum_ambiente_min:60,hum_ambiente_max:74,ph_min:5.1,ph_max:7.6},
        {id:56,nombre:"Orégano",temp_min:5.1,temp_max:28.4,hum_suelo_min:35,hum_suelo_max:70,hum_ambiente_min:41,hum_ambiente_max:93,ph_min:6,ph_max:7.5},
        {id:57,nombre:"Salvia",temp_min:17.2,temp_max:34.7,hum_suelo_min:35,hum_suelo_max:85,hum_ambiente_min:51,hum_ambiente_max:82,ph_min:5.8,ph_max:7.5},
        {id:58,nombre:"Eneldo",temp_min:15.6,temp_max:27.6,hum_suelo_min:44,hum_suelo_max:61,hum_ambiente_min:59,hum_ambiente_max:76,ph_min:5.7,ph_max:7.3},
        {id:59,nombre:"Cebollino",temp_min:15.9,temp_max:35.4,hum_suelo_min:39,hum_suelo_max:84,hum_ambiente_min:50,hum_ambiente_max:81,ph_min:4.9,ph_max:6.9},
        {id:60,nombre:"Caléndula",temp_min:16.6,temp_max:30.8,hum_suelo_min:41,hum_suelo_max:68,hum_ambiente_min:53,hum_ambiente_max:95,ph_min:4.8,ph_max:7},
        {id:61,nombre:"Dalia",temp_min:6.1,temp_max:39.1,hum_suelo_min:44,hum_suelo_max:64,hum_ambiente_min:54,hum_ambiente_max:82,ph_min:5.5,ph_max:6.8},
        {id:62,nombre:"Girasol ornamental",temp_min:10.4,temp_max:27.1,hum_suelo_min:47,hum_suelo_max:81,hum_ambiente_min:49,hum_ambiente_max:78,ph_min:5.9,ph_max:7.9},
        {id:63,nombre:"Margarita",temp_min:6.7,temp_max:30.1,hum_suelo_min:30,hum_suelo_max:79,hum_ambiente_min:53,hum_ambiente_max:86,ph_min:5.3,ph_max:7.4},
        {id:64,nombre:"Lirio",temp_min:17.9,temp_max:26.7,hum_suelo_min:31,hum_suelo_max:86,hum_ambiente_min:52,hum_ambiente_max:76,ph_min:5.4,ph_max:7.1},
        {id:65,nombre:"Orquídea",temp_min:14.3,temp_max:38.9,hum_suelo_min:23,hum_suelo_max:82,hum_ambiente_min:58,hum_ambiente_max:72,ph_min:4.9,ph_max:7.2},
        {id:66,nombre:"Helecho",temp_min:10,temp_max:38.2,hum_suelo_min:37,hum_suelo_max:84,hum_ambiente_min:41,hum_ambiente_max:73,ph_min:5.7,ph_max:7.9},
        {id:67,nombre:"Cactus",temp_min:6,temp_max:28.9,hum_suelo_min:21,hum_suelo_max:68,hum_ambiente_min:46,hum_ambiente_max:73,ph_min:4.8,ph_max:6.7},
        {id:68,nombre:"Suculenta",temp_min:9.7,temp_max:34.9,hum_suelo_min:34,hum_suelo_max:65,hum_ambiente_min:59,hum_ambiente_max:74,ph_min:5,ph_max:7.4},
        {id:69,nombre:"Aloe Vera",temp_min:9.9,temp_max:37.3,hum_suelo_min:36,hum_suelo_max:83,hum_ambiente_min:58,hum_ambiente_max:73,ph_min:5.1,ph_max:7.3},
        {id:70,nombre:"Bambú",temp_min:15.9,temp_max:33.3,hum_suelo_min:29,hum_suelo_max:84,hum_ambiente_min:49,hum_ambiente_max:86,ph_min:5.3,ph_max:7.4},
        {id:71,nombre:"Hibisco",temp_min:5.5,temp_max:26.3,hum_suelo_min:36,hum_suelo_max:85,hum_ambiente_min:54,hum_ambiente_max:82,ph_min:5,ph_max:7.9}
    ];

    var allPlants = CATALOGO_PLANTAS;

    function init() {
        loadFromSupabase().then(function() { render(); });
        cargarCatalogoPlantas();
        EventBus.on('maceta:selected', function() {
            setTimeout(showRecommendations, 50);
        });
        EventBus.on('sidebar:selectInv', function() {
            setTimeout(showRecommendations, 50);
        });
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

    function showRecommendations() {
        var container = document.getElementById('plantRecommendations');
        var list = document.getElementById('plantRecList');
        if (!container || !list) return;

        var inv = AppState.get('currentInv') || 0;
        var currentMac = AppState.get('currentMaceta') || 1;

        var otherMacetas = [];
        for (var m = 1; m <= 4; m++) {
            if (m === currentMac) continue;
            try {
                var key = 'huerto_config_inv' + (inv + 1) + '_mac' + m;
                var saved = JSON.parse(localStorage.getItem(key) || 'null');
                if (!saved) continue;
                var plantId = null;
                var planta = null;
                var tk = 'huerto_planta_inv' + (inv + 1) + '_mac' + m;
                var plantaSaved = JSON.parse(localStorage.getItem(tk) || 'null');
                if (plantaSaved && plantaSaved.id) {
                    plantId = plantaSaved.id;
                    planta = allPlants.find(function(p) { return p.id === plantId; });
                }
                if (planta) {
                    var tMin = (saved.temp_min !== undefined) ? saved.temp_min : planta.temp_min;
                    var tMax = (saved.temp_max !== undefined) ? saved.temp_max : planta.temp_max;
                    otherMacetas.push({ maceta: m, planta: planta, temp_min: tMin, temp_max: tMax });
                }
            } catch (e) {}
        }

        if (otherMacetas.length === 0) {
            container.style.display = 'none';
            return;
        }

        var avgMin = 0, avgMax = 0;
        for (var i = 0; i < otherMacetas.length; i++) {
            avgMin += otherMacetas[i].temp_min;
            avgMax += otherMacetas[i].temp_max;
        }
        avgMin /= otherMacetas.length;
        avgMax /= otherMacetas.length;

        var usedIds = {};
        otherMacetas.forEach(function(o) { usedIds[o.planta.id] = true; });

        var scored = allPlants
            .filter(function(p) { return !usedIds[p.id]; })
            .map(function(p) {
                var overlapMin = Math.max(p.temp_min, avgMin);
                var overlapMax = Math.min(p.temp_max, avgMax);
                var overlap = Math.max(0, overlapMax - overlapMin);
                var rangeSize = Math.max(p.temp_max - p.temp_min, 1);
                var score = overlap / rangeSize;
                return { p: p, score: score, overlap: overlap };
            })
            .filter(function(x) { return x.score > 0.3; })
            .sort(function(a, b) { return b.score - a.score; })
            .slice(0, 5);

        if (scored.length === 0) {
            container.style.display = 'none';
            return;
        }

        var othersInfo = otherMacetas.map(function(m) {
            return 'MAC-' + (m.maceta < 10 ? '0' + m.maceta : m.maceta) + ': ' + m.planta.nombre + ' (' + m.temp_min + '-' + m.temp_max + '\u00B0C)';
        }).join(', ');

        var html = '<div class="plant-rec-others" style="padding:4px 10px;font-size:9px;color:var(--text-muted);font-family:JetBrains Mono,monospace;letter-spacing:0.5px;border-bottom:1px solid #222;">Ya configuradas: ' + othersInfo + '</div>';
        for (var k = 0; k < scored.length; k++) {
            var x = scored[k];
            var pct = Math.round(x.score * 100);
            var cls = pct >= 80 ? 'high' : 'med';
            html += '<div class="plant-rec-item" data-plant-id="' + x.p.id + '">' +
                '<span class="material-icons-round">eco</span>' +
                '<span class="plant-rec-name">' + x.p.nombre + '</span>' +
                '<span class="plant-rec-range">' + x.p.temp_min + '-' + x.p.temp_max + '\u00B0C</span>' +
                '<span class="plant-rec-match ' + cls + '">' + pct + '%</span>' +
            '</div>';
        }
        list.innerHTML = html;
        container.style.display = 'block';

        var items = list.querySelectorAll('.plant-rec-item');
        for (var j = 0; j < items.length; j++) {
            (function(item) {
                item.addEventListener('click', function() {
                    var pid = parseInt(item.getAttribute('data-plant-id'));
                    seleccionarPlanta(pid);
                    container.style.display = 'none';
                });
            })(items[j]);
        }
    }

    // ============================================================
    // MODAL: AGREGAR PLANTA
    // ============================================================

    function openAddPlantModal() {
        var modal = document.getElementById('addPlantModal');
        if (!modal) return;
        var err = document.getElementById('addPlantError');
        if (err) { err.style.display = 'none'; err.textContent = ''; }
        ['np-nombre','np-temp-min','np-temp-max','np-hs-min','np-hs-max','np-ha-min','np-ha-max','np-ph-min','np-ph-max'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
        modal.classList.add('active');
    }

    function closeAddPlantModal() {
        var modal = document.getElementById('addPlantModal');
        if (modal) modal.classList.remove('active');
    }

    function getFloat(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback;
        var v = parseFloat(el.value);
        return isNaN(v) ? fallback : v;
    }

    function submitNewPlant() {
        var err = document.getElementById('addPlantError');
        var nombre = (document.getElementById('np-nombre').value || '').trim();
        if (!nombre) {
            err.textContent = 'El nombre es obligatorio';
            err.style.display = 'block';
            return;
        }
        var payload = {
            nombre: nombre,
            temp_min: getFloat('np-temp-min', null),
            temp_max: getFloat('np-temp-max', null),
            hum_suelo_min: getFloat('np-hs-min', null),
            hum_suelo_max: getFloat('np-hs-max', null),
            hum_ambiente_min: getFloat('np-ha-min', null),
            hum_ambiente_max: getFloat('np-ha-max', null),
            ph_min: getFloat('np-ph-min', null),
            ph_max: getFloat('np-ph-max', null)
        };
        var btn = document.getElementById('btnSaveNewPlant');
        if (btn) { btn.disabled = true; btn.classList.add('loading'); }
        ApiService.sbInsert('catalogo_plantas', payload).then(function() {
            allPlants.push(Object.assign({id: Date.now()}, payload));
            closeAddPlantModal();
            if (window.App && typeof App.showToast === 'function') {
                App.showToast('Planta "' + nombre + '" agregada al catalogo', 'success');
            }
        }).catch(function(e) {
            err.textContent = 'Error al guardar: ' + (e && e.message ? e.message : e);
            err.style.display = 'block';
        }).then(function() {
            if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
        });
    }

    function initAddPlantModal() {
        var btnAdd = document.getElementById('btnAddPlant');
        var btnSave = document.getElementById('btnSaveNewPlant');
        var btnCancel = document.getElementById('btnCancelAddPlant');
        var btnClose = document.getElementById('addPlantModalClose');
        var modal = document.getElementById('addPlantModal');
        if (btnAdd) btnAdd.addEventListener('click', openAddPlantModal);
        if (btnSave) btnSave.addEventListener('click', submitNewPlant);
        if (btnCancel) btnCancel.addEventListener('click', closeAddPlantModal);
        if (btnClose) btnClose.addEventListener('click', closeAddPlantModal);
        if (modal) modal.addEventListener('click', function(e) {
            if (e.target === modal) closeAddPlantModal();
        });
    }

    // ============================================================
    // MODAL: RECOMENDACIONES
    // ============================================================

    function openRecommendationsModal() {
        var modal = document.getElementById('recPlantModal');
        var list = document.getElementById('recPlantList');
        var info = document.getElementById('recInfo');
        if (!modal || !list || !info) return;

        var inv = AppState.get('currentInv') || 0;
        var currentMac = AppState.get('currentMaceta') || 1;

        var otherMacetas = [];
        for (var m = 1; m <= 4; m++) {
            if (m === currentMac) continue;
            try {
                var key = 'huerto_config_inv' + (inv + 1) + '_mac' + m;
                var saved = JSON.parse(localStorage.getItem(key) || 'null');
                if (!saved) continue;
                var tk = 'huerto_planta_inv' + (inv + 1) + '_mac' + m;
                var plantaSaved = JSON.parse(localStorage.getItem(tk) || 'null');
                if (plantaSaved && plantaSaved.id) {
                    var planta = allPlants.find(function(p) { return p.id === plantaSaved.id; });
                    if (planta) {
                        var tMin = (saved.temp_min !== undefined) ? saved.temp_min : planta.temp_min;
                        var tMax = (saved.temp_max !== undefined) ? saved.temp_max : planta.temp_max;
                        var haMin = (saved.humAmb && saved.humAmb.min !== undefined) ? saved.humAmb.min : planta.hum_ambiente_min;
                        var haMax = (saved.humAmb && saved.humAmb.max !== undefined) ? saved.humAmb.max : planta.hum_ambiente_max;
                        otherMacetas.push({
                            maceta: m, planta: planta,
                            temp_min: tMin, temp_max: tMax,
                            ha_min: haMin, ha_max: haMax
                        });
                    }
                }
            } catch (e) {}
        }

        if (otherMacetas.length === 0) {
            info.innerHTML = '<div class="rec-empty">Configura al menos otra maceta del invernadero para ver recomendaciones de plantas compatibles.</div>';
            list.innerHTML = '';
            modal.classList.add('active');
            return;
        }

        var avgTempMin = 0, avgTempMax = 0, avgHaMin = 0, avgHaMax = 0;
        for (var i = 0; i < otherMacetas.length; i++) {
            avgTempMin += otherMacetas[i].temp_min;
            avgTempMax += otherMacetas[i].temp_max;
            avgHaMin += otherMacetas[i].ha_min;
            avgHaMax += otherMacetas[i].ha_max;
        }
        avgTempMin /= otherMacetas.length;
        avgTempMax /= otherMacetas.length;
        avgHaMin /= otherMacetas.length;
        avgHaMax /= otherMacetas.length;

        var usedIds = {};
        otherMacetas.forEach(function(o) { usedIds[o.planta.id] = true; });

        var scored = allPlants
            .filter(function(p) { return !usedIds[p.id]; })
            .map(function(p) {
                var tOverlapMin = Math.max(p.temp_min || 0, avgTempMin);
                var tOverlapMax = Math.min(p.temp_max || 50, avgTempMax);
                var tOverlap = Math.max(0, tOverlapMax - tOverlapMin);
                var tRange = Math.max((p.temp_max || 0) - (p.temp_min || 0), 1);
                var tScore = tOverlap / tRange;

                var haOverlapMin = Math.max(p.hum_ambiente_min || 0, avgHaMin);
                var haOverlapMax = Math.min(p.hum_ambiente_max || 100, avgHaMax);
                var haOverlap = Math.max(0, haOverlapMax - haOverlapMin);
                var haRange = Math.max((p.hum_ambiente_max || 0) - (p.hum_ambiente_min || 0), 1);
                var haScore = haOverlap / haRange;

                var score = (tScore + haScore) / 2;
                return { p: p, score: score };
            })
            .filter(function(x) { return x.score > 0.3; })
            .sort(function(a, b) { return b.score - a.score; })
            .slice(0, 10);

        if (scored.length === 0) {
            info.innerHTML = '<div class="rec-empty">No se encontraron plantas con requisitos similares en el catalogo.</div>';
            list.innerHTML = '';
        } else {
            var othersInfo = otherMacetas.map(function(m) {
                return 'MAC-' + (m.maceta < 10 ? '0' + m.maceta : m.maceta) + ': ' + m.planta.nombre +
                    ' (' + m.temp_min + '-' + m.temp_max + '\u00b0C, ' + m.ha_min + '-' + m.ha_max + '% hum)';
            }).join(' | ');
            info.innerHTML = '<div class="rec-others"><strong>Ya configuradas:</strong> ' + othersInfo + '</div>';
            var html = '';
            for (var k = 0; k < scored.length; k++) {
                var x = scored[k];
                var pct = Math.round(x.score * 100);
                var cls = pct >= 80 ? 'high' : (pct >= 50 ? 'med' : 'low');
                html += '<div class="plant-rec-item" data-plant-id="' + x.p.id + '">' +
                    '<span class="material-icons-round">eco</span>' +
                    '<div class="plant-rec-info">' +
                        '<span class="plant-rec-name">' + x.p.nombre + '</span>' +
                        '<span class="plant-rec-ranges">' +
                            'T:' + x.p.temp_min + '-' + x.p.temp_max + '\u00b0C | ' +
                            'HA:' + x.p.hum_ambiente_min + '-' + x.p.hum_ambiente_max + '%' +
                        '</span>' +
                    '</div>' +
                    '<span class="plant-rec-match ' + cls + '">' + pct + '%</span>' +
                '</div>';
            }
            list.innerHTML = html;
            var items = list.querySelectorAll('.plant-rec-item');
            for (var j = 0; j < items.length; j++) {
                (function(item) {
                    item.addEventListener('click', function() {
                        var pid = parseInt(item.getAttribute('data-plant-id'));
                        seleccionarPlanta(pid);
                        modal.classList.remove('active');
                    });
                })(items[j]);
            }
        }
        modal.classList.add('active');
    }

    function closeRecommendationsModal() {
        var modal = document.getElementById('recPlantModal');
        if (modal) modal.classList.remove('active');
    }

    function initRecommendationsModal() {
        var btn = document.getElementById('btnShowRecommendations');
        var btnClose = document.getElementById('recPlantModalClose');
        var modal = document.getElementById('recPlantModal');
        if (btn) btn.addEventListener('click', openRecommendationsModal);
        if (btnClose) btnClose.addEventListener('click', closeRecommendationsModal);
        if (modal) modal.addEventListener('click', function(e) {
            if (e.target === modal) closeRecommendationsModal();
        });
    }

    // ============================================================
    // INIT HOOK - registra listeners de los nuevos botones
    // ============================================================

    var _origInit = init;
    init = function() {
        _origInit();
        initAddPlantModal();
        initRecommendationsModal();
    };

    return {
        init: init, destroy: destroy,
        cargarCatalogoPlantas: cargarCatalogoPlantas,
        showRecommendations: showRecommendations,
        seleccionarPlanta: seleccionarPlanta,
        openAddPlantModal: openAddPlantModal,
        openRecommendationsModal: openRecommendationsModal,
        get allPlants() { return allPlants; }
    };
})();

if (typeof window !== 'undefined') window.ConfigModule = ConfigModule;
