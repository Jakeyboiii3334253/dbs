import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Terrain, terrainHeight } from './Terrain.js';
import { createAirbase } from './Airbase.js';

// Tunable look-and-feel constants
const SUN_ELEVATION_DEG = 38;
const SUN_AZIMUTH_DEG = 140;
const FOG_COLOR = 0xb4c8dc;
const FOG_DENSITY = 0.000045;
const EXPOSURE = 0.7;

export class Environment {
  constructor(scene, renderer, { maxAnisotropy = 4 } = {}) {
    this.scene = scene;
    this.sunDirection = new THREE.Vector3();
    this.shadowExtent = 120;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = EXPOSURE;

    this._buildAtmosphere();
    this._buildLights();

    this.terrain = new Terrain(maxAnisotropy);
    scene.add(this.terrain.mesh);

    this.airbase = createAirbase(maxAnisotropy);
    scene.add(this.airbase);

    this._buildClouds();
  }

  heightAt(x, z) {
    return terrainHeight(x, z);
  }

  _buildAtmosphere() {
    this.sunDirection.setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - SUN_ELEVATION_DEG),
      THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG),
    );

    const sky = new Sky();
    sky.scale.setScalar(90000);
    sky.frustumCulled = false;
    sky.renderOrder = -1000;
    sky.material.depthTest = false;
    sky.material.depthWrite = false;
    const u = sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(this.sunDirection);
    this.sky = sky;
    this.scene.add(sky);

    this.scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xaecdf0, 0x55603f, 1.5);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(0xfff4e0, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const e = this.shadowExtent;
    Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 10, far: 1600 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.4;
    this.sun = sun;
    this.scene.add(sun, sun.target);
  }

  _buildClouds() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    let s = 12345;
    const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * size * 0.22;
      const x = size / 2 + Math.cos(a) * r, y = size / 2 + Math.sin(a) * r * 0.7;
      const rad = size * (0.14 + rnd() * 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    this.cloudMaterial = new THREE.SpriteMaterial({
      map: tex,
      color: 0xf4f7fb,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    });

    const clouds = new THREE.Group();
    clouds.name = 'Clouds';
    for (let c = 0; c < 70; c++) {
      const cx = (rnd() - 0.5) * 60000;
      const cz = (rnd() - 0.5) * 60000;
      const cy = 2200 + rnd() * 500;
      const puffs = 5 + Math.floor(rnd() * 5);
      for (let p = 0; p < puffs; p++) {
        const sprite = new THREE.Sprite(this.cloudMaterial);
        const sz = 700 + rnd() * 900;
        sprite.scale.set(sz, sz * 0.55, 1);
        sprite.position.set(cx + (rnd() - 0.5) * 1800, cy + (rnd() - 0.5) * 220, cz + (rnd() - 0.5) * 1800);
        clouds.add(sprite);
      }
    }
    this.clouds = clouds;
    this.scene.add(clouds);
  }

  /** mapSize 0 disables shadows; otherwise 1024 / 2048 / ... */
  setShadowQuality(mapSize) {
    const sun = this.sun;
    if (!mapSize) {
      sun.castShadow = false;
      return;
    }
    sun.castShadow = true;
    if (sun.shadow.mapSize.x !== mapSize) {
      sun.shadow.mapSize.set(mapSize, mapSize);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
  }

  /** Call once per frame. Keeps the sky centred on the camera and the shadow frustum on the aircraft. */
  update(focusPosition, cameraPosition) {
    this.sky.position.copy(cameraPosition);
    this.sun.target.position.copy(focusPosition);
    this.sun.position.copy(focusPosition).addScaledVector(this.sunDirection, 700);
    this.sun.target.updateMatrixWorld();
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
  }
}
