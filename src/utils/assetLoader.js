import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

/**
 * Load a GLTF/GLB model. Returns a clone from cache on subsequent calls.
 */
export async function loadModel(url) {
  if (cache.has(url)) {
    return cache.get(url).scene.clone(true);
  }
  const gltf = await loader.loadAsync(url);
  cache.set(url, gltf);
  return gltf.scene.clone(true);
}

/**
 * Preload an array of model URLs in parallel.
 * Returns a Map<url, gltf> for direct access.
 */
export async function preloadAll(urls) {
  const results = await Promise.all(
    urls.map(async (url) => {
      if (!cache.has(url)) {
        const gltf = await loader.loadAsync(url);
        cache.set(url, gltf);
      }
      return [url, cache.get(url)];
    })
  );
  return new Map(results);
}

/**
 * Get a clone from the cache (sync). Must have been preloaded first.
 */
export function getModel(url) {
  const gltf = cache.get(url);
  if (!gltf) throw new Error(`Model not preloaded: ${url}`);
  return gltf.scene.clone(true);
}

// All model paths — import this list for preloading
export const MODEL_URLS = {
  // Buildings (KayKit City Builder)
  buildingA: '/models/buildings/building_A.gltf',
  buildingB: '/models/buildings/building_B.gltf',
  buildingC: '/models/buildings/building_C.gltf',
  buildingD: '/models/buildings/building_D.gltf',
  buildingE: '/models/buildings/building_E.gltf',
  buildingF: '/models/buildings/building_F.gltf',
  buildingG: '/models/buildings/building_G.gltf',
  buildingH: '/models/buildings/building_H.gltf',
  // Props
  streetlight: '/models/props/streetlight.gltf',
  bush: '/models/props/bush.gltf',
  bench: '/models/props/bench.gltf',
  firehydrant: '/models/props/firehydrant.gltf',
  trafficLight: '/models/props/trafficlight_A.gltf',
  dumpster: '/models/props/dumpster.gltf',
  watertower: '/models/props/watertower.gltf',
  // Cars
  carSedan: '/models/props/car_sedan.gltf',
  carTaxi: '/models/props/car_taxi.gltf',
  carHatchback: '/models/props/car_hatchback.gltf',
};
