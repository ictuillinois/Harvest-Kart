import * as THREE from 'three';
import { update as updateTweens } from '@tweenjs/tween.js';

import { Road } from './game/Road.js';
import { Car } from './game/Car.js';
import { Plate } from './game/Plate.js';
import { LampPost } from './game/LampPost.js';
import { Environment } from './game/Environment.js';
import { GameState } from './game/GameState.js';

import { StartScreen } from './ui/StartScreen.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
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
const car = new Car(scene);
const plates = new Plate(scene);
const lampPosts = new LampPost(scene);
const environment = new Environment(scene);

// --- UI ---
const startScreen = new StartScreen(() => {
  gameState.transition('characterSelect');
});

const characterSelect = new CharacterSelect((variantIndex) => {
  gameState.selectedVariant = variantIndex;
  car.setVariant(variantIndex);
  gameState.transition('playing');
});

const hud = new HUD();

const winScreen = new WinScreen(() => {
  // Reset everything
  gameState.reset();
  hud.reset();
  lampPosts.resetAll();
  gameState.transition('menu');
});

// --- State change handling ---
gameState.on('stateChange', ({ from, to }) => {
  startScreen.hide();
  characterSelect.hide();
  hud.hide();
  winScreen.hide();

  switch (to) {
    case 'menu':
      startScreen.show();
      break;
    case 'characterSelect':
      characterSelect.show();
      break;
    case 'playing':
      hud.show();
      gameState.speed = INITIAL_SPEED;
      gameState.elapsed = 0;
      break;
    case 'complete':
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

// --- Controls ---
setupControls((direction) => {
  if (gameState.state !== 'playing') return;
  car.switchLane(direction);
  gameState.currentLane = car.currentLane;
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
  const delta = Math.min(clock.getDelta(), 0.05); // clamp to avoid big jumps

  updateTweens();

  if (gameState.state === 'playing') {
    // Accelerate
    gameState.speed = Math.min(gameState.speed + ACCELERATION * delta, MAX_SPEED);
    gameState.elapsed += delta;

    const speed = gameState.speed;

    // Update game objects
    road.update(delta, speed);
    car.update(delta, speed);
    plates.update(delta, speed);
    lampPosts.update(delta, speed);
    environment.update(delta, speed);

    // Check collisions
    if (plates.checkCollision(gameState.currentLane)) {
      gameState.hitPlate();
    }

    // Camera follows car
    camera.position.x = car.group.position.x * 0.3;
  }

  renderer.render(scene, camera);
}

// --- Start ---
startScreen.show();
animate();
