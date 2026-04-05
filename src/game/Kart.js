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

// Per-vehicle material finish profiles
const MATERIAL_PROFILES = {
  candy:     { metalness: 0.25, roughness: 0.30, emissiveIntensity: 0.04, envMapIntensity: 1.0 },
  raceMetal: { metalness: 0.55, roughness: 0.15, emissiveIntensity: 0.22, envMapIntensity: 1.8 },
  matte:     { metalness: 0.15, roughness: 0.45, emissiveIntensity: 0.03, envMapIntensity: 0.6 },
  rallySatin:{ metalness: 0.35, roughness: 0.22, emissiveIntensity: 0.20, envMapIntensity: 1.6 },
};

// Per-vehicle FBX mesh config (names from FBX inspection)
const VEHICLE_MESH_CONFIG = {
  sportsGT: {
    // Ethan: single mesh, no separate wheels, embedded texture
    bodyNames: ['sonata_pantera_grey'],
    wheelNames: [],
    wheelRotation: false,
    hiddenNames: [],
    rotationY: Math.PI,
    hasTexture: true,
    glassTint: 0x0e1a2a,
    sportsLights: true,        // upgraded headlights + full-width taillights
    // Sedan proportions — mid-height lights
    headlightYFrac: 0.30,
    headlightXFrac: 0.52,
    taillightYFrac: 0.30,
    taillightXFrac: 0.42,
  },
  compact: {
    // Kate: Body with 5 materials (no textures), combined wheel groups
    bodyNames: ['body'],
    wheelNames: ['front_wheels001', 'back_wheels001'],
    wheelRotation: false,
    hiddenNames: [],
    rotationY: Math.PI,
    hasTexture: false,
    paintIndices: [0, 3],
    glassIndices: [1, 4],
    chromeIndices: [2],
    glassTint: 0x1a1228,
    materialProfile: 'candy',
    compactLights: true,       // compact-style headlights + taillights
    // Compact car — lights sit higher
    headlightYFrac: 0.40,
    headlightXFrac: 0.50,
    taillightYFrac: 0.38,
    taillightXFrac: 0.38,
  },
  formula: {
    // Destiny: AMG GT, 4 individual wheels, palette texture
    bodyNames: ['amg_gt_body'],
    wheelNames: ['lfwheel001', 'rrwheel', 'rfwheel001', 'lrwheel002'],
    wheelRotation: true,
    wheelAxis: 'z',
    hiddenNames: [],
    rotationY: -Math.PI / 2,
    hasTexture: true,
    paintIndices: [0],
    accentIndices: [1],
    glassIndices: [2],
    glassTint: 0x080810,       // near-black glass — contrasts with blue body
    materialProfile: 'raceMetal',
    sportsDetails: true,       // triggers _addSportsDetails
    sportsLights: true,        // upgraded headlights + full-width LED taillight bar
    emissiveOnlyTint: true,    // don't color-multiply texture; use emissive for color identity
    // Low sports car — headlights low and wide
    headlightYFrac: 0.22,
    headlightXFrac: 0.65,
    taillightYFrac: 0.25,
    taillightXFrac: 0.55,
  },
  rally: {
    // Luke: kuzov + detail parts + 4 wheels (Russian naming)
    bodyNames: ['kuzov'],
    wheelNames: ['kolesofr', 'kolesobr', 'kolesobl', 'kolesofl'],
    wheelRotation: true,
    wheelAxis: 'x',
    hubNames: ['stupizafr', 'stupizafl', 'stupizabl', 'stupizabr'],
    glassNames: ['steklo_digatelya', 'stekla_perednih_far'],
    brakeLightNames: ['stop_signali'],
    headlightMeshNames: ['front_fari'],
    chromeNames: ['zerkalo'],
    hiddenNames: ['hullcollider'],
    rotationY: Math.PI,
    hasTexture: true,
    glassTint: 0x060a08,         // near-black with green tint — contrasts green body
    materialProfile: 'rallySatin',
    emissiveOnlyTint: true,      // preserve texture palette; green via emissive
    rallyLights: true,           // SUV-style vertical taillights
    hasModelHeadlights: true,
    // SUV — taillights sit higher
    taillightYFrac: 0.38,
    taillightXFrac: 0.45,
  },
};

/**
 * Player vehicle — loads FBX models.
 * Per-vehicle mesh config maps body/wheel/hidden nodes.
 * Materials are upgraded to MeshStandardMaterial and tinted per driver.
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
    this.laneSwitchMs = LANE_SWITCH_DURATION; // overridden per driver

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
  //  SPORTS LIGHT GEOMETRY (static — shared with DriverSelect)
  // ═══════════════════════════════════════════

  static _addSportsHeadlights(group, halfW, hlY, hlZ, hlXFrac, height) {
    // Dark chrome housing
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x111118, metalness: 0.8, roughness: 0.2,
    });
    // Chrome bezel
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, metalness: 0.92, roughness: 0.06, envMapIntensity: 2.5,
    });
    // Projector lens (bright center)
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffdd, emissiveIntensity: 2.0,
      metalness: 0.3, roughness: 0.05,
    });
    // Halo glow
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xeeeeff, transparent: true, opacity: 0.20, depthWrite: false,
    });
    // DRL strip (integrated)
    const drlMat = new THREE.MeshBasicMaterial({ color: 0xddeeff });

    for (const x of [-halfW * hlXFrac, halfW * hlXFrac]) {
      // Housing box (wider, sleeker)
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.42, height * 0.10, 0.08), housingMat);
      housing.position.set(x, hlY, hlZ + 0.03);
      group.add(housing);

      // Chrome bezel ring
      const bezel = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.13, 10), bezelMat);
      bezel.position.set(x, hlY, hlZ - 0.01);
      group.add(bezel);

      // Projector lens (bright sphere)
      const lens = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6), lensMat);
      lens.position.set(x, hlY, hlZ);
      group.add(lens);

      // Halo glow disc
      const halo = new THREE.Mesh(
        new THREE.CircleGeometry(0.28, 10), haloMat);
      halo.position.set(x, hlY, hlZ - 0.03);
      group.add(halo);

      // Integrated DRL strip (below projector)
      const drl = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.32, 0.018, 0.012), drlMat);
      drl.position.set(x, hlY - height * 0.045, hlZ);
      group.add(drl);
    }
  }

  static _addSportsTaillights(group, halfW, tlY, tlZ, height) {
    // Full-width LED bar material
    const ledBarMat = new THREE.MeshStandardMaterial({
      color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.4,
      metalness: 0.3, roughness: 0.15,
    });
    // Chrome surround
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, metalness: 0.92, roughness: 0.06, envMapIntensity: 2.5,
    });
    // Darker red segments within the bar
    const segmentMat = new THREE.MeshStandardMaterial({
      color: 0xcc0000, emissive: 0xaa0000, emissiveIntensity: 0.8,
      metalness: 0.4, roughness: 0.2,
    });
    // Red glow plane
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff2200, transparent: true, opacity: 0.15, depthWrite: false,
    });

    // Main LED bar (full width)
    const barW = halfW * 1.6;
    const barH = height * 0.035;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(barW, barH, 0.02), ledBarMat);
    bar.position.set(0, tlY, tlZ);
    group.add(bar);

    // LED segments within the bar (6 segments)
    for (let si = 0; si < 6; si++) {
      const segX = (si - 2.5) * (barW / 6);
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(barW / 7.5, barH * 0.7, 0.025), segmentMat);
      seg.position.set(segX, tlY, tlZ + 0.005);
      group.add(seg);
    }

    // Chrome surround frame (top + bottom rails)
    const frameTop = new THREE.Mesh(
      new THREE.BoxGeometry(barW * 1.05, 0.012, 0.012), chromeMat);
    frameTop.position.set(0, tlY + barH * 0.6, tlZ);
    group.add(frameTop);
    const frameBot = new THREE.Mesh(
      new THREE.BoxGeometry(barW * 1.05, 0.012, 0.012), chromeMat);
    frameBot.position.set(0, tlY - barH * 0.6, tlZ);
    group.add(frameBot);

    // Chrome end caps
    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, barH * 1.2, 0.015), chromeMat);
      cap.position.set(side * barW * 0.525, tlY, tlZ);
      group.add(cap);
    }

    // Red glow plane (behind the bar, visible from chase cam)
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(barW * 1.2, height * 0.08), glowMat);
    glow.position.set(0, tlY, tlZ + 0.03);
    glow.rotation.y = Math.PI;
    group.add(glow);
  }

  static _addSUVTaillights(group, halfW, tlY, tlZ, tlXFrac, height) {
    // Vertical LED bars on each side (SUV style)
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.3,
      metalness: 0.3, roughness: 0.15,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, metalness: 0.92, roughness: 0.06, envMapIntensity: 2.5,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff2200, transparent: true, opacity: 0.14, depthWrite: false,
    });

    for (const side of [-1, 1]) {
      const x = side * halfW * tlXFrac;

      // Vertical LED bar
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.12, height * 0.14, 0.02), ledMat);
      bar.position.set(x, tlY, tlZ);
      group.add(bar);

      // Inner LED segments (3 stacked)
      const segMat = new THREE.MeshStandardMaterial({
        color: 0xcc0000, emissive: 0xaa0000, emissiveIntensity: 0.9,
        metalness: 0.4, roughness: 0.2,
      });
      for (let si = -1; si <= 1; si++) {
        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(halfW * 0.08, height * 0.03, 0.025), segMat);
        seg.position.set(x, tlY + si * height * 0.04, tlZ + 0.005);
        group.add(seg);
      }

      // Chrome bezel frame
      const frameL = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, height * 0.16, 0.015), chromeMat);
      frameL.position.set(x - halfW * 0.07, tlY, tlZ);
      group.add(frameL);
      const frameR = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, height * 0.16, 0.015), chromeMat);
      frameR.position.set(x + halfW * 0.07, tlY, tlZ);
      group.add(frameR);
      const frameT = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.14, 0.012, 0.015), chromeMat);
      frameT.position.set(x, tlY + height * 0.075, tlZ);
      group.add(frameT);
      const frameB = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.14, 0.012, 0.015), chromeMat);
      frameB.position.set(x, tlY - height * 0.075, tlZ);
      group.add(frameB);

      // Red glow behind each bar
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(halfW * 0.20, height * 0.18), glowMat);
      glow.position.set(x, tlY, tlZ + 0.03);
      glow.rotation.y = Math.PI;
      group.add(glow);
    }

    // Connecting strip between the two vertical bars
    const connectMat = new THREE.MeshStandardMaterial({
      color: 0xaa0000, emissive: 0x880000, emissiveIntensity: 0.5,
      metalness: 0.3, roughness: 0.25,
    });
    const connect = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * (tlXFrac * 1.6), 0.018, 0.015), connectMat);
    connect.position.set(0, tlY - height * 0.06, tlZ);
    group.add(connect);
  }

  static _addCompactHeadlights(group, halfW, hlY, hlZ, hlXFrac, height) {
    // Round headlight housings (compact/cute style)
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x181820, metalness: 0.75, roughness: 0.2,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, metalness: 0.92, roughness: 0.06, envMapIntensity: 2.5,
    });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffdd, emissiveIntensity: 2.0,
      metalness: 0.3, roughness: 0.05,
    });
    const drlMat = new THREE.MeshBasicMaterial({ color: 0xffeeff });

    for (const x of [-halfW * hlXFrac, halfW * hlXFrac]) {
      // Round housing (sphere cutout look)
      const housing = new THREE.Mesh(
        new THREE.SphereGeometry(height * 0.065, 8, 6), housingMat);
      housing.position.set(x, hlY, hlZ + 0.02);
      housing.scale.z = 0.5;
      group.add(housing);

      // Chrome ring bezel
      const bezel = new THREE.Mesh(
        new THREE.RingGeometry(height * 0.05, height * 0.07, 12), chromeMat);
      bezel.position.set(x, hlY, hlZ - 0.01);
      group.add(bezel);

      // Bright projector lens
      const lens = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6), lensMat);
      lens.position.set(x, hlY, hlZ);
      group.add(lens);

      // DRL arc (small curved strip below lens)
      const drl = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.22, 0.015, 0.012), drlMat);
      drl.position.set(x, hlY - height * 0.04, hlZ);
      group.add(drl);

      // Halo glow
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffeeff, transparent: true, opacity: 0.20, depthWrite: false,
      });
      const halo = new THREE.Mesh(new THREE.CircleGeometry(0.20, 10), haloMat);
      halo.position.set(x, hlY, hlZ - 0.03);
      group.add(halo);
    }
  }

  static _addCompactTaillights(group, halfW, tlY, tlZ, tlXFrac, height) {
    // Round taillights with chrome ring (compact car style)
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xff0044, emissive: 0xff0033, emissiveIntensity: 1.3,
      metalness: 0.3, roughness: 0.15,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, metalness: 0.92, roughness: 0.06, envMapIntensity: 2.5,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff2244, transparent: true, opacity: 0.15, depthWrite: false,
    });

    for (const side of [-1, 1]) {
      const x = side * halfW * tlXFrac;

      // Round LED cluster
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(height * 0.05, 8, 6), ledMat);
      led.position.set(x, tlY, tlZ);
      led.scale.z = 0.4;
      group.add(led);

      // Chrome bezel ring
      const bezel = new THREE.Mesh(
        new THREE.RingGeometry(height * 0.04, height * 0.06, 12), chromeMat);
      bezel.position.set(x, tlY, tlZ + 0.01);
      group.add(bezel);

      // Red glow disc
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(height * 0.08, 10), glowMat);
      glow.position.set(x, tlY, tlZ + 0.02);
      glow.rotation.y = Math.PI;
      group.add(glow);
    }

    // Connecting strip (thin pink bar between the two round lights)
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xcc0033, emissive: 0xaa0022, emissiveIntensity: 0.6,
      metalness: 0.3, roughness: 0.25,
    });
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * (tlXFrac * 1.4), 0.015, 0.012), stripMat);
    strip.position.set(0, tlY - height * 0.04, tlZ);
    group.add(strip);
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

    // ── Per-part material customization (config-driven for FBX models) ──
    const meshConfig = VEHICLE_MESH_CONFIG[driver.vehicleType] || {};
    const bodySet = new Set((meshConfig.bodyNames || []).map(n => n.toLowerCase()));
    const wheelSet = new Set((meshConfig.wheelNames || []).map(n => n.toLowerCase()));
    const hubSet = new Set((meshConfig.hubNames || []).map(n => n.toLowerCase()));
    const hideSet = new Set((meshConfig.hiddenNames || []).map(n => n.toLowerCase()));
    const glassNameSet = new Set((meshConfig.glassNames || []).map(n => n.toLowerCase()));
    const brakeSet = new Set((meshConfig.brakeLightNames || []).map(n => n.toLowerCase()));
    const hlMeshSet = new Set((meshConfig.headlightMeshNames || []).map(n => n.toLowerCase()));
    const chromeNameSet = new Set((meshConfig.chromeNames || []).map(n => n.toLowerCase()));
    const glassIdxSet = new Set(meshConfig.glassIndices || []);
    const chromeIdxSet = new Set(meshConfig.chromeIndices || []);

    // Upgrade FBX MeshPhongMaterial → MeshStandardMaterial for PBR
    const upgradeMat = (mat) => {
      if (mat.type === 'MeshPhongMaterial') {
        const std = new THREE.MeshStandardMaterial();
        std.color.copy(mat.color);
        if (mat.map) { std.map = mat.map; std.map.colorSpace = THREE.SRGBColorSpace; }
        std.metalness = 0.3;
        std.roughness = 0.4;
        if (mat.transparent) std.transparent = true;
        if (mat.opacity < 1) std.opacity = mat.opacity;
        return std;
      }
      return mat.clone();
    };

    // Reusable material factories
    const makeGlass = (tint) => new THREE.MeshStandardMaterial({
      color: tint || meshConfig.glassTint || 0x112233,
      metalness: 0.85,
      roughness: 0.08,
      transparent: true,
      opacity: 0.70,
      envMapIntensity: 2.0,
    });

    const makeChrome = () => new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.95,
      roughness: 0.08,
      envMapIntensity: 2.0,
    });

    const makeBrakeLight = () => new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff0000,
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.15,
    });

    const makeHeadlightMesh = () => new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffdd,
      emissiveIntensity: 1.8,
      metalness: 0.3,
      roughness: 0.05,
    });

    // Apply paint material properties — returns the material (may replace input)
    const applyPaint = (std) => {
      if (dark) {
        // ── Dark vehicle (Ethan) — dark gray shiny clearcoat ──
        const phys = new THREE.MeshPhysicalMaterial();
        if (std.map) { phys.map = std.map; phys.map.colorSpace = THREE.SRGBColorSpace; }
        phys.color.set(meshConfig.hasTexture ? 0x787888 : 0x444454);
        phys.metalness = 0.60;
        phys.roughness = 0.10;
        phys.clearcoat = 1.0;
        phys.clearcoatRoughness = 0.02;
        phys.emissive = new THREE.Color(0x1e1e30);
        phys.emissiveIntensity = 0.55;
        phys.envMapIntensity = 3.2;
        phys.reflectivity = 0.95;
        return phys;
      } else if (meshConfig.emissiveOnlyTint) {
        // ── Automotive clearcoat — MeshPhysicalMaterial ──
        // Preserves texture palette (windows stay dark), adds color via emissive.
        const phys = new THREE.MeshPhysicalMaterial();
        if (std.map) { phys.map = std.map; phys.map.colorSpace = THREE.SRGBColorSpace; }
        phys.emissive = new THREE.Color(driver.carBody);

        if (meshConfig.materialProfile === 'rallySatin') {
          // Luke — Lamborghini satin clearcoat: green-tinted, moderate gloss
          phys.color.set(0xc8e0cc);          // light green-gray
          phys.metalness = 0.55;
          phys.roughness = 0.12;
          phys.clearcoat = 0.6;              // satin clearcoat (less than race)
          phys.clearcoatRoughness = 0.10;    // slightly textured topcoat
          phys.emissiveIntensity = 0.32;
          phys.envMapIntensity = 2.2;
          phys.reflectivity = 0.7;
        } else {
          // Destiny — race metallic: blue-tinted, full gloss
          phys.color.set(0xc8c8e0);          // light blue-gray
          phys.metalness = 0.72;
          phys.roughness = 0.08;
          phys.clearcoat = 1.0;
          phys.clearcoatRoughness = 0.03;
          phys.emissiveIntensity = 0.28;
          phys.envMapIntensity = 2.8;
          phys.reflectivity = 0.9;
        }
        return phys;
      } else {
        // ── Light vehicle path — use material profile if available ──
        const profile = MATERIAL_PROFILES[meshConfig.materialProfile];
        std.color.set(driver.carBody);
        std.emissive = new THREE.Color(driver.carBody);
        if (profile) {
          std.metalness = profile.metalness;
          std.roughness = profile.roughness;
          std.emissiveIntensity = profile.emissiveIntensity;
          std.envMapIntensity = profile.envMapIntensity;
        } else {
          std.metalness = meshConfig.hasTexture ? 0.4 : 0.35;
          std.roughness = meshConfig.hasTexture ? 0.22 : 0.25;
          std.emissiveIntensity = meshConfig.hasTexture ? 0.06 : 0.08;
          std.envMapIntensity = meshConfig.hasTexture ? 1.4 : 1.0;
        }
        return std;
      }
    };

    model.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();

      // Hide collision meshes
      if (hideSet.has(name)) {
        child.visible = false;
        return;
      }

      // ── Named glass meshes (Luke's windows) ──
      if (glassNameSet.has(name)) {
        child.material = makeGlass();
        return;
      }

      // ── Named chrome meshes (Luke's mirrors) ──
      if (chromeNameSet.has(name)) {
        child.material = makeChrome();
        return;
      }

      // ── Named brake light meshes (Luke) ──
      if (brakeSet.has(name)) {
        child.material = makeBrakeLight();
        return;
      }

      // ── Named headlight meshes (Luke) ──
      if (hlMeshSet.has(name)) {
        child.material = makeHeadlightMesh();
        return;
      }

      // ── Body meshes ──
      const accentIdxSet = new Set(meshConfig.accentIndices || []);

      if (bodySet.has(name)) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((m, idx) => {
            // Glass material indices (Kate windows, Destiny windows)
            if (glassIdxSet.has(idx)) return makeGlass();
            // Chrome material indices (Kate trim)
            if (chromeIdxSet.has(idx)) return makeChrome();
            // Accent panels (Destiny secondary) — lighter tint using accent color
            if (accentIdxSet.has(idx)) {
              if (meshConfig.emissiveOnlyTint) {
                // Automotive clearcoat accent — slightly different finish from primary
                const phys = new THREE.MeshPhysicalMaterial();
                if (m.map) { const std2 = upgradeMat(m); phys.map = std2.map; }
                phys.color.set(0xbbbbdd);
                phys.metalness = 0.65;
                phys.roughness = 0.12;
                phys.clearcoat = 0.8;
                phys.clearcoatRoughness = 0.06;
                phys.emissive = new THREE.Color(driver.carAccent);
                phys.emissiveIntensity = 0.25;
                phys.envMapIntensity = 2.2;
                return phys;
              }
              const std = upgradeMat(m);
              std.color.set(dark ? 0x444450 : driver.carAccent);
              std.emissive = new THREE.Color(dark ? 0x060608 : driver.carAccent);
              std.emissiveIntensity = dark ? 0.1 : 0.05;
              std.metalness = dark ? 0.6 : 0.3;
              std.roughness = dark ? 0.12 : 0.3;
              std.envMapIntensity = dark ? 1.5 : 1.0;
              return std;
            }
            // Non-paint trim (leave un-tinted)
            if (meshConfig.paintIndices && !meshConfig.paintIndices.includes(idx)) {
              const std = upgradeMat(m);
              std.metalness = 0.4;
              std.roughness = 0.3;
              return std;
            }
            // Paint surfaces
            const std = upgradeMat(m);
            return applyPaint(std);
          });
        } else {
          child.material = applyPaint(upgradeMat(child.material));
        }
        this._bodyMeshes.push(child);
        return;
      }

      // ── Wheel meshes ──
      if (wheelSet.has(name)) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => {
            const std = upgradeMat(m);
            std.color.set(0x2a2a2a);
            std.roughness = 0.7;
            std.metalness = 0.15;
            std.envMapIntensity = 0.3;
            return std;
          });
        } else {
          child.material = upgradeMat(child.material);
          child.material.color.set(0x2a2a2a);
          child.material.roughness = 0.7;
          child.material.metalness = 0.15;
          child.material.envMapIntensity = 0.3;
        }
        this._wheelMeshes.push(child);
        return;
      }

      // ── Hub assemblies (Luke) — polished alloy ──
      if (hubSet.has(name)) {
        child.material = upgradeMat(child.material);
        child.material.color.set(0x888890);
        child.material.metalness = 0.85;
        child.material.roughness = 0.12;
        child.material.envMapIntensity = 1.8;
        return;
      }

      // ── Unmatched meshes — upgrade material but don't tint ──
      if (Array.isArray(child.material)) {
        child.material = child.material.map(m => upgradeMat(m));
      } else {
        child.material = upgradeMat(child.material);
      }
    });

    // Store wheel rotation config
    this._wheelCanRotate = meshConfig.wheelRotation !== false;
    this._wheelAxis = meshConfig.wheelAxis || 'x';

    // Position model so bottom sits on Y=0 (road surface)
    const bbox = new THREE.Box3().setFromObject(model);
    model.position.y = -bbox.min.y;

    // Rotate model to face forward (-Z) based on per-vehicle config
    model.rotation.y = meshConfig.rotationY ?? Math.PI;

    this.group.add(model);
    this._model = model;

    // Recompute bbox after positioning
    const finalBox = new THREE.Box3().setFromObject(model);
    const size = finalBox.getSize(new THREE.Vector3());

    // Store exhaust Z position (rear of car, toward camera = +Z)
    this._exhaustZ = size.z * 0.5;

    // ── Vehicle lighting rig ──
    this._attachLightingRig(finalBox, driver, dark, meshConfig);

    // ── Glass overlays for single-texture models (Ethan, Luke) ──
    if (meshConfig.glassOverlay) {
      this._addGlassOverlays(finalBox, meshConfig.glassOverlay);
    }

    // ── Edge rim strips for dark vehicles (contour visibility) ──
    if (dark) {
      this._addEdgeRim(finalBox);
    }

    // ── Ethan GT detail package — chrome trim, DRLs, markers ──
    if (dark && driver.vehicleType === 'sportsGT') {
      this._addGTDetails(finalBox);
    }

    // ── Destiny sports detail package — chrome, DRLs, splitter, diffuser ──
    if (meshConfig.sportsDetails) {
      this._addSportsDetails(finalBox, driver);
    }

    // ── Luke rally detail package — roof rails, bull bar, side steps ──
    if (meshConfig.rallyDetails) {
      this._addRallyDetails(finalBox, driver);
    }

    this._driverColor = driver.carBody;
  }

  // ═══════════════════════════════════════════
  //  LIGHTING RIG — adapts to model bounds
  // ═══════════════════════════════════════════

  _attachLightingRig(bbox, driver, dark, meshConfig = {}) {
    const size = bbox.getSize(new THREE.Vector3());
    const halfW = size.x / 2;
    const halfL = size.z / 2;
    const height = size.y;

    // ── Fill light — overhead, slightly behind camera ──
    const fillInt = dark ? 6.0 : (meshConfig.emissiveOnlyTint ? 4.5 : 3.0);
    const fill = new THREE.PointLight(dark ? 0xddeeff : 0xffffff, fillInt, 14, 2);
    fill.position.set(0, height + 2, halfL + 2);
    this.group.add(fill);

    // ── Underglow — single consolidated light ──
    const underglowColor = dark ? 0x88bbff : driver.carBody;
    const underglowInt = (dark || meshConfig.emissiveOnlyTint) ? 6.0 : 2.5;
    this._underglow = new THREE.PointLight(underglowColor, underglowInt, 8, 2);
    this._underglow.position.set(0, 0.12, 0);
    this.group.add(this._underglow);

    // ── Headlights ──
    if (meshConfig.hasModelHeadlights) {
      // Model has its own headlight meshes — add PointLight for actual illumination
      const modelHlLight = new THREE.PointLight(0xffffdd, 2.5, 8, 2);
      modelHlLight.position.set(0, height * 0.35, -(halfL + 0.2));
      this.group.add(modelHlLight);
    }
    if (!meshConfig.hasModelHeadlights) {
      const hlYFrac = meshConfig.headlightYFrac || 0.35;
      const hlXFrac = meshConfig.headlightXFrac || 0.55;
      const hlY = height * hlYFrac;
      const hlZ = -(halfL - 0.02);

      if (meshConfig.compactLights) {
        // ── Compact headlights — round housings, cute style ──
        Kart._addCompactHeadlights(this.group, halfW, hlY, hlZ, hlXFrac, height);
      } else if (meshConfig.sportsLights) {
        // ── Sports headlights — aggressive housing + projector + integrated DRL ──
        Kart._addSportsHeadlights(this.group, halfW, hlY, hlZ, hlXFrac, height);
      } else {
        // ── Standard headlights — bulb + glow ──
        const hlBulbMat = new THREE.MeshStandardMaterial({
          color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 1.5,
        });
        const hlGlowMat = new THREE.MeshBasicMaterial({
          color: 0xffffdd, transparent: true, opacity: 0.25, depthWrite: false,
        });
        for (const x of [-halfW * hlXFrac, halfW * hlXFrac]) {
          const hl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), hlBulbMat);
          hl.position.set(x, hlY, hlZ);
          this.group.add(hl);
          const glow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), hlGlowMat);
          glow.position.set(x, hlY, hlZ - 0.03);
          this.group.add(glow);
        }
      }
    }

    // ── Taillights ──
    const tlYFrac = meshConfig.taillightYFrac || 0.35;
    const tlXFrac = meshConfig.taillightXFrac || 0.4;
    const tlY = height * tlYFrac;
    const tlZ = halfL - 0.02;

    if (meshConfig.compactLights) {
      // ── Compact taillights — round LED clusters ──
      Kart._addCompactTaillights(this.group, halfW, tlY, tlZ, tlXFrac, height);
    } else if (meshConfig.rallyLights) {
      // ── SUV taillights — vertical LED bars ──
      Kart._addSUVTaillights(this.group, halfW, tlY, tlZ, tlXFrac, height);
    } else if (meshConfig.sportsLights) {
      // ── Sports taillights — full-width LED bar (AMG signature) ──
      Kart._addSportsTaillights(this.group, halfW, tlY, tlZ, height);
    } else {
      // ── Standard taillights — clusters + strip ──
      const tlMat = new THREE.MeshStandardMaterial({
        color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.0,
      });
      for (const x of [-halfW * tlXFrac, halfW * tlXFrac]) {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.02), tlMat);
        tl.position.set(x, tlY, tlZ);
        this.group.add(tl);
      }
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * (tlXFrac * 1.5), 0.025, 0.02), tlMat);
      strip.position.set(0, tlY - 0.04, tlZ);
      this.group.add(strip);
    }

    const tailLight = new THREE.PointLight(0xff2200, dark ? 2.5 : 1.5, 6, 2);
    tailLight.position.set(0, tlY, tlZ + 0.1);
    this.group.add(tailLight);
    this._tailLights = [tailLight];

    // ── Exhaust tips — chrome pipes with inner heat glow ──
    const exY = height * 0.15;
    const exZ = halfL + 0.02;
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.12 });
    const heatMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.5 });
    for (const x of [-halfW * 0.22, halfW * 0.22]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, exY, exZ);
      this.group.add(pipe);

      const heat = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), heatMat);
      heat.rotation.x = Math.PI / 2;
      heat.position.set(x, exY, exZ + 0.11);
      this.group.add(heat);
    }

    // ── Body highlight light for clearcoat vehicles (single consolidated) ──
    if (meshConfig.emissiveOnlyTint || dark) {
      const hlColor = dark ? 0xddeeff : 0xeeffee;
      const keyLight = new THREE.PointLight(hlColor, dark ? 5.0 : 2.5, 14, 2);
      keyLight.position.set(halfW * 0.3, height + 2, -(halfL * 0.1));
      this.group.add(keyLight);
    }
  }

  // ═══════════════════════════════════════════
  //  GLASS OVERLAYS — for single-texture models
  //  Adds transparent window planes at cabin region
  // ═══════════════════════════════════════════

  _addGlassOverlays(bbox, variant = true) {
    const size = bbox.getSize(new THREE.Vector3());
    const halfW = size.x / 2;
    const halfL = size.z / 2;
    const height = size.y;
    const isSUV = (variant === 'suv');

    const glassMat = new THREE.MeshStandardMaterial({
      color: isSUV ? 0x0a1210 : 0x1a3855,
      metalness: isSUV ? 0.85 : 0.80,
      roughness: 0.04,
      transparent: true,
      opacity: isSUV ? 0.60 : 0.65,
      emissive: isSUV ? 0x040a08 : 0x0a1825,
      emissiveIntensity: isSUV ? 0.3 : 0.4,
      envMapIntensity: 2.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    if (isSUV) {
      // ── SUV windows — taller, more upright ──

      // Front windshield (more upright than sedan)
      const wsW = halfW * 1.5;
      const wsH = height * 0.30;
      const ws = new THREE.Mesh(new THREE.PlaneGeometry(wsW, wsH), glassMat);
      ws.position.set(0, height * 0.62, -(halfL * 0.15));
      ws.rotation.x = -0.28;  // more upright than sedan
      this.group.add(ws);

      // Rear window (nearly vertical on SUV)
      const rwMat = glassMat.clone();
      rwMat.opacity = 0.52;
      const rw = new THREE.Mesh(new THREE.PlaneGeometry(wsW * 0.80, wsH * 0.80), rwMat);
      rw.position.set(0, height * 0.60, halfL * 0.18);
      rw.rotation.x = 0.30;
      rw.rotation.y = Math.PI;
      this.group.add(rw);

      // Side windows — taller, single large pane per side
      const sideMat = glassMat.clone();
      sideMat.opacity = 0.55;
      for (const side of [-1, 1]) {
        const swW = halfL * 0.35;
        const swH = height * 0.26;
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(swW, swH), sideMat);
        sw.position.set(side * halfW * 0.97, height * 0.56, -(halfL * 0.02));
        sw.rotation.y = side * Math.PI / 2;
        this.group.add(sw);
      }
    } else {
      // ── Sedan/GT windows ──

      // Front windshield
      const wsW = halfW * 1.6;
      const wsH = height * 0.32;
      const ws = new THREE.Mesh(new THREE.PlaneGeometry(wsW, wsH), glassMat);
      ws.position.set(0, height * 0.66, -(halfL * 0.18));
      ws.rotation.x = -0.38;
      this.group.add(ws);

      // Rear window
      const rwMat = glassMat.clone();
      rwMat.opacity = 0.48;
      const rw = new THREE.Mesh(new THREE.PlaneGeometry(wsW * 0.82, wsH * 0.7), rwMat);
      rw.position.set(0, height * 0.63, halfL * 0.14);
      rw.rotation.x = 0.42;
      rw.rotation.y = Math.PI;
      this.group.add(rw);

      // Side windows — front and rear quarter per side
      const sideMat = glassMat.clone();
      sideMat.opacity = 0.52;
      for (const side of [-1, 1]) {
        const fqW = halfL * 0.22;
        const fqH = height * 0.22;
        const fq = new THREE.Mesh(new THREE.PlaneGeometry(fqW, fqH), sideMat);
        fq.position.set(side * halfW * 0.97, height * 0.62, -(halfL * 0.15));
        fq.rotation.y = side * Math.PI / 2;
        this.group.add(fq);

        const rqMat = sideMat.clone();
        rqMat.opacity = 0.45;
        const rqW = halfL * 0.18;
        const rqH = height * 0.18;
        const rq = new THREE.Mesh(new THREE.PlaneGeometry(rqW, rqH), rqMat);
        rq.position.set(side * halfW * 0.97, height * 0.60, halfL * 0.06);
        rq.rotation.y = side * Math.PI / 2;
        this.group.add(rq);
      }
    }
  }

  // ═══════════════════════════════════════════
  //  EDGE RIM — dark vehicle contour visibility
  // ═══════════════════════════════════════════

  _addEdgeRim(bbox) {
    // Subtle edge highlights for dark vehicle contour — NO roof-top geometry
    const size = bbox.getSize(new THREE.Vector3());
    const halfW = size.x / 2;
    const height = size.y;

    const rimMat = new THREE.MeshBasicMaterial({
      color: 0x5577aa, transparent: true, opacity: 0.22, depthWrite: false,
    });

    // Side sill strips (left + right, bottom edge)
    for (const side of [-1, 1]) {
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(0.010, 0.030, size.z * 0.70), rimMat);
      sill.position.set(side * halfW, 0.05, 0);
      this.group.add(sill);
    }
  }

  // ═══════════════════════════════════════════
  //  GT DETAIL PACKAGE — Ethan's dark sports GT
  //  Chrome brightwork, DRLs, side markers
  // ═══════════════════════════════════════════

  _addGTDetails(bbox) {
    const size = bbox.getSize(new THREE.Vector3());
    const halfW = size.x / 2;
    const halfL = size.z / 2;
    const height = size.y;

    // ── Chrome material ──
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, metalness: 0.92, roughness: 0.06, envMapIntensity: 2.5,
    });

    // ── Chrome beltline strips (left + right) ──
    for (const side of [-1, 1]) {
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.020, size.z * 0.50), chromeMat);
      belt.position.set(side * (halfW + 0.01), height * 0.50, -(halfL * 0.03));
      this.group.add(belt);
    }

    // ── Rear chrome strip ──
    const rearStrip = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.0, 0.018, 0.018), chromeMat);
    rearStrip.position.set(0, height * 0.28, halfL - 0.01);
    this.group.add(rearStrip);

    // ── Side marker lights (front amber, rear red) ──
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 0.8,
      metalness: 0.2, roughness: 0.3,
    });
    const rearMarkerMat = new THREE.MeshStandardMaterial({
      color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 0.6,
      metalness: 0.2, roughness: 0.3,
    });
    for (const side of [-1, 1]) {
      const fm = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 3), markerMat);
      fm.position.set(side * (halfW + 0.01), height * 0.26, -(halfL * 0.50));
      this.group.add(fm);

      const rm = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 3), rearMarkerMat);
      rm.position.set(side * (halfW + 0.01), height * 0.26, halfL * 0.42);
      this.group.add(rm);
    }

  }

  // ═══════════════════════════════════════════
  //  SPORTS DETAIL PACKAGE — Destiny's AMG GT
  //  Chrome, DRLs, splitter, diffuser, markers
  // ═══════════════════════════════════════════

  _addSportsDetails(bbox, driver) {
    const size = bbox.getSize(new THREE.Vector3());
    const halfW = size.x / 2;
    const halfL = size.z / 2;
    const height = size.y;

    // ── Shared materials ──
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, metalness: 0.92, roughness: 0.06, envMapIntensity: 2.5,
    });
    const darkChromeMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a22, metalness: 0.7, roughness: 0.25,
      emissive: 0x050508, emissiveIntensity: 0.08,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x111118, metalness: 0.4, roughness: 0.5,
    });

    // ═══════════════════════════════════════
    //  FRONT — grille, splitter, DRLs
    // ═══════════════════════════════════════

    // Front grille (dark mesh with chrome surround)
    const grilleW = halfW * 1.2;
    const grilleH = height * 0.18;
    const grille = new THREE.Mesh(
      new THREE.PlaneGeometry(grilleW, grilleH), darkChromeMat);
    grille.position.set(0, height * 0.18, -(halfL + 0.01));
    this.group.add(grille);

    // Grille chrome borders (top + bottom)
    const grilleBorderTop = new THREE.Mesh(
      new THREE.BoxGeometry(grilleW * 1.05, 0.015, 0.015), chromeMat);
    grilleBorderTop.position.set(0, height * 0.18 + grilleH * 0.5, -(halfL + 0.01));
    this.group.add(grilleBorderTop);
    const grilleBorderBot = new THREE.Mesh(
      new THREE.BoxGeometry(grilleW * 0.95, 0.012, 0.012), chromeMat);
    grilleBorderBot.position.set(0, height * 0.18 - grilleH * 0.5, -(halfL + 0.01));
    this.group.add(grilleBorderBot);

    // Front splitter (carbon fiber, extends forward below bumper)
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.8, 0.02, halfL * 0.08), carbonMat);
    splitter.position.set(0, height * 0.04, -(halfL + 0.02));
    this.group.add(splitter);

    // DRL strips (bright blue-white signature LEDs below headlights)
    const drlMat = new THREE.MeshBasicMaterial({ color: 0xddeeff });
    const drlY = height * 0.18;
    const drlZ = -(halfL - 0.01);
    for (const x of [-halfW * 0.65, halfW * 0.65]) {
      const drl = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.30, 0.025, 0.015), drlMat);
      drl.position.set(x, drlY, drlZ);
      this.group.add(drl);

      // DRL glow bloom
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xaaccff, transparent: true, opacity: 0.15, depthWrite: false,
      });
      const bloom = new THREE.Mesh(
        new THREE.PlaneGeometry(halfW * 0.45, height * 0.10), glowMat);
      bloom.position.set(x, drlY, drlZ - 0.02);
      this.group.add(bloom);
    }

    // Headlight housings (dark chrome recessed)
    for (const x of [-halfW * 0.65, halfW * 0.65]) {
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.35, height * 0.08, 0.05), darkChromeMat);
      housing.position.set(x, height * 0.22, drlZ + 0.02);
      this.group.add(housing);
    }

    // ═══════════════════════════════════════
    //  SIDES — beltline, air intakes, markers
    // ═══════════════════════════════════════

    // Chrome beltline strips
    const beltY = height * 0.48;
    for (const side of [-1, 1]) {
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.022, size.z * 0.50), chromeMat);
      belt.position.set(side * (halfW + 0.01), beltY, 0);
      this.group.add(belt);
    }

    // Side air intakes (behind front wheels, sports car signature)
    for (const side of [-1, 1]) {
      const intakeMat = darkChromeMat.clone();
      const intake = new THREE.Mesh(
        new THREE.PlaneGeometry(halfL * 0.12, height * 0.10), intakeMat);
      intake.position.set(side * (halfW + 0.01), height * 0.25, -(halfL * 0.25));
      intake.rotation.y = side * Math.PI / 2;
      this.group.add(intake);

      // Chrome intake border (top edge)
      const intakeBorder = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.012, halfL * 0.12), chromeMat);
      intakeBorder.position.set(side * (halfW + 0.01), height * 0.30, -(halfL * 0.25));
      this.group.add(intakeBorder);
    }

    // Side marker lights — front (amber)
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 0.8,
      metalness: 0.2, roughness: 0.3,
    });
    for (const side of [-1, 1]) {
      const fm = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 3), markerMat);
      fm.position.set(side * (halfW + 0.01), height * 0.20, -(halfL * 0.50));
      this.group.add(fm);
    }

    // Side marker lights — rear (red)
    const rearMarkerMat = new THREE.MeshStandardMaterial({
      color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 0.6,
      metalness: 0.2, roughness: 0.3,
    });
    for (const side of [-1, 1]) {
      const rm = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 3), rearMarkerMat);
      rm.position.set(side * (halfW + 0.01), height * 0.22, halfL * 0.40);
      this.group.add(rm);
    }

    // Side sill accent strips (driver color, bright for contrast)
    const sillMat = new THREE.MeshBasicMaterial({
      color: driver.carAccent, transparent: true, opacity: 0.30, depthWrite: false,
    });
    for (const side of [-1, 1]) {
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.03, size.z * 0.65), sillMat);
      sill.position.set(side * halfW, 0.06, 0);
      this.group.add(sill);
    }

    // ═══════════════════════════════════════
    //  REAR — diffuser, chrome strip, wing hint
    // ═══════════════════════════════════════

    // Rear chrome strip (between taillights)
    const rearStrip = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.2, 0.018, 0.018), chromeMat);
    rearStrip.position.set(0, height * 0.23, halfL - 0.01);
    this.group.add(rearStrip);

    // Rear diffuser (carbon, between exhaust pipes)
    const diffuser = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 1.0, height * 0.12), carbonMat);
    diffuser.position.set(0, height * 0.08, halfL + 0.01);
    diffuser.rotation.y = Math.PI;
    this.group.add(diffuser);

    // Diffuser chrome borders (left + right vertical)
    for (const side of [-1, 1]) {
      const diffBorder = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, height * 0.12, 0.012), chromeMat);
      diffBorder.position.set(side * halfW * 0.50, height * 0.08, halfL + 0.01);
      this.group.add(diffBorder);
    }

    // Taillight housings (dark recessed)
    for (const x of [-halfW * 0.55, halfW * 0.55]) {
      const tlHousing = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.35, height * 0.07, 0.04), darkChromeMat);
      tlHousing.position.set(x, height * 0.25, halfL - 0.005);
      this.group.add(tlHousing);
    }

    // Rear lip spoiler (subtle, sits on trunk edge)
    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.5, 0.018, 0.04), carbonMat);
    spoiler.position.set(0, height * 0.42, halfL * 0.75);
    this.group.add(spoiler);

    // ═══════════════════════════════════════
    //  ROOF + BODY LINES
    // ═══════════════════════════════════════

    // Shoulder character lines (mid-body)
    const shoulderMat = new THREE.MeshBasicMaterial({
      color: driver.carAccent, transparent: true, opacity: 0.15, depthWrite: false,
    });
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, size.z * 0.70), shoulderMat);
      shoulder.position.set(side * (halfW * 0.98), height * 0.38, 0);
      this.group.add(shoulder);
    }

    // Door panel seams
    const seamMat = new THREE.MeshBasicMaterial({
      color: 0x151520, transparent: true, opacity: 0.30, depthWrite: false,
    });
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, height * 0.22, 0.008), seamMat);
      door.position.set(side * halfW * 0.98, height * 0.32, -(halfL * 0.05));
      this.group.add(door);
    }

    // ═══════════════════════════════════════
    //  CONTRAST — road separation + visibility
    // ═══════════════════════════════════════

    // Edge rim — front lip
    const rimMat = new THREE.MeshBasicMaterial({
      color: driver.carAccent, transparent: true, opacity: 0.28, depthWrite: false,
    });
    const frontLip = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.6, 0.015, 0.015), rimMat);
    frontLip.position.set(0, height * 0.06, -(size.z * 0.48));
    this.group.add(frontLip);

    // Edge rim — rear lip
    const rearLipMat = rimMat.clone();
    rearLipMat.opacity = 0.22;
    const rearLip = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.5, 0.015, 0.015), rearLipMat);
    rearLip.position.set(0, height * 0.08, size.z * 0.48);
    this.group.add(rearLip);

    // Rear accent glow (blue strip behind taillights — visible to camera)
    const rearGlowMat = new THREE.MeshBasicMaterial({
      color: driver.carAccent, transparent: true, opacity: 0.20, depthWrite: false,
    });
    const rearGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 1.3, height * 0.06), rearGlowMat);
    rearGlow.position.set(0, height * 0.25, halfL + 0.02);
    rearGlow.rotation.y = Math.PI;
    this.group.add(rearGlow);

  }

  // ═══════════════════════════════════════════
  //  RALLY DETAIL PACKAGE — Luke's SUV
  //  Roof rails, bull bar, side steps, arch flares
  // ═══════════════════════════════════════════

  _addRallyDetails(bbox, driver) {
    const size = bbox.getSize(new THREE.Vector3());
    const halfW = size.x / 2;
    const halfL = size.z / 2;
    const height = size.y;

    // ── Shared materials ──
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xccccdd, metalness: 0.92, roughness: 0.06, envMapIntensity: 2.5,
    });
    const darkPlasticMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, metalness: 0.1, roughness: 0.7,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x111118, metalness: 0.4, roughness: 0.5,
    });

    // ═══════════════════════════════════════
    //  ROOF — rails + rack hint
    // ═══════════════════════════════════════

    // Roof rails (left + right, chrome bars running front-to-back)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.025, size.z * 0.50), chromeMat);
      rail.position.set(side * halfW * 0.75, height + 0.02, -(halfL * 0.05));
      this.group.add(rail);

      // Rail support posts (front + rear)
      for (const zFrac of [-0.22, 0.18]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.04, 0.02), chromeMat);
        post.position.set(side * halfW * 0.75, height + 0.005, halfL * zFrac);
        this.group.add(post);
      }
    }

    // ═══════════════════════════════════════
    //  FRONT — bull bar, skid plate, DRLs
    // ═══════════════════════════════════════

    // Bull bar (chrome, arched across front bumper)
    const bullBar = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.4, 0.04, 0.04), chromeMat);
    bullBar.position.set(0, height * 0.22, -(halfL + 0.03));
    this.group.add(bullBar);

    // Bull bar vertical supports
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, height * 0.12, 0.03), chromeMat);
      support.position.set(side * halfW * 0.55, height * 0.16, -(halfL + 0.03));
      this.group.add(support);
    }

    // Skid plate (carbon/dark, underbody protection)
    const skid = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.5, 0.02, halfL * 0.12), carbonMat);
    skid.position.set(0, height * 0.03, -(halfL * 0.92));
    this.group.add(skid);

    // DRL strips (green-white LEDs flanking the bull bar)
    const drlMat = new THREE.MeshBasicMaterial({ color: 0xddffdd });
    const drlY = height * 0.30;
    const drlZ = -(halfL - 0.01);
    for (const x of [-halfW * 0.50, halfW * 0.50]) {
      const drl = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 0.25, 0.022, 0.015), drlMat);
      drl.position.set(x, drlY, drlZ);
      this.group.add(drl);

      // Glow bloom
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x88ee88, transparent: true, opacity: 0.12, depthWrite: false,
      });
      const bloom = new THREE.Mesh(
        new THREE.PlaneGeometry(halfW * 0.38, height * 0.08), glowMat);
      bloom.position.set(x, drlY, drlZ - 0.02);
      this.group.add(bloom);
    }


    // ═══════════════════════════════════════
    //  SIDES — steps, arch flares, beltline, markers
    // ═══════════════════════════════════════

    for (const side of [-1, 1]) {
      // Side steps (chrome running boards)
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.02, size.z * 0.55), chromeMat);
      step.position.set(side * (halfW + 0.03), height * 0.08, 0);
      this.group.add(step);

      // Wheel arch flares (dark plastic, widebody look)
      const archPositions = [-(halfL * 0.50), halfL * 0.38];
      for (const zPos of archPositions) {
        const flare = new THREE.Mesh(
          new THREE.TorusGeometry(height * 0.20, 0.025, 4, 8, Math.PI), darkPlasticMat);
        flare.position.set(side * (halfW + 0.02), height * 0.20, zPos);
        flare.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        flare.rotation.z = Math.PI;
        this.group.add(flare);
      }

      // Chrome beltline strip
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.022, size.z * 0.45), chromeMat);
      belt.position.set(side * (halfW + 0.01), height * 0.50, -(halfL * 0.02));
      this.group.add(belt);

      // Side marker — front (amber)
      const fmMat = new THREE.MeshStandardMaterial({
        color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 0.8,
        metalness: 0.2, roughness: 0.3,
      });
      const fm = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 3), fmMat);
      fm.position.set(side * (halfW + 0.01), height * 0.25, -(halfL * 0.50));
      this.group.add(fm);

      // Side marker — rear (red)
      const rmMat = new THREE.MeshStandardMaterial({
        color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 0.6,
        metalness: 0.2, roughness: 0.3,
      });
      const rm = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 3), rmMat);
      rm.position.set(side * (halfW + 0.01), height * 0.28, halfL * 0.40);
      this.group.add(rm);
    }

    // ═══════════════════════════════════════
    //  REAR — bumper guard, chrome strip
    // ═══════════════════════════════════════

    // Rear chrome strip
    const rearStrip = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.1, 0.018, 0.018), chromeMat);
    rearStrip.position.set(0, height * 0.35, halfL - 0.01);
    this.group.add(rearStrip);

    // Rear bumper guard (chrome bar)
    const bumperGuard = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.3, 0.03, 0.03), chromeMat);
    bumperGuard.position.set(0, height * 0.10, halfL + 0.02);
    this.group.add(bumperGuard);

    // Rear diffuser/skid
    const rearSkid = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.2, 0.02, halfL * 0.08), carbonMat);
    rearSkid.position.set(0, height * 0.03, halfL * 0.92);
    this.group.add(rearSkid);

    // ═══════════════════════════════════════
    //  BODY LINES + CONTRAST
    // ═══════════════════════════════════════

    // Shoulder character lines
    const shoulderMat = new THREE.MeshBasicMaterial({
      color: driver.carAccent, transparent: true, opacity: 0.15, depthWrite: false,
    });
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, size.z * 0.70), shoulderMat);
      shoulder.position.set(side * (halfW * 0.98), height * 0.40, 0);
      this.group.add(shoulder);
    }

    // Door panel seams
    const seamMat = new THREE.MeshBasicMaterial({
      color: 0x151520, transparent: true, opacity: 0.30, depthWrite: false,
    });
    for (const side of [-1, 1]) {
      for (const zFrac of [-0.18, 0.08]) {
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(0.008, height * 0.28, 0.008), seamMat);
        door.position.set(side * halfW * 0.98, height * 0.33, halfL * zFrac);
        this.group.add(door);
      }
    }

    // Edge rim — front + rear lips (green accent)
    const rimMat = new THREE.MeshBasicMaterial({
      color: driver.carAccent, transparent: true, opacity: 0.25, depthWrite: false,
    });
    const frontLip = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.5, 0.015, 0.015), rimMat);
    frontLip.position.set(0, height * 0.06, -(size.z * 0.48));
    this.group.add(frontLip);
    const rearLip = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.4, 0.015, 0.015), rimMat.clone());
    rearLip.material.opacity = 0.20;
    rearLip.position.set(0, height * 0.08, size.z * 0.48);
    this.group.add(rearLip);

    // Sill accent strips
    const sillMat = new THREE.MeshBasicMaterial({
      color: driver.carAccent, transparent: true, opacity: 0.22, depthWrite: false,
    });
    for (const side of [-1, 1]) {
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.03, size.z * 0.65), sillMat);
      sill.position.set(side * halfW, 0.05, 0);
      this.group.add(sill);
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
    // Quick tap — move one lane (no isSwitching block, allows rapid double-tap)
    const newLane = direction === 'left'
      ? Math.max(0, this.currentLane - 1)
      : Math.min(2, this.currentLane + 1);
    if (newLane === this.currentLane) return;
    this.currentLane = newLane;

    const targetX = LANE_POSITIONS[this.currentLane];
    const tilt = direction === 'left' ? 0.18 : -0.18;
    const dur = this.laneSwitchMs;

    new Tween(this.group.rotation, tweenGroup)
      .to({ z: tilt }, dur * 0.4)
      .easing(Easing.Quadratic.Out).start();

    new Tween(this.group.position, tweenGroup)
      .to({ x: targetX }, dur)
      .easing(Easing.Quadratic.Out)
      .onComplete(() => {
        new Tween(this.group.rotation, tweenGroup)
          .to({ z: 0 }, dur * 0.5)
          .easing(Easing.Quadratic.Out).start();
      }).start();
  }

  /** Continuous lateral slide — called every frame when arrow is held */
  slideLateral(delta, direction) {
    const slideSpeed = 10; // units/sec
    const dx = direction === 'left' ? -slideSpeed * delta : slideSpeed * delta;
    const minX = LANE_POSITIONS[0] - 0.3;
    const maxX = LANE_POSITIONS[2] + 0.3;

    this.group.position.x = Math.max(minX, Math.min(maxX, this.group.position.x + dx));

    // Tilt while sliding
    const targetTilt = direction === 'left' ? 0.12 : -0.12;
    this.group.rotation.z += (targetTilt - this.group.rotation.z) * 0.15;

    // Update current lane from position
    this.currentLane = this.getNearestLane();
  }

  /** Smoothly recover tilt back to zero — called each frame when no arrow is held */
  recoverTilt(delta) {
    if (Math.abs(this.group.rotation.z) > 0.001) {
      this.group.rotation.z += (0 - this.group.rotation.z) * Math.min(1, 10 * delta);
    } else {
      this.group.rotation.z = 0;
    }
  }

  /** Snap to nearest lane center — called when arrow is released */
  snapToNearestLane() {
    const lane = this.getNearestLane();
    this.currentLane = lane;
    const targetX = LANE_POSITIONS[lane];
    const dur = 120; // fast snap

    new Tween(this.group.position, tweenGroup)
      .to({ x: targetX }, dur)
      .easing(Easing.Quadratic.Out).start();

    new Tween(this.group.rotation, tweenGroup)
      .to({ z: 0 }, dur)
      .easing(Easing.Quadratic.Out).start();
  }

  /** Get nearest lane index (0/1/2) from current X position */
  getNearestLane() {
    const x = this.group.position.x;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < LANE_POSITIONS.length; i++) {
      const d = Math.abs(x - LANE_POSITIONS[i]);
      if (d < minDist) { minDist = d; closest = i; }
    }
    return closest;
  }

  update(delta, speed, isAccelerating = false) {
    // Wheel rotation — only if config allows and we have separate wheel meshes
    if (this._wheelMeshes.length > 0 && this._wheelCanRotate) {
      const rotationSpeed = (speed / 30) * delta * Math.PI * 2;
      const axis = this._wheelAxis;
      this._wheelMeshes.forEach(w => {
        w.rotation[axis] += rotationSpeed;
      });
    }
    if (isAccelerating && speed > 20) this._emitExhaust(delta);
    this._updateExhaust(delta, speed);
    if (this._turboActive) this._updateTurboFlame(delta, speed);
  }

  _emitExhaust(delta) {
    if (!this._exhaustParticles) {
      this._exhaustParticles = [];
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1); // cheaper than sphere
      const mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.4 });
      for (let i = 0; i < 6; i++) {
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
      const es = 1 + delta * 2.5; p.scale.x *= es; p.scale.y *= es; p.scale.z *= es;
    }
  }

  // ═══════════════════════════════════════════
  //  TURBO FLAME — fire effect from taillights
  // ═══════════════════════════════════════════

  startTurboFlame() {
    this._turboActive = true;

    // Lazy-init flame particle pool (24 particles for dense fire)
    if (!this._flameParticles) {
      this._flameParticles = [];
      const flameColors = [0xff6600, 0xff2200, 0xffaa00, 0xff4400, 0xffcc00, 0xff8800];
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      for (let i = 0; i < 24; i++) {
        const color = flameColors[i % flameColors.length];
        const mat = new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.9, depthWrite: false,
        });
        const p = new THREE.Mesh(geo, mat);
        p.visible = false;
        p.userData = { life: 0, vx: 0, vy: 0, vz: 0 };
        this.group.parent.add(p);
        this._flameParticles.push(p);
      }
    }

    // Boost taillight intensity + shift to orange
    if (this._tailLights) {
      this._tlOrigIntensity = this._tailLights[0].intensity;
      this._tlOrigColor = this._tailLights[0].color.getHex();
      for (const tl of this._tailLights) {
        tl.intensity = 8.0;
        tl.color.set(0xff4400);
      }
    }

    // Add flickering flame glow light at rear
    if (!this._flameGlow) {
      this._flameGlow = new THREE.PointLight(0xff5500, 0, 8, 2);
      this._flameGlow.position.set(0, 0.3, this._exhaustZ + 0.3);
      this.group.add(this._flameGlow);
    }
    this._flameGlow.intensity = 6.0;
  }

  stopTurboFlame() {
    this._turboActive = false;

    // Hide remaining flame particles
    if (this._flameParticles) {
      for (const p of this._flameParticles) p.visible = false;
    }

    // Restore taillight intensity + color
    if (this._tailLights && this._tlOrigIntensity !== undefined) {
      for (const tl of this._tailLights) {
        tl.intensity = this._tlOrigIntensity;
        tl.color.set(this._tlOrigColor);
      }
    }

    // Kill flame glow
    if (this._flameGlow) this._flameGlow.intensity = 0;
  }

  _updateTurboFlame(delta, speed) {
    if (!this._flameParticles) return;
    const exhaustZ = this._exhaustZ;
    const kartX = this.group.position.x;
    const kartZ = this.group.position.z;

    // Spawn 3-4 new flame particles per frame from each exhaust pipe
    let spawned = 0;
    for (const p of this._flameParticles) {
      if (spawned >= 4) break;
      if (p.visible) continue;

      p.visible = true;
      const side = spawned % 2 === 0 ? 0.22 : -0.22;
      p.position.set(
        kartX + side + (Math.random() - 0.5) * 0.12,
        0.22 + Math.random() * 0.12,
        kartZ + exhaustZ + Math.random() * 0.08,
      );
      // Vary size — mix of small sparks and larger flame bursts
      const isSpark = Math.random() > 0.6;
      p.scale.setScalar(isSpark ? 0.05 + Math.random() * 0.05 : 0.12 + Math.random() * 0.12);
      p.material.opacity = isSpark ? 1.0 : 0.85 + Math.random() * 0.15;

      // Velocity: backward (+Z), upward, slight horizontal spread
      p.userData.vx = (Math.random() - 0.5) * 1.8;
      p.userData.vy = 0.6 + Math.random() * 2.0;
      p.userData.vz = 1.5 + Math.random() * 4.0;
      p.userData.life = isSpark ? 0.08 + Math.random() * 0.10 : 0.15 + Math.random() * 0.20;
      spawned++;
    }

    // Update active flame particles
    for (const p of this._flameParticles) {
      if (!p.visible) continue;
      p.userData.life -= delta;
      if (p.userData.life <= 0) { p.visible = false; continue; }
      p.position.x += p.userData.vx * delta;
      p.position.y += p.userData.vy * delta;
      p.position.z += (speed * 0.5 + p.userData.vz) * delta;
      p.material.opacity = Math.max(0, p.userData.life * 4.5);
      const fs = 1 + delta * 7.0; p.scale.x *= fs; p.scale.y *= fs; p.scale.z *= fs;
    }

    // Flicker the rear flame glow light
    if (this._flameGlow) {
      this._flameGlow.intensity = 4.0 + Math.random() * 4.0;
      this._flameGlow.color.set(Math.random() > 0.3 ? 0xff5500 : 0xffaa00);
    }
  }
}
