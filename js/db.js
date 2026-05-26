// ──────────────────────────────────────────────────────────────────────────
// ACM Logística · Capa de datos compartida
// Cargado ANTES de admin.js y conductores.js en cada HTML.
// ──────────────────────────────────────────────────────────────────────────

const DB_KEYS = {
    conductores: 'acm_conductores',
    formularios: 'acm_formularios',
    admins:      'acm_admins',
};

// ── Helpers genéricos ─────────────────────────────────────────────────────

function dbRead(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
}

function dbWrite(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ── Conductores ───────────────────────────────────────────────────────────

function getConductores() { return dbRead(DB_KEYS.conductores); }
function saveConductores(arr) { dbWrite(DB_KEYS.conductores, arr); }

function normalizeRUT(rut) {
    return rut.replace(/\./g, '').toUpperCase().trim();
}

function findConductorByEmail(email) {
    return getConductores().find(c =>
        (c.email || '').toLowerCase() === email.toLowerCase().trim()
    ) || null;
}

function findConductorByRUT(rut) {
    const n = normalizeRUT(rut);
    return getConductores().find(c => normalizeRUT(c.rut || '') === n) || null;
}

// ── Formularios ───────────────────────────────────────────────────────────

function getFormularios() { return dbRead(DB_KEYS.formularios); }
function saveFormularios(arr) { dbWrite(DB_KEYS.formularios, arr); }

// ── Administradores ───────────────────────────────────────────────────────

function getAdmins() { return dbRead(DB_KEYS.admins); }
function saveAdmins(arr) { dbWrite(DB_KEYS.admins, arr); }

function findAdminByEmail(email) {
    return getAdmins().find(a =>
        (a.email || '').toLowerCase() === email.toLowerCase().trim()
    ) || null;
}

// ── Validación de RUT chileno ─────────────────────────────────────────────

function esRutValido(rut) {
    const limpio = rut.replace(/[^\dkK]/g, '').toUpperCase();
    if (limpio.length < 2) return false;
    const dv  = limpio.slice(-1);
    const num = parseInt(limpio.slice(0, -1), 10);
    if (isNaN(num)) return false;
    let s = 0, m = 2, n = num;
    while (n > 0) { s += (n % 10) * m; n = Math.floor(n / 10); m = m < 7 ? m + 1 : 2; }
    const expected = 11 - (s % 11);
    const dvEsp = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
    return dv === dvEsp;
}

// ── Sanitizar HTML (prevención XSS en innerHTML) ──────────────────────────

function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str ?? '')));
    return d.innerHTML;
}

// ── Hash SHA-256 con Web Crypto API (async) ───────────────────────────────
// Salt fijo de aplicación + contraseña. No reemplaza bcrypt pero es
// infinitamente mejor que texto plano.

async function hashPassword(password) {
    const data = new TextEncoder().encode('ACM_SALT_2026_' + password);
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isHashed(str) {
    return typeof str === 'string' && /^[0-9a-f]{64}$/.test(str);
}

// ── Rate limiting en sesión (5 intentos → 30s bloqueo) ───────────────────

const RATE_KEY = 'acm_rate';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 30000;

function checkRateLimit(id) {
    const map   = JSON.parse(sessionStorage.getItem(RATE_KEY) || '{}');
    const entry = map[id] || { count: 0, ts: 0 };
    const now   = Date.now();
    if (entry.count >= MAX_ATTEMPTS && (now - entry.ts) < LOCKOUT_MS) {
        return { blocked: true, remaining: Math.ceil((LOCKOUT_MS - (now - entry.ts)) / 1000) };
    }
    if ((now - entry.ts) >= LOCKOUT_MS) entry.count = 0;
    return { blocked: false };
}

function recordAttempt(id) {
    const map   = JSON.parse(sessionStorage.getItem(RATE_KEY) || '{}');
    const entry = map[id] || { count: 0, ts: 0 };
    entry.count++;
    entry.ts = Date.now();
    map[id]  = entry;
    sessionStorage.setItem(RATE_KEY, JSON.stringify(map));
}

function clearAttempts(id) {
    const map = JSON.parse(sessionStorage.getItem(RATE_KEY) || '{}');
    delete map[id];
    sessionStorage.setItem(RATE_KEY, JSON.stringify(map));
}

// ── Token de registro con expiración de 2 horas ───────────────────────────

function generateRegToken() {
    const ts   = Date.now();
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return btoa(ts + '|' + rand).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function validateRegToken(token) {
    try {
        const b64     = token.replace(/-/g, '+').replace(/_/g, '/');
        const pad     = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
        const decoded = atob(pad);
        const ts      = parseInt(decoded.split('|')[0]);
        if (isNaN(ts)) return false;
        return (Date.now() - ts) < 2 * 60 * 60 * 1000;
    } catch { return false; }
}
