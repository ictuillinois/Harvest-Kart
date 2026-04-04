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

5-gear transmission: `GEAR_THRESHOLDS = [0, 12, 28, 50, 75, 100]`. Gear-aware acceleration (`GEAR_ACCEL = [20, 16, 12, 8, 5]` MPH/sec). Auto-shift with 200ms pause, haptic feedback, tachometer flash.

RPM simulation: `RPM_IDLE = 1000`, `RPM_REDLINE = 8000`. RPM = linear interpolation within current gear's speed band. Sawtooth pattern on upshift (RPM drops from near-redline to low-band).

Starting speed after "GO!": 40 MPH (gear 2). Coast floor: 25 MPH.

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

### Vehicle Lighting & Visibility

Kart body has emissive self-glow (intensity 0.15). Vehicle lighting rig in `_buildCar()`: overhead fill, rear chase-cam fill, low side fill, colored underglow, taillight PointLights. Edge highlights: white bottom strip, colored side strips (MeshBasicMaterial, always visible), ground contact ring.

Per-theme SpotLight headlights + PointLight backfill added via `addKartLights(themeId)` in main.js. `THEME_VEHICLE_LIGHT` config scales intensities per map.

Road surface: MeshStandardMaterial, visible gray asphalt (`0x3a3a42` to `0x4a4a50`), roughness 0.6.

### Parallax Depth Layers

Environment decorations scroll at 3 speeds:
- `this.foreground[]` — 100% (barriers, bushes, props near road)
- `this.midground[]` — 60% (buildings, palms, hills)
- `this.background[]` — 20% (mountains, clouds)

### Sky System

Each map uses a custom gradient sky (ShaderMaterial on inverted sphere). Brazil = daytime blue gradient with cloud sprites. USA = night gradient with stars + city light pollution glow. Peru = deep mountain blue with dusty horizon haze.

### Lamp Post Progressive Lighting

20 recycling lamp posts (10 pairs, both sides of road). 5-tier brightness system (tier 0-4) with color progression (brown → amber → gold → warm white). `AMBIENT_MULTIPLIERS` exported from LampPost.js for scene ambient scaling.

### Race Start Sequence

`RaceStartSequence.js` — Black overlay fade → horizontal traffic light bar (red→orange→amber→green) + 3-2-1-GO countdown → controls unlock. Controls visible (locked) during countdown, HUD at 0.5 opacity. Map transitions use fade-to-black loading overlay to mask synchronous `environment.build()`.

### Engine Sound (Web Audio API)

V8 engine: 4 layered oscillators (45Hz fundamental, harmonics at 2×/3×/4×), waveshaper distortion, lowpass filter (250-2800Hz), idle-lope LFO. `updateEngine(rpm)` takes RPM (1000-8000), normalizes internally. Smoothing 40ms. Frequency range 1×→3.8×.

`playGearShift(isUpshift, gear)`: Upshift = engine dip + mechanical clunk + turbo whoosh + engagement thump (all gear-scaled). Downshift = rev-match blip + filter spike + exhaust crackle pops.

### Controls

`controls.js` — Glassmorphism arrow buttons + radial-gradient gas pedal. Pointer Events API + keyboard fallback + swipe fallback. `lock()`/`unlock()` gate `isPedalDown()` and lane switches. 220ms cooldown on lane switches.

### Intro Sequence

`IntroScreen.js` — Two-phase: Phase 1 (EOH logo + "Forging the Future" + dates) → Phase 2 ("In Association with" + ICT logo + "PRESENTS"). 12.4s total, then start screen revealed.

## Architecture

`src/main.js` — Orchestrator: renderer, scene, camera, game objects, UI screens, event wiring, game loop. Gear/RPM state, per-theme kart lights, loading overlay for map transitions.

`Environment.js` — Sky, lighting, ground, barriers, theme decorations. Per-theme road colors, hemisphere light overrides.

`GameState.js` — Observer pattern state machine. `speed` property is MPH (0-100).

`Kart.js` — Vehicle constructor with 4 body types. Emissive body materials, vehicle lighting rig, edge highlights, ground ring. `_underglow` PointLight colored to driver.

`LampPost.js` — 20 recycling posts, tier system, micro-progression, flash effects.

`audio.js` — Procedural Web Audio: RPM-based V8 engine, gear shift sounds (layered), countdown tones/revs, plate hit, lamp lit, combo break, lane switch, win fanfare. Background music via HTML Audio.

`HUD.js` — AAA-quality DOM HUD: SVG speedometer + tachometer dials, segmented energy gauge, glassmorphism minimap, Orbitron font throughout.

## 3D Assets

All in `public/models/`. KayKit City Builder (CC0, GLTF+texture atlas), Poly Pizza models (CC0/CC-BY, GLB). Character portraits in `public/characters/` (WebP). Map previews in `public/maps/` (WebP). EOH logo in `public/eoh.svg`.

## Known Issues

- Environment theme builders have duplicated code (3 similar methods)
- No InstancedMesh (barriers + road dashes could save draw calls)
- USA map builds ~3000 window meshes synchronously (causes brief freeze, masked by loading overlay)
- Vehicles built from primitives (no loaded GLTF models)

## Remaining Roadmap

- Theme config objects to DRY the 3 builders
- InstancedMesh for barriers + road dashes
- Loading progress bar during model preload
- Ambient sounds per theme (ocean waves, city hum, wind)
- Mute toggle button in HUD
