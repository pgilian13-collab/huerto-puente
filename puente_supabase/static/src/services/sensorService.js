// ============================================================
// SensorService - Sensor data management
// ============================================================
// Fetches, caches, and provides sensor readings.
// Handles realtime subscriptions.
// ============================================================

var SensorService = (function() {
    var pollTimer = null;
    var realtimeChannel = null;
    var POLL_MS = 5000;

    function getSensorIds(deviceId) {
        var base = (deviceId - 1) * 10;
        return [base, base + 1, base + 2, base + 3, base + 4, base + 5, base + 6, base + 7, base + 8, base + 9];
    }

    function getSharedSensorIds(deviceId) {
        var base = (deviceId - 1) * 10;
        return { temp: base, hum_amb: base + 1 };
    }

    function getMacetaSensorIds(deviceId, maceta) {
        var base = (deviceId - 1) * 10 + 2 + (maceta - 1) * 2;
        return { hum_suelo: base, ph: base + 1 };
    }

    function fetchLatest(invIndex) {
        var deviceId = invIndex + 1;
        var ids = getSensorIds(deviceId);
        var params = 'sensor_id=in.(' + ids.join(',') + ')&order=fecha_hora.desc&limit=' + ids.length;
        return ApiService.sbQuery('monitoreo_lecturas', params).then(function(rows) {
            if (!rows) return {};
            var latest = {};
            rows.forEach(function(r) {
                if (!latest[r.sensor_id]) latest[r.sensor_id] = r;
            });
            return latest;
        });
    }

    function fetchHistory(invIndex, limit) {
        limit = limit || 100;
        var deviceId = invIndex + 1;
        var ids = getSensorIds(deviceId);
        var params = 'sensor_id=in.(' + ids.join(',') + ')&order=fecha_hora.desc&limit=' + (limit * 10);
        return ApiService.sbQuery('monitoreo_lecturas', params).then(function(rows) {
            return rows || [];
        });
    }

    function startPolling(invIndex) {
        stopPolling();
        pollTimer = setInterval(function() {
            fetchLatest(invIndex).then(function(data) {
                AppState.set('sensors', data);
                AppState.set('lastUpdate', new Date().toISOString());
                EventBus.emit('sensors:updated', data);
            });
        }, POLL_MS);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    function startRealtime(invIndex) {
        stopRealtime();
        var deviceId = invIndex + 1;
        realtimeChannel = ApiService.SUPABASE_URL ? null : null; // Placeholder
        // Realtime would use Supabase channel here
        // Kept minimal for now - polling is sufficient
    }

    function stopRealtime() {
        realtimeChannel = null;
    }

    function init(invIndex) {
        return fetchLatest(invIndex).then(function(data) {
            AppState.set('sensors', data);
            EventBus.emit('sensors:updated', data);
            startPolling(invIndex);
        });
    }

    function destroy() {
        stopPolling();
        stopRealtime();
    }

    return {
        getSensorIds: getSensorIds,
        getSharedSensorIds: getSharedSensorIds,
        getMacetaSensorIds: getMacetaSensorIds,
        fetchLatest: fetchLatest,
        fetchHistory: fetchHistory,
        startPolling: startPolling,
        stopPolling: stopPolling,
        startRealtime: startRealtime,
        stopRealtime: stopRealtime,
        init: init,
        destroy: destroy
    };
})();

if (typeof window !== 'undefined') window.SensorService = SensorService;
