// Google Apps Script - Backend ACM Logística
// Copiar este código en Google Apps Script Editor

// CONFIGURACIÓN
const CORREOS_GERENCIA = [
    "jefeoperaciones@serviciosbop.cl",
    "prevencion@serviciosbop.cl",
    "jhosbelevilla@gmail.com"
];
const ALIAS_CORPORATIVO = "supervicion@serviciosbop.cl";
const DOMINIO_CORPORATIVO = "@serviciosbop.cl";

// ID del Google Sheet (reemplazar con tu ID)
const SPREADSHEET_ID = "TU_GOOGLE_SHEET_ID_AQUI";
const HOJA_CONDUCTORES = "Conductores";
const HOJA_FORMULARIOS = "Formularios";

// ====== FUNCIONES PRINCIPALES ======

/**
 * Registrar nuevo conductor
 */
function registrarConductor(nombre, apellido, rut, correo, telefono) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(HOJA_CONDUCTORES);
        
        // Generar contraseña por defecto (primeros 4 dígitos del RUT)
        const password = rut.replace(/[^\d]/g, "").substring(0, 4);
        
        // Agregar fila
        sheet.appendRow([
            new Date().toISOString(),
            nombre + ' ' + apellido,
            rut,
            correo,
            telefono,
            password,
            "activo"
        ]);
        
        // Enviar correo de bienvenida
        enviarCorreoBienvenida(correo, nombre, password);
        
        return { success: true, message: "Conductor registrado correctamente" };
    } catch (error) {
        return { success: false, error: error.toString() };
    }
}

/**
 * Enviar formulario de control diario
 */
function enviarFormulario(datosFormulario) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(HOJA_FORMULARIOS);
        
        // Agregar fila con datos
        sheet.appendRow([
            new Date().toISOString(),
            datosFormulario.conductor,
            datosFormulario.rut,
            datosFormulario.patente,
            datosFormulario.tipo,
            datosFormulario.kilometraje,
            datosFormulario.latitud,
            datosFormulario.longitud,
            datosFormulario.estado
        ]);
        
        // Generar PDF
        const pdfBlob = generarPDF(datosFormulario);
        
        // Enviar correo a gerencia con PDF
        enviarCorreoGerencia(datosFormulario, pdfBlob);
        
        // Confirmación al conductor
        enviarConfirmacionConductor(datosFormulario.correo, datosFormulario.conductor);
        
        return { success: true, message: "Formulario enviado correctamente" };
    } catch (error) {
        return { success: false, error: error.toString() };
    }
}

/**
 * Validar login de conductor
 */
function validarLoginConductor(correo, password) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(HOJA_CONDUCTORES);
        const datos = sheet.getDataRange().getValues();
        
        // Buscar conductor
        for (let i = 1; i < datos.length; i++) {
            if (datos[i][3] === correo && datos[i][5] === password) {
                return { success: true, conductor: datos[i][1], tipo: "conductor" };
            }
        }
        
        return { success: false, error: "Credenciales inválidas" };
    } catch (error) {
        return { success: false, error: error.toString() };
    }
}

/**
 * Validar login administrativo (solo @serviciosbop.cl)
 */
function validarLoginAdmin(correo, password) {
    if (!correo.includes(DOMINIO_CORPORATIVO)) {
        return { success: false, error: "Solo correos @serviciosbop.cl permitidos" };
    }
    
    // En producción, validar contra base de datos de administradores
    // Por ahora, cualquier correo corporativo es válido
    return { success: true, admin: correo, tipo: "admin" };
}

// ====== FUNCIONES DE EMAIL ======

/**
 * Correo de bienvenida para nuevo conductor
 */
function enviarCorreoBienvenida(correo, nombre, password) {
    const asunto = "Bienvenido a ACM Logística - Tu acceso está listo";
    const body = `
        Hola ${nombre},
        
        Tu registro en ACM Logística ha sido completado exitosamente.
        
        Datos de acceso:
        Correo: ${correo}
        Contraseña: ${password}
        
        A partir de mañana, recibirás un correo diario a las 07:00 AM (L-S) para que completes tu formulario de control.
        
        Acceder: [URL_FORMULARIO]
        
        Saludos,
        Equipo ACM Logística
    `;
    
    GmailApp.sendEmail(correo, asunto, body);
}

/**
 * Email matutino a conductores (Ejecutar con trigger a las 7:00 AM)
 */
function enviarEmailMatutino() {
    const hoy = new Date().getDay();
    
    // No enviar los domingos (domingo = 0)
    if (hoy === 0) return;
    
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(HOJA_CONDUCTORES);
        const datos = sheet.getDataRange().getValues();
        
        for (let i = 1; i < datos.length; i++) {
            const correo = datos[i][3];
            const nombre = datos[i][1];
            const estado = datos[i][6];
            
            if (estado === "activo") {
                const asunto = "Recordatorio: Completa tu control diario";
                const body = `
                    Hola ${nombre},
                    
                    Es hora de completar tu formulario de control diario.
                    
                    Ingresa aquí: [URL_FORMULARIO]
                    
                    Tienes hasta las 23:59 horas para completar el formulario.
                    
                    Saludos,
                    ACM Logística
                `;
                
                GmailApp.sendEmail(correo, asunto, body);
            }
        }
    } catch (error) {
        Logger.log("Error enviando email matutino: " + error);
    }
}

/**
 * Enviar formulario a gerencia con PDF
 */
function enviarCorreoGerencia(datosFormulario, pdfBlob) {
    const asunto = `[FORMULARIO RECIBIDO] ${datosFormulario.conductor} - ${new Date().toLocaleDateString('es-CL')}`;
    
    const body = `
        Nuevo formulario recibido:
        
        Conductor: ${datosFormulario.conductor}
        RUT: ${datosFormulario.rut}
        Vehículo: ${datosFormulario.patente}
        Tipo: ${datosFormulario.tipo}
        Kilometraje: ${datosFormulario.kilometraje} km
        
        Ubicación: ${datosFormulario.latitud}, ${datosFormulario.longitud}
        Hora: ${new Date().toLocaleTimeString('es-CL')}
        
        Ver el PDF adjunto para detalles completos.
    `;
    
    // Enviar a todos los gerentes
    CORREOS_GERENCIA.forEach(gerente => {
        GmailApp.sendEmail(gerente, asunto, body, {
            attachments: [pdfBlob]
        });
    });
}

/**
 * Confirmación al conductor
 */
function enviarConfirmacionConductor(correo, nombre) {
    const asunto = "Tu formulario fue recibido correctamente";
    const body = `
        Hola ${nombre},
        
        Tu formulario de control ha sido registrado correctamente en ${new Date().toLocaleTimeString('es-CL')}.
        
        Gracias por tu puntualidad.
        
        Saludos,
        ACM Logística
    `;
    
    GmailApp.sendEmail(correo, asunto, body);
}

// ====== GENERACIÓN DE PDF ======

/**
 * Generar PDF con datos del formulario
 */
function generarPDF(datosFormulario) {
    // Crear documento en Google Drive
    const doc = DocumentApp.create(`Formulario_${datosFormulario.conductor}_${new Date().getTime()}`);
    const body = doc.getBody();
    
    // Encabezado
    body.appendParagraph("ACM LOGÍSTICA").setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph("Control Diario de Vehículos").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    
    // Datos
    body.appendParagraph(`Conductor: ${datosFormulario.conductor}`);
    body.appendParagraph(`RUT: ${datosFormulario.rut}`);
    body.appendParagraph(`Vehículo: ${datosFormulario.patente}`);
    body.appendParagraph(`Tipo: ${datosFormulario.tipo}`);
    body.appendParagraph(`Kilometraje: ${datosFormulario.kilometraje} km`);
    body.appendParagraph(`Fecha: ${new Date().toLocaleDateString('es-CL')}`);
    body.appendParagraph(`Hora: ${new Date().toLocaleTimeString('es-CL')}`);
    body.appendParagraph(`Ubicación: ${datosFormulario.latitud}, ${datosFormulario.longitud}`);
    
    // Convertir a PDF
    const pdfBlob = doc.getAs('application/pdf');
    
    // Eliminar documento temporal
    DriveApp.getFileById(doc.getId()).setTrashed(true);
    
    return pdfBlob;
}

// ====== TRIGGERS ======
/**
 * Crear triggers en Google Apps Script:
 * 1. Para email matutino: Ejecutar enviarEmailMatutino() diariamente a las 07:00 AM
 * 2. Para doGet: Endpoint para formulario web
 */

function doGet(e) {
    // Endpoint para GET requests
    return HtmlService.createHtmlOutput("ACM Logística API v1");
}

function doPost(e) {
    // Endpoint para POST requests (formularios)
    const accion = e.parameter.accion;
    
    if (accion === "registrar") {
        return ContentService.createTextOutput(JSON.stringify(
            registrarConductor(e.parameter.nombre, e.parameter.apellido, e.parameter.rut, e.parameter.correo, e.parameter.telefono)
        )).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (accion === "enviarFormulario") {
        return ContentService.createTextOutput(JSON.stringify(
            enviarFormulario(JSON.parse(e.postData.contents))
        )).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (accion === "loginConductor") {
        return ContentService.createTextOutput(JSON.stringify(
            validarLoginConductor(e.parameter.correo, e.parameter.password)
        )).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (accion === "loginAdmin") {
        return ContentService.createTextOutput(JSON.stringify(
            validarLoginAdmin(e.parameter.correo, e.parameter.password)
        )).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput("Acción no válida").setMimeType(ContentService.MimeType.TEXT);
}
