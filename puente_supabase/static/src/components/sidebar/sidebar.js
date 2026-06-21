// ============================================================
// Sidebar Component - Professional navigation hub
// ============================================================
// Organized by functional modules with section grouping.
// ============================================================

var SidebarComponent = (function() {
    var NAV_SECTIONS = [
        {
            label: 'SISTEMA',
            items: [
                { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' }
            ]
        },
        {
            label: 'MONITOREO',
            items: [
                { id: 'tabla', icon: 'table_chart', label: 'Tabla Sensores' }
            ]
        },
        {
            label: 'ANALITICA',
            items: [
                { id: 'reportes', icon: 'assessment', label: 'Reportes' }
            ]
        },
        {
            label: 'SIMULACION',
            adminOnly: true,
            items: [
                { id: 'juego', icon: 'videogame_asset', label: 'Huerto Challenge' }
            ]
        }
    ];

    function render() {
        var user = AppState.get('user') || {};
        var isAdmin = AppState.get('isAdmin');
        var currentView = AppState.get('currentView');

        var html = '<div class="sidebar-header">';
        html += '<img class="sidebar-logo-img" src="https://www.unheval.edu.pe/portal/wp-content/uploads/2025/02/logounh-324x84-1-300x78.png" alt="UNHEVAL">';
        html += '<button class="sidebar-close" onclick="SidebarComponent.close()"><span class="material-icons-round">close</span></button>';
        html += '</div>';

        html += '<div class="sidebar-user">';
        html += '<div class="user-avatar">' + (user.email ? user.email[0].toUpperCase() : 'U') + '</div>';
        html += '<div class="user-info">';
        html += '<div class="user-email">' + (user.email || 'usuario@huerto.com') + '</div>';
        html += '<div class="user-role">' + (isAdmin ? 'Administrador' : 'Visitante') + '</div>';
        html += '</div>';
        html += '</div>';

        html += '<nav class="sidebar-menu">';
        NAV_SECTIONS.forEach(function(section) {
            if (section.adminOnly && !isAdmin) return;
            html += '<div class="menu-section">';
            html += '<span class="menu-label">' + section.label + '</span>';
            section.items.forEach(function(item) {
                var active = currentView === item.id ? ' active' : '';
                html += '<div class="menu-item' + active + '" data-view="' + item.id + '">';
                html += '<span class="material-icons-round">' + item.icon + '</span> ' + item.label;
                html += '</div>';
            });
            html += '</div>';
        });
        html += '</nav>';

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
        var items = container.querySelectorAll('.menu-item[data-view]');
        for (var i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function() {
                var view = this.getAttribute('data-view');
                EventBus.emit('sidebar:navigate', view);
                close();
            });
        }
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
        EventBus.on('route:changed', function() { refresh(); });
        var hamburger = document.querySelector('.hamburger-btn');
        if (hamburger) hamburger.addEventListener('click', open);
        var overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.addEventListener('click', close);
    }

    return { mount: mount, refresh: refresh, open: open, close: close, init: init };
})();

if (typeof window !== 'undefined') window.SidebarComponent = SidebarComponent;
