import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { asset } from './base.js';

const loader = new GLTFLoader();
const cache = new Map();

/**
 * Normalize a loaded model to a target height using its bounding box.
 * This eliminates all ad-hoc scale factors — every model is auto-sized.
 */
function normalizeToHeight(object3D, targetHeight) {
  const box = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3();
  box.getSize(size);
  const currentHeight = size.y;
  if (currentHeight > 0.001) {
    const scale = targetHeight / currentHeight;
    object3D.scale.setScalar(scale);
  }
  // Center the model on its base (y=0)
  box.setFromObject(object3D);
  object3D.position.y -= box.min.y;
}

export async function preloadAll(urls) {
  const results = await Promise.all(
    urls.map(async (url) => {
      if (!cache.has(url)) {
        try {
          const gltf = await loader.loadAsync(url);
          cache.set(url, gltf);
        } catch (e) {
          console.warn(`Failed to load model: ${url}`, e);
        }
      }
      return [url, cache.get(url)];
    })
  );
  return new Map(results);
}

/**
 * Get a clone of a preloaded model, auto-normalized to its registry height.
 * No scale parameter needed — the registry defines the target height.
 */
export function getModel(url) {
  const gltf = cache.get(url);
  if (!gltf) {
    console.warn(`Model not preloaded: ${url}`);
    return new THREE.Group(); // Return empty group instead of crashing
  }
  const clone = gltf.scene.clone(true);
  // Apply target height from registry
  const targetHeight = MODEL_HEIGHTS[url];
  if (targetHeight) {
    normalizeToHeight(clone, targetHeight);
  }
  return clone;
}

// ═══════════════════════════════════════════════════════
//  MODEL REGISTRY — target world-space heights
//  Reference: Kart is 2w × 1.2h. Road is 12 wide.
//  A "person" would be ~1.5 units. A car ~1.3 units.
// ═══════════════════════════════════════════════════════

// Model paths
export const MODEL_URLS = {
  // KayKit buildings (internal: 1.6-3.0h)
  buildingA: asset('models/buildings/building_A.gltf'),
  buildingB: asset('models/buildings/building_B.gltf'),
  buildingC: asset('models/buildings/building_C.gltf'),
  buildingD: asset('models/buildings/building_D.gltf'),
  buildingE: asset('models/buildings/building_E.gltf'),
  buildingF: asset('models/buildings/building_F.gltf'),
  buildingG: asset('models/buildings/building_G.gltf'),
  buildingH: asset('models/buildings/building_H.gltf'),
  // KayKit props (internal: 0.1-1.0h)
  bush: asset('models/props/bush.gltf'),
  bench: asset('models/props/bench.gltf'),
  firehydrant: asset('models/props/firehydrant.gltf'),
  trafficLight: asset('models/props/trafficlight_A.gltf'),
  dumpster: asset('models/props/dumpster.gltf'),
  // KayKit cars (internal: ~0.1h — very small unit system)
  carSedan: asset('models/props/car_sedan.gltf'),
  carTaxi: asset('models/props/car_taxi.gltf'),
  carHatchback: asset('models/props/car_hatchback.gltf'),
  // Poly Pizza palm (internal: variable, needs Box3 measurement)
  palmTree: asset('models/beach/palm.glb'),
  // USA props
  trafficCone: asset('models/usa/traffic_cone.glb'),
  mailbox: asset('models/usa/mailbox.glb'),
  trashcan: asset('models/usa/trashcan.glb'),
  // Peru props
  llama: asset('models/peru/llama.glb'),
  stoneWall: asset('models/peru/stone_wall.glb'),
  flowers: asset('models/peru/flowers.glb'),
  hut: asset('models/peru/hut.glb'),
  // Racing
  tires: asset('models/racing/tires.glb'),
  raceBarrier: asset('models/racing/barrier.glb'),
};

// Target heights in world units (auto-applied by getModel)
export const MODEL_HEIGHTS = {};

// Populate heights keyed by resolved URL
// Buildings: 4-8 units tall (city skyline scale)
MODEL_HEIGHTS[MODEL_URLS.buildingA] = 5;
MODEL_HEIGHTS[MODEL_URLS.buildingB] = 5;
MODEL_HEIGHTS[MODEL_URLS.buildingC] = 7;
MODEL_HEIGHTS[MODEL_URLS.buildingD] = 8;
MODEL_HEIGHTS[MODEL_URLS.buildingE] = 6;
MODEL_HEIGHTS[MODEL_URLS.buildingF] = 7;
MODEL_HEIGHTS[MODEL_URLS.buildingG] = 9;
MODEL_HEIGHTS[MODEL_URLS.buildingH] = 10;

// Props: real-world proportions relative to kart (1.2h)
MODEL_HEIGHTS[MODEL_URLS.bush] = 0.8;
MODEL_HEIGHTS[MODEL_URLS.bench] = 0.7;
MODEL_HEIGHTS[MODEL_URLS.firehydrant] = 0.6;
MODEL_HEIGHTS[MODEL_URLS.trafficLight] = 2.5;
MODEL_HEIGHTS[MODEL_URLS.dumpster] = 1.0;
MODEL_HEIGHTS[MODEL_URLS.carSedan] = 1.3;
MODEL_HEIGHTS[MODEL_URLS.carTaxi] = 1.3;
MODEL_HEIGHTS[MODEL_URLS.carHatchback] = 1.2;

// Nature: tropical/mountain scale
MODEL_HEIGHTS[MODEL_URLS.palmTree] = 6;
MODEL_HEIGHTS[MODEL_URLS.flowers] = 0.4;
MODEL_HEIGHTS[MODEL_URLS.llama] = 1.4;
MODEL_HEIGHTS[MODEL_URLS.stoneWall] = 1.2;
MODEL_HEIGHTS[MODEL_URLS.hut] = 2.5;

// USA street props
MODEL_HEIGHTS[MODEL_URLS.trafficCone] = 0.5;
MODEL_HEIGHTS[MODEL_URLS.mailbox] = 0.9;
MODEL_HEIGHTS[MODEL_URLS.trashcan] = 0.8;

// Racing
MODEL_HEIGHTS[MODEL_URLS.tires] = 0.8;
MODEL_HEIGHTS[MODEL_URLS.raceBarrier] = 0.9;
