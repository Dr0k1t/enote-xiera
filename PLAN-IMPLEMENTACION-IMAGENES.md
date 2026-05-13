# Plan de Implementación: Imágenes Adjuntas en Notas de Pedido

> **Versión:** 1.0 Local (antes de migración a Supabase)
> **Fecha:** 2026-05-13
> **Proyecto:** Enote - Xiera

---

## 1. Resumen del Proyecto

Agregar funcionalidad para subir, visualizar y eliminar imágenes en notas de pedido.

### Objetivos Principales
- Subir hasta **3 imágenes por nota** desde el formulario de crear/editar
- Compresión automática (40% WebP) antes de guardar en localStorage
- Ver imágenes en vista detalle con selector de botones verticales
- Previsualización inline (sin cambiar de vista)
- Las imágenes **no** aparecen en el PDF al imprimir

### Roles con Acceso
- **Admin**: Crear, editar, eliminar, ver imágenes
- **Planta**: Solo ver imágenes (no puede crear/editar)
- **Sucursal**: Crear, editar, eliminar, ver imágenes

---

## 2. Pre-requisitos: Agregar Rol Sucursal

### 2.1. Editar `js/config.js`

**Ubicación:** Líneas 14-22

**Cambio requerido:** Agregar usuario demo y rol sucursal

```javascript
// Reemplazar la sección de users y roles existente:

users: [
  { username: 'admin1',  password: 'pass', role: 'admin',  destino: null },
  { username: 'planta1', password: 'pass', role: 'planta', destino: 'Planta de Producción' },
  { username: 'sucursal1', password: 'pass', role: 'sucursal', destino: 'Sucursal' },
],

roles: {
  admin:   { canCreate: true,  canEdit: true,  canDelete: true,  canSeeAll: true },
  planta:  { canCreate: false, canEdit: false, canDelete: false, canSeeAll: false },
  sucursal:{ canCreate: true,  canEdit: true,  canDelete: true,  canSeeAll: false },
},
```

**Verificar en `js/auth.js`:**
- La función `canCreate(session)` debe retornar `true` para rol 'sucursal'
- La función `canEdit(session)` debe retornar `true` para rol 'sucursal'
- La función `canDelete(session)` debe retornar `true` para rol 'sucursal'

---

## 3. Estructura de Datos

### 3.1. Campo en Notas (localStorage)

Las notas tendrán un nuevo campo `imagenes`:

```javascript
{
  id: 1,
  numero: "#0001",
  fecha: "2026-05-13",
  destino: "Planta de Producción",
  productos: [...],
  observaciones: "...",
  estatus: "Nueva",
  // ... otros campos existentes
  imagenes: [
    {
      id: "uuid-1234",
      url: "data:image/webp;base64,...",
      size: 45000,
      width: 800,
      height: 600,
      nombre: "imagen1.webp"
    },
    // Hasta 3 objetos
  ]
}
```

### 3.2. Ubicaciones en el Código

**`js/store.js` - createNote():**
- Línea ~26-48: Agregar `imagenes: []` al objeto nota

**`js/store.js` - updateNote():**
- Línea ~51-83: Agregar lógica para actualizar campo `imagenes`

---

## 4. Módulo de Compresión de Imágenes

### 4.1. Crear `js/imageUtils.js`

Crear un nuevo archivo con la lógica de compresión (basado en `sandbox/image-compress.js`):

```javascript
// js/imageUtils.js

const MAX_IMAGES = 3;
const MAX_SIZE_MB = 5;
const QUALITY = 0.4; // 40%
const MAX_WIDTH = 1920;

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      reject(new Error('Tipo de archivo no válido'));
      return;
    }
    // Validar tamaño
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      reject(new Error(`Máximo ${MAX_SIZE_MB}MB por imagen`));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionar si es necesario
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        
        // Comprimir con Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Error al comprimir'));
            return;
          }
          
          const url = URL.createObjectURL(blob);
          resolve({
            id: crypto.randomUUID(),
            url,
            size: blob.size,
            width,
            height,
            nombre: file.name.replace(/\.[^/.]+$/, '') + '.webp'
          });
        }, 'image/webp', QUALITY);
      };
      img.onerror = () => reject(new Error('Error al cargar imagen'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsDataURL(file);
  });
}

export function validateImages(files) {
  const errors = [];
  if (files.length > MAX_IMAGES) {
    errors.push(`Máximo ${MAX_IMAGES} imágenes permitidas`);
  }
  return errors;
}

export function cleanImageUrls() {
  // Función para limpiar URLs al cerrar modales
  // Implementar según necesidad
}
```

---

## 5. Modificaciones en UI

### 5.1. Editar `js/ui.js`

#### A. renderNoteForm() - Agregar sección de upload

**Ubicación:** Línea ~247-316 (aproximadamente)

**Agregar después del campo observaciones:**

```javascript
// En renderNoteForm(), después del textarea de observaciones:

const r = role(session);
const canUpload = r.canCreate || r.canEdit;

// Si es edición, mostrar imágenes existentes
const existingImages = isEdit && note.imagenes ? note.imagenes : [];
const imagePreviews = existingImages.map((img, idx) => `
  <div class="image-preview-item" data-image-index="${idx}">
    <img src="${img.url}" alt="Imagen ${idx + 1}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;">
    ${canUpload ? `<button type="button" class="btn-remove-image" data-index="${idx}">✕</button>` : ''}
  </div>
`).join('');

// Input para subir nuevas imágenes
const imageUploadInput = canUpload ? `
  <div class="form-group">
    <label class="form-label">Imágenes (máx 3)</label>
    <input type="file" id="nf-imagenes" name="imagenes" accept="image/*" multiple class="form-input">
    <div class="image-previews" id="image-previews">${imagePreviews}</div>
    <p style="font-size:0.75rem;color:var(--color-text-muted)">Se comprimirán automáticamente a WebP 40%</p>
  </div>
` : '';
```

**Agregar al HTML del formulario (antes del closing `</form>`):**
```javascript
// Insertar ${imageUploadInput} después del campo observaciones
```

#### B. renderDetailView() - Agregar selector vertical de imágenes

**Ubicación:** Línea ~337-430 (aproximadamente)

**Agregar al layout del detail:**

```javascript
// Después de la sección de observaciones, antes del footer:

const imageButtons = note.imagenes && note.imagenes.length > 0
  ? note.imagenes.map((img, idx) => `
      <button type="button" class="btn btn-ghost btn-sm image-selector-btn" data-image-index="${idx}">
        Imagen ${idx + 1}
      </button>
    `).join('')
  : '';

const imageSelectorSection = imageButtons
  ? `<div class="image-selector-column">${imageButtons}</div>`
  : '';

// Agregar al HTML: agregar clase "detail-body-with-images" y estructura:

/*
<div class="detail-content-wrapper" style="display:flex;gap:var(--space-5)">
  <div class="detail-main-content" style="flex:1">
    ... contenido actual ...
  </div>
  ${imageSelectorSection}
</div>
*/
```

### 5.2. Editar `js/app.js`

#### A. handleFormSubmit() - Procesar imágenes

**Ubicación:** Línea ~299-333

**Agregar lógica para procesar imágenes:**

```javascript
function handleFormSubmit(action) {
  const fields = getFormData();
  if (!fields || !validateForm(fields)) return;
  
  // NUEVO: Procesar imágenes
  const imageInput = document.getElementById('nf-imagenes');
  if (imageInput && imageInput.files.length > 0) {
    // Validar límite
    if (imageInput.files.length > 3) {
      renderToast('Máximo 3 imágenes permitidas', 'error');
      return;
    }
    // Las imágenes se procesarán async después
    // Por ahora, guardar referencia en fields
  }
  
  // ... resto del código existente
}
```

**NOTA:** La implementación async de compresión de imágenes debe integrarse en `handleFormSubmit` de forma que espere a que todas las imágenes estén comprimidas antes de guardar la nota.

#### B. handleDetailClick() - Eventos de selección de imágenes

**Ubicación:** Línea ~281-289

**Agregar manejo de clicks en botones de imagen:**

```javascript
function handleDetailClick(e) {
  if (e.target.closest('.btn-volver'))   { showDashboard(); return; }
  if (e.target.closest('.btn-imprimir')) { window.print(); return; }
  if (e.target.closest('.btn-editar')) {
    const btn = e.target.closest('.btn-editar');
    showForm(parseInt(btn.dataset.noteId));
    return;
  }
  
  // NUEVO: Selector de imágenes
  if (e.target.closest('.image-selector-btn')) {
    const btn = e.target.closest('.image-selector-btn');
    const index = parseInt(btn.dataset.imageIndex);
    showImagePreview(index);
    return;
  }
}

function showImagePreview(index) {
  const note = getNote(editingNoteId); // Necesitas guardar el noteId actual
  if (!note || !note.imagenes || !note.imagenes[index]) return;
  
  const img = note.imagenes[index];
  const overlay = document.createElement('div');
  overlay.className = 'image-preview-overlay';
  overlay.innerHTML = `
    <div class="image-preview-container">
      <button class="btn btn-ghost btn-close-preview" style="position:absolute;top:10px;right:10px;">✕</button>
      <img src="${img.url}" alt="Imagen ${index + 1}" style="max-width:90vw;max-height:90vh;">
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Cerrar al hacer click fuera
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  // Cerrar con botón
  overlay.querySelector('.btn-close-preview').addEventListener('click', () => {
    overlay.remove();
  });
}
```

---

## 6. Estilos CSS

### 6.1. Editar `css/main.css`

Agregar los siguientes estilos:

```css
/* === IMAGE UPLOAD (Form) === */
.image-previews {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.image-preview-item {
  position: relative;
  display: inline-block;
}

.image-preview-item .btn-remove-image {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #c0392b;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}

#nf-imagenes {
  padding: var(--space-2);
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

/* === IMAGE SELECTOR (Detail View) === */
.image-selector-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 100px;
}

.image-selector-column .btn {
  justify-content: flex-start;
  text-align: left;
}

/* === IMAGE PREVIEW OVERLAY === */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(44, 24, 16, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.image-preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.image-preview-container img {
  display: block;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-modal);
}
```

---

## 7. Permisos por Rol (Resumen)

| Acción | Admin | Planta | Sucursal |
|--------|-------|--------|----------|
| Subir imágenes (crear) | ✅ | ❌ | ✅ |
| Subir imágenes (editar) | ✅ | ❌ | ✅ |
| Eliminar imágenes | ✅ | ❌ | ✅ |
| Ver imágenes (detalle) | ✅ | ✅ | ✅ |

---

## 8. Testing con Playwright

### 8.1. Editar `audit/audit.js`

Agregar los siguientes casos de prueba:

```javascript
// Agregar después de los tests existentes:

// Test 1: Admin sube imagen
async function testAdminUploadImage() {
  await page.goto(URL);
  await page.fill('#inp-user', 'admin1');
  await page.fill('#inp-pass', 'pass');
  await page.click('button[type="submit"]');
  
  await page.click('.btn-nueva');
  // Llenar formulario...
  // Subir imagen
  const fileInput = await page.locator('#nf-imagenes');
  await fileInput.setInputFiles('./docs/ref_prueba.jpeg');
  await page.click('button[data-action="save"]');
  
  // Verificar en detalle
  await page.click('.btn-ver');
  await page.waitForSelector('.image-selector-btn');
  const btnText = await page.textContent('.image-selector-btn');
  if (!btnText.includes('Imagen 1')) throw new Error('Imagen no aparece');
}

// Test 2: Admin elimina imagen
async function testAdminDeleteImage() {
  // Login admin, ir a nota con imagen, editar, eliminar imagen, guardar
  // Verificar que no aparece botón en detalle
}

// Test 3: Sucursal sube imagen
async function testSucursalUploadImage() {
  await page.goto(URL);
  await page.fill('#inp-user', 'sucursal1');
  await page.fill('#inp-pass', 'pass');
  await page.click('button[type="submit"]');
  // Similar a test 1
}

// Test 4: Sucursal elimina imagen
async function testSucursalDeleteImage() {
  // Login sucursal, editar nota, eliminar imagen, guardar
}

// Test 5: Planta ve imagen
async function testPlantaViewImage() {
  await page.goto(URL);
  await page.fill('#inp-user', 'planta1');
  await page.fill('#inp-pass', 'pass');
  await page.click('button[type="submit"]');
  
  await page.click('.btn-ver');
  await page.click('.image-selector-btn');
  
  // Verificar que aparece overlay
  await page.waitForSelector('.image-preview-overlay');
}

// Test 6: Previsualización inline
async function testImagePreviewInline() {
  // Click botón -> abre preview
  // Click fuera -> cierra
}

// Test 7: Límite 3 imágenes
async function testMaxImagesLimit() {
  // Intentar subir 4 imágenes -> debe mostrar error
}

// Test 8: Persistencia
async function testImagePersistence() {
  // Crear nota con imagen, recargar página, verificar imagen
}

// Test 9: PDF sin imágenes
async function testPDFWithoutImages() {
  // Imprimir nota con imagen
  // Verificar que no aparecen en el print
}
```

### 8.2. Ejecutar Tests

```bash
cd audit
npm run audit
```

---

## 9.不走验证 de Implementación

Antes de marcar como completado, verificar:

- [ ] Rol sucursal agregado y funciona login
- [ ] Admin puede crear nota con imagen
- [ ] Admin puede editar y eliminar imagen
- [ ] Sucursal puede crear nota con imagen
- [ ] Sucursal puede editar y eliminar imagen
- [ ] Planta puede ver imagen en detalle
- [ ] Botones "Imagen 1/2/3" aparecen en vertical al lado de la nota
- [ ] Click en botón abre previsualización inline
- [ ] Click fuera cierra previsualización
- [ ] Compresión WebP 40% aplicada
- [ ] Límite de 3 imágenes validado
- [ ] Tests Playwright pasan
- [ ] PDF al imprimir no incluye imágenes

---

## 10. Notas Adicionales

1. **localStorage**: Las imágenes se almacenan como dataURL, lo cual puede ocupar mucho espacio. Para producción (v1.2), se usará Supabase Storage.

2. **Memoria**: Las URLs creadas con `URL.createObjectURL` deben revocarse cuando ya no sean necesarias para evitar memory leaks.

3. **Siguiente paso**: Después de implementar y testear localmente, migrar a Supabase donde las imágenes se almacenarán en buckets de Storage.

---

*Documento generado para implementación por agente de programación.*
*Fecha: 2026-05-13*