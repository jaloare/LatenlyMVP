document.addEventListener('DOMContentLoaded', async () => {
    // Check if already logged in
    const alreadyAuth = await LatenlyAuth.redirectIfAuthenticated('/reporte/');
    if (alreadyAuth) return;

    // DOM Elements
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const submitBtn = document.getElementById('submitBtn');
    const submitWrapper = document.getElementById('submitWrapper');
    const errorBox = document.getElementById('loginError');
    const successBox = document.getElementById('loginSuccess');
    const subtitle = document.getElementById('loginSubtitle');
    const forgotLink = document.getElementById('forgotLink');
    const forgotLinkWrapper = document.getElementById('forgotLinkWrapper');
    const passwordToggle = document.getElementById('passwordToggle');

    // Password visibility toggle
    passwordToggle.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggle.textContent = isPassword ? '🙈' : '👁';
    });

    // Forgot password
    forgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) {
            showError('Ingresa tu email primero.');
            emailInput.focus();
            return;
        }

        try {
            LatenlyAuth.init();
            const { error } = await LatenlyAuth.client.auth.resetPasswordForEmail(email);
            if (error) {
                showError(error.message);
            } else {
                showSuccess('Te enviamos un enlace para restablecer tu contraseña. Revisa tu email.');
            }
        } catch (err) {
            showError('Error al enviar el enlace. Intenta de nuevo.');
        }
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessages();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError('Completa todos los campos.');
            return;
        }

        if (password.length < 6) {
            showError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setLoading(true);

        try {
            const result = await LatenlyAuth.signIn(email, password);
            if (result.error) {
                showError(result.error);
            } else {
                const params = new URLSearchParams(window.location.search);
                const redirect = params.get('redirect') || '/reporte/';
                window.location.replace(redirect);
                return;
            }
        } catch (err) {
            showError('Error de conexión. Intenta de nuevo.');
        }

        setLoading(false);
    });

    // Helpers
    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.classList.add('visible');
        successBox.classList.remove('visible');
    }

    function showSuccess(msg) {
        successBox.textContent = msg;
        successBox.classList.add('visible');
        errorBox.classList.remove('visible');
    }

    function hideMessages() {
        errorBox.classList.remove('visible');
        successBox.classList.remove('visible');
    }

    function setLoading(loading) {
        if (loading) {
            submitWrapper.classList.add('loading');
            submitBtn.disabled = true;
        } else {
            submitWrapper.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }
});
