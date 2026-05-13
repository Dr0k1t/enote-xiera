const MAX_IMAGES = 5;
const TEST_IMAGE = 'ref_prueba.jpeg';
const MAX_WIDTH = 1920; // Límite para redimensionamiento

let uploadedImages = [];
let logOutput = [];
let objectUrls = []; // Registro para evitar memory leaks

/**
 * Registra URLs creadas para liberar memoria posteriormente
 */
function trackUrl(url) {
    objectUrls.push(url);
    return url;
}

/**
 * Libera memoria RAM asignada a los Blobs
 */
function clearMemory() {
    objectUrls.forEach(URL.revokeObjectURL);
    objectUrls = [];
    uploadedImages = [];
    document.getElementById('comparisonsContainer').innerHTML = '';
    updateUploadedCount();
    log('♻️ Memoria de imágenes liberada', 'info');
}

function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    logOutput.push(line);
    console.log(line);

    const logEl = document.getElementById('log');
    if (logEl) {
        // Previene XSS evitando innerHTML directo con datos dinámicos
        const span = document.createElement('span');
        span.className = type;
        span.textContent = line;
        logEl.appendChild(span);
        logEl.appendChild(document.createElement('br'));
        logEl.scrollTop = logEl.scrollHeight;
    }
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function calculateReduction(original, compressed) {
    return ((1 - compressed / original) * 100).toFixed(1);
}

/**
 * Comprime y redimensiona usando Canvas API y Blobs
 */
async function compressImage(img, quality, format = 'image/webp') {
    const canvas = document.createElement('canvas');
    let width = img.naturalWidth;
    let height = img.naturalHeight;

    if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Fallo en la generación del Blob'));
            
            const url = trackUrl(URL.createObjectURL(blob));
            resolve({
                blob, // <- Objeto listo para Supabase Storage
                url,
                size: blob.size,
                width,
                height
            });
        }, format, quality);
    });
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Error cargando imagen`));
        img.src = url;
    });
}

/**
 * Procesa el upload eliminando carga de Base64 en memoria
 */
async function handleImageUpload(input) {
    const files = Array.from(input.files);

    if (files.length === 0) return;

    if (uploadedImages.length + files.length > MAX_IMAGES) {
        log(`⚠️ Máximo ${MAX_IMAGES} permitidas. Actualmente: ${uploadedImages.length}`, 'error');
        return;
    }

    log('═══════════════════════════════════════════════════════════', 'info');
    log(`📤 PROCESANDO ${files.length} IMAGEN(ES) (Format: WebP)`, 'info');

    for (const file of files) {
        try {
            log(`📄 Procesando: ${file.name} (${formatBytes(file.size)})`, 'info');

            // Uso directo de objeto sin pasar por FileReader (Base64)
            const originalUrl = trackUrl(URL.createObjectURL(file));
            const img = await loadImage(originalUrl);

            const result60 = await compressImage(img, 0.6, 'image/webp');
            const result40 = await compressImage(img, 0.4, 'image/webp');

            const reduction60 = calculateReduction(file.size, result60.size);
            const reduction40 = calculateReduction(file.size, result40.size);

            const imageData = {
                name: file.name,
                originalUrl,
                originalSize: file.size,
                width: img.naturalWidth,
                height: img.naturalHeight,
                result60,
                result40,
                reduction60,
                reduction40
            };

            uploadedImages.push(imageData);

            log(`   ✅ Original: ${formatBytes(file.size)} (${img.naturalWidth}x${img.naturalHeight})`, 'info');
            log(`   → 60%: ${formatBytes(result60.size)} (${reduction60}% ↓) [${result60.width}x${result60.height}]`, 'success');
            log(`   → 40%: ${formatBytes(result40.size)} (${reduction40}% ↓) [${result40.width}x${result40.height}]`, 'success');

            displayComparison(imageData);

        } catch (error) {
            log(`❌ Error procesando ${file.name}: ${error.message}`, 'error');
        }
    }

    updateUploadedCount();
    input.value = ''; // Limpiar input
}

function updateUploadedCount() {
    const countEl = document.getElementById('uploadedCount');
    if (countEl) {
        countEl.textContent = `Imágenes: ${uploadedImages.length}/${MAX_IMAGES}`;
    }
}

function displayComparison(imageData) {
    const container = document.getElementById('comparisonsContainer');
    if (!container) return;

    const comparisonDiv = document.createElement('div');
    comparisonDiv.className = 'comparison-block';
    comparisonDiv.style.cssText = 'margin-bottom: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px;';

    // Se usan las URLs de Blob, no Base64
    comparisonDiv.innerHTML = `
        <h3 style="color: #7A3045; margin-bottom: 15px;" class="img-title"></h3>
        <div class="comparison" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div class="image-card">
                <h4 style="margin: 5px 0;">Original</h4>
                <img src="${imageData.originalUrl}" style="max-width: 100%; border: 1px solid #ccc; max-height: 200px;">
                <p style="font-size: 12px; color: #666;">${formatBytes(imageData.originalSize)}</p>
            </div>
            <div class="image-card">
                <h4 style="margin: 5px 0;">60% (WebP)</h4>
                <img src="${imageData.result60.url}" style="max-width: 100%; border: 1px solid #ccc; max-height: 200px;">
                <p style="font-size: 12px; color: #666;">${formatBytes(imageData.result60.size)} (${imageData.reduction60}% ↓)</p>
            </div>
            <div class="image-card">
                <h4 style="margin: 5px 0;">40% (WebP)</h4>
                <img src="${imageData.result40.url}" style="max-width: 100%; border: 1px solid #ccc; max-height: 200px;">
                <p style="font-size: 12px; color: #666;">${formatBytes(imageData.result40.size)} (${imageData.reduction40}% ↓)</p>
            </div>
        </div>
    `;

    // Asignación segura del texto dinámico
    comparisonDiv.querySelector('.img-title').textContent = `📷 ${imageData.name} (${imageData.width}x${imageData.height})`;
    
    container.appendChild(comparisonDiv);
}

async function runTest() {
    log('═══════════════════════════════════════════════════════════', 'info');
    log('🖼️ INICIANDO TEST DE REFERENCIA', 'info');

    try {
        const img = await loadImage(TEST_IMAGE);
        log(`✅ Imagen cargada: ${img.naturalWidth}x${img.naturalHeight}px`, 'success');

        // Renderizado inicial para obtener el Blob "Original" simulado y su tamaño exacto
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.naturalWidth;
        tempCanvas.height = img.naturalHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(img, 0, 0);

        const originalBlob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/jpeg', 1.0));
        const originalSize = originalBlob.size;
        const originalUrl = trackUrl(URL.createObjectURL(originalBlob));

        const result60 = await compressImage(img, 0.6, 'image/webp');
        const result40 = await compressImage(img, 0.4, 'image/webp');

        const reduction60 = calculateReduction(originalSize, result60.size);
        const reduction40 = calculateReduction(originalSize, result40.size);

        log('┌─────────────────────┬────────────────┬─────────────┐', 'info');
        log('│ Tipo                │ Tamaño         │ Reducción   │', 'info');
        log('├─────────────────────┼────────────────┼─────────────┤', 'info');
        log(`│ Original (JPEG)     │ ${formatBytes(originalSize).padEnd(14)} │      -      │`, 'info');
        log(`│ 60% (WebP)          │ ${formatBytes(result60.size).padEnd(14)} │ ${reduction60.padStart(8)}%   │`, 'info');
        log(`│ 40% (WebP)          │ ${formatBytes(result40.size).padEnd(14)} │ ${reduction40.padStart(8)}%   │`, 'info');
        log('└─────────────────────┴────────────────┴─────────────┘', 'info');

        const imageData = {
            name: TEST_IMAGE,
            originalUrl,
            originalSize,
            width: img.naturalWidth,
            height: img.naturalHeight,
            result60,
            result40,
            reduction60,
            reduction40
        };

        displayComparison(imageData);

    } catch (error) {
        log(`❌ ERROR: ${error.message}`, 'error');
    }
}

function clearLog() {
    logOutput = [];
    const logEl = document.getElementById('log');
    if (logEl) logEl.innerHTML = '';
    log('🗑️ Log limpiado', 'info');
}

function downloadLog() {
    if (logOutput.length === 0) return log('⚠️ Log vacío', 'error');

    const blob = new Blob([logOutput.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resultados.log';
    a.click();
    URL.revokeObjectURL(url);
}

// Opcional: Agregar botón en UI para invocar clearMemory()
log('🖼️ Image Compress Test v1.2 Ready', 'info');