document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard — require login (except for test/demo mode)
    const urlParams = new URLSearchParams(window.location.search);
    const isTest = urlParams.has('test');

    let user = null;

    // Allow test mode without auth
    if (!isTest) {
        user = await LatenlyAuth.requireAuth();
        if (!user) return; // redirect happening

        // Show logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'inline-flex';
            logoutBtn.addEventListener('click', () => LatenlyAuth.signOut());
        }
    }

    const views = {
        loading: document.getElementById('loadingView'),
        error: document.getElementById('errorView'),
        content: document.getElementById('reportContent')
    };

    function showView(viewName) {
        Object.values(views).forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });

        if (views[viewName]) {
            views[viewName].classList.remove('hidden');
            views[viewName].classList.add('active');
        }
    }

    async function loadReport() {
        showView('loading');

        try {
            let data;

            if (isTest) {
                // Mode 1: Test — Load dummy data
                await new Promise(r => setTimeout(r, 1200));
                data = getDummyData();
            } else {
                // Mode 2: Authenticated — API call using user.id
                const API_URL = `http://api.latenly.com/report?token=${encodeURIComponent(user.id)}`;
                console.log("Fetching report for user:", user.id);

                const response = await fetch(API_URL);
                if (!response.ok) throw new Error(`API error: ${response.status}`);
                data = await response.json();

                // Manejo de respuesta
                if (Array.isArray(data) && data.length > 0) {
                    data = data[0].report_data || data[0];
                } else if (data.report_data) {
                    data = data.report_data;
                }
            }

            renderReport(data);
            showView('content');

            // Trigger animations
            setTimeout(() => {
                document.querySelectorAll('.slide-up-anim').forEach((el, index) => {
                    setTimeout(() => {
                        el.classList.add('visible');
                    }, index * 100);
                });
            }, 100);

        } catch (error) {
            console.error("Error fetching report data:", error);
            showView('error');
        }
    }

    function renderReport(data) {
        // Gender helper
        const esMujer = data.portada?.es_mujer || false;
        const g = (m, f) => esMujer ? f : m; // g("Listo","Lista")

        // Apply gendered text to static elements
        const genderedTexts = {
            'ctaTitle': g('¿Listo para dejar de perder dinero?', '¿Lista para dejar de perder dinero?'),
        };
        const ctaTitle = document.querySelector('.section-cta .display-title');
        if (ctaTitle) ctaTitle.innerText = genderedTexts.ctaTitle;

        // 1. Portada
        if (data.portada) {
            document.getElementById('clinicName').innerText = data.portada.clinica || '[Nombre de la Clínica]';
            document.getElementById('reportDate').innerText = data.portada.fecha || new Date().toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' });
            document.getElementById('doctorName').innerText = data.portada.doctor || 'Dr.';
        }

        // 2. Resumen
        if (data.resumen) {
            document.getElementById('statHot').innerText = data.resumen.listos_agendar || 0;
            document.getElementById('statWarm').innerText = data.resumen.potencial_conversaciones || 0;
            document.getElementById('statCold').innerText = data.resumen.contactos_reactivables || 0;

            document.getElementById('oppCitas').innerText = `${data.resumen.citas_inmediatas_min}-${data.resumen.citas_inmediatas_max}`;

            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            document.getElementById('oppValor').innerText = `${formatter.format(data.resumen.valor_estimado_min)} – ${formatter.format(data.resumen.valor_estimado_max)} MXN`;
        }

        // 2.5 Auditoría
        if (data.auditoria) {
            document.getElementById('auditTotal').innerText = data.auditoria.total_chats || 0;
            document.getElementById('auditGroups').innerText = data.auditoria.grupos || 0;
            document.getElementById('auditForeign').innerText = data.auditoria.extranjeros || 0;
            document.getElementById('auditOld').innerText = data.auditoria.antiguos || 0;
            document.getElementById('auditNoise').innerText = data.auditoria.ruido || 0;
        }

        // 2.6 Servicios Counts
        if (data.servicios) {
            document.getElementById('countCore').innerText = `${data.servicios['CORE'] || 0} interesados`;
            document.getElementById('countEstetico').innerText = `${data.servicios['ESTÉTICOS'] || 0} interesados`;
            document.getElementById('countPreventivo').innerText = `${data.servicios['PREVENTIVOS'] || 0} interesados`;
            document.getElementById('countPost').innerText = `${data.servicios['POST-TRATAMIENTO'] || data.servicios['POST_TRATAMIENTO'] || 0} interesados`;
        }

        // 3. Hallazgos
        if (data.hallazgos && data.hallazgos.length > 0) {
            const insightsList = document.getElementById('insightsList');
            insightsList.innerHTML = '';
            data.hallazgos.forEach(h => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="check-icon">✓</span> <span>${h}</span>`;
                insightsList.appendChild(li);
            });
        }

        // 6. Mensajes — ahora con ID y nombre del destinatario
        if (data.mensajes && data.mensajes.length > 0) {
            const grid = document.getElementById('messagesGrid');
            grid.innerHTML = '';
            data.mensajes.forEach(m => {
                const msgId = m.id || '';
                const card = document.createElement('div');
                card.className = 'message-card';
                card.id = `msg-${msgId}`;
                card.innerHTML = `
                    <div class="msg-header">
                        <span class="msg-badge">#${msgId} — ${m.tipo}</span>
                        <span class="msg-for">Para: <strong>${m.para || ''}</strong></span>
                        <button class="btn-copy" data-msg="${m.texto.replace(/"/g, '&quot;')}">Copiar</button>
                    </div>
                    <div class="msg-body">"${m.texto}"</div>
                `;
                grid.appendChild(card);
            });

            // Add copy events
            document.querySelectorAll('.btn-copy').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const text = e.target.getAttribute('data-msg');
                    navigator.clipboard.writeText(text);
                    e.target.innerText = '¡Copiado!';
                    setTimeout(() => e.target.innerText = 'Copiar', 2000);
                });
            });
        }

        // 7. Contactos — vinculados a mensajes
        if (data.contactos_prioritarios && data.contactos_prioritarios.length > 0) {
            const tbody = document.getElementById('contactsTableBody');
            tbody.innerHTML = '';
            data.contactos_prioritarios.forEach(c => {
                const tr = document.createElement('tr');
                const pClass = c.prioridad.toLowerCase() === 'alta' ? 'priority-high' : 'priority-med';

                // Build action cell — link to message if available
                let accionHTML;
                if (c.mensaje_id) {
                    accionHTML = `<a href="#msg-${c.mensaje_id}" class="msg-link" title="${c.accion}">📩 Enviar Mensaje #${c.mensaje_id}</a>`;
                } else {
                    accionHTML = c.accion;
                }

                tr.innerHTML = `
                    <td><strong>${c.nombre}</strong></td>
                    <td>${c.tipo}</td>
                    <td><span class="badge ${pClass}">${c.prioridad}</span></td>
                    <td>${accionHTML}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // 8. Proyección
        if (data.proyeccion) {
            document.getElementById('projResp').innerText = `${data.proyeccion.respuesta_min_pct}%–${data.proyeccion.respuesta_max_pct}%`;
            document.getElementById('projCitas').innerText = `${data.proyeccion.citas_min}–${data.proyeccion.citas_max}`;
            document.getElementById('projRoi').innerText = `${data.proyeccion.roi_min}x–${data.proyeccion.roi_max}x`;
        }

        // Bridge: Conectar tabla de contactos con el dinero del resumen
        if (data.resumen) {
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            const halfMin = Math.round(data.resumen.valor_estimado_min / 2);
            const halfMax = Math.round(data.resumen.valor_estimado_max / 2);
            const bridgeEl = document.getElementById('bridgeValor');
            if (bridgeEl) {
                bridgeEl.innerText = `${formatter.format(halfMin)} – ${formatter.format(halfMax)} MXN`;
            }
        }
    }

    // Share report via WhatsApp or copy link
    window.shareReport = function () {
        const shareUrl = window.location.href;
        const shareText = `Mira este análisis de oportunidades de WhatsApp para clínicas dentales. Descubrieron dinero escondido en la bandeja de entrada 🤯\n${shareUrl}`;

        // Try WhatsApp first (most likely for dentists)
        const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(waUrl, '_blank');
    };

    function getDummyData() {
        return {
            "portada": {
                "clinica": "Clínica Dental Sonrisas",
                "fecha": new Date().toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' }),
                "doctor": "Dra. Laura Martínez",
                "es_mujer": true
            },
            "auditoria": {
                "total_chats": 850,
                "grupos": 92,
                "extranjeros": 45,
                "antiguos": 112,
                "negocios": 34,
                "ruido": 210
            },
            "resumen": {
                "listos_agendar": 14,
                "potencial_conversaciones": 37,
                "contactos_reactivables": 82,
                "citas_inmediatas_min": 5,
                "citas_inmediatas_max": 10,
                "valor_estimado_min": 25000,
                "valor_estimado_max": 80000
            },
            "servicios": {
                "CORE": 12,
                "ESTÉTICOS": 8,
                "PREVENTIVOS": 15,
                "POST-TRATAMIENTO": 5
            },
            "hallazgos": [
                "Muchos pacientes preguntan por precio pero no reciben seguimiento.",
                "Hay interés alto en brackets pero se enfría la conversación.",
                "No hay reactivación de contactos antiguos (más de 6 meses).",
                "Pacientes actuales no están siendo monetizados con servicios estéticos (upsells)."
            ],
            "segmentacion": {
                "calientes": 14,
                "tibios": 37,
                "dormidos": 82,
                "actuales": 15
            },
            "mensajes": [
                {
                    "id": 1,
                    "para": "Juan García",
                    "tipo": "Follow-up caliente",
                    "texto": "Hola Juan 👋 hace poco preguntaste por brackets, ¿te gustaría agendar una valoración esta semana? Tenemos horarios disponibles."
                },
                {
                    "id": 2,
                    "para": "María López",
                    "tipo": "Reactivación",
                    "texto": "Hola María 👋 hace tiempo preguntaste por tratamiento de ortodoncia, si aún te interesa con gusto te ayudo a agendar una valoración."
                },
                {
                    "id": 3,
                    "para": "Carlos Ruiz",
                    "tipo": "Seguimiento precio",
                    "texto": "Hola Carlos 👋 vi que preguntaste por el precio de brackets. Tenemos opciones con mensualidades desde $800 MXN, ¿te gustaría que te explique?"
                },
                {
                    "id": 4,
                    "para": "Ana Torres",
                    "tipo": "Upsell Estético",
                    "texto": "Hola Ana 👋 noté que terminaste tu tratamiento, ¡felicidades! ¿Te gustaría complementar tu nueva sonrisa con un blanqueamiento? Tenemos una promoción especial."
                }
            ],
            "contactos_prioritarios": [
                { "nombre": "Juan García", "tipo": "Lead Caliente", "prioridad": "Alta", "accion": "Cierre Urgente", "mensaje_id": 1 },
                { "nombre": "María López", "tipo": "Reactivación", "prioridad": "Media", "accion": "Reactivación", "mensaje_id": 2 },
                { "nombre": "Carlos Ruiz", "tipo": "Lead Tibio", "prioridad": "Media", "accion": "Seguimiento Precio", "mensaje_id": 3 },
                { "nombre": "Ana Torres", "tipo": "Paciente Actual", "prioridad": "Alta", "accion": "Upsell", "mensaje_id": 4 },
                { "nombre": "Pedro Sánchez", "tipo": "Lead Dormido", "prioridad": "Baja", "accion": "Reactivación Masiva", "mensaje_id": null }
            ],
            "proyeccion": {
                "respuesta_min_pct": 15,
                "respuesta_max_pct": 35,
                "citas_min": 5,
                "citas_max": 12,
                "roi_min": 125,
                "roi_max": 400
            }
        };
    }

    loadReport();
});
