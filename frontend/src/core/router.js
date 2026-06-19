// ============================================================
// Router - SPA hash-based router with lazy module loading
// ============================================================
// Routes are registered with a load() function that returns
// a module with init()/destroy() lifecycle methods.
// Only one view is active at a time.
// Previous view is destroyed before new one initializes.
// ============================================================

var Router = (function() {
    var routes = {};
    var currentRoute = null;
    var currentModule = null;

    function register(name, config) {
        routes[name] = config;
    }

    function navigate(route) {
        window.location.hash = '#/' + route;
    }

    function handleRoute() {
        var hash = window.location.hash.replace('#/', '') || 'dashboard';
        if (hash === currentRoute) return;

        // Destroy current module
        if (currentModule && typeof currentModule.destroy === 'function') {
            try { currentModule.destroy(); } catch (e) {
                console.error('[Router] Error destroying module:', e);
            }
        }

        var route = routes[hash];
        if (!route) {
            console.warn('[Router] Unknown route:', hash);
            navigate('dashboard');
            return;
        }

        // Hide all views
        var views = document.querySelectorAll('.app-view');
        for (var i = 0; i < views.length; i++) {
            views[i].classList.remove('active');
        }

        // Show target view container
        var target = document.getElementById('view-' + hash);
        if (target) target.classList.add('active');

        currentRoute = hash;
        AppState.set('currentView', hash);

        // Load module if not cached
        if (route.module) {
            currentModule = route.module;
            if (typeof currentModule.init === 'function') {
                currentModule.init();
            }
            EventBus.emit('route:changed', { route: hash, module: currentModule });
        } else if (route.load) {
            route.load(function(mod) {
                route.module = mod;
                currentModule = mod;
                if (typeof mod.init === 'function') {
                    mod.init();
                }
                EventBus.emit('route:changed', { route: hash, module: mod });
            });
        }
    }

    function getCurrentRoute() {
        return currentRoute;
    }

    function getCurrentModule() {
        return currentModule;
    }

    function init() {
        window.addEventListener('hashchange', handleRoute);
        // Initial route
        handleRoute();
    }

    return {
        register: register,
        navigate: navigate,
        init: init,
        getCurrentRoute: getCurrentRoute,
        getCurrentModule: getCurrentModule
    };
})();

if (typeof window !== 'undefined') window.Router = Router;
