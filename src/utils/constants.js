// Lane positions (X coordinates)
export const LANE_POSITIONS = [-3, 0, 3];
export const LANE_COUNT = 3;

// Road dimensions
export const ROAD_WIDTH = 12;
export const ROAD_SEGMENT_LENGTH = 100;
export const ROAD_SEGMENT_COUNT = 3;

// Speeds
export const INITIAL_SPEED = 20;
export const MAX_SPEED = 35;
export const ACCELERATION = 0.3; // per second

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
    type: 'professor',
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
    type: 'kid',
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
    type: 'woman',
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
    skyTop: 0x1e90ff,
    skyMid: 0xff9933,
    skyBottom: 0xffe4b5,
    fog: 0xffcc88,
    fogDensity: 0.004,
    ground: 0xc2b280,
    ambientColor: 0xffeedd,
    ambientIntensity: 0.7,
    dirColor: 0xffdd88,
    dirIntensity: 1.0,
  },
  {
    id: 'usa',
    name: 'USA',
    description: 'Big city lights & skyscrapers',
    skyTop: 0x0a0a2e,
    skyMid: 0x1a1a4e,
    skyBottom: 0x2a1a3e,
    fog: 0x111133,
    fogDensity: 0.005,
    ground: 0x1a1a1a,
    ambientColor: 0x554488,
    ambientIntensity: 0.5,
    dirColor: 0x8888cc,
    dirIntensity: 0.6,
  },
  {
    id: 'peru',
    name: 'Peru',
    description: 'Majestic mountains & green valleys',
    skyTop: 0x4488cc,
    skyMid: 0x88ccee,
    skyBottom: 0xaaddaa,
    fog: 0x88bbaa,
    fogDensity: 0.003,
    ground: 0x3a5a2a,
    ambientColor: 0xccddcc,
    ambientIntensity: 0.7,
    dirColor: 0xffffcc,
    dirIntensity: 0.9,
  },
];

// Camera
export const CAMERA_OFFSET = { x: 0, y: 5, z: 8 };
export const CAMERA_LOOK_AHEAD = 10;
