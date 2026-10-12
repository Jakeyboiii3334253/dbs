import './style.css';
import { Game } from './game/Game.js';
import { UIManager } from './ui/UIManager.js';

const container = document.getElementById('app');

try {
  const game = new Game(container);
  game.start();
  window.game = game; // handy for poking around in the browser console

  if (import.meta.hot) {
    import.meta.hot.dispose(() => game.dispose());
  }
} catch (err) {
  console.error(err);
  UIManager.showFatal(
    'The simulator could not start. WebGL 2 is required - check that hardware acceleration is enabled in your browser.\n\n' +
      String(err && err.message ? err.message : err),
  );
}
