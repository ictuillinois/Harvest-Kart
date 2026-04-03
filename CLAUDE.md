# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run dev      # Start Vite dev server (hot reload)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

GitHub Pages deployment is automatic on push to main via `.github/workflows/deploy.yml`. The workflow builds with `--base=/Harvest-Kart/` for correct subpath asset resolution.

## Project Overview

A 3D browser-based kart mini-game (Three.js v0.183.2 + Vite v8 + @tweenjs/tween.js v25). No React, no backend. Demonstrates piezoelectric energy harvesting: drive over glowing plates on a highway to charge lamp posts.

**Game flow:** `menu` → `driverSelect` → `mapSelect` → `playing` ↔ `paused` → `complete`

Three map themes: Brazil (sunset coastal highway), USA (night city), Peru (mountain pass). Each has distinct sky (Preetham shader), lighting, decorations, and color grading.

## Critical Patterns

### Model Scale Normalization (most important)

GLTF models from different sources have wildly different internal scales: KayKit models are 0.1-3.0 units, Poly Pizza models can be 50-150 units (centimeter scale). **Never hand-tune scales.**

`assetLoader.js` has `normalizeToHeight(object3D, targetHeight)` which uses `Box3.setFromObject()` to measure real bounds and scales to an exact world-space height. The `MODEL_HEIGHTS` registry maps every model URL to its target height. `getModel(url)` auto-normalizes on every clone.

When adding a new model: measure its bounds first, add a target height to `MODEL_HEIGHTS`, then place it with `_placeModel(url, x, y, z, rotY, sizeVariation)` — no explicit scale needed.

### Asset Path Resolution

All public assets must use `asset('path/to/file')` from `src/utils/base.js`. This prepends `import.meta.env.BASE_URL` so paths work both in dev (`/`) and on GitHub Pages (`/Harvest-Kart/`). Hardcoding `/path` will break on Pages.

### Tween.js v25 Requires Explicit Group

`new Tween(obj)` alone creates an orphan that never updates. Always pass the shared group:
```js
import { tweenGroup } from '../utils/tweenGroup.js';
new Tween(obj, tweenGroup).to({...}).start();
```
The game loop calls `tweenGroup.update()` each frame.

### Parallax Depth Layers

Environment decorations are in 3 arrays with different scroll speeds:
- `this.foreground[]` — 100% speed (bushes, barriers, props near road)
- `this.midground[]` — 60% speed (buildings, palms, hills)
- `this.background[]` — 20% speed (mountains)

When placing objects in `_buildBrazil/USA/Peru`, pass the layer as the last parameter to `_placeModel()` or `_scatterProps()`.

### Post-Processing

`EffectComposer` pipeline: RenderPass → ColorGradePass → VignettePass. Bloom was removed because the Preetham sky shader outputs HDR values near the sun disc that blow out at any bloom threshold. Use `AgXToneMapping` (not ACES) — it handles HDR sky much better.

### Water/Ocean

The Three.js Water addon (`three/addons/objects/Water.js`) was replaced with a simple blue `MeshStandardMaterial` plane because the Water shader reflects the sky so heavily at sunset that it becomes invisible. The current ocean uses vertex displacement for wave animation.

## Architecture

`src/main.js` is the orchestrator: creates renderer, scene, camera, all game objects and UI screens, wires events, and runs the game loop. Game state is event-driven via `GameState.js` (observer pattern). UI screens are DOM overlays (HTML/CSS) at z-index 100, HUD at z-index 50.

`Environment.js` is the largest file — it builds the Sky (Preetham addon), lighting, ground, barriers, and theme-specific decorations. The `build(themeIndex)` method is async (loads models). Three private methods `_buildBrazil/USA/Peru` place theme decorations.

Controls (`controls.js`) handle keyboard (arrows/WASD/space), touch (pointer events with capture for multi-touch), and swipe. The GAS pedal is a holdable button that reports `isPedalDown()` — speed is managed in the game loop, not in controls.

## 3D Assets

All in `public/models/`. KayKit City Builder (CC0, GLTF+texture atlas), Poly Pizza models (CC0/CC-BY, GLB). Poly Pizza beach props were removed — their 50-150 unit internal geometry was unusable. Only `palm.glb` from that set survived.

## Known Issues

- Environment theme builders have duplicated code (3 similar methods)
- No InstancedMesh (barriers + road dashes could save ~50 draw calls)
- No frustum culling on decorations
- Kart and driver are built from primitives (no loaded model)

## Remaining Roadmap

- Theme config objects to DRY the 3 builders
- InstancedMesh for barriers + road dashes
- Kart headlights for USA night map
- Loading progress bar during model preload
- Engine hum sound mapped to speed
- Ambient sounds per theme (ocean waves, city hum, wind)
- Keyboard Tab navigation on selection screens
