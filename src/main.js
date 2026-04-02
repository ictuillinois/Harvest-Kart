import * as THREE from 'three';
import { update as updateTweens } from '@tweenjs/tween.js';

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
  INITIAL_SPEED, MAX_SPEED, ACCELERATION,
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

// --- UI ---
const startScreen = new StartScreen(() => {
  gameState.transition('driverSelect');
});

const driverSelect = new DriverSelect((driverIndex) => {
  gameState.selectedDriver = driverIndex;
  kart.setDriver(driverIndex);
  gameState.transition('mapSelect');
});

const mapSelect = new MapSelect(async (mapIndex) => {
  gameState.selectedMap = mapIndex;
  await environment.build(mapIndex);
  gameState.transition('playing');
});

const hud = new HUD();

const winScreen = new WinScreen(() => {
  gameState.reset();
  hud.reset();
  lampPosts.resetAll();
  gameState.transition('menu');
});

// --- Controls ---
const controls = setupControls((direction) => {
  if (gameState.state !== 'playing') return;
  kart.switchLane(direction);
  gameState.currentLane = kart.currentLane;
});

// --- State change handling ---
gameState.on('stateChange', ({ from, to }) => {
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
      controls.showButtons();
      gameState.speed = INITIAL_SPEED;
      gameState.elapsed = 0;
      break;
    case 'complete':
      controls.hideButtons();
      winScreen.show(gameState.platesHit);
      break;
  }
});

gameState.on('plateHit', ({ currentCharge }) => {
  hud.updateCharge(currentCharge);
});

gameState.on('lampLit', ({ lampPostsLit }) => {
  hud.updateLamps(lampPostsLit);
  lampPosts.lightNext();
  hud.updateCharge(0);
});

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

  updateTweens();

  // Always animate sky (clouds, stars) even on menus
  environment.update(delta, gameState.state === 'playing' ? gameState.speed : 0);

  if (gameState.state === 'playing') {
    gameState.speed = Math.min(gameState.speed + ACCELERATION * delta, MAX_SPEED);
    gameState.elapsed += delta;

    const speed = gameState.speed;

    road.update(delta, speed);
    kart.update(delta, speed);
    plates.update(delta, speed);
    lampPosts.update(delta, speed);

    if (plates.checkCollision(gameState.currentLane)) {
      gameState.hitPlate();
    }

    camera.position.x += (kart.group.position.x * 0.3 - camera.position.x) * 0.1;
  }

  renderer.render(scene, camera);
}

// --- Bootstrap: preload models, then show start screen ---
async function init() {
  // Start rendering immediately (sky will show while models load)
  animate();

  // Preload all 3D models in background
  await environment.preload();

  // Build default environment with loaded models
  await environment.build(0);

  // Show start screen
  startScreen.show();
}

init();
