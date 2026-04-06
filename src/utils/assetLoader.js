import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { asset } from './base.js';

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const textureLoader = new THREE.TextureLoader();
const cache = new Map();

function isFBX(url) {
  return /\.fbx$/i.test(url);
}

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
          if (isFBX(url)) {
            const group = await fbxLoader.loadAsync(url);
            // Apply sidecar texture if registered
            const texUrl = FBX_TEXTURES[url];
            if (texUrl) {
              const tex = await textureLoader.loadAsync(texUrl);
              tex.colorSpace = THREE.SRGBColorSpace;
              group.traverse(child => {
                if (child.isMesh) {
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  mats.forEach(m => { if (!m.map) m.map = tex; });
                }
              });
            }
            // Normalize to same shape as GLTF ({ scene: ... }) so getModel() works unchanged
            cache.set(url, { scene: group });
          } else {
            const gltf = await gltfLoader.loadAsync(url);
            cache.set(url, gltf);
          }
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
export function getModel(url, skipMaterialClone = false) {
  const gltf = cache.get(url);
  if (!gltf) {
    console.warn(`Model not preloaded: ${url}`);
    return new THREE.Group();
  }
  const clone = gltf.scene.clone(true);

  // Deep-clone materials to prevent color bleeding between instances.
  // Skip for vehicles since _buildCar replaces all materials anyway.
  if (!skipMaterialClone) {
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    });
  }

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
  // KayKit props
  bush: asset('models/props/bush.gltf'),
  bench: asset('models/props/bench.gltf'),
  firehydrant: asset('models/props/firehydrant.gltf'),
  trafficLight: asset('models/props/trafficlight_A.gltf'),
  dumpster: asset('models/props/dumpster.gltf'),
  // NOTE: streetlight + watertower removed (unused)
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
  stoneWall: asset('models/peru/stone_wall.glb'),
  flowers: asset('models/peru/flowers.glb'),
  hut: asset('models/peru/hut.glb'),
  // Racing
  tires: asset('models/racing/tires.glb'),
  raceBarrier: asset('models/racing/barrier.glb'),
  // Brazil scenery (Kenney — CC0)
  brazilE: asset('models/scenery/brazil/building-e.glb'),
  brazilF: asset('models/scenery/brazil/building-f.glb'),
  brazilG: asset('models/scenery/brazil/building-g.glb'),
  brazilI: asset('models/scenery/brazil/building-i.glb'),
  brazilJ: asset('models/scenery/brazil/building-j.glb'),
  brazilL: asset('models/scenery/brazil/building-l.glb'),
  brazilM: asset('models/scenery/brazil/building-m.glb'),
  brazilN: asset('models/scenery/brazil/building-n.glb'),
  // Chicago scenery (Kenney — CC0)
  chicagoSkyscraperA: asset('models/scenery/chicago/building-skyscraper-a.glb'),
  chicagoSkyscraperB: asset('models/scenery/chicago/building-skyscraper-b.glb'),
  chicagoSkyscraperC: asset('models/scenery/chicago/building-skyscraper-c.glb'),
  chicagoSkyscraperD: asset('models/scenery/chicago/building-skyscraper-d.glb'),
  chicagoSkyscraperE: asset('models/scenery/chicago/building-skyscraper-e.glb'),
  chicagoLowA: asset('models/scenery/chicago/low-detail-building-a.glb'),
  chicagoLowB: asset('models/scenery/chicago/low-detail-building-b.glb'),
  chicagoLowE: asset('models/scenery/chicago/low-detail-building-e.glb'),
  chicagoLowL: asset('models/scenery/chicago/low-detail-building-l.glb'),
  chicagoLowM: asset('models/scenery/chicago/low-detail-building-m.glb'),
  // Peru scenery (Kenney — CC0)
  peruBuildingA: asset('models/scenery/peru/building-type-a.glb'),
  peruBuildingB: asset('models/scenery/peru/building-type-b.glb'),
  peruBuildingC: asset('models/scenery/peru/building-type-c.glb'),
  peruBuildingD: asset('models/scenery/peru/building-type-d.glb'),
  peruBuildingE: asset('models/scenery/peru/building-type-e.glb'),
  peruBuildingF: asset('models/scenery/peru/building-type-f.glb'),
  peruBuildingR: asset('models/scenery/peru/building-type-r.glb'),
  peruBuildingS: asset('models/scenery/peru/building-type-s.glb'),
  peruBuildingT: asset('models/scenery/peru/building-type-t.glb'),
  peruPlanter: asset('models/scenery/peru/planter.glb'),
  peruTreeLarge: asset('models/scenery/peru/tree-large.glb'),
  peruTreeSmall: asset('models/scenery/peru/tree-small.glb'),
  // Player vehicles (FBX)
  vehicleEthan: asset('models/vehicles/fbx/ethan.FBX'),
  vehicleKate: asset('models/vehicles/fbx/kate.fbx'),
  vehicleDestiny: asset('models/vehicles/fbx/destiny.fbx'),
  vehicleLuke: asset('models/vehicles/fbx/luke.fbx'),
};

// Sidecar textures for FBX models that don't embed their textures
const FBX_TEXTURES = {};
FBX_TEXTURES[MODEL_URLS.vehicleDestiny] = asset('models/vehicles/fbx/destiny.png');
FBX_TEXTURES[MODEL_URLS.vehicleLuke] = asset('models/vehicles/fbx/luke.png');

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
MODEL_HEIGHTS[MODEL_URLS.stoneWall] = 1.2;
MODEL_HEIGHTS[MODEL_URLS.hut] = 2.5;

// USA street props
MODEL_HEIGHTS[MODEL_URLS.trafficCone] = 0.5;
MODEL_HEIGHTS[MODEL_URLS.mailbox] = 0.9;
MODEL_HEIGHTS[MODEL_URLS.trashcan] = 0.8;

// Racing
MODEL_HEIGHTS[MODEL_URLS.tires] = 0.8;
MODEL_HEIGHTS[MODEL_URLS.raceBarrier] = 0.9;

// Brazil scenery — colorful coastal buildings
MODEL_HEIGHTS[MODEL_URLS.brazilE] = 5;
MODEL_HEIGHTS[MODEL_URLS.brazilF] = 6;
MODEL_HEIGHTS[MODEL_URLS.brazilG] = 7;
MODEL_HEIGHTS[MODEL_URLS.brazilI] = 8;
MODEL_HEIGHTS[MODEL_URLS.brazilJ] = 9;
MODEL_HEIGHTS[MODEL_URLS.brazilL] = 6;
MODEL_HEIGHTS[MODEL_URLS.brazilM] = 7;
MODEL_HEIGHTS[MODEL_URLS.brazilN] = 8;

// Chicago scenery — night city
MODEL_HEIGHTS[MODEL_URLS.chicagoSkyscraperA] = 25;
MODEL_HEIGHTS[MODEL_URLS.chicagoSkyscraperB] = 30;
MODEL_HEIGHTS[MODEL_URLS.chicagoSkyscraperC] = 22;
MODEL_HEIGHTS[MODEL_URLS.chicagoSkyscraperD] = 35;
MODEL_HEIGHTS[MODEL_URLS.chicagoSkyscraperE] = 20;
MODEL_HEIGHTS[MODEL_URLS.chicagoLowA] = 8;
MODEL_HEIGHTS[MODEL_URLS.chicagoLowB] = 10;
MODEL_HEIGHTS[MODEL_URLS.chicagoLowE] = 7;
MODEL_HEIGHTS[MODEL_URLS.chicagoLowL] = 9;
MODEL_HEIGHTS[MODEL_URLS.chicagoLowM] = 8;

// Peru scenery — Andean village
MODEL_HEIGHTS[MODEL_URLS.peruBuildingA] = 4;
MODEL_HEIGHTS[MODEL_URLS.peruBuildingB] = 5;
MODEL_HEIGHTS[MODEL_URLS.peruBuildingC] = 4;
MODEL_HEIGHTS[MODEL_URLS.peruBuildingD] = 5;
MODEL_HEIGHTS[MODEL_URLS.peruBuildingE] = 5;
MODEL_HEIGHTS[MODEL_URLS.peruBuildingF] = 4.5;
MODEL_HEIGHTS[MODEL_URLS.peruBuildingR] = 3.5;
MODEL_HEIGHTS[MODEL_URLS.peruBuildingS] = 4;
MODEL_HEIGHTS[MODEL_URLS.peruBuildingT] = 6;
MODEL_HEIGHTS[MODEL_URLS.peruPlanter] = 0.6;
MODEL_HEIGHTS[MODEL_URLS.peruTreeLarge] = 5;
MODEL_HEIGHTS[MODEL_URLS.peruTreeSmall] = 3;

// Player vehicles (FBX) — heights tuned relative to road-level camera
MODEL_HEIGHTS[MODEL_URLS.vehicleEthan] = 1.8;     // Sonata Pantera
MODEL_HEIGHTS[MODEL_URLS.vehicleKate] = 1.44;      // Compact (90% of 1.6)
MODEL_HEIGHTS[MODEL_URLS.vehicleDestiny] = 1.87;   // AMG GT (+10%)
MODEL_HEIGHTS[MODEL_URLS.vehicleLuke] = 1.62;      // SUV (90% of 1.8)
