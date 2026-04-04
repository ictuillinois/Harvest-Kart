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

A 3D browser-based kart racing mini-game (Three.js v0.183.2 + Vite v8 + @tweenjs/tween.js v25). No React, no backend. Demonstrates piezoelectric energy harvesting: drive over glowing plates on a highway to charge lamp posts progressively.

**Game flow:** `menu` → `driverSelect` → `mapSelect` → `playing` ↔ `paused` → `completing` → `complete`

**Drivers:** Ethan (black, Sports GT), Kate (pink, Compact), Destiny (blue, Formula), Luke (green, Rally). Each has a unique vehicle type and color. Character PNGs in `public/characters/`.

**Maps:** Peru (mountain pass), USA (night city), Brazil (coastal highway). Each has a custom gradient sky (no Preetham shader), distinct lighting, decorations, and fog.

## Critical Patterns

### Model Scale Normalization (most important)

GLTF models from different sources have wildly different internal scales. **Never hand-tune scales.**

`assetLoader.js` has `normalizeToHeight(object3D, targetHeight)` which uses `Box3.setFromObject()` to measure real bounds and scales to an exact world-space height. The `MODEL_HEIGHTS` registry maps every model URL to its target height. `getModel(url)` auto-normalizes on every clone.

### Asset Path Resolution

All public assets must use `asset('path/to/file')` from `src/utils/base.js`. This prepends `import.meta.env.BASE_URL` so paths work both in dev (`/`) and on GitHub Pages (`/Harvest-Kart/`).

### Tween.js v25 Requires Explicit Group

`new Tween(obj)` alone creates an orphan that never updates. Always pass the shared group:
```js
import { tweenGroup } from '../utils/tweenGroup.js';
new Tween(obj, tweenGroup).to({...}).start();
```

### Parallax Depth Layers

Environment decorations scroll at 3 speeds:
- `this.foreground[]` — 100% (barriers, bushes, props near road)
- `this.midground[]` — 60% (buildings, palms, hills)
- `this.background[]` — 20% (mountains, clouds)

### Sky System

Each map uses a custom gradient sky (ShaderMaterial on inverted sphere) instead of the Preetham sky addon. Brazil = daytime blue gradient with cloud sprites. USA = night gradient with stars + city light pollution glow. Peru = deep mountain blue with dusty horizon haze.

### Lamp Post Progressive Lighting

20 recycling lamp posts (10 pairs, both sides of road). 5-tier brightness system (tier 0-4) with color progression (brown → amber → gold → warm white). Per-coin micro-progression interpolates between tiers. Inverted light cones (narrow at lamp, wide at road) with additive blending + ground light pools. `AMBIENT_MULTIPLIERS` exported from LampPost.js for scene ambient scaling.

### Vehicle System

4 vehicle types in `Kart.js`: `_buildFormula()` (open-wheel F1), `_buildSportsGT()` (closed coupe), `_buildCompact()` (hatchback), `_buildRally()` (off-road). Dispatcher via `driver.vehicleType`. Each builder sets `this._exhaustZ` for exhaust particles. 3-light vehicle rig (overhead, rear, low rim) ensures visibility on all maps.

### Race Start & Completion Sequences

`RaceStartSequence.js` — Black overlay fade → 3-2-1-GO countdown → controls unlock. `CompletionSequence.js` — Tier 4 flash → auto-drive → camera pullback → "MISSION ACCOMPLISHED" two-line text → fade to black → win screen.

### Engine Sound (Web Audio API)

American Muscle V8: 4 layered oscillators (45Hz fundamental + 2nd/3rd/4th harmonics), waveshaper distortion, lowpass filter, idle-lope LFO for "potato-potato" burble. `updateEngine(speed)` called every frame. `playCountdownRev()` for countdown. Volume tuned to 70% so music track is audible.

### Controls Lock/Unlock

`controls.js` has `lock()`/`unlock()` methods. When locked, `isPedalDown()` returns false and lane switches are blocked. Used during countdown and completion sequences.

## Architecture

`src/main.js` — Orchestrator: renderer, scene, camera, game objects, UI screens, event wiring, game loop. Kart-attached headlights for USA night map created/destroyed here.

`Environment.js` — Sky, lighting, ground, barriers, theme decorations. `_buildGradientSky()`, `_buildNightSky()`, `_buildMountainSky()` for per-theme skies. Per-theme hemisphere light overrides.

`GameState.js` — Observer pattern state machine. States: menu, driverSelect, mapSelect, playing, paused, completing, complete.

`Kart.js` — Vehicle constructor with 4 body types. Shared methods: `_addWheels()`, `_addHeadlights()`, `_addTailLights()`, `_addExhaustPipes()`. Exhaust particle system.

`LampPost.js` — 20 recycling posts, tier system, micro-progression, flash effects, ground pools, inverted cones with additive blending.

`audio.js` — Procedural Web Audio: V8 engine, countdown tones/revs, plate hit, lamp lit, combo break, lane switch, win fanfare, final power-on. Background music via HTML Audio elements.

## 3D Assets

All in `public/models/`. KayKit City Builder (CC0, GLTF+texture atlas), Poly Pizza models (CC0/CC-BY, GLB). Character portraits in `public/characters/` (PNG). Map preview images in `public/maps/` (PNG).

## Known Issues

- Environment theme builders have duplicated code (3 similar methods)
- No InstancedMesh (barriers + road dashes could save draw calls)
- No frustum culling on decorations
- Vehicles built from primitives (no loaded GLTF models)

## Remaining Roadmap

- Theme config objects to DRY the 3 builders
- InstancedMesh for barriers + road dashes
- Loading progress bar during model preload
- Ambient sounds per theme (ocean waves, city hum, wind)
- Keyboard Tab navigation on selection screens
