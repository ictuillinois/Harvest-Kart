import * as THREE from 'three';
import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';
import { LANE_POSITIONS, LANE_SWITCH_DURATION, DRIVER_TYPES } from '../utils/constants.js';
import { getModel, MODEL_URLS } from '../utils/assetLoader.js';

// Driver ID → model URL mapping
const DRIVER_VEHICLES = {
  sportsGT: MODEL_URLS.vehicleEthan,
  compact:  MODEL_URLS.vehicleKate,
  formula:  MODEL_URLS.vehicleDestiny,
  rally:    MODEL_URLS.vehicleLuke,
};

/**
 * Player vehicle — loads GLTF models from Kenney Car Kit.
 * Each model has: body, wheel-front-left/right, wheel-back-left/right, optional spoiler.
 * All share a single 'colormap' texture atlas material — we replace per-node.
 */
export class Kart {
  constructor(scene) {
    this.group = new THREE.Group();
    this.wheels = [];      // primitive wheel groups (legacy compat)
    this._wheelMeshes = []; // GLTF wheel nodes for rotation
    this._bodyMeshes = [];
    this.currentLane = 1;
    this.isSwitching = false;
    this._exhaustZ = 1.6;

    this._buildCar(DRIVER_TYPES[0]);
    this.group.position.set(LANE_POSITIONS[1], 0, 0);
    this.group.traverse(c => { if (c.isMesh) c.castShadow = true; });
    scene.add(this.group);
  }

  // ═══════════════════════════════════════════
  //  DARK VEHICLE DETECTION
  // ═══════════════════════════════════════════
  static _isDark(hexColor) {
    const c = new THREE.Color(hexColor);
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) < 0.15;
  }

  // ═══════════════════════════════════════════
  //  MAIN BUILD — GLTF MODEL LOADING
  // ═══════════════════════════════════════════

  _buildCar(driver) {
    // Clear previous model
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.wheels = [];
    this._wheelMeshes = [];
    this._bodyMeshes = [];

    const dark = Kart._isDark(driver.carBody);
    const modelUrl = DRIVER_VEHICLES[driver.vehicleType];

    // Load GLTF model (preloaded, returns normalized clone)
    let model = modelUrl ? getModel(modelUrl) : null;

    // Fallback if model not loaded
    if (!model || model.children.length === 0) {
      console.warn(`Failed to load vehicle model for ${driver.vehicleType}, using fallback`);
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 3),
        new THREE.MeshStandardMaterial({ color: driver.carBody })
      );
      fallback.position.y = 0.5;
      this.group.add(fallback);
      this._exhaustZ = 1.5;
      this._driverColor = driver.carBody;
      return;
    }

    // ── Per-part material customization (preserving texture atlas) ──
    // Kenney models: body (paint+windows+lights via UV atlas), spoiler (ethan only), 4 wheels.
    // The texture atlas contains baked regions for paint, glass, headlights, taillights, trim.
    // We tint the body material color which multiplies over the atlas — paint areas take
    // the driver color while window/light/trim regions stay mostly neutral.
    model.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();

      if (name === 'body' || name === 'spoiler') {
        child.material = child.material.clone();
        child.material.color.set(dark ? 0x2a2a30 : driver.carBody);
        child.material.metalness = dark ? 0.7 : 0.35;
        child.material.roughness = dark ? 0.08 : 0.25;
        child.material.emissive = new THREE.Color(dark ? 0x0a0a10 : driver.carBody);
        child.material.emissiveIntensity = dark ? 0.15 : 0.08;
        child.material.envMapIntensity = dark ? 1.8 : 1.0;
        this._bodyMeshes.push(child);
      }

      if (name.includes('wheel')) {
        child.material = child.material.clone();
        child.material.color.set(0x2a2a2a);
        child.material.roughness = 0.7;
        child.material.metalness = 0.15;
        child.material.envMapIntensity = 0.3;
        this._wheelMeshes.push(child);
      }
    });

    // Position model so bottom sits on Y=0 (road surface)
    const bbox = new THREE.Box3().setFromObject(model);
    model.position.y = -bbox.min.y;

    // Kenney cars face +Z by default; our game camera looks from +Z toward -Z,
    // so car rear should face camera (+Z). Rotate 180° to face forward (-Z).
    model.rotation.y = Math.PI;

    this.group.add(model);
    this._model = model;

    // Recompute bbox after positioning
    const finalBox = new THREE.Box3().setFromObject(model);
    const size = finalBox.getSize(new THREE.Vector3());

    // Store exhaust Z position (rear of car, toward camera = +Z)
    this._exhaustZ = size.z * 0.5;

    // ── Vehicle lighting rig ──
    this._attachLightingRig(finalBox, driver, dark);

    this._driverColor = driver.carBody;
  }

  // ═══════════════════════════════════════════
  //  LIGHTING RIG — adapts to model bounds
  // ═══════════════════════════════════════════

  _attachLightingRig(bbox, driver, dark) {
    const size = bbox.getSize(new THREE.Vector3());
    const halfW = size.x / 2;
    const halfL = size.z / 2;
    const height = size.y;

    const fillMul = dark ? 1.5 : 1.0;

    // Overhead fill — tight radius, only illuminates kart
    const fillTop = new THREE.PointLight(0xffffff, 2.0 * fillMul, 10, 2);
    fillTop.position.set(0, height + 2.5, 0);
    this.group.add(fillTop);

    // Rear chase-cam fill — tight radius
    const fillRear = new THREE.PointLight(0xffffff, 1.8 * fillMul, 10, 2);
    fillRear.position.set(0, height + 1, halfL + 3);
    this.group.add(fillRear);

    // Low front fill — tight radius
    const fillLow = new THREE.PointLight(0xddeeff, 1.0 * fillMul, 8, 2);
    fillLow.position.set(0, height * 0.5, -halfL);
    this.group.add(fillLow);

    // ── Underglow — only lights the road directly under the kart ──
    const underglowColor = dark ? 0x4488ff : driver.carBody;
    const underglowIntensity = dark ? 4.0 : 2.5;
    this._underglow = new THREE.PointLight(underglowColor, underglowIntensity, 6, 2);
    this._underglow.position.set(0, 0.15, 0);
    this.group.add(this._underglow);

    // ── Headlights (front of car = -Z) ──
    const headlightY = height * 0.4;
    const headlightZ = -(halfL + 0.1);
    const hlBulbMat = new THREE.MeshStandardMaterial({
      color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 1.5,
    });
    // Glow halo around each headlight
    const hlGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffffdd, transparent: true, opacity: 0.25, depthWrite: false,
    });
    for (const x of [-halfW * 0.6, halfW * 0.6]) {
      // Bright bulb
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), hlBulbMat);
      hl.position.set(x, headlightY, headlightZ);
      this.group.add(hl);

      // Soft glow disc
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.25, 8), hlGlowMat);
      glow.position.set(x, headlightY, headlightZ - 0.02);
      this.group.add(glow);

      // PointLight casting warm light forward onto road
      const hlLight = new THREE.PointLight(0xfff5dd, 1.5, 8, 2);
      hlLight.position.set(x, headlightY, headlightZ - 0.1);
      this.group.add(hlLight);
    }

    // ── Taillight emissive strips (rear of car = +Z) ──
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.2,
    });
    const taillightY = height * 0.35;
    const taillightZ = halfL + 0.05;
    for (const x of [-halfW * 0.5, -halfW * 0.2, halfW * 0.2, halfW * 0.5]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.03), tlMat);
      tl.position.set(x, taillightY, taillightZ);
      this.group.add(tl);
    }
    // Rain light (center)
    const rain = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 0.8, 0.04, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.2 }));
    rain.position.set(0, taillightY - 0.06, taillightZ);
    this.group.add(rain);

    // ── Taillight point lights — tight radius to avoid tinting scenery ──
    const tailIntensity = dark ? 2.5 : 1.5;
    const tailL = new THREE.PointLight(0xff2200, tailIntensity, 6, 2);
    tailL.position.set(-halfW * 0.4, taillightY, taillightZ);
    this.group.add(tailL);
    const tailR = new THREE.PointLight(0xff2200, tailIntensity, 6, 2);
    tailR.position.set(halfW * 0.4, taillightY, taillightZ);
    this.group.add(tailR);
    this._tailLights = [tailL, tailR];

    // ── Exhaust pipes ──
    const exhaustY = height * 0.25;
    const exhaustZ = taillightZ + 0.05;
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.15 });
    for (const x of [-halfW * 0.25, halfW * 0.25]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 8), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, exhaustY, exhaustZ);
      this.group.add(pipe);

      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8),
        new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 }));
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, exhaustY, exhaustZ + 0.14);
      this.group.add(glow);
    }

    // ── Side accent strips (MeshBasicMaterial = always visible) ──
    const sideColor = dark ? 0xccccdd : driver.carAccent;
    const sideOpacity = dark ? 0.9 : 0.7;
    const sideThickness = dark ? 0.05 : 0.03;
    const accentEdgeMat = new THREE.MeshBasicMaterial({ color: sideColor, transparent: true, opacity: sideOpacity });
    for (const xOff of [-(halfW + 0.05), halfW + 0.05]) {
      const side = new THREE.Mesh(
        new THREE.BoxGeometry(sideThickness, height * 0.25, size.z * 0.7), accentEdgeMat);
      side.position.set(xOff, height * 0.3, 0);
      this.group.add(side);
    }
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
    // GLTF wheel rotation
    if (this._wheelMeshes.length > 0) {
      const rotationSpeed = (speed / 30) * delta * Math.PI * 2;
      this._wheelMeshes.forEach(w => {
        w.rotation.x += rotationSpeed;
      });
    }
    // Legacy primitive wheel rotation (fallback)
    if (this.wheels.length > 0) {
      const spin = speed * 0.3;
      this.wheels.forEach(w => { if (w.children[0]) w.children[0].rotation.x += spin * delta; });
    }
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
