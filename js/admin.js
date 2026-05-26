// ──────────────────────────────────────────────────────────────────────────
// ACM Logística · Panel Administrativo
// Requiere: db.js cargado antes que este archivo.
//
// Cuentas iniciales (se crean al primer arranque y se hashean automáticamente):
//   Dueño      → dueno@serviciosbop.cl      / Dueno2025*
//   Encargado1 → encargado1@serviciosbop.cl / Encarg2025*
//   Encargado2 → encargado2@serviciosbop.cl / Encarg2025*
// ──────────────────────────────────────────────────────────────────────────

const DOMINIO            = '@serviciosbop.cl';
const EMAILJS_PUBLIC_KEY = 'TU_EMAILJS_PUBLIC_KEY';
const EMAILJS_SERVICE_ID = 'TU_EMAILJS_SERVICE_ID';
const EMAILJS_TMPL_ADMIN = 'TU_EMAILJS_TEMPLATE_ID';

if (window.emailjs && !EMAILJS_PUBLIC_KEY.startsWith('TU_')) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

// ═══════════════════════════════════════════════════════════════════════════
//  CAPA DE ADMINS (sobre db.js)
// ═══════════════════════════════════════════════════════════════════════════

function getAdminsDB()      { return getAdmins(); }
function saveAdminsDB(arr)  { saveAdmins(arr); }

async function initAdminsDB() {
    if (getAdminsDB().length > 0) {
        await migrateAdminPasswords();
        return;
    }
    // Crear cuentas iniciales con hash desde el primer arranque
    const defaults = [
        { nombre: 'Dueño',       email: 'dueno@serviciosbop.cl',      plainPassword: 'Dueno2025*',  rol: 'dueño'     },
        { nombre: 'Encargado 1', email: 'encargado1@serviciosbop.cl', plainPassword: 'Encarg2025*', rol: 'encargado' },
        { nombre: 'Encargado 2', email: 'encargado2@serviciosbop.cl', plainPassword: 'Encarg2025*', rol: 'encargado' },
        { nombre: 'Birth',       email: 'birth@serviciosbop.cl',      plainPassword: 'Birth2025',   rol: 'dueño'     },
    ];
    const hashed = await Promise.all(defaults.map(async d => ({
        nombre:        d.nombre,
        email:         d.email,
        passwordHash:  await hashPassword(d.plainPassword),
        rol:           d.rol,
        fechaCreacion: new Date().toISOString(),
    })));
    saveAdminsDB(hashed);
}

// Migra contraseñas antiguas en texto plano → hash
async function migrateAdminPasswords() {
    const db = getAdminsDB();
    let changed = false;
    for (const admin of db) {
        if (admin.password && !isHashed(admin.password)) {
            admin.passwordHash = await hashPassword(admin.password);
            delete admin.password;
            changed = true;
        }
    }
    if (changed) saveAdminsDB(db);
}

// Email de bienvenida para conductores
function enviarEmailBienvenida(conductor, tipoRegistro) {
    if (!window.emailjs || EMAILJS_PUBLIC_KEY.startsWith('TU_')) return;
    const nombre = [conductor.nombre, conductor.apellido].filter(Boolean).join(' ');
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TMPL_ADMIN, {
        to_name: conductor.nombre || nombre, to_email: conductor.email,
        nombre_completo: nombre, rut: conductor.rut || '—',
        tipo_registro: tipoRegistro,
        login_url: window.location.origin + '/conductores/login.html',
    }).catch(() => {});
}

// ── Sesión de admin ───────────────────────────────────────────────────────

function setAdminSession(admin) {
    sessionStorage.setItem('acm_admin', JSON.stringify({
        email:  admin.email,
        nombre: admin.nombre,
        rol:    admin.rol,
    }));
}
function getAdminSession() {
    try { return JSON.parse(sessionStorage.getItem('acm_admin') || 'null'); }
    catch { return null; }
}
function esDueno()    { return getAdminSession()?.rol === 'dueño'; }
function adminLogout() { sessionStorage.removeItem('acm_admin'); window.location.href = './login.html'; }

// ═══════════════════════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════════════════════

async function setupLogin() {
    await initAdminsDB();

    const loginForm = document.getElementById('adminLoginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email    = (document.getElementById('admin-inp-email')?.value || '').trim().toLowerCase();
        const password = (document.getElementById('admin-inp-pass')?.value  || '');

        const showErr = msg => {
            let el = document.getElementById('msg-admin-login');
            if (!el) {
                el = document.createElement('p');
                el.id = 'msg-admin-login';
                el.className = 'text-sm text-center mt-3 font-medium text-red-600';
                loginForm.after(el);
            }
            el.textContent = msg;
        };

        // Validar dominio
        if (!email.endsWith(DOMINIO)) {
            showErr('Solo se permiten correos ' + DOMINIO);
            return;
        }

        // Rate limiting por email
        const rateId = 'admin_' + email;
        const rate = checkRateLimit(rateId);
        if (rate.blocked) {
            showErr(`Demasiados intentos. Espera ${rate.remaining}s.`);
            return;
        }

        const hashedInput = await hashPassword(password);
        const admin = getAdminsDB().find(a =>
            a.email === email && (a.passwordHash === hashedInput)
        );

        if (!admin) {
            recordAttempt(rateId);
            showErr('Correo o contraseña incorrectos.');
            return;
        }

        clearAttempts(rateId);
        setAdminSession(admin);
        window.location.href = './dashboard.html';
    });
}

setupLogin();

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

if (window.location.pathname.includes('dashboard.html')) {

    const sesion = getAdminSession();
    if (!sesion) { window.location.href = './login.html'; }

    // ── Header de usuario ─────────────────────────────────────────────────
    document.getElementById('admin-chip')?.classList.remove('hidden');
    const elNombre = document.getElementById('admin-nombre-label');
    const elRol    = document.getElementById('admin-rol-label');
    const elAvatar = document.getElementById('admin-avatar');
    if (elNombre) elNombre.textContent = escapeHtml(sesion?.nombre || '—');
    if (elRol)    elRol.textContent    = sesion?.rol === 'dueño' ? 'Dueño · Acceso total' : 'Encargado';
    if (elAvatar) elAvatar.textContent = (sesion?.nombre || '?')[0].toUpperCase();

    if (esDueno()) {
        document.getElementById('tab-btn-admins')?.classList.remove('hidden');
        const btnPass = document.getElementById('btn-mi-pass');
        if (btnPass) { btnPass.classList.remove('hidden'); btnPass.classList.add('sm:flex'); }
    }

    let _rutParaEliminar = null;
    let _emailAdminReset = null;
    let _chartSemana     = null;
    let _chartTipo       = null;

    // ── Tabs ──────────────────────────────────────────────────────────────
    const TABS = ['conductores', 'formularios', 'admins'];
    window.switchTab = function(tab) {
        TABS.forEach(t => {
            document.getElementById('panel-' + t)?.classList.toggle('hidden', t !== tab);
            const btn = document.getElementById('tab-btn-' + t);
            if (btn) {
                btn.classList.toggle('active', t === tab);
                btn.classList.toggle('text-gray-500', t !== tab);
            }
        });
        if (tab === 'admins') renderAdmins();
    };

    // ── Stats ─────────────────────────────────────────────────────────────
    function cargarStats() {
        const conductores = getConductores();
        const formularios = getFormularios();
        const hoy         = new Date().toISOString().slice(0, 10);
        const hoyForms    = formularios.filter(f => f.fecha === hoy);
        const puntajes    = formularios.map(f => parseInt(f.puntaje)).filter(n => !isNaN(n));
        const promedio    = puntajes.length
            ? Math.round(puntajes.reduce((a, b) => a + b, 0) / puntajes.length) + '%'
            : '—';

        document.getElementById('stat-conductores').textContent = conductores.length;
        document.getElementById('stat-formularios').textContent = formularios.length;
        document.getElementById('stat-hoy').textContent         = hoyForms.length;
        document.getElementById('stat-puntaje').textContent     = promedio;
        document.getElementById('stat-salidas').textContent     = hoyForms.filter(f => f.tipoControl === 'SALIDA').length;
        document.getElementById('stat-ingresos').textContent    = hoyForms.filter(f => f.tipoControl === 'INGRESO').length;
    }

    // ── Gráficos ──────────────────────────────────────────────────────────
    function renderCharts() {
        const formularios = getFormularios();
        const dias = [], labels = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            dias.push(d.toISOString().slice(0, 10));
            labels.push(d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }));
        }
        const counts = dias.map(d => formularios.filter(f => f.fecha === d).length);

        const ctx1 = document.getElementById('chart-semana')?.getContext('2d');
        if (ctx1) {
            if (_chartSemana) _chartSemana.destroy();
            _chartSemana = new Chart(ctx1, {
                type: 'bar',
                data: { labels, datasets: [{ label: 'Formularios', data: counts,
                    backgroundColor: 'rgba(40,169,146,0.15)', borderColor: '#28A992',
                    borderWidth: 2, borderRadius: 6, hoverBackgroundColor: 'rgba(40,169,146,0.3)' }] },
                options: { responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
                        x: { ticks: { font: { size: 11 } }, grid: { display: false } },
                    },
                },
            });
        }

        const totalSalidas  = formularios.filter(f => f.tipoControl === 'SALIDA').length;
        const totalIngresos = formularios.filter(f => f.tipoControl === 'INGRESO').length;
        const ctx2 = document.getElementById('chart-tipo')?.getContext('2d');
        if (ctx2) {
            if (_chartTipo) _chartTipo.destroy();
            _chartTipo = new Chart(ctx2, {
                type: 'doughnut',
                data: { labels: ['Salida', 'Ingreso'], datasets: [{
                    data: [totalSalidas || 1, totalIngresos || 1],
                    backgroundColor: ['#28A992', '#3b82f6'], borderWidth: 0, hoverOffset: 6,
                }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: { legend: { display: false },
                        tooltip: { callbacks: { label: ctx => {
                            const total = totalSalidas + totalIngresos;
                            return ` ${ctx.label}: ${ctx.raw} (${total ? Math.round(ctx.raw / total * 100) : 0}%)`;
                        }}},
                    },
                },
            });
        }
    }

    // ── Render: Administradores ───────────────────────────────────────────
    function renderAdmins() {
        const admins = getAdminsDB();
        const tbody  = document.getElementById('tbody-admins');
        if (!tbody) return;

        tbody.innerHTML = admins.map(a => {
            const esMio    = a.email === sesion.email;
            const esDuenoA = a.rol === 'dueño';
            const fecha    = a.fechaCreacion ? new Date(a.fechaCreacion).toLocaleDateString('es-CL') : '—';
            const rolBadge = esDuenoA
                ? '<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:#fef3c7;color:#92400e;">Dueño</span>'
                : '<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:#e0f2fe;color:#0369a1;">Encargado</span>';
            const yoBadge = esMio ? '<span class="ml-1 text-xs text-gray-400">(Tú)</span>' : '';
            const emailSafe  = escapeHtml(a.email);
            const nombreSafe = escapeHtml(a.nombre);
            return `
            <tr>
                <td class="px-5 py-3 font-medium text-gray-800">${nombreSafe}${yoBadge}</td>
                <td class="px-5 py-3 text-gray-500 text-xs">${emailSafe}</td>
                <td class="px-5 py-3 text-center">${rolBadge}</td>
                <td class="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">${escapeHtml(fecha)}</td>
                <td class="px-5 py-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        ${!esMio ? `
                        <button onclick="abrirModalResetPass(${JSON.stringify(a.email)},${JSON.stringify(a.nombre)})"
                                title="Resetear contraseña"
                                class="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                            <span class="material-symbols-outlined" style="font-size:17px;">lock_reset</span>
                        </button>` : ''}
                        ${!esDuenoA ? `
                        <button onclick="eliminarAdmin(${JSON.stringify(a.email)},${JSON.stringify(a.nombre)})"
                                title="Eliminar administrador"
                                class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <span class="material-symbols-outlined" style="font-size:17px;">delete</span>
                        </button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // ── Agregar administrador ─────────────────────────────────────────────
    window.abrirModalAgregarAdmin = function() {
        ['na-nombre', 'na-email', 'na-pass'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        document.getElementById('msg-agregar-admin')?.classList.add('hidden');
        document.getElementById('modal-agregar-admin').classList.remove('hidden');
        document.getElementById('na-nombre')?.focus();
    };
    window.cerrarModalAgregarAdmin = function() {
        document.getElementById('modal-agregar-admin').classList.add('hidden');
    };
    window.guardarNuevoAdmin = async function() {
        const nombre   = (document.getElementById('na-nombre')?.value || '').trim();
        const email    = (document.getElementById('na-email')?.value  || '').trim().toLowerCase();
        const password = (document.getElementById('na-pass')?.value   || '').trim();

        const showErr = m => {
            const el = document.getElementById('msg-agregar-admin');
            if (el) { el.textContent = m; el.className = 'text-xs text-center mt-3 font-medium text-red-600'; el.classList.remove('hidden'); }
        };

        if (!nombre || !email || !password)               { showErr('Completa todos los campos.'); return; }
        if (!email.endsWith(DOMINIO))                     { showErr('El correo debe ser ' + DOMINIO); return; }
        if (password.length < 8)                          { showErr('La contraseña debe tener al menos 8 caracteres.'); return; }
        if (getAdminsDB().find(a => a.email === email))   { showErr('Este correo ya tiene acceso.'); return; }

        const passwordHash = await hashPassword(password);
        const db = getAdminsDB();
        db.push({ nombre, email, passwordHash, rol: 'encargado', fechaCreacion: new Date().toISOString() });
        saveAdminsDB(db);
        cerrarModalAgregarAdmin();
        renderAdmins();
    };

    // ── Eliminar administrador ────────────────────────────────────────────
    window.eliminarAdmin = function(email, nombre) {
        if (!confirm(`¿Eliminar el acceso de ${nombre}? Esta acción no se puede deshacer.`)) return;
        saveAdminsDB(getAdminsDB().filter(a => a.email !== email));
        renderAdmins();
    };

    // ── Resetear contraseña de otro admin ─────────────────────────────────
    window.abrirModalResetPass = function(email, nombre) {
        _emailAdminReset = email;
        document.getElementById('reset-admin-nombre').textContent = escapeHtml(nombre);
        document.getElementById('rp-nueva').value = '';
        document.getElementById('msg-reset-pass')?.classList.add('hidden');
        document.getElementById('modal-reset-pass').classList.remove('hidden');
        document.getElementById('rp-nueva')?.focus();
    };
    window.cerrarModalResetPass = function() {
        _emailAdminReset = null;
        document.getElementById('modal-reset-pass').classList.add('hidden');
    };
    window.confirmarResetPass = async function() {
        const nueva   = (document.getElementById('rp-nueva')?.value || '').trim();
        const showErr = m => {
            const el = document.getElementById('msg-reset-pass');
            if (el) { el.textContent = m; el.className = 'text-xs text-center mt-3 font-medium text-red-600'; el.classList.remove('hidden'); }
        };
        if (nueva.length < 8) { showErr('Mínimo 8 caracteres.'); return; }
        const db  = getAdminsDB();
        const idx = db.findIndex(a => a.email === _emailAdminReset);
        if (idx >= 0) {
            db[idx].passwordHash = await hashPassword(nueva);
            delete db[idx].password;
            saveAdminsDB(db);
        }
        cerrarModalResetPass();
        renderAdmins();
    };

    // ── Cambiar mi propia contraseña ──────────────────────────────────────
    window.abrirModalMiPass = function() {
        if (!esDueno()) return;
        ['mp-actual', 'mp-nueva', 'mp-confirmar'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        document.getElementById('msg-mi-pass')?.classList.add('hidden');
        document.getElementById('modal-mi-pass').classList.remove('hidden');
        document.getElementById('mp-actual')?.focus();
    };
    window.cerrarModalMiPass = function() {
        document.getElementById('modal-mi-pass').classList.add('hidden');
    };
    window.guardarMiPass = async function() {
        const actual    = document.getElementById('mp-actual')?.value    || '';
        const nueva     = document.getElementById('mp-nueva')?.value     || '';
        const confirmar = document.getElementById('mp-confirmar')?.value || '';

        const showMsg = (m, ok) => {
            const el = document.getElementById('msg-mi-pass');
            if (el) {
                el.textContent = m;
                el.className = 'text-xs text-center mt-3 font-medium ' + (ok ? 'text-green-600' : 'text-red-600');
                el.classList.remove('hidden');
            }
        };

        const db    = getAdminsDB();
        const idx   = db.findIndex(a => a.email === sesion.email);
        if (idx < 0) { showMsg('Sesión inválida.', false); return; }

        const hashedActual = await hashPassword(actual);
        if (db[idx].passwordHash !== hashedActual) { showMsg('La contraseña actual es incorrecta.', false); return; }
        if (nueva.length < 8)                      { showMsg('La nueva contraseña debe tener al menos 8 caracteres.', false); return; }
        if (nueva !== confirmar)                    { showMsg('Las contraseñas no coinciden.', false); return; }

        db[idx].passwordHash = await hashPassword(nueva);
        delete db[idx].password;
        saveAdminsDB(db);
        showMsg('¡Contraseña actualizada correctamente!', true);
        setTimeout(() => cerrarModalMiPass(), 1500);
    };

    // ── Render: Conductores ───────────────────────────────────────────────
    window.renderConductores = function() {
        const query     = (document.getElementById('filtro-conductor')?.value || '').toLowerCase();
        const todos     = getConductores();
        const formularios = getFormularios();

        const filtrados = todos.filter(c => {
            if (!query) return true;
            return (c.nombre + ' ' + c.apellido).toLowerCase().includes(query)
                || (c.rut   || '').toLowerCase().includes(query)
                || (c.email || '').toLowerCase().includes(query);
        });

        const tbody = document.getElementById('tbody-conductores');
        const empty = document.getElementById('empty-conductores');
        document.getElementById('cnt-conductores').textContent = filtrados.length + ' conductor(es)';

        if (!filtrados.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');

        tbody.innerHTML = filtrados.map(c => {
            const nombre     = escapeHtml([c.nombre, c.apellido].filter(Boolean).join(' ') || '—');
            const totalForms = formularios.filter(f => f.conductorRut === c.rut).length;
            const fecha      = c.fechaRegistro ? new Date(c.fechaRegistro).toLocaleDateString('es-CL') : '—';
            const gBadge     = c.googleAuth     ? '<span class="ml-1 text-xs px-1.5 py-0.5 rounded" style="background:#e8f0fe;color:#1a73e8;font-size:10px;">Google</span>' : '';
            const aBadge     = c.creadoPorAdmin ? '<span class="ml-1 text-xs px-1.5 py-0.5 rounded" style="background:#fef3c7;color:#92400e;font-size:10px;">Admin</span>' : '';
            return `<tr>
                <td class="px-5 py-3 font-medium text-gray-800">${nombre}${gBadge}${aBadge}</td>
                <td class="px-5 py-3 text-gray-600 font-mono text-xs">${escapeHtml(c.rut || '—')}</td>
                <td class="px-5 py-3 text-gray-500 hidden md:table-cell text-xs">${escapeHtml(c.email || '—')}</td>
                <td class="px-5 py-3 text-gray-500 hidden sm:table-cell text-xs">${escapeHtml(c.telefono || '—')}</td>
                <td class="px-5 py-3 text-gray-400 text-xs hidden lg:table-cell">${escapeHtml(fecha)}</td>
                <td class="px-5 py-3 text-center hidden lg:table-cell">
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background:#d1fae5;color:#065f46;">${totalForms}</span>
                </td>
                <td class="px-5 py-3 text-center">
                    <button onclick="abrirModalEliminar(${JSON.stringify(c.rut)},${JSON.stringify([c.nombre,c.apellido].filter(Boolean).join(' '))})"
                            class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                    </button>
                </td>
            </tr>`;
        }).join('');
    };

    // ── Render: Formularios ───────────────────────────────────────────────
    window.renderFormularios = function() {
        const filterPatente   = (document.getElementById('f-patente')?.value   || '').toUpperCase().trim();
        const filterConductor = (document.getElementById('f-conductor')?.value || '').toLowerCase().trim();
        const filterEmail     = (document.getElementById('f-email')?.value     || '').toLowerCase().trim();
        const filterUID       = (document.getElementById('f-uid')?.value       || '').toUpperCase().trim();
        const filterDesde     = document.getElementById('f-desde')?.value || '';
        const filterHasta     = document.getElementById('f-hasta')?.value || '';
        const filterTipo      = document.getElementById('f-tipo')?.value  || '';

        const filtrados = getFormularios().filter(f => {
            if (filterPatente   && !f.patente?.toUpperCase().includes(filterPatente))         return false;
            if (filterConductor && !f.conductorNombre?.toLowerCase().includes(filterConductor)) return false;
            if (filterEmail     && !f.conductorEmail?.toLowerCase().includes(filterEmail))     return false;
            if (filterUID       && !f.uid?.toUpperCase().includes(filterUID))                  return false;
            if (filterTipo      && f.tipoControl !== filterTipo)                               return false;
            if (filterDesde     && f.fecha < filterDesde)                                      return false;
            if (filterHasta     && f.fecha > filterHasta)                                      return false;
            return true;
        }).sort((a, b) => (b.fechaEnvio || '').localeCompare(a.fechaEnvio || ''));

        const tbody = document.getElementById('tbody-formularios');
        const empty = document.getElementById('empty-formularios');
        document.getElementById('cnt-formularios').textContent = filtrados.length + ' resultado(s)';

        if (!filtrados.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');

        tbody.innerHTML = filtrados.map(f => {
            const tipoBadge = f.tipoControl === 'SALIDA'
                ? '<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:#dcfce7;color:#166534;">SALIDA</span>'
                : '<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:#dbeafe;color:#1e40af;">INGRESO</span>';
            const pct = parseInt(f.puntaje) || 0;
            const clr = pct >= 80 ? '#166534' : pct >= 60 ? '#92400e' : '#991b1b';
            const bg  = pct >= 80 ? '#dcfce7' : pct >= 60 ? '#fef3c7' : '#fee2e2';
            const fecha = f.fecha ? new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-CL') : '—';
            return `<tr>
                <td class="px-4 py-3 font-mono text-xs text-gray-400">${escapeHtml(f.uid || '—')}</td>
                <td class="px-4 py-3 text-gray-600 text-xs">${escapeHtml(fecha)}</td>
                <td class="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">${escapeHtml(f.hora || '—')}</td>
                <td class="px-4 py-3 font-medium text-gray-800 text-xs">${escapeHtml(f.conductorNombre || '—')}</td>
                <td class="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">${escapeHtml(f.conductorRut || '—')}</td>
                <td class="px-4 py-3 font-semibold text-gray-700 tracking-wide text-xs">${escapeHtml(f.patente || '—')}</td>
                <td class="px-4 py-3 text-center">${tipoBadge}</td>
                <td class="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">${escapeHtml(f.km || '—')}</td>
                <td class="px-4 py-3 text-center">
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:${bg};color:${clr};">${escapeHtml(f.puntaje || '—')}%</span>
                </td>
            </tr>`;
        }).join('');
    };

    // ── Copiar link de registro (válido 2 horas) ──────────────────────────
    window.copiarLinkRegistro = function() {
        const token  = generateRegToken();
        const base   = window.location.origin + window.location.pathname.replace('admin/dashboard.html', '');
        const url    = base + 'conductores/registro.html?token=' + token;
        const btn    = document.getElementById('btn-copiar-link');
        const orig   = btn ? btn.innerHTML : '';
        navigator.clipboard.writeText(url).then(() => {
            if (btn) {
                btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:15px;">check_circle</span> ¡Copiado! Válido 2h';
                btn.style.cssText += ';background:#e6f7f4;color:#1d8a76;border-color:#28A992;';
                setTimeout(() => { btn.innerHTML = orig; btn.removeAttribute('style'); btn.style.cssText = 'border-color:#28A992;color:#28A992;'; }, 4000);
            }
        }).catch(() => {
            prompt('Copia este link (válido 2 horas):', url);
        });
    };

    // ── Modal: agregar conductor ──────────────────────────────────────────
    window.abrirModalAgregar = function() {
        ['ag-nombre', 'ag-apellido', 'ag-rut', 'ag-email', 'ag-tel'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        document.getElementById('msg-agregar')?.classList.add('hidden');
        document.getElementById('modal-agregar').classList.remove('hidden');
        document.getElementById('ag-nombre')?.focus();
    };
    window.cerrarModalAgregar = function() { document.getElementById('modal-agregar').classList.add('hidden'); };
    window.guardarNuevoConductor = async function() {
        const nombre   = (document.getElementById('ag-nombre')?.value   || '').trim();
        const apellido = (document.getElementById('ag-apellido')?.value || '').trim();
        const rut      = (document.getElementById('ag-rut')?.value      || '').trim();
        const email    = (document.getElementById('ag-email')?.value    || '').trim();
        const telefono = (document.getElementById('ag-tel')?.value      || '').trim();

        const showErr = m => {
            const el = document.getElementById('msg-agregar');
            if (el) { el.textContent = m; el.className = 'text-xs text-center mt-3 font-medium text-red-600'; el.classList.remove('hidden'); }
        };

        if (!nombre || !apellido || !rut || !email || !telefono) { showErr('Completa todos los campos.'); return; }
        if (!/^\d{7,8}-[\dkK]$/.test(rut))                      { showErr('RUT inválido. Formato: 12345678-9'); return; }
        if (!esRutValido(rut))                                   { showErr('El dígito verificador del RUT es incorrecto.'); return; }
        if (findConductorByEmail(email))                         { showErr('Este correo ya está registrado.'); return; }
        if (findConductorByRUT(rut))                             { showErr('Este RUT ya está registrado.'); return; }

        const passwordHash = await hashPassword('2026-05');
        const conductor = { nombre, apellido, rut, email, telefono, passwordHash, fechaRegistro: new Date().toISOString(), creadoPorAdmin: true };
        const db = getConductores();
        db.push(conductor);
        saveConductores(db);
        enviarEmailBienvenida(conductor, 'administrador');
        cerrarModalAgregar();
        refrescarTodo();
    };

    // ── Modal: eliminar conductor ─────────────────────────────────────────
    window.abrirModalEliminar = function(rut, nombre) {
        _rutParaEliminar = rut;
        document.getElementById('modal-nombre-conductor').textContent = escapeHtml(nombre);
        document.getElementById('modal-eliminar').classList.remove('hidden');
    };
    window.cerrarModalEliminar = function() {
        _rutParaEliminar = null;
        document.getElementById('modal-eliminar').classList.add('hidden');
    };
    window.confirmarEliminar = function() {
        if (!_rutParaEliminar) return;
        saveConductores(getConductores().filter(c => c.rut !== _rutParaEliminar));
        cerrarModalEliminar();
        refrescarTodo();
    };

    // ── Período de fechas ─────────────────────────────────────────────────
    window.setPeriodo = function(periodo) {
        const hoy = new Date();
        const iso = d => d.toISOString().slice(0, 10);
        let desde = '', hasta = '';
        if (periodo === 'hoy')    { desde = hasta = iso(hoy); }
        else if (periodo === 'semana') {
            const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
            desde = iso(lunes); hasta = iso(hoy);
        } else if (periodo === 'mes') {
            desde = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); hasta = iso(hoy);
        }
        if (periodo !== null) {
            const d = document.getElementById('f-desde'); const h = document.getElementById('f-hasta');
            if (d) d.value = desde; if (h) h.value = hasta;
        }
        document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
        if (periodo) document.getElementById('btn-periodo-' + periodo)?.classList.add('active');
        const labels = { hoy: 'Exportar hoy', semana: 'Exportar semana', mes: 'Exportar mes', todo: 'Exportar CSV' };
        const exportLabel = document.getElementById('export-label');
        if (exportLabel) exportLabel.textContent = (periodo && labels[periodo]) || 'Exportar CSV';
        renderFormularios();
    };

    // ── Limpiar filtros ───────────────────────────────────────────────────
    window.limpiarFiltros = function() {
        ['f-patente', 'f-conductor', 'f-email', 'f-uid', 'f-desde', 'f-hasta'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const tipo = document.getElementById('f-tipo'); if (tipo) tipo.value = '';
        document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('active'));
        const el = document.getElementById('export-label'); if (el) el.textContent = 'Exportar CSV';
        renderFormularios();
    };

    // ── Exportar CSV ──────────────────────────────────────────────────────
    window.exportarCSV = function(tipo) {
        let cabecera, filas, nombre;
        const escape = v => '"' + String(v).replace(/"/g, '""') + '"';

        if (tipo === 'conductores') {
            const query = (document.getElementById('filtro-conductor')?.value || '').toLowerCase();
            const forms = getFormularios();
            cabecera = ['Nombre', 'Apellido', 'RUT', 'Correo', 'Teléfono', 'Fecha Registro', 'Formularios'];
            filas = getConductores()
                .filter(c => {
                    if (!query) return true;
                    return (c.nombre + ' ' + c.apellido).toLowerCase().includes(query)
                        || (c.rut || '').toLowerCase().includes(query)
                        || (c.email || '').toLowerCase().includes(query);
                })
                .map(c => [
                    c.nombre || '', c.apellido || '', c.rut || '', c.email || '', c.telefono || '',
                    c.fechaRegistro ? new Date(c.fechaRegistro).toLocaleDateString('es-CL') : '',
                    forms.filter(f => f.conductorRut === c.rut).length,
                ]);
            nombre = 'ACM_Conductores_' + new Date().toISOString().slice(0, 10) + '.csv';
        } else {
            const filterPatente   = (document.getElementById('f-patente')?.value   || '').toUpperCase().trim();
            const filterConductor = (document.getElementById('f-conductor')?.value || '').toLowerCase().trim();
            const filterEmail     = (document.getElementById('f-email')?.value     || '').toLowerCase().trim();
            const filterUID       = (document.getElementById('f-uid')?.value       || '').toUpperCase().trim();
            const filterDesde     = document.getElementById('f-desde')?.value || '';
            const filterHasta     = document.getElementById('f-hasta')?.value || '';
            const filterTipo      = document.getElementById('f-tipo')?.value  || '';
            let sub = '';
            if (filterDesde && filterHasta) sub = '_' + filterDesde + '_al_' + filterHasta;
            else if (filterDesde) sub = '_desde_' + filterDesde;
            else if (filterHasta) sub = '_hasta_' + filterHasta;
            cabecera = ['N° PDF', 'Fecha', 'Hora', 'Conductor', 'RUT', 'Correo', 'Patente', 'Tipo', 'KM', 'Puntaje', 'Rating'];
            filas = getFormularios().filter(f => {
                if (filterPatente   && !f.patente?.toUpperCase().includes(filterPatente))           return false;
                if (filterConductor && !f.conductorNombre?.toLowerCase().includes(filterConductor)) return false;
                if (filterEmail     && !f.conductorEmail?.toLowerCase().includes(filterEmail))       return false;
                if (filterUID       && !f.uid?.toUpperCase().includes(filterUID))                    return false;
                if (filterTipo      && f.tipoControl !== filterTipo)                                 return false;
                if (filterDesde     && f.fecha < filterDesde)                                        return false;
                if (filterHasta     && f.fecha > filterHasta)                                        return false;
                return true;
            }).sort((a, b) => (b.fechaEnvio || '').localeCompare(a.fechaEnvio || ''))
              .map(f => [
                f.uid || '', f.fecha ? new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-CL') : '',
                f.hora || '', f.conductorNombre || '', f.conductorRut || '', f.conductorEmail || '',
                f.patente || '', f.tipoControl || '', f.km || '',
                f.puntaje ? f.puntaje + '%' : '', f.rating || '',
              ]);
            nombre = 'ACM_Formularios' + sub + '_' + new Date().toISOString().slice(0, 10) + '.csv';
        }

        const csv  = [cabecera, ...filas].map(r => r.map(escape).join(',')).join('\r\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
    };

    // ── Datos de demostración ─────────────────────────────────────────────
    window.cargarDatosDemo = async function() {
        if (!confirm('¿Cargar datos de demostración? Agrega conductores y formularios ficticios.')) return;
        const conductoresDemo = [
            { nombre: 'Carlos',    apellido: 'Muñoz Vega',      rut: '12547896-3',  email: 'c.munoz@gmail.com',    telefono: '+56 9 8123 4567' },
            { nombre: 'Rodrigo',   apellido: 'Soto Alarcón',    rut: '15236478-K',  email: 'r.soto@hotmail.com',   telefono: '+56 9 7234 5678' },
            { nombre: 'Marcela',   apellido: 'Fuentes López',   rut: '10258963-2',  email: 'm.fuentes@gmail.com',  telefono: '+56 9 6345 6789', googleAuth: true },
            { nombre: 'Jorge',     apellido: 'Espinoza Díaz',   rut: '13698521-4',  email: 'j.espinoza@gmail.com', telefono: '+56 9 5456 7890' },
            { nombre: 'Patricia',  apellido: 'Rojas Herrera',   rut: '11478523-7',  email: 'p.rojas@outlook.com',  telefono: '+56 9 4567 8901' },
            { nombre: 'Sebastián', apellido: 'Castro Morales',  rut: '16325874-1',  email: 's.castro@gmail.com',   telefono: '+56 9 3678 9012' },
            { nombre: 'Alejandra', apellido: 'Pérez Salinas',   rut: '14785236-9',  email: 'a.perez@gmail.com',    telefono: '+56 9 2789 0123', googleAuth: true },
        ];
        const patentes = ['BSRK70', 'TVSR60', 'LLPH30', 'CZRM45', 'GXWT90'];
        const ratings  = [{ pct: 95, r: 'Excelente' }, { pct: 88, r: 'Muy Bien' }, { pct: 76, r: 'Bien' }, { pct: 63, r: 'Regular' }, { pct: 45, r: 'Mal' }];

        const dbC = getConductores();
        for (const c of conductoresDemo) {
            if (!dbC.find(x => x.rut === c.rut)) {
                const passwordHash = await hashPassword(c.rut.replace(/[^0-9]/g, '').replace(/.$/, ''));
                dbC.push({ ...c, passwordHash, fechaRegistro: new Date(Date.now() - Math.random() * 10 * 864e5).toISOString() });
            }
        }
        saveConductores(dbC);

        const dbF = getFormularios();
        for (let i = 6; i >= 0; i--) {
            const qty = Math.floor(Math.random() * 4) + 2;
            for (let j = 0; j < qty; j++) {
                const c    = conductoresDemo[Math.floor(Math.random() * conductoresDemo.length)];
                const rat  = ratings[Math.floor(Math.random() * ratings.length)];
                const tipo = Math.random() > 0.45 ? 'SALIDA' : 'INGRESO';
                const d    = new Date(); d.setDate(d.getDate() - i);
                const fecha = d.toISOString().slice(0, 10);
                const h = (7 + Math.floor(Math.random() * 11)).toString().padStart(2, '0');
                const m = Math.floor(Math.random() * 60).toString().padStart(2, '0');
                dbF.push({
                    uid: 'ACM-' + fecha.replace(/-/g, '').slice(2) + '-' + h + m + '-' + Math.floor(Math.random() * 9000 + 1000),
                    fecha, hora: h + ':' + m,
                    patente: patentes[Math.floor(Math.random() * patentes.length)],
                    tipoControl: tipo,
                    km: (40000 + Math.floor(Math.random() * 60000)).toString(),
                    conductorNombre: c.nombre + ' ' + c.apellido,
                    conductorRut: c.rut, conductorEmail: c.email,
                    puntaje: rat.pct, rating: rat.r,
                    fechaEnvio: fecha + 'T' + h + ':' + m + ':00.000Z',
                });
            }
        }
        saveFormularios(dbF);
        refrescarTodo();
        alert('✓ Datos de demostración cargados.');
    };

    // ── Refrescar todo ────────────────────────────────────────────────────
    function refrescarTodo() {
        cargarStats();
        renderCharts();
        renderConductores();
        renderFormularios();
    }

    refrescarTodo();
}
