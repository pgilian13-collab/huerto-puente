// ============================================================
// ApiService - HTTP client for Supabase REST + Bridge
// ============================================================
// Centralized API layer. All HTTP requests go through here.
// Handles auth headers, retries, and error handling.
// ============================================================

var ApiService = (function() {
    var SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) ? CONFIG.SUPABASE_URL : 'https://nzicdhwoficzsafhdxmq.supabase.co';
    var SUPABASE_KEY = (typeof CONFIG !== 'undefined' && (CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_KEY)) ? (CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_KEY) : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aWNkaHdvZmljenNhZmhkeG1xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc4MTg0MywiZXhwIjoyMDk2MzU3ODQzfQ.Al5773jpjE6YiQ_hzyLVAVIzzgk0DkU8xQPMGkjXtOU';
    var BRIDGE_URL = (typeof CONFIG !== 'undefined' && CONFIG.BRIDGE_URL) ? CONFIG.BRIDGE_URL : 'https://huerto-puente.onrender.com';
    var BRIDGE_KEY = (typeof CONFIG !== 'undefined' && CONFIG.BRIDGE_KEY) ? CONFIG.BRIDGE_KEY : 'huerto-ccss-2026';

    function headers() {
        return {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
        };
    }

    function get(url, opts) {
        return fetch(url, { headers: headers() })
            .then(function(r) { return r.ok ? r.json() : null; })
            .catch(function(e) { console.error('[API] GET error:', e); return null; });
    }

    function post(url, data, extraHeaders) {
        var h = headers();
        if (extraHeaders) Object.assign(h, extraHeaders);
        return fetch(url, { method: 'POST', headers: h, body: JSON.stringify(data) })
            .then(function(r) { return r.ok ? r.json() : null; })
            .catch(function(e) { console.error('[API] POST error:', e); return null; });
    }

    function patch(url, data) {
        return fetch(url, { method: 'PATCH', headers: headers(), body: JSON.stringify(data) })
            .then(function(r) { return r.ok ? r.json() : null; })
            .catch(function(e) { console.error('[API] PATCH error:', e); return null; });
    }

    function del(url) {
        return fetch(url, { method: 'DELETE', headers: headers() })
            .then(function(r) { return r.ok; })
            .catch(function(e) { console.error('[API] DELETE error:', e); return false; });
    }

    // Supabase REST helpers
    function sbQuery(table, params) {
        return get(SUPABASE_URL + '/rest/v1/' + table + '?' + params);
    }

    function sbInsert(table, data) {
        return post(SUPABASE_URL + '/rest/v1/' + table, data, { 'Prefer': 'return=representation' });
    }

    function sbPatch(table, id, data) {
        return patch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, data);
    }

    // Bridge API helpers
    function bridgeGet(path) {
        return get(BRIDGE_URL + path);
    }

    function bridgePost(path, data) {
        return post(BRIDGE_URL + path, data, { 'X-Bridge-Key': BRIDGE_KEY });
    }

    function bridgePatch(path) {
        return patch(BRIDGE_URL + path, {});
    }

    function setModo(dispositivo_id, modo) {
        return bridgePost('/api/modo', { dispositivo_id: dispositivo_id, modo: modo });
    }

    function searchPlants(query, source) {
        source = source || 'both';
        return fetch(BRIDGE_URL + '/api/plants/search?q=' + encodeURIComponent(query) + '&source=' + source, {
            headers: { 'Content-Type': 'application/json' }
        })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function(e) { console.error('[API] Plant search error:', e); return null; });
    }

    function getPlantDetails(source, id) {
        return fetch(BRIDGE_URL + '/api/plants/details/' + source + '/' + encodeURIComponent(id), {
            headers: { 'Content-Type': 'application/json' }
        })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function(e) { console.error('[API] Plant details error:', e); return null; });
    }

    function importPlant(data) {
        return bridgePost('/api/plants/import', data);
    }

    function enrichPlants() {
        return bridgePost('/api/plants/enrich', {});
    }

    return {
        get: get, post: post, patch: patch, del: del,
        sbQuery: sbQuery, sbInsert: sbInsert, sbPatch: sbPatch,
        bridgeGet: bridgeGet, bridgePost: bridgePost, bridgePatch: bridgePatch,
        setModo: setModo,
        searchPlants: searchPlants, getPlantDetails: getPlantDetails,
        importPlant: importPlant, enrichPlants: enrichPlants,
        BRIDGE_URL: BRIDGE_URL, SUPABASE_URL: SUPABASE_URL, SUPABASE_KEY: SUPABASE_KEY
    };
})();

if (typeof window !== 'undefined') window.ApiService = ApiService;
