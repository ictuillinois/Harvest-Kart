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
    name: 'Ethan',
    description: 'The Balanced Pro',
    avatar: asset('characters/ethan.png'),
    accentColor: '#2a2a2a',
    carBody: 0x1a1a1a,
    carAccent: 0x444444,
    vehicleType: 'sportsGT',
    stats: { topSpeed: 4, acceleration: 3, efficiency: 5 },
  },
  {
    name: 'Kate',
    description: 'The Quick Starter',
    avatar: asset('characters/kate.png'),
    accentColor: '#d44a7a',
    carBody: 0xd44a7a,
    carAccent: 0xff6b9d,
    vehicleType: 'compact',
    stats: { topSpeed: 3, acceleration: 5, efficiency: 3 },
  },
  {
    name: 'Destiny',
    description: 'The Speed Demon',
    avatar: asset('characters/destiny.png'),
    accentColor: '#3a6adf',
    carBody: 0x3a6adf,
    carAccent: 0x5a8aff,
    vehicleType: 'formula',
    stats: { topSpeed: 5, acceleration: 3, efficiency: 4 },
  },
  {
    name: 'Luke',
    description: 'The Eco Racer',
    avatar: asset('characters/luke.png'),
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
    fogDensity: 0.003,
    ground: 0x222228,
    ambientColor: 0x1a1a3a,
    ambientIntensity: 1.0,
    dirColor: 0x4466aa,
    dirIntensity: 0.7,
    stars: true,
    shadow: { far: 40, size: 15 },
    colorGrade: { saturation: 1.0, contrast: 1.15, brightness: 0.95 },
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
