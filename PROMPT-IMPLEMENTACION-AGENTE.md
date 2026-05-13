# Prompt para Agente de Implementación

## Objetivo

Implementar la funcionalidad de imágenes adjuntas en notas de pedido para Enote (versión local, antes de migrar a Supabase).

## Archivos de Referencia

- **Plan detallado:** `PLAN-IMPLEMENTACION-IMAGENES.md` (leer primero)
- **Código actual del proyecto:**
  - `js/config.js` - Configuración y roles
  - `js/store.js` - CRUD de notas
  - `js/ui.js` - Renderizado de vistas
  - `js/app.js` - Orquestador y eventos
  - `css/main.css` - Estilos
  - `audit/audit.js` - Tests Playwright existentes

## Resumen del Scope

### Funcionalidad
- Subir hasta **3 imágenes por nota** desde formulario crear/editar
- Compresión automática **40% WebP**
- Selector de imágenes con botones "Imagen 1", "Imagen 2", "Imagen 3" en **vertical** al lado de la nota
- Previsualización **inline** (overlay sin cambiar de vista)
- Imágenes **no** aparecen en PDF al imprimir

### Roles
| Acción | Admin | Planta | Sucursal |
|--------|-------|--------|----------|
| Crear imágenes | ✅ | ❌ | ✅ |
| Editar imágenes | ✅ | ❌ | ✅ |
| Eliminar imágenes | ✅ | ❌ | ✅ |
| Ver imágenes | ✅ | ✅ | ✅ |

## Pasos de Implementación

### 1. Pre-requisitos: Agregar Rol Sucursal

**En `js/config.js`:**
- Agregar usuario: `{ username: 'sucursal1', password: 'pass', role: 'sucursal', destino: 'Sucursal' }`
- Agregar rol: `sucursal: { canCreate: true, canEdit: true, canDelete: true, canSeeAll: false }`

### 2. Crear Módulo de Compresión

**Crear `js/imageUtils.js`:**
- Función `compressImage(file)` - Comprime a WebP 40%, redimensiona a máximo 1920px
- Función `validateImages(files)` - Valida tipo y límite de 3 imágenes

### 3. Modificar `js/store.js`

- Agregar campo `imagenes: []` en `createNote()`
- Agregar lógica para actualizar `imagenes` en `updateNote()`

### 4. Modificar `js/ui.js`

**En `renderNoteForm()`:**
- Agregar sección de upload de imágenes después de observaciones
- Mostrar thumbnails de imágenes existentes con botón de eliminar

**En `renderDetailView()`:**
- Agregar botones "Imagen 1/2/3" en columna vertical al lado del contenido
- Agregar contenedor para overlay de previsualización

### 5. Modificar `js/app.js`

**En `handleFormSubmit()`:**
- Procesar imágenes async antes de guardar nota

**En `handleDetailClick()`:**
- Agregar evento click para botones de selector de imagen
- Crear función `showImagePreview(index)` que muestre overlay inline

### 6. Agregar Estilos CSS

**En `css/main.css`:**
- `.image-previews` - Grid de thumbnails en formulario
- `.image-preview-item` - Contenedor de cada thumbnail
- `.image-selector-column` - Columna vertical de botones
- `.image-preview-overlay` - Overlay para previsualización inline

### 7. Testing con Playwright

**Agregar casos en `audit/audit.js`:**
1. Admin sube imagen
2. Admin elimina imagen
3. Sucursal sube imagen
4. Sucursal elimina imagen
5. Planta ve imagen
6. Previsualización inline abre/cierra
7. Límite 3 imágenes
8. Persistencia tras recargar página
9. PDF sin imágenes

**Ejecutar:** `cd audit && npm run audit`

## Validación Final

Antes de terminar, verificar:
- [ ] Login con sucursal1/pass funciona
- [ ] Admin crea nota con imagen → aparece botón "Imagen 1" en detalle
- [ ] Admin edita y elimina imagen → botón desaparece
- [ ] Sucursal puede crear/eliminar imágenes
- [ ] Planta ve imágenes pero no puede editarlas
- [ ] Click en "Imagen 1" abre previsualización inline
- [ ] Click fuera de imagen cierra previsualización
- [ ] Al imprimir nota, las imágenes NO aparecen
- [ ] Todos los tests Playwright pasan

## Notas Importantes

- Este es código **v1.0 local**, sin Supabase
- Las imágenes se guardan como dataURL en localStorage
- Las URLs de Blob deben limpiarse para evitar memory leaks
- La estética debe coincidir con el proyecto (colores, fuentes, estilos)

---

** Ejecutar implementación siguiendo el plan `PLAN-IMPLEMENTACION-IMAGENES.md` **