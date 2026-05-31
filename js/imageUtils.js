import { log } from './logger.js';

const MAX_IMAGES = 3;
const MAX_SIZE_MB = 5;
const QUALITY = 0.4;
const MAX_WIDTH = 1280;

export const MAX_IMAGES_PER_NOTE = MAX_IMAGES;

/**
 * Comprime un File a WebP 40% usando Canvas API.
 * Devuelve un objeto con el Blob, metadatos y una URL temporal para previsualización.
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Tipo de archivo no válido')); return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      reject(new Error(`Máximo ${MAX_SIZE_MB}MB por imagen`)); return;
    }

    const img = new Image();
    const tempUrl = URL.createObjectURL(file);
    const cleanupTemp = () => URL.revokeObjectURL(tempUrl);
    img.addEventListener('load', cleanupTemp, { once: true });
    img.addEventListener('error', cleanupTemp, { once: true });
    img.onload = () => {
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const finalize = (blob, ext) => {
        const nombre = file.name.replace(/\.[^/.]+$/, '') + '-' + Date.now() + '.' + ext;
        const previewUrl = URL.createObjectURL(blob);
        // Trackear blob URL para revocación global posterior
        window.__enoteBlobUrls = window.__enoteBlobUrls || new Set();
        window.__enoteBlobUrls.add(previewUrl);
        const result = {
          id: crypto.randomUUID(),
          blob,
          url: previewUrl,
          width,
          height,
          nombre,
        };
        log.imageCompressed(file, result);
        resolve(result);
      };

      canvas.toBlob((blob) => {
        if (blob) { finalize(blob, 'webp'); return; }
        // Fallback: navegadores sin soporte WebP en toBlob (Safari iOS antiguo) → JPEG
        canvas.toBlob((jpegBlob) => {
          if (!jpegBlob) { reject(new Error('Error al generar el Blob de la imagen')); return; }
          finalize(jpegBlob, 'jpg');
        }, 'image/jpeg', 0.7);
      }, 'image/webp', QUALITY);
    };
    img.onerror = () => reject(new Error('Error al cargar imagen'));
    img.src = tempUrl;
  });
}
