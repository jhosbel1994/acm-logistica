// ──────────────────────────────────────────────────────────────────────────
// ACM Logística · Constantes corporativas
// Cargado como script normal (no ES module).
// Las funciones de hash, validación y DB están en db.js.
// ──────────────────────────────────────────────────────────────────────────

const CORREOS_GERENCIA = [
    'jefeoperaciones@serviciosbop.cl',
    'prevencion@serviciosbop.cl',
    'jhosbelevilla@gmail.com',
];

const ALIAS_CORPORATIVO  = 'supervicion@serviciosbop.cl';
const DOMINIO_CORPORATIVO = '@serviciosbop.cl';

function esCorreoCorporativo(email) {
    return (email || '').includes(DOMINIO_CORPORATIVO);
}

// Obtener ubicación GPS como Promise
function obtenerUbicacion() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject('Geolocalización no disponible'); return; }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({
                latitud:  pos.coords.latitude,
                longitud: pos.coords.longitude,
                precision: pos.coords.accuracy,
                timestamp: new Date().toISOString(),
            }),
            err => reject(err.message)
        );
    });
}
