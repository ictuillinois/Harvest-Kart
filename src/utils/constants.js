import { asset } from './base.js';

// Lane positions (X coordinates)
export const LANE_POSITIONS = [-3.5, 0, 3.5];
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
  yihan: {
    topSpeed: 92, gearAccel: calcGearAccel(3),
    gearThresholds: calcGearThresholds(92),
    decelRate: 5, coastFloor: 30, laneSwitchMs: 180, chargeMultiplier: 1.15,
  },
  ivan: {
    topSpeed: 88, gearAccel: calcGearAccel(4),
    gearThresholds: calcGearThresholds(88),
    decelRate: 8, coastFloor: 26, laneSwitchMs: 160, chargeMultiplier: 1.0,
  },
  murryam: {
    topSpeed: 96, gearAccel: calcGearAccel(3),
    gearThresholds: calcGearThresholds(96),
    decelRate: 6, coastFloor: 28, laneSwitchMs: 200, chargeMultiplier: 1.1,
  },
  nazmus: {
    topSpeed: 84, gearAccel: calcGearAccel(5),
    gearThresholds: calcGearThresholds(84),
    decelRate: 10, coastFloor: 24, laneSwitchMs: 150, chargeMultiplier: 1.0,
  },
  alex: {
    topSpeed: 100, gearAccel: calcGearAccel(3),
    gearThresholds: calcGearThresholds(100),
    decelRate: 7, coastFloor: 28, laneSwitchMs: 220, chargeMultiplier: 1.05,
  },
  william: {
    topSpeed: 90, gearAccel: calcGearAccel(4),
    gearThresholds: calcGearThresholds(90),
    decelRate: 4, coastFloor: 32, laneSwitchMs: 190, chargeMultiplier: 1.2,
  },
  jiarui: {
    topSpeed: 94, gearAccel: calcGearAccel(4),
    gearThresholds: calcGearThresholds(94),
    decelRate: 6, coastFloor: 27, laneSwitchMs: 170, chargeMultiplier: 1.1,
  },
  asad: {
    topSpeed: 98, gearAccel: calcGearAccel(3),
    gearThresholds: calcGearThresholds(98),
    decelRate: 9, coastFloor: 22, laneSwitchMs: 240, chargeMultiplier: 0.95,
  },
};

// Driver ID lookup by index (matches DRIVER_TYPES order)
const DRIVER_IDS = ['yihan', 'ivan', 'murryam', 'nazmus', 'alex', 'william', 'jiarui', 'asad'];
export function getDriverPhysics(driverIndex) {
  return DRIVER_PHYSICS[DRIVER_IDS[driverIndex]] || DRIVER_PHYSICS.yihan;
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
export const TOTAL_LAMP_POSTS = 3;
export const PLATE_SPAWN_INTERVAL = 0.6; // fast spawns
export const PLATE_COLLISION_Z_THRESHOLD = 2.5;

// ROAD SURFACE COLORS — centralized, per-theme.
// These are real asphalt gray. Intentionally LIGHT for vehicle contrast.
// Color multiplies with procedural asphalt texture in Road.js.
export const ROAD_SURFACE_COLORS = {
  brazil: 0xababb5,   // light gray — strong contrast with dark vehicles
  usa:    0x9a9a92,   // warm light gray
  peru:   0xa3a3ab,   // neutral light gray
};

// Colors
export const COLORS = {
  road: 0xababb5,     // default road color (used by Road.js at init)
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

// Driver definitions — all use compact vehicle in different color variations
export const DRIVER_TYPES = [
  // Row 1
  {
    name: 'Yihan',
    avatar: asset('characters/Yihan.webp'),
    accentColor: '#e0e0e0',
    carBody: 0xe8e8e8, carAccent: 0xffffff,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 3, efficiency: 4 },
  },
  {
    name: 'Ivan',
    avatar: asset('characters/Ivan.webp'),
    accentColor: '#2266cc',
    carBody: 0x2266cc, carAccent: 0x4488ee,
    vehicleType: 'compact',
    stats: { topSpeed: 3, acceleration: 4, efficiency: 3 },
  },
  {
    name: 'Murryam',
    avatar: asset('characters/Murryam.webp'),
    accentColor: '#22aa44',
    carBody: 0x22aa44, carAccent: 0x44cc66,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 3, efficiency: 4 },
  },
  {
    name: 'Nazmus',
    avatar: asset('characters/Nazmus.webp'),
    accentColor: '#cc2222',
    carBody: 0xcc2222, carAccent: 0xee4444,
    vehicleType: 'compact',
    stats: { topSpeed: 3, acceleration: 5, efficiency: 3 },
  },
  // Row 2
  {
    name: 'Alex',
    avatar: asset('characters/Alex.webp'),
    accentColor: '#dd6600',
    carBody: 0xdd6600, carAccent: 0xff8822,
    vehicleType: 'compact',
    stats: { topSpeed: 5, acceleration: 3, efficiency: 4 },
  },
  {
    name: 'William',
    avatar: asset('characters/William.webp'),
    accentColor: '#2a2a2a',
    carBody: 0x1a1a1a, carAccent: 0x333333,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 4, efficiency: 5 },
  },
  {
    name: 'Sofia',
    avatar: asset('characters/Sofia.webp'),
    accentColor: '#dd5599',
    carBody: 0xdd5599, carAccent: 0xff77bb,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 4, efficiency: 4 },
  },
  {
    name: 'Asad',
    avatar: asset('characters/Asad.webp'),
    accentColor: '#44aa66',
    carBody: 0xe0e8e0, carAccent: 0x44aa66,
    vehicleType: 'compact',
    stats: { topSpeed: 5, acceleration: 3, efficiency: 3 },
  },
];

// Map themes
export const MAP_THEMES = [
  {
    id: 'brazil',
    name: 'Brazil',
    description: 'Sun, beaches & tropical vibes',
    subtitle: 'Rio de Janeiro\nHighway',
    city: 'Rio de Janeiro',
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
    subtitle: 'Chicago\nDowntown',
    city: 'Chicago',
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
    subtitle: 'Cuzco\nHighlands',
    city: 'Cuzco',
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
