import * as THREE from 'three';

/**
 * Small tileable greyscale speckle texture (generated on a canvas, no asset files).
 * Used as a detail map that multiplies with material / vertex colours.
 */
export function createSpeckleTexture({
  size = 256,
  base = 200,
  variance = 40,
  density = 0.5,
  seed = 1,
  anisotropy = 4,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, size, size);

  let s = seed >>> 0;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;

  const count = Math.floor(size * size * density);
  for (let i = 0; i < count; i++) {
    const v = Math.max(0, Math.min(255, base + (rnd() - 0.5) * 2 * variance)) | 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}
