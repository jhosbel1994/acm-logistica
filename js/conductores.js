// ──────────────────────────────────────────────────────────────────────────
// ACM Logística · Módulo de Conductores
// Requiere: db.js cargado antes que este archivo.
//
// Configuración:
//   GOOGLE_CLIENT_ID → console.cloud.google.com → APIs & Services → Credentials
//   EMAILJS_*        → emailjs.com (gratis hasta 200 emails/mes)
// ──────────────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID      = 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const EMAILJS_PUBLIC_KEY    = 'TU_EMAILJS_PUBLIC_KEY';
const EMAILJS_SERVICE_ID    = 'TU_EMAILJS_SERVICE_ID';
const EMAILJS_TEMPLATE_COND = 'TU_EMAILJS_TEMPLATE_ID';

if (window.emailjs && !EMAILJS_PUBLIC_KEY.startsWith('TU_')) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

// ── Contraseña por defecto del conductor ──────────────────────────────────
// Usa todos los dígitos numéricos del RUT (sin guión ni dígito verificador).
// Ej: RUT 12345678-9 → contraseña "12345678"
// Se muestra al conductor en el registro y se almacena como hash SHA-256.

function defaultPasswordFromRUT(rut) {
    return rut.replace(/[^0-9]/g, '').replace(/.$/, ''); // dígitos sin el último (DV)
}

// ── Sesión del conductor ──────────────────────────────────────────────────

function setSession(conductor) {
    sessionStorage.setItem('acm_conductor', JSON.stringify({
        nombre:    conductor.nombre,
        apellido:  conductor.apellido,
        rut:       conductor.rut,
        email:     conductor.email,
        telefono:  conductor.telefono,
        googleAuth: conductor.googleAuth || false,
    }));
}

function getSession() {
    try { return JSON.parse(sessionStorage.getItem('acm_conductor') || 'null'); }
    catch { return null; }
}

// ── UI helpers ────────────────────────────────────────────────────────────

function showMsg(id, msg, isError) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'text-sm text-center mt-3 font-medium ' +
        (isError !== false ? 'text-red-600' : 'text-green-600');
    el.classList.remove('hidden');
}

function showModalMsg(msg, isError) {
    const el = document.getElementById('msg-modal-rut');
    if (!el) return;
    el.textContent = msg;
    el.className = 'text-xs text-center mt-2 font-medium ' +
        (isError !== false ? 'text-red-600' : 'text-green-600');
    el.classList.remove('hidden');
}

// ── Email de bienvenida ───────────────────────────────────────────────────

function enviarEmailBienvenida(conductor, tipoRegistro) {
    if (!window.emailjs || EMAILJS_PUBLIC_KEY.startsWith('TU_')) return;
    const nombre = [conductor.nombre, conductor.apellido].filter(Boolean).join(' ');
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_COND, {
        to_name:         conductor.nombre || nombre,
        to_email:        conductor.email,
        nombre_completo: nombre,
        rut:             conductor.rut || '—',
        tipo_registro:   tipoRegistro,
        login_url:       window.location.origin + '/conductores/login.html',
    }).catch(() => {});
}

// ── Google OAuth ──────────────────────────────────────────────────────────

let _pendingGoogle = null;

window.handleGoogleCredential = function(response) {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        _pendingGoogle = payload;
        const conductor = findConductorByEmail(payload.email);
        if (conductor && conductor.rut) {
            setSession(conductor);
            window.location.href = './formulario.html';
        } else {
            abrirModalRUT(conductor, payload);
        }
    } catch {
        showMsg('msg-login', 'Error al procesar la autenticación de Google. Intenta de nuevo.');
    }
};

function abrirModalRUT(conductorExistente, payload) {
    const modal = document.getElementById('modal-rut');
    if (!modal) return;
    const nameEl   = document.getElementById('modal-google-name');
    const emailEl  = document.getElementById('modal-google-email');
    const avatarEl = document.getElementById('modal-google-avatar');
    if (nameEl)  nameEl.textContent  = escapeHtml(payload.name || payload.email);
    if (emailEl) emailEl.textContent = escapeHtml(payload.email);
    if (avatarEl && payload.picture) { avatarEl.src = payload.picture; avatarEl.classList.remove('hidden'); }
    const telRow = document.getElementById('modal-tel-row');
    if (telRow) telRow.classList.toggle('hidden', !!conductorExistente);
    modal.dataset.mode = conductorExistente ? 'update' : 'create';
    modal.classList.remove('hidden');
    const rutInput = document.getElementById('modal-inp-rut');
    if (rutInput) { rutInput.value = ''; rutInput.focus(); }
}

window.completarRegistroGoogle = async function() {
    if (!_pendingGoogle) return;
    const rut   = (document.getElementById('modal-inp-rut')?.value || '').trim();
    const modal = document.getElementById('modal-rut');
    const mode  = modal?.dataset.mode;

    if (!/^\d{7,8}-[\dkK]$/.test(rut)) {
        showModalMsg('RUT inválido. Ejemplo: 12345678-9');
        return;
    }
    if (!esRutValido(rut)) {
        showModalMsg('El dígito verificador del RUT es incorrecto.');
        return;
    }

    const db = getConductores();
    let conductor;
    const esNuevo = mode === 'create';

    if (!esNuevo) {
        const idx = db.findIndex(c => (c.email || '').toLowerCase() === _pendingGoogle.email.toLowerCase());
        if (idx >= 0) { db[idx].rut = rut; conductor = db[idx]; }
    } else {
        if (findConductorByRUT(rut)) { showModalMsg('Este RUT ya está registrado.'); return; }
        const tel = (document.getElementById('modal-inp-tel')?.value || '').trim();
        if (!tel) { showModalMsg('Ingresa tu número móvil.'); return; }
        const passwordHash = await hashPassword('2026-05');
        conductor = {
            nombre:        _pendingGoogle.given_name  || _pendingGoogle.name || '',
            apellido:      _pendingGoogle.family_name || '',
            rut,
            email:         _pendingGoogle.email,
            telefono:      tel,
            passwordHash,
            fechaRegistro: new Date().toISOString(),
            googleAuth:    true,
        };
        db.push(conductor);
    }

    saveConductores(db);
    if (esNuevo) enviarEmailBienvenida(conductor, 'google');
    setSession(conductor);
    _pendingGoogle = null;
    window.location.href = './formulario.html';
};

window.cerrarModalRUT = function() {
    const modal = document.getElementById('modal-rut');
    if (modal) modal.classList.add('hidden');
    _pendingGoogle = null;
};

window.onGoogleLibraryLoad = function() {
    const container = document.getElementById('google-btn-container');
    if (!container) return;
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    const esRegistro = window.location.pathname.includes('registro');
    google.accounts.id.renderButton(container, {
        type: 'standard', theme: 'outline', size: 'large',
        text: esRegistro ? 'signup_with' : 'signin_with',
        shape: 'rectangular', logo_alignment: 'left',
        width: Math.min(container.offsetWidth || 368, 400),
    });
};

// ── LOGIN correo/RUT + contraseña ─────────────────────────────────────────

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const identifier = (document.getElementById('inp-identifier')?.value || '').trim();
        const password   = (document.getElementById('inp-password')?.value  || '').trim();

        if (!identifier || !password) {
            showMsg('msg-login', 'Completa todos los campos.');
            return;
        }

        // Rate limiting
        const rateId = 'conductor_' + identifier.slice(0, 20);
        const rate = checkRateLimit(rateId);
        if (rate.blocked) {
            showMsg('msg-login', `Demasiados intentos. Espera ${rate.remaining}s.`);
            return;
        }

        const conductor = identifier.includes('@')
            ? findConductorByEmail(identifier)
            : findConductorByRUT(identifier);

        if (!conductor) {
            recordAttempt(rateId);
            showMsg('msg-login', 'Usuario no encontrado. Verifica tu correo o RUT.');
            return;
        }
        if (!conductor.rut) {
            showMsg('msg-login', 'Tu ficha no tiene RUT. Inicia sesión con Google para completarla.');
            return;
        }

        // Soporte dual: hash nuevo o contraseña legada (4 dígitos) para migración
        const hashedInput    = await hashPassword(password);
        const legacyPassword = conductor.rut.replace(/[^0-9]/g, '').substring(0, 4);
        const storedHash     = conductor.passwordHash || await hashPassword(legacyPassword);

        if (hashedInput !== storedHash) {
            recordAttempt(rateId);
            showMsg('msg-login', 'Contraseña incorrecta.');
            return;
        }

        // Migrar contraseña legada al nuevo hash si aún no está
        if (!conductor.passwordHash) {
            const db  = getConductores();
            const idx = db.findIndex(c => normalizeRUT(c.rut || '') === normalizeRUT(conductor.rut));
            if (idx >= 0) { db[idx].passwordHash = storedHash; saveConductores(db); }
        }

        clearAttempts(rateId);
        setSession(conductor);
        window.location.href = './formulario.html';
    });
}

// ── REGISTRO manual ───────────────────────────────────────────────────────

const registroForm = document.getElementById('registroForm');
if (registroForm) {
    registroForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const nombre   = (document.getElementById('inp-nombre')?.value   || '').trim();
        const apellido = (document.getElementById('inp-apellido')?.value || '').trim();
        const rut      = (document.getElementById('inp-rut')?.value      || '').trim();
        const email    = (document.getElementById('inp-email')?.value    || '').trim();
        const telefono = (document.getElementById('inp-tel')?.value      || '').trim();

        if (!nombre || !apellido || !rut || !email || !telefono) {
            showMsg('msg-registro', 'Completa todos los campos.');
            return;
        }
        if (!/^\d{7,8}-[\dkK]$/.test(rut)) {
            showMsg('msg-registro', 'RUT inválido. Formato: 12345678-9 (sin puntos, con guión).');
            return;
        }
        if (!esRutValido(rut)) {
            showMsg('msg-registro', 'El dígito verificador del RUT es incorrecto.');
            return;
        }
        if (findConductorByEmail(email)) { showMsg('msg-registro', 'Este correo ya está registrado.'); return; }
        if (findConductorByRUT(rut))     { showMsg('msg-registro', 'Este RUT ya está registrado.'); return; }

        const passwordHash = await hashPassword('2026-05');
        const conductor = { nombre, apellido, rut, email, telefono, passwordHash, fechaRegistro: new Date().toISOString() };
        const db = getConductores();
        db.push(conductor);
        saveConductores(db);
        enviarEmailBienvenida(conductor, 'propio');

        showMsg('msg-registro',
            `¡Bienvenido/a, ${nombre}! Entrando al formulario…`,
            false
        );
        setSession(conductor);
        setTimeout(() => { window.location.href = './formulario.html'; }, 1200);
    });
}

// ── Recuperar contraseña ──────────────────────────────────────────────────

const btnRecuperar = document.getElementById('btnRecuperarPass');
if (btnRecuperar) {
    btnRecuperar.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('modalRecuperar')?.classList.toggle('hidden');
    });
}

function enviarRecuperacion() {
    const email = document.getElementById('emailRecuperar')?.value;
    if (email) document.getElementById('msgRecuperar')?.classList.remove('hidden');
}

// ── Formulario: poblar info del conductor desde sesión ────────────────────

const infoNombre = document.getElementById('info-nombre');
if (infoNombre) {
    const c = getSession();
    if (c) {
        infoNombre.textContent = escapeHtml([c.nombre, c.apellido].filter(Boolean).join(' '));
        const elRut = document.getElementById('info-rut');
        const elTel = document.getElementById('info-tel');
        if (elRut) elRut.textContent = escapeHtml(c.rut      || '—');
        if (elTel) elTel.textContent = escapeHtml(c.telefono || '—');
    }
}

// ── Logout ────────────────────────────────────────────────────────────────

function logout() {
    sessionStorage.removeItem('acm_conductor');
    window.location.href = '../index.html';
}
