import * as THREE from 'three';

/**
 * Procedural original jet ("Vanguard"). No external assets.
 * Local axes: -Z = forward (nose), +Y = up, +X = right wing.
 * Origin is roughly the centre of mass; with the gear down the wheels
 * touch the ground when the origin is GEAR_HEIGHT metres above it.
 */
export const GEAR_HEIGHT = 1.95;
export const EYE_POSITION = new THREE.Vector3(0, 0.98, -3.3); // pilot eye point (cockpit camera)

/** Flat plate from a 2D outline given as [x, z] pairs; thickness along Y, centred on y = 0. */
function planform(points, thickness) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);                 // shape y -> world z, extrusion -> -y
  geo.translate(0, thickness / 2, 0);
  return geo;
}

/** Vertical fin from a 2D outline given as [z, y] pairs; thickness along X, centred on x = 0. */
function finPlate(points, thickness) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);                // shape x -> world z, extrusion -> -x
  geo.translate(thickness / 2, 0, 0);
  return geo;
}

export class Aircraft {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Aircraft';

    this.surfaces = { aileronL: null, aileronR: null, stabL: null, stabR: null };
    this.gearParts = { nose: null, mainL: null, mainR: null };
    this.navMaterials = [];

    this._createMaterials();
    this._buildFuselage();
    this._buildCanopy();
    this._buildWings();
    this._buildTail();
    this._buildIntakesAndExhaust();
    this._buildGear();
    this._buildNavLights();

    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    this.setGear(1);
    this.setEngineGlow(0);
    this.setNavLights(false);
  }

  // ---------------------------------------------------------------- state API
  get position() { return this.group.position; }
  get quaternion() { return this.group.quaternion; }

  reset(position, quaternion) {
    this.group.position.copy(position);
    this.group.quaternion.copy(quaternion);
    this.setControlSurfaces(0, 0);
  }

  getForward(out = new THREE.Vector3()) {
    return out.set(0, 0, -1).applyQuaternion(this.group.quaternion);
  }

  /** Magnetic-style heading in degrees, 0 = north (-Z), 90 = east (+X). */
  getHeadingDeg() {
    const f = this.getForward(_fwd);
    const deg = THREE.MathUtils.radToDeg(Math.atan2(f.x, -f.z));
    return (deg + 360) % 360;
  }

  /** aileron, elevator in -1..1 (+aileron = roll right, +elevator = nose up) */
  setControlSurfaces(aileron, elevator) {
    const a = aileron * 0.45;
    const e = elevator * 0.4;
    this.surfaces.aileronR.rotation.x = -a;
    this.surfaces.aileronL.rotation.x = a;
    this.surfaces.stabR.rotation.x = -e;
    this.surfaces.stabL.rotation.x = -e;
  }

  /** 0 = retracted, 1 = fully extended */
  setGear(t) {
    const r = (1 - THREE.MathUtils.clamp(t, 0, 1)) * (Math.PI / 2);
    this.gearParts.nose.rotation.x = -r;
    this.gearParts.mainR.rotation.z = -r;
    this.gearParts.mainL.rotation.z = r;
    const visible = t > 0.001;
    for (const k of Object.keys(this.gearParts)) this.gearParts[k].visible = visible;
  }

  setEngineGlow(level) {
    this.mat.exhaustGlow.emissiveIntensity = THREE.MathUtils.clamp(level, 0, 1) * 3;
  }

  setNavLights(on) {
    for (const m of this.navMaterials) m.emissiveIntensity = on ? 3 : 0;
  }

  // ------------------------------------------------------------ construction
  _createMaterials() {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    this.mat = {
      hull: std({ color: 0x808a96, metalness: 0.35, roughness: 0.5 }),
      dark: std({ color: 0x2b3037, metalness: 0.5, roughness: 0.6 }),
      glass: std({ color: 0x223344, metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.55 }),
      strut: std({ color: 0xb8bec6, metalness: 0.8, roughness: 0.35 }),
      tire: std({ color: 0x111111, roughness: 0.95 }),
      intake: new THREE.MeshBasicMaterial({ color: 0x000000 }),
      exhaustGlow: std({ color: 0x331100, emissive: 0xff6a1a, emissiveIntensity: 0 }),
    };
  }

  _buildFuselage() {
    const profile = [
      [0, -7.2], [0.55, -7.2], [0.75, -6], [0.95, -3.5], [1.15, -1], [1.2, 1],
      [1.05, 3], [0.8, 5], [0.45, 6.6], [0.12, 7.6], [0, 7.8],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(profile, 28);
    geo.rotateX(-Math.PI / 2);                // lathe +Y (nose) -> -Z
    const fuselage = new THREE.Mesh(geo, this.mat.hull);
    fuselage.scale.set(1, 0.85, 1);
    this.group.add(fuselage);

    // Dorsal spine behind the canopy
    const spine = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), this.mat.hull);
    spine.scale.set(0.5, 0.35, 3.2);
    spine.position.set(0, 0.72, 2.4);
    this.group.add(spine);

    // Pitot boom
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 1.6, 8), this.mat.strut);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0, -8.5);
    this.group.add(boom);
  }

  _buildCanopy() {
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), this.mat.glass);
    canopy.scale.set(0.72, 0.55, 2.3);
    canopy.position.set(0, 0.7, -3.6);
    canopy.castShadow = false;
    this.canopy = canopy;
    this.group.add(canopy);
  }

  _buildWings() {
    const wingGeo = planform([[0.5, -5.2], [1.3, -2.2], [6.2, 1.8], [6.2, 2.7], [2.6, 2.7], [2.6, 3.4], [0.5, 3.4]], 0.16);
    const aileronGeo = new THREE.BoxGeometry(3.6, 0.12, 0.7);
    aileronGeo.translate(0, 0, 0.35);       // hinge line at local z = 0

    const make = (side) => {
      const g = new THREE.Group();
      if (side < 0) g.scale.x = -1;         // mirror; three.js flips face winding automatically
      const wing = new THREE.Mesh(wingGeo, this.mat.hull);
      wing.position.y = -0.22;
      g.add(wing);
      const pivot = new THREE.Group();
      pivot.position.set(4.4, -0.22, 2.7);
      pivot.add(new THREE.Mesh(aileronGeo, this.mat.dark));
      g.add(pivot);
      this.group.add(g);
      return pivot;
    };
    this.surfaces.aileronR = make(1);
    this.surfaces.aileronL = make(-1);
  }

  _buildTail() {
    const stabGeo = planform([[0, -0.9], [2.6, 0.2], [2.6, 1.0], [0, 1.2]], 0.1);
    const finGeo = finPlate([[4.4, 0], [6.3, 2.7], [7.3, 2.7], [7.3, 0]], 0.09);

    const make = (side) => {
      const g = new THREE.Group();
      if (side < 0) g.scale.x = -1;
      const stab = new THREE.Group();
      stab.position.set(0.55, -0.12, 5.3);
      stab.add(new THREE.Mesh(stabGeo, this.mat.hull));
      g.add(stab);
      const fin = new THREE.Group();
      fin.position.set(0.55, 0.25, 0);
      fin.rotation.z = -0.22;               // cant outwards
      fin.add(new THREE.Mesh(finGeo, this.mat.hull));
      g.add(fin);
      this.group.add(g);
      return stab;
    };
    this.surfaces.stabR = make(1);
    this.surfaces.stabL = make(-1);
  }

  _buildIntakesAndExhaust() {
    for (const side of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 3.2), this.mat.hull);
      intake.position.set(side * 1.35, -0.3, -1.2);
      this.group.add(intake);
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), this.mat.intake);
      mouth.rotation.y = Math.PI;
      mouth.position.set(side * 1.35, -0.3, -2.81);
      this.group.add(mouth);
    }

    const nozzleMat = this.mat.dark.clone();
    nozzleMat.side = THREE.DoubleSide;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.5, 24, 1, true), nozzleMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0, 7.3);
    this.group.add(nozzle);

    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.48, 24), this.mat.exhaustGlow);
    glow.position.set(0, 0, 7.0);
    this.group.add(glow);
  }

  _buildGear() {
    const strutMat = this.mat.strut, tireMat = this.mat.tire;

    const makeLeg = (px, py, pz, strutLen, wheelR, wheelW) => {
      const pivot = new THREE.Group();
      pivot.position.set(px, py, pz);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, strutLen, 10), strutMat);
      strut.position.y = -strutLen / 2;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 20), tireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.y = -strutLen;
      pivot.add(strut, wheel);
      this.group.add(pivot);
      return pivot;
    };

    // bottom of wheel = pivotY - strutLen - wheelR = -GEAR_HEIGHT
    this.gearParts.nose = makeLeg(0, -0.6, -4.8, 1.03, 0.32, 0.22);
    this.gearParts.mainR = makeLeg(1.5, -0.4, 1.6, 1.1, 0.45, 0.3);
    this.gearParts.mainL = makeLeg(-1.5, -0.4, 1.6, 1.1, 0.45, 0.3);
  }

  _buildNavLights() {
    const make = (color, x, y, z) => {
      const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 0 });
      this.navMaterials.push(m);
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), m);
      s.position.set(x, y, z);
      s.castShadow = false;
      this.group.add(s);
    };
    make(0x22ff55, 6.25, -0.22, 2.2);   // right wingtip: green
    make(0xff2222, -6.25, -0.22, 2.2);  // left wingtip: red
    make(0xffffff, 0, 0.9, 7.1);        // tail: white
  }
}

const _fwd = new THREE.Vector3();
