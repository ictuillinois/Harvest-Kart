import { asset } from './base.js';

// Lane positions (X coordinates)
export const LANE_POSITIONS = [-3, 0, 3];
export const LANE_COUNT = 3;

// Road dimensions
export const ROAD_WIDTH = 12;
export const ROAD_SEGMENT_LENGTH = 100;
export const ROAD_SEGMENT_COUNT = 3;

// Speed system — gameState.speed is MPH directly
export const STARTING_SPEED_MPH = 40;    // speed after green light (gear 2)
export const SCROLL_FACTOR = 0.5;        // MPH → world scroll units/sec
export const SHIFT_PAUSE_MS = 200;        // brief accel pause on shift

// RPM simulation
export const RPM_IDLE = 1000;
export const RPM_REDLINE = 8000;

// ═══════════════════════════════════════════
//  PER-DRIVER VEHICLE PHYSICS
//  Each driver's stats (SPD/ACC/EFF) map to gameplay feel.
//  topSpeed from SPD, gearAccel from ACC, decelRate/coastFloor from EFF.
// ═══════════════════════════════════════════

// Base gear accel rates — scaled by ACC multiplier
const BASE_GEAR_ACCEL = [20, 16, 12, 8, 5];

function calcGearThresholds(topSpeed) {
  const ratios = [0, 0.12, 0.28, 0.50, 0.75, 1.0];
  return ratios.map(r => Math.round(r * topSpeed));
}

function calcGearAccel(accStars) {
  const multiplier = 0.6 + (accStars - 1) * 0.2;
  return BASE_GEAR_ACCEL.map(rate => Math.round(rate * multiplier * 10) / 10);
}

export const DRIVER_PHYSICS = {
  // Ethan — The Balanced Pro (SPD 4, ACC 3, EFF 5)
  ethan: {
    topSpeed: 92,
    gearAccel: calcGearAccel(3),          // [12, 9.6, 7.2, 4.8, 3]
    gearThresholds: calcGearThresholds(92),
    decelRate: 4,                          // excellent coast
    coastFloor: 32,
    laneSwitchMs: 200,
    chargeMultiplier: 1.2,                // 5★ EFF → 20% bonus
  },
  // Kate — The Quick Starter (SPD 3, ACC 5, EFF 3)
  kate: {
    topSpeed: 84,
    gearAccel: calcGearAccel(5),          // [16, 12.8, 9.6, 6.4, 4]
    gearThresholds: calcGearThresholds(84),
    decelRate: 10,                         // loses speed fast
    coastFloor: 24,
    laneSwitchMs: 150,                     // snappy handling
    chargeMultiplier: 1.0,
  },
  // Destiny — The Speed Demon (SPD 5, ACC 3, EFF 4)
  destiny: {
    topSpeed: 100,
    gearAccel: calcGearAccel(3),          // [12, 9.6, 7.2, 4.8, 3]
    gearThresholds: calcGearThresholds(100),
    decelRate: 7,
    coastFloor: 28,
    laneSwitchMs: 250,                     // heavier at high speed
    chargeMultiplier: 1.1,
  },
  // Luke — The Eco Racer (SPD 3, ACC 4, EFF 5)
  luke: {
    topSpeed: 84,
    gearAccel: calcGearAccel(4),          // [14, 11.2, 8.4, 5.6, 3.5]
    gearThresholds: calcGearThresholds(84),
    decelRate: 4,                          // barely slows down
    coastFloor: 32,
    laneSwitchMs: 180,
    chargeMultiplier: 1.2,
  },
};

// Driver ID lookup by index (matches DRIVER_TYPES order)
const DRIVER_IDS = ['ethan', 'kate', 'destiny', 'luke'];
export function getDriverPhysics(driverIndex) {
  return DRIVER_PHYSICS[DRIVER_IDS[driverIndex]] || DRIVER_PHYSICS.ethan;
}

// Legacy exports (defaults — used before driver is selected)
export const MAX_SPEED_MPH = 100;
export const MIN_SPEED_MPH = 25;
export const GEAR_THRESHOLDS = [0, 12, 28, 50, 75, 100];
export const GEAR_ACCEL = [20, 16, 12, 8, 5];
export const DECEL_RATE = 8;
export const LANE_SWITCH_DURATION = 200;

// Game config
export const PLATES_TO_FILL_BAR = 10;
export const TOTAL_LAMP_POSTS = 4;
export const PLATE_SPAWN_INTERVAL = 1.0; // slightly faster spawns for 10-plate target
export const PLATE_COLLISION_Z_THRESHOLD = 2.5;

// ROAD SURFACE COLORS — centralized, per-theme.
// These are real asphalt gray. Intentionally LIGHT for vehicle contrast.
// Color multiplies with procedural asphalt texture in Road.js.
export const ROAD_SURFACE_COLORS = {
  brazil: 0x777780,   // warm medium gray (bright texture × this = visible gray)
  usa:    0x666660,   // warm neutral gray for sunset
  peru:   0x707078,   // neutral medium gray
};

// Colors
export const COLORS = {
  road: 0x777780,     // default road color (used by Road.js at init)
  roadLine: 0xffffff,
  roadLineDashed: 0xcccccc,
  plate: 0x39ff14,
  plateGlow: 0x7fff00,
  lampOff: 0x555555,
  lampDim: 0x443300,    // very dim warm glow
  lampOn: 0xffcc00,
  lampLight: 0xffa500,
  barrier: 0x888888,
};

// Driver definitions
export const DRIVER_TYPES = [
  {
    name: 'Ethan',
    description: 'The Balanced Pro',
    avatar: asset('characters/ethan.webp'),
    accentColor: '#2a2a2a',
    carBody: 0x1a1a1a,
    carAccent: 0x444444,
    vehicleType: 'sportsGT',
    stats: { topSpeed: 4, acceleration: 3, efficiency: 5 },
  },
  {
    name: 'Kate',
    description: 'The Quick Starter',
    avatar: asset('characters/kate.webp'),
    accentColor: '#d44a7a',
    carBody: 0xd44a7a,
    carAccent: 0xff6b9d,
    vehicleType: 'compact',
    stats: { topSpeed: 3, acceleration: 5, efficiency: 3 },
  },
  {
    name: 'Destiny',
    description: 'The Speed Demon',
    avatar: asset('characters/destiny.webp'),
    accentColor: '#3a6adf',
    carBody: 0x3a6adf,
    carAccent: 0x5a8aff,
    vehicleType: 'formula',
    stats: { topSpeed: 5, acceleration: 3, efficiency: 4 },
  },
  {
    name: 'Luke',
    description: 'The Eco Racer',
    avatar: asset('characters/luke.webp'),
    accentColor: '#2aaa4a',
    carBody: 0x2aaa4a,
    carAccent: 0x4acc6a,
    vehicleType: 'rally',
    stats: { topSpeed: 3, acceleration: 4, efficiency: 5 },
  },
];

// Map themes
export const MAP_THEMES = [
  {
    id: 'brazil',
    name: 'Brazil',
    description: 'Sun, beaches & tropical vibes',
    subtitle: 'Rio de Janeiro Highway',
    flag: asset('flags/brazil.png'),
    features: ['Palm-lined coast road', 'Golden hour sunset', 'Colorful buildings'],
    // Sky shader (Preetham model)
    sky: {
      turbidity: 8,
      rayleigh: 2.5,
      mieCoefficient: 0.02,
      mieDirectionalG: 0.85,
      sunElevation: 18,     // degrees above horizon — golden hour
      sunAzimuth: 200,      // degrees
      exposure: 0.6,
    },
    // Procedural clouds
    clouds: {
      coverage: 0.3,
      density: 0.35,
      scale: 0.00025,
      speed: 0.00015,
      elevation: 0.45,
    },
    fog: 0xb8dcff,
    fogDensity: 0.004,
    ground: 0xdbc490,
    ambientColor: 0xffffff,
    ambientIntensity: 0.25,
    dirColor: 0xfffbe6,
    dirIntensity: 1.2,
    stars: false,
    shadow: { far: 60, size: 20 },
    colorGrade: { saturation: 1.05, contrast: 1.0, brightness: 1.0 },
  },
  {
    id: 'usa',
    name: 'USA',
    description: 'Golden hour skyline & skyscrapers',
    subtitle: 'Downtown Sunset Drive',
    flag: asset('flags/usa.png'),
    features: ['Sunset skyline', 'Golden hour glow', 'Urban highway'],
    sky: {
      turbidity: 8,
      rayleigh: 2.5,
      mieCoefficient: 0.02,
      mieDirectionalG: 0.85,
      sunElevation: 8,      // low sun — golden hour
      sunAzimuth: 230,
      exposure: 0.8,
    },
    clouds: {
      coverage: 0.25,
      density: 0.3,
      scale: 0.00025,
      speed: 0.0001,
      elevation: 0.5,
    },
    fog: 0xcc8855,
    fogDensity: 0.004,
    ground: 0x3d5a2a,
    ambientColor: 0xaa7744,
    ambientIntensity: 0.6,
    dirColor: 0xffaa55,
    dirIntensity: 2.0,
    stars: false,
    shadow: { far: 50, size: 18 },
    colorGrade: { saturation: 1.05, contrast: 1.0, brightness: 1.05 },
  },
  {
    id: 'peru',
    name: 'Peru',
    description: 'Majestic mountains & green valleys',
    subtitle: 'Andean Mountain Pass',
    flag: asset('flags/peru.png'),
    features: ['Snow-capped peaks', 'Lush green valleys', 'Inca terraces'],
    sky: {
      turbidity: 1.8,
      rayleigh: 2.0,
      mieCoefficient: 0.003,
      mieDirectionalG: 0.7,
      sunElevation: 45,     // high sun — bright midday mountain sky
      sunAzimuth: 160,
      exposure: 0.5,
    },
    clouds: {
      coverage: 0.45,
      density: 0.45,
      scale: 0.00018,
      speed: 0.0001,
      elevation: 0.4,
    },
    fog: 0xc8bfa8,
    fogDensity: 0.003,
    ground: 0x8b7355,
    ambientColor: 0xffffff,
    ambientIntensity: 0.35,
    dirColor: 0xfff5e0,
    dirIntensity: 1.4,
    stars: false,
    shadow: { far: 50, size: 18 },
    colorGrade: { saturation: 1.0, contrast: 1.0, brightness: 1.0 },
  },
];

// Camera
export const CAMERA_OFFSET = { x: 0, y: 6, z: 10 };
export const CAMERA_LOOK_AHEAD = 15;
export const CAMERA_FOV_MIN = 55;
export const CAMERA_FOV_MAX = 68;
export const CAMERA_SHAKE_THRESHOLD = 0.8; // speed fraction above which shake starts
