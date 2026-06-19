// ============================================================
// State - Centralized reactive state management
// ============================================================
// All application state lives here.
// Modules subscribe to state changes via EventBus.
// ============================================================

var AppState = (function() {
    var state = {
        // Auth
        user: null,
        isLoggedIn: false,
        isAdmin: false,

        // Navigation
        currentView: 'dashboard',
        sidebarOpen: false,

        // Device selection
        currentInv: 0,
        currentInvId: 1,
        currentMaceta: 1,

        // Sensor data
        sensors: {},
        sensorHistory: {},
        lastUpdate: null,

        // Actuator data
        actuators: {},
        actuatorStates: {},

        // Simulation
        activeOverride: null,
        overridePhase: null,

        // Config
        umbrales: {
            temp: { min: 15, max: 30 },
            humAmb: { min: 30, max: 85 },
            humSuelo: { min: 40, max: 80 },
            ph: { min: 5.5, max: 7.5 }
        },

        // Connection
        isConnected: false,
        bridgeStatus: 'offline',

        // UI
        loading: true,
        sensorModalOpen: false,
        sensorModalType: null
    };

    function get(key) {
        if (key) {
            return key.split('.').reduce(function(obj, k) { return obj && obj[k]; }, state);
        }
        return state;
    }

    function set(key, value) {
        var keys = key.split('.');
        var obj = state;
        for (var i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        var old = obj[keys[keys.length - 1]];
        obj[keys[keys.length - 1]] = value;
        if (old !== value) {
            EventBus.emit('state:' + key, { value: value, old: old, key: key });
            EventBus.emit('state:change', { key: key, value: value, old: old });
        }
    }

    function batch(updates) {
        var changes = [];
        for (var key in updates) {
            if (updates.hasOwnProperty(key)) {
                var keys = key.split('.');
                var obj = state;
                for (var i = 0; i < keys.length - 1; i++) {
                    if (!obj[keys[i]]) obj[keys[i]] = {};
                    obj = obj[keys[i]];
                }
                var old = obj[keys[keys.length - 1]];
                obj[keys[keys.length - 1]] = updates[key];
                if (old !== updates[key]) {
                    changes.push({ key: key, value: updates[key], old: old });
                }
            }
        }
        changes.forEach(function(c) {
            EventBus.emit('state:' + c.key, { value: c.value, old: c.old, key: c.key });
        });
        if (changes.length > 0) {
            EventBus.emit('state:batch', changes);
        }
    }

    function subscribe(key, callback) {
        return EventBus.on('state:' + key, callback);
    }

    function init() {
        // Load persisted state
        try {
            var auth = JSON.parse(localStorage.getItem('huerto_auth'));
            if (auth) {
                set('user', auth);
                set('isLoggedIn', true);
                set('isAdmin', auth.role === 'admin');
            }
        } catch (e) {}

        try {
            var saved = JSON.parse(localStorage.getItem('huerto_umbrales'));
            if (saved) set('umbrales', saved);
        } catch (e) {}
    }

    function persistUmbrales() {
        localStorage.setItem('huerto_umbrales', JSON.stringify(state.umbrales));
    }

    return { get: get, set: set, batch: batch, subscribe: subscribe, init: init, persistUmbrales: persistUmbrales };
})();

if (typeof window !== 'undefined') window.AppState = AppState;
