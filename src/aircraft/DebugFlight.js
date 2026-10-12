import * as THREE from 'three';
import { GEAR_HEIGHT } from './Aircraft.js';

/**
 * STAGE 1 ONLY - a throw-away kinematic mover so the environment, terrain
 * scale and cameras can be inspected. It is replaced by the real FlightModel
 * (lift, drag, thrust, stall, ...) in Stage 2.
 */
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _levelQ = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _fwd = new THREE.Vector3();

export class DebugFlight {
  constructor(aircraft, environment) {
    this.aircraft = aircraft;
    this.environment = environment;
    this.enabled = true;
    this.speed = 0;        // m/s
    this.onGround = true;
    this._ail = 0;
    this._elev = 0;
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      this.speed = 0;
      this.aircraft.setControlSurfaces(0, 0);
    }
  }

  reset() {
    this.speed = 0;
    this.onGround = true;
    this._ail = this._elev = 0;
  }

  update(dt, input) {
    if (!this.enabled) return;

    const pitch = input.axis('pitchUp', 'pitchDown');
    const roll = input.axis('rollRight', 'rollLeft');
    const yaw = input.axis('yawRight', 'yawLeft');
    const throttle = input.axis('throttleUp', 'throttleDown');

    this.speed = THREE.MathUtils.clamp(this.speed + throttle * 60 * dt, 0, 450);

    const g = this.aircraft.group;
    const q = g.quaternion;
    const authority = THREE.MathUtils.clamp(this.speed / 80, 0, 1); // no control at a standstill

    q.multiply(_q.setFromAxisAngle(AXIS_X, pitch * 0.9 * authority * dt));
    q.multiply(_q.setFromAxisAngle(AXIS_Z, -roll * 2.0 * authority * dt));
    q.multiply(_q.setFromAxisAngle(AXIS_Y, -yaw * 0.3 * authority * dt));
    q.normalize();

    _fwd.set(0, 0, -1).applyQuaternion(q);
    g.position.addScaledVector(_fwd, this.speed * dt);

    const groundY = this.environment.heightAt(g.position.x, g.position.z) + GEAR_HEIGHT;
    this.onGround = g.position.y <= groundY + 0.01;
    if (g.position.y < groundY) g.position.y = groundY;

    if (this.onGround) {
      // Roll the wings level and let the nose settle, like sitting on the gear.
      const heading = Math.atan2(-_fwd.x, -_fwd.z);
      _levelQ.setFromEuler(_euler.set(0, heading, 0, 'YXZ'));
      if (_fwd.y > 0.35 || this.speed > 80) {
        // airborne attitude near the ground: leave it alone (take-off / landing flare)
      } else {
        q.slerp(_levelQ, Math.min(1, 3 * dt));
      }
      this.speed *= 1 - 0.05 * dt;
    }

    const k = Math.min(1, dt * 8);
    this._ail += (roll - this._ail) * k;
    this._elev += (pitch - this._elev) * k;
    this.aircraft.setControlSurfaces(this._ail, this._elev);
    this.aircraft.setEngineGlow(this.speed / 450);
  }
}
