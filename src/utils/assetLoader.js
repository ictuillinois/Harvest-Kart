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
            // Set colorSpace on ALL embedded textures at preload time (avoids re-upload during build)
            group.traverse(child => {
              if (child.isMesh) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => { if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; });
              }
            });
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
  // KayKit props
  bench: asset('models/props/bench.gltf'),
  firehydrant: asset('models/props/firehydrant.gltf'),
  trafficLight: asset('models/props/trafficlight_A.gltf'),
  dumpster: asset('models/props/dumpster.gltf'),
  // Brazil palm
  palmTree: asset('models/beach/palm.glb'),
  // USA props
  trafficCone: asset('models/usa/traffic_cone.glb'),
  mailbox: asset('models/usa/mailbox.glb'),
  trashcan: asset('models/usa/trashcan.glb'),
  // Racing
  tires: asset('models/racing/tires.glb'),
  raceBarrier: asset('models/racing/barrier.glb'),
  // Momo's World (CC0 / CC-BY — poly.pizza)
  snowman: asset('models/momo/snowman.glb'),
  candyCane: asset('models/momo/candycane.glb'),
  bone: asset('models/momo/bone.glb'),
  // Player vehicles (FBX)
  vehicleEthan: asset('models/vehicles/fbx/ethan.FBX'),
  vehicleKate: asset('models/vehicles/fbx/kate.fbx'),
  vehicleDestiny: asset('models/vehicles/fbx/destiny.fbx'),
  vehicleLuke: asset('models/vehicles/fbx/luke.fbx'),
};

// Sidecar textures for FBX models that don't embed their textures
const FBX_TEXTURES = {};
// Destiny: embedded textures sufficient, sidecar removed for performance
FBX_TEXTURES[MODEL_URLS.vehicleLuke] = asset('models/vehicles/fbx/luke.png');

// Target heights in world units (auto-applied by getModel)
export const MODEL_HEIGHTS = {};

// Populate heights keyed by resolved URL
// Props
MODEL_HEIGHTS[MODEL_URLS.bench] = 0.7;
MODEL_HEIGHTS[MODEL_URLS.firehydrant] = 0.6;
MODEL_HEIGHTS[MODEL_URLS.trafficLight] = 2.5;
MODEL_HEIGHTS[MODEL_URLS.dumpster] = 1.0;
MODEL_HEIGHTS[MODEL_URLS.palmTree] = 6;
MODEL_HEIGHTS[MODEL_URLS.trafficCone] = 0.5;
MODEL_HEIGHTS[MODEL_URLS.mailbox] = 0.9;
MODEL_HEIGHTS[MODEL_URLS.trashcan] = 0.8;
MODEL_HEIGHTS[MODEL_URLS.tires] = 0.8;
MODEL_HEIGHTS[MODEL_URLS.raceBarrier] = 0.9;
// Momo props
MODEL_HEIGHTS[MODEL_URLS.snowman] = 2.0;
MODEL_HEIGHTS[MODEL_URLS.candyCane] = 1.5;
MODEL_HEIGHTS[MODEL_URLS.bone] = 0.4;

// Player vehicles (FBX)
MODEL_HEIGHTS[MODEL_URLS.vehicleEthan] = 1.8;     // Sonata Pantera
MODEL_HEIGHTS[MODEL_URLS.vehicleKate] = 1.44;      // Compact (90% of 1.6)
MODEL_HEIGHTS[MODEL_URLS.vehicleDestiny] = 1.87;   // AMG GT (+10%)
MODEL_HEIGHTS[MODEL_URLS.vehicleLuke] = 1.62;      // SUV (90% of 1.8)
