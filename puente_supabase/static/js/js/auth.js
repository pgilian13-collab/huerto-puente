// ============================================================
// AUTH.JS - Mock Authentication
// ============================================================

const AUTH_KEY = 'huerto_auth';

const MOCK_USERS = [
    { email: 'admin@huerto.com', password: 'admin123', role: 'admin', name: 'Administrador' },
];

function getStoredAuth() {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

function storeAuth(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
}

function isLoggedIn() {
    return getStoredAuth() !== null;
}

function getCurrentUser() {
    return getStoredAuth();
}

function isAdmin() {
    const u = getStoredAuth();
    return u && u.role === 'admin';
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    const btnText = document.querySelector('.btn-login-text');
    const btnLoad = document.querySelector('.btn-login-loading');

    errEl.textContent = '';
    btnText.style.display = 'none';
    btnLoad.style.display = 'inline';

    setTimeout(function() {
        const user = MOCK_USERS.find(function(u) {
            return u.email === email && u.password === pass;
        });

        if (user) {
            storeAuth({ email: user.email, role: user.role, name: user.name });
            window.location.href = '/';
        } else {
            errEl.textContent = 'Email o password incorrectos';
            btnText.style.display = 'inline';
            btnLoad.style.display = 'none';
        }
    }, 500);

    return false;
}

function handleGuest() {
    storeAuth({ email: 'visitante@local', role: 'visitor', name: 'Visitante' });
    window.location.href = '/';
}

function handleLogout() {
    clearAuth();
    window.location.href = '/login';
}

(function() {
    if (isLoggedIn() && window.location.pathname === '/login') {
        window.location.href = '/';
    }
})();
