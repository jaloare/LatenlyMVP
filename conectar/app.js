document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard — redirect to login if not authenticated
    const user = await LatenlyAuth.requireAuth();
    if (!user) return; // redirect happening

    // Show logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.style.display = 'inline-flex';
        logoutBtn.addEventListener('click', () => LatenlyAuth.signOut());
    }

    // Use user ID as connection identifier
    const userId = user.id;
    const showCode = new URLSearchParams(window.location.search).get('code') === 'true';

    // Configuración desde global window.LatenlyConfig
    const API_BASE = window.LatenlyConfig.API_BASE;
    const POLL_INTERVAL = window.LatenlyConfig.POLL_INTERVAL_MS;
    const MAX_ATTEMPTS = window.LatenlyConfig.POLL_MAX_ATTEMPTS;

    // Estado local
    let currentTab = 'qr'; // 'qr' o 'code'
    let pollAttempts = 0;
    let pollIntervalId = null;
    let countdownIntervalId = null;
    let secondsLeft = 0;
    let qrCount = 0;
    const MAX_QR_COUNT = 6;

    // Elementos del DOM
    const views = {
        loading: document.getElementById('loadingView'),
        error: document.getElementById('errorView'),
        success: document.getElementById('successView'),
        disconnected: document.getElementById('disconnectedView')
    };

    const tabs = {
        qr: document.getElementById('tab-qr'),
        code: document.getElementById('tab-code')
    };

    const tabBtns = document.querySelectorAll('.tab-btn');
    const accordions = document.querySelectorAll('.accordion');

    // Ocultar pestaña de código de texto si no está habilitado
    if (!showCode) {
        const codeTabBtn = document.querySelector('.tab-btn[data-tab="code"]');
        if (codeTabBtn) codeTabBtn.style.display = 'none';

        // Si hay una sola pestaña, podríamos ocultar los tabs por completo
        const methodTabs = document.querySelector('.method-tabs');
        if (methodTabs) methodTabs.style.display = 'none';
    }

    // Elementos de QR
    const qrContainer = document.getElementById('qrContainer');
    const btnGenerateQR = document.getElementById('btnGenerateQR');
    const timerWrapperQR = document.getElementById('timerWrapperQR');
    const timerQR = document.getElementById('timerQR');

    // Elementos de Texto Automático
    const textCodeContainer = document.getElementById('textCodeContainer');
    const btnGenerateCode = document.getElementById('btnGenerateCode');
    const btnCopyCode = document.getElementById('btnCopyCode');
    const timerWrapperCode = document.getElementById('timerWrapperCode');
    const timerCode = document.getElementById('timerCode');
    const phoneInput = document.getElementById('phoneInput');
    const phoneError = document.getElementById('phoneError');

    // Trigger slide-up animations
    setTimeout(() => {
        document.querySelectorAll('.slide-up-anim').forEach((el, i) => {
            setTimeout(() => el.classList.add('visible'), i * 100);
        });
    }, 100);

    // Inicializar vista
    checkStatus();

    // --- LÓGICA DE VISTAS ---
    function showView(viewName) {
        Object.values(views).forEach(v => v.classList.remove('active'));
        if (views[viewName]) {
            views[viewName].classList.add('active');
        }
    }

    // --- POLL STATUS ---
    async function checkStatus() {
        try {
            const response = await fetch(`${API_BASE}/status?session=${encodeURIComponent(userId)}`);
            if (!response.ok) {
                if (response.status === 404) {
                    stopPolling();
                    showView('error');
                    return;
                }
                throw new Error('Network error');
            }

            const data = await response.json();
            const status = data.status || 'disconnected';

            if (status === 'connected') {
                stopPolling();
                showView('success');
            } else if (status === 'not_found') {
                stopPolling();
                showView('error');
            } else {
                // disconnected
                if (!views.disconnected.classList.contains('active')) {
                    showView('disconnected');
                    startPolling();
                    initAuthMethod(currentTab);
                }
            }
        } catch (error) {
            console.error('Error fetching status:', error);
            if (pollAttempts === 0) {
                // Si falla a la primera, lo intentamos otra vez antes de error duro.
            }
        }
    }

    function startPolling() {
        if (pollIntervalId) return;
        pollIntervalId = setInterval(async () => {
            pollAttempts++;
            if (pollAttempts >= MAX_ATTEMPTS) {
                stopPolling();
                showToast('Tiempo de espera agotado. Por favor recarga la página.');
                return;
            }
            await checkStatus();
        }, POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollIntervalId) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
        }
        stopCountdown();
    }

    // --- CARGA DE MÉTODOS (QR / TEXTO) ---
    function initAuthMethod(method) {
        currentTab = method;
        stopCountdown();

        if (method === 'qr') {
            qrCount = 0;
            qrContainer.innerHTML = '';
            qrContainer.appendChild(btnGenerateQR);
            btnGenerateQR.style.display = 'block';
            timerWrapperQR.style.display = 'none';
        } else {
            textCodeContainer.style.display = 'none';
            btnGenerateCode.style.display = 'block';
            btnCopyCode.style.display = 'none';
            timerWrapperCode.style.display = 'none';
            phoneInput.value = '';
            phoneError.style.display = 'none';
        }
    }

    btnGenerateQR.addEventListener('click', () => {
        loadQR();
    });

    btnGenerateCode.addEventListener('click', () => {
        const phoneVal = phoneInput.value.replace(/\D/g, '');
        if (phoneVal.length !== 10) {
            phoneError.style.display = 'block';
            return;
        }
        phoneError.style.display = 'none';
        loadTextCode(phoneVal);
    });

    phoneInput.addEventListener('input', (e) => {
        // Solo permitir números
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
        if (e.target.value.length === 10) {
            phoneError.style.display = 'none';
        }
    });

    async function loadQR() {
        if (qrCount >= MAX_QR_COUNT) {
            qrContainer.innerHTML = '<span style="color:var(--color-danger); text-align:center; padding:1rem; font-size:0.9rem;">Has alcanzado el límite máximo de 6 códigos QR. Por favor, recarga la página.</span>';
            timerWrapperQR.style.display = 'none';
            return;
        }

        qrCount++;
        const duration = (qrCount === 1) ? 60 : 20;

        qrContainer.innerHTML = '<div class="skeleton" style="width: 100%; height: 100%; border-radius: var(--radius-lg);"></div>';
        btnGenerateQR.style.display = 'none';
        timerWrapperQR.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE}/qr?session=${encodeURIComponent(userId)}`);
            if (response.ok) {
                const data = await response.json();
                const qrSrc = data.qr || data.base64 || '';

                if (qrSrc) {
                    qrContainer.innerHTML = `<img src="${qrSrc.startsWith('data:') ? qrSrc : 'data:image/png;base64,' + qrSrc}" class="qr-image" alt="QR Code">`;
                } else {
                    qrContainer.innerHTML = '<span style="color:var(--text-tertiary)">[QR Placeholder]</span>';
                }

                startCountdown(duration, 'qr', () => {
                    loadQR(); // Autorefresh
                });
            } else {
                qrContainer.innerHTML = '<span style="color:var(--color-danger); text-align:center; padding:1rem;">Error cargando QR</span>';
            }
        } catch (e) {
            qrContainer.innerHTML = '<span style="color:var(--color-danger); text-align:center; padding:1rem;">Error de red</span>';
        }
    }

    async function loadTextCode(phone) {
        textCodeContainer.style.display = 'flex';
        textCodeContainer.innerHTML = '<span class="text-secondary" style="font-size: 1rem; letter-spacing: normal;">Cargando...</span>';
        btnGenerateCode.style.display = 'none';
        btnCopyCode.style.display = 'none';
        timerWrapperCode.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE}/code?session=${encodeURIComponent(userId)}&phone=${encodeURIComponent(phone)}`);
            if (response.ok) {
                const data = await response.json();
                const code = data.code || 'XXXX-XXXX';
                textCodeContainer.innerHTML = `<span>${code}</span>`;
                textCodeContainer.dataset.code = code;

                btnCopyCode.style.display = 'block';
                startCountdown(180, 'code', () => {
                    showToast('El código ha expirado, genera uno nuevo.');
                    initAuthMethod('code');
                });
            } else {
                textCodeContainer.innerHTML = '<span style="color:var(--color-danger); font-size:1rem; letter-spacing:normal;">Error al generar código</span>';
                btnGenerateCode.style.display = 'block';
            }
        } catch (e) {
            textCodeContainer.innerHTML = '<span style="color:var(--color-danger); font-size:1rem; letter-spacing:normal;">Error de red</span>';
            btnGenerateCode.style.display = 'block';
        }
    }

    // --- TIMERS ---
    function startCountdown(duration, type, onExpire) {
        stopCountdown();
        secondsLeft = duration;

        if (type === 'qr') {
            timerWrapperQR.style.display = 'block';
            timerWrapperCode.style.display = 'none';
        } else {
            timerWrapperCode.style.display = 'block';
            timerWrapperQR.style.display = 'none';
        }

        updateTimerUI(type);

        countdownIntervalId = setInterval(() => {
            secondsLeft--;
            updateTimerUI(type);
            if (secondsLeft <= 0) {
                stopCountdown();
                if (onExpire) onExpire();
            }
        }, 1000);
    }

    function stopCountdown() {
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
    }

    function updateTimerUI(type) {
        const m = Math.floor(secondsLeft / 60);
        const s = (secondsLeft % 60).toString().padStart(2, '0');
        const text = `${m}:${s}`;

        if (type === 'qr') {
            timerQR.innerText = text;
        } else {
            timerCode.innerText = text;
        }
    }

    // --- UI INTERACTIONS ---

    // TABS
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Update Buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update Content
            Object.values(tabs).forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${tabName}`).classList.add('active');

            initAuthMethod(tabName);
        });
    });

    // COPY BUTTON
    btnCopyCode.addEventListener('click', () => {
        const code = textCodeContainer.dataset.code;
        if (code) {
            navigator.clipboard.writeText(code).then(() => {
                showToast('Código copiado al portapapeles');
            }).catch(() => {
                showToast('Error al copiar el código');
            });
        }
    });

    // ACCORDION
    accordions.forEach(acc => {
        const header = acc.querySelector('.accordion-header');
        header.addEventListener('click', () => {
            acc.classList.toggle('expanded');
        });
    });

    // --- TOAST NOTIFICATIONS ---
    function showToast(message) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3000);
    }
});
