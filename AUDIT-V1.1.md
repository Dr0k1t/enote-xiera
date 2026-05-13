# Auditoría Técnica: Proyecto Enote Xiera (v1.1)

Este documento presenta una auditoría exhaustiva del estado actual del proyecto previo a la migración a la versión 1.2 (Full Web / Supabase).

---

## 1. Fortalezas (Lo que está bien)

### A. Arquitectura Modular y Desacoplada
- **Punto:** El uso de Módulos ES (ESM) nativos sin necesidad de bundlers (Vite/Webpack) es excelente para la simplicidad actual.
- **Justificación:** La separación clara entre `store.js` (datos), `auth.js` (seguridad), `ui.js` (renderizado) y `app.js` (lógica de negocio) facilitará enormemente la migración. Solo será necesario reemplazar las implementaciones internas de `store` y `auth` sin afectar el resto de la aplicación.

### B. Seguridad contra XSS
- **Punto:** Implementación sistemática de la función `esc()` en `ui.js`.
- **Justificación:** Al construir el HTML mediante strings, el riesgo de inyección de scripts es alto. El uso consistente de escape para cada entrada de usuario demuestra una buena práctica de seguridad preventiva.

### C. Flujo de Trabajo y RBAC (Control de Acceso Basado en Roles)
- **Punto:** El sistema de permisos y estados de las notas está bien definido en `config.js` y `auth.js`.
- **Justificación:** La lógica de "Planta de Producción" vs "Sucursales" y los flags de `unreadNew`/`unreadModified` reflejan un entendimiento profundo del proceso de negocio real de Xiera.

### D. Optimización de Recursos Locales
- **Punto:** Compresión de imágenes a WebP 40% antes de guardar en Base64.
- **Justificación:** Es una solución ingeniosa para maximizar el uso del limitado espacio de `localStorage` (5MB) en una fase de demo/prototipo.

---

## 2. Áreas de Mejora (Debilidades)

### A. Persistencia Volátil y Limitada
- **Punto:** Dependencia total de `localStorage`.
- **Justificación:** 
    1. **Límite de Espacio:** Las imágenes en Base64 llenarán los 5MB rápidamente.
    2. **Seguridad:** Los datos son legibles por cualquier script en el mismo origen.
    3. **Persistencia:** Si el usuario limpia la caché o cambia de navegador, pierde todo. 
    *Recomendación:* Urgente migración a Supabase (PostgreSQL + Storage).

### B. Sincronía y Concurrencia
- **Punto:** El estado es puramente local con un listener de `storage` para sincronía entre pestañas.
- **Justificación:** No hay una "fuente de verdad" centralizada. Si dos usuarios editan la misma nota simultáneamente en el futuro web, habrá colisiones.
    *Recomendación:* Implementar Supabase Realtime en v1.2.

### C. Mantenibilidad del Renderizado (UI)
- **Punto:** `ui.js` y `app.js` están creciendo demasiado (>20KB cada uno).
- **Justificación:** La manipulación manual del DOM y el uso de templates como strings se vuelve difícil de depurar y escalar. 
    *Recomendación:* Evaluar el uso de componentes funcionales más pequeños o una librería ligera (como Lit o Preact) si la complejidad sigue aumentando, aunque para este proyecto una mejor división de archivos podría bastar.

### D. Accesibilidad (a11y) y Semántica HTML
- **Punto:** Uso excesivo de `div` y `span` para elementos interactivos.
- **Justificación:** La falta de etiquetas semánticas (`main`, `section`, `article`) y atributos ARIA dificulta el uso de lectores de pantalla y navegación por teclado.
    *Recomendación:* Refactorizar templates para usar etiquetas semánticas y asegurar que todos los botones tengan el rol adecuado.

---

## 3. Justificación de la Auditoría (Hacia v1.2)

La auditoría confirma que el proyecto tiene una **base sólida y profesional**. El código es limpio, sigue convenciones modernas y tiene una lógica de negocio robusta. 

Sin embargo, el paso a **"Full Web"** no es solo mover archivos a un servidor; requiere un cambio de paradigma de "Síncrono/Local" a "Asíncrono/Global".

### Riesgos Críticos Identificados:
1. **Pérdida de datos:** Sin una base de datos centralizada, la integridad de las notas de remisión (que son documentos financieros/operativos) está en riesgo.
2. **Experiencia Offline:** El ROADMAP v1.2 menciona PWA. La arquitectura actual de `store.js` debe ser reescrita para manejar promesas (`async/await`) y una cola de sincronización (IndexedDB).

---

## 4. Recomendaciones Prioritarias

1. **Promisificación de la Capa de Datos:** Cambiar todas las funciones de `store.js` para que devuelvan `Promise`. Esto permitirá que la UI esté lista para la latencia de la red antes de conectar Supabase.
2. **Separación de Configuración:** Mover las claves de API y URLs de servidor a un archivo de entorno o una estructura de configuración más segura.
3. **Refactor de UI:** Dividir `ui.js` en sub-módulos (ej. `ui/dashboard.js`, `ui/forms.js`, `ui/shared.js`).
4. **Implementación de Auditoría Interna:** Aprovechar el directorio `audit/` para añadir tests que verifiquen la integridad de los datos después de operaciones CRUD asíncronas.

**Resultado Final:** El proyecto está **APTO** para iniciar la migración v1.2, siempre y cuando se priorice la estabilidad de la capa de persistencia asíncrona.
