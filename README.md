# Harvest Kart

A 3D browser-based kart racing game that demonstrates **piezoelectric energy harvesting**. Drive over glowing energy plates embedded in a highway to progressively power lamp posts and light up the road. Built with Three.js, playable directly in the browser.

**[Play Now](https://ictuillinois.github.io/Harvest-Kart/)**

## About

Harvest Kart is an educational racing game developed in association with the **Illinois Center for Transportation (ICT)**. It gamifies the concept of piezoelectric energy harvesting — a technology where vehicle pressure on specially designed road surfaces generates electricity to power highway infrastructure.

Players choose a driver and map, then race along a highway collecting energy plates. Every 10 plates fills a charge bar and powers a sector of lamp posts. Collect all 40 plates across 4 tiers to fully illuminate the highway.

## Features

### Gameplay
- **4 unique drivers** with distinct vehicles, physics, and visual styles
- **3 themed maps**: Brazil (coastal highway), USA (sunset city), Peru (Andean mountain pass)
- **5-gear transmission** with RPM simulation and dynamic engine sound
- **Turbo boost** on each tier-up — +10 MPH with fire particle effects
- **Continuous steering** — hold arrows to slide smoothly across lanes
- **Progressive difficulty** — plate spawn rate increases with each tier
- **Tier 3 urgency** — vibrating "HURRY UP!" overlay with red timer

### Drivers

| Driver | Vehicle | Style | Top Speed | Trait |
|--------|---------|-------|-----------|-------|
| **Ethan** | Sports GT (Sonata Pantera) | Dark luxury clearcoat | 92 MPH | The Balanced Pro — excellent coasting |
| **Kate** | Compact | Glossy candy pink | 84 MPH | The Quick Starter — fastest acceleration |
| **Destiny** | AMG GT | Race metallic blue | 100 MPH | The Speed Demon — highest top speed |
| **Luke** | Lamborghini SUV | Satin green | 100 MPH | The Raging Bull — raw power, low efficiency |

### Visuals
- **MeshPhysicalMaterial** with automotive clearcoat on all vehicles
- **Per-vehicle detail packages** — chrome trim, DRL strips, side markers, grille, diffuser
- **3 headlight/taillight styles** — sports (full-width LED bar), compact (round clusters), SUV (vertical bars)
- **Turbo flame effect** — 24-particle fire burst from exhaust with flickering glow
- **Dynamic sky system** — per-map gradient skies with cloud sprites and atmospheric effects
- **Parallax scenery** — 3-layer depth scrolling (foreground/midground/background)
- **Procedural audio** — synthesized V8 engine, gear shifts, turbo whoosh, plate collection sounds

### Technical
- **Three.js v0.183.2** — WebGL 3D rendering
- **Vite v8** — fast dev server and production bundling
- **Zero dependencies** beyond Three.js and Tween.js — no React, no backend
- **Responsive** — adapts to any screen size with `clamp()` CSS
- **Mobile optimized** — reduced pixel ratio, simplified post-processing, touch controls
- **Gamepad support** — any connected controller can trigger start

## How to Play

1. **Press any button** to start from the title screen
2. **Choose a driver** — each has unique speed, acceleration, and efficiency stats
3. **Select a map** — Brazil, USA, or Peru
4. **Drive!**
   - **Arrow keys / A/D** or **touch buttons** — steer left/right (hold to slide continuously)
   - **Arrow up / W / Space** or **GAS button** — accelerate
5. **Collect energy plates** — drive over the glowing blue panels on the road
6. **Fill 4 charge bars** (10 plates each) to power all lamp posts
7. **Turbo boost** activates on each tier-up — enjoy the speed burst!

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/ictuillinois/Harvest-Kart.git
cd Harvest-Kart
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build    # Output in dist/
npm run preview  # Preview the production build
```

### Deployment

GitHub Pages deployment is automatic on push to `main` via `.github/workflows/deploy.yml`. The workflow builds with `--base=/Harvest-Kart/` for correct subpath asset resolution.

## Project Structure

```
src/
  main.js              # Game orchestrator, loop, state management
  game/
    Kart.js            # Vehicle loading, materials, lighting, turbo flames
    Plate.js           # Energy plate pool, collision, animations
    Road.js            # Scrolling road segments with lane markings
    LampPost.js        # Progressive lighting system (5 tiers)
    Environment.js     # Sky, scenery, parallax layers per map
    GameState.js       # Observer-pattern state machine
    RaceStartSequence.js  # Countdown sequence
    CompletionSequence.js # End-game cinematic
  ui/
    StartScreen.js     # Title screen (universal input)
    DriverSelect.js    # Driver cards with 3D vehicle previews
    MapSelect.js       # Map selection with previews
    HUD.js             # Speedometer, tachometer, energy gauge, timer
    WinScreen.js       # Victory screen with stats
    RewardScreen.js    # Post-game town lighting reward
    IntroScreen.js     # EOH/ICT intro sequence
  utils/
    assetLoader.js     # GLTF + FBX loading, normalization, caching
    audio.js           # Procedural Web Audio (engine, effects, music)
    controls.js        # Touch, keyboard, gamepad input
    constants.js       # Game config, driver physics, road colors
    base.js            # Asset path resolution
    tweenGroup.js      # Shared Tween.js update group
    transition.js      # Fade in/out utilities
public/
  models/              # 3D assets (GLTF, GLB, FBX)
  characters/          # Driver portrait WebP images
  maps/                # Map preview WebP images
  music/               # Background music tracks (MP3)
  Al-Qadi.webp         # Reward screen character portrait
  Start_Screen.webp    # Title screen artwork
```

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| [Three.js](https://threejs.org/) v0.183.2 | 3D rendering (WebGL) |
| [Tween.js](https://github.com/tweenjs/tween.js) v25 | Smooth animations |
| [Vite](https://vitejs.dev/) v8 | Dev server + bundler |
| Web Audio API | Procedural engine sounds + effects |
| CSS `clamp()` | Responsive UI scaling |
| GitHub Pages | Hosting + CI/CD |

## 3D Asset Credits

- **KayKit City Builder** — CC0 (GLTF + texture atlas)
- **Kenney Car Kit** — CC0 (GLB + colormap)
- **Kenney Commercial/Suburban Buildings** — CC0 (GLB + colormap)
- **Poly Pizza** — CC0/CC-BY (GLB)
- **Player vehicle FBX models** — Custom

## License

Licensed by the Illinois Center for Transportation. © 2026 JJC Inc.
