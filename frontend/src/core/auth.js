// ============================================================
// Auth - Mock authentication module
// ============================================================

var Auth = (function() {
    var AUTH_KEY = 'huerto_auth';
    var MOCK_USERS = [
        { email: 'admin@huerto.com', password: 'admin123', name: 'Admin', role: 'admin' }
    ];

    function getStoredAuth() {
        try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch (e) { return null; }
    }

    function storeAuth(user) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    }

    function clearAuth() {
        localStorage.removeItem(AUTH_KEY);
    }

    function isLoggedIn() {
        return !!getStoredAuth();
    }

    function getCurrentUser() {
        return getStoredAuth();
    }

    function isAdmin() {
        var u = getCurrentUser();
        return u && u.role === 'admin';
    }

    function login(email, password) {
        var user = MOCK_USERS.find(function(u) { return u.email === email && u.password === password; });
        if (user) {
            storeAuth(user);
            return { success: true, user: user };
        }
        return { success: false };
    }

    function guestLogin() {
        var guest = { email: 'visitante@huerto.com', name: 'Visitante', role: 'visitor' };
        storeAuth(guest);
        return guest;
    }

    function logout() {
        clearAuth();
    }

    return { getStoredAuth: getStoredAuth, storeAuth: storeAuth, clearAuth: clearAuth, isLoggedIn: isLoggedIn, getCurrentUser: getCurrentUser, isAdmin: isAdmin, login: login, guestLogin: guestLogin, logout: logout };
})();

if (typeof window !== 'undefined') window.Auth = Auth;
