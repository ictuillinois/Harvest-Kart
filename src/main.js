import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from './utils/tweenGroup.js';

import { Road } from './game/Road.js';
import { Kart } from './game/Kart.js';
import { Plate } from './game/Plate.js';
import { LampPost } from './game/LampPost.js';
import { Environment } from './game/Environment.js';
import { GameState } from './game/GameState.js';

import { IntroScreen } from './ui/IntroScreen.js';
import { StartScreen } from './ui/StartScreen.js';
import { DriverSelect } from './ui/DriverSelect.js';
import { MapSelect } from './ui/MapSelect.js';
import { HUD } from './ui/HUD.js';
import { WinScreen } from './ui/WinScreen.js';
import { RewardScreen } from './ui/RewardScreen.js';

import { RaceStartSequence } from './game/RaceStartSequence.js';
import { CompletionSequence } from './game/CompletionSequence.js';
import { AMBIENT_MULTIPLIERS } from './game/LampPost.js';

import { setupControls } from './utils/controls.js';
import { playPlateHit, playLampLit, playComboBreak, playWinFanfare, playLaneSwitch, haptic, playMusic, stopMusic, startEngineIdle, stopEngine, updateEngine, playGearShift, playCountdownTone, playCountdownRev, playFinalPowerOn, playStartPress, playDriverSelect, playMapSelect, playTurboBoost } from './utils/audio.js';
import { gameRoot } from './utils/base.js';
import {
  MIN_SPEED_MPH, MAX_SPEED_MPH, STARTING_SPEED_MPH, SCROLL_FACTOR,
  GEAR_THRESHOLDS, GEAR_ACCEL, DECEL_RATE, SHIFT_PAUSE_MS,
  RPM_IDLE, RPM_REDLINE,
  MAP_THEMES, PLATE_SPAWN_INTERVAL, TOTAL_LAMP_POSTS,
  CAMERA_OFFSET, CAMERA_LOOK_AHEAD,
  CAMERA_FOV_MIN, CAMERA_FOV_MAX, CAMERA_SHAKE_THRESHOLD,
  getDriverPhysics,
} from './utils/constants.js';

// --- Renderer ---
// Uses the full browser viewport — no fixed resolution, no CSS transform scaling.
const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile }); // disable AA on mobile
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2)); // 1x on mobile
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // cheaper shadow type for all
gameRoot().appendChild(renderer.domElement);

// --- Scene & Camera ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a0533, 0.006);

// --- Environment map for reflections (glossy/metallic materials) ---
const pmremGenerator = new THREE.PMREMGenerator(renderer);
function updateEnvMap() {
  // Hide kart during env map capture to prevent vehicle color bleeding
  // into the scene's reflections (underglow, emissive body tint cubemap)
  const wasVisible = kart.group.visible;
  kart.group.visible = false;
  const rt = pmremGenerator.fromScene(scene, 0, 0.1, 100);
  scene.environment = rt.texture;
  kart.group.visible = wasVisible;
}

const camera = new THREE.PerspectiveCamera(CAMERA_FOV_MIN, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);
camera.lookAt(0, 0.5, -CAMERA_LOOK_AHEAD);

// --- Post-processing (single combined pass: vignette + color grade) ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const comboShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.25 },
    offset: { value: 1.5 },
    saturation: { value: 1.0 },
    contrast: { value: 1.0 },
    brightness: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness, offset;
    uniform float saturation, contrast, brightness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      // Vignette
      float dist = length(vUv - 0.5) * 2.0;
      color.rgb *= 1.0 - darkness * smoothstep(offset - 0.5, offset, dist);
      // Color grade
      color.rgb *= brightness;
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);
      gl_FragColor = color;
    }
  `,
};
const colorGradePass = new ShaderPass(comboShader);
composer.addPass(colorGradePass);

// --- Game objects ---
const gameState = new GameState();
const road = new Road(scene);
const kart = new Kart(scene);
const plates = new Plate(scene);
const lampPosts = new LampPost(scene);
const environment = new Environment(scene, renderer);

// ── Gear/RPM state ──
let currentGear = 0;
let shiftCooldown = 0;
let currentRPM = RPM_IDLE;

let _lastRpmQ = 0; // debounce engine audio updates

// ── Turbo boost state ──
let turboActive = false;
let turboTimer = 0;
const TURBO_BOOST_MPH = 10;
const TURBO_DURATION = 3.0;

// Active per-driver physics (set when driver is selected)
let activePhysics = {
  topSpeed: MAX_SPEED_MPH,
  gearAccel: GEAR_ACCEL,
  gearThresholds: GEAR_THRESHOLDS,
  decelRate: DECEL_RATE,
  coastFloor: MIN_SPEED_MPH,
  laneSwitchMs: 200,
  chargeMultiplier: 1.0,
};

function computeGearAndRPM(speedMph) {
  const thresholds = activePhysics.gearThresholds;
  let gear = 0;
  for (let g = thresholds.length - 2; g >= 0; g--) {
    if (speedMph >= thresholds[g]) { gear = g; break; }
  }
  gear = Math.min(gear, activePhysics.gearAccel.length - 1);
  const lo = thresholds[gear], hi = thresholds[gear + 1];
  const t = Math.max(0, Math.min(1, (speedMph - lo) / (hi - lo)));
  const rpm = RPM_IDLE + t * (RPM_REDLINE - RPM_IDLE);
  return { gear, rpm: Math.max(RPM_IDLE, Math.min(RPM_REDLINE, rpm)) };
}

// Per-theme vehicle lighting config — aggressive intensities
const THEME_VEHICLE_LIGHT = {
  usa:    { headlights: 5.0, backfill: 4.0, underglow: 5.0 },
  brazil: { headlights: 2.0, backfill: 2.5, underglow: 3.0 },
  peru:   { headlights: 3.0, backfill: 3.0, underglow: 4.0 },
};

let kartLights = [];

function addKartLights(themeId) {
  removeKartLights();
  const cfg = THEME_VEHICLE_LIGHT[themeId] || THEME_VEHICLE_LIGHT.brazil;

  // === HEADLIGHTS — single PointLight (replaces 2 SpotLights for perf) ===
  const headlight = new THREE.PointLight(0xfff5e6, cfg.headlights, 15, 2);
  headlight.position.set(0, 0.8, -2);
  kart.group.add(headlight);
  kartLights.push(headlight);

  // === CAMERA BACKFILL ===
  const backfill = new THREE.PointLight(0xaabbdd, cfg.backfill, 10, 2);
  backfill.position.set(0, 5, 5);
  kart.group.add(backfill);
  kartLights.push(backfill);

  // Boost underglow for theme
  if (kart._underglow) {
    kart._underglow.intensity = cfg.underglow;
  }
}

function removeKartLights() {
  for (const light of kartLights) {
    kart.group.remove(light);
    scene.remove(light); // in case target was added to scene
  }
  kartLights = [];
}

// --- Helper: reset game and go home ---
function goHome() {
  if (raceStart) { raceStart.cancel(); raceStart = null; }
  if (completionSeq) { completionSeq.cancel(); completionSeq = null; }
  stopEngine();
  controls.unlock();
  removeKartLights();
  removeStartLine();
  // Reset timer color (may be red from tier 3 urgency)
  const timerEl = document.getElementById('hud-time');
  if (timerEl) timerEl.style.color = '';
  gameState.reset();
  hud.reset();
  lampPosts.resetAll();
  kart.currentLane = 1;
  kart.isSwitching = false;
  kart.group.position.x = 0;
  plates.resetSpawnRate();
  gameState.transition('menu');
}

// --- Pause toggle ---
function togglePause() {
  if (gameState.state === 'playing') {
    gameState.transition('paused');
  } else if (gameState.state === 'paused') {
    gameState.transition('playing');
  }
}

// --- UI ---
const startScreen = new StartScreen(() => {
  playStartPress();
  gameState.transition('driverSelect');
});

const driverSelect = new DriverSelect(
  (driverIndex) => {
    playDriverSelect();
    gameState.selectedDriver = driverIndex;
    activePhysics = getDriverPhysics(driverIndex);
    kart.laneSwitchMs = activePhysics.laneSwitchMs;
    // Defer kart.setDriver() to map select → playing transition (behind loading screen)
    gameState.transition('mapSelect');
  },
  () => gameState.transition('menu')
);

// ══════════════════════════════════════════
//  LOADING SCREEN — styled overlay with progress bar
// ══════════════════════════════════════════
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loading-overlay';
loadingOverlay.innerHTML = `
  <div class="lo-content">
    <div class="lo-title">PREPARING TRACK</div>
    <div class="lo-bar-wrap">
      <div class="lo-bar-track">
        <div class="lo-bar-fill" id="lo-bar-fill"></div>
        <div class="lo-bar-glow"></div>
      </div>
    </div>
    <div class="lo-hint" id="lo-hint">Loading environment...</div>
  </div>
`;
Object.assign(loadingOverlay.style, {
  position: 'fixed', inset: '0', zIndex: '200',
  background: '#000', opacity: '0', pointerEvents: 'none',
  transition: 'opacity 0.5s ease', display: 'none',
  willChange: 'opacity',
  contain: 'strict',
});

const loStyle = document.createElement('style');
loStyle.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap');
  .lo-content {
    position: absolute; left: 50%; bottom: 18%;
    transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center;
    gap: clamp(10px, 1.5vh, 20px);
    width: clamp(200px, 40vw, 500px);
  }
  .lo-title {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(11px, 1.3vw, 20px);
    font-weight: 700;
    color: #22ffaa;
    letter-spacing: clamp(3px, 0.5vw, 8px);
    text-shadow: 0 0 12px rgba(34,255,170,0.4);
    animation: loPulse 1.5s ease-in-out infinite;
  }
  .lo-bar-wrap {
    width: 100%;
    padding: 0 4px;
  }
  .lo-bar-track {
    position: relative;
    width: 100%; height: clamp(4px, 0.6vh, 8px);
    background: rgba(255,255,255,0.08);
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(34,255,170,0.15);
  }
  .lo-bar-fill {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 0%;
    background: linear-gradient(90deg, #00cc66, #22ffaa, #00ff88);
    border-radius: 10px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(34,255,170,0.5);
  }
  .lo-bar-glow {
    position: absolute; inset: -2px;
    border-radius: 12px;
    box-shadow: 0 0 12px rgba(34,255,170,0.1);
    pointer-events: none;
  }
  .lo-hint {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(7px, 0.8vw, 12px);
    font-weight: 500;
    color: rgba(255,255,255,0.3);
    letter-spacing: 2px;
  }
  @keyframes loPulse {
    0%,100% { opacity: 0.7; } 50% { opacity: 1; }
  }
`;
document.head.appendChild(loStyle);
document.body.appendChild(loadingOverlay);

const loBarFill = loadingOverlay.querySelector('#lo-bar-fill');
const loHint = loadingOverlay.querySelector('#lo-hint');

function setLoadProgress(pct, hint) {
  loBarFill.style.width = Math.min(100, pct) + '%';
  if (hint) loHint.textContent = hint;
}

function fadeToBlack() {
  return new Promise(resolve => {
    setLoadProgress(0, 'Initializing...');
    loadingOverlay.style.display = 'block';
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.pointerEvents = 'all';
    void loadingOverlay.offsetWidth;
    loadingOverlay.style.opacity = '1';
    setTimeout(resolve, 520);
  });
}

function clearLoadingOverlay() {
  setLoadProgress(100, 'Ready!');
  // Don't hide overlay — RaceStartSequence reuses it for seamless fade-out
}

const mapSelect = new MapSelect(
  async (mapIndex) => {
    playMapSelect();
    gameState.selectedMap = mapIndex;

    // Fade to black FIRST so the build happens behind a black screen
    await fadeToBlack();

    // Start track music immediately — user hears it while scene loads
    const musicKey = MAP_MUSIC_KEYS[mapIndex] || 'brazil';
    playMusic(musicKey);

    // Yield to browser so the black screen paints before heavy work
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // ── Stage 1: Build vehicle ──
    setLoadProgress(10, 'Building vehicle...');
    await new Promise(r => requestAnimationFrame(r));
    kart.setDriver(gameState.selectedDriver);

    // ── Stage 2: Build environment ──
    setLoadProgress(25, 'Loading scenery...');
    await new Promise(r => requestAnimationFrame(r));
    await environment.build(mapIndex);

    // Yield to let browser GC after heavy build allocations
    await new Promise(r => setTimeout(r, 50));

    // ── Stage 3: Road + env map ──
    setLoadProgress(50, 'Generating reflections...');
    await new Promise(r => requestAnimationFrame(r));
    const themeId = MAP_THEMES[mapIndex]?.id || 'brazil';
    road.setThemeColor(themeId);
    updateEnvMap();

    // ── Stage 4: Post-processing + color grading ──
    setLoadProgress(65, 'Applying effects...');
    const cg = MAP_THEMES[mapIndex]?.colorGrade || { saturation: 1, contrast: 1, brightness: 1 };
    colorGradePass.uniforms.saturation.value = cg.saturation;
    colorGradePass.uniforms.contrast.value = cg.contrast;
    colorGradePass.uniforms.brightness.value = cg.brightness;

    // ── Stage 5: Pre-build gameplay objects (before warm-up so shaders compile) ──
    setLoadProgress(70, 'Building gameplay...');
    await new Promise(r => requestAnimationFrame(r));

    // Add kart lights NOW (normally done in 'playing' state handler)
    removeKartLights();
    addKartLights(themeId);

    // Build start line NOW
    removeStartLine();
    buildStartLine();

    // Reset lamp posts + plates to gameplay state
    lampPosts.resetAll();
    lampPosts.setTier(0, false);
    plates.resetSpawnRate();

    // Pre-create particles + turbo glow light
    kart.warmUp();
    // Pre-spawn a plate to compile plate materials
    plates.spawnPlate(-50);

    // ── Stage 6: Position camera at gameplay view for warm-up ──
    setLoadProgress(78, 'Compiling shaders...');
    await new Promise(r => requestAnimationFrame(r));

    // Save camera state, move to gameplay position so correct objects are in frustum
    const savedCamY = camera.position.y;
    const savedCamZ = camera.position.z;
    camera.position.y = CAMERA_OFFSET.y;
    camera.position.z = CAMERA_OFFSET.z;
    camera.lookAt(0, 0, -CAMERA_LOOK_AHEAD);
    camera.updateProjectionMatrix();

    renderer.compile(scene, camera);

    // ── Stage 7: Warm-up renders from gameplay + pre-race cameras ──
    setLoadProgress(85, 'Warming up GPU...');
    await new Promise(r => requestAnimationFrame(r));
    // Gameplay camera renders
    for (let i = 0; i < 3; i++) {
      composer.render();
      await new Promise(r => requestAnimationFrame(r));
    }
    // Pre-race elevated camera renders
    camera.position.y = CAMERA_OFFSET.y + 3;
    camera.position.z = CAMERA_OFFSET.z + 2;
    camera.lookAt(0, 0.5, -CAMERA_LOOK_AHEAD);
    camera.updateProjectionMatrix();
    composer.render();
    await new Promise(r => requestAnimationFrame(r));

    // ── Stage 8: Multiple game loop dry runs to fully warm JIT + GPU ──
    setLoadProgress(92, 'Finalizing...');
    const fakeDelta = 0.016;
    const fakeSpeed = 40 * SCROLL_FACTOR;
    for (let i = 0; i < 3; i++) {
      road.update(fakeDelta, fakeSpeed);
      kart.update(fakeDelta, fakeSpeed, false);
      plates.update(fakeDelta, fakeSpeed);
      lampPosts.update(fakeDelta, fakeSpeed);
      environment.update(fakeDelta, fakeSpeed);
      composer.render();
      await new Promise(r => requestAnimationFrame(r));
    }

    // ── Stage 9: Settle — give browser time to finish async GPU uploads + GC ──
    setLoadProgress(98, 'Ready!');
    await new Promise(r => setTimeout(r, 300));

    // ── Done ──
    clearLoadingOverlay();

    // Transition to playing — RaceStartSequence reuses loadingOverlay
    gameState.transition('playing');
  },
  () => gameState.transition('driverSelect')
);

const hud = new HUD(() => goHome(), () => togglePause());

const rewardScreen = new RewardScreen(() => {
  rewardScreen.hide();
  goHome();
});
const winScreen = new WinScreen(() => {
  winScreen.hide();
  rewardScreen.show();
});

// --- Controls ---
const controls = setupControls(
  () => {},  // No instant lane switch — continuous movement only
  () => {},  // No snap on release — player has full control
);

// Map index → music key
const MAP_MUSIC_KEYS = ['brazil', 'usa', 'peru'];

// ── Start line decoration ──
let startLineObjects = [];

function buildStartLine() {
  removeStartLine();
  const ROAD_W = 12;
  const lineZ = -3;
  const squareSize = 0.8;
  const cols = Math.floor(ROAD_W / squareSize);
  const rows = 3;
  const pillarH = 6;
  const pillarW = 0.4;
  const bannerCols = 14;
  const bannerSquare = (ROAD_W + 1.4) / bannerCols;

  // ── Merge all white squares (road + banner) into ONE mesh ──
  const whiteGeos = [];
  const blackGeos = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const g = new THREE.PlaneGeometry(squareSize, squareSize);
      const m = new THREE.Matrix4()
        .makeRotationX(-Math.PI / 2)
        .setPosition(-ROAD_W / 2 + squareSize / 2 + c * squareSize, 0.01, lineZ - r * squareSize);
      g.applyMatrix4(m);
      ((r + c) % 2 === 0 ? whiteGeos : blackGeos).push(g);
    }
  }
  // Banner squares
  for (let c = 0; c < bannerCols; c++) {
    const g = new THREE.PlaneGeometry(bannerSquare, 0.8);
    g.translate(
      -ROAD_W / 2 - 0.7 + bannerSquare / 2 + c * bannerSquare,
      pillarH - 0.7,
      lineZ - squareSize - pillarW / 2 - 0.01,
    );
    (c % 2 === 0 ? whiteGeos : blackGeos).push(g);
  }

  const whiteMesh = new THREE.Mesh(mergeGeometries(whiteGeos), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const blackMesh = new THREE.Mesh(mergeGeometries(blackGeos), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  whiteGeos.forEach(g => g.dispose());
  blackGeos.forEach(g => g.dispose());
  scene.add(whiteMesh, blackMesh);
  startLineObjects.push(whiteMesh, blackMesh);

  // ── Gantry arch (3 meshes: 2 pillars + crossbar merged) ──
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 });
  const gantryGeos = [];
  // Left pillar
  const lp = new THREE.BoxGeometry(pillarW, pillarH, pillarW);
  lp.translate(-ROAD_W / 2 - 0.5, pillarH / 2, lineZ - squareSize);
  gantryGeos.push(lp);
  // Right pillar
  const rp = new THREE.BoxGeometry(pillarW, pillarH, pillarW);
  rp.translate(ROAD_W / 2 + 0.5, pillarH / 2, lineZ - squareSize);
  gantryGeos.push(rp);
  // Crossbar
  const cb = new THREE.BoxGeometry(ROAD_W + 1.4, 0.5, pillarW);
  cb.translate(0, pillarH, lineZ - squareSize);
  gantryGeos.push(cb);

  const gantry = new THREE.Mesh(mergeGeometries(gantryGeos), pillarMat);
  gantryGeos.forEach(g => g.dispose());
  scene.add(gantry);
  startLineObjects.push(gantry);

  // ── Gantry lights (merged into 1 mesh) ──
  const lightGeos = [];
  for (let i = 0; i < 5; i++) {
    const lg = new THREE.SphereGeometry(0.15, 5, 3);
    lg.translate(-2 + i, pillarH + 0.4, lineZ - squareSize);
    lightGeos.push(lg);
  }
  const lights = new THREE.Mesh(mergeGeometries(lightGeos), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  lightGeos.forEach(g => g.dispose());
  scene.add(lights);
  startLineObjects.push(lights);
}

function removeStartLine() {
  for (const obj of startLineObjects) {
    scene.remove(obj);
  }
  startLineObjects = [];
}

// Scroll start line objects with the road (foreground speed)
function updateStartLine(delta, speed) {
  if (startLineObjects.length === 0) return;
  const move = speed * delta;
  for (const obj of startLineObjects) {
    obj.position.z += move;
  }
  // Remove once fully behind camera
  if (startLineObjects[0] && startLineObjects[0].position.z > 30) {
    removeStartLine();
  }
}

// Active sequences (null when not running)
let raceStart = null;
let completionSeq = null;
let baseAmbientIntensity = 0; // stored when game starts

// --- State change handling ---
gameState.on('stateChange', ({ from, to }) => {
  // Hide everything first
  startScreen.hide();
  driverSelect.hide();
  mapSelect.hide();
  hud.hide();
  winScreen.hide();
  rewardScreen.hide();
  controls.hideButtons();

  switch (to) {
    case 'menu':
      startScreen.show();
      playMusic('menu');
      break;
    case 'driverSelect':
      driverSelect.show();
      break;
    case 'mapSelect':
      mapSelect.show();
      break;
    case 'playing':
      hud.hidePause();
      if (from === 'paused') {
        // Resume from pause — show HUD + controls immediately
        hud.show();
        controls.showButtons();
      } else {
        // Fresh game start — run countdown sequence
        // NOTE: kart lights, start line, lamp posts, plates already set up
        // during the loading screen (before warm-up renders)
        gameState.speed = 0;
        gameState.elapsed = 0;
        hud.reset();
        hud.show();

        // Store base ambient and dim it to tier-0 level
        if (environment.ambientLight) {
          baseAmbientIntensity = MAP_THEMES[gameState.selectedMap]?.ambientIntensity || 0.6;
          environment.ambientLight.intensity = baseAmbientIntensity * AMBIENT_MULTIPLIERS[0];
        }

        raceStart = new RaceStartSequence({
          camera,
          controls,
          hud,
          normalCam: { y: CAMERA_OFFSET.y, z: CAMERA_OFFSET.z },
          existingOverlay: loadingOverlay,  // reuse — seamless transition
          playMusic: () => {},             // music already started during loading
          playCountdownTone,
          playCountdownRev,
          startEngine: startEngineIdle,
          onComplete: () => {
            // Player gains control — starts at 40 MPH in gear 2
            gameState.speed = STARTING_SPEED_MPH;
            hud.updateSpeed(STARTING_SPEED_MPH);
            currentGear = 1; // gear 2 (0-indexed)
            shiftCooldown = 0;
            turboActive = false;
            turboTimer = 0;
            const { rpm } = computeGearAndRPM(STARTING_SPEED_MPH);
            currentRPM = rpm;
            hud.updateTacho(rpm, 2);
            raceStart = null;
          },
        });
        raceStart.start();
      }
      break;
    case 'paused':
      hud.show();
      hud.showPause();
      controls.hideButtons();
      break;
    case 'completing':
      // Cinematic ending — HUD stays visible, controls locked
      hud.hideHurry();
      hud.show();
      controls.hideButtons();
      completionSeq = new CompletionSequence({
        camera,
        controls,
        hud,
        normalCam: { y: CAMERA_OFFSET.y, z: CAMERA_OFFSET.z },
        lampPosts,
        plates,
        gameState,
        playFinalPowerOn,
        stopEngine,
        onComplete: () => {
          completionSeq = null;
          gameState.transition('complete');
        },
      });
      completionSeq.start();
      break;
    case 'complete':
      controls.hideButtons();
      controls.unlock();
      stopEngine();
      winScreen.show(gameState.platesHit, gameState.score, gameState.maxCombo);
      playMusic('qualified');
      break;
  }
});

// --- Escape / P key ---
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    switch (gameState.state) {
      case 'driverSelect': gameState.transition('menu'); break;
      case 'mapSelect': gameState.transition('driverSelect'); break;
      case 'playing': togglePause(); break;
      case 'paused': togglePause(); break;
      case 'completing': goHome(); break;
      case 'complete': goHome(); break;
    }
  }
  if ((e.key === 'p' || e.key === 'P') && !e.repeat) {
    if (gameState.state === 'playing' || gameState.state === 'paused') {
      togglePause();
    }
  }
});

gameState.on('plateHit', ({ currentCharge, combo, score }) => {
  hud.updateCharge(currentCharge);
  hud.updateCombo(combo);
  hud.updateScore(score);

  // Speed-scaled score display: faster vehicles earn more per plate
  const basePoints = 100 + Math.min(combo - 1, 9) * 25;
  const speedRatio = Math.max(0, (gameState.speed - STARTING_SPEED_MPH) / (activePhysics.topSpeed - STARTING_SPEED_MPH));
  const speedMultiplier = 1.0 + speedRatio;
  const points = Math.round(basePoints * speedMultiplier);
  hud.showFloatingScore(points);
  playPlateHit();
  haptic(25);

  // Reveal lamp posts on first plate hit (deferred for smoother start)
  if (!lampPosts.posts[0].group.visible) lampPosts.setVisible(true);

  // Per-coin lamp post micro-progression (includes micro-flash)
  lampPosts.microProgress(currentCharge);
});

gameState.on('comboBreak', () => {
  hud.updateCombo(0);
  playComboBreak();
});

gameState.on('lampLit', ({ lampPostsLit }) => {
  // Celebrate the full bar before resetting
  hud.celebrateCharge();

  const tier = lampPostsLit; // 1 … TOTAL_LAMP_POSTS

  // Final tier is handled by CompletionSequence (transition to 'completing')
  if (tier < TOTAL_LAMP_POSTS) {
    playLampLit();
  }

  setTimeout(() => {
    hud.updateLamps(lampPostsLit);
    hud.updateStage(lampPostsLit, TOTAL_LAMP_POSTS);
    hud.updateCharge(0);

    // Tier transition: flash + set tier on all lamp posts
    if (tier < TOTAL_LAMP_POSTS) {
      lampPosts.setTier(tier, true);
      lampPosts.flash();

      // Ambient light progression
      if (environment.ambientLight && baseAmbientIntensity > 0) {
        const targetAmb = baseAmbientIntensity * AMBIENT_MULTIPLIERS[tier];
        new Tween(environment.ambientLight, tweenGroup)
          .to({ intensity: targetAmb }, 1500)
          .easing(Easing.Quadratic.Out)
          .start();
      }

      // Toast + urgency at tier 3
      const labels = ['', 'SECTOR 1 POWERED', 'SECTOR 2 POWERED'];
      if (tier <= 2) {
        hud.showToast(labels[tier]);
      }

      // Last tier before completion: persistent HURRY UP! + timer goes red + vibration
      if (tier === TOTAL_LAMP_POSTS - 1) {
        hud.showHurry();
      }

      // Increase difficulty
      const newRate = PLATE_SPAWN_INTERVAL - lampPostsLit * 0.08;
      plates.setSpawnRate(Math.max(newRate, 0.5));

      // ── TURBO BOOST — instant +10 MPH for 3 seconds ──
      turboActive = true;
      turboTimer = TURBO_DURATION;
      // Speed ramps up gradually in the game loop (5 MPH/sec)
      kart.startTurboFlame();
      playTurboBoost();
      haptic(50);
      hud.showTurboToast('⚡ TURBO BOOST ⚡');
    }
  }, 500);
});

// speedToMph removed — gameState.speed IS MPH directly

// --- Resize ---
// Renderer uses full viewport — no fixed resolution.
window.addEventListener('game-resize', (e) => {
  const w = e.detail.w, h = e.detail.h;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer.setSize(w, h);
});


// --- Game loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  tweenGroup.update();

  // Always animate sky (clouds, stars) even on menus
  const isActive = gameState.state === 'playing' || gameState.state === 'completing';
  environment.update(delta, isActive ? gameState.speed * SCROLL_FACTOR : 0);

  if (gameState.state === 'completing') {
    const speed = gameState.speed;
    const scrollSpeed = speed * SCROLL_FACTOR;
    const { rpm } = computeGearAndRPM(speed);
    updateEngine(rpm);

    road.update(delta, scrollSpeed);
    kart.update(delta, scrollSpeed, true);
    plates.update(delta, scrollSpeed);
    lampPosts.update(delta, scrollSpeed);
  }

  if (gameState.state === 'playing') {
    if (!raceStart) {
      gameState.elapsed += delta;

      // Per-driver gear-aware acceleration (turbo-aware top speed)
      const effectiveTopSpeed = turboActive
        ? activePhysics.topSpeed + TURBO_BOOST_MPH
        : activePhysics.topSpeed;

      if (turboActive) {
        // During turbo: ramp speed up at 5 MPH/sec toward boosted ceiling
        gameState.speed = Math.min(gameState.speed + 5 * delta, effectiveTopSpeed);
      } else if (gameState.speed > activePhysics.topSpeed) {
        // Post-turbo bleed-down: don't accelerate, just let bleed handle it
      } else if (controls.isPedalDown()) {
        if (shiftCooldown <= 0) {
          gameState.speed = Math.min(gameState.speed + activePhysics.gearAccel[currentGear] * delta, effectiveTopSpeed);
        }
      } else {
        gameState.speed = Math.max(gameState.speed - activePhysics.decelRate * delta, activePhysics.coastFloor);
      }
      shiftCooldown = Math.max(0, shiftCooldown - delta);

      // Turbo timer countdown
      if (turboActive) {
        turboTimer -= delta;
        if (turboTimer <= 0) {
          turboActive = false;
          kart.stopTurboFlame();
        }
      }
      // After turbo ends, gradually bleed speed back to normal top speed at 2 MPH/sec
      if (!turboActive && gameState.speed > activePhysics.topSpeed) {
        gameState.speed = Math.max(
          gameState.speed - 3 * delta,
          activePhysics.topSpeed,
        );
      }

      // Gear shift detection
      const { gear: newGear, rpm } = computeGearAndRPM(gameState.speed);
      if (newGear !== currentGear && shiftCooldown <= 0) {
        const isUpshift = newGear > currentGear;
        currentGear = newGear;
        shiftCooldown = SHIFT_PAUSE_MS / 1000;
        playGearShift(isUpshift, newGear);
        hud.flashTacho();
        haptic(20);
      }
      currentRPM = rpm;
    }

    const speed = gameState.speed;
    const scrollSpeed = speed * SCROLL_FACTOR;

    // Debounced updates — skip when values haven't changed meaningfully
    const rpmQ = Math.round(currentRPM / 25) * 25;
    if (rpmQ !== _lastRpmQ) { updateEngine(currentRPM); _lastRpmQ = rpmQ; }
    hud.updateSpeed(speed);
    hud.updateTacho(currentRPM, currentGear + 1);
    hud.updateTime(gameState.elapsed);

    // Continuous lateral movement when arrows held
    if (controls.isLeftHeld()) {
      kart.slideLateral(delta, 'left');
      gameState.currentLane = kart.currentLane;
    } else if (controls.isRightHeld()) {
      kart.slideLateral(delta, 'right');
      gameState.currentLane = kart.currentLane;
    } else {
      kart.recoverTilt(delta);
    }

    road.update(delta, scrollSpeed);
    kart.update(delta, scrollSpeed, controls.isPedalDown());
    plates.update(delta, scrollSpeed);
    lampPosts.update(delta, scrollSpeed);
    updateStartLine(delta, scrollSpeed);

    if (plates.checkCollision(kart.group.position.x)) {
      gameState.hitPlate();
    }
    if (plates.checkMisses()) {
      gameState.missPlate();
    }

    // Smooth camera follow
    const targetCamX = kart.group.position.x * 0.25;
    camera.position.x += (targetCamX - camera.position.x) * 0.08;

    // Dynamic FOV: widens with speed (relative to this driver's top speed)
    const speedFraction = (speed - activePhysics.coastFloor) / (activePhysics.topSpeed - activePhysics.coastFloor);
    const turboFOVBoost = turboActive ? 5 : 0;
    const targetFOV = CAMERA_FOV_MIN + speedFraction * (CAMERA_FOV_MAX - CAMERA_FOV_MIN) + turboFOVBoost;
    const fovDelta = targetFOV - camera.fov;
    if (Math.abs(fovDelta) > 0.5) {
      camera.fov += fovDelta * 0.05;
      camera.updateProjectionMatrix();
    }

    // Camera shake at high speed
    if (speedFraction > CAMERA_SHAKE_THRESHOLD) {
      const intensity = (speedFraction - CAMERA_SHAKE_THRESHOLD) * 0.08;
      camera.position.x += (Math.random() - 0.5) * intensity;
      camera.position.y = CAMERA_OFFSET.y + (Math.random() - 0.5) * intensity * 0.5;
    } else {
      camera.position.y += (CAMERA_OFFSET.y - camera.position.y) * 0.1;
    }
  }

  // Skip post-processing on mobile for performance
  if (isMobile) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }
}

// --- Bootstrap ---
animate();

// Attempt to play title music immediately at launch.
// Browsers may block autoplay until the first user gesture;
// playMusic() handles that retry internally.
playMusic('menu');

// Run intro sequence (black → ICT logo → PRESENTS), then reveal start screen.
(async () => {
  // environment.preload() loads ALL MODEL_URLS (including vehicle models)
  await environment.preload();
  await environment.build(0);
  updateEnvMap();
  // Pre-compile shaders during intro (user never sees this render)
  renderer.compile(scene, camera);
  renderer.render(scene, camera);

  // Create intro overlay FIRST (z-index 500) so it covers everything,
  // then show start screen behind it (z-index 100).
  const intro = new IntroScreen();
  startScreen.show();
  await intro.run();
  // Start screen is already visible — nothing more to do.
})();
