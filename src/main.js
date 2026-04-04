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
import { playPlateHit, playLampLit, playComboBreak, playWinFanfare, playLaneSwitch, haptic, playMusic, stopMusic, startEngineIdle, stopEngine, updateEngine, playCountdownTone, playCountdownRev, playFinalPowerOn } from './utils/audio.js';
import { gameRoot } from './utils/base.js';
import {
  MIN_SPEED, MAX_SPEED, MAP_THEMES,
  PEDAL_ACCELERATION, COAST_DECELERATION,
  MIN_SPEED_MPH, MAX_SPEED_MPH,
  PLATE_SPAWN_INTERVAL,
  CAMERA_OFFSET, CAMERA_LOOK_AHEAD,
  CAMERA_FOV_MIN, CAMERA_FOV_MAX, CAMERA_SHAKE_THRESHOLD
} from './utils/constants.js';

// --- Renderer ---
// The game always renders at the native 1024×768 iPad-landscape resolution.
// CSS scaling in index.html handles fitting to the actual window size.
const GAME_W = 1024, GAME_H = 768;
const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(GAME_W, GAME_H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
gameRoot().appendChild(renderer.domElement);

// --- Scene & Camera ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a0533, 0.006);

const camera = new THREE.PerspectiveCamera(CAMERA_FOV_MIN, GAME_W / GAME_H, 0.1, 1000);
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
    darkness: { value: 0.4 },
    offset: { value: 1.3 },
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

// Kart-attached lights for night maps (USA)
let kartLights = [];

function addKartLights() {
  removeKartLights();

  // Forward headlight pool — illuminates road ahead of kart
  const headlightFwd = new THREE.PointLight(0xffffdd, 1.8, 30, 1);
  headlightFwd.position.set(0, 2, -8);
  kart.group.add(headlightFwd);
  kartLights.push(headlightFwd);

  // Second forward light — longer range, dimmer
  const headlightFar = new THREE.PointLight(0xffffdd, 1.0, 50, 1.5);
  headlightFar.position.set(0, 3, -18);
  kart.group.add(headlightFar);
  kartLights.push(headlightFar);

  // Overhead fill — kart always visible from chase camera
  const overhead = new THREE.PointLight(0xffffff, 1.0, 16);
  overhead.position.set(0, 4, 2);
  kart.group.add(overhead);
  kartLights.push(overhead);

  // Tail light glow
  const tailGlow = new THREE.PointLight(0xff2200, 0.5, 6);
  tailGlow.position.set(0, 0.5, 1.7);
  kart.group.add(tailGlow);
  kartLights.push(tailGlow);
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
  gameState.transition('driverSelect');
});

const driverSelect = new DriverSelect(
  (driverIndex) => {
    gameState.selectedDriver = driverIndex;
    kart.setDriver(driverIndex);
    gameState.transition('mapSelect');
  },
  () => gameState.transition('menu')
);

const mapSelect = new MapSelect(
  async (mapIndex) => {
    gameState.selectedMap = mapIndex;
    await environment.build(mapIndex);
    // Apply per-theme color grading
    const cg = MAP_THEMES[mapIndex]?.colorGrade || { saturation: 1, contrast: 1, brightness: 1 };
    colorGradePass.uniforms.saturation.value = cg.saturation;
    colorGradePass.uniforms.contrast.value = cg.contrast;
    colorGradePass.uniforms.brightness.value = cg.brightness;
    gameState.transition('playing');
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

        // Night maps get kart-attached headlights
        const themeId = MAP_THEMES[gameState.selectedMap]?.id;
        if (themeId === 'usa') addKartLights();

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
            // Player gains control — road starts moving
            gameState.speed = MIN_SPEED;
            hud.updateSpeed(MIN_SPEED_MPH);
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

// --- Helper: map internal speed to display MPH ---
function speedToMph(speed) {
  const t = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
  return MIN_SPEED_MPH + t * (MAX_SPEED_MPH - MIN_SPEED_MPH);
}

// --- Resize ---
// The renderer is fixed at 1024×768; CSS handles visual scaling.
// No renderer resize needed — just keep the composer in sync (it was already set).


// --- Game loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  tweenGroup.update();

  // Always animate sky (clouds, stars) even on menus
  const isActive = gameState.state === 'playing' || gameState.state === 'completing';
  environment.update(delta, isActive ? gameState.speed : 0);


  if (gameState.state === 'completing') {
    // Auto-drive: speed is controlled by CompletionSequence via tweens
    const speed = gameState.speed;
    updateEngine(speed / MAX_SPEED);

    road.update(delta, speed);
    kart.update(delta, speed, true); // wheels spinning
    plates.update(delta, speed);     // existing plates scroll past
    lampPosts.update(delta, speed);
  }

  if (gameState.state === 'playing') {
    if (!raceStart) {
      gameState.elapsed += delta;

      // Pedal-driven speed
      if (controls.isPedalDown()) {
        gameState.speed = Math.min(gameState.speed + PEDAL_ACCELERATION * delta, MAX_SPEED);
      } else {
        gameState.speed = Math.max(gameState.speed - COAST_DECELERATION * delta, MIN_SPEED);
      }
    }

    const speed = gameState.speed;
    updateEngine(speed / MAX_SPEED);
    hud.updateSpeed(speedToMph(speed));
    hud.updateTime(gameState.elapsed);

    road.update(delta, speed);
    kart.update(delta, speed, controls.isPedalDown());
    plates.update(delta, speed);
    lampPosts.update(delta, speed);

    if (plates.checkCollision(gameState.currentLane)) {
      gameState.hitPlate();
    }
    if (plates.checkMisses()) {
      gameState.missPlate();
    }

    // Smooth camera follow (lerp toward kart lane position)
    const targetCamX = kart.group.position.x * 0.25;
    camera.position.x += (targetCamX - camera.position.x) * 0.08;

    // Dynamic FOV: widens with speed for visceral feel
    const speedFraction = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
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
  await environment.preload();
  await environment.build(0);

  // Show the start screen NOW, behind the intro overlay (z-index 100 vs 500).
  // When the intro fades out it reveals the already-visible start screen,
  // so the 3D scene is never exposed during the transition.
  startScreen.show();

  const intro = new IntroScreen();
  await intro.run();
  // Start screen is already visible — nothing more to do.
})();
