# ACM Logística - Control Diario de Vehículos

Sistema web para registro de conductores, formulario diario de control vehicular y dashboard administrativo.

## Estructura del Proyecto

```
acm-logistica/
├── index.html (landing page pública)
├── conductores/
│   ├── registro.html (registro de conductores)
│   ├── login.html (login conductores)
│   └── formulario.html (formulario diario)
├── admin/
│   ├── login.html (login administrativo)
│   └── dashboard.html (panel administrativo)
├── css/
│   └── styles.css (estilos compartidos)
├── js/
│   ├── auth.js (autenticación)
│   ├── conductores.js (lógica conductores)
│   ├── admin.js (lógica admin)
│   └── utils.js (utilidades GPS, fotos, etc)
├── backend.gs (Google Apps Script)
├── DESIGN-GUIDE.md (guía de diseño)
└── README.md (este archivo)
```

## Características

- **Registro de conductores**: Nombre, Apellido, RUT, Correo, Contraseña
- **Formulario diario**: Control de vehículos con fotos y GPS
- **Dashboard admin**: Panel de control para administrativos
- **Email automático**: Recordatorio matutino 7:00 AM (L-S)
- **PDF automático**: Generación de reportes con fotos

## Requisitos

- Node.js 16+ (opcional, para desarrollo)
- Google Account (para Google Apps Script)
- Navegador moderno

## Instalación

1. Clonar repositorio
2. Abrir en VS Code
3. Configurar Google Apps Script (ver DESIGN-GUIDE.md)
4. Publicar en servidor

## Configuración

Ver `DESIGN-GUIDE.md` para detalles de tipografía, colores y componentes.

## Equipo

ACM Logística - 2024
