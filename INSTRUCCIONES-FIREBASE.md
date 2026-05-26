# Setup Firebase - ACM Logística

Guía completa para configurar Firebase en lugar de Google Sheets.

## 1. CREAR PROYECTO EN FIREBASE

### Paso 1: Ir a Firebase Console
1. Abre https://console.firebase.google.com
2. Click en "Crear Proyecto"
3. Nombre: `acm-logistica`
4. Click en "Continuar"

### Paso 2: Habilitar Google Analytics (Opcional)
- Puedes saltarlo o habilitarlo
- Click en "Crear Proyecto"

### Paso 3: Agregar Web App
1. En el proyecto, click en el ícono `</>` (Web)
2. Nombre de la app: `acm-logistica-web`
3. Click en "Registrar app"
4. **COPIA las credenciales que aparecen** (guardar en lugar seguro)

Verás algo como:
```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "acm-logistica.firebaseapp.com",
  projectId: "acm-logistica-xxxxx",
  storageBucket: "acm-logistica.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## 2. CONFIGURAR FIRESTORE DATABASE

### Paso 1: Crear Database
1. En Firebase Console, click en "Firestore Database"
2. Click en "Crear Database"
3. Ubicación: Selecciona la más cercana a Chile (ej: us-central1 o us-south1)
4. Modo de seguridad: **"Comenzar en modo de prueba"** (por ahora)
5. Click en "Crear"

### Paso 2: Estructura de Colecciones

Firebase usa colecciones (como tablas). Crear estas:

**Colección: `conductores`**
```
Documento:
{
  id: "auto",
  nombre: "Juan Pérez",
  apellido: "García",
  rut: "12.345.678-9",
  correo: "juan@example.com",
  telefono: "+56912345678",
  password: "1234", // hash en producción
  estado: "activo",
  fechaRegistro: timestamp,
  ultimaActividad: timestamp
}
```

**Colección: `formularios`**
```
Documento:
{
  id: "auto",
  conductorId: "referencia a conductores",
  conductor: "Juan Pérez",
  rut: "12.345.678-9",
  patente: "ABCD-1234",
  tipo: "SALIDA",
  fecha: "2024-05-25",
  kilometraje: 45000,
  latitud: -35.4267,
  longitud: -71.5429,
  aseo: "CUMPLE",
  agua: "CUMPLE",
  aceiteMotor: "CUMPLE",
  frenos: "CUMPLE",
  combustible: "CUMPLE",
  fotos: [
    "https://storage.googleapis.com/...",
    "https://storage.googleapis.com/..."
  ],
  estado: "completado",
  fechaEnvio: timestamp,
  notificadoGerencia: true
}
```

**Colección: `administradores`**
```
Documento:
{
  id: "auto",
  correo: "admin@serviciosbop.cl",
  nombre: "Jefe de Operaciones",
  rol: "gerente",
  permisos: ["ver_reportes", "exportar_datos"],
  activo: true
}
```

**Colección: `configuracion`**
```
Documento: "empresa"
{
  nombre: "ACM Logística",
  correoMatutino: {
    hora: "07:00",
    activo: true,
    diasExcluidos: [0] // 0 = domingo
  },
  correosGerencia: [
    "jefeoperaciones@serviciosbop.cl",
    "prevencion@serviciosbop.cl",
    "jhosbelevilla@gmail.com"
  ],
  aliasCorporativo: "supervicion@serviciosbop.cl",
  dominioCorporativo: "@serviciosbop.cl"
}
```

## 3. CONFIGURAR REGLAS DE SEGURIDAD

En Firestore > Reglas, reemplaza con:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Conductores: Leen sus propios datos
    match /conductores/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if false; // Solo backend puede escribir
    }
    
    // Formularios: Conductores escriben los suyos, admins leen todos
    match /formularios/{document=**} {
      allow read: if request.auth.token.esAdmin == true;
      allow create: if request.auth != null;
      allow update: if false;
      allow delete: if false;
    }
    
    // Admins: Solo pueden leer
    match /administradores/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if false;
    }
    
    // Config: Todos leen
    match /configuracion/{document=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

## 4. CONFIGURAR AUTENTICACIÓN

### Habilitar Métodos de Auth
1. Firebase Console > Autenticación > Método de inicio de sesión
2. Habilitar:
   - **Email/Contraseña** ✓
   - **Google** ✓ (opcional)

### Crear Usuarios en Firebase Auth
1. En Autenticación > Usuarios
2. Click en "Agregar usuario"
3. Para cada conductor:
   - Email: su correo
   - Contraseña: primeros 4 dígitos del RUT

**Nota**: En producción, usar hashing seguro

## 5. CREAR ARCHIVO DE CONFIGURACIÓN

Crear archivo: `js/firebase-config.js`

```javascript
// Reemplazar con tus credenciales de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "acm-logistica.firebaseapp.com",
  projectId: "acm-logistica-xxxxx",
  storageBucket: "acm-logistica.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

export { db, auth };
```

## 6. ACTUALIZAR ARCHIVOS HTML

Agregar en `<head>` de todos los HTML:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js"></script>

<script src="../js/firebase-config.js"></script>
```

## 7. ACTUALIZAR JAVASCRIPT

### Archivo: `js/conductores.js` (Registro)

```javascript
import { db, auth } from './firebase-config.js';

// Registro de conductor
if (document.getElementById('registroForm')) {
    document.getElementById('registroForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombre = e.target.elements[0].value;
        const apellido = e.target.elements[1].value;
        const rut = e.target.elements[2].value;
        const correo = e.target.elements[3].value;
        const telefono = e.target.elements[4].value;
        const password = rut.substring(0, 4); // Primeros 4 dígitos
        
        try {
            // Crear usuario en Auth
            const userAuth = await auth.createUserWithEmailAndPassword(correo, password);
            
            // Guardar datos en Firestore
            await db.collection('conductores').doc(userAuth.user.uid).set({
                nombre: nombre,
                apellido: apellido,
                rut: rut,
                correo: correo,
                telefono: telefono,
                estado: 'activo',
                fechaRegistro: new Date(),
                ultimaActividad: new Date()
            });
            
            alert('Registro exitoso. Ahora puedes ingresar.');
            window.location.href = './login.html';
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
}

// Login de conductor
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const correo = e.target.elements[0].value;
        const password = e.target.elements[1].value;
        
        try {
            const userAuth = await auth.signInWithEmailAndPassword(correo, password);
            
            // Obtener datos del conductor
            const docSnap = await db.collection('conductores').doc(userAuth.user.uid).get();
            
            if (docSnap.exists) {
                // Guardar en localStorage
                localStorage.setItem('usuario_logueado', JSON.stringify({
                    uid: userAuth.user.uid,
                    tipo: 'conductor',
                    correo: correo,
                    nombre: docSnap.data().nombre,
                    rut: docSnap.data().rut
                }));
                
                alert('Login exitoso');
                window.location.href = './formulario.html';
            }
        } catch (error) {
            alert('Error de login: ' + error.message);
        }
    });
}
```

### Archivo: `js/formulario.js` (Envío)

```javascript
import { db, auth } from './firebase-config.js';

if (document.getElementById('formularioControl')) {
    document.getElementById('formularioControl').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const usuario = JSON.parse(localStorage.getItem('usuario_logueado'));
        
        try {
            // Obtener ubicación GPS
            const ubicacion = await obtenerUbicacion();
            
            // Crear documento en Firestore
            const docRef = await db.collection('formularios').add({
                conductorId: usuario.uid,
                conductor: usuario.nombre,
                rut: usuario.rut,
                patente: e.target.elements[0].value,
                tipo: e.target.elements[1].value,
                fecha: e.target.elements[2].value,
                kilometraje: parseInt(e.target.elements[3].value),
                latitud: ubicacion.latitud,
                longitud: ubicacion.longitud,
                aseo: e.target.elements[4].value,
                agua: e.target.elements[5].value,
                aceiteMotor: e.target.elements[6].value,
                frenos: e.target.elements[7].value,
                combustible: e.target.elements[8].value,
                estado: 'completado',
                fechaEnvio: new Date(),
                notificadoGerencia: false
            });
            
            // Actualizar última actividad del conductor
            await db.collection('conductores').doc(usuario.uid).update({
                ultimaActividad: new Date()
            });
            
            alert('Formulario enviado correctamente');
            
            // Trigger Cloud Function para enviar emails
            // (ver paso 8 abajo)
            
            window.location.href = './formulario.html';
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
}

async function obtenerUbicacion() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitud: position.coords.latitude,
                    longitud: position.coords.longitude,
                    precision: position.coords.accuracy
                });
            },
            (error) => reject(error)
        );
    });
}
```

### Archivo: `js/admin.js` (Dashboard)

```javascript
import { db, auth } from './firebase-config.js';

// Verificar acceso admin
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = './login.html';
        return;
    }
    
    const docSnap = await db.collection('administradores').doc(user.uid).get();
    if (!docSnap.exists) {
        alert('Acceso denegado');
        auth.signOut();
        return;
    }
    
    // Cargar datos del dashboard
    cargarDashboard();
});

async function cargarDashboard() {
    try {
        // Total de conductores activos
        const conductoresSnap = await db.collection('conductores')
            .where('estado', '==', 'activo')
            .get();
        document.getElementById('totalConductores').textContent = conductoresSnap.size;
        
        // Formularios del día
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const formularioHoySnap = await db.collection('formularios')
            .where('fechaEnvio', '>=', hoy)
            .get();
        document.getElementById('formularioHoy').textContent = formularioHoySnap.size;
        
        // Tasa de cumplimiento
        const tasaCumplimiento = (formularioHoySnap.size / conductoresSnap.size * 100).toFixed(1);
        document.getElementById('tasaCumplimiento').textContent = tasaCumplimiento + '%';
        
        // Tabla de conductores
        cargarTablaConductores();
        
        // Tabla de formularios
        cargarTablaFormularios();
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

async function cargarTablaConductores() {
    const snapshot = await db.collection('conductores').get();
    const tbody = document.getElementById('tablaCtual');
    tbody.innerHTML = '';
    
    snapshot.forEach((doc) => {
        const data = doc.data();
        tbody.innerHTML += `
            <tr>
                <td class="px-6 py-4">${data.nombre} ${data.apellido}</td>
                <td class="px-6 py-4">${data.correo}</td>
                <td class="px-6 py-4">${data.telefono}</td>
                <td class="px-6 py-4">--</td>
                <td class="px-6 py-4">${new Date(data.ultimaActividad.toDate()).toLocaleDateString()}</td>
                <td class="px-6 py-4"><button onclick="verDetalles('${doc.id}')">Ver</button></td>
            </tr>
        `;
    });
}

async function cargarTablaFormularios() {
    const snapshot = await db.collection('formularios')
        .orderBy('fechaEnvio', 'desc')
        .limit(10)
        .get();
    
    const tbody = document.getElementById('tablaFormularios');
    tbody.innerHTML = '';
    
    snapshot.forEach((doc) => {
        const data = doc.data();
        tbody.innerHTML += `
            <tr>
                <td class="px-6 py-4">${data.conductor}</td>
                <td class="px-6 py-4">${new Date(data.fechaEnvio.toDate()).toLocaleString()}</td>
                <td class="px-6 py-4">${data.patente}</td>
                <td class="px-6 py-4">${data.estado}</td>
                <td class="px-6 py-4"><button onclick="descargarPDF('${doc.id}')">PDF</button></td>
            </tr>
        `;
    });
}
```

## 8. CONFIGURAR CLOUD FUNCTIONS (Emails automáticos)

### Crear función para emails

En Firebase Console > Cloud Functions > Crear función:

```javascript
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Configurar transporte de email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "tu-email@gmail.com",
    pass: "tu-app-password" // Usar App Password
  }
});

// Trigger: Nuevo formulario enviado
exports.enviarEmailGerencia = functions.firestore
  .document("formularios/{docId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    
    const config = await admin.firestore()
      .collection("configuracion")
      .doc("empresa")
      .get();
    
    const correosGerencia = config.data().correosGerencia;
    
    const mailOptions = {
      from: "acm-logistica@example.com",
      to: correosGerencia.join(","),
      subject: `[FORMULARIO] ${data.conductor} - ${new Date().toLocaleDateString()}`,
      html: `
        <h2>Nuevo Formulario Recibido</h2>
        <p><strong>Conductor:</strong> ${data.conductor}</p>
        <p><strong>Vehículo:</strong> ${data.patente}</p>
        <p><strong>Tipo:</strong> ${data.tipo}</p>
        <p><strong>Km:</strong> ${data.kilometraje}</p>
        <p><strong>Ubicación:</strong> ${data.latitud}, ${data.longitud}</p>
      `
    };
    
    return transporter.sendMail(mailOptions);
  });

// Scheduled: Email matutino diario (7:00 AM)
exports.emailMatutino = functions.pubsub
  .schedule("0 7 * * 1-6") // Lunes a sábado, 7 AM
  .timeZone("America/Santiago")
  .onRun(async (context) => {
    const conductoresSnap = await admin.firestore()
      .collection("conductores")
      .where("estado", "==", "activo")
      .get();
    
    const promises = [];
    
    conductoresSnap.forEach((doc) => {
      const conductor = doc.data();
      
      const mailOptions = {
        from: "acm-logistica@example.com",
        to: conductor.correo,
        subject: "Recordatorio: Completa tu control diario",
        html: `
          <h2>Hola ${conductor.nombre}</h2>
          <p>Es hora de completar tu formulario de control diario.</p>
          <p><a href="https://tu-dominio.cl/conductores/formulario.html">Completar Formulario</a></p>
        `
      };
      
      promises.push(transporter.sendMail(mailOptions));
    });
    
    return Promise.all(promises);
  });
```

## 9. DESPLEGAR A PRODUCCIÓN

### Opción 1: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Opción 2: Tu servidor (Hosting Plus)
1. Subir archivos HTML/JS a empresasbop.cl
2. Cambiar URLs de Firebase en los archivos

## 10. REGLAS DE SEGURIDAD EN PRODUCCIÓN

Reemplazar las reglas de prueba:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function esAdmin(uid) {
      return exists(/databases/$(database)/documents/administradores/$(uid));
    }
    
    function esConductor(uid) {
      return exists(/databases/$(database)/documents/conductores/$(uid));
    }
    
    match /conductores/{userId} {
      allow read: if request.auth.uid == userId || esAdmin(request.auth.uid);
      allow write: if false;
    }
    
    match /formularios/{docId} {
      allow read: if esAdmin(request.auth.uid);
      allow create: if esConductor(request.auth.uid) && request.resource.data.conductorId == request.auth.uid;
      allow update: if false;
      allow delete: if false;
    }
    
    match /administradores/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if false;
    }
    
    match /configuracion/{docId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

## 11. CHECKLIST FINAL

- [ ] Proyecto Firebase creado
- [ ] Firestore Database configurada
- [ ] Auth habilitada (Email/Contraseña)
- [ ] Colecciones creadas
- [ ] Reglas de seguridad aplicadas
- [ ] firebase-config.js actualizado con credenciales
- [ ] HTML con Firebase SDK agregado
- [ ] js/conductores.js actualizado
- [ ] js/formulario.js actualizado
- [ ] js/admin.js actualizado
- [ ] Cloud Functions desplegadas
- [ ] Emails configurados (nodemailer)
- [ ] Testear en local
- [ ] Desplegar a producción

---

**Ventajas de esta arquitectura:**
✓ Datos en tiempo real
✓ Escalable a 1000+ conductores
✓ Seguridad real
✓ Queries rápidas
✓ Automación con Cloud Functions
✓ Costo bajo (gratis hasta 50K lecturas/día)

**Costos mensuales (estimado):**
- Firestore: $0 - $10
- Storage: $0 - $5
- Cloud Functions: $0 - $5
- **Total: Gratis - $20/mes**
