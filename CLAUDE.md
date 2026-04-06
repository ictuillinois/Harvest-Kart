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

**Game title:** AL-QADI TEAM RACING — Energy Harvesting Edition

**Game flow:** `menu` → `driverSelect` → `mapSelect` → `playing` ↔ `paused` → `completing` → `complete` → `reward`

**Intro sequence:** IntroScreen (EOH logo → ICT logo, ~12s) runs as an overlay (z-index 500) on top of the start screen. IntroScreen must be created BEFORE `startScreen.show()` to prevent flash.

**Drivers:** Ethan (black, Sports GT), Kate (pink, Compact), Destiny (blue, AMG GT), Luke (green, Lamborghini SUV). Each has a unique vehicle type, color, and FBX model. Character WebP in `public/characters/`.

**Maps:** Peru (mountain pass), USA (sunset city — default), Brazil (coastal highway). Each has a custom gradient sky, distinct lighting, and fog. Scenes are aggressively optimized for browser performance.

**Game config:** `TOTAL_LAMP_POSTS = 3`, `PLATES_TO_FILL_BAR = 10` → 30 plates to complete. "HURRY UP!" triggers at `TOTAL_LAMP_POSTS - 1` (last batch before completion).

## Critical Patterns

### Speed & Gear System

`gameState.speed` is **MPH directly** (0-110), not internal units. A `SCROLL_FACTOR = 0.5` converts MPH to world scroll speed. All world objects (road, plates, lamps, environment parallax) receive `speed * SCROLL_FACTOR * delta`.

### Turbo Boost System

On each tier-up (every 10 plates collected), a 3-second turbo boost activates:
- Speed ramps up at 5 MPH/sec toward `topSpeed + 10`
- During turbo: speed is maintained (no deceleration)
- After turbo: speed bleeds down at 3 MPH/sec to normal topSpeed
- Visual: fire particles from exhaust (`startTurboFlame()`/`stopTurboFlame()`), taillight orange boost, flickering glow PointLight
- Audio: `playTurboBoost()` — whoosh + turbo whistle + bass thump + flutter
- FOV widens +5 degrees during turbo
- "TURBO BOOST!" toast with fire-themed styling
- Vehicles with `skipExhaust` (Destiny) skip exhaust particle emission

### Per-Driver Vehicle Physics

Each driver has unique physics derived from stats (SPD/ACC/EFF). `DRIVER_PHYSICS` in constants.js defines per-driver: `topSpeed`, `gearAccel` (scaled by ACC stars), `gearThresholds` (proportional to top speed), `decelRate`, `coastFloor`, `chargeMultiplier`. `getDriverPhysics(driverIndex)` returns active config.

| Driver  | Top Speed | Accel | Decel | Coast | Description     |
|---------|-----------|-------|-------|-------|-----------------|
| Ethan   | 92 MPH    | 12/s  | 4/s   | 32    | The Balanced Pro |
| Kate    | 84 MPH    | 16/s  | 10/s  | 24    | The Quick Starter |
| Destiny | 100 MPH   | 12/s  | 7/s   | 28    | The Speed Demon |
| Luke    | 100 MPH   | 14/s  | 12/s  | 20    | The Raging Bull |

RPM simulation: `RPM_IDLE = 1000`, `RPM_REDLINE = 8000`. Sawtooth pattern on upshift. Starting speed after "GO!": 40 MPH (gear 2).

### Continuous Lateral Movement

Players steer by holding arrow keys/buttons — the kart slides continuously at 10 units/sec. No discrete lane snapping. When arrows released, tilt recovers smoothly. Collision uses X-proximity (`Math.abs(plate.x - kart.x) < 1.8`) instead of lane-index matching.

`LANE_POSITIONS = [-3.5, 0, 3.5]` — used for plate spawning. Controls expose `isLeftHeld()`/`isRightHeld()` for continuous input detection. Gamepad support on start screen.

### Vehicle Models (FBX)

Vehicles use FBX models in `public/models/vehicles/fbx/`. Each model has different mesh structure discovered via FBX inspection:

| Driver  | FBX File   | Body Mesh              | Wheels | Notes |
|---------|------------|------------------------|--------|-------|
| Ethan   | ethan.FBX  | sonata_pantera_grey    | None (baked) | Dark vehicle, sportsLights: true |
| Kate    | kate.fbx   | Body (5 materials)     | 2 combined | compactLights: true |
| Destiny | destiny.fbx| amg_Gt_body (3 mats)   | 4 individual | skipExhaust, no rotation |
| Luke    | luke.fbx   | kuzov + named parts    | 4 individual | rallyLights, emissiveOnlyTint |

`VEHICLE_MESH_CONFIG` per vehicleType defines: `bodyNames`, `wheelNames`, `hiddenNames`, `rotationY`, `hasTexture`, `materialProfile`, and light/detail flags.

**Shadow casting:** Only body + wheel meshes have `castShadow = true` (via `_enableBodyShadows()`). All other kart meshes (lights, chrome, particles, glass) do NOT cast shadows to reduce shadow pass cost.

**Shared materials:** 10 module-level cached materials (`_sharedChrome`, `_sharedDarkChrome`, `_sharedHlLens`, `_sharedHlBulb`, `_sharedDRL`, `_sharedHalo`, `_sharedLedRed`, `_sharedAmber`, `_sharedRedMarker`, `_sharedWheel`) reused across ALL vehicles and light methods. Eliminates per-build material allocations.

**colorSpace:** Set on FBX textures at preload time in `assetLoader.js` to avoid GPU re-upload during builds. Never set during `_buildCar`.

### Per-Vehicle Light Systems

Three light system styles, implemented as static methods shared between `Kart.js` and `DriverSelect.js`:

- **Sports lights** (Ethan): `_addSportsHeadlights()` — projector lens + halo + DRL. `_addSportsTaillights()` — full-width LED bar with segments + chrome frame.
- **Compact lights** (Kate): `_addCompactHeadlights()` — round housings + chrome ring. `_addCompactTaillights()` — round LED clusters + connecting strip.
- **SUV lights** (Luke): Model headlights (`front_fari` mesh). `_addSUVTaillights()` — vertical LED bars with chrome bezels.
- **Destiny**: Standard headlights (2 bulbs) + standard taillights (2 clusters). Exhaust skipped.

### Material Profiles

`MATERIAL_PROFILES` defines per-vehicle paint finish:
- `candy` (Kate): metalness 0.25, roughness 0.30 — glossy plastic
- `raceMetal` (Destiny): metalness 0.55, roughness 0.15, emissive 0.22 — deep metallic
- `rallySatin` (Luke): metalness 0.35, roughness 0.22, emissive 0.20 — satin finish

Dark vehicles (Ethan) use a separate paint path with high metalness (0.75), low roughness (0.06), and strong emissive (0.55) for road contrast.

Luke uses `emissiveOnlyTint: true` — preserves texture palette colors (windows stay dark), adds driver color via emissive only.

### Model Scale Normalization

FBX/GLTF models have wildly different internal scales. **Never hand-tune scales.**

`assetLoader.js` has `normalizeToHeight(object3D, targetHeight)` using `Box3.setFromObject()`. The `MODEL_HEIGHTS` registry maps every model URL to its target height. `getModel(url)` auto-normalizes on every clone and deep-clones all materials.

`preloadAll()` auto-detects `.fbx` extension via `isFBX()` and uses `FBXLoader`. FBX results wrapped in `{ scene: group }` to match GLTF cache shape. colorSpace set on all embedded textures at preload time.

### Asset Path Resolution

All public assets must use `asset('path/to/file')` from `src/utils/base.js`. This prepends `import.meta.env.BASE_URL` so paths work both in dev (`/`) and on GitHub Pages (`/Harvest-Kart/`).

### Piezoelectric Energy Plates

`Plate.js` — Pool of 7 plates. Spawn interval 0.6s with 25-unit minimum gap between active plates. Each plate always spawns in a different lane from the previous one. X-proximity collision detection.

### Road Surface & Contrast

`ROAD_SURFACE_COLORS` in constants.js — lightened per-theme road colors (brazil `0xababb5`, usa `0x9a9a92`, peru `0xa3a3ab`). Dark vehicles get additional contrast: boosted fill light (2x), body highlight PointLight, consolidated underglow.

### HUD System

`HUD.js` — All DOM-based overlays. SVG speedometer + tachometer + energy gauge + minimap + score/combo + timer + pause button. Orbitron font, glassmorphism panels.

Per-frame updates debounced: `updateSpeed` skips when rounded MPH unchanged, `updateTacho` quantizes RPM to 50-step increments, `updateTime` skips when centisecond unchanged.

**Last-tier urgency**: Persistent vibrating "HURRY UP!" overlay triggers at `TOTAL_LAMP_POSTS - 1`, timer turns red with vibration.

### Start Screen

Neon title "AL-QADI TEAM RACING / ENERGY HARVESTING EDITION" with animated entrance, glow pulse, decorative frame with corner brackets, ICT logo overlay. Universal input (keyboard, touch, gamepad). Cover art in `public/Start_Screen.webp`.

### Completion & Reward Flow

`CompletionSequence.js` → `WinScreen.js` ("CONTINUE" button) → `RewardScreen.js` (town map + character) → home.

`RewardScreen.js`: SVG town map divided into 4 clickable sectors. Character panel with Al-Qadi.webp portrait, speech bubble, name/title.

### Loading & Transitions

Loading screen with animated progress bar and stage hints. Track music starts during loading. Loading overlay reused by RaceStartSequence (no overlay swap). Overlay fade 0.6s with `will-change: opacity`.

Pre-gameplay warm-up pipeline:
1. Build kart, environment, road color, env map
2. Pre-build gameplay objects (kart lights, start line, lamp posts)
3. Create particles + turbo glow light (warmUp)
4. `renderer.compile()` from gameplay camera position
5. Multiple compositor renders from gameplay + pre-race cameras
6. Game loop dry runs to warm V8 JIT
7. 300ms settle delay for async GPU/GC

### Engine Sound (Web Audio API)

V8 engine: 4 layered oscillators (45Hz fundamental, harmonics at 2x/3x/4x), lowpass filter, idle-lope LFO. `updateEngine(rpm)` debounced (skips when RPM change < 25).

`playTurboBoost()`: whoosh + turbo whistle + power thump + flutter.

### Controls

`controls.js` — Glassmorphism arrow buttons + radial-gradient gas pedal. Continuous lateral movement via `isLeftHeld()`/`isRightHeld()`. Pointer Events API + keyboard + swipe + gamepad. `lock()`/`unlock()` gate all inputs.

## Architecture

`src/main.js` — Orchestrator: renderer, scene, camera, game objects, UI screens, event wiring, game loop. Turbo boost state, loading overlay with progress bar, per-theme kart lights. Single combined post-processing pass (vignette + color grade).

`Environment.js` — Sky, lighting, ground, barriers, per-theme scenery. Parallax 3-layer system (background updates every other frame). GPU resource disposal (`geometry.dispose()`, `material.dispose()`, `texture.dispose()`) on map switch. Lightweight scenes: Brazil (palms + boats), USA (procedural buildings, no trees), Peru (mountains + hills + terraces).

`GameState.js` — Observer pattern state machine. `speed` property is MPH.

`Kart.js` — FBX vehicle loader with per-vehicle `VEHICLE_MESH_CONFIG`. Shared module-level materials. Static headlight/taillight methods shared with DriverSelect. Turbo flame particle system. Continuous lateral movement (`slideLateral`, `recoverTilt`). Shadow casting limited to body+wheel meshes via `_enableBodyShadows()`.

`Plate.js` — Pooled electric-blue road panels (7 plates). X-proximity collision. 25-unit minimum gap. Different-lane enforcement. Idle pulse every other frame.

`Road.js` — 3 recycling segments with merged lane markings. Per-theme color via `setThemeColor()`.

`DriverSelect.js` — Driver selection UI + 3D vehicle preview with showroom environment. Imports `Kart` static methods for light geometry.

`RewardScreen.js` — Post-game reward screen with SVG town map + character panel.

`WinScreen.js` — "HIGHWAY POWERED" screen with "CONTINUE" button.

`StartScreen.js` — Neon title with animated entrance, decorative frame, ICT logo.

`LampPost.js` — 12 recycling posts (6 pairs), 5-tier system, proximity-based light culling (max 2 mobile / 3 desktop active PointLights). Posts start hidden, revealed on first plate hit via `setVisible()`. Structure meshes (pole+arm+housing) merged into single geometry per post.

`audio.js` — Procedural Web Audio: V8 engine, gear shifts, plate hit, turbo boost. Background music via HTML Audio.

## 3D Assets

All in `public/models/`. Only actively-used models are registered in `MODEL_URLS` (14 total):
- **Props:** bench, firehydrant, trafficLight, dumpster, trafficCone, mailbox, trashcan (GLTF)
- **Racing:** tires, raceBarrier (GLB)
- **Brazil:** palmTree (GLB)
- **Vehicles:** 4 FBX models in `public/models/vehicles/fbx/`

Character portraits in `public/characters/` (WebP). Map previews in `public/maps/` (WebP). Start screen in `public/Start_Screen.webp`. Al-Qadi portrait in `public/Al-Qadi.webp`.

**Unused assets have been removed.** Do not add model entries to `MODEL_URLS` without using them in game code — all entries are preloaded at startup.

## Performance Optimizations

### Rendering Pipeline
- **Mobile**: Antialias off, pixelRatio 1, post-processing skipped entirely, shadow maps 512x512
- **Desktop**: Antialias on, pixelRatio 2, single combined shader pass (vignette + color grade), shadow maps 1024x1024
- **Camera**: `updateProjectionMatrix()` only when FOV delta > 0.5 degrees

### Materials & Shaders
- **Shared materials**: 10 module-level cached materials reused across all vehicles
- **No MeshPhysicalMaterial**: All vehicles use MeshStandardMaterial
- **MeshBasicMaterial**: Used for environment objects that don't need lighting (buildings, barriers, lake, grass, bean, boats, signs)
- **colorSpace at preload**: FBX textures tagged at load time, never during builds

### Scene Complexity
- **USA**: ~20 procedural buildings (single MeshBasicMaterial each, shared texture pool of 3), no trees, 8 merged street lamps, 3 merged signs, ~11 scattered props, 3 clouds
- **Brazil**: 11 palm trees (GLTF), 2 boats (MeshBasicMaterial), 3 clouds
- **Peru**: Procedural mountains + hills + terraces only, no GLTF models, 3 clouds
- **All maps**: Merged barrier geometry (2 meshes per map), 7-plate pool

### Lamp Posts
- **Deferred visibility**: All 12 posts start hidden, revealed on first plate hit (zero cost at game start)
- **Light culling**: Max 2 (mobile) / 3 (desktop) active PointLights via proximity check
- **Merged structure**: Pole + arm + housing merged into single BufferGeometry per post
- **6 pairs** (was 10) — fewer recycling posts for lower mesh count

### Shadow Optimization
- **Kart body-only shadows**: Only body + wheel meshes cast shadows (`_enableBodyShadows()`), not lights/chrome/particles/glass
- **Environment**: No environment objects cast shadows — only ground/road receive

### Per-Frame Optimizations
- **HUD**: DOM writes debounced — speed/tacho/time skip when values unchanged
- **Engine audio**: `updateEngine()` debounced by 25 RPM threshold
- **Plates**: Idle pulse every other frame
- **Background parallax**: Every-other-frame updates with 2x move compensation
- **Particle scale**: Direct `x*=, y*=, z*=` instead of `multiplyScalar()`

### Asset Loading
- **14 models preloaded** (was 55) — only actively-used models registered
- **GPU dispose on map switch**: `build()` traverses all themeObjects and calls `geometry.dispose()`, `material.dispose()`, `texture.dispose()`
- **Road**: Merged lane markings via `mergeGeometries`
- **Loading**: Kart.setDriver() + gameplay objects built during loading screen
- **Music**: Starts during loading screen (perceived faster load)

### Build Optimizations
- **USA buildings**: Shared window texture pool (3 base CanvasTextures with RepeatWrapping) instead of per-building unique textures
- **Warm-up**: renderer.compile + compositor renders + JIT dry runs + 300ms settle
- **Overlay**: `will-change: opacity` + `contain: strict`, 0.6s fast fade
- **Destiny optimization**: skipExhaust, no wheel rotation, all body materials same paint path
