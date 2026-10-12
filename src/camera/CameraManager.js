import * as THREE from 'three';
import { EYE_POSITION } from '../aircraft/Aircraft.js';

export const CameraMode = Object.freeze({ COCKPIT: 'cockpit', CHASE: 'chase', FREE: 'free' });
const ORDER = [CameraMode.CHASE, CameraMode.FREE, CameraMode.COCKPIT];
const FOV = { cockpit: 75, chase: 58, free: 65 };
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

/**
 * Cockpit view : pilot's eye point, drag the mouse to look around (with limits).
 * Chase view   : follows behind the aircraft, drag to orbit, wheel to zoom.
 * Free camera  : WASD fly, Q/E down/up, Shift = fast, drag to look, wheel = speed.
 * (The Stage 1 cockpit view is a placeholder until the 3D cockpit exists in Stage 3.)
 */
export class CameraManager {
  constructor(camera, aircraft, input, groundHeightAt) {
    this.camera = camera;
    this.aircraft = aircraft;
    this.input = input;
    this.groundHeightAt = groundHeightAt;

    this.mode = CameraMode.CHASE;
    this.cockpitYaw = 0;
    this.cockpitPitch = 0;
    this.chaseYaw = 0;
    this.chasePitch = 0.2;
    this.chaseDist = 24;
    this.chaseOffset = new THREE.Vector3();
    this.freeYaw = 0;
    this.freePitch = 0;
    this.freeSpeed = 1;

    this._v = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.setMode(this.mode);
  }

  get label() { return this.mode; }

  cycle() {
    const next = ORDER[(ORDER.indexOf(this.mode) + 1) % ORDER.length];
    this.setMode(next);
  }

  /** Re-initialise the current mode (e.g. after the aircraft is teleported on reset). */
  snap() { this.setMode(this.mode); }

  setMode(mode) {
    this.mode = mode;
    const cam = this.camera;
    cam.fov = FOV[mode];
    cam.updateProjectionMatrix();
    cam.up.copy(WORLD_UP);

    if (mode === CameraMode.COCKPIT) {
      this.cockpitYaw = 0;
      this.cockpitPitch = 0;
    } else if (mode === CameraMode.CHASE) {
      this._desiredChaseOffset(this.chaseOffset);
      this._chase(0, { dx: 0, dy: 0 }, 0);
    } else if (mode === CameraMode.FREE) {
      this._euler.setFromQuaternion(cam.quaternion, 'YXZ');
      this.freeYaw = this._euler.y;
      this.freePitch = this._euler.x;
    }
  }

  update(dt) {
    const look = this.input.consumeLook();
    const wheel = this.input.consumeWheel();

    if (this.mode === CameraMode.COCKPIT) this._cockpit(look);
    else if (this.mode === CameraMode.CHASE) this._chase(dt, look, wheel);
    else this._free(dt, look, wheel);

    if (this.mode !== CameraMode.COCKPIT) {
      const p = this.camera.position;
      const minY = this.groundHeightAt(p.x, p.z) + 1.5;
      if (p.y < minY) p.y = minY;
    }
  }

  // -------------------------------------------------------------------- modes
  _cockpit(look) {
    this.cockpitYaw = clamp(this.cockpitYaw - look.dx * 0.0035, -2.6, 2.6);
    this.cockpitPitch = clamp(this.cockpitPitch - look.dy * 0.0035, -1.0, 1.2);

    const g = this.aircraft.group;
    this._q.setFromEuler(this._euler.set(this.cockpitPitch, this.cockpitYaw, 0, 'YXZ'));
    this.camera.quaternion.copy(g.quaternion).multiply(this._q);
    this.camera.position.copy(EYE_POSITION).applyQuaternion(g.quaternion).add(g.position);
  }

  _desiredChaseOffset(out) {
    const cp = Math.cos(this.chasePitch);
    return out
      .set(Math.sin(this.chaseYaw) * cp, Math.sin(this.chasePitch), Math.cos(this.chaseYaw) * cp)
      .multiplyScalar(this.chaseDist)
      .applyQuaternion(this.aircraft.group.quaternion);
  }

  _chase(dt, look, wheel) {
    this.chaseYaw -= look.dx * 0.005;
    this.chasePitch = clamp(this.chasePitch + look.dy * 0.005, -0.35, 1.45);
    this.chaseDist = clamp(this.chaseDist * Math.exp(wheel * 0.0012), 8, 150);

    const g = this.aircraft.group;
    this._desiredChaseOffset(this._v);
    const k = dt > 0 ? 1 - Math.exp(-dt * 6) : 1;
    this.chaseOffset.lerp(this._v, k);

    this.camera.position.copy(g.position).add(this.chaseOffset);

    // Camera up leans 30 % toward the aircraft's up so banking is readable but not nauseating.
    this._v.set(0, 1, 0).applyQuaternion(g.quaternion);
    this.camera.up.copy(WORLD_UP).addScaledVector(this._v, 0.3).normalize();
    this._target.copy(g.position).addScaledVector(this._v, 1.2);
    this.camera.lookAt(this._target);
  }

  _free(dt, look, wheel) {
    const input = this.input;
    this.freeYaw -= look.dx * 0.003;
    this.freePitch = clamp(this.freePitch - look.dy * 0.003, -1.55, 1.55);
    this.freeSpeed = clamp(this.freeSpeed * Math.exp(-wheel * 0.001), 0.1, 50);

    this.camera.quaternion.setFromEuler(this._euler.set(this.freePitch, this.freeYaw, 0, 'YXZ'));

    const fwd = this._fwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const speed = 80 * this.freeSpeed * (input.isDown('ShiftLeft') ? 6 : 1);

    const f = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const r = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const u = (input.isDown('KeyE') ? 1 : 0) - (input.isDown('KeyQ') ? 1 : 0);

    const p = this.camera.position;
    p.addScaledVector(fwd, f * speed * dt);
    p.addScaledVector(right, r * speed * dt);
    p.y += u * speed * dt;
  }
}
