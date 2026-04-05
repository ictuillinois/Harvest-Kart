import * as THREE from 'three';
import { DRIVER_TYPES } from '../utils/constants.js';
import { gameRoot } from '../utils/base.js';
import { fadeIn, fadeOut } from '../utils/transition.js';
import { getModel, MODEL_URLS } from '../utils/assetLoader.js';
import { Kart } from '../game/Kart.js';

// Driver vehicleType → model URL
const VEHICLE_MODELS = {
  sportsGT: MODEL_URLS.vehicleEthan,
  compact:  MODEL_URLS.vehicleKate,
  formula:  MODEL_URLS.vehicleDestiny,
  rally:    MODEL_URLS.vehicleLuke,
};

// Per-vehicle material finish profiles (mirrors Kart.js)
const MATERIAL_PROFILES = {
  candy:     { metalness: 0.25, roughness: 0.30, emissiveIntensity: 0.04, envMapIntensity: 1.0 },
  raceMetal: { metalness: 0.55, roughness: 0.15, emissiveIntensity: 0.22, envMapIntensity: 1.8 },
  matte:     { metalness: 0.15, roughness: 0.45, emissiveIntensity: 0.03, envMapIntensity: 0.6 },
  rallySatin:{ metalness: 0.35, roughness: 0.22, emissiveIntensity: 0.20, envMapIntensity: 1.6 },
};

// Per-vehicle FBX mesh config (mirrors Kart.js)
const VEHICLE_MESH_CONFIG = {
  sportsGT: {
    bodyNames: ['sonata_pantera_grey'],
    wheelNames: [],
    hiddenNames: [],
    hasTexture: true,
    glassTint: 0x0e1a2a,
    sportsLights: true,
    headlightYFrac: 0.30,
    headlightXFrac: 0.52,
    taillightYFrac: 0.30,
    taillightXFrac: 0.42,
  },
  compact: {
    bodyNames: ['body'],
    wheelNames: ['front_wheels001', 'back_wheels001'],
    hiddenNames: [],
    hasTexture: false,
    paintIndices: [0, 3],
    glassIndices: [1, 4],
    chromeIndices: [2],
    glassTint: 0x1a1228,
    materialProfile: 'candy',
    compactLights: true,
    headlightYFrac: 0.40,
    headlightXFrac: 0.50,
    taillightYFrac: 0.38,
    taillightXFrac: 0.38,
  },
  formula: {
    bodyNames: ['amg_gt_body'],
    wheelNames: ['lfwheel001', 'rrwheel', 'rfwheel001', 'lrwheel002'],
    hiddenNames: [],
    hasTexture: true,
    paintIndices: [0],
    accentIndices: [1],
    glassIndices: [2],
    glassTint: 0x080810,
    materialProfile: 'raceMetal',
  },
  rally: {
    bodyNames: ['kuzov'],
    wheelNames: ['kolesofr', 'kolesobr', 'kolesobl', 'kolesofl'],
    hubNames: ['stupizafr', 'stupizafl', 'stupizabl', 'stupizabr'],
    glassNames: ['steklo_digatelya', 'stekla_perednih_far'],
    brakeLightNames: ['stop_signali'],
    headlightMeshNames: ['front_fari'],
    chromeNames: ['zerkalo'],
    hiddenNames: ['hullcollider'],
    hasTexture: true,
    glassTint: 0x060a08,
    materialProfile: 'rallySatin',
    emissiveOnlyTint: true,
    rallyLights: true,
  },
};

function starRow(label, filled, total = 5) {
  const stars = Array.from({ length: total }, (_, i) =>
    `<span class="ds-star ${i < filled ? 'filled' : ''}">${i < filled ? '★' : '☆'}</span>`
  ).join('');
  return `<div class="ds-stat"><span class="ds-stat-label">${label}</span><span class="ds-stat-stars">${stars}</span></div>`;
}

export class DriverSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'driver-select';
    this._previews = [];     // per-card { scene, camera, model, canvas }
    this._renderer = null;
    this._animFrame = null;
    this._hoveredIdx = -1;
    this._visible = false;

    const cards = DRIVER_TYPES.map((d, i) => `
      <div class="ds-card" data-index="${i}" style="--accent:${d.accentColor}">
        <div class="ds-img-wrap">
          <img class="ds-img" src="${d.avatar}" alt="${d.name}" draggable="false" />
        </div>
        <div class="ds-vehicle-wrap" data-idx="${i}"></div>
        <div class="ds-info">
          <div class="ds-desc">${d.description}</div>
          <div class="ds-stats">
            ${starRow('SPD', d.stats.topSpeed)}
            ${starRow('ACC', d.stats.acceleration)}
            ${starRow('EFF', d.stats.efficiency)}
          </div>
        </div>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="ds-bg"></div>
      <button class="nav-back" id="ds-back" aria-label="Back">&#9664; BACK</button>
      <div class="ds-content">
        <h2 class="ds-title">CHOOSE YOUR DRIVER</h2>
        <div class="ds-cards">${cards}</div>
      </div>
    `;

    gameRoot().appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap');

      #driver-select {
        position: fixed; inset: 0; z-index: 100;
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      .ds-bg {
        position: absolute; inset: 0;
        background:
          linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.78)),
          url('${DRIVER_TYPES[0].avatar}') center / cover no-repeat;
        filter: blur(20px) saturate(0.5);
      }

      #ds-back {
        position: absolute; top: clamp(12px, 2vh, 28px); left: clamp(12px, 1.5vw, 28px); z-index: 10;
      }

      .ds-content {
        position: relative; z-index: 1;
        text-align: center;
        padding: clamp(8px, 1.5vh, 20px) clamp(12px, 2vw, 32px);
        width: 100%;
        max-width: clamp(700px, 80vw, 1600px);
      }

      .ds-title {
        font-family: 'Orbitron', 'Impact', sans-serif;
        font-size: clamp(18px, 2.5vw, 48px);
        font-weight: 900;
        color: #fff;
        letter-spacing: clamp(2px, 0.4vw, 8px);
        margin-bottom: clamp(12px, 2vh, 32px);
        text-shadow: 0 0 20px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.8);
      }

      .ds-cards {
        display: flex; justify-content: center;
        gap: clamp(10px, 1.2vw, 28px);
        align-items: stretch;
      }

      /* ── Card ── */
      .ds-card {
        display: flex; flex-direction: column;
        cursor: pointer;
        border-radius: clamp(6px, 0.7vw, 16px);
        background: rgba(10,10,15,0.85);
        border: 2px solid rgba(255,255,255,0.08);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: transform 0.3s ease, border-color 0.3s, box-shadow 0.3s,
                    opacity 0.3s, filter 0.3s;
        width: clamp(140px, 17vw, 340px);
        overflow: hidden;
        user-select: none;
      }
      .ds-card.dimmed {
        opacity: 0.2;
        filter: grayscale(0.8) brightness(0.4);
        transform: scale(0.90);
      }
      .ds-card.active {
        border-color: var(--accent, #fff);
        transform: translateY(-8px) scale(1.05);
        box-shadow:
          0 0 28px color-mix(in srgb, var(--accent, #fff) 45%, transparent),
          0 12px 36px rgba(0,0,0,0.6);
      }
      @media (hover: hover) {
        .ds-card:hover:not(.active):not(.dimmed) {
          border-color: rgba(255,255,255,0.25);
          transform: translateY(-4px);
        }
      }

      /* ── Image ── */
      .ds-img-wrap {
        width: 100%;
        aspect-ratio: 1;
        overflow: hidden;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .ds-img {
        width: 100%; height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.35s ease;
      }
      .ds-card:hover .ds-img,
      .ds-card.active .ds-img {
        transform: scale(1.06);
      }

      /* ── Vehicle preview ── */
      .ds-vehicle-wrap {
        width: 100%;
        aspect-ratio: 2 / 1;
        background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.3));
        display: flex;
        align-items: center;
        justify-content: center;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .ds-vehicle-wrap canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      /* ── Info ── */
      .ds-info {
        padding: clamp(6px, 0.8vh, 16px) clamp(8px, 0.8vw, 20px) clamp(8px, 1vh, 20px);
        display: flex; flex-direction: column;
        align-items: center; gap: clamp(2px, 0.3vh, 6px);
      }
      .ds-desc {
        margin-top: 2px;
        font-size: clamp(8px, 0.8vw, 16px);
        color: rgba(255,255,255,0.4);
        font-style: italic;
        margin-bottom: clamp(4px, 0.5vh, 10px);
      }

      /* ── Stats ── */
      .ds-stats {
        width: 100%;
        display: flex; flex-direction: column; gap: clamp(2px, 0.3vh, 6px);
      }
      .ds-stat {
        display: flex; align-items: center;
        justify-content: space-between;
        gap: clamp(4px, 0.4vw, 10px);
      }
      .ds-stat-label {
        font-family: 'Orbitron', monospace;
        font-size: clamp(6px, 0.6vw, 14px);
        font-weight: 500;
        color: rgba(255,255,255,0.35);
        letter-spacing: 1px;
        min-width: clamp(20px, 2.5vw, 50px);
        text-align: left;
      }
      .ds-stat-stars {
        display: flex; gap: 1px;
      }
      .ds-star {
        font-size: clamp(9px, 0.9vw, 18px);
        color: rgba(255,255,255,0.15);
        transition: color 0.3s;
      }
      .ds-star.filled {
        color: #ffcc00;
        text-shadow: 0 0 4px rgba(255,200,0,0.4);
      }
      .ds-card.active .ds-star.filled {
        color: var(--accent, #ffcc00);
        text-shadow: 0 0 6px color-mix(in srgb, var(--accent, #ffcc00) 60%, transparent);
      }
    `;
    document.head.appendChild(style);

    this.el.querySelector('#ds-back').addEventListener('click', () => onBack());

    const cardEls = this.el.querySelectorAll('.ds-card');
    cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);
      card.addEventListener('click', () => {
        cardEls.forEach((c) => {
          c.classList.remove('active', 'dimmed');
          if (c !== card) c.classList.add('dimmed');
        });
        card.classList.add('active');
        this._hoveredIdx = idx;
        setTimeout(() => onSelect(idx), 400);
      });
      card.addEventListener('mouseenter', () => {
        if (!card.classList.contains('dimmed')) {
          this._hoveredIdx = idx;
        }
      });
      card.addEventListener('mouseleave', () => {
        if (this._hoveredIdx === idx && !card.classList.contains('active')) {
          this._hoveredIdx = -1;
        }
      });
    });

    // Previews are initialized lazily on first show() after models are preloaded
    this._previewsReady = false;
  }

  // ═══════════════════════════════════════════
  //  3D VEHICLE PREVIEWS
  // ═══════════════════════════════════════════

  _initPreviews() {
    const previewW = 256;
    const previewH = 128;

    this._renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    this._renderer.setSize(previewW, previewH);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.3;
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Generate a shared showroom environment map for reflections
    const envMap = this._createShowroomEnvMap();

    DRIVER_TYPES.forEach((driver, i) => {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x151520);
      scene.environment = envMap;

      // ── 6-light showroom rig ──
      // Key light — main illumination, upper-right front
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
      keyLight.position.set(4, 6, 3);
      scene.add(keyLight);

      // Fill light — softer, upper-left, fills shadows
      const fillLight = new THREE.DirectionalLight(0x8899bb, 0.8);
      fillLight.position.set(-4, 4, 2);
      scene.add(fillLight);

      // Rim/back light — bright edge highlights along silhouette
      const rimLight = new THREE.DirectionalLight(0xaaccff, 1.2);
      rimLight.position.set(0, 5, -4);
      scene.add(rimLight);

      // Ground bounce — from below, simulates floor reflection
      const bounceLight = new THREE.DirectionalLight(0x444455, 0.4);
      bounceLight.position.set(0, -3, 2);
      scene.add(bounceLight);

      // Ambient floor
      const ambient = new THREE.AmbientLight(0x334455, 0.5);
      scene.add(ambient);

      // Hemisphere — sky/ground color separation
      const hemi = new THREE.HemisphereLight(0x6688aa, 0x222233, 0.4);
      scene.add(hemi);

      // Camera: 3/4 front showroom angle
      const camera = new THREE.PerspectiveCamera(34, previewW / previewH, 0.1, 100);
      camera.position.set(6.0, 3.0, 6.0);
      camera.lookAt(0, 0.3, 0);

      // Load vehicle model
      const modelUrl = VEHICLE_MODELS[driver.vehicleType];
      let model = null;
      if (modelUrl) {
        model = getModel(modelUrl);
        if (model && model.children.length > 0) {
          const dark = this._isDark(driver.carBody);
          const meshConfig = VEHICLE_MESH_CONFIG[driver.vehicleType] || {};
          const bodySet = new Set((meshConfig.bodyNames || []).map(n => n.toLowerCase()));
          const wheelSet = new Set((meshConfig.wheelNames || []).map(n => n.toLowerCase()));
          const hideSet = new Set((meshConfig.hiddenNames || []).map(n => n.toLowerCase()));
          const glassNameSet = new Set((meshConfig.glassNames || []).map(n => n.toLowerCase()));
          const brakeSet = new Set((meshConfig.brakeLightNames || []).map(n => n.toLowerCase()));
          const hlMeshSet = new Set((meshConfig.headlightMeshNames || []).map(n => n.toLowerCase()));
          const chromeNameSet = new Set((meshConfig.chromeNames || []).map(n => n.toLowerCase()));
          const glassIdxSet = new Set(meshConfig.glassIndices || []);
          const chromeIdxSet = new Set(meshConfig.chromeIndices || []);

          const upgradeMat = (mat) => {
            if (mat.type === 'MeshPhongMaterial') {
              const std = new THREE.MeshStandardMaterial();
              std.color.copy(mat.color);
              if (mat.map) { std.map = mat.map; std.map.colorSpace = THREE.SRGBColorSpace; }
              std.metalness = 0.3;
              std.roughness = 0.4;
              return std;
            }
            return mat.clone();
          };
          const makeGlass = (tint) => new THREE.MeshStandardMaterial({
            color: tint || meshConfig.glassTint || 0x112233,
            metalness: 0.85, roughness: 0.08,
            transparent: true, opacity: 0.70, envMapIntensity: 2.0,
          });
          const makeChrome = () => new THREE.MeshStandardMaterial({
            color: 0xdddddd, metalness: 0.95, roughness: 0.08, envMapIntensity: 2.0,
          });
          const applyPaint = (std) => {
            if (dark) {
              if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
              std.color.set(meshConfig.hasTexture ? 0x787888 : 0x444454);
              std.metalness = 0.75;
              std.roughness = 0.06;
              std.emissive = new THREE.Color(0x1e1e30);
              std.emissiveIntensity = 0.55;
              std.envMapIntensity = 3.2;
              return std;
            } else if (meshConfig.emissiveOnlyTint) {
              if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
              std.emissive = new THREE.Color(driver.carBody);
              if (meshConfig.materialProfile === 'rallySatin') {
                std.color.set(0xc8e0cc);
                std.metalness = 0.55;
                std.roughness = 0.12;
                std.emissiveIntensity = 0.32;
                std.envMapIntensity = 2.2;
              } else {
                std.color.set(0xc8c8e0);
                std.metalness = 0.72;
                std.roughness = 0.06;
                std.emissiveIntensity = 0.28;
                std.envMapIntensity = 2.8;
              }
              return std;
            } else {
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

            if (hideSet.has(name)) { child.visible = false; return; }
            if (glassNameSet.has(name)) { child.material = makeGlass(); return; }
            if (chromeNameSet.has(name)) { child.material = makeChrome(); return; }
            if (brakeSet.has(name)) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xff1111, emissive: 0xff0000, emissiveIntensity: 1.2,
                metalness: 0.3, roughness: 0.15,
              }); return;
            }
            if (hlMeshSet.has(name)) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xffffff, emissive: 0xffffdd, emissiveIntensity: 1.8,
                metalness: 0.3, roughness: 0.05,
              }); return;
            }

            const accentIdxSet = new Set(meshConfig.accentIndices || []);

            if (bodySet.has(name)) {
              if (Array.isArray(child.material)) {
                child.material = child.material.map((m, idx) => {
                  if (glassIdxSet.has(idx)) return makeGlass();
                  if (chromeIdxSet.has(idx)) return makeChrome();
                  if (accentIdxSet.has(idx)) {
                    const std = upgradeMat(m);
                    std.color.set(dark ? 0x444450 : driver.carAccent);
                    std.metalness = dark ? 0.6 : 0.3;
                    std.roughness = dark ? 0.12 : 0.3;
                    std.emissive = new THREE.Color(dark ? 0x060608 : driver.carAccent);
                    std.emissiveIntensity = dark ? 0.1 : 0.05;
                    std.envMapIntensity = dark ? 1.5 : 1.0;
                    return std;
                  }
                  if (meshConfig.paintIndices && !meshConfig.paintIndices.includes(idx)) {
                    const std = upgradeMat(m); std.metalness = 0.4; std.roughness = 0.3; return std;
                  }
                  const std = upgradeMat(m); return applyPaint(std);
                });
              } else {
                child.material = applyPaint(upgradeMat(child.material));
              }
              return;
            }

            if (wheelSet.has(name)) {
              if (Array.isArray(child.material)) {
                child.material = child.material.map(m => {
                  const std = upgradeMat(m);
                  std.color.set(0x2a2a2a); std.roughness = 0.7;
                  std.metalness = 0.15; std.envMapIntensity = 0.3;
                  return std;
                });
              } else {
                child.material = upgradeMat(child.material);
                child.material.color.set(0x2a2a2a);
                child.material.roughness = 0.7;
                child.material.metalness = 0.15;
                child.material.envMapIntensity = 0.3;
              }
              return;
            }

            // Unmatched meshes — upgrade but don't tint
            if (Array.isArray(child.material)) {
              child.material = child.material.map(m => upgradeMat(m));
            } else {
              child.material = upgradeMat(child.material);
            }
          });

          // Dark vehicles: extra blue accent SpotLight + boosted rim
          if (dark) {
            const accent = new THREE.SpotLight(0x4488ff, 2.0, 20, Math.PI / 4, 0.5);
            accent.position.set(3, 3, 0);
            accent.target.position.set(0, 0, 0);
            scene.add(accent);
            scene.add(accent.target);
            rimLight.intensity = 2.0;
          }

          // ── Add light geometry for preview ──
          if (meshConfig.compactLights || meshConfig.sportsLights || meshConfig.rallyLights) {
            const lightBbox = new THREE.Box3().setFromObject(model);
            const lightSize = lightBbox.getSize(new THREE.Vector3());
            const lHalfW = lightSize.x / 2;
            const lHalfL = lightSize.z / 2;
            const lHeight = lightSize.y;
            const lTlY = lHeight * (meshConfig.taillightYFrac || 0.35);
            const lTlZ = lHalfL - 0.02;

            const lHlY = lHeight * (meshConfig.headlightYFrac || 0.35);
            const lHlZ = -(lHalfL - 0.02);
            const lHlXFrac = meshConfig.headlightXFrac || 0.55;
            const lTlXFrac = meshConfig.taillightXFrac || 0.4;

            if (meshConfig.compactLights) {
              Kart._addCompactHeadlights(model, lHalfW, lHlY, lHlZ, lHlXFrac, lHeight);
              Kart._addCompactTaillights(model, lHalfW, lTlY, lTlZ, lTlXFrac, lHeight);
            }
            if (meshConfig.sportsLights) {
              Kart._addSportsHeadlights(model, lHalfW, lHlY, lHlZ, lHlXFrac, lHeight);
              Kart._addSportsTaillights(model, lHalfW, lTlY, lTlZ, lHeight);
            }
            if (meshConfig.rallyLights) {
              Kart._addSUVTaillights(model, lHalfW, lTlY, lTlZ, lTlXFrac, lHeight);
            }
          }

          // Wrap in pivot group — center model at pivot origin BEFORE rotation
          // so it rotates around its own geometric center (no wobble/offset)
          const pivot = new THREE.Group();
          pivot.add(model);

          // Center model inside pivot (pre-rotation)
          const preBbox = new THREE.Box3().setFromObject(model);
          const preCenter = preBbox.getCenter(new THREE.Vector3());
          model.position.set(
            model.position.x - preCenter.x,
            model.position.y - preBbox.min.y,
            model.position.z - preCenter.z,
          );

          pivot.rotation.y = Math.PI * 0.8;

          scene.add(pivot);
          model = pivot; // store pivot as the rotating object
        } else {
          model = null;
        }
      }

      // Reflective showroom floor
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(4, 32),
        new THREE.MeshStandardMaterial({
          color: 0x1a1a22, roughness: 0.3, metalness: 0.4,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.01;
      scene.add(ground);

      // Canvas for this card
      const canvas = document.createElement('canvas');
      canvas.width = previewW;
      canvas.height = previewH;
      const ctx = canvas.getContext('2d');

      const wrap = this.el.querySelector(`.ds-vehicle-wrap[data-idx="${i}"]`);
      if (wrap) wrap.appendChild(canvas);

      this._previews.push({ scene, camera, model, canvas, ctx });
    });

    this._renderAllPreviews();
  }

  /** Generate a showroom cubemap environment for car reflections. */
  _createShowroomEnvMap() {
    const envScene = new THREE.Scene();

    // Ceiling — bright studio overhead
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: 0xccddee }),
    );
    ceiling.position.y = 30;
    ceiling.rotation.x = Math.PI / 2;
    envScene.add(ceiling);

    // Studio strip lights on ceiling
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const xPos of [-8, 0, 8]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(2, 40), stripMat);
      strip.position.set(xPos, 29.9, 0);
      strip.rotation.x = Math.PI / 2;
      envScene.add(strip);
    }

    // Walls — neutral gray
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x555566 });
    for (const [ry, x, z] of [[0, 0, -30], [Math.PI, 0, 30], [Math.PI / 2, -30, 0], [-Math.PI / 2, 30, 0]]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(100, 60), wallMat);
      wall.position.set(x, 10, z);
      wall.rotation.y = ry;
      envScene.add(wall);
    }

    // Floor — dark
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: 0x222233 }),
    );
    floor.position.y = -1;
    floor.rotation.x = -Math.PI / 2;
    envScene.add(floor);

    const pmrem = new THREE.PMREMGenerator(this._renderer);
    const envRT = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();

    // Clean up temp scene
    envScene.traverse(c => {
      if (c.isMesh) {
        c.geometry.dispose();
        c.material.dispose();
      }
    });

    return envRT.texture;
  }

  _isDark(hexColor) {
    const c = new THREE.Color(hexColor);
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) < 0.15;
  }

  _renderAllPreviews() {
    const r = this._renderer;
    if (!r) return;

    for (const preview of this._previews) {
      if (!preview.model) continue;
      r.render(preview.scene, preview.camera);
      // Copy renderer output to this card's canvas
      preview.ctx.clearRect(0, 0, preview.canvas.width, preview.canvas.height);
      preview.ctx.drawImage(r.domElement, 0, 0);
    }
  }

  _startAnimation() {
    if (this._animFrame) return;
    let frameCount = 0;
    const animate = () => {
      this._animFrame = requestAnimationFrame(animate);
      const r = this._renderer;
      if (!r) return;
      frameCount++;

      for (let i = 0; i < this._previews.length; i++) {
        const p = this._previews[i];
        if (!p.model) continue;

        const isActive = (i === this._hoveredIdx);
        const speed = isActive ? 0.015 : 0.003;
        p.model.rotation.y += speed;

        // Active cards render every frame; idle cards render every 6th frame
        if (isActive || frameCount % 6 === i) {
          r.render(p.scene, p.camera);
          p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
          p.ctx.drawImage(r.domElement, 0, 0);
        }
      }
    };
    animate();
  }

  _stopAnimation() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  show() {
    this.el.querySelectorAll('.ds-card').forEach(c => c.classList.remove('active', 'dimmed'));
    this._hoveredIdx = -1;
    fadeIn(this.el);
    this._visible = true;
    // Initialize previews on first show (models are preloaded by now)
    if (!this._previewsReady) {
      this._initPreviews();
      this._previewsReady = true;
    }
    this._renderAllPreviews();
    this._startAnimation();
  }

  hide() {
    fadeOut(this.el);
    this._visible = false;
    this._stopAnimation();
  }
}
