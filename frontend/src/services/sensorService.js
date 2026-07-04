// ============================================================
// SensorService - Sensor data management
// ============================================================
// Fetches, caches, and provides sensor readings.
// Uses Supabase Realtime for instant updates.
// ============================================================

var SensorService = (function() {
    var pollTimer = null;
    var realtimeChannel = null;
    var POLL_MS = 5000;
    var USE_REALTIME = true;
    var INV_INDEX = 0;
    var connectionStartTime = null;

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

    function fetchHistoryForMaceta(invIndex, maceta, limit) {
        limit = limit || 48;
        var deviceId = invIndex + 1;
        var shared = getSharedSensorIds(deviceId);
        var macetaIds = getMacetaSensorIds(deviceId, maceta);
        var ids = [shared.temp, shared.hum_amb, macetaIds.hum_suelo, macetaIds.ph];
        var params = 'sensor_id=in.(' + ids.join(',') + ')&order=fecha_hora.desc&limit=' + (limit * 4);
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
        INV_INDEX = invIndex;
        var deviceId = invIndex + 1;
        var ids = getSensorIds(deviceId);

        if (typeof supabase === 'undefined' || !supabase.createClient) {
            console.warn('[SensorService] Supabase JS not loaded, falling back to polling');
            startPolling(invIndex);
            return;
        }

        try {
            var sbUrl = ApiService.SUPABASE_URL;
            var sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aWNkaHdvZmljenNhZmhkeG1xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc4MTg0MywiZXhwIjoyMDk2MzU3ODQzfQ.Al5773jpjE6YiQ_hzyLVAVIzzgk0DkU8xQPMGkjXtOU';
            var client = supabase.createClient(sbUrl, sbKey);

            realtimeChannel = client
                .channel('lecturas-realtime-' + deviceId)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'monitoreo_lecturas'
                }, function(payload) {
                    var newRow = payload.new;
                    if (newRow && ids.indexOf(newRow.sensor_id) !== -1) {
                        var current = AppState.get('sensors') || {};
                        current[newRow.sensor_id] = newRow;
                        AppState.set('sensors', current);
                        AppState.set('lastUpdate', new Date().toISOString());
                        EventBus.emit('sensors:updated', current);
                    }
                })
                .subscribe(function(status) {
                    if (status === 'SUBSCRIBED') {
                        console.log('[SensorService] Realtime connected for INV-0' + deviceId);
                    }
                });
        } catch (e) {
            console.warn('[SensorService] Realtime init failed, falling back to polling:', e);
            startPolling(invIndex);
        }
    }

    function stopRealtime() {
        if (realtimeChannel) {
            realtimeChannel.unsubscribe();
            realtimeChannel = null;
        }
    }

    function init(invIndex) {
        INV_INDEX = invIndex;
        connectionStartTime = new Date().toISOString();
        return fetchLatest(invIndex).then(function(data) {
            AppState.set('sensors', data);
            EventBus.emit('sensors:updated', data);
            if (USE_REALTIME) {
                startRealtime(invIndex);
            } else {
                startPolling(invIndex);
            }
        });
    }

    function switchDevice(invIndex) {
        INV_INDEX = invIndex;
        stopRealtime();
        stopPolling();
        return init(invIndex);
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
        fetchHistoryForMaceta: fetchHistoryForMaceta,
        startPolling: startPolling,
        stopPolling: stopPolling,
        startRealtime: startRealtime,
        stopRealtime: stopRealtime,
        switchDevice: switchDevice,
        init: init,
        destroy: destroy
    };
})();

if (typeof window !== 'undefined') window.SensorService = SensorService;
