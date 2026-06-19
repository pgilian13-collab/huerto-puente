// ============================================================
// SIDEBAR.JS - Navigation + View Switching
// ============================================================

let currentView = 'dashboard';

function initSidebar() {
    var user = getCurrentUser();
    if (!user) {
        window.location.href = '/login';
        return;
    }

    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userRole').textContent = user.role === 'admin' ? 'Administrador' : 'Visitante';
    document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();

    if (user.role === 'admin') {
        var menuAdmin = document.getElementById('menuAdmin');
        var menuConfig = document.getElementById('menuConfig');
        if (menuAdmin) menuAdmin.style.display = 'block';
        if (menuConfig) menuConfig.style.display = 'block';
    }

    document.querySelectorAll('.menu-item[data-view]').forEach(function(item) {
        item.addEventListener('click', function() {
            var view = this.getAttribute('data-view');
            if (view === 'juego' || view === 'simulacion' || view === 'config') {
                if (!isAdmin()) {
                    alert('Solo los administradores pueden acceder a esta seccion.');
                    return;
                }
            }
            showView(view);
        });
    });

    document.getElementById('btnLogout').addEventListener('click', function() {
        handleLogout();
    });

    showView('dashboard');
}

function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

function closeSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
}

function showView(viewName) {
    currentView = viewName;

    document.querySelectorAll('.app-view').forEach(function(v) {
        v.classList.remove('active');
    });
    var target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');

    document.querySelectorAll('.menu-item').forEach(function(m) {
        m.classList.remove('active');
    });
    var menuBtn = document.querySelector('.menu-item[data-view="' + viewName + '"]');
    if (menuBtn) menuBtn.classList.add('active');

    closeSidebar();

    if (viewName === 'dashboard') {
        var invTabs = document.querySelector('.inv-tabs');
        var macetaNav = document.querySelector('.maceta-nav');
        if (invTabs) invTabs.style.display = 'flex';
        if (macetaNav) macetaNav.style.display = 'flex';
    } else {
        var invTabs2 = document.querySelector('.inv-tabs');
        var macetaNav2 = document.querySelector('.maceta-nav');
        if (invTabs2) invTabs2.style.display = 'none';
        if (macetaNav2) macetaNav2.style.display = 'none';
    }

    if (viewName === 'juego' && typeof huertoGame !== 'undefined') {
        huertoGame.reset();
    }
}
