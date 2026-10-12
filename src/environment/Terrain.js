import * as THREE from 'three';
import { createSpeckleTexture } from './textures.js';

export const WORLD_SIZE = 80000; // metres, square, centred on the airbase
const SEGMENTS = 400;            // ~200 m cells
const DETAIL_TILE_METRES = 40;

// ---------------------------------------------------------------------------
// Deterministic value-noise helpers (no dependencies)
// ---------------------------------------------------------------------------
function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, z, octaves) {
  let sum = 0, amp = 0.5, norm = 0, freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm; // 0..1
}

const smoothstep = THREE.MathUtils.smoothstep;

/**
 * Ground height in metres at world position (x, z).
 * Exactly 0 inside the airbase zone so the runway sits on perfectly flat ground.
 * Shared by terrain rendering, camera ground clamp and (later) collision/crash logic.
 */
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z * 0.6);                  // elongated along the runway axis
  const t = smoothstep(d, 1600, 4500);               // 0 = airbase, 1 = open country
  if (t <= 0) return 0;

  const base = fbm(x * 0.00011 + 11.3, z * 0.00011 + 7.1, 4);
  const mountains = Math.pow(Math.max(0, base - 0.5) / 0.3, 1.6) * 2400;
  const rolling = fbm(x * 0.0009, z * 0.0009, 3) * 90;
  const detail = fbm(x * 0.006, z * 0.006, 2) * 6;
  return (mountains + rolling + detail) * t;
}

// ---------------------------------------------------------------------------
const grassA = new THREE.Color(0.055, 0.12, 0.03);
const grassB = new THREE.Color(0.09, 0.15, 0.04);
const rock = new THREE.Color(0.16, 0.14, 0.12);
const snow = new THREE.Color(0.75, 0.78, 0.82);

export class Terrain {
  constructor(maxAnisotropy = 4) {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    }
    geo.computeVertexNormals();

    const nrm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
      const slope = 1 - nrm.getY(i);
      const patch = fbm(x * 0.0004, z * 0.0004, 3);

      c.copy(grassA).lerp(grassB, patch);
      const rockT = Math.max(smoothstep(h, 450, 1100), smoothstep(slope, 0.1, 0.32));
      c.lerp(rock, rockT);
      const snowT = smoothstep(h, 1500, 1950) * (1 - smoothstep(slope, 0.22, 0.45));
      c.lerp(snow, snowT);

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const detail = createSpeckleTexture({ base: 235, variance: 28, density: 0.6, seed: 7, anisotropy: maxAnisotropy });
    detail.repeat.set(WORLD_SIZE / DETAIL_TILE_METRES, WORLD_SIZE / DETAIL_TILE_METRES);

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: detail,
      roughness: 1,
      metalness: 0,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'Terrain';
    this.mesh.receiveShadow = true;
  }

  heightAt(x, z) {
    return terrainHeight(x, z);
  }
}
