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

**Drivers:** Ethan (black, Sports GT), Kate (pink, Compact), Destiny (blue, Formula), Luke (green, Rally). Each has a unique vehicle type and color. Character WebP in `public/characters/`.

**Maps:** Peru (mountain pass), USA (night city), Brazil (coastal highway). Each has a custom gradient sky (no Preetham shader), distinct lighting, decorations, and fog.

## Critical Patterns

### Speed & Gear System

`gameState.speed` is **MPH directly** (0-100), not internal units. A `SCROLL_FACTOR = 0.5` converts MPH to world scroll speed. All world objects (road, plates, lamps, environment parallax) receive `speed * SCROLL_FACTOR * delta`.

### Per-Driver Vehicle Physics

Each driver has unique physics derived from stats (SPD/ACC/EFF). `DRIVER_PHYSICS` in constants.js defines per-driver: `topSpeed`, `gearAccel` (scaled by ACC stars), `gearThresholds` (proportional to top speed), `decelRate`, `coastFloor`, `laneSwitchMs`, `chargeMultiplier`. `getDriverPhysics(driverIndex)` returns active config. `activePhysics` stored in main.js, used in game loop for accel/decel/shifting/FOV.

| Driver | Top Speed | Accel | Decel | Coast | Lane Switch |
|--------|-----------|-------|-------|-------|-------------|
| Ethan  | 92 MPH    | 12/s  | 4/s   | 32    | 200ms       |
| Kate   | 84 MPH    | 16/s  | 10/s  | 24    | 150ms       |
| Destiny| 100 MPH   | 12/s  | 7/s   | 28    | 250ms       |
| Luke   | 84 MPH    | 14/s  | 4/s   | 32    | 180ms       |

RPM simulation: `RPM_IDLE = 1000`, `RPM_REDLINE = 8000`. RPM = linear interpolation within current gear's speed band. Sawtooth pattern on upshift.

Starting speed after "GO!": 40 MPH (gear 2).

### Model Scale Normalization

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

### Viewport & Responsive Design

The renderer uses full `window.innerWidth × window.innerHeight` — no fixed resolution, no CSS transform scaling. `#game-wrap` is `100vw × 100vh`. All HUD/overlay elements appended to `document.body` (outside game-wrap) use `position: fixed` with `clamp()` viewport-relative sizing.

CSS design tokens in `:root` (via HUD.js style injection): `--hud-bg`, `--hud-accent (#00ff88)`, `--hud-font (Orbitron)`, `--hud-blur`, etc. Shared `.hud-glass` class for glassmorphism panels.

### HUD System (AAA Racing Style)

`HUD.js` — All DOM-based overlays. SVG speedometer (bottom-right, 0-100 MPH arc) + SVG tachometer (bottom-left, 0-8K RPM arc with redline zone) + energy gauge (right, 12-segment vertical bar) + minimap (top-left) + score/combo (top-center) + timer (top-right) + pause button. All use Orbitron font, glassmorphism panels.

**Public API (exact signatures, called from main.js):** `updateSpeed(mph)`, `updateTime(elapsed)`, `updateCharge(charge)`, `updateScore(score)`, `updateCombo(combo)`, `updateLamps(lit)`, `updateTacho(rpm, gear)`, `flashTacho()`, `celebrateCharge()`, `showFloatingScore(points)`, `showToast(text)`, `showPause()`, `hidePause()`, `reset()`, `show()`, `hide()`.

**RaceStartSequence directly manipulates `hud.el.style`** (opacity, pointerEvents, transition) — do not change the `this.el` contract.

### Vehicle Models (GLTF)

Vehicles use Kenney Car Kit GLB models in `public/models/vehicles/`. Each model has nodes: `body`, `spoiler` (ethan only), `wheel-front-left/right`, `wheel-back-left/right`. All share a single `colormap` texture atlas (`Textures/colormap.png`).

`Kart.js` loads models via `getModel()`, clones materials per-node, and tints the body with the driver color via `material.color.set()` (multiplied over the texture atlas). Wheels get dark rubber material. `DRIVER_VEHICLES` maps vehicleType → model URL.

**Dark vehicle detection**: `Kart._isDark(hexColor)` uses BT.709 luminance (threshold 0.15). Dark vehicles get: higher metalness (0.7), very low roughness (0.08), blue-white underglow, boosted rim lighting. All automatic — no hardcoded character names.

### Vehicle Lighting & Visibility

Lighting rig in `_attachLightingRig()`: overhead fill, rear chase-cam fill, low front fill (all tight radius, decay 2), colored underglow (distance 6), headlight PointLights + glow halos, taillight PointLights + emissive strips. Side accent strips (MeshBasicMaterial, always visible).

`scene.environment` set via `PMREMGenerator.fromScene()` after `environment.build()` — kart is **hidden** during capture to prevent color bleeding into reflections.

Per-theme SpotLight headlights + PointLight backfill added via `addKartLights(themeId)` in main.js. `THEME_VEHICLE_LIGHT` config scales intensities per map.

### Road Surface & Contrast

`ROAD_SURFACE_COLORS` in constants.js — centralized per-theme road colors (brazil `0x777780`, usa `0x606068`, peru `0x707078`). Road.js procedural asphalt texture uses `#808080` base. Material color multiplies with texture — both must be light enough for visible gray.

`Road.setThemeColor(themeId)` updates road material per map. Called from main.js on map selection.

### Driver Select — 3D Vehicle Preview

`DriverSelect.js` creates a secondary WebGLRenderer (256×128) with a showroom environment: 6-light rig (key, fill, rim, bounce, ambient, hemisphere), PMREMGenerator showroom cubemap (ceiling with strip lights, gray walls, dark floor), reflective ground disc. Dark vehicles get extra blue accent SpotLight.

Models are lazily loaded on first `show()` (after preload). Animation loop: hovered card rotates fast, others idle slowly. Only active cards render every frame.

### Asset Loader — Material Isolation

`getModel()` in assetLoader.js deep-clones all materials on every clone to prevent color contamination between instances. This is critical — without it, tinting one model's material affects all instances sharing that material.

### Parallax Depth Layers

Environment decorations scroll at 3 speeds:
- `this.foreground[]` — 100% (barriers, bushes, props near road)
- `this.midground[]` — 60% (buildings, palms, hills)
- `this.background[]` — 20% (mountains, clouds)

### Enhanced Scenery System

**Brazil**: 3 rows of Kenney suburban buildings (tinted with favela colors via `_tintModel()`), Christ the Redeemer on Corcovado mountain (left side), Sugarloaf Mountain (left side), distant city skyline, boats on ocean (right side), beach palms. Right side = ocean only.

**Chicago/USA (Sunset)**: Procedural buildings with canvas window textures (`_buildingWindowTex`, `_createChicagoBuilding`), 7 architectural styles (red brick, dark brick, concrete, limestone, glass, cream, brownstone). Sunset-reflecting windows on sun-facing sides. Kenney skyscrapers in background. Dense deciduous trees along sidewalks + behind buildings. Lake Michigan, The Bean, street signs, lamps. Grass strips along roadside.

**Peru (Andean)**: Vertex-colored gradient mountains (`_createAndeanMountain` — green→brown→gray→snow with vertex displacement for organic shape). Secondary ridges behind main peaks. Atmospheric perspective on distant mountains (`_applyAtmosphere`). 7 house clusters with varied adobe colors. Llama herds. Dense 3-type trees (pine/bush/round) in foreground/midground/hillside. Inca terraces with grass. Ground variation patches (dirt/grass/rock). Mist layers.

All scenery models use Kenney texture atlases (`Textures/colormap.png` per folder). `_tintModel()` tints via color multiply preserving textures. `_placeModel()` preserves Y offset from `normalizeToHeight` (models sit on ground correctly).

### Sky System

Each map uses a custom gradient sky (ShaderMaterial on inverted sphere). Brazil = daytime blue gradient with cloud sprites. USA = sunset gradient (deep blue-purple zenith → warm orange → golden horizon) with sun glow sprite and warm cloud sprites. Peru = deep mountain blue with dusty horizon haze.

### Piezoelectric Energy Plates

`Plate.js` — Flat rectangular panels (2.4×0.18×1.5) embedded in road with electric blue glow (`0x22aaff`). Each plate = 4 meshes (border housing, animated body, merged detail overlay via `mergeGeometries`, emissive ground glow disc). No PointLights — glow is MeshBasicMaterial only. Pool of 15 plates.

**Lane sequence**: `generateLaneSequence()` ensures one plate per Z position, weighted toward adjacent lane switches (60%), never same lane 3× in a row, never two consecutive 2-lane jumps.

**Collection feedback**: Body depresses 0.12 units (70ms) → springs back with `Back.Out` overshoot → settles. White emissive flash → fade to dim. Sound: thud + spring compression + ascending sproing + metallic ring + electric zap (all synthesized Web Audio).

### Start Line Decoration

`buildStartLine()` in main.js — checkered road pattern (merged into 2 meshes: white + black), gantry arch (merged pillars + crossbar), checkered banner, red light spheres. All merged via `mergeGeometries` (4 total meshes). Scrolls with road, auto-removed at z>30.

### Lamp Post Progressive Lighting (4 tiers)

20 recycling lamp posts (10 pairs, both sides of road). 5-tier brightness system (tier 0-4) with color progression (brown → amber → gold → warm white). `AMBIENT_MULTIPLIERS = [0.4, 0.55, 0.7, 0.85, 1.0]` exported from LampPost.js. Active lights culled: 4 on mobile, 6 on desktop (`MAX_ACTIVE_LIGHTS`).

**Tier 3 urgency**: Toast "Almost there. HURRY UP!", timer turns red.

**Completion**: Car keeps driving at max speed through "ENERGY HARVESTED" text → fade to black → "HIGHWAY POWERED" win screen.

### Race Start Sequence

`RaceStartSequence.js` — Black overlay fade → horizontal traffic light bar (red→orange→amber→green) + 3-2-1-GO countdown → controls unlock. Controls visible (locked) during countdown, HUD at 0.5 opacity. Map transitions use fade-to-black loading overlay to mask synchronous `environment.build()`.

### Engine Sound (Web Audio API)

V8 engine: 4 layered oscillators (45Hz fundamental, harmonics at 2×/3×/4×), waveshaper distortion, lowpass filter (250-2800Hz), idle-lope LFO. `updateEngine(rpm)` takes RPM (1000-8000), normalizes internally. Smoothing 40ms. Frequency range 1×→3.8×.

`playGearShift(isUpshift, gear)`: Upshift = engine dip + mechanical clunk + turbo whoosh + engagement thump (all gear-scaled). Downshift = rev-match blip + filter spike + exhaust crackle pops.

UI sounds: `playStartPress()` (ascending C-major arpeggio), `playDriverSelect()` (two-note triangle confirmation + noise punch), `playMapSelect()` (sawtooth power-up sweep + ping).

### Controls

`controls.js` — Glassmorphism arrow buttons + radial-gradient gas pedal. Pointer Events API + keyboard fallback + swipe fallback. `lock()`/`unlock()` gate `isPedalDown()` and lane switches. 220ms cooldown on lane switches.

### Intro Sequence

`IntroScreen.js` — Two-phase: Phase 1 (EOH logo + "Forging the Future" + dates) → Phase 2 ("In Association with" + ICT logo + "PRESENTS"). 12.4s total, then start screen revealed.

## Architecture

`src/main.js` — Orchestrator: renderer, scene, camera, game objects, UI screens, event wiring, game loop. Gear/RPM state, per-theme kart lights, loading overlay for map transitions.

`Environment.js` — Sky, lighting, ground, barriers, per-theme scenery. Parallax 3-layer system. Helpers: `_tintModel()`, `_createChicagoBuilding()`, `_buildingWindowTex()`, `_createAndeanMountain()`, `_applyAtmosphere()`. `_placeModel()` preserves Y offset from normalizeToHeight.

`GameState.js` — Observer pattern state machine. `speed` property is MPH (per-driver top speed).

`Kart.js` — GLTF vehicle loader. Per-node material cloning (preserves texture, tints body with driver color). 4 PointLights (fill + underglow + tail, headlight in main.js). Per-driver `laneSwitchMs`.

`Plate.js` — Pooled electric-blue road panels. Merged detail geometry. Strategic lane sequence. Spring compression animation + synthesized piezo sound.

`Road.js` — 3 recycling segments with merged lane markings (`mergeGeometries`). Per-theme color via `setThemeColor()`. Procedural asphalt texture (256×256).

`DriverSelect.js` — Driver selection UI + 3D vehicle preview with showroom environment map + 6-light rig.

`CompletionSequence.js` — Cinematic ending: car keeps driving, "ENERGY HARVESTED" text, fade to black, win screen.

`WinScreen.js` — "HIGHWAY POWERED" screen with Orbitron font, floating particles, pulsing badge, gradient text, staggered entrance animations, high score persistence.

`LampPost.js` — 20 recycling posts, 5-tier system, 4-6 active lights (mobile/desktop).

`audio.js` — Procedural Web Audio: V8 engine (reduced volume: idle 0.04, max 0.15), gear shifts, piezo plate hit sound (thud + spring + sproing + ring + zap). Background music via HTML Audio.

## 3D Assets

All in `public/models/`. KayKit City Builder (CC0, GLTF+texture atlas), Kenney Car Kit vehicles (CC0, GLB+colormap), Kenney Commercial/Suburban Buildings (CC0, GLB+colormap), Poly Pizza models (CC0/CC-BY, GLB). Character portraits in `public/characters/` (WebP). Map previews in `public/maps/` (WebP). EOH logo in `public/eoh.svg`. Start screen in `public/Start_Screen.webp`.

## Performance Optimizations

- **Mobile**: Antialias off, pixelRatio 1, post-processing skipped (direct render), shadow maps 512×512, 4 active lamp lights
- **Desktop**: Antialias on, pixelRatio 2, vignette + color grading post-processing, shadow maps 1024×1024, 6 active lamp lights
- **Kart lights**: Consolidated from 12 → 5 (3 body + 2 main.js). All have quadratic decay, tight distance
- **Road**: Merged lane markings via `mergeGeometries` (150 → 9 meshes)
- **Plates**: Merged detail geometry, no PointLights (315+15 → 60+0 meshes/lights)
- **Start line**: Merged checkered squares + gantry (67 → 4 meshes)
- **Chicago**: Procedural canvas window textures (1 draw call per building face vs hundreds of window planes)
- **Shared materials/geometries**: Trees, rocks, grass clumps reuse geometry instances
- **Ocean waves**: Every-other-frame update (20×20 grid)
- **Camera far plane**: 500 (was 1000)

## Known Issues

- Environment theme builders have some duplicated patterns

## Remaining Roadmap

- Loading progress bar during model preload
- Ambient sounds per theme (ocean waves, city hum, wind)
- Mute toggle button in HUD
