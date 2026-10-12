import * as THREE from 'three';
import { Environment } from '../environment/Environment.js';
import { Aircraft, GEAR_HEIGHT } from '../aircraft/Aircraft.js';
import { DebugFlight } from '../aircraft/DebugFlight.js';
import { CameraManager, CameraMode } from '../camera/CameraManager.js';
import { InputManager } from '../controls/InputManager.js';
import { UIManager } from '../ui/UIManager.js';

const FIXED_STEP = 1 / 120;      // simulation rate
const MAX_STEPS_PER_FRAME = 12;  // spiral-of-death guard
const MS_TO_KT = 1.943844;
const M_TO_FT = 3.28084;

const QUALITY = {
  low: { label: 'low', maxPixelRatio: 1, shadowMap: 0 },
  medium: { label: 'medium', maxPixelRatio: 1.5, shadowMap: 1024 },
  high: { label: 'high', maxPixelRatio: 2, shadowMap: 2048 },
};

export class Game {
  constructor(container) {
    this.container = container;
    this.contextLost = false;
    this.accumulator = 0;
    this.last = 0;
    this.fps = 60;
    this._statusTimer = 0;
    this._raf = 0;
    this.quality = 'high';

    // Renderer: logarithmic depth keeps a 0.1 m near plane and 120 km far plane z-fight free.
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 120000);

    this.input = new InputManager(this.renderer.domElement);
    this.ui = new UIManager();
    this.environment = new Environment(this.scene, this.renderer, {
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
    });

    this.aircraft = new Aircraft();
    this.scene.add(this.aircraft.group);

    this.debugFlight = new DebugFlight(this.aircraft, this.environment);
    this.cameraManager = new CameraManager(
      this.camera, this.aircraft, this.input,
      (x, z) => this.environment.heightAt(x, z),
    );

    // Spawn: south end of the runway, on the centreline, nose pointing north (-Z).
    this.spawn = {
      position: new THREE.Vector3(0, GEAR_HEIGHT, 1300),
      quaternion: new THREE.Quaternion(),
    };

    this._onResize = () => this.resize();
    this._onContextLost = (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.ui.showNotice('Graphics context lost. Waiting for the browser to restore it...');
    };
    this._onContextRestored = () => {
      this.contextLost = false;
      this.ui.hideNotice();
    };
    window.addEventListener('resize', this._onResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this._onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this._onContextRestored);

    this.applyQuality(this.quality);
    this.resize();
    this.resetFlight();
  }

  start() {
    this.last = performance.now() * 0.001;
    this._raf = requestAnimationFrame(this._loop);
  }

  resetFlight() {
    this.aircraft.reset(this.spawn.position, this.spawn.quaternion);
    this.debugFlight.reset();
    this.cameraManager.snap();
  }

  applyQuality(name) {
    const q = QUALITY[name];
    if (!q) return;
    this.quality = name;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
    this.environment.setShadowQuality(q.shadowMap);
    this.resize();
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _handleInput() {
    const i = this.input;
    if (i.wasActionPressed('camera')) this.cameraManager.cycle();
    if (i.wasActionPressed('reset')) this.resetFlight();
    if (i.wasActionPressed('help')) this.ui.toggleHelp();
    if (i.wasActionPressed('debugFly')) this.debugFlight.setEnabled(!this.debugFlight.enabled);
    if (i.wasKeyPressed('Digit1')) this.applyQuality('low');
    if (i.wasKeyPressed('Digit2')) this.applyQuality('medium');
    if (i.wasKeyPressed('Digit3')) this.applyQuality('high');
  }

  _fixedUpdate(dt) {
    // In free-camera mode the WASD keys fly the camera, not the aircraft.
    if (this.cameraManager.mode !== CameraMode.FREE) this.debugFlight.update(dt, this.input);
  }

  _updateStatus(frameDt) {
    if (frameDt > 0) this.fps += (1 / frameDt - this.fps) * 0.05;
    this._statusTimer += frameDt;
    if (this._statusTimer < 0.1) return;
    this._statusTimer = 0;

    const a = this.aircraft;
    this.ui.setStatus({
      cam: this.cameraManager.label,
      mode: this.debugFlight.enabled ? 'debug flight' : 'parked',
      spd: `${Math.round(this.debugFlight.speed * MS_TO_KT)} kt`,
      alt: `${Math.round((a.position.y - GEAR_HEIGHT) * M_TO_FT)} ft`,
      hdg: `${String(Math.round(a.getHeadingDeg()) % 360).padStart(3, '0')}°`,
      gfx: this.quality,
      fps: String(Math.round(this.fps)),
    });
  }

  _loop = (ms) => {
    this._raf = requestAnimationFrame(this._loop);
    const now = ms * 0.001;
    const frameDt = Math.min(Math.max(now - this.last, 0), 0.1);
    this.last = now;

    this._handleInput();

    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      this._fixedUpdate(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.cameraManager.update(frameDt);
    this.environment.update(this.aircraft.position, this.camera.position);
    this._updateStatus(frameDt);

    if (!this.contextLost) this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    const el = this.renderer.domElement;
    el.removeEventListener('webglcontextlost', this._onContextLost);
    el.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.input.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
