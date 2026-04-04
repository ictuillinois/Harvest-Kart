import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, MAP_THEMES } from '../utils/constants.js';
import { getModel, preloadAll, MODEL_URLS } from '../utils/assetLoader.js';
import { asset } from '../utils/base.js';

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    // Parallax depth layers — different scroll speeds
    this.foreground = [];  // 100% speed (bushes, props near road)
    this.midground = [];   // 60% speed (buildings, palms)
    this.background = [];  // 20% speed (mountains, distant objects)
    this.themeObjects = [];
    this.sky = null;
    this.sunDirection = new THREE.Vector3();
    this.ambientLight = null;
    this.dirLight = null;
    this.hemiLight = null;
    this.ground = null;
    this.starField = null;
    this.currentTheme = null;
    this.modelsReady = false;
    this.water = null;
  }

  /**
   * Preload all 3D models. Call once before first build().
   */
  async preload() {
    await preloadAll(Object.values(MODEL_URLS));
    this.modelsReady = true;
  }

  async build(themeIndex) {
    // --- Cleanup ---
    for (const obj of this.themeObjects) {
      this.scene.remove(obj);
    }
    this.themeObjects = [];
    this.foreground = [];
    this.midground = [];
    this.background = [];

    if (this.sky) this.scene.remove(this.sky);
    if (this.ambientLight) this.scene.remove(this.ambientLight);
    if (this.dirLight) this.scene.remove(this.dirLight);
    if (this.hemiLight) this.scene.remove(this.hemiLight);
    if (this.ground) this.scene.remove(this.ground);
    if (this.starField) { this.scene.remove(this.starField); this.starField = null; }
    if (this.water) { this.scene.remove(this.water); this.water = null; }

    const theme = MAP_THEMES[themeIndex] || MAP_THEMES[0];
    this.currentTheme = theme;

    // =================================================================
    //  SKY
    // =================================================================
    if (theme.id === 'brazil') {
      this._buildGradientSky();
      this.sunDirection.set(0.3, 0.8, -0.5).normalize();
      this.renderer.toneMappingExposure = 1.0;
    } else if (theme.id === 'usa') {
      this._buildNightSky();
      this.sunDirection.set(0.2, 0.6, -0.4).normalize();
      this.renderer.toneMappingExposure = 1.0;
    } else if (theme.id === 'peru') {
      this._buildMountainSky();
      this.sunDirection.set(0.3, 0.85, -0.3).normalize();
      this.renderer.toneMappingExposure = 1.0;
    } else {
      this.sky = new Sky();
      this.sky.scale.setScalar(10000);
      this.scene.add(this.sky);

      const skyUniforms = this.sky.material.uniforms;
      skyUniforms['turbidity'].value = theme.sky.turbidity;
      skyUniforms['rayleigh'].value = theme.sky.rayleigh;
      skyUniforms['mieCoefficient'].value = theme.sky.mieCoefficient;
      skyUniforms['mieDirectionalG'].value = theme.sky.mieDirectionalG;

      const phi = THREE.MathUtils.degToRad(90 - theme.sky.sunElevation);
      const theta = THREE.MathUtils.degToRad(theme.sky.sunAzimuth);
      this.sunDirection.setFromSphericalCoords(1, phi, theta);
      skyUniforms['sunPosition'].value.copy(this.sunDirection);

      skyUniforms['cloudCoverage'].value = theme.clouds.coverage;
      skyUniforms['cloudDensity'].value = theme.clouds.density;
      skyUniforms['cloudScale'].value = theme.clouds.scale;
      skyUniforms['cloudSpeed'].value = theme.clouds.speed;
      skyUniforms['cloudElevation'].value = theme.clouds.elevation;
      skyUniforms['time'].value = 0;

      this.renderer.toneMappingExposure = theme.sky.exposure;
    }

    // =================================================================
    //  FOG + LIGHTING + GROUND
    // =================================================================
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);

    this.ambientLight = new THREE.AmbientLight(theme.ambientColor, theme.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(theme.dirColor, theme.dirIntensity);
    this.dirLight.position.copy(this.sunDirection).multiplyScalar(100);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    const sh = theme.shadow || { far: 50, size: 15 };
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = sh.far;
    this.dirLight.shadow.camera.left = -sh.size;
    this.dirLight.shadow.camera.right = sh.size;
    this.dirLight.shadow.camera.top = sh.size;
    this.dirLight.shadow.camera.bottom = -sh.size;
    this.scene.add(this.dirLight);

    if (theme.id === 'brazil') {
      this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xffe4b5, 0.5);
      this.dirLight.position.set(10, 30, -20);
    } else if (theme.id === 'usa') {
      this.hemiLight = new THREE.HemisphereLight(0x0a0a2e, 0x2a2020, 0.35);
      this.dirLight.position.set(10, 25, -15);
    } else if (theme.id === 'peru') {
      this.hemiLight = new THREE.HemisphereLight(0x6699cc, 0x8b7355, 0.4);
      this.dirLight.position.set(15, 35, -10);
    } else {
      this.hemiLight = new THREE.HemisphereLight(theme.dirColor, theme.ground, 0.25);
    }
    this.scene.add(this.hemiLight);

    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshStandardMaterial({
      color: theme.ground,
      roughness: 1.0,
      metalness: 0,
      envMapIntensity: 0,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.1;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // =================================================================
    //  STARS (USA)
    // =================================================================
    if (theme.stars) this._buildStarField();

    // =================================================================
    //  BARRIERS
    // =================================================================
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.6 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const barrierGeo = new THREE.BoxGeometry(0.3, 0.8, ROAD_SEGMENT_LENGTH * 0.9);
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(side * (ROAD_WIDTH / 2 + 0.5), 0.4, -i * ROAD_SEGMENT_LENGTH * 0.9);
        this.scene.add(barrier);
        this.themeObjects.push(barrier);
        this.foreground.push(barrier);
      }
    }

    // =================================================================
    //  THEME DECORATIONS
    // =================================================================
    switch (theme.id) {
      case 'brazil': this._buildBrazil(); break;
      case 'usa': this._buildUSA(); break;
      case 'peru': this._buildPeru(); break;
    }
  }

  // --- Helper: place a loaded model into a depth layer ---
  // layer: 'fg' (foreground, 100% speed), 'mg' (midground, 60%), 'bg' (background, 20%)
  _placeModel(url, x, y, z, rotY = 0, sizeVariation = 1, layer = 'fg') {
    const model = getModel(url);
    model.position.set(x, y, z);
    if (sizeVariation !== 1) model.scale.multiplyScalar(sizeVariation);
    model.rotation.y = rotY;
    this.scene.add(model);
    this.themeObjects.push(model);
    if (layer === 'bg') this.background.push(model);
    else if (layer === 'mg') this.midground.push(model);
    else this.foreground.push(model);
    return model;
  }

  // --- Helper: place static model (doesn't scroll at all) ---
  _placeStatic(url, x, y, z, rotY = 0, sizeVariation = 1) {
    const model = getModel(url);
    model.position.set(x, y, z);
    if (sizeVariation !== 1) model.scale.multiplyScalar(sizeVariation);
    model.rotation.y = rotY;
    this.scene.add(model);
    this.themeObjects.push(model);
    return model;
  }

  // --- Helper: scatter props along both sides of road ---
  _scatterProps(propUrls, count, xRange, zSpacing, layer = 'fg') {
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const url = propUrls[Math.floor(Math.random() * propUrls.length)];
      const x = side * (ROAD_WIDTH / 2 + xRange[0] + Math.random() * (xRange[1] - xRange[0]));
      const z = -i * zSpacing - Math.random() * zSpacing * 0.5;
      const variation = 0.85 + Math.random() * 0.3;
      this._placeModel(url, x, 0, z, Math.random() * Math.PI * 2, variation, layer);
    }
  }

  // =====================================================================
  //  GRADIENT SKY (Brazil daytime — replaces Preetham)
  // =====================================================================
  _buildGradientSky() {
    const skyGeo = new THREE.SphereGeometry(500, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          // 5-stop gradient: zenith → upper → mid → lower → horizon
          vec3 zenith  = vec3(0.102, 0.541, 1.0);   // #1a8aff
          vec3 upper   = vec3(0.302, 0.651, 1.0);   // #4da6ff
          vec3 mid     = vec3(0.529, 0.808, 0.922);  // #87ceeb
          vec3 lower   = vec3(0.722, 0.863, 1.0);    // #b8dcff
          vec3 horizon = vec3(0.878, 0.941, 1.0);    // #e0f0ff
          vec3 col;
          if (h > 0.6) col = mix(upper, zenith, (h - 0.6) / 0.4);
          else if (h > 0.3) col = mix(mid, upper, (h - 0.3) / 0.3);
          else if (h > 0.1) col = mix(lower, mid, (h - 0.1) / 0.2);
          else if (h > 0.0) col = mix(horizon, lower, h / 0.1);
          else col = horizon;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // ── Cloud planes ──
    const cloudTex = this._makeCloudTexture();
    for (let i = 0; i < 7; i++) {
      const w = 30 + Math.random() * 40;
      const h = 8 + Math.random() * 12;
      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true, opacity: 0.55 + Math.random() * 0.25,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloudMat);
      cloud.position.set(
        -80 + Math.random() * 160,
        45 + Math.random() * 25,
        -100 - Math.random() * 200,
      );
      cloud.rotation.x = -0.1;
      cloud.lookAt(0, cloud.position.y, 0);
      this.scene.add(cloud);
      this.themeObjects.push(cloud);
      this.background.push(cloud);
    }
  }

  // =====================================================================
  //  NIGHT SKY (USA — dark gradient with light pollution + stars)
  // =====================================================================
  _buildNightSky() {
    const skyGeo = new THREE.SphereGeometry(500, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;

        // Simple pseudo-random for star placement
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;

          // 6-stop gradient: zenith → city glow at horizon
          vec3 zenith  = vec3(0.020, 0.020, 0.063);  // #050510
          vec3 upper   = vec3(0.039, 0.039, 0.145);  // #0a0a25
          vec3 mid     = vec3(0.059, 0.063, 0.208);  // #0f1035
          vec3 lower   = vec3(0.102, 0.082, 0.271);  // #1a1545
          vec3 horizon = vec3(0.165, 0.125, 0.314);  // #2a2050
          vec3 glow    = vec3(0.227, 0.145, 0.251);  // #3a2540

          vec3 col;
          if (h > 0.5) col = mix(upper, zenith, (h - 0.5) / 0.5);
          else if (h > 0.25) col = mix(mid, upper, (h - 0.25) / 0.25);
          else if (h > 0.1) col = mix(lower, mid, (h - 0.1) / 0.15);
          else if (h > 0.02) col = mix(horizon, lower, (h - 0.02) / 0.08);
          else if (h > -0.05) col = mix(glow, horizon, (h + 0.05) / 0.07);
          else col = glow;

          // Stars in upper sky (above light pollution)
          if (h > 0.15) {
            vec2 grid = floor(dir.xz * 200.0);
            float star = hash(grid);
            if (star > 0.992) {
              float brightness = 0.4 + 0.6 * hash(grid + 1.0);
              float size = smoothstep(0.994, 0.992, star);
              col += vec3(brightness * size * 0.7);
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // Moon
    const moonGroup = new THREE.Group();
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
    moonGroup.add(new THREE.Mesh(new THREE.SphereGeometry(6, 32, 32), moonMat));
    const moonGlowMat = new THREE.MeshBasicMaterial({
      color: 0x8888cc, transparent: true, opacity: 0.1, depthWrite: false,
    });
    moonGroup.add(new THREE.Mesh(new THREE.SphereGeometry(12, 32, 32), moonGlowMat));
    moonGroup.position.set(-50, 120, -250);
    this.scene.add(moonGroup);
    this.themeObjects.push(moonGroup);
  }

  // =====================================================================
  //  MOUNTAIN SKY (Peru — deep blue, dusty horizon haze)
  // =====================================================================
  _buildMountainSky() {
    const skyGeo = new THREE.SphereGeometry(500, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 zenith  = vec3(0.059, 0.145, 0.341);  // #0f2557 deep mountain blue
          vec3 upper   = vec3(0.165, 0.373, 0.667);  // #2a5faa vivid blue
          vec3 mid     = vec3(0.290, 0.565, 0.851);  // #4a90d9 bright clear
          vec3 lower   = vec3(0.557, 0.773, 0.941);  // #8ec5f0 pale blue
          vec3 horizon = vec3(0.831, 0.898, 0.941);  // #d4e5f0 mountain haze
          vec3 dust    = vec3(0.784, 0.749, 0.659);  // #c8bfa8 dusty tan

          vec3 col;
          if (h > 0.6) col = mix(upper, zenith, (h - 0.6) / 0.4);
          else if (h > 0.3) col = mix(mid, upper, (h - 0.3) / 0.3);
          else if (h > 0.12) col = mix(lower, mid, (h - 0.12) / 0.18);
          else if (h > 0.03) col = mix(horizon, lower, (h - 0.03) / 0.09);
          else if (h > -0.05) col = mix(dust, horizon, (h + 0.05) / 0.08);
          else col = dust;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // Wispy high-altitude clouds (few, thin, elongated)
    const cloudTex = this._makeCloudTexture();
    for (let i = 0; i < 4; i++) {
      const w = 50 + Math.random() * 60;
      const h = 5 + Math.random() * 6;
      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true, opacity: 0.4 + Math.random() * 0.2,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloudMat);
      cloud.position.set(
        -60 + Math.random() * 120,
        55 + Math.random() * 25,
        -80 - Math.random() * 250,
      );
      cloud.lookAt(0, cloud.position.y, 0);
      this.scene.add(cloud);
      this.themeObjects.push(cloud);
      this.background.push(cloud);
    }
  }

  /** Procedural soft cloud texture. */
  _makeCloudTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(0.65, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // =====================================================================
  //  STAR FIELD
  // =====================================================================
  _buildStarField() {
    const COUNT = 2500;
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const r = 400 + Math.random() * 100;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.5 + Math.random() * 2.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0xffffff) } },
      vertexShader: `
        attribute float size;
        uniform float time;
        varying float vBrightness;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          float phase = dot(position, vec3(12.9898, 78.233, 45.164));
          vBrightness = 0.5 + 0.5 * sin(time * (1.5 + fract(phase) * 2.0) + phase);
          gl_PointSize = size * vBrightness * (300.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vBrightness;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, d) * vBrightness;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.starField = new THREE.Points(geo, mat);
    this.scene.add(this.starField);
  }

  // =====================================================================
  //  BRAZIL — coastal highway with beach & ocean
  //  Layout: [City LEFT] | ROAD | [Sand + Beach RIGHT] [Ocean]
  // =====================================================================
  _buildBrazil() {
    // ══ REFERENCE ══
    // Road: 12 wide (x=-6..+6). Kart: 2w × 1.2h. Camera: y=5, z=8.
    // KayKit building internal: ~4w × 8h → scale 0.7 = 2.8w × 5.6h (good skyline)
    // Poly Pizza palm internal: ~3w × 8h → scale 0.5 = 1.5w × 4h (visible trees)
    // KayKit bush internal: ~2w × 1.5h   → scale 0.5 = 1w × 0.75h

    // Sun glow removed — the Sky shader's Preetham model already renders
    // the sun disc. MeshBasicMaterial glow spheres were blowing out the
    // bloom post-processing pass with pure white.

    // ── OCEAN — vibrant tropical blue, no reflections ──
    const oceanGeo = new THREE.PlaneGeometry(300, 600, 50, 50);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0099cc,
      emissive: 0x004466,
      emissiveIntensity: 0.15,
      roughness: 0.3,
      metalness: 0.0,
      envMapIntensity: 0,
      flatShading: false,
    });
    this.water = new THREE.Mesh(oceanGeo, oceanMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(ROAD_WIDTH / 2 + 10, -0.5, -100);
    this.water.userData.basePositions = oceanGeo.attributes.position.array.slice();
    this.scene.add(this.water);
    this.themeObjects.push(this.water);

    // ── SAND — warm matte beach strip, right side ──
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xf5deb3,
      roughness: 1.0,
      metalness: 0,
      envMapIntensity: 0,
    });
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(12, 600), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(ROAD_WIDTH / 2 + 3, -0.02, -150);
    sand.receiveShadow = true;
    this.scene.add(sand);
    this.themeObjects.push(sand);

    // ── FOAM LINE — animated white strip where sand meets ocean ──
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 600),
      new THREE.MeshBasicMaterial({ color: 0xeeffff, transparent: true, opacity: 0.5 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(ROAD_WIDTH / 2 + 9, 0.0, -150);
    this.scene.add(foam);
    this.themeObjects.push(foam);

    if (!this.modelsReady) return;

    // ══════════════════════════════════════════
    //  LEFT — Buildings (back) → Palms (mid) → Bushes (road edge)
    // ══════════════════════════════════════════

    // Buildings → midground (60% scroll speed — parallax depth)
    const bldgs = [MODEL_URLS.buildingA, MODEL_URLS.buildingB, MODEL_URLS.buildingC, MODEL_URLS.buildingD];
    for (let i = 0; i < 12; i++) {
      const url = bldgs[Math.floor(Math.random() * bldgs.length)];
      const x = -(ROAD_WIDTH / 2 + 6 + Math.random() * 8);
      this._placeModel(url, x, 0, -i * 25 - Math.random() * 10, Math.random() * Math.PI, 0.8 + Math.random() * 0.4, 'mg');
    }

    // Palms → midground
    for (let i = 0; i < 12; i++) {
      const x = -(ROAD_WIDTH / 2 + 1.5 + Math.random() * 3);
      this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 24 - Math.random() * 10, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.4, 'mg');
    }

    // Bushes → foreground (100% scroll — near road)
    for (let i = 0; i < 10; i++) {
      this._placeModel(MODEL_URLS.bush, -(ROAD_WIDTH / 2 + 0.8 + Math.random() * 1.5), 0, -i * 28 - Math.random() * 12, Math.random() * Math.PI * 2, 1, 'fg');
    }

    // ── RIGHT — Palms → Bushes → Sand → Ocean ──

    // Palms (between road and ocean) → foreground
    for (let i = 0; i < 15; i++) {
      const x = ROAD_WIDTH / 2 + 2 + Math.random() * 6;
      this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 20 - Math.random() * 10, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.3, 'fg');
    }

    // Bushes → foreground
    for (let i = 0; i < 10; i++) {
      this._placeModel(MODEL_URLS.bush, ROAD_WIDTH / 2 + 1.5 + Math.random() * 3, 0, -i * 28 - Math.random() * 12, Math.random() * Math.PI * 2, 1, 'fg');
    }

    // ── LEFT — additional palms (sparser, inland) ──
    for (let i = 0; i < 6; i++) {
      const x = -(ROAD_WIDTH / 2 + 4 + Math.random() * 6);
      this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 35 - Math.random() * 15, Math.random() * Math.PI * 2, 0.7 + Math.random() * 0.3, 'fg');
    }
  }

  // =====================================================================
  //  USA — night city
  // =====================================================================
  _buildUSA() {
    // Moon is now created in _buildNightSky()

    // Moonlight — wide fill for silhouette visibility
    const moonLight = new THREE.PointLight(0x6677aa, 0.5, 500);
    moonLight.position.set(-50, 120, -250);
    this.scene.add(moonLight);
    this.themeObjects.push(moonLight);

    // ── City glow plane at horizon (simulates distant light pollution) ──
    const glowGeo = new THREE.PlaneGeometry(400, 20);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x2a1530, transparent: true, opacity: 0.18, depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cityGlow = new THREE.Mesh(glowGeo, glowMat);
    cityGlow.position.set(0, 8, -350);
    this.scene.add(cityGlow);
    this.themeObjects.push(cityGlow);
    this.background.push(cityGlow);

    // ── Buildings with procedural window lights ──
    const usaBuildings = [MODEL_URLS.buildingE, MODEL_URLS.buildingF,
      MODEL_URLS.buildingG, MODEL_URLS.buildingH,
      MODEL_URLS.buildingC, MODEL_URLS.buildingD];
    const windowColors = [0xffcc66, 0xffffff, 0xaaccff, 0xffaa44];

    if (this.modelsReady) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 12; i++) {
          const url = usaBuildings[Math.floor(Math.random() * usaBuildings.length)];
          const x = side * (ROAD_WIDTH / 2 + 8 + Math.random() * 10);
          const z = -i * 25 - Math.random() * 10;
          const heightScale = 0.8 + Math.random() * 0.6;
          const model = this._placeModel(url, x, 0, z, side > 0 ? Math.PI : 0, heightScale, 'mg');

          // Darken building base material, add subtle emissive
          model.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
              child.material.color.multiplyScalar(0.5);
              child.material.roughness = 0.8;
              child.material.metalness = 0;
              child.material.envMapIntensity = 0;
            }
          });

          // ── Procedural window lights on road-facing side ──
          const buildingHeight = heightScale * 6;
          const windowRowSpacing = 1.0;
          const windowColSpacing = 0.7;
          const rows = Math.floor(buildingHeight / windowRowSpacing);
          const cols = 3 + Math.floor(Math.random() * 4);
          // Place windows on the face pointing toward the road
          const faceOffset = side > 0 ? -1.2 : 1.2;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (Math.random() < 0.30) continue; // some windows dark
              const wc = windowColors[Math.floor(Math.random() * windowColors.length)];
              const winGeo = new THREE.PlaneGeometry(0.45, 0.55);
              const winMat = new THREE.MeshBasicMaterial({ color: wc, side: THREE.DoubleSide });
              const win = new THREE.Mesh(winGeo, winMat);
              win.position.set(
                x + faceOffset,
                1.2 + r * windowRowSpacing,
                z + (c - cols / 2) * windowColSpacing,
              );
              this.scene.add(win);
              this.themeObjects.push(win);
              this.midground.push(win);
            }
          }
        }
      }

      // Roadside props → foreground
      this._scatterProps(
        [MODEL_URLS.dumpster, MODEL_URLS.trafficLight, MODEL_URLS.bench,
         MODEL_URLS.firehydrant, MODEL_URLS.trashcan, MODEL_URLS.mailbox],
        12, [2, 5], 28, 'fg'
      );
      this._scatterProps([MODEL_URLS.trafficCone], 8, [1.5, 2.5], 35, 'fg');
      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 4, [2.5, 5], 65, 'fg');
      this._scatterProps([MODEL_URLS.carSedan, MODEL_URLS.carTaxi, MODEL_URLS.carHatchback], 6, [2, 4], 50, 'fg');
    }

    // ── Neon signs with colored light pools ──
    const neonColors = [0xff00ff, 0x00ffff, 0xff4444, 0x44ff44, 0xff6600];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const nColor = neonColors[Math.floor(Math.random() * neonColors.length)];
      const nGeo = new THREE.BoxGeometry(2.5, 0.6, 0.1);
      const nMat = new THREE.MeshBasicMaterial({ color: nColor });
      const neon = new THREE.Mesh(nGeo, nMat);
      neon.position.set(side * (ROAD_WIDTH / 2 + 6), 3 + Math.random() * 2, -i * 40 - 15);
      this.scene.add(neon);
      this.themeObjects.push(neon);
      this.midground.push(neon);

      // Colored light pool
      const nLight = new THREE.PointLight(nColor, 0.25, 10);
      nLight.position.copy(neon.position);
      this.scene.add(nLight);
      this.themeObjects.push(nLight);
      this.midground.push(nLight);
    }
  }

  // =====================================================================
  //  PERU — mountains & valleys
  // =====================================================================
  _buildPeru() {
    const RH = ROAD_WIDTH / 2; // road half-width (6)

    // ══════════════════════════════════════════
    //  MOUNTAINS (background, 20% scroll)
    // ══════════════════════════════════════════
    const mtColors = [0x7a8a6a, 0x6a7a5a, 0x8a8a7a, 0x5a7a4a, 0x6a8a5a];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const radius = 12 + Math.random() * 15;
        const height = 30 + Math.random() * 40;
        const color = mtColors[Math.floor(Math.random() * mtColors.length)];
        const mt = new THREE.Mesh(
          new THREE.ConeGeometry(radius, height, 5 + Math.floor(Math.random() * 3)),
          new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
        );
        mt.position.set(
          side * (RH + 40 + Math.random() * 25),
          height / 2 - 4,
          -i * 60 - Math.random() * 20,
        );
        this.scene.add(mt);
        this.themeObjects.push(mt);
        this.background.push(mt);

        // Snow cap (on most mountains — iconic Andes look)
        if (height > 30 || Math.random() > 0.3) {
          const snow = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 0.28, height * 0.15, 5),
            new THREE.MeshStandardMaterial({
              color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5,
            }),
          );
          snow.position.y = height * 0.43;
          mt.add(snow);
        }
      }
    }

    // ══════════════════════════════════════════
    //  ROLLING HILLS (midground, 60% scroll)
    // ══════════════════════════════════════════
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const r = 4 + Math.random() * 4;
        const hill = new THREE.Mesh(
          new THREE.SphereGeometry(r, 10, 6),
          new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 0.9 }),
        );
        hill.scale.y = 0.3;
        hill.position.set(
          side * (RH + 15 + Math.random() * 12), -1.5,
          -i * 50 - Math.random() * 20,
        );
        this.scene.add(hill);
        this.themeObjects.push(hill);
        this.midground.push(hill);
      }
    }

    // ══════════════════════════════════════════
    //  ICHU GRASS CLUMPS (foreground, both sides)
    // ══════════════════════════════════════════
    const ichuColors = [0x9aaa3a, 0x8a9a2a, 0x7a8a1a, 0xaaaa4a];
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const clump = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 + Math.random() * 0.25, 4, 3),
        new THREE.MeshStandardMaterial({
          color: ichuColors[Math.floor(Math.random() * ichuColors.length)],
          roughness: 0.9,
        }),
      );
      clump.scale.y = 0.5;
      clump.position.set(
        side * (RH + 3 + Math.random() * 15), 0,
        -i * 10 - Math.random() * 5,
      );
      this.scene.add(clump);
      this.themeObjects.push(clump);
      this.foreground.push(clump);
    }

    // ══════════════════════════════════════════
    //  ROCKS / BOULDERS (foreground, near road)
    // ══════════════════════════════════════════
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 1.0 });
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const s = 0.3 + Math.random() * 0.6;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(s, 0),
        rockMat,
      );
      rock.position.set(
        side * (RH + 3 + Math.random() * 8), s * 0.4,
        -i * 25 - Math.random() * 10,
      );
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      this.scene.add(rock);
      this.themeObjects.push(rock);
      this.foreground.push(rock);
    }

    // ══════════════════════════════════════════
    //  PROCEDURAL TREES (foreground)
    // ══════════════════════════════════════════
    const foliageColors = [0x2d5a1e, 0x3a6a2a, 0x4a8a3a];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const treeGroup = new THREE.Group();
        const trunkH = 1.5 + Math.random() * 1.2;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6), trunkMat);
        trunk.position.y = trunkH / 2;
        treeGroup.add(trunk);

        const fMat = new THREE.MeshStandardMaterial({
          color: foliageColors[Math.floor(Math.random() * foliageColors.length)], roughness: 0.8,
        });
        for (let f = 0; f < 2; f++) {
          const foliage = new THREE.Mesh(
            new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 6, 5), fMat);
          foliage.position.set(
            (Math.random() - 0.5) * 0.3, trunkH + 0.3 + f * 0.25,
            (Math.random() - 0.5) * 0.3);
          treeGroup.add(foliage);
        }
        treeGroup.position.set(
          side * (RH + 5 + Math.random() * 7), 0,
          -i * 35 - Math.random() * 15,
        );
        this.scene.add(treeGroup);
        this.themeObjects.push(treeGroup);
        this.foreground.push(treeGroup);
      }
    }

    // ══════════════════════════════════════════
    //  LOADED MODELS
    // ══════════════════════════════════════════
    if (this.modelsReady) {
      this._scatterProps([MODEL_URLS.bush], 8, [4, 9], 30, 'fg');
      this._scatterProps([MODEL_URLS.flowers], 6, [5, 12], 38, 'fg');
      this._scatterProps([MODEL_URLS.stoneWall], 5, [5, 10], 55, 'fg');

      // Andean huts → midground
      for (let i = 0; i < 3; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        this._placeModel(MODEL_URLS.hut,
          side * (RH + 14 + Math.random() * 6), 0,
          -i * 90 - 40, Math.random() * Math.PI * 2, 1, 'mg');
      }

      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 4, [2, 4], 70, 'fg');
    }

    // ══════════════════════════════════════════
    //  INCA TERRACES (midground)
    // ══════════════════════════════════════════
    const terrColors = [0x7a6b4f, 0x8a9a4a, 0x6a8a3a, 0x5a7a2a];
    for (let i = 0; i < 3; i++) {
      const terrGroup = new THREE.Group();
      for (let level = 0; level < 5; level++) {
        const w = 5 - level * 0.8;
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(w, 0.7, w + 2),
          new THREE.MeshStandardMaterial({
            color: terrColors[Math.min(level, terrColors.length - 1)], roughness: 0.9,
          }),
        );
        step.position.y = level * 0.7;
        terrGroup.add(step);
      }
      const side = i % 2 === 0 ? -1 : 1;
      terrGroup.position.set(
        side * (RH + 18 + Math.random() * 8), 0,
        -i * 110 - 50,
      );
      this.scene.add(terrGroup);
      this.themeObjects.push(terrGroup);
      this.midground.push(terrGroup);
    }
  }

  // =====================================================================
  //  UPDATE
  // =====================================================================
  update(delta, speed) {
    if (this.sky && this.sky.material.uniforms['time']) this.sky.material.uniforms['time'].value += delta;
    if (this.starField) this.starField.material.uniforms.time.value += delta;
    // Animate ocean waves (vertex displacement)
    if (this.water && this.water.userData.basePositions) {
      const pos = this.water.geometry.attributes.position;
      const base = this.water.userData.basePositions;
      const time = performance.now() * 0.001;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        // Gentle sine wave on Z axis (which is Y in world after rotation)
        pos.array[i * 3 + 2] = base[i * 3 + 2] + Math.sin(time * 1.5 + bx * 0.3 + by * 0.2) * 0.15;
      }
      pos.needsUpdate = true;
    }

    const move = speed * delta;

    // Parallax: 3 layers at different scroll speeds
    const layers = [
      [this.foreground, 1.0],   // 100% — bushes, props near road
      [this.midground, 0.6],    // 60%  — buildings, palms
      [this.background, 0.2],   // 20%  — mountains, distant
    ];

    for (const [layer, factor] of layers) {
      const layerMove = move * factor;
      for (const obj of layer) {
        obj.position.z += layerMove;
        if (obj.position.z > 60) {
          obj.position.z -= 400;
        }
      }
    }
  }
}
