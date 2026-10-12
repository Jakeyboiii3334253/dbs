/**
 * Keyboard + mouse input. Bindings map action names to KeyboardEvent.code values,
 * so a settings menu (Stage 7) can rebind them by editing `bindings`.
 */
export const DEFAULT_BINDINGS = {
  pitchDown: ['KeyW', 'ArrowUp'],
  pitchUp: ['KeyS', 'ArrowDown'],
  rollLeft: ['KeyA', 'ArrowLeft'],
  rollRight: ['KeyD', 'ArrowRight'],
  yawLeft: ['KeyQ'],
  yawRight: ['KeyE'],
  throttleUp: ['ShiftLeft', 'KeyX'],
  throttleDown: ['ControlLeft', 'KeyZ'],
  gear: ['KeyG'],
  flaps: ['KeyF'],
  airbrake: ['KeyB'],
  landingLights: ['KeyL'],
  brake: ['Space'],
  camera: ['KeyC'],
  pause: ['Escape'],
  help: ['KeyH'],
  reset: ['KeyR'],
  debugFly: ['KeyT'],
};

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class InputManager {
  constructor(target, bindings = DEFAULT_BINDINGS) {
    this.target = target;
    this.bindings = JSON.parse(JSON.stringify(bindings));
    this.keys = new Set();
    this.pressed = new Set();   // keys pressed since the last endFrame()
    this.mouse = { dx: 0, dy: 0, wheel: 0, dragging: false };

    this._onKeyDown = (e) => {
      if (PREVENT_DEFAULT.has(e.code) || e.ctrlKey) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.dragging = false;
    };
    this._onPointerDown = (e) => {
      this.mouse.dragging = true;
      try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    this._onPointerMove = (e) => {
      if (!this.mouse.dragging) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    };
    this._onPointerUp = (e) => {
      this.mouse.dragging = false;
      try { target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    this._onWheel = (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      this.mouse.wheel += e.deltaY * unit;
    };
    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    target.addEventListener('pointerdown', this._onPointerDown);
    target.addEventListener('pointermove', this._onPointerMove);
    target.addEventListener('pointerup', this._onPointerUp);
    target.addEventListener('pointercancel', this._onPointerUp);
    target.addEventListener('wheel', this._onWheel, { passive: false });
    target.addEventListener('contextmenu', this._onContextMenu);
  }

  isDown(code) { return this.keys.has(code); }
  wasKeyPressed(code) { return this.pressed.has(code); }

  isActionDown(action) {
    const codes = this.bindings[action];
    return !!codes && codes.some((c) => this.keys.has(c));
  }

  wasActionPressed(action) {
    const codes = this.bindings[action];
    return !!codes && codes.some((c) => this.pressed.has(c));
  }

  /** Digital axis: +1 when `positive` is held, -1 when `negative` is held. */
  axis(positive, negative) {
    return (this.isActionDown(positive) ? 1 : 0) - (this.isActionDown(negative) ? 1 : 0);
  }

  consumeLook() {
    const out = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = this.mouse.dy = 0;
    return out;
  }

  consumeWheel() {
    const w = this.mouse.wheel;
    this.mouse.wheel = 0;
    return w;
  }

  endFrame() {
    this.pressed.clear();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    const t = this.target;
    t.removeEventListener('pointerdown', this._onPointerDown);
    t.removeEventListener('pointermove', this._onPointerMove);
    t.removeEventListener('pointerup', this._onPointerUp);
    t.removeEventListener('pointercancel', this._onPointerUp);
    t.removeEventListener('wheel', this._onWheel);
    t.removeEventListener('contextmenu', this._onContextMenu);
  }
}
