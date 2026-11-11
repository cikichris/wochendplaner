// Bilder vor dem Hochladen verkleinern (spart Speicher und Datenvolumen).
// Erzeugt eine große Version und eine kleine Vorschau als JPEG.
// Nebeneffekt: Metadaten wie der GPS-Ort werden dabei entfernt.

const FULL_MAX = 2000;
const THUMB_MAX = 480;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden.')); };
    img.src = url; // Browser drehen das Bild dabei automatisch richtig herum
  });
}

function draw(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve({ blob, w, h }) : reject(new Error('Bild konnte nicht umgewandelt werden.'))), 'image/jpeg', quality);
  });
}

export async function prepareImage(file) {
  const { img, url } = await loadImage(file);
  try {
    const full = await draw(img, FULL_MAX, 0.85);
    const thumb = await draw(img, THUMB_MAX, 0.8);
    return { full: full.blob, thumb: thumb.blob, width: full.w, height: full.h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
