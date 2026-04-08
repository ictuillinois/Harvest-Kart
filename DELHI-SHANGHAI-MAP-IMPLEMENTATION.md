# Delhi & Shanghai Map Implementation Guide

## Overview

Two new maps were added to the Harvest-Kart racing game: **Delhi (India)** and **Shanghai (China)**. Both follow the same architecture as existing maps (Brazil, USA, Peru) — each has a custom sky, lighting, environment scenery, road color, procedural music, and map selection card.

**Map Select Layout:** 3 maps on top row (Peru, USA, Brazil), 2 maps centered on bottom row (Shanghai, Delhi). Keyboard/gamepad supports up/down navigation between rows.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/utils/constants.js` | Added `delhi` and `shanghai` entries to `ROAD_SURFACE_COLORS` and `MAP_THEMES` |
| `src/ui/MapSelect.js` | Added Delhi/Shanghai to `DISPLAY_ORDER`, `MAP_IMAGES`, `MAP_ICONS`, `accents`. Updated CSS for 3+2 row wrap layout. Added ArrowUp/ArrowDown keyboard and gamepad D-pad navigation between rows |
| `src/game/Environment.js` | Added `_buildDelhiSky()`, `_buildDelhi()`, haveli texture system (`_delhiHaveliTex`, `_buildHaveliTexPool`, `_createHaveli`). Rebuilt `_buildShanghai()` with Chinese rooftop buildings, Bund-style textures (`_shanghaiWindowTex`, `_buildShanghaiTexPool`, `_createShanghaiBuilding`), food stalls, hoardings. Updated `_buildShanghaiSky()` to early morning gradient |
| `src/main.js` | Added `delhi` and `shanghai` to `THEME_VEHICLE_LIGHT` and `MAP_MUSIC_KEYS` |
| `src/utils/audio.js` | Added procedural Punjabi bhangra music for Delhi and Chinese pentatonic music for Shanghai via Web Audio API buffer generation |

## New Files Added

| File | Purpose |
|------|---------|
| `public/maps/delhi.webp` | Map selection card image for Delhi (converted from PNG) |
| `public/maps/shanghai.webp` | Map selection card image for Shanghai (converted from PNG) |
| `public/flags/india.png` | India tricolor flag (saffron/white/green, generated via sharp) |
| `public/flags/china.png` | China flag |
| `DELHI-SHANGHAI-MAP-IMPLEMENTATION.md` | This documentation file |

---

## Delhi (India) Map

### Time of Day: Warm Dusk

- **Sky**: Custom shader gradient — deep indigo zenith → purple-blue → dusky mauve → warm saffron → golden-orange horizon
- **Sun**: Very low (elevation 6°, azimuth 210°), warm amber directional light
- **Fog**: `0xbb8866` warm dusty haze
- **Road**: `0x9a9a9e` warm gray dusty highway
- **Exposure**: 1.0 (dim dusk atmosphere)

### Environment Layout

```
LEFT SIDE                      ROAD                      RIGHT SIDE
───────────────────────────────────────────────────────────────────
Colorful havelis (midground)   │ Warm gray asphalt │ Blue lake (Y=0.0)
 - 6 vivid Rajasthani colors   │ Grass strip (left) │ Lotus Temple (Z=-80)
 - Arched windows, balconies   │ Street lamps (left)│ Qutub Minar (Z=-180)
 - Gold roofline trim          │ Banyan trees       │ Red Fort (Z=-280)
 - Bright shopfront awnings    │ Market signs       │ 5 boats
3 temple gopurams              │ Cheering crowd     │ Park strip:
2 Mughal archway gates         │  with Indian flags │  benches, chai stalls
Distant buildings (background) │ Props              │  dhabas, trees, railing
```

### Haveli Building System

- `_delhiHaveliTex()`: Canvas-rendered procedural texture with arched windows, balcony rails, floor bands, bright shopfront awnings, gold roofline trim
- `_buildHaveliTexPool()`: 6 shared base textures — bright terracotta, marigold yellow, Jaipur pink, Jodhpur teal, deep red, lime green
- `_createHaveli()`: Returns textured box with `MeshBasicMaterial` (no lighting cost)
- Buildings placed on LEFT side only — right side is open lake

### Landmarks on Lake (RIGHT side, background parallax layer)

1. **Lotus Temple** (Z=-80): 9 cone petals (outer + inner rings), circular platform with blue pool ring, central spire
2. **Qutub Minar** (Z=-180): 5-tier tapered tower alternating red/sandstone, marble balcony rings, Alai Darwaza gate with dome
3. **Red Fort** (Z=-280): Red sandstone wall with crenellations, 2 corner towers with domed caps, central Lahori Gate with arch and dome

### Park Strip (RIGHT foreground)

- Green grass strip, 6 sitting benches, 3 chai stalls (named: CHAI, LASSI, SAMOSA), 3 dhaba/eater joints with colored roofs and stools, 5 park trees, low metal railing, 5 boats on lake

### Cheering Crowd

- 10 people with varied skin tones and colorful shirts
- Raised waving arms; every other person holds tricolor Indian flag (saffron/white/green stripes)
- Placed along both sides of the road

### Music — Punjabi Bhangra (Procedural, 140 BPM, ~5s loop)

Generated in `_generateDelhiBuffer()` using Web Audio API AudioBuffer:

| Layer | Description |
|-------|-------------|
| Dhol (bass) | Heavy "dha-ghe" bounce with sub rumble, fast fills at beats 10-11 |
| Dhol (treble) | Sharp "ke/na" stick cracks filling gaps |
| Tumbi | Iconic one-string twang (D5-C5-A4-E5 riff) with nasal harmonics |
| Chimta | Fire tongs jingle on upbeats, extra hits during fills |
| 808 Bass | Deep electronic sub on root notes (D2/C2/E2) |
| Claps | Beats 2,4,6,8,10 for crowd energy |
| Hi-hat | 16th notes for racing drive |
| Synth horn stab | Bhangra brass chord on beats 0,4,8 |
| Algoza | Short double-flute ornaments between tumbi phrases |

---

## Shanghai (China) Map

### Time of Day: Early Morning

- **Sky**: Custom shader gradient — crisp morning blue zenith → light blue → pale sky → warm peach-pink → golden sunrise glow horizon
- **Sun**: Rising from east (elevation 20°, azimuth 90°), warm sunrise yellow light
- **Fog**: `0xaabbcc` cool morning mist
- **Road**: `0x2a2a2e` black sleek asphalt
- **Exposure**: 1.3 (bright morning)
- **Brightness boost**: +8% via color grade

### Environment Layout

```
LEFT SIDE                      ROAD                      RIGHT SIDE
───────────────────────────────────────────────────────────────────
Bund-style buildings           │ Black asphalt      │ Bund-style buildings
 - Chinese curved rooftops     │ Sidewalk strips    │  - Chinese curved rooftops
 - 5 colonial palette colors   │ Street lamps both  │  - Warm lit windows
 - Eave overhangs + gold tips  │ Trees both sides   │
3 pagodas (6/4/5 tiers)       │ Red lanterns       │ Chinese food stalls (5)
2 Chinese paifang gates        │ Props              │
6 Chinese hoardings            │                    │
Distant buildings (bg)         │                    │ Distant buildings (bg)
                          FAR BACKGROUND:
                    Oriental Pearl Tower (Z=-150)
                    Shanghai Tower (Z=-280)
                    SWFC (Z=-300)
                    Jin Mao Tower (Z=-350)
                    12 skyline buildings both sides
```

### Building System with Chinese Rooftops

- `_shanghaiWindowTex()`: Canvas-rendered procedural texture with horizontal floor lines, warm lit windows, colored shopfront awnings, white cornice
- `_buildShanghaiTexPool()`: 5 shared textures — warm brick, cream stone, gray concrete, terracotta, muted
- `_createShanghaiBuilding()`: Returns a **Group** (not just a mesh) containing:
  1. Textured building body (MeshBasicMaterial)
  2. Dark tiled Chinese curved roof (4-sided ConeGeometry, wider than building)
  3. Dark eave overhang (flat BoxGeometry rim)
  4. Gold ridge ornament on ~60% of buildings

### Chinese Hoardings

6 canvas-rendered signs with gold borders:
- 上海 (Shanghai), 火锅 (hotpot), 奶茶 (milk tea), 小笼包 (soup dumplings), 饺子 (dumplings), 福 (fortune)
- Red/orange/blue/green backgrounds, mounted on poles above buildings

### Chinese Street Food Stalls

5 stalls on both sides with:
- Wooden cart body + counter shelf
- Mini Chinese curved roof canopy (dark tiles on colored base)
- Chinese text signs: 包子 (baozi), 烧烤 (BBQ), 奶茶 (milk tea), 炒面 (fried noodles), 饺子 (dumplings)
- Metal stool + steam pot on counter

### Red Lanterns

6 red spheres (elongated Y scale) hanging from lamp posts — classic Chinese street decoration

### Pudong Skyline (far background)

- Oriental Pearl Tower: shaft + 2 pink spheres + spire
- Shanghai Tower: 60-unit tapered cylinder, metallic blue
- SWFC: 50-unit tall box, dark steel
- Jin Mao Tower: 40-unit box, light steel
- 12 distant skyline buildings on both sides

### Music — Chinese Pentatonic (Procedural, 138 BPM, ~5s loop)

Generated in `_generateShanghaiBuffer()`:

| Layer | Description |
|-------|-------------|
| Guzheng | Fast pentatonic arpeggios (C-D-E-G-A) with metallic pluck and sympathetic ring |
| Erhu | Nasal singing melody (saw wave) with vibrato, call & response phrases |
| Gong | Deep hit on beat 0 (loop start marker) |
| Woodblock | Rhythmic clicks every beat + upbeat |
| Kick | Punchy electronic pattern |
| 808 Bass | Pentatonic root notes (C-D-G-A) |
| Hi-hat | 16th notes for drive |
| Claps | Beats 2, 6, 10 |
| Cymbals | Beats 4 and 8 |

---

## How to Add a New Map (Template)

1. **Image**: Convert preview to WebP in `public/maps/`, add flag PNG to `public/flags/`
2. **constants.js**: Add entry to `ROAD_SURFACE_COLORS` and `MAP_THEMES` array
3. **MapSelect.js**: Add theme index to `DISPLAY_ORDER`, add entries to `MAP_IMAGES`, `MAP_ICONS`, `accents`
4. **Environment.js**:
   - Add sky builder method (`_build[Name]Sky()`) — custom ShaderMaterial gradient on BackSide sphere
   - Add environment builder method (`_build[Name]()`) — scenery, landmarks, props
   - Add cases in `build()` for sky/lighting/hemilight/theme switch
   - Add billboard style in `_buildBillboards` styles object
5. **main.js**: Add to `THEME_VEHICLE_LIGHT` and `MAP_MUSIC_KEYS`
6. **audio.js**: Add music (MP3 file path or `null` for procedural + generator function)

### Procedural Music Template

```js
// In audio.js MUSIC_TRACKS:
mymap: null,  // procedural

// In playMusic():
if (key === 'mymap') { _playMymapMusic(); return; }

// Generator: create AudioBuffer, write samples via oscillators, normalize, loop
```

---

## Performance Notes

- Building textures use shared `CanvasTexture` pools (6 for Delhi, 5 for Shanghai) with `RepeatWrapping` — no per-building unique textures
- Buildings use `MeshBasicMaterial` (zero lighting cost)
- Landmarks use `MeshStandardMaterial` only where shading matters
- All background objects in `background` parallax layer (20% scroll speed, every-other-frame updates)
- Procedural music generated once into an AudioBuffer and looped — no ongoing CPU cost during gameplay
- Canvas textures for signs/hoardings generated once at build time
