import * as THREE from 'three';
import { tweenGroup } from './utils/tweenGroup.js';

import { Road } from './game/Road.js';
import { Kart } from './game/Kart.js';
import { Plate } from './game/Plate.js';
import { LampPost } from './game/LampPost.js';
import { Environment } from './game/Environment.js';
import { GameState } from './game/GameState.js';

import { StartScreen } from './ui/StartScreen.js';
import { DriverSelect } from './ui/DriverSelect.js';
import { MapSelect } from './ui/MapSelect.js';
import { HUD } from './ui/HUD.js';
import { WinScreen } from './ui/WinScreen.js';

import { setupControls } from './utils/controls.js';
import {
  MIN_SPEED, MAX_SPEED,
  PEDAL_ACCELERATION, COAST_DECELERATION,
  MIN_SPEED_MPH, MAX_SPEED_MPH,
  PLATE_SPAWN_INTERVAL,
  CAMERA_OFFSET, CAMERA_LOOK_AHEAD
} from './utils/constants.js';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// --- Scene & Camera ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a0533, 0.006);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);
camera.lookAt(0, 1, -CAMERA_LOOK_AHEAD);

// --- Game objects ---
const gameState = new GameState();
const road = new Road(scene);
const kart = new Kart(scene);
const plates = new Plate(scene);
const lampPosts = new LampPost(scene);
const environment = new Environment(scene, renderer);

// --- Helper: reset game and go home ---
function goHome() {
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
});

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
      break;
    case 'driverSelect':
      driverSelect.show();
      break;
    case 'mapSelect':
      mapSelect.show();
      break;
    case 'playing':
      hud.show();
      hud.hidePause();
      controls.showButtons();
      if (from !== 'paused') {
        // Fresh game start
        gameState.speed = MIN_SPEED;
        gameState.elapsed = 0;
        hud.updateSpeed(MIN_SPEED_MPH);
        plates.resetSpawnRate();
      }
      break;
    case 'paused':
      hud.show();
      hud.showPause();
      controls.hideButtons();
      break;
    case 'complete':
      controls.hideButtons();
      winScreen.show(gameState.platesHit, gameState.score, gameState.maxCombo);
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
});

gameState.on('comboBreak', () => {
  hud.updateCombo(0);
});

gameState.on('lampLit', ({ lampPostsLit }) => {
  // Celebrate the full bar before resetting
  hud.celebrateCharge();
  setTimeout(() => {
    hud.updateLamps(lampPostsLit);
    lampPosts.lightNext();
    hud.updateCharge(0);
    // Increase difficulty: spawn plates faster after each lamp
    const newRate = PLATE_SPAWN_INTERVAL - lampPostsLit * 0.08;
    plates.setSpawnRate(Math.max(newRate, 0.5));
  }, 500);
});

// --- Helper: map internal speed to display MPH ---
function speedToMph(speed) {
  const t = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
  return MIN_SPEED_MPH + t * (MAX_SPEED_MPH - MIN_SPEED_MPH);
}

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  tweenGroup.update();

  // Always animate sky (clouds, stars) even on menus
  environment.update(delta, gameState.state === 'playing' ? gameState.speed : 0);

  if (gameState.state === 'playing') {
    gameState.elapsed += delta;

    // Pedal-driven speed
    if (controls.isPedalDown()) {
      gameState.speed = Math.min(gameState.speed + PEDAL_ACCELERATION * delta, MAX_SPEED);
    } else {
      gameState.speed = Math.max(gameState.speed - COAST_DECELERATION * delta, MIN_SPEED);
    }

    const speed = gameState.speed;
    hud.updateSpeed(speedToMph(speed));

    road.update(delta, speed);
    kart.update(delta, speed);
    plates.update(delta, speed);
    lampPosts.update(delta, speed);

    if (plates.checkCollision(gameState.currentLane)) {
      gameState.hitPlate();
    }
    if (plates.checkMisses()) {
      gameState.missPlate();
    }

    camera.position.x += (kart.group.position.x * 0.3 - camera.position.x) * 0.1;
  }

  renderer.render(scene, camera);
}

// --- Bootstrap ---
startScreen.show();
animate();

(async () => {
  await environment.preload();
  await environment.build(0);
})();
