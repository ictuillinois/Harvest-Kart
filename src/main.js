import * as THREE from 'three';
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

import { RaceStartSequence } from './game/RaceStartSequence.js';
import { CompletionSequence } from './game/CompletionSequence.js';
import { AMBIENT_MULTIPLIERS } from './game/LampPost.js';

import { setupControls } from './utils/controls.js';
import { playPlateHit, playLampLit, playComboBreak, playWinFanfare, playLaneSwitch, haptic, playMusic, stopMusic, startEngineIdle, stopEngine, updateEngine, playGearShift, playCountdownTone, playCountdownRev, playFinalPowerOn, playStartPress, playDriverSelect, playMapSelect } from './utils/audio.js';
import { gameRoot } from './utils/base.js';
import {
  MIN_SPEED_MPH, MAX_SPEED_MPH, STARTING_SPEED_MPH, SCROLL_FACTOR,
  GEAR_THRESHOLDS, GEAR_ACCEL, DECEL_RATE, SHIFT_PAUSE_MS,
  RPM_IDLE, RPM_REDLINE,
  MAP_THEMES, PLATE_SPAWN_INTERVAL,
  CAMERA_OFFSET, CAMERA_LOOK_AHEAD,
  CAMERA_FOV_MIN, CAMERA_FOV_MAX, CAMERA_SHAKE_THRESHOLD
} from './utils/constants.js';

// --- Renderer ---
// Uses the full browser viewport — no fixed resolution, no CSS transform scaling.
const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
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

const camera = new THREE.PerspectiveCamera(CAMERA_FOV_MIN, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);
camera.lookAt(0, 0.5, -CAMERA_LOOK_AHEAD);

// --- Post-processing ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// NOTE: Bloom removed — Preetham sky HDR output produces extreme
// brightness near the sun disc that any bloom threshold catches,
// washing out the entire scene. Shadows + vignette are sufficient.

// Vignette: subtle darkening at edges
const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.25 },
    offset: { value: 1.5 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 center = vUv - 0.5;
      float dist = length(center) * 2.0;
      float vig = 1.0 - darkness * smoothstep(offset - 0.5, offset, dist);
      color.rgb *= vig;
      gl_FragColor = color;
    }
  `,
};
composer.addPass(new ShaderPass(vignetteShader));

// Color grading: per-theme saturation, contrast, brightness
const colorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.0 },
    contrast: { value: 1.0 },
    brightness: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float brightness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      // Brightness
      color.rgb *= brightness;
      // Contrast (around 0.5 midpoint)
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;
      // Saturation (luminance-preserving)
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);
      gl_FragColor = color;
    }
  `,
};
const colorGradePass = new ShaderPass(colorGradeShader);
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

function computeGearAndRPM(speedMph) {
  let gear = 0;
  for (let g = GEAR_THRESHOLDS.length - 2; g >= 0; g--) {
    if (speedMph >= GEAR_THRESHOLDS[g]) { gear = g; break; }
  }
  gear = Math.min(gear, GEAR_ACCEL.length - 1);
  const lo = GEAR_THRESHOLDS[gear], hi = GEAR_THRESHOLDS[gear + 1];
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

  // === SPOTLIGHT HEADLIGHTS — visible cones on road ===
  const headlightTarget = new THREE.Object3D();
  headlightTarget.position.set(0, -1, -40);
  kart.group.add(headlightTarget);
  kartLights.push(headlightTarget);

  for (const xOff of [-0.5, 0.5]) {
    const spot = new THREE.SpotLight(0xfff5e6, cfg.headlights, 30, Math.PI / 5, 0.6, 1.5);
    spot.position.set(xOff, 0.8, -1.5);
    spot.target = headlightTarget;
    spot.castShadow = false;
    kart.group.add(spot);
    kartLights.push(spot);
  }

  // === CAMERA BACKFILL — tight radius, only lights kart rear ===
  const backfill = new THREE.PointLight(0xaabbdd, cfg.backfill, 12, 2);
  backfill.position.set(0, 6, 6);
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
    kart.setDriver(driverIndex);
    gameState.transition('mapSelect');
  },
  () => gameState.transition('menu')
);

// Loading overlay — masks synchronous environment.build() with a smooth fade-to-black
const loadingOverlay = document.createElement('div');
Object.assign(loadingOverlay.style, {
  position: 'fixed', inset: '0', zIndex: '150',
  background: '#000', opacity: '0', pointerEvents: 'none',
  transition: 'opacity 0.45s ease', display: 'none',
});
document.body.appendChild(loadingOverlay);

function fadeToBlack() {
  return new Promise(resolve => {
    loadingOverlay.style.display = 'block';
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.pointerEvents = 'all';
    void loadingOverlay.offsetWidth;
    loadingOverlay.style.opacity = '1';
    setTimeout(resolve, 480); // wait for fade to fully complete
  });
}

function clearLoadingOverlay() {
  // RaceStartSequence has its own black overlay — just hide ours instantly
  loadingOverlay.style.transition = 'none';
  loadingOverlay.style.opacity = '0';
  loadingOverlay.style.display = 'none';
  loadingOverlay.style.pointerEvents = 'none';
  void loadingOverlay.offsetWidth;
  loadingOverlay.style.transition = 'opacity 0.45s ease';
}

const mapSelect = new MapSelect(
  async (mapIndex) => {
    playMapSelect();
    gameState.selectedMap = mapIndex;

    // Fade to black FIRST so the build happens behind a black screen
    await fadeToBlack();

    // Yield to browser so the black frame paints before heavy build work
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    await environment.build(mapIndex);

    // Update road surface color for this theme
    const themeId = MAP_THEMES[mapIndex]?.id || 'brazil';
    road.setThemeColor(themeId);

    // Generate environment map for reflections (critical for glossy dark vehicles)
    updateEnvMap();

    // Apply per-theme color grading
    const cg = MAP_THEMES[mapIndex]?.colorGrade || { saturation: 1, contrast: 1, brightness: 1 };
    colorGradePass.uniforms.saturation.value = cg.saturation;
    colorGradePass.uniforms.contrast.value = cg.contrast;
    colorGradePass.uniforms.brightness.value = cg.brightness;

    // Transition to playing — RaceStartSequence creates its own black overlay
    gameState.transition('playing');

    // Remove our loading overlay once RaceStartSequence is in control
    clearLoadingOverlay();
  },
  () => gameState.transition('driverSelect')
);

const hud = new HUD(() => goHome(), () => togglePause());

const winScreen = new WinScreen(() => goHome());

// --- Controls ---
const controls = setupControls((direction) => {
  if (gameState.state !== 'playing') return;
  kart.switchLane(direction);
  gameState.currentLane = kart.currentLane;
  playLaneSwitch();
  haptic(15);
});

// Map index → music key
const MAP_MUSIC_KEYS = ['brazil', 'usa', 'peru'];

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
        gameState.speed = 0;
        gameState.elapsed = 0;
        hud.reset();
        hud.show(); // show but keep opacity 0 (sequence controls fade-in)
        plates.resetSpawnRate();
        lampPosts.resetAll();
        lampPosts.setTier(0, false);

        // Store base ambient and dim it to tier-0 level
        if (environment.ambientLight) {
          baseAmbientIntensity = MAP_THEMES[gameState.selectedMap]?.ambientIntensity || 0.6;
          environment.ambientLight.intensity = baseAmbientIntensity * AMBIENT_MULTIPLIERS[0];
        }

        // All maps get kart-attached lights (scaled per theme)
        const themeId = MAP_THEMES[gameState.selectedMap]?.id;
        addKartLights(themeId);

        const musicKey = MAP_MUSIC_KEYS[gameState.selectedMap] || 'brazil';

        raceStart = new RaceStartSequence({
          camera,
          controls,
          hud,
          normalCam: { y: CAMERA_OFFSET.y, z: CAMERA_OFFSET.z },
          playMusic: () => playMusic(musicKey),
          playCountdownTone,
          playCountdownRev,
          startEngine: startEngineIdle,
          onComplete: () => {
            // Player gains control — starts at 40 MPH in gear 2
            gameState.speed = STARTING_SPEED_MPH;
            hud.updateSpeed(STARTING_SPEED_MPH);
            currentGear = 1; // gear 2 (0-indexed)
            shiftCooldown = 0;
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
  const points = 100 + Math.min(combo - 1, 9) * 25;
  hud.showFloatingScore(points);
  playPlateHit();
  haptic(25);

  // Per-coin lamp post micro-progression + flash
  lampPosts.microProgress(currentCharge);
  lampPosts.microFlash();
});

gameState.on('comboBreak', () => {
  hud.updateCombo(0);
  playComboBreak();
});

gameState.on('lampLit', ({ lampPostsLit }) => {
  // Celebrate the full bar before resetting
  hud.celebrateCharge();

  const tier = lampPostsLit; // 1, 2, 3, or 4

  // Tier 4 is handled by CompletionSequence (transition to 'completing')
  if (tier < 4) {
    playLampLit();
  }

  setTimeout(() => {
    hud.updateLamps(lampPostsLit);
    hud.updateStage(lampPostsLit, 4);
    hud.updateCharge(0);

    // Tier transition: flash + set tier on all lamp posts
    if (tier < 4) {
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

      // Toast
      const labels = ['', 'SECTOR 1 POWERED', 'SECTOR 2 POWERED', 'SECTOR 3 POWERED'];
      hud.showToast(labels[tier]);

      // Increase difficulty
      const newRate = PLATE_SPAWN_INTERVAL - lampPostsLit * 0.08;
      plates.setSpawnRate(Math.max(newRate, 0.5));
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

      // Gear-aware acceleration
      if (controls.isPedalDown()) {
        if (shiftCooldown <= 0) {
          gameState.speed = Math.min(gameState.speed + GEAR_ACCEL[currentGear] * delta, MAX_SPEED_MPH);
        }
      } else {
        gameState.speed = Math.max(gameState.speed - DECEL_RATE * delta, MIN_SPEED_MPH);
      }
      shiftCooldown = Math.max(0, shiftCooldown - delta);

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
    updateEngine(currentRPM);
    hud.updateSpeed(speed);
    hud.updateTacho(currentRPM, currentGear + 1);
    hud.updateTime(gameState.elapsed);

    road.update(delta, scrollSpeed);
    kart.update(delta, scrollSpeed, controls.isPedalDown());
    plates.update(delta, scrollSpeed);
    lampPosts.update(delta, scrollSpeed);

    if (plates.checkCollision(gameState.currentLane)) {
      gameState.hitPlate();
    }
    if (plates.checkMisses()) {
      gameState.missPlate();
    }

    // Smooth camera follow
    const targetCamX = kart.group.position.x * 0.25;
    camera.position.x += (targetCamX - camera.position.x) * 0.08;

    // Dynamic FOV: widens with speed
    const speedFraction = (speed - MIN_SPEED_MPH) / (MAX_SPEED_MPH - MIN_SPEED_MPH);
    const targetFOV = CAMERA_FOV_MIN + speedFraction * (CAMERA_FOV_MAX - CAMERA_FOV_MIN);
    camera.fov += (targetFOV - camera.fov) * 0.05;
    camera.updateProjectionMatrix();

    // Camera shake at high speed
    if (speedFraction > CAMERA_SHAKE_THRESHOLD) {
      const intensity = (speedFraction - CAMERA_SHAKE_THRESHOLD) * 0.08;
      camera.position.x += (Math.random() - 0.5) * intensity;
      camera.position.y = CAMERA_OFFSET.y + (Math.random() - 0.5) * intensity * 0.5;
    } else {
      camera.position.y += (CAMERA_OFFSET.y - camera.position.y) * 0.1;
    }
  }

  composer.render();
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

  // Show the start screen NOW, behind the intro overlay (z-index 100 vs 500).
  // When the intro fades out it reveals the already-visible start screen,
  // so the 3D scene is never exposed during the transition.
  startScreen.show();

  const intro = new IntroScreen();
  await intro.run();
  // Start screen is already visible — nothing more to do.
})();
