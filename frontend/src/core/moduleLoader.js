// ============================================================
// ModuleLoader - Dynamic script/style loader with caching
// ============================================================
// Loads JS/CSS files on demand and caches loaded modules.
// Ensures each module is loaded only once.
// ============================================================

var ModuleLoader = (function() {
    var loaded = {};
    var loading = {};
    var basePath = '';

    function setBase(path) {
        basePath = path;
    }

    function loadScript(src) {
        if (loaded[src]) return Promise.resolve();
        if (loading[src]) return loading[src];

        loading[src] = new Promise(function(resolve, reject) {
            var script = document.createElement('script');
            script.src = basePath + src;
            script.onload = function() {
                loaded[src] = true;
                resolve();
            };
            script.onerror = function() {
                console.error('[ModuleLoader] Failed to load:', src);
                reject(new Error('Failed to load ' + src));
            };
            document.head.appendChild(script);
        });
        return loading[src];
    }

    function loadCSS(src) {
        if (loaded[src]) return Promise.resolve();
        if (loading[src]) return loading[src];

        loading[src] = new Promise(function(resolve, reject) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + src;
            link.onload = function() {
                loaded[src] = true;
                resolve();
            };
            link.onerror = function() {
                console.error('[ModuleLoader] Failed to load CSS:', src);
                resolve(); // CSS failure is non-blocking
            };
            document.head.appendChild(link);
        });
        return loading[src];
    }

    function loadBundle(scripts, styles) {
        var promises = [];
        if (styles) {
            styles.forEach(function(s) { promises.push(loadCSS(s)); });
        }
        if (scripts) {
            scripts.forEach(function(s) { promises.push(loadScript(s)); });
        }
        return Promise.all(promises);
    }

    function isLoaded(src) {
        return !!loaded[src];
    }

    function reset() {
        loaded = {};
        loading = {};
    }

    return { loadScript: loadScript, loadCSS: loadCSS, loadBundle: loadBundle, setBase: setBase, isLoaded: isLoaded, reset: reset };
})();

if (typeof window !== 'undefined') window.ModuleLoader = ModuleLoader;
