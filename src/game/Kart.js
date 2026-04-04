import * as THREE from 'three';
import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';
import { LANE_POSITIONS, LANE_SWITCH_DURATION, DRIVER_TYPES } from '../utils/constants.js';

/**
 * Player vehicle — four distinct body types, color set by selected driver.
 * Types: formula (open-wheel), sportsGT (coupe), compact (hatchback), rally (off-road).
 */
export class Kart {
  constructor(scene) {
    this.group = new THREE.Group();
    this.wheels = [];
    this.currentLane = 1;
    this.isSwitching = false;
    this._exhaustZ = 1.6;

    this._buildCar(DRIVER_TYPES[0]);
    this.group.position.set(LANE_POSITIONS[1], 0, 0);
    this.group.traverse(c => { if (c.isMesh) c.castShadow = true; });
    scene.add(this.group);
  }

  // ═══════════════════════════════════════════
  //  SHARED MATERIALS (set per build)
  // ═══════════════════════════════════════════
  _makeMats(driver) {
    return {
      body:   new THREE.MeshStandardMaterial({ color: driver.carBody,   metalness: 0.6, roughness: 0.35 }),
      accent: new THREE.MeshStandardMaterial({ color: driver.carAccent, metalness: 0.5, roughness: 0.4 }),
      dark:   new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.3 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.15 }),
      carbon: new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.4, roughness: 0.6 }),
      glass:  new THREE.MeshStandardMaterial({ color: 0x112233, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.4 }),
    };
  }

  // ═══════════════════════════════════════════
  //  SHARED COMPONENTS
  // ═══════════════════════════════════════════

  _addWheels(m, positions) {
    this.wheels = [];
    positions.forEach((pos) => {
      const wg = new THREE.Group();
      const tR = pos.r || 0.26;
      const tW = pos.w || 0.18;

      // Tire
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(tR, tR, tW, 18),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 }));
      tire.rotation.z = Math.PI / 2;
      wg.add(tire);

      // Hub
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(tR * 0.5, tR * 0.5, tW + 0.02, 10), m.chrome);
      hub.rotation.z = Math.PI / 2;
      wg.add(hub);

      // Center nut
      const nut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, tW + 0.05, 6), m.accent);
      nut.rotation.z = Math.PI / 2;
      wg.add(nut);

      wg.position.set(pos.x, pos.y, pos.z);
      this.group.add(wg);
      this.wheels.push(wg);
    });
  }

  _addHeadlights(zFront) {
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 1.5,
    });
    for (const x of [-0.5, 0.5]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), hlMat);
      hl.position.set(x, 0.3, zFront);
      this.group.add(hl);
    }
  }

  _addTailLights(zRear) {
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.2,
    });
    for (const x of [-0.5, -0.2, 0.2, 0.5]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.03), tlMat);
      tl.position.set(x, 0.38, zRear);
      this.group.add(tl);
    }
    // Rain light
    const rain = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.04, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.2 }));
    rain.position.set(0, 0.32, zRear);
    this.group.add(rain);
  }

  _addExhaustPipes(m, zRear) {
    for (const x of [-0.2, 0.2]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 8), m.chrome);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, 0.3, zRear);
      this.group.add(pipe);

      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8),
        new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 }));
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, 0.3, zRear + 0.14);
      this.group.add(glow);
    }
  }

  // ═══════════════════════════════════════════
  //  MAIN BUILD DISPATCHER
  // ═══════════════════════════════════════════

  _buildCar(driver) {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.wheels = [];

    const m = this._makeMats(driver);

    switch (driver.vehicleType) {
      case 'sportsGT': this._buildSportsGT(m); break;
      case 'compact':  this._buildCompact(m); break;
      case 'rally':    this._buildRally(m); break;
      case 'formula':
      default:         this._buildFormula(m); break;
    }

    // ── Vehicle lighting rig (ensures car is visible on all maps) ──
    // Overhead fill — illuminates roof and top surfaces
    const fillTop = new THREE.PointLight(0xfff5ee, 0.8, 12, 1.5);
    fillTop.position.set(0, 3, -0.5);
    this.group.add(fillTop);

    // Rear fill — illuminates the back of the car (visible from chase cam)
    const fillRear = new THREE.PointLight(0xffffff, 0.7, 10, 1.5);
    fillRear.position.set(0, 2, 3);
    this.group.add(fillRear);

    // Low rim — catches wheel arches, side panels, and underbody
    const fillLow = new THREE.PointLight(0xddeeff, 0.4, 8, 2);
    fillLow.position.set(0, 0.5, -1);
    this.group.add(fillLow);

    // ── Underglow — colored pool beneath vehicle ──
    // For very dark karts, use the accent color instead and boost intensity
    const bodyLum = ((driver.carBody >> 16) & 0xff) + ((driver.carBody >> 8) & 0xff) + (driver.carBody & 0xff);
    const underglowColor = bodyLum < 120 ? driver.carAccent : driver.carBody;
    const underglowIntensity = bodyLum < 120 ? 2.0 : 1.5;
    this._underglow = new THREE.PointLight(underglowColor, underglowIntensity, 8, 1.5);
    this._underglow.position.set(0, 0.25, 0);
    this.group.add(this._underglow);

    // ── Taillight point lights — red glow visible from chase cam ──
    const tailL = new THREE.PointLight(0xff2200, 0.8, 6, 1.5);
    tailL.position.set(-0.4, 0.35, this._exhaustZ - 0.2);
    this.group.add(tailL);
    const tailR = new THREE.PointLight(0xff2200, 0.8, 6, 1.5);
    tailR.position.set(0.4, 0.35, this._exhaustZ - 0.2);
    this.group.add(tailR);
    this._tailLights = [tailL, tailR];

    // Store driver color for theme adjustments
    this._driverColor = driver.carBody;
  }

  // ═══════════════════════════════════════════
  //  FORMULA — open-wheel F1 (Destiny)
  // ═══════════════════════════════════════════

  _buildFormula(m) {
    this._exhaustZ = 1.8;

    // Central tub
    const tubShape = new THREE.Shape();
    tubShape.moveTo(-0.55, 0); tubShape.lineTo(-0.85, 2.0);
    tubShape.lineTo(-0.75, 3.0); tubShape.lineTo(0.75, 3.0);
    tubShape.lineTo(0.85, 2.0); tubShape.lineTo(0.55, 0);
    tubShape.closePath();
    const tub = new THREE.Mesh(
      new THREE.ExtrudeGeometry(tubShape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }), m.body);
    tub.rotation.x = -Math.PI / 2; tub.position.set(0, 0.22, -1.6);
    this.group.add(tub);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.0, 4), m.accent);
    nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.32, -2.1);
    this.group.add(nose);

    // Front wing
    const fw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.35), m.carbon);
    fw.position.set(0, 0.15, -2.3); this.group.add(fw);
    for (const s of [-1, 1]) {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.4), m.accent);
      ep.position.set(s * 1.1, 0.18, -2.3); this.group.add(ep);
    }

    // Side pods + scoops + fins
    for (const s of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.8), m.body);
      pod.position.set(s * 0.9, 0.38, 0); this.group.add(pod);
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.4), m.dark);
      scoop.position.set(s * 0.9, 0.56, -0.5); this.group.add(scoop);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.6), m.accent);
      fin.position.set(s * 1.15, 0.45, 0.2); this.group.add(fin);
    }

    // Cockpit + roll hoop + intake
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.8), m.dark);
    cockpit.position.set(0, 0.55, -0.2); this.group.add(cockpit);
    const rollHoop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, 0.12), m.carbon);
    rollHoop.position.set(0, 0.7, 0.2); this.group.add(rollHoop);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.25), m.dark);
    intake.position.set(0, 0.85, 0.2); this.group.add(intake);

    // Engine cover
    const covShape = new THREE.Shape();
    covShape.moveTo(-0.65, 0); covShape.lineTo(-0.35, 1.2);
    covShape.lineTo(0.35, 1.2); covShape.lineTo(0.65, 0); covShape.closePath();
    const cov = new THREE.Mesh(
      new THREE.ExtrudeGeometry(covShape, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }), m.body);
    cov.rotation.x = -Math.PI / 2; cov.position.set(0, 0.42, 0.3);
    this.group.add(cov);

    // Rear wing
    for (const s of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.08), m.carbon);
      pylon.position.set(s * 0.4, 0.95, 1.35); this.group.add(pylon);
    }
    const rw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.3), m.accent);
    rw.position.set(0, 1.2, 1.4); rw.rotation.x = 0.15; this.group.add(rw);
    const rwf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 0.15), m.body);
    rwf.position.set(0, 1.12, 1.5); rwf.rotation.x = 0.25; this.group.add(rwf);
    for (const s of [-1, 1]) {
      const rep = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.4), m.accent);
      rep.position.set(s * 0.9, 1.1, 1.4); this.group.add(rep);
    }

    // Diffuser
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.3), m.dark);
    diffuser.position.set(0, 0.14, 1.55); diffuser.rotation.x = -0.2; this.group.add(diffuser);
    for (let i = -2; i <= 2; i++) {
      const df = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.25), m.carbon);
      df.position.set(i * 0.25, 0.15, 1.55); this.group.add(df);
    }

    // Suspension arms
    const wps = [[-1.15, 0.29, -1.5], [1.15, 0.29, -1.5], [-1.15, 0.33, 1.0], [1.15, 0.33, 1.0]];
    for (const wp of wps) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), m.carbon);
      arm.rotation.z = Math.PI / 2; arm.position.set(wp[0] * 0.5, wp[1], wp[2]);
      this.group.add(arm);
    }

    this._addHeadlights(-2.35);
    this._addTailLights(1.56);
    this._addExhaustPipes(m, 1.6);
    this._addWheels(m, [
      { x: -1.15, y: 0.24, z: -1.5, r: 0.26, w: 0.18 },
      { x:  1.15, y: 0.24, z: -1.5, r: 0.26, w: 0.18 },
      { x: -1.15, y: 0.28, z:  1.0, r: 0.32, w: 0.24 },
      { x:  1.15, y: 0.28, z:  1.0, r: 0.32, w: 0.24 },
    ]);
  }

  // ═══════════════════════════════════════════
  //  SPORTS GT — closed coupe (Ethan)
  // ═══════════════════════════════════════════

  _buildSportsGT(m) {
    this._exhaustZ = 1.6;

    // Main body (wide rear, tapered front)
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-0.5, 0); bodyShape.lineTo(-0.9, 1.8);
    bodyShape.lineTo(-0.85, 3.2); bodyShape.lineTo(0.85, 3.2);
    bodyShape.lineTo(0.9, 1.8); bodyShape.lineTo(0.5, 0);
    bodyShape.closePath();
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bodyShape, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 }), m.body);
    body.rotation.x = -Math.PI / 2; body.position.set(0, 0.18, -1.8);
    this.group.add(body);

    // Cabin / roof (smooth beveled box)
    const cabShape = new THREE.Shape();
    cabShape.moveTo(-0.5, 0); cabShape.lineTo(-0.65, 1.0);
    cabShape.lineTo(-0.55, 1.8); cabShape.lineTo(0.55, 1.8);
    cabShape.lineTo(0.65, 1.0); cabShape.lineTo(0.5, 0);
    cabShape.closePath();
    const cab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(cabShape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3 }), m.body);
    cab.rotation.x = -Math.PI / 2; cab.position.set(0, 0.56, -0.6);
    this.group.add(cab);

    // Windshield (angled dark glass)
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.04), m.glass);
    ws.position.set(0, 0.72, -0.65); ws.rotation.x = -0.4;
    this.group.add(ws);

    // Rear window
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.04), m.glass);
    rw.position.set(0, 0.68, 1.05); rw.rotation.x = 0.5;
    this.group.add(rw);

    // Hood scoop (subtle)
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.5), m.accent);
    scoop.position.set(0, 0.6, -1.2);
    this.group.add(scoop);

    // Rear lip spoiler
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.12), m.accent);
    spoiler.position.set(0, 0.62, 1.38); spoiler.rotation.x = 0.15;
    this.group.add(spoiler);

    // Front splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.2), m.carbon);
    splitter.position.set(0, 0.14, -1.85);
    this.group.add(splitter);

    // Side skirts
    for (const s of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 2.8), m.carbon);
      skirt.position.set(s * 0.88, 0.18, -0.1);
      this.group.add(skirt);
    }

    // Side mirrors
    for (const s of [-1, 1]) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), m.dark);
      mirror.position.set(s * 0.75, 0.65, -0.4);
      this.group.add(mirror);
    }

    // Rear diffuser
    const diff = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.2), m.dark);
    diff.position.set(0, 0.14, 1.45); diff.rotation.x = -0.15;
    this.group.add(diff);

    this._addHeadlights(-1.85);
    this._addTailLights(1.4);
    this._addExhaustPipes(m, 1.45);
    this._addWheels(m, [
      { x: -0.85, y: 0.22, z: -1.3, r: 0.24, w: 0.18 },
      { x:  0.85, y: 0.22, z: -1.3, r: 0.24, w: 0.18 },
      { x: -0.85, y: 0.24, z:  1.0, r: 0.28, w: 0.22 },
      { x:  0.85, y: 0.24, z:  1.0, r: 0.28, w: 0.22 },
    ]);
  }

  // ═══════════════════════════════════════════
  //  COMPACT — nimble hatchback (Kate)
  // ═══════════════════════════════════════════

  _buildCompact(m) {
    this._exhaustZ = 1.2;

    // Main body (short, rounded)
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-0.55, 0); bodyShape.lineTo(-0.7, 1.2);
    bodyShape.lineTo(-0.65, 2.4); bodyShape.lineTo(0.65, 2.4);
    bodyShape.lineTo(0.7, 1.2); bodyShape.lineTo(0.55, 0);
    bodyShape.closePath();
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bodyShape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3 }), m.body);
    body.rotation.x = -Math.PI / 2; body.position.set(0, 0.2, -1.4);
    this.group.add(body);

    // Cabin (tall for size, bubbly)
    const cabShape = new THREE.Shape();
    cabShape.moveTo(-0.45, 0); cabShape.lineTo(-0.55, 0.9);
    cabShape.lineTo(-0.45, 1.4); cabShape.lineTo(0.45, 1.4);
    cabShape.lineTo(0.55, 0.9); cabShape.lineTo(0.45, 0);
    cabShape.closePath();
    const cab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(cabShape, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 }), m.body);
    cab.rotation.x = -Math.PI / 2; cab.position.set(0, 0.55, -0.5);
    this.group.add(cab);

    // Windshield
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.04), m.glass);
    ws.position.set(0, 0.72, -0.55); ws.rotation.x = -0.35;
    this.group.add(ws);

    // Hatchback rear glass (sloped)
    const rg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.04), m.glass);
    rg.position.set(0, 0.68, 0.8); rg.rotation.x = 0.6;
    this.group.add(rg);

    // Roof scoop (accent)
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.25), m.accent);
    scoop.position.set(0, 0.92, 0.1);
    this.group.add(scoop);

    // Medium rear wing
    for (const s of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.06), m.carbon);
      pylon.position.set(s * 0.35, 0.8, 0.95); this.group.add(pylon);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.2), m.accent);
    wing.position.set(0, 0.95, 0.95); wing.rotation.x = 0.12;
    this.group.add(wing);

    // Side mirrors
    for (const s of [-1, 1]) {
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.05), m.dark);
      mir.position.set(s * 0.62, 0.6, -0.3);
      this.group.add(mir);
    }

    // Front splitter
    const spl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.15), m.carbon);
    spl.position.set(0, 0.14, -1.45);
    this.group.add(spl);

    this._addHeadlights(-1.45);
    this._addTailLights(1.0);
    this._addExhaustPipes(m, 1.05);
    this._addWheels(m, [
      { x: -0.75, y: 0.20, z: -1.05, r: 0.22, w: 0.16 },
      { x:  0.75, y: 0.20, z: -1.05, r: 0.22, w: 0.16 },
      { x: -0.75, y: 0.22, z:  0.75, r: 0.24, w: 0.18 },
      { x:  0.75, y: 0.22, z:  0.75, r: 0.24, w: 0.18 },
    ]);
  }

  // ═══════════════════════════════════════════
  //  RALLY — rugged off-road (Luke)
  // ═══════════════════════════════════════════

  _buildRally(m) {
    this._exhaustZ = 1.4;
    const baseY = 0.06; // higher ride height

    // Main body (boxy, angular)
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-0.6, 0); bodyShape.lineTo(-0.8, 1.6);
    bodyShape.lineTo(-0.75, 2.8); bodyShape.lineTo(0.75, 2.8);
    bodyShape.lineTo(0.8, 1.6); bodyShape.lineTo(0.6, 0);
    bodyShape.closePath();
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bodyShape, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }), m.body);
    body.rotation.x = -Math.PI / 2; body.position.set(0, 0.22 + baseY, -1.6);
    this.group.add(body);

    // Cabin (tall, angular)
    const cabShape = new THREE.Shape();
    cabShape.moveTo(-0.5, 0); cabShape.lineTo(-0.6, 0.8);
    cabShape.lineTo(-0.5, 1.5); cabShape.lineTo(0.5, 1.5);
    cabShape.lineTo(0.6, 0.8); cabShape.lineTo(0.5, 0);
    cabShape.closePath();
    const cab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(cabShape, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }), m.body);
    cab.rotation.x = -Math.PI / 2; cab.position.set(0, 0.62 + baseY, -0.5);
    this.group.add(cab);

    // Windshield + rear
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.38, 0.04), m.glass);
    ws.position.set(0, 0.78 + baseY, -0.55); ws.rotation.x = -0.3;
    this.group.add(ws);
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 0.04), m.glass);
    rw.position.set(0, 0.72 + baseY, 0.9); rw.rotation.x = 0.45;
    this.group.add(rw);

    // Hood bulge (intercooler scoop)
    const bulge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.6), m.accent);
    bulge.position.set(0, 0.65 + baseY, -1.1);
    this.group.add(bulge);

    // Roof rack (chrome bars)
    for (const z of [-0.1, 0.5]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), m.chrome);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 1.05 + baseY, z);
      this.group.add(bar);
    }
    for (const x of [-0.35, 0.35]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), m.chrome);
      rail.position.set(x, 1.05 + baseY, 0.2);
      rail.rotation.x = Math.PI / 2;
      this.group.add(rail);
    }

    // Roof light bar
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 0.5 }));
    lightBar.position.set(0, 1.1 + baseY, -0.25);
    this.group.add(lightBar);

    // Wheel arch extensions (mud flaps)
    const archMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    for (const pos of [[-0.95, -1.2], [0.95, -1.2], [-0.95, 0.9], [0.95, 0.9]]) {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.35), archMat);
      arch.position.set(pos[0], 0.3 + baseY, pos[1]);
      this.group.add(arch);
    }

    // Skid plate
    const skid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 2.5), m.chrome);
    skid.position.set(0, 0.1 + baseY, -0.2);
    this.group.add(skid);

    // Side mirrors
    for (const s of [-1, 1]) {
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), m.dark);
      mir.position.set(s * 0.72, 0.7 + baseY, -0.3);
      this.group.add(mir);
    }

    this._addHeadlights(-1.65);
    this._addTailLights(1.2);
    this._addExhaustPipes(m, 1.25);
    this._addWheels(m, [
      { x: -0.95, y: 0.26 + baseY, z: -1.2, r: 0.28, w: 0.22 },
      { x:  0.95, y: 0.26 + baseY, z: -1.2, r: 0.28, w: 0.22 },
      { x: -0.95, y: 0.28 + baseY, z:  0.9, r: 0.30, w: 0.24 },
      { x:  0.95, y: 0.28 + baseY, z:  0.9, r: 0.30, w: 0.24 },
    ]);
  }

  // ═══════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════

  setDriver(index) {
    const driver = DRIVER_TYPES[index] || DRIVER_TYPES[0];
    this._buildCar(driver);
    this.currentLane = 1;
    this.isSwitching = false;
    this.group.position.x = LANE_POSITIONS[1];
    this.group.traverse(c => { if (c.isMesh) c.castShadow = true; });
  }

  switchLane(direction) {
    if (this.isSwitching) return;
    const newLane = direction === 'left'
      ? Math.max(0, this.currentLane - 1)
      : Math.min(2, this.currentLane + 1);
    if (newLane === this.currentLane) return;
    this.currentLane = newLane;
    this.isSwitching = true;

    const targetX = LANE_POSITIONS[this.currentLane];
    const tilt = direction === 'left' ? 0.18 : -0.18;

    new Tween(this.group.rotation, tweenGroup)
      .to({ z: tilt }, LANE_SWITCH_DURATION * 0.4)
      .easing(Easing.Quadratic.Out).start();

    new Tween(this.group.position, tweenGroup)
      .to({ x: targetX }, LANE_SWITCH_DURATION)
      .easing(Easing.Quadratic.Out)
      .onComplete(() => {
        this.isSwitching = false;
        new Tween(this.group.rotation, tweenGroup)
          .to({ z: 0 }, LANE_SWITCH_DURATION * 0.5)
          .easing(Easing.Quadratic.Out).start();
      }).start();
  }

  update(delta, speed, isAccelerating = false) {
    const spin = speed * 0.3;
    this.wheels.forEach(w => { if (w.children[0]) w.children[0].rotation.x += spin * delta; });
    if (isAccelerating && speed > 20) this._emitExhaust(delta);
    this._updateExhaust(delta, speed);
  }

  _emitExhaust(delta) {
    if (!this._exhaustParticles) {
      this._exhaustParticles = [];
      const geo = new THREE.SphereGeometry(0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.4 });
      for (let i = 0; i < 10; i++) {
        const p = new THREE.Mesh(geo, mat.clone());
        p.visible = false; p.userData = { life: 0, vy: 0 };
        this.group.parent.add(p);
        this._exhaustParticles.push(p);
      }
    }
    for (const p of this._exhaustParticles) {
      if (p.visible) continue;
      p.visible = true;
      p.position.set(this.group.position.x + (Math.random() - 0.5) * 0.2, 0.35, this.group.position.z + this._exhaustZ);
      p.scale.setScalar(0.4 + Math.random() * 0.4);
      p.material.opacity = 0.35;
      p.userData.life = 0.3 + Math.random() * 0.25;
      p.userData.vy = 0.4 + Math.random() * 0.4;
      break;
    }
  }

  _updateExhaust(delta, speed) {
    if (!this._exhaustParticles) return;
    for (const p of this._exhaustParticles) {
      if (!p.visible) continue;
      p.userData.life -= delta;
      if (p.userData.life <= 0) { p.visible = false; continue; }
      p.position.y += p.userData.vy * delta;
      p.position.z += speed * delta;
      p.material.opacity = p.userData.life * 0.7;
      p.scale.multiplyScalar(1 + delta * 2.5);
    }
  }
}
