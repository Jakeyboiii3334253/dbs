const HELP = [
  ['W / S', 'Pitch down / up'],
  ['A / D', 'Roll left / right'],
  ['Q / E', 'Yaw left / right'],
  ['Shift / X', 'Speed up (debug flight)'],
  ['Ctrl / Z', 'Slow down (debug flight)'],
  ['T', 'Debug flight on / off'],
  ['C', 'Camera: chase, free, cockpit'],
  ['Mouse drag', 'Orbit / look around'],
  ['Wheel', 'Zoom (chase), speed (free)'],
  ['Free camera', 'WASD move, Q/E down/up, Shift fast'],
  ['R', 'Reset to runway'],
  ['1 / 2 / 3', 'Graphics low / medium / high'],
  ['H', 'Show / hide this panel'],
];

export class UIManager {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.fields = {
      cam: $('s-cam'), mode: $('s-mode'), spd: $('s-spd'), alt: $('s-alt'),
      hdg: $('s-hdg'), gfx: $('s-gfx'), fps: $('s-fps'),
    };
    this.helpEl = $('help');
    this.noticeEl = $('notice');
    this._last = {};
    this._buildHelp($('help-rows'));
  }

  _buildHelp(container) {
    for (const [key, desc] of HELP) {
      const row = document.createElement('div');
      row.className = 'row';
      const k = document.createElement('span');
      k.className = 'key';
      k.textContent = key;
      const d = document.createElement('span');
      d.className = 'desc';
      d.textContent = desc;
      row.append(k, d);
      container.appendChild(row);
    }
  }

  setStatus(values) {
    for (const key of Object.keys(values)) {
      if (this._last[key] === values[key] || !this.fields[key]) continue;
      this._last[key] = values[key];
      this.fields[key].textContent = values[key];
    }
    this.fields.mode.classList.toggle('on', values.mode === 'debug flight');
  }

  toggleHelp() { this.helpEl.classList.toggle('hidden'); }

  showNotice(message) {
    this.noticeEl.textContent = message;
    this.noticeEl.classList.remove('hidden');
  }

  hideNotice() { this.noticeEl.classList.add('hidden'); }

  static showFatal(message) {
    const el = document.getElementById('fatal');
    el.textContent = message;
    el.classList.remove('hidden');
  }
}
