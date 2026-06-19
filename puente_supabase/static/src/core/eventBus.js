// ============================================================
// EventBus - Centralized pub/sub for module communication
// ============================================================
// Modules communicate through events, not direct references.
// This decouples all modules completely.
// ============================================================

var EventBus = (function() {
    var listeners = {};

    function on(event, callback, context) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push({ fn: callback, ctx: context || null });
        return function off() {
            listeners[event] = listeners[event].filter(function(l) { return l.fn !== callback; });
        };
    }

    function emit(event, data) {
        var handlers = listeners[event];
        if (!handlers) return;
        for (var i = 0; i < handlers.length; i++) {
            try {
                handlers[i].fn.call(handlers[i].ctx, data);
            } catch (e) {
                console.error('[EventBus] Error in handler for "' + event + '":', e);
            }
        }
    }

    function off(event, callback) {
        if (!listeners[event]) return;
        if (!callback) { listeners[event] = []; return; }
        listeners[event] = listeners[event].filter(function(l) { return l.fn !== callback; });
    }

    function once(event, callback, context) {
        var unsub = on(event, function(data) {
            unsub();
            callback.call(context || null, data);
        });
        return unsub;
    }

    return { on: on, emit: emit, off: off, once: once };
})();

if (typeof window !== 'undefined') window.EventBus = EventBus;
