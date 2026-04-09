import { asset } from './base.js';

// Lane positions (X coordinates)
export const LANE_POSITIONS = [-3.5, 0, 3.5];
export const LANE_COUNT = 3;

// Road dimensions
export const ROAD_WIDTH = 12;
export const ROAD_SEGMENT_LENGTH = 100;
export const ROAD_SEGMENT_COUNT = 3;

// Speed system — gameState.speed is MPH directly
export const STARTING_SPEED_MPH = 25;    // speed after green light
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
  // ── Tier 1: Maxed ──
  alqadi: {
    topSpeed: 120, gearAccel: calcGearAccel(5),
    gearThresholds: calcGearThresholds(120),
    decelRate: 4, coastFloor: 0, laneSwitchMs: 150, chargeMultiplier: 1.2,
    turboBoost: 20,
  },
  // ── Tier 2: Second best ──
  johann: {
    topSpeed: 102, gearAccel: calcGearAccel(4),
    gearThresholds: calcGearThresholds(102),
    decelRate: 5, coastFloor: 0, laneSwitchMs: 170, chargeMultiplier: 1.1,
  },
  yihan: {
    topSpeed: 96, gearAccel: calcGearAccel(4),
    gearThresholds: calcGearThresholds(96),
    decelRate: 4, coastFloor: 0, laneSwitchMs: 180, chargeMultiplier: 1.2,
  },
  asad: {
    topSpeed: 105, gearAccel: calcGearAccel(5),
    gearThresholds: calcGearThresholds(105),
    decelRate: 6, coastFloor: 0, laneSwitchMs: 150, chargeMultiplier: 1.0,
  },
  // ── Tier 3: Evenly distributed ──
  roberto: {
    topSpeed: 94, gearAccel: calcGearAccel(4),
    gearThresholds: calcGearThresholds(94),
    decelRate: 5, coastFloor: 0, laneSwitchMs: 170, chargeMultiplier: 1.1,
  },
  sofia: {
    topSpeed: 92, gearAccel: calcGearAccel(3),
    gearThresholds: calcGearThresholds(92),
    decelRate: 5, coastFloor: 0, laneSwitchMs: 190, chargeMultiplier: 1.1,
  },
  ivan: {
    topSpeed: 88, gearAccel: calcGearAccel(4),
    gearThresholds: calcGearThresholds(88),
    decelRate: 7, coastFloor: 0, laneSwitchMs: 160, chargeMultiplier: 1.0,
  },
  alex: {
    topSpeed: 94, gearAccel: calcGearAccel(3),
    gearThresholds: calcGearThresholds(94),
    decelRate: 7, coastFloor: 0, laneSwitchMs: 200, chargeMultiplier: 1.0,
  },
  aditya: {
    topSpeed: 102, gearAccel: calcGearAccel(3),
    gearThresholds: calcGearThresholds(102),
    decelRate: 5, coastFloor: 0, laneSwitchMs: 180, chargeMultiplier: 1.15,
  },
  murryam: {
    topSpeed: 92, gearAccel: calcGearAccel(3),
    gearThresholds: calcGearThresholds(92),
    decelRate: 5, coastFloor: 0, laneSwitchMs: 190, chargeMultiplier: 1.1,
  },
  nazmus: {
    topSpeed: 84, gearAccel: calcGearAccel(5),
    gearThresholds: calcGearThresholds(84),
    decelRate: 8, coastFloor: 0, laneSwitchMs: 150, chargeMultiplier: 1.0,
  },
  william: {
    topSpeed: 90, gearAccel: calcGearAccel(4),
    gearThresholds: calcGearThresholds(90),
    decelRate: 6, coastFloor: 0, laneSwitchMs: 180, chargeMultiplier: 1.05,
  },
};

// Driver ID lookup by index (matches DRIVER_TYPES order)
// Row 1: Yihan, Roberto, Sofia, Ivan, Asad, Johann
// Row 2: Alex, Aditya, Murryam, Nazmus, William, Al-Qadi
const DRIVER_IDS = ['yihan', 'roberto', 'sofia', 'ivan', 'asad', 'johann', 'alex', 'aditya', 'murryam', 'nazmus', 'william', 'alqadi'];
export function getDriverPhysics(driverIndex) {
  return DRIVER_PHYSICS[DRIVER_IDS[driverIndex]] || DRIVER_PHYSICS.yihan;
}

// Legacy exports (defaults — used before driver is selected)
export const MAX_SPEED_MPH = 100;
export const MIN_SPEED_MPH = 0;
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
  brazil:   0xababb5,   // light gray — strong contrast with dark vehicles
  usa:      0x9a9a92,   // warm light gray
  peru:     0xa3a3ab,   // neutral light gray
  shanghai: 0x2a2a2e,   // black asphalt — Chinese city road
  delhi:    0x9a9a9e,   // warm gray — dusty Indian highway
  momo:     0xa8a8b0,   // cool gray — snowy road
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
// Row 1: Yihan, Roberto, Sofia, Ivan, Asad, Johann
// Row 2: Alex, Aditya, Murryam, Nazmus, William, Al-Qadi
export const DRIVER_TYPES = [
  // ── Row 1 ──
  {
    name: 'Yihan',
    avatar: asset('characters/Yihan.webp'),
    accentColor: '#e0e0e0',
    carBody: 0xe8e8e8, carAccent: 0xffffff,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 4, efficiency: 5 },
  },
  {
    name: 'Roberto',
    avatar: asset('characters/Roberto.webp'),
    accentColor: '#66cc66',
    carBody: 0x66cc66, carAccent: 0x88ee88,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 4, efficiency: 4 },
  },
  {
    name: 'Sofia',
    avatar: asset('characters/Sofia.webp'),
    accentColor: '#dd5599',
    carBody: 0xdd5599, carAccent: 0xff77bb,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 3, efficiency: 4 },
  },
  {
    name: 'Ivan',
    avatar: asset('characters/Ivan.webp'),
    accentColor: '#0077aa',
    carBody: 0x0077aa, carAccent: 0x2299cc,
    vehicleType: 'compact',
    stats: { topSpeed: 3, acceleration: 4, efficiency: 3 },
  },
  {
    name: 'Asad',
    avatar: asset('characters/Asad.webp'),
    accentColor: '#44aa66',
    carBody: 0xe0e8e0, carAccent: 0x44aa66,
    vehicleType: 'compact',
    stats: { topSpeed: 5, acceleration: 5, efficiency: 3 },
  },
  {
    name: 'Johann',
    avatar: asset('characters/Johann.webp'),
    accentColor: '#f0ece8',
    carBody: 0xf0ece8, carAccent: 0xffffff,
    vehicleType: 'compact',
    stats: { topSpeed: 5, acceleration: 4, efficiency: 4 },
  },
  // ── Row 2 ──
  {
    name: 'Alex',
    avatar: asset('characters/Alex.webp'),
    accentColor: '#dd6600',
    carBody: 0xdd6600, carAccent: 0xff8822,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 3, efficiency: 3 },
  },
  {
    name: 'Aditya',
    avatar: asset('characters/Aditya.webp'),
    accentColor: '#078BDC',
    carBody: 0x078BDC, carAccent: 0x29a5f0,
    vehicleType: 'compact',
    stats: { topSpeed: 5, acceleration: 3, efficiency: 4 },
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
    accentColor: '#ee2222',
    carBody: 0xee2222, carAccent: 0xff4444,
    vehicleType: 'compact',
    stats: { topSpeed: 3, acceleration: 5, efficiency: 3 },
  },
  {
    name: 'William',
    avatar: asset('characters/William.webp'),
    accentColor: '#2a2a2a',
    carBody: 0x1a1a1a, carAccent: 0x333333,
    vehicleType: 'compact',
    stats: { topSpeed: 4, acceleration: 4, efficiency: 3 },
  },
  {
    name: 'Al-Qadi',
    avatar: asset('characters/Al-Qadi.webp'),
    accentColor: '#1a5c2a',
    carBody: 0x1a5c2a, carAccent: 0x2d8a4e,
    vehicleType: 'compact',
    stats: { topSpeed: 5, acceleration: 5, efficiency: 5 },
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
  {
    id: 'shanghai',
    name: 'China',
    description: 'Early morning skyline & ancient heritage',
    subtitle: 'Shanghai\nDowntown',
    city: 'Shanghai',
    flag: asset('flags/china.png'),
    features: ['Futuristic skyline', 'Huangpu River', 'Pagoda gardens'],
    sky: {
      turbidity: 6,
      rayleigh: 2.0,
      mieCoefficient: 0.015,
      mieDirectionalG: 0.80,
      sunElevation: 20,      // rising sun — early morning
      sunAzimuth: 90,       // east
      exposure: 0.9,
    },
    clouds: {
      coverage: 0.2,
      density: 0.25,
      scale: 0.00025,
      speed: 0.0001,
      elevation: 0.5,
    },
    fog: 0xaabbcc,            // cool morning mist
    fogDensity: 0.003,
    ground: 0x3a4a2a,
    ambientColor: 0x99aacc,
    ambientIntensity: 0.6,
    dirColor: 0xffeebb,       // warm sunrise light
    dirIntensity: 1.8,
    stars: false,
    shadow: { far: 55, size: 20 },
    colorGrade: { saturation: 1.05, contrast: 1.0, brightness: 1.08 },
  },
  {
    id: 'delhi',
    name: 'India',
    description: 'Warm nights & ancient wonders',
    subtitle: 'Delhi\nHighway',
    city: 'Delhi',
    flag: asset('flags/india.png'),
    features: ['Taj Mahal silhouette', 'Temple spires', 'Coastal neon road'],
    sky: {
      turbidity: 5,
      rayleigh: 1.8,
      mieCoefficient: 0.012,
      mieDirectionalG: 0.80,
      sunElevation: 6,       // very low sun — warm dusk
      sunAzimuth: 210,
      exposure: 0.65,
    },
    clouds: {
      coverage: 0.3,
      density: 0.3,
      scale: 0.00022,
      speed: 0.00012,
      elevation: 0.45,
    },
    fog: 0xbb8866,           // warm dusty haze
    fogDensity: 0.004,
    ground: 0x4a3a2a,
    ambientColor: 0xcc9966,
    ambientIntensity: 0.45,
    dirColor: 0xffbb77,
    dirIntensity: 1.5,
    stars: false,
    shadow: { far: 55, size: 20 },
    colorGrade: { saturation: 1.08, contrast: 1.02, brightness: 1.0 },
  },
  {
    id: 'momo',
    name: "Momo's World",
    description: 'A whimsical Pomeranian fantasy land',
    subtitle: "Momo's\nWorld",
    city: "Momo's World",
    flag: asset('maps/momo-world.webp'),
    features: ['Giant Pomeranian head', 'Toy village', 'Golden sunset'],
    sky: {
      turbidity: 4,
      rayleigh: 2.2,
      mieCoefficient: 0.018,
      mieDirectionalG: 0.82,
      sunElevation: 10,
      sunAzimuth: 220,
      exposure: 0.75,
    },
    clouds: {
      coverage: 0.35,
      density: 0.3,
      scale: 0.00025,
      speed: 0.00012,
      elevation: 0.45,
    },
    fog: 0xddccbb,
    fogDensity: 0.003,
    ground: 0xe8e0d8,
    ambientColor: 0xffddcc,
    ambientIntensity: 0.6,
    dirColor: 0xffcc77,
    dirIntensity: 1.5,
    stars: false,
    shadow: { far: 55, size: 20 },
    colorGrade: { saturation: 1.1, contrast: 1.0, brightness: 1.05 },
  },
];

// Camera
export const CAMERA_OFFSET = { x: 0, y: 6, z: 10 };
export const CAMERA_LOOK_AHEAD = 15;
export const CAMERA_FOV_MIN = 55;
export const CAMERA_FOV_MAX = 68;
export const CAMERA_SHAKE_THRESHOLD = 0.8; // speed fraction above which shake starts
