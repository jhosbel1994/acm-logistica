// Utilidades compartidas

// Formatear fecha
function formatearFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-CL');
}

// Formatear hora
function formatearHora(fecha) {
    return new Date(fecha).toLocaleTimeString('es-CL');
}

// Validar correo
function esCorreoValido(correo) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(correo);
}

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = 'info') {
    const div = document.createElement('div');
    div.className = `p-4 rounded-lg mb-4 ${
        tipo === 'error' ? 'bg-red-100 text-red-700' :
        tipo === 'success' ? 'bg-green-100 text-green-700' :
        'bg-blue-100 text-blue-700'
    }`;
    div.textContent = mensaje;
    
    document.body.insertBefore(div, document.body.firstChild);
    
    setTimeout(() => div.remove(), 5000);
}

// Convertir archivo a base64
async function archivoABase64(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(archivo);
    });
}

export {
    formatearFecha,
    formatearHora,
    esCorreoValido,
    mostrarNotificacion,
    archivoABase64
};
