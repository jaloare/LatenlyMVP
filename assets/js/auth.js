/**
 * Latenly — Centralized Auth Module (Supabase)
 * Requires: config.js loaded first, Supabase CDN loaded first
 *
 * Usage:
 *   await LatenlyAuth.init();
 *   const user = await LatenlyAuth.getUser();
 *   await LatenlyAuth.requireAuth(); // redirects to /login if no session
 */

const LatenlyAuth = (() => {
    let supabase = null;

    /**
     * Initialize the Supabase client.
     * Must be called before any other method.
     */
    function init() {
        if (supabase) return supabase;

        const cfg = window.LatenlyConfig;
        if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
            console.error('[LatenlyAuth] Missing Supabase config in LatenlyConfig');
            return null;
        }

        supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        return supabase;
    }

    /**
     * Get the current session (if any).
     * @returns {object|null} Session object or null
     */
    async function getSession() {
        init();
        if (!supabase) return null;

        const { data, error } = await supabase.auth.getSession();
        if (error) {
            console.error('[LatenlyAuth] getSession error:', error.message);
            return null;
        }
        return data.session;
    }

    /**
     * Get the current user (if authenticated).
     * @returns {object|null} User object or null
     */
    async function getUser() {
        const session = await getSession();
        return session?.user || null;
    }

    /**
     * Sign in with email and password.
     * @param {string} email
     * @param {string} password
     * @returns {{ user: object|null, error: string|null }}
     */
    async function signIn(email, password) {
        init();
        if (!supabase) return { user: null, error: 'Supabase not initialized' };

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return { user: null, error: _translateError(error.message) };
        }
        return { user: data.user, error: null };
    }

    /**
     * Sign out the current user.
     */
    async function signOut() {
        init();
        if (!supabase) return;

        await supabase.auth.signOut();
        window.location.href = '/login/';
    }

    /**
     * Auth guard: redirects to /login if no active session.
     * Call this at the top of protected pages.
     * @returns {object|null} The authenticated user if present
     */
    async function requireAuth() {
        const session = await getSession();
        if (!session) {
            const currentPath = window.location.pathname + window.location.search;
            window.location.replace(`/login/?redirect=${encodeURIComponent(currentPath)}`);
            return null;
        }
        return session.user;
    }

    /**
     * Redirect away from login if already authenticated.
     * Call this on the login page.
     * @param {string} defaultRedirect - Where to go if no redirect param
     */
    async function redirectIfAuthenticated(defaultRedirect = '/reporte/') {
        const session = await getSession();
        if (session) {
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get('redirect') || defaultRedirect;
            window.location.replace(redirect);
            return true;
        }
        return false;
    }

    /**
     * Translate Supabase error messages to Spanish.
     */
    function _translateError(msg) {
        const map = {
            'Invalid login credentials': 'Email o contraseña incorrectos.',
            'User already registered': 'Este email ya tiene una cuenta.',
            'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
            'Unable to validate email address: invalid format': 'Formato de email inválido.',
            'Email rate limit exceeded': 'Demasiados intentos. Espera unos minutos.'
        };
        return map[msg] || msg;
    }

    // Public API
    return {
        init,
        getSession,
        getUser,
        signIn,
        signOut,
        requireAuth,
        redirectIfAuthenticated,
        get client() { return supabase; }
    };
})();

window.LatenlyAuth = LatenlyAuth;
