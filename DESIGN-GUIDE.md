# Design Guide - ACM Logística

**Instrucciones críticas para desarrollo. RESPETAR AL PIE DE LA LETRA.**

## Tipografía

- **Títulos y Headers**: Space Grotesk (700 weight)
- **Cuerpo**: Inter (400-600 weight)
- **Tamaño títulos**: 24-36px
- **Tamaño cuerpo**: 14-18px

Igual que en la página web actual.

## Paleta de Colores Oficial

```
Primario (Turquesa):    #28A992
Secundario (Negro):     #0C0B0C
Terciario (Naranja):    #ce8900
Gris Neutro:            #A09793
Blanco:                 #FFFFFF
```

## Reglas de Emojis e Iconos

⚠️ **CRÍTICO**:
- ❌ NO usar emojis Unicode multicolores (😀 ❌)
- ✅ SOLO SVG personalizado de UN SOLO COLOR
- ✅ Usar Material Symbols como en la web (material-symbols-outlined)
- ✅ Si necesita iconos custom, deben ser SVG turquesa #28A992 o naranja #ce8900

Ejemplos válidos:
```html
<span class="material-symbols-outlined">local_shipping</span>
<svg class="w-6 h-6 fill-primary"><path d="..."/></svg>
```

## Framework CSS

- Usar **Tailwind CSS** (como en la web actual)
- Responsive mobile-first
- Clases compartidas en `/css/styles.css`

## Estructura HTML

Mantener consistencia visual con `index.html`:
- Headers: Stiky top
- Footers: Información corporativa
- Botones: Primario #28A992, hover effects
- Cards: Sombra sutil, border-top turquesa

## Flujo de Conductores

### Registro (conductores/registro.html)
- Campos: Nombre, Apellido, RUT, Correo, Contraseña
- Validación RUT
- Contraseña default: primeros 4 dígitos del RUT (generada automáticamente)
- Almacenar en Google Sheets

### Login (conductores/login.html)
- Campos: Correo + Contraseña
- Validación de credenciales contra Google Sheets
- Acceso SOLO al formulario diario

### Formulario (conductores/formulario.html)
Incluir acordeones para:
- Datos del Conductor (expandido)
- Datos del Vehículo (colapsado)
- Aseo y Revisiones (colapsado)
- Estado de Carrocería (colapsado)
- Equipo de Carretera (colapsado)
- Documentación (colapsado)
- Fotos Adicionales (colapsado)

Características:
- Captura de 3+ fotos
- Geolocalización GPS automática
- Al enviar: genera PDF + envía a gerentes + guarda en BD

## Flujo Administrativo

### Login Admin (admin/login.html)
- ⚠️ CRÍTICO: Solo emails @serviciosbop.cl
- Rechazar: gmail, hotmail, yahoo, etc
- Validación de dominio en backend

### Dashboard (admin/dashboard.html)
- Tabla: Conductores registrados
- Reportes: PDF con fotos
- Historial: Envíos por fecha
- Estadísticas: Conductores activos, formularios completados

## Backend (Google Apps Script)

### Funciones principales:
1. Guardar conductores en Google Sheets
2. Validar login (correo + contraseña)
3. Validar dominio corporativo (@serviciosbop.cl)
4. 7:00 AM (L-S): Enviar email recordatorio a conductores
5. Al enviar formulario: Generar PDF + enviar a gerentes
6. Guardar datos en Google Sheets

### Emails a:
- jefeoperaciones@serviciosbop.cl
- prevencion@serviciosbop.cl
- jhosbelevilla@gmail.com
- Alias: supervicion@serviciosbop.cl

## Responsive Design

- **Mobile** (320-768px): Full width, single column
- **Tablet** (768-1024px): 2 columnas donde aplique
- **Desktop** (1024px+): 3 columnas, max-width 1200px

## Componentes Reutilizables

- Botones: Primario (turquesa), Secundario (negro), Outline
- Cards: Con border-top turquesa
- Inputs: Con validación visual
- Accordions: Smooth animations
- Alerts: Turquesa para info, rojo para error

## Performance

- Lazy load de imágenes
- Minificar CSS/JS para producción
- Caché de imágenes para fotos capturadas

---

**Última actualización**: 2024
**Responsable**: ACM Logística Development Team
