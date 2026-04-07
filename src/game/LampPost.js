import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';
import { ROAD_WIDTH, PLATES_TO_FILL_BAR } from '../utils/constants.js';

// ── Layout ──
const LAMP_PAIRS   = 6;
const LAMP_SPACING = 35;
const TOTAL_SPAN   = LAMP_SPACING * LAMP_PAIRS;
const RECYCLE_Z    = 20;
const MAX_ACTIVE_LIGHTS = (navigator.maxTouchPoints > 0) ? 2 : 3;
const LAMP_HEAD_Y  = 4.15;
const CONE_HEIGHT  = 4.0;   // from lamp head to road

// ── Tier configs ──
// Each tier: { intensity, distance, emissive, coneOpacity, coneBaseRadius, color }
const TIER = [
  { intensity: 0.05, distance: 8,  emissive: 0.05, coneOp: 0.02, coneR: 1.0, color: '#665533' },
  { intensity: 0.3,  distance: 15, emissive: 0.30, coneOp: 0.04, coneR: 1.5, color: '#ddaa44' },
  { intensity: 0.6,  distance: 22, emissive: 0.60, coneOp: 0.06, coneR: 2.2, color: '#ffcc33' },
  { intensity: 0.85, distance: 28, emissive: 0.85, coneOp: 0.08, coneR: 3.0, color: '#ffdd66' },
  { intensity: 1.5,  distance: 35, emissive: 1.00, coneOp: 0.10, coneR: 4.0, color: '#ffeebb' },
];

// Precompute THREE.Color objects
const TIER_COLORS = TIER.map(t => new THREE.Color(t.color));

// Base cone radius at tier 0 (used for scale math)
const BASE_CONE_R = TIER[0].coneR;

// Pre-computed tier target states (avoids object allocation on lookup)
const TIER_STATES = TIER.map((cfg, i) => ({
  intensity: cfg.intensity,
  distance: cfg.distance,
  emissive: cfg.emissive,
  coneOp: cfg.coneOp,
  coneScale: cfg.coneR / BASE_CONE_R,
  color: TIER_COLORS[i],
}));

// Reusable objects for micro-progression (avoids per-hit allocations)
const _tempColor = new THREE.Color();
const _targetState = { intensity: 0, distance: 0, emissive: 0, coneOp: 0, coneScale: 0, color: _tempColor };

// Ambient intensity multipliers per tier (applied to base theme value)
// 5 entries: tier 0 (start), tier 1, tier 2, tier 3, tier 4 (fully powered)
export const AMBIENT_MULTIPLIERS = [0.4, 0.55, 0.7, 0.85, 1.0];

/** Create a circular radial gradient texture for ground light pools. */
function _makePoolTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class LampPost {
  constructor(scene) {
    this.scene = scene;
    this.posts = [];
    this.currentTier = 0;

    // Shared current interpolated state (for recycling + single-tween updates)
    this._state = {
      intensity: TIER[0].intensity,
      distance: TIER[0].distance,
      emissive: TIER[0].emissive,
      coneOp: TIER[0].coneOp,
      coneScale: 1.0,
      color: TIER_COLORS[0].clone(),
      cr: TIER_COLORS[0].r,
      cg: TIER_COLORS[0].g,
      cb: TIER_COLORS[0].b,
    };
    this._stateTween = null;

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x666666, metalness: 0.6, roughness: 0.4,
    });
    const poolTex = _makePoolTexture();

    // Pre-merge pole + arm + housing into one shared geometry
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6);
    poleGeo.translate(0, 2.25, 0);
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 5);
    armGeo.rotateZ(Math.PI / 2);
    armGeo.translate(-0.9, 4.3, 0);
    const housingGeo = new THREE.BoxGeometry(0.5, 0.2, 0.35);
    housingGeo.translate(-1.8, 4.35, 0);
    const mergedStructure = mergeGeometries([poleGeo, armGeo, housingGeo], false);

    for (let pair = 0; pair < LAMP_PAIRS; pair++) {
      for (const side of [-1, 1]) {
        const group = new THREE.Group();

        // Merged pole + arm + housing (1 draw call)
        group.add(new THREE.Mesh(mergedStructure, poleMat));

        // Lamp head (bulb)
        const headMat = new THREE.MeshStandardMaterial({
          color: TIER_COLORS[0],
          emissive: TIER_COLORS[0],
          emissiveIntensity: TIER[0].emissive,
          metalness: 0.2, roughness: 0.4,
        });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), headMat);
        head.position.set(-1.8, LAMP_HEAD_Y, 0);
        group.add(head);

        // PointLight
        const light = new THREE.PointLight(TIER_COLORS[0], TIER[0].intensity, TIER[0].distance, 2);
        light.position.set(-1.8, 4.0, 0);
        group.add(light);

        // ── Inverted light cone (narrow at top, wide at road) ──
        // Using CylinderGeometry: tipRadius at top (lamp), baseRadius at bottom (road)
        const coneMat = new THREE.MeshBasicMaterial({
          color: TIER_COLORS[0].clone(),
          transparent: true,
          opacity: TIER[0].coneOp,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const coneGeo = new THREE.CylinderGeometry(0.2, BASE_CONE_R, CONE_HEIGHT, 10, 1, true);
        const cone = new THREE.Mesh(coneGeo, coneMat);
        // Position: center of cylinder at midpoint between lamp head and road
        cone.position.set(-1.8, LAMP_HEAD_Y - CONE_HEIGHT / 2, 0);
        group.add(cone);

        // ── Ground light pool (flat circle on road surface) ──
        const poolMat = new THREE.MeshBasicMaterial({
          map: poolTex.clone(),
          color: TIER_COLORS[0].clone(),
          transparent: true,
          opacity: TIER[0].coneOp * 1.0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const poolSize = BASE_CONE_R * 2;
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(poolSize, poolSize), poolMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(-1.8, 0.02, 0);
        group.add(pool);

        // Position along road
        group.position.set(side * (ROAD_WIDTH / 2 + 1.5), 0, -30 - pair * LAMP_SPACING);
        if (side === -1) group.scale.x = -1;

        // Start hidden — revealed progressively via setVisible()
        group.visible = false;

        scene.add(group);
        this.posts.push({ group, head, headMat, light, cone, coneMat, pool, poolMat });
      }
    }
  }

  /** Show or hide all lamp post geometry. */
  setVisible(visible) {
    for (const p of this.posts) p.group.visible = visible;
  }

  // ── Apply state to a single post instantly ──
  _snapPost(p, st) {
    p.light.intensity = st.intensity;
    p.light.distance = st.distance;
    p.light.color.copy(st.color);
    p.headMat.emissiveIntensity = st.emissive;
    p.headMat.emissive.copy(st.color);
    p.headMat.color.copy(st.color);
    p.coneMat.opacity = st.coneOp;
    p.coneMat.color.copy(st.color);
    p.cone.scale.set(st.coneScale, 1, st.coneScale);
    p.poolMat.opacity = st.coneOp * 1.0;
    p.poolMat.color.copy(st.color);
    p.pool.scale.set(st.coneScale, st.coneScale, st.coneScale);
  }

  /**
   * Smoothly interpolate all lamp posts to a target state.
   * Uses a SINGLE tween on the shared _state object instead of 11×12=132 individual
   * tweens. Eliminates massive GC pressure from short-lived Tween allocations.
   */
  _tweenToState(target, duration = 1500) {
    if (this._stateTween) this._stateTween.stop();

    this._stateTween = new Tween(this._state, tweenGroup)
      .to({
        intensity: target.intensity,
        distance: target.distance,
        emissive: target.emissive,
        coneOp: target.coneOp,
        coneScale: target.coneScale,
        cr: target.color.r,
        cg: target.color.g,
        cb: target.color.b,
      }, duration)
      .easing(Easing.Quadratic.Out)
      .onUpdate(() => {
        this._state.color.setRGB(this._state.cr, this._state.cg, this._state.cb);
        for (const p of this.posts) this._snapPost(p, this._state);
      })
      .onComplete(() => {
        this._state.color.setRGB(this._state.cr, this._state.cg, this._state.cb);
        this._stateTween = null;
      })
      .start();
  }

  /** Return pre-computed target state for tier (no allocation). */
  _tierState(tier) {
    return TIER_STATES[Math.min(tier, TIER_STATES.length - 1)];
  }

  /**
   * Set tier (milestone transition).
   * @param {number} tier  0-4
   * @param {boolean} animate
   */
  setTier(tier, animate = true) {
    this.currentTier = Math.min(tier, TIER.length - 1);
    const st = this._tierState(this.currentTier);

    if (!animate) {
      this._state.intensity = st.intensity;
      this._state.distance = st.distance;
      this._state.emissive = st.emissive;
      this._state.coneOp = st.coneOp;
      this._state.coneScale = st.coneScale;
      this._state.cr = st.color.r;
      this._state.cg = st.color.g;
      this._state.cb = st.color.b;
      this._state.color.copy(st.color);
      for (const p of this.posts) this._snapPost(p, this._state);
      return;
    }

    this._tweenToState(st, 1500);
  }

  /**
   * Per-coin micro-progression: interpolate between current tier and next.
   * Includes micro-flash (spike before tween) — previously separate method.
   * @param {number} chargeInBar  0 to PLATES_TO_FILL_BAR-1
   */
  microProgress(chargeInBar) {
    const t = chargeInBar / PLATES_TO_FILL_BAR; // 0.0 – 0.9
    const curTier = this.currentTier;
    const nextTier = Math.min(curTier + 1, TIER.length - 1);
    const cur = TIER[curTier];
    const nxt = TIER[nextTier];

    _tempColor.copy(TIER_COLORS[curTier]).lerp(TIER_COLORS[nextTier], t);
    _targetState.intensity = THREE.MathUtils.lerp(cur.intensity, nxt.intensity, t);
    _targetState.distance = THREE.MathUtils.lerp(cur.distance, nxt.distance, t);
    _targetState.emissive = THREE.MathUtils.lerp(cur.emissive, nxt.emissive, t);
    _targetState.coneOp = THREE.MathUtils.lerp(cur.coneOp, nxt.coneOp, t);
    _targetState.coneScale = THREE.MathUtils.lerp(cur.coneR, nxt.coneR, t) / BASE_CONE_R;

    // Micro-flash: spike current state before tweening (flash decays into progression)
    this._state.coneOp += 0.02;
    this._state.intensity += 0.08;
    for (const p of this.posts) this._snapPost(p, this._state);

    this._tweenToState(_targetState, 300);
  }

  /** @deprecated Folded into microProgress. Kept as no-op for compat. */
  microFlash() {}

  /** Milestone flash (dramatic surge on tier change). */
  flash() {
    const cfg = TIER[this.currentTier];
    const target = this._tierState(this.currentTier);

    // Spike shared state to white / boosted values
    this._state.intensity = cfg.intensity * 2;
    this._state.emissive = Math.min(cfg.emissive * 2, 1.0);
    this._state.coneOp = cfg.coneOp * 2;
    this._state.coneScale = cfg.coneR * 1.3 / BASE_CONE_R;
    this._state.cr = 1; this._state.cg = 1; this._state.cb = 1;
    this._state.color.setRGB(1, 1, 1);

    // Apply spike to all posts
    for (const p of this.posts) this._snapPost(p, this._state);

    // Settle from spike to tier target
    this._tweenToState(target, 1300);
  }

  // ── Update / recycle ──

  update(delta, speed) {
    // Skip all work when lamps are hidden (tier 0, no plates collected yet)
    if (!this.posts[0].group.visible) return;

    const move = speed * delta;

    for (const p of this.posts) {
      p.group.position.z += move;

      if (p.group.position.z > RECYCLE_Z) {
        p.group.position.z -= TOTAL_SPAN;
        this._snapPost(p, this._state);
      }
    }

    // Only enable nearest PointLights for performance (no alloc/sort)
    let activeCount = 0;
    for (const p of this.posts) {
      const near = Math.abs(p.group.position.z) < 60;
      p.light.visible = near && activeCount < MAX_ACTIVE_LIGHTS;
      if (p.light.visible) activeCount++;
    }
  }

  // ── Reset ──

  resetAll() {
    this.currentTier = 0;
    if (this._stateTween) { this._stateTween.stop(); this._stateTween = null; }

    const st = this._tierState(0);
    this._state.intensity = st.intensity;
    this._state.distance = st.distance;
    this._state.emissive = st.emissive;
    this._state.coneOp = st.coneOp;
    this._state.coneScale = st.coneScale;
    this._state.cr = st.color.r;
    this._state.cg = st.color.g;
    this._state.cb = st.color.b;
    this._state.color.copy(st.color);

    let pair = 0;
    for (let i = 0; i < this.posts.length; i += 2) {
      const z = -30 - pair * LAMP_SPACING;
      this.posts[i].group.position.z = z;
      this.posts[i + 1].group.position.z = z;
      pair++;
    }
    for (const p of this.posts) {
      this._snapPost(p, this._state);
      p.group.visible = false;
    }
  }

  // Legacy compat
  lightNext() {}
  lightUp() {}
}
