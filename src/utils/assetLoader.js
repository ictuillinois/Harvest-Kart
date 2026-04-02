import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { asset } from './base.js';

const loader = new GLTFLoader();
const cache = new Map();

export async function loadModel(url) {
  if (cache.has(url)) {
    return cache.get(url).scene.clone(true);
  }
  const gltf = await loader.loadAsync(url);
  cache.set(url, gltf);
  return gltf.scene.clone(true);
}

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

export function getModel(url) {
  const gltf = cache.get(url);
  if (!gltf) throw new Error(`Model not preloaded: ${url}`);
  return gltf.scene.clone(true);
}

// All model paths — resolved against Vite base URL
export const MODEL_URLS = {
  // Buildings (KayKit City Builder)
  buildingA: asset('models/buildings/building_A.gltf'),
  buildingB: asset('models/buildings/building_B.gltf'),
  buildingC: asset('models/buildings/building_C.gltf'),
  buildingD: asset('models/buildings/building_D.gltf'),
  buildingE: asset('models/buildings/building_E.gltf'),
  buildingF: asset('models/buildings/building_F.gltf'),
  buildingG: asset('models/buildings/building_G.gltf'),
  buildingH: asset('models/buildings/building_H.gltf'),
  // Props
  streetlight: asset('models/props/streetlight.gltf'),
  bush: asset('models/props/bush.gltf'),
  bench: asset('models/props/bench.gltf'),
  firehydrant: asset('models/props/firehydrant.gltf'),
  trafficLight: asset('models/props/trafficlight_A.gltf'),
  dumpster: asset('models/props/dumpster.gltf'),
  watertower: asset('models/props/watertower.gltf'),
  // Cars
  carSedan: asset('models/props/car_sedan.gltf'),
  carTaxi: asset('models/props/car_taxi.gltf'),
  carHatchback: asset('models/props/car_hatchback.gltf'),
  // Beach (Brazil)
  beachBall: asset('models/beach/beach_ball.glb'),
  beachUmbrella: asset('models/beach/umbrella.glb'),
  surfboard: asset('models/beach/surfboard.glb'),
  crab: asset('models/beach/crab.glb'),
  beachChair: asset('models/beach/chair.glb'),
  lifeguardTower: asset('models/beach/lifeguard.glb'),
  sailboat: asset('models/beach/sailboat.glb'),
  seagull: asset('models/beach/seagull.glb'),
  palmTree: asset('models/beach/palm.glb'),
};
