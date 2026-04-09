import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';
import {
  LANE_POSITIONS, PLATE_SPAWN_INTERVAL,
  PLATE_COLLISION_Z_THRESHOLD, ROAD_SEGMENT_LENGTH
} from '../utils/constants.js';

const POOL_SIZE = 7;
const PLATE_W = 2.4;
const PLATE_L = 1.5;
const PLATE_H = 0.18;
const BLUE = 0x22aaff;
const BLUE_BRIGHT = 0x44ccff;
const BLUE_WHITE = 0x88ddff;

// ═══════════════════════════════════════════════════════
//  OPTIMIZED PLATE FACTORY
//  Each plate = 3 meshes total (was 21 + 1 PointLight):
//    1. plateMesh   — animated body (depression on collect)
//    2. detailMesh  — merged static decorations (edges, grid, dots, bolt, arcs)
//    3. glowDisc    — flat emissive plane replacing PointLight (zero light cost)
// ═══════════════════════════════════════════════════════

// Shared materials (used by ALL plates — never cloned)
const borderMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5, metalness: 0.4 });
const glowDiscMat = new THREE.MeshBasicMaterial({
  color: BLUE, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
});

function createPlate() {
  const group = new THREE.Group();

  // ── 1. Border housing (static, behind plate body) ──
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE_W + 0.12, PLATE_H + 0.04, PLATE_L + 0.12),
    borderMat,
  );
  border.position.y = PLATE_H / 2;
  group.add(border);

  // ── 2. Main plate body (animated — separate for depression tween) ──
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x111118, roughness: 0.25, metalness: 0.5,
    emissive: new THREE.Color(BLUE), emissiveIntensity: 0.4,
  });
  const plateMesh = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE_W, PLATE_H, PLATE_L),
    plateMat,
  );
  plateMesh.position.y = PLATE_H / 2;
  group.add(plateMesh);

  // ── 3. Merged detail overlay (all decorations baked into ONE mesh) ──
  const detailMat = new THREE.MeshBasicMaterial({
    color: BLUE_BRIGHT, transparent: true, opacity: 0.6,
  });

  const parts = [];
  const topY = PLATE_H + 0.003;

  // Edge strips (4)
  for (const zOff of [-(PLATE_L / 2 + 0.04), PLATE_L / 2 + 0.04]) {
    const g = new THREE.BoxGeometry(PLATE_W + 0.14, 0.04, 0.06);
    g.translate(0, PLATE_H + 0.02, zOff);
    parts.push(g);
  }
  for (const xOff of [-(PLATE_W / 2 + 0.04), PLATE_W / 2 + 0.04]) {
    const g = new THREE.BoxGeometry(0.06, 0.04, PLATE_L + 0.14);
    g.translate(xOff, PLATE_H + 0.02, 0);
    parts.push(g);
  }

  // Grid lines (3H + 3V = 6)
  for (const zOff of [-PLATE_L / 3, 0, PLATE_L / 3]) {
    const g = new THREE.BoxGeometry(PLATE_W - 0.15, 0.006, 0.04);
    g.translate(0, topY, zOff);
    parts.push(g);
  }
  for (const xOff of [-PLATE_W / 3, 0, PLATE_W / 3]) {
    const g = new THREE.BoxGeometry(0.04, 0.006, PLATE_L - 0.15);
    g.translate(xOff, topY, 0);
    parts.push(g);
  }

  // Corner nodes (4 small boxes instead of spheres — cheaper)
  for (const [x, z] of [
    [-PLATE_W / 2 + 0.18, -PLATE_L / 2 + 0.18],
    [PLATE_W / 2 - 0.18, -PLATE_L / 2 + 0.18],
    [-PLATE_W / 2 + 0.18, PLATE_L / 2 - 0.18],
    [PLATE_W / 2 - 0.18, PLATE_L / 2 - 0.18],
  ]) {
    const g = new THREE.BoxGeometry(0.1, 0.08, 0.1);
    g.translate(x, PLATE_H + 0.04, z);
    parts.push(g);
  }

  // Lightning bolt (3 segments)
  for (const [x, z, ry] of [[0.1, -0.2, 0.5], [-0.05, 0, -0.5], [0.1, 0.2, 0.5]]) {
    const g = new THREE.BoxGeometry(0.08, 0.006, 0.3);
    // Apply rotation via matrix (can't use translate for rotation)
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, topY + 0.001, z);
    g.applyMatrix4(m);
    parts.push(g);
  }

  // Diagonal arcs (2)
  const diagLen = Math.sqrt(PLATE_W * PLATE_W + PLATE_L * PLATE_L) * 0.38;
  for (const rot of [0.56, -0.56]) {
    const g = new THREE.BoxGeometry(diagLen, 0.005, 0.025);
    const m = new THREE.Matrix4().makeRotationY(rot).setPosition(0, topY, 0);
    g.applyMatrix4(m);
    parts.push(g);
  }

  const mergedGeo = mergeGeometries(parts, false);
  // Dispose individual geometries
  parts.forEach(g => g.dispose());

  const detailMesh = new THREE.Mesh(mergedGeo, detailMat);
  group.add(detailMesh);

  // ── 4. Ground glow disc (replaces PointLight — zero GPU light cost) ──
  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 12),
    glowDiscMat.clone(), // clone only this one for per-plate opacity animation
  );
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = 0.02;
  group.add(glowDisc);

  group.userData = {
    plateMesh,
    plateMat,
    detailMat,
    glowDisc,
    active: false,
    hit: false,
    missed: false,
    lane: 0,
  };

  return group;
}

// ── Tier-aware minimum gap between plates ──
const MIN_GAPS = [54, 47, 31]; // Tier 0: 1.75x, Tier 1: 1.5x, Tier 2: 1x (base +25%)

export class Plate {
  constructor(scene) {
    this.scene = scene;
    this.plates = [];
    this.timeSinceSpawn = 0;
    this.spawnInterval = PLATE_SPAWN_INTERVAL;
    this._lastLane = 1;  // start center
    this._tier = 0;

    for (let i = 0; i < POOL_SIZE; i++) {
      const plate = createPlate();
      plate.visible = false;
      scene.add(plate);
      this.plates.push(plate);
    }
  }

  spawnPlate(aheadZ) {
    const plate = this.plates.find(p => !p.userData.active);
    if (!plate) return;

    // On-the-fly lane selection — adjacent lanes only (max 1 lane separation)
    let options = [0, 1, 2].filter(l => l !== this._lastLane);
    options = options.filter(l => Math.abs(l - this._lastLane) <= 1);
    const laneIdx = options[Math.floor(Math.random() * options.length)];
    this._lastLane = laneIdx;

    plate.position.set(LANE_POSITIONS[laneIdx], 0, aheadZ);
    plate.visible = true;
    const ud = plate.userData;
    ud.active = true;
    ud.hit = false;
    ud.missed = false;
    ud.lane = laneIdx;
    // Reset visual state
    ud.plateMat.emissive.set(BLUE);
    ud.plateMat.emissiveIntensity = 0.4;
    ud.detailMat.opacity = 0.6;
    ud.glowDisc.material.opacity = 0.35;
    ud.plateMesh.position.y = PLATE_H / 2;
  }

  checkCollision(kartX) {
    for (const plate of this.plates) {
      const ud = plate.userData;
      if (!ud.active || ud.hit) continue;
      // X-proximity collision: kart within 1.8 units of plate center
      if (Math.abs(plate.position.x - kartX) < 1.8 && Math.abs(plate.position.z) < PLATE_COLLISION_Z_THRESHOLD) {
        ud.hit = true;
        this._animateCollection(plate);
        return true;
      }
    }
    return false;
  }

  _animateCollection(plate) {
    const mesh = plate.userData.plateMesh;
    const mat = plate.userData.plateMat;
    const detailMat = plate.userData.detailMat;
    const glowMat = plate.userData.glowDisc.material;
    const baseY = PLATE_H / 2;

    // ── BUMP: compress → spring back ──
    new Tween(mesh.position, tweenGroup)
      .to({ y: baseY - 0.12 }, 70)
      .easing(Easing.Quadratic.In)
      .onComplete(() => {
        new Tween(mesh.position, tweenGroup)
          .to({ y: baseY + 0.06 }, 140)
          .easing(Easing.Back.Out)
          .onComplete(() => {
            new Tween(mesh.position, tweenGroup)
              .to({ y: baseY }, 120)
              .easing(Easing.Quadratic.Out)
              .start();
          })
          .start();
      })
      .start();

    // ── FLASH: bright white burst then fade ──
    mat.emissive.set(0xffffff);
    mat.emissiveIntensity = 2.0;
    glowMat.opacity = 0.8;

    new Tween(mat, tweenGroup)
      .to({ emissiveIntensity: 0.05 }, 500)
      .delay(50)
      .onStart(() => mat.emissive.set(BLUE))
      .start();

    // Details + glow fade out
    new Tween(detailMat, tweenGroup).to({ opacity: 0.08 }, 600).start();
    new Tween(glowMat, tweenGroup).to({ opacity: 0.05 }, 600).start();
  }

  update(delta, speed) {
    const move = speed * delta;
    this.timeSinceSpawn += delta;

    if (this.timeSinceSpawn >= this.spawnInterval) {
      this.timeSinceSpawn = 0;
      const spawnZ = -(ROAD_SEGMENT_LENGTH * 0.9 + Math.random() * 30);
      if (spawnZ < -20) {
        // Enforce tier-aware minimum gap between plates
        const minGap = MIN_GAPS[this._tier] || 25;
        let tooClose = false;
        for (let i = 0; i < this.plates.length; i++) {
          if (this.plates[i].userData.active && Math.abs(this.plates[i].position.z - spawnZ) < minGap) {
            tooClose = true; break;
          }
        }
        if (!tooClose) this.spawnPlate(spawnZ);
      }
    }

    this._pulseFrame = (this._pulseFrame || 0) + 1;
    const doPulse = (this._pulseFrame & 1) === 0; // every other frame
    const time = doPulse ? performance.now() * 0.001 : 0;

    for (const plate of this.plates) {
      const ud = plate.userData;
      if (!ud.active) continue;

      plate.position.z += move;

      // Idle pulse — every other frame for performance
      if (!ud.hit && doPulse) {
        const pulse = Math.sin(time * 3 + plate.position.x * 2);
        ud.plateMat.emissiveIntensity = 0.35 + pulse * 0.15;
        ud.glowDisc.material.opacity = 0.3 + pulse * 0.1;
      }

      if (plate.position.z > 10) {
        if (!ud.hit) ud.missed = true;
        plate.visible = false;
        ud.active = false;
      }
    }
  }

  checkMisses() {
    let missed = false;
    for (const plate of this.plates) {
      if (plate.userData.missed) {
        plate.userData.missed = false;
        missed = true;
      }
    }
    return missed;
  }

  setSpawnRate(interval) {
    this.spawnInterval = interval;
  }

  setTier(tier) {
    this._tier = Math.min(tier, 2);
  }

  resetTier() {
    this._tier = 0;
    this._lastLane = 1;
  }

  resetSpawnRate() {
    this.spawnInterval = PLATE_SPAWN_INTERVAL;
    this._lastLane = 1;
  }
}
