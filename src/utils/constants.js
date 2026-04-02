import { asset } from './base.js';

// Lane positions (X coordinates)
export const LANE_POSITIONS = [-3, 0, 3];
export const LANE_COUNT = 3;

// Road dimensions
export const ROAD_WIDTH = 12;
export const ROAD_SEGMENT_LENGTH = 100;
export const ROAD_SEGMENT_COUNT = 3;

// Speeds (internal units — mapped to 20-70 mph for display)
export const MIN_SPEED = 15;          // idle / coast speed
export const MAX_SPEED = 45;          // full pedal speed
export const PEDAL_ACCELERATION = 35; // units/sec when pedal held (snappy 0.85s)
export const COAST_DECELERATION = 14; // units/sec when pedal released
export const MIN_SPEED_MPH = 20;
export const MAX_SPEED_MPH = 70;

// Lane switching
export const LANE_SWITCH_DURATION = 200; // ms

// Game config
export const PLATES_TO_FILL_BAR = 10;
export const TOTAL_LAMP_POSTS = 4;
export const PLATE_SPAWN_INTERVAL = 1.0; // slightly faster spawns for 10-plate target
export const PLATE_COLLISION_Z_THRESHOLD = 2.5;

// Colors
export const COLORS = {
  road: 0x333333,
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
    name: 'Prof. Werner',
    description: 'The wise inventor',
    tagline: 'Years of research meet the open road',
    type: 'professor',
    avatar: asset('characters/professor.svg'),
    skinColor: 0xf0c8a0,
    hairColor: 0xcccccc,
    shirtColor: 0xffffff,
    pantsColor: 0x2c3e50,
    kartBody: 0x8b0000,
    kartAccent: 0xcc3333,
  },
  {
    name: 'Little Max',
    description: 'The curious kid',
    tagline: 'Fastest wheels on the playground',
    type: 'kid',
    avatar: asset('characters/kid.svg'),
    skinColor: 0xdeb887,
    hairColor: 0x4a3728,
    shirtColor: 0xff6b35,
    pantsColor: 0x2980b9,
    kartBody: 0x2ecc71,
    kartAccent: 0x27ae60,
  },
  {
    name: 'Dr. Sarah',
    description: 'The young scientist',
    tagline: 'Powered by science and determination',
    type: 'woman',
    avatar: asset('characters/woman.svg'),
    skinColor: 0xf5deb3,
    hairColor: 0xf0d060,
    shirtColor: 0x9b59b6,
    pantsColor: 0x1a1a2e,
    kartBody: 0x3498db,
    kartAccent: 0x2471a3,
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
    fog: 0xffcc88,
    fogDensity: 0.004,
    ground: 0xc2b280,
    ambientColor: 0xffeedd,
    ambientIntensity: 0.6,
    dirColor: 0xffdd88,
    dirIntensity: 1.2,
    stars: false,
  },
  {
    id: 'usa',
    name: 'USA',
    description: 'Big city lights & skyscrapers',
    subtitle: 'Downtown Night Drive',
    flag: asset('flags/usa.png'),
    features: ['Neon-lit skyline', 'Moonlit twilight sky', 'Urban traffic'],
    sky: {
      turbidity: 12,
      rayleigh: 0.5,
      mieCoefficient: 0.008,
      mieDirectionalG: 0.95,
      sunElevation: 1.5,    // just at horizon — deep twilight
      sunAzimuth: 250,
      exposure: 0.25,
    },
    clouds: {
      coverage: 0.15,
      density: 0.2,
      scale: 0.0003,
      speed: 0.00008,
      elevation: 0.6,
    },
    fog: 0x0a0a1e,
    fogDensity: 0.005,
    ground: 0x1a1a1a,
    ambientColor: 0x334466,
    ambientIntensity: 0.35,
    dirColor: 0x6677aa,
    dirIntensity: 0.4,
    stars: true,
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
    fog: 0x88bbaa,
    fogDensity: 0.003,
    ground: 0x3a5a2a,
    ambientColor: 0xccddcc,
    ambientIntensity: 0.65,
    dirColor: 0xffffcc,
    dirIntensity: 1.0,
    stars: false,
  },
];

// Camera
export const CAMERA_OFFSET = { x: 0, y: 5, z: 8 };
export const CAMERA_LOOK_AHEAD = 10;
