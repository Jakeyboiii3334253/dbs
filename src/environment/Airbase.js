import * as THREE from 'three';
import { createSpeckleTexture } from './textures.js';

// Runway lies along the Z axis. North = -Z, so an aircraft with identity
// rotation (nose toward -Z) faces north (heading 360 / "runway 36").
export const RUNWAY_LENGTH = 3000;
export const RUNWAY_WIDTH = 45;
export const TAXIWAY_X = 130;
export const TAXIWAY_WIDTH = 23;

const Y_SURFACE = 0.08;  // tiny offsets above the terrain (which is exactly 0 here)
const Y_MARK = 0.16;

/** Horizontal plane whose UVs are scaled so detail textures keep a constant world size. */
function groundPlane(w, d, material, x, z, y, tile = 8) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

function numberTexture(text, rotated, anisotropy) {
  const w = 144, h = 208;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.translate(w / 2, h / 2);
  if (rotated) ctx.rotate(Math.PI);
  ctx.scale(1, 1.55);
  ctx.fillStyle = '#ececec';
  ctx.font = 'bold 110px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createAirbase(maxAnisotropy = 4) {
  const group = new THREE.Group();
  group.name = 'Airbase';

  const RL = RUNWAY_LENGTH, RW = RUNWAY_WIDTH;

  // ---- Materials --------------------------------------------------------
  const asphaltTex = createSpeckleTexture({ base: 150, variance: 35, density: 0.8, seed: 3, anisotropy: maxAnisotropy });
  const concreteTex = createSpeckleTexture({ base: 215, variance: 22, density: 0.5, seed: 5, anisotropy: maxAnisotropy });
  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x3b3e42, map: asphaltTex, roughness: 0.92 });
  const taxiMat = new THREE.MeshStandardMaterial({ color: 0x45484c, map: asphaltTex, roughness: 0.92 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x8e9192, map: concreteTex, roughness: 0.9 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.8 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.8 });
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x70787f, roughness: 0.8, metalness: 0.1 });
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x5b6a73, roughness: 0.7, metalness: 0.3 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2c3338, roughness: 0.8 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xa4a6a6, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d2c3a, roughness: 0.15, metalness: 0.8 });

  // ---- Surfaces -----------------------------------------------------------
  group.add(groundPlane(RW, RL, runwayMat, 0, 0, Y_SURFACE));

  const taxiLen = RL - 100;
  group.add(groundPlane(TAXIWAY_WIDTH, taxiLen, taxiMat, TAXIWAY_X, 0, Y_SURFACE));
  const connectorW = TAXIWAY_X - TAXIWAY_WIDTH / 2 - RW / 2;
  const connectorX = RW / 2 + connectorW / 2;
  const connectorZs = [RL / 2 - 150, 0, -(RL / 2 - 150)];
  for (const z of connectorZs) {
    group.add(groundPlane(connectorW, TAXIWAY_WIDTH, taxiMat, connectorX, z, Y_SURFACE));
  }
  group.add(groundPlane(240, 500, apronMat, 262, 700, Y_SURFACE, 10));

  // ---- Runway markings (single instanced mesh) -----------------------------
  const marks = [];
  marks.push({ x: -RW / 2 + 1.2, z: 0, w: 0.9, d: RL - 40 });
  marks.push({ x: RW / 2 - 1.2, z: 0, w: 0.9, d: RL - 40 });
  for (let z = -RL / 2 + 150; z <= RL / 2 - 150; z += 50) marks.push({ x: 0, z, w: 0.9, d: 30 });
  for (const s of [-1, 1]) {
    const end = s * RL / 2;
    for (let i = 0; i < 4; i++) {
      const off = 2.4 + i * 2.6;
      marks.push({ x: off, z: end - s * 28, w: 1.4, d: 30 });
      marks.push({ x: -off, z: end - s * 28, w: 1.4, d: 30 });
    }
    marks.push({ x: 8, z: end - s * 300, w: 4, d: 45 }, { x: -8, z: end - s * 300, w: 4, d: 45 });
    for (const dist of [450, 600]) {
      marks.push({ x: 8, z: end - s * dist, w: 1.8, d: 22 }, { x: -8, z: end - s * dist, w: 1.8, d: 22 });
    }
  }
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  unitPlane.rotateX(-Math.PI / 2);
  const markMesh = new THREE.InstancedMesh(unitPlane, whiteMat, marks.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  marks.forEach((r, i) => {
    m4.compose(p.set(r.x, Y_MARK, r.z), q, sc.set(r.w, 1, r.d));
    markMesh.setMatrixAt(i, m4);
  });
  markMesh.instanceMatrix.needsUpdate = true;
  markMesh.frustumCulled = false;
  markMesh.receiveShadow = true;
  group.add(markMesh);

  // Runway numbers: readable from the approach end (top of text points down-runway)
  const numGeo = new THREE.PlaneGeometry(9, 13);
  numGeo.rotateX(-Math.PI / 2);
  const num36 = new THREE.Mesh(numGeo, new THREE.MeshStandardMaterial({ map: numberTexture('36', false, maxAnisotropy), transparent: true, alphaTest: 0.3, roughness: 0.8 }));
  num36.position.set(0, Y_MARK, RL / 2 - 80);
  const num18 = new THREE.Mesh(numGeo, new THREE.MeshStandardMaterial({ map: numberTexture('18', true, maxAnisotropy), transparent: true, alphaTest: 0.3, roughness: 0.8 }));
  num18.position.set(0, Y_MARK, -(RL / 2 - 80));
  num36.receiveShadow = num18.receiveShadow = true;
  group.add(num36, num18);

  // Taxiway lines (yellow)
  const lineGeo = new THREE.PlaneGeometry(1, 1);
  lineGeo.rotateX(-Math.PI / 2);
  const taxiLine = new THREE.Mesh(lineGeo, yellowMat);
  taxiLine.scale.set(0.3, 1, taxiLen);
  taxiLine.position.set(TAXIWAY_X, Y_MARK, 0);
  group.add(taxiLine);
  for (const z of connectorZs) {
    const l = new THREE.Mesh(lineGeo, yellowMat);
    l.scale.set(connectorW, 1, 0.3);
    l.position.set(connectorX, Y_MARK, z);
    group.add(l);
  }

  // ---- Runway lights ------------------------------------------------------
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2d0, emissiveIntensity: 2.5 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x112211, emissive: 0x22ff55, emissiveIntensity: 2.5 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x221111, emissive: 0xff2222, emissiveIntensity: 2.5 });
  const lightGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const edge = [];
  for (let z = -RL / 2; z <= RL / 2; z += 60) edge.push([-(RW / 2 + 2), z], [RW / 2 + 2, z]);
  const edgeLights = new THREE.InstancedMesh(lightGeo, lightMat, edge.length);
  edge.forEach(([x, z], i) => {
    m4.compose(p.set(x, 0.3, z), q, sc.set(1, 1, 1));
    edgeLights.setMatrixAt(i, m4);
  });
  edgeLights.frustumCulled = false;
  group.add(edgeLights);

  const rowCount = 11;
  const thrLights = new THREE.InstancedMesh(lightGeo, greenMat, rowCount * 2);
  const endLights = new THREE.InstancedMesh(lightGeo, redMat, rowCount * 2);
  for (let i = 0; i < rowCount; i++) {
    const x = (i - (rowCount - 1) / 2) * 4;
    for (let k = 0; k < 2; k++) {
      const sgn = k === 0 ? 1 : -1;
      m4.compose(p.set(x, 0.3, sgn * (RL / 2 - 2)), q, sc.set(1, 1, 1));
      thrLights.setMatrixAt(i * 2 + k, m4);
      m4.compose(p.set(x, 0.3, sgn * (RL / 2 + 4)), q, sc.set(1, 1, 1));
      endLights.setMatrixAt(i * 2 + k, m4);
    }
  }
  thrLights.frustumCulled = endLights.frustumCulled = false;
  group.add(thrLights, endLights);

  // ---- Buildings ----------------------------------------------------------
  for (const z of [520, 700, 880]) {
    group.add(box(50, 14, 60, hangarMat, 410, 7, z));
    group.add(box(0.6, 11, 36, doorMat, 384.6, 5.6, z));
    group.add(box(52, 1.2, 62, buildingMat, 410, 14.4, z));
  }
  // Control tower
  group.add(box(7, 24, 7, concreteMat, 95, 12, 900));
  group.add(box(12, 4, 12, glassMat, 95, 26, 900));
  group.add(box(13.5, 0.7, 13.5, buildingMat, 95, 28.3, 900));
  group.add(box(0.3, 6, 0.3, buildingMat, 95, 31.6, 900));
  // Operations block
  group.add(box(40, 8, 16, buildingMat, 205, 4, 960));

  return group;
}
