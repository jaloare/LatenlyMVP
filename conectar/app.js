document.addEventListener('DOMContentLoaded', async () => {
    // 1) Auth Guard: Solo usuarios autenticados
    const user = await LatenlyAuth.requireAuth();
    if (!user) return;

    const EDGE = window.LatenlyConfig.API_BASE;
    const POLL_INTERVAL = window.LatenlyConfig.POLL_INTERVAL_MS;
    const MAX_ATTEMPTS = window.LatenlyConfig.POLL_MAX_ATTEMPTS;

    // Helper: Fetch con Bearer Token
    async function edgeFetch(path, options = {}) {
        const session = await LatenlyAuth.getSession();
        if (!session) return null;
        const { headers = {}, ...rest } = options;
        return fetch(`${EDGE}${path}`, {
            ...rest,
            headers: {
                "Authorization": `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
                ...headers,
            },
        });
    }

    // Estado y Vistas
    let pollIntervalId = null;
    let pollAttempts = 0;
    let countdownId = null;
    let secondsLeft = 0;

    const views = {
        loading: document.getElementById('loadingView'),
        error: document.getElementById('errorView'),
        form: document.getElementById('formView'),
        connect: document.getElementById('connectView'),
        success: document.getElementById('successView'),
    };

    const headerTexts = {
        form: { title: "Configura tu Perfil", desc: "Cuéntanos cómo usas WhatsApp para personalizar tu reporte.", step: "PASO 1 DE 2" },
        connect: { title: "Conectar WhatsApp", desc: "Vincula tu cuenta para iniciar el análisis automático.", step: "PASO 2 DE 2" },
        loading: { title: "Cargando...", desc: "Por favor espera.", step: "" },
        success: { title: "¡Conectado!", desc: "WhatsApp vinculado exitosamente.", step: "PASO 3 DE 3" }
    };

    function showView(name) {
        Object.values(views).forEach(v => { if (v) v.classList.remove('active'); });
        if (views[name]) views[name].classList.add('active');

        // Actualizar Header dinámicamente
        const text = headerTexts[name];
        if (text) {
            const titleEl = document.getElementById('pageTitle');
            const descEl = document.getElementById('pageDesc');
            const badgeEl = document.getElementById('stepBadge');
            
            if (titleEl) titleEl.innerHTML = text.title.includes('WhatsApp') 
                ? text.title.replace('WhatsApp', '<span class="gradient-text">WhatsApp</span>') 
                : text.title;
            if (descEl) descEl.textContent = text.desc;
            if (badgeEl) {
                badgeEl.textContent = text.step;
                badgeEl.style.display = text.step ? 'inline-flex' : 'none';
            }
        }
    }

    // Animaciones de entrada
    setTimeout(() => {
        document.querySelectorAll('.slide-up-anim').forEach((el, i) => {
            setTimeout(() => el.classList.add('visible'), i * 100);
        });
    }, 100);

    // ── 2) Verificar existencia de perfil ─────────────────────────────────────
    async function bootstrap() {
        showView('loading');
        try {
            const { data, error } = await LatenlyAuth.client
                .from('whatsapp_analysis_profiles')
                .select('created_at')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                // Perfil existe → Ir a QR (Paso 4)
                renderFormSubmittedInfo(data.created_at);
                initConnectView();
            } else {
                // No existe o es null → Mostrar formulario (Paso 2)
                console.log("No profile found, initializing form...");
                initProfileForm();
            }
        } catch (e) {
            console.error('[bootstrap]', e);
            showView('error');
        }
    }

    // ── 3) Lógica de Formulario (Solo guarda al final) ──────────────────────────
    function initProfileForm() {
        showView('form');
        const form = document.getElementById('profileForm');
        const sections = form.querySelectorAll('.form-section');
        const btnNext = document.getElementById('btnNext');
        const btnPrev = document.getElementById('btnPrev');
        const btnSubmit = document.getElementById('btnSubmit');
        let currentStep = 1;

        const updateStepper = () => {
            sections.forEach((s, i) => s.classList.toggle('active', (i + 1) === currentStep));
            btnPrev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
            btnNext.style.display = currentStep === sections.length ? 'none' : 'inline-flex';
            btnSubmit.style.display = currentStep === sections.length ? 'inline-flex' : 'none';
        };

        const validateSection = (step) => {
            const section = form.querySelector(`.form-section[data-section="${step}"]`);
            const inputs = [...section.querySelectorAll('input, textarea')];
            
            // Validación nativa (radio, text, email)
            const nativeValid = inputs.every(i => i.reportValidity());
            if (!nativeValid) return false;

            // Validación personalizada para Checkbox Groups con atributo 'required'
            const checkboxGrids = section.querySelectorAll('.checkbox-grid[required]');
            for (const grid of checkboxGrids) {
                const checked = grid.querySelectorAll('input[type="checkbox"]:checked');
                if (checked.length === 0) {
                    alert("Por favor selecciona al menos una opción.");
                    grid.style.border = "1px solid var(--color-danger)";
                    grid.style.borderRadius = "var(--radius-lg)";
                    grid.style.padding = "0.5rem";
                    return false;
                }
                grid.style.border = "none";
            }
            return true;
        };

        btnNext.onclick = () => {
            if (validateSection(currentStep)) { 
                currentStep++; 
                updateStepper(); 
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        btnPrev.onclick = () => { if (currentStep > 1) { currentStep--; updateStepper(); } };

        updateStepper(); // Asegura que el paso 1 se muestre al inicio

        form.onsubmit = async (e) => {
            e.preventDefault();
            if (!validateSection(currentStep)) return;
            
            showView('loading');

            const formData = new FormData(form);
            const profile = { user_id: user.id, raw_form_data: {} };
            
            // Campos de tipo Array en DB
            const arrays = ['responders', 'whatsapp_usage', 'contact_naming_patterns', 'report_goals'];
            arrays.forEach(k => profile[k] = []);

            formData.forEach((val, key) => {
                profile.raw_form_data[key] = val;
                if (arrays.includes(key)) profile[key].push(val);
                else profile[key] = val;
            });

            const { error } = await LatenlyAuth.client
                .from('whatsapp_analysis_profiles')
                .upsert([profile], { onConflict: 'user_id' });

            if (error) { 
                console.error("Save error:", error);
                showView('form'); 
                alert("Error al guardar perfil."); 
                return; 
            }

            // 4) Guardado exitoso → Mostrar Nota y Sección QR
            renderFormSubmittedInfo(new Date().toISOString());
            initConnectView();
        };
    }

    // ── 4 & 5) Sección de QR y Nota ───────────────────────────────────────────
    async function initConnectView() {
        showView('connect');
        // Inicializar sesión en backend (WAHA)
        await edgeFetch('/sessions', { method: 'POST' });
        
        const btnGen = document.getElementById('btnGenerateQR');
        const qrBox = document.getElementById('qrContainer');
        const timerUI = document.getElementById('timerQR');
        const timerWrap = document.getElementById('timerWrapperQR');

        btnGen.onclick = async () => {
            btnGen.disabled = true;
            qrBox.innerHTML = '<div class="spinner"></div>';
            
            try {
                const res = await edgeFetch('/auth/qr');
                const data = await res.json();
                const qr = data.qr || data.data || data.base64;

                if (qr) {
                    qrBox.innerHTML = `<img src="${qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}" class="qr-image">`;
                    timerWrap.style.display = 'block';
                    
                    // 5) Polling empieza SOLO cuando el QR se muestra
                    startPolling();
                    startCountdown(60, timerUI, () => {
                        btnGen.disabled = false;
                        btnGen.textContent = "Regenerar QR";
                        stopPolling();
                    });
                } else {
                    throw new Error("No QR data");
                }
            } catch (e) {
                console.error("QR Load Error:", e);
                qrBox.innerHTML = 'Error al cargar QR';
                btnGen.disabled = false;
            }
        };
    }

    // ── 6) Polling y Redirección Success ──────────────────────────────────────
    function startPolling() {
        if (pollIntervalId) return;
        pollAttempts = 0;
        pollIntervalId = setInterval(async () => {
            pollAttempts++;
            if (pollAttempts > MAX_ATTEMPTS) return stopPolling();

            try {
                const res = await edgeFetch('/sessions');
                if (!res || !res.ok) return;
                
                const { status } = await res.json();
                if (status === 'WORKING') {
                    stopPolling();
                    showView('success');
                }
            } catch (e) {
                console.error("Polling Error:", e);
            }
        }, POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null; }
    }

    // Utils
    function renderFormSubmittedInfo(dateStr) {
        const el = document.getElementById('formSubmittedDate');
        if (el) el.textContent = new Date(dateStr).toLocaleString('es-MX', { 
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
    }

    function startCountdown(secs, el, onEnd) {
        if (countdownId) clearInterval(countdownId);
        secondsLeft = secs;
        const update = () => {
            const m = Math.floor(secondsLeft / 60), s = (secondsLeft % 60).toString().padStart(2, '0');
            el.innerText = `${m}:${s}`;
            if (secondsLeft-- <= 0) { 
                clearInterval(countdownId); 
                countdownId = null;
                onEnd(); 
            }
        };
        update();
        countdownId = setInterval(update, 1000);
    }

    bootstrap();
});