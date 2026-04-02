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
export const PLATES_TO_FILL_BAR = 5;
export const TOTAL_LAMP_POSTS = 4;
export const PLATE_SPAWN_INTERVAL = 1.2; // seconds between spawns
export const PLATE_COLLISION_Z_THRESHOLD = 2.5;

// Colors
export const COLORS = {
  road: 0x333333,
  roadLine: 0xffffff,
  roadLineDashed: 0xcccccc,
  plate: 0x39ff14,       // neon green
  plateGlow: 0x7fff00,
  lampOff: 0x555555,
  lampOn: 0xffcc00,
  lampLight: 0xffa500,
  barrier: 0x888888,
  building: 0x1a1a2e,
  skyTop: 0x1a0533,      // deep purple
  skyMid: 0xff6b35,      // orange
  skyBottom: 0xff1493,    // pink
};

// Kart color variants
export const KART_VARIANTS = [
  { name: 'Red Racer', body: 0xe74c3c, accent: 0xc0392b },
  { name: 'Blue Bolt', body: 0x3498db, accent: 0x2980b9 },
  { name: 'Green Machine', body: 0x2ecc71, accent: 0x27ae60 },
];

// Camera
export const CAMERA_OFFSET = { x: 0, y: 5, z: 8 };
export const CAMERA_LOOK_AHEAD = 10;
