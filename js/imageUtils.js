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

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Error al generar el Blob de la imagen'));
          return;
        }

        const nombre = file.name.replace(/\.[^/.]+$/, '') + '-' + Date.now() + '.webp';
        const result = {
          id: crypto.randomUUID(),
          blob,
          url: URL.createObjectURL(blob), // URL temporal para previsualización en el DOM
          width,
          height,
          nombre,
        };
        log.imageCompressed(file, result);
        resolve(result);
      }, 'image/webp', QUALITY);
    };
    img.onerror = () => reject(new Error('Error al cargar imagen'));
    img.src = URL.createObjectURL(file);
  });
}
