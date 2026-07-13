// ============================================================
// ApiService - HTTP client for Supabase REST + Bridge
// ============================================================
// Centralized API layer. All HTTP requests go through here.
// Handles auth headers, retries, and error handling.
// ============================================================

var ApiService = (function() {
    var SUPABASE_URL = (typeof CONFIG !== 'undefined') ? CONFIG.SUPABASE_URL : '';
    var SUPABASE_KEY = (typeof CONFIG !== 'undefined') ? CONFIG.SUPABASE_ANON_KEY : '';
    var BRIDGE_URL = (typeof CONFIG !== 'undefined') ? CONFIG.BRIDGE_URL : '';
    var BRIDGE_KEY = (typeof CONFIG !== 'undefined') ? CONFIG.BRIDGE_KEY : '';

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

    return {
        get: get, post: post, patch: patch, del: del,
        sbQuery: sbQuery, sbInsert: sbInsert, sbPatch: sbPatch,
        bridgeGet: bridgeGet, bridgePost: bridgePost, bridgePatch: bridgePatch,
        BRIDGE_URL: BRIDGE_URL, SUPABASE_URL: SUPABASE_URL
    };
})();

if (typeof window !== 'undefined') window.ApiService = ApiService;
