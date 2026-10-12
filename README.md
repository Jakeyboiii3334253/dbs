# Vanguard - browser combat flight simulator (Stage 1 foundation)

Three.js + Vite. No paid assets, no API keys, no external services: the jet, airbase,
terrain, sky and clouds are all generated in code.

## Run it

```
npm install
npm run dev        # opens http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build locally
```

Requires Node 18+ and a browser with WebGL 2 (any current Chrome, Edge, Firefox, Safari).

## What Stage 1 contains

- Procedural original jet (fuselage, canopy, swept wings, stabilators, canted fins, intakes,
  exhaust, landing gear, nav lights) with animated ailerons and stabilators.
- 3 km runway with markings, numbers, edge/threshold lights, taxiways, apron, hangars, tower.
- 80 x 80 km procedural terrain: flat at the airbase, rolling hills and snow-capped mountains beyond.
- Physical sky (Three.js `Sky`), sun with real-time shadows that follow the aircraft, fog, cloud layer.
- Cameras: chase (drag to orbit, wheel to zoom), free camera, and a placeholder cockpit view.
- Fixed-timestep loop (120 Hz sim), resize handling, WebGL context-loss handling, quality presets.
- A throw-away "debug flight" mover so you can fly around and judge the world scale.
  It is replaced by the real flight model in Stage 2.

## Controls

| Key | Action |
| --- | --- |
| W / S | Pitch down / up |
| A / D | Roll left / right |
| Q / E | Yaw left / right |
| Shift or X | Speed up (debug flight). Rotate above ~80 m/s |
| Ctrl or Z | Slow down. Prefer Z: Ctrl+W closes a browser tab |
| T | Debug flight on / off |
| C | Cycle camera: chase, free, cockpit |
| Mouse drag / wheel | Orbit or look / zoom (speed in free camera) |
| Free camera | WASD move, Q/E down/up, Shift fast |
| R | Reset to the runway |
| 1 / 2 / 3 | Graphics low / medium / high |
| H | Show / hide the controls panel |

## Structure

```
index.html
package.json
vite.config.js
src/
  main.js                       entry point, fatal-error screen
  style.css
  game/Game.js                  renderer, fixed-step loop, quality, input commands
  aircraft/Aircraft.js          procedural jet model + control-surface/gear/light API
  aircraft/DebugFlight.js       Stage 1 only kinematic mover
  camera/CameraManager.js       cockpit / chase / free cameras
  controls/InputManager.js      rebindable keyboard + mouse input
  environment/Environment.js    sky, sun, fog, shadows, clouds
  environment/Terrain.js        height function + terrain mesh
  environment/Airbase.js        runway, taxiways, buildings, lights
  environment/textures.js       canvas-generated detail textures
  ui/UIManager.js               status panel, controls panel, notices
  cockpit/  audio/              reserved for Stages 3-7
```

## Tuning the look

Constants at the top of `environment/Environment.js` control sun angle, fog colour/density and
exposure. If the horizon fog does not match the sky on your display, adjust `FOG_COLOR`.

## Known limitations (Stage 1)

- No flight model yet: speed and attitude are kinematic, there is no lift, stall or crash logic.
- Cockpit view is a placeholder camera at the pilot's eye point; the 3D cockpit comes in Stage 3.
- No audio, menus, settings screen, day/night cycle or tutorial yet.
- Antialiasing is fixed at startup; the quality presets change pixel ratio and shadows only.

## Roadmap

2. Flight model (lift, drag, thrust, stall, ground handling, crash)  3. 3D cockpit
4. Clickable switches  5. Instruments/HUD from real state  6. Start-up procedure and systems
7. Audio, menus, tutorial, settings  8. Test and optimise
