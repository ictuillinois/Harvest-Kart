import * as THREE from 'three';
import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';
import { ROAD_WIDTH, PLATES_TO_FILL_BAR } from '../utils/constants.js';

// ── Layout ──
const LAMP_PAIRS   = 10;
const LAMP_SPACING = 35;
const TOTAL_SPAN   = LAMP_SPACING * LAMP_PAIRS;
const RECYCLE_Z    = 20;
const MAX_ACTIVE_LIGHTS = 8;
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

// Ambient intensity multipliers per tier (applied to base theme value)
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

    // Shared current interpolated state (for recycling)
    this._state = {
      intensity: TIER[0].intensity,
      distance: TIER[0].distance,
      emissive: TIER[0].emissive,
      coneOp: TIER[0].coneOp,
      coneScale: 1.0,
      color: TIER_COLORS[0].clone(),
    };

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x666666, metalness: 0.6, roughness: 0.4,
    });
    const poolTex = _makePoolTexture();

    for (let pair = 0; pair < LAMP_PAIRS; pair++) {
      for (const side of [-1, 1]) {
        const group = new THREE.Group();

        // Pole
        group.add((() => {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8), poleMat);
          m.position.y = 2.25; return m;
        })());

        // Arm
        group.add((() => {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), poleMat);
          m.rotation.z = Math.PI / 2; m.position.set(-0.9, 4.3, 0); return m;
        })());

        // Housing
        group.add((() => {
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.2, 0.35),
            new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.4 }));
          m.position.set(-1.8, 4.35, 0); return m;
        })());

        // Lamp head (bulb)
        const headMat = new THREE.MeshStandardMaterial({
          color: TIER_COLORS[0],
          emissive: TIER_COLORS[0],
          emissiveIntensity: TIER[0].emissive,
          metalness: 0.2, roughness: 0.4,
        });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10), headMat);
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

        scene.add(group);
        this.posts.push({ group, head, headMat, light, cone, coneMat, pool, poolMat });
      }
    }
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
   * @param {object} target  { intensity, distance, emissive, coneOp, coneScale, color }
   * @param {number} duration ms
   */
  _tweenToState(target, duration = 1500) {
    // Update shared state for recycling
    Object.assign(this._state, {
      intensity: target.intensity,
      distance: target.distance,
      emissive: target.emissive,
      coneOp: target.coneOp,
      coneScale: target.coneScale,
      color: target.color.clone(),
    });

    for (const p of this.posts) {
      new Tween(p.light, tweenGroup)
        .to({ intensity: target.intensity, distance: target.distance }, duration)
        .easing(Easing.Quadratic.Out).start();

      // Color tween (light)
      new Tween(p.light.color, tweenGroup)
        .to({ r: target.color.r, g: target.color.g, b: target.color.b }, duration)
        .easing(Easing.Quadratic.Out).start();

      new Tween(p.headMat, tweenGroup)
        .to({ emissiveIntensity: target.emissive }, duration)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.headMat.emissive, tweenGroup)
        .to({ r: target.color.r, g: target.color.g, b: target.color.b }, duration)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.headMat.color, tweenGroup)
        .to({ r: target.color.r, g: target.color.g, b: target.color.b }, duration)
        .easing(Easing.Quadratic.Out).start();

      // Cone opacity + color
      new Tween(p.coneMat, tweenGroup)
        .to({ opacity: target.coneOp }, duration)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.coneMat.color, tweenGroup)
        .to({ r: target.color.r, g: target.color.g, b: target.color.b }, duration)
        .easing(Easing.Quadratic.Out).start();

      // Cone scale (width grows)
      new Tween(p.cone.scale, tweenGroup)
        .to({ x: target.coneScale, z: target.coneScale }, duration)
        .easing(Easing.Quadratic.Out).start();

      // Pool
      new Tween(p.poolMat, tweenGroup)
        .to({ opacity: target.coneOp * 1.0 }, duration)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.poolMat.color, tweenGroup)
        .to({ r: target.color.r, g: target.color.g, b: target.color.b }, duration)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.pool.scale, tweenGroup)
        .to({ x: target.coneScale, y: target.coneScale, z: target.coneScale }, duration)
        .easing(Easing.Quadratic.Out).start();
    }
  }

  /** Build a target state from tier config. */
  _tierState(tier) {
    const cfg = TIER[Math.min(tier, TIER.length - 1)];
    return {
      intensity: cfg.intensity,
      distance: cfg.distance,
      emissive: cfg.emissive,
      coneOp: cfg.coneOp,
      coneScale: cfg.coneR / BASE_CONE_R,
      color: TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)].clone(),
    };
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
      Object.assign(this._state, { ...st, color: st.color.clone() });
      for (const p of this.posts) this._snapPost(p, st);
      return;
    }

    this._tweenToState(st, 1500);
  }

  /**
   * Per-coin micro-progression: interpolate between current tier and next.
   * @param {number} chargeInBar  0 to PLATES_TO_FILL_BAR-1
   */
  microProgress(chargeInBar) {
    const t = chargeInBar / PLATES_TO_FILL_BAR; // 0.0 – 0.9
    const curTier = this.currentTier;
    const nextTier = Math.min(curTier + 1, TIER.length - 1);
    const cur = TIER[curTier];
    const nxt = TIER[nextTier];
    const curColor = TIER_COLORS[curTier];
    const nxtColor = TIER_COLORS[nextTier];

    const st = {
      intensity: THREE.MathUtils.lerp(cur.intensity, nxt.intensity, t),
      distance: THREE.MathUtils.lerp(cur.distance, nxt.distance, t),
      emissive: THREE.MathUtils.lerp(cur.emissive, nxt.emissive, t),
      coneOp: THREE.MathUtils.lerp(cur.coneOp, nxt.coneOp, t),
      coneScale: THREE.MathUtils.lerp(cur.coneR, nxt.coneR, t) / BASE_CONE_R,
      color: curColor.clone().lerp(nxtColor, t),
    };

    this._tweenToState(st, 300);
  }

  /** Per-coin micro-flash (brief pulse on every plate hit). */
  microFlash() {
    for (const p of this.posts) {
      const origOp = p.coneMat.opacity;
      const origInt = p.light.intensity;
      p.coneMat.opacity = origOp + 0.02;
      p.light.intensity = origInt + 0.08;

      new Tween(p.coneMat, tweenGroup)
        .to({ opacity: origOp }, 250)
        .easing(Easing.Quadratic.In).start();
      new Tween(p.light, tweenGroup)
        .to({ intensity: origInt }, 250)
        .easing(Easing.Quadratic.In).start();
    }
  }

  /** Milestone flash (dramatic surge on tier change). */
  flash() {
    const cfg = TIER[this.currentTier];
    const spikeScale = cfg.coneR * 1.3 / BASE_CONE_R;
    const white = new THREE.Color('#ffffff');

    for (const p of this.posts) {
      // Spike intensity + emissive
      p.light.intensity = cfg.intensity * 2;
      p.headMat.emissiveIntensity = Math.min(cfg.emissive * 2, 1.0);
      p.coneMat.opacity = cfg.coneOp * 2;

      // Flash to white then settle to tier color
      p.coneMat.color.copy(white);
      p.headMat.emissive.copy(white);

      // Scale spike
      p.cone.scale.set(spikeScale, 1, spikeScale);
      p.pool.scale.setScalar(spikeScale);

      const target = this._tierState(this.currentTier);

      // Settle over 1.3s
      new Tween(p.light, tweenGroup)
        .to({ intensity: cfg.intensity }, 1300)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.headMat, tweenGroup)
        .to({ emissiveIntensity: cfg.emissive }, 1300)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.coneMat, tweenGroup)
        .to({ opacity: cfg.coneOp }, 1300)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.coneMat.color, tweenGroup)
        .to({ r: target.color.r, g: target.color.g, b: target.color.b }, 1000)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.headMat.emissive, tweenGroup)
        .to({ r: target.color.r, g: target.color.g, b: target.color.b }, 1000)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.cone.scale, tweenGroup)
        .to({ x: target.coneScale, z: target.coneScale }, 1300)
        .easing(Easing.Quadratic.Out).start();
      new Tween(p.pool.scale, tweenGroup)
        .to({ x: target.coneScale, y: target.coneScale, z: target.coneScale }, 1300)
        .easing(Easing.Quadratic.Out).start();
    }
  }

  // ── Update / recycle ──

  update(delta, speed) {
    const move = speed * delta;

    for (const p of this.posts) {
      p.group.position.z += move;

      if (p.group.position.z > RECYCLE_Z) {
        p.group.position.z -= TOTAL_SPAN;
        this._snapPost(p, this._state);
      }
    }

    // Only enable nearest PointLights for performance
    const sorted = [...this.posts].sort(
      (a, b) => Math.abs(a.group.position.z) - Math.abs(b.group.position.z));
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].light.visible = i < MAX_ACTIVE_LIGHTS;
    }
  }

  // ── Reset ──

  resetAll() {
    this.currentTier = 0;
    const st = this._tierState(0);
    Object.assign(this._state, { ...st, color: st.color.clone() });

    let pair = 0;
    for (let i = 0; i < this.posts.length; i += 2) {
      const z = -30 - pair * LAMP_SPACING;
      this.posts[i].group.position.z = z;
      this.posts[i + 1].group.position.z = z;
      pair++;
    }
    for (const p of this.posts) this._snapPost(p, st);
  }

  // Legacy compat
  lightNext() {}
  lightUp() {}
}
