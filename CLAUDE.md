# Harvest Kart — Project Guide

## What This Is
A 3D browser-based kart mini-game built with Three.js + Vite. Demonstrates piezoelectric energy harvesting: drive over glowing plates on a highway to charge lamp posts and power the city.

## Tech Stack
- **Three.js** v0.183.2 (WebGL renderer)
- **Vite** v8 (dev + build)
- **@tweenjs/tween.js** v25 (requires explicit `Group` — see tweenGroup.js)
- No React, no backend, pure frontend

## How to Run
```bash
npm run dev    # Vite dev server
npm run build  # Production build (uses --base=/Harvest-Kart/ for GitHub Pages)
```

## Architecture

### Directory Structure
```
src/
├── main.js              # Entry: renderer, camera, game loop, post-processing
├── game/
│   ├── Road.js           # 3-segment scrolling road with asphalt texture + UV scrolling
│   ├── Kart.js           # Player kart (primitives), 3 driver characters, exhaust particles
│   ├── Plate.js          # Piezoelectric plates (pool of 20), glow sprites, collision
│   ├── LampPost.js       # 4 lamp posts with dim→bright tween lighting
│   ├── Environment.js    # Sky, lighting, 3 theme builders, parallax depth layers
│   └── GameState.js      # State machine + scoring + combo system
├── ui/
│   ├── StartScreen.js    # Background image overlay
│   ├── DriverSelect.js   # 3 DiceBear avatar cards
│   ├── MapSelect.js      # 3 map cards with CSS mini-scenes
│   ├── HUD.js            # Charge bar, lamps, score, dashboard speedometer, pause
│   └── WinScreen.js      # Stats + high score (localStorage)
└── utils/
    ├── constants.js       # ALL game config (speeds, lanes, themes, model registry)
    ├── controls.js        # Keyboard + touch + swipe + GAS pedal (multi-touch)
    ├── audio.js           # Procedural Web Audio (master volume, haptic)
    ├── assetLoader.js     # GLTFLoader + cache + normalizeToHeight() + MODEL_REGISTRY
    ├── tweenGroup.js      # Shared tween.js Group (v25 requirement)
    └── base.js            # asset() helper for Vite BASE_URL path resolution
```

### Key Patterns

**Model Scale Normalization** (THE most important pattern):
- `normalizeToHeight(object3D, targetHeight)` in assetLoader.js
- Uses `Box3.setFromObject()` to measure actual bounds, scales to exact target
- `MODEL_HEIGHTS` registry maps every URL to world-space height
- `getModel(url)` auto-normalizes on clone — no scale parameter needed
- KayKit models are 0.1-3.0 internal units; Poly Pizza models can be 50-150 units (cm scale)

**Parallax Depth Layers**:
- `this.foreground[]` — 100% scroll speed (bushes, props near road)
- `this.midground[]` — 60% scroll speed (buildings, palms)
- `this.background[]` — 20% scroll speed (mountains)

**Post-Processing Pipeline**:
- EffectComposer → RenderPass → ColorGradePass → VignettePass
- Bloom removed (Preetham sky HDR blows it out at any threshold)
- AgX tone mapping (better than ACES for HDR sky handling)

**Tween.js v25 Gotcha**:
- `new Tween(obj)` alone creates orphan — must pass `tweenGroup`
- `new Tween(obj, tweenGroup).to({...}).start()`
- `tweenGroup.update()` called in game loop

## Game Flow
`menu` → `driverSelect` → `mapSelect` → `playing` ↔ `paused` → `complete`

## Three Map Themes
| Theme | Sky | Unique Elements |
|-------|-----|-----------------|
| Brazil | Golden hour sunset, turbidity 8 | Ocean (blue plane + wave vertices), sand, palm trees, city buildings |
| USA | Deep twilight, turbidity 12, stars | Dark tinted buildings, neon signs, moon, traffic cones, parked cars |
| Peru | Crisp mountain, turbidity 1.8 | Cone mountains with snow, green hills, llamas, stone walls, huts |

## 3D Assets
- **KayKit City Builder** (CC0): 8 buildings, bush, bench, cars, dumpster, etc. Internal scale ~0.1-3 units.
- **Poly Pizza** (CC0/CC-BY): palm tree, traffic cone, mailbox, trashcan, llama, flowers, hut, stone wall, tires, barrier. Internal scale VARIES WILDLY (0.5 to 150 units).
- **DiceBear Avataaars**: 3 driver SVG portraits (professor, kid, woman)
- **Flags**: Brazil/USA/Peru PNGs from flagcdn.com

## Known Issues / Tech Debt
- Poly Pizza beach props (chair, crab, seagull, lifeguard, sailboat, surfboard) removed — internal geometry 50-150 units, unusable even with normalization
- Water shader (three/addons/objects/Water.js) replaced with simple blue plane — the shader reflects sky too heavily at sunset
- No InstancedMesh yet (barriers + road dashes could save ~50 draw calls)
- Environment theme builders have code duplication (3 similar methods)
- No frustum culling on decorations

## Performance Notes
- ~120-140 draw calls per frame (acceptable for WebGL)
- Shadow map: 1024x1024, PCFSoft on desktop, PCF on mobile
- Mobile: no AA, pixelRatio capped at 1.5
- Models preloaded in parallel before start screen

## Roadmap (from 50-task plan, remaining items)
- [ ] Theme config objects to replace duplicated builders (task 26)
- [ ] InstancedMesh for barriers + road dashes (tasks 22-23)
- [ ] Kart headlights for USA night map (task 36)
- [ ] Loading progress bar during preload (task 38)
- [ ] Confetti on WinScreen (task 39)
- [ ] Engine hum sound mapped to speed (task 47)
- [ ] Ambient sounds per theme (task 48)
- [ ] Keyboard Tab navigation on all screens (task 49)

## Deployment
- GitHub Pages via `.github/workflows/deploy.yml`
- Builds with `--base=/Harvest-Kart/`
- All asset paths use `asset()` helper from `base.js`
