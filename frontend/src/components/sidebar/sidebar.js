// ============================================================
// Sidebar Component - Fullscreen overlay menu
// ============================================================

var SidebarComponent = (function() {
    var NAV_ITEMS = [
        { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', desc: 'Panel principal' },
        { id: 'tabla', icon: 'table_chart', label: 'Tabla Sensores', desc: 'Datos en tiempo real' },
        { id: 'reportes', icon: 'assessment', label: 'Reportes', desc: 'Analisis historico' },
        { id: 'juego', icon: 'videogame_asset', label: 'Juego', desc: 'Huerto Challenge' }
    ];

    function render() {
        var user = AppState.get('user') || {};
        var isAdmin = AppState.get('isAdmin');
        var currentView = AppState.get('currentView');
        var currentInv = AppState.get('currentInv') || 0;

        var html = '<div class="sidebar-header">';
        html += '<img class="sidebar-logo-img" src="https://www.unheval.edu.pe/portal/wp-content/uploads/2025/02/logounh-324x84-1-300x78.png" alt="UNHEVAL">';
        html += '<button class="sidebar-close" id="sidebarClose"><span class="material-icons-round">close</span></button>';
        html += '</div>';

        // Greenhouse tabs
        html += '<div class="sidebar-inv-tabs">';
        for (var i = 0; i < 5; i++) {
            var active = i === currentInv ? ' active' : '';
            html += '<div class="sidebar-inv-tab' + active + '" data-index="' + i + '">INV-0' + (i + 1) + '</div>';
        }
        html += '</div>';

        // Navigation grid
        html += '<div class="sidebar-nav">';
        html += '<div class="sidebar-grid">';
        NAV_ITEMS.forEach(function(item) {
            if (item.id === 'juego' && !isAdmin) return;
            var active = currentView === item.id ? ' active' : '';
            html += '<div class="sidebar-nav-item' + active + '" data-view="' + item.id + '">';
            html += '<span class="material-icons-round">' + item.icon + '</span>';
            html += '<div class="sidebar-nav-label">' + item.label + '</div>';
            html += '<div class="sidebar-nav-desc">' + item.desc + '</div>';
            html += '</div>';
        });
        html += '</div></div>';

        // User info
        html += '<div class="sidebar-user">';
        html += '<div class="user-avatar">' + (user.email ? user.email[0].toUpperCase() : 'U') + '</div>';
        html += '<div class="user-info">';
        html += '<div class="user-email">' + (user.email || 'usuario@huerto.com') + '</div>';
        html += '<div class="user-role">' + (isAdmin ? 'Administrador' : 'Visitante') + '</div>';
        html += '</div>';
        html += '</div>';

        // Logout
        html += '<div class="sidebar-footer">';
        html += '<div class="menu-item" id="btnLogout">';
        html += '<span class="material-icons-round">logout</span> Cerrar Sesion';
        html += '</div>';
        html += '</div>';

        return html;
    }

    function mount(container) {
        if (typeof container === 'string') container = document.getElementById(container);
        if (!container) return;
        container.innerHTML = render();
        bindEvents(container);
    }

    function bindEvents(container) {
        // Navigation items
        var items = container.querySelectorAll('.sidebar-nav-item[data-view]');
        for (var i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function() {
                var view = this.getAttribute('data-view');
                EventBus.emit('sidebar:navigate', view);
                close();
            });
        }

        // Greenhouse tabs
        var invTabs = container.querySelectorAll('.sidebar-inv-tab');
        for (var j = 0; j < invTabs.length; j++) {
            invTabs[j].addEventListener('click', function() {
                var idx = parseInt(this.dataset.index);
                EventBus.emit('device:changed', { index: idx, id: idx + 1 });
                // Update active state
                container.querySelectorAll('.sidebar-inv-tab').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
            });
        }

        // Close button
        var closeBtn = container.querySelector('#sidebarClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }

        // Logout button
        var logoutBtn = container.querySelector('#btnLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                App.logout();
            });
        }
    }

    function refresh() {
        var el = document.getElementById('sidebar');
        if (el) mount(el);
    }

    function open() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        AppState.set('sidebarOpen', true);
    }

    function close() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        AppState.set('sidebarOpen', false);
    }

    function init() {
        refresh();

        // Menu toggle button
        var toggle = document.getElementById('menuToggle');
        if (toggle) {
            toggle.addEventListener('click', open);
        }

        // Overlay click to close
        var overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.addEventListener('click', close);
        }

        // Listen for route changes to refresh active state
        EventBus.on('route:changed', function() { refresh(); });
        EventBus.on('device:changed', function() { refresh(); });
    }

    return { mount: mount, refresh: refresh, open: open, close: close, init: init };
})();

if (typeof window !== 'undefined') window.SidebarComponent = SidebarComponent;
