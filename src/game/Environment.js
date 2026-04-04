import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, MAP_THEMES, ROAD_SURFACE_COLORS } from '../utils/constants.js';
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
      this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xffe4b5, 0.7);
      this.dirLight.position.set(10, 30, -20);
    } else if (theme.id === 'usa') {
      this.hemiLight = new THREE.HemisphereLight(0x334466, 0x332222, 0.5);
      this.dirLight.position.set(10, 25, -15);
    } else if (theme.id === 'peru') {
      this.hemiLight = new THREE.HemisphereLight(0x6699cc, 0x8b7355, 0.6);
      this.dirLight.position.set(15, 35, -10);
    } else {
      this.hemiLight = new THREE.HemisphereLight(theme.dirColor, theme.ground, 0.5);
    }
    this.scene.add(this.hemiLight);

    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshStandardMaterial({
      color: ROAD_SURFACE_COLORS[theme.id] || 0x707078,
      roughness: 0.6,
      metalness: 0.02,
      envMapIntensity: 0.4,
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
  //  Layout: [City/Favela LEFT] | ROAD | [Sand + Beach RIGHT] [Ocean]
  // =====================================================================
  _buildBrazil() {
    const RH = ROAD_WIDTH / 2;

    // ── OCEAN — vibrant tropical blue ──
    const oceanGeo = new THREE.PlaneGeometry(300, 600, 20, 20);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0099cc, emissive: 0x004466, emissiveIntensity: 0.15,
      roughness: 0.3, metalness: 0.0, envMapIntensity: 0,
    });
    this.water = new THREE.Mesh(oceanGeo, oceanMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(RH + 10, -0.5, -100);
    this.water.userData.basePositions = oceanGeo.attributes.position.array.slice();
    this.scene.add(this.water);
    this.themeObjects.push(this.water);

    // ── SAND — warm beach strip ──
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 600),
      new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: 1.0, metalness: 0 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(RH + 3, -0.02, -150);
    sand.receiveShadow = true;
    this.scene.add(sand);
    this.themeObjects.push(sand);

    // ── FOAM LINE ──
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 600),
      new THREE.MeshBasicMaterial({ color: 0xeeffff, transparent: true, opacity: 0.5 }),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(RH + 9, 0.0, -150);
    this.scene.add(foam);
    this.themeObjects.push(foam);

    // ── LEFT HILLSIDE GROUND — green slope for favela ──
    const hillGround = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 600),
      new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 0.9 }),
    );
    hillGround.rotation.x = -Math.PI / 2;
    hillGround.position.set(-(RH + 30), -0.05, -150);
    this.scene.add(hillGround);
    this.themeObjects.push(hillGround);

    // ── SUGARLOAF MOUNTAIN — procedural landmark (right, behind ocean) ──
    const sugarloaf = new THREE.Mesh(
      new THREE.ConeGeometry(18, 35, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.85, flatShading: true }),
    );
    sugarloaf.position.set(RH + 80, 12, -280);
    this.scene.add(sugarloaf);
    this.themeObjects.push(sugarloaf);
    this.background.push(sugarloaf);

    // Second peak
    const sugarloaf2 = new THREE.Mesh(
      new THREE.ConeGeometry(12, 25, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a7a4a, roughness: 0.85, flatShading: true }),
    );
    sugarloaf2.position.set(RH + 60, 8, -250);
    this.scene.add(sugarloaf2);
    this.themeObjects.push(sugarloaf2);
    this.background.push(sugarloaf2);

    // ── CHRIST THE REDEEMER — silhouette on far left hill ──
    const christGroup = new THREE.Group();
    const statueMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee, emissive: 0xcccccc, emissiveIntensity: 0.2, roughness: 0.5,
    });
    // Body
    christGroup.add((() => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1), statueMat);
      body.position.y = 3;
      return body;
    })());
    // Arms (outstretched)
    christGroup.add((() => {
      const arms = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 0.8), statueMat);
      arms.position.y = 5.2;
      return arms;
    })());
    // Head
    christGroup.add((() => {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), statueMat);
      head.position.y = 6.8;
      return head;
    })());
    // Pedestal
    christGroup.add((() => {
      const ped = new THREE.Mesh(
        new THREE.BoxGeometry(3, 2, 3),
        new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 }),
      );
      ped.position.y = -1;
      return ped;
    })());
    christGroup.position.set(-(RH + 70), 30, -300);
    christGroup.scale.setScalar(2.5);
    this.scene.add(christGroup);
    this.themeObjects.push(christGroup);
    this.background.push(christGroup);

    // ── DISTANT CITY SKYLINE — faded boxes along horizon ──
    const skylineMat = new THREE.MeshStandardMaterial({
      color: 0x7799bb, roughness: 0.6, metalness: 0.1,
      emissive: 0x445566, emissiveIntensity: 0.1,
    });
    for (let i = 0; i < 15; i++) {
      const h = 5 + Math.random() * 15;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(3 + Math.random() * 3, h, 3), skylineMat);
      tower.position.set(
        -(RH + 50 + Math.random() * 40), h / 2, -i * 25 - Math.random() * 10,
      );
      this.scene.add(tower);
      this.themeObjects.push(tower);
      this.background.push(tower);
    }

    if (!this.modelsReady) return;

    // ══════════════════════════════════════════
    //  LEFT — Favela buildings (dense, colorful, stacked on hillside)
    // ══════════════════════════════════════════
    const brazilBldgs = [
      MODEL_URLS.brazilE, MODEL_URLS.brazilF, MODEL_URLS.brazilG, MODEL_URLS.brazilI,
      MODEL_URLS.brazilJ, MODEL_URLS.brazilL, MODEL_URLS.brazilM, MODEL_URLS.brazilN,
    ];
    const favelaColors = [0xcc4444, 0xe88833, 0xddcc33, 0x44aa66, 0x4488cc, 0xcc5599, 0xeeeecc, 0x66ccaa];

    // Front row (closest to road) → midground
    for (let i = 0; i < 14; i++) {
      const url = brazilBldgs[Math.floor(Math.random() * brazilBldgs.length)];
      const x = -(RH + 5 + Math.random() * 6);
      const model = this._placeModel(url, x, 0, -i * 22 - Math.random() * 8, Math.random() * Math.PI, 0.7 + Math.random() * 0.4, 'mg');
      // Tint with favela color
      const tintColor = favelaColors[Math.floor(Math.random() * favelaColors.length)];
      this._tintModel(model, tintColor);
    }

    // Back row (further from road) → midground
    for (let i = 0; i < 10; i++) {
      const url = brazilBldgs[Math.floor(Math.random() * brazilBldgs.length)];
      const x = -(RH + 14 + Math.random() * 10);
      const model = this._placeModel(url, x, 0, -i * 28 - Math.random() * 12, Math.random() * Math.PI, 0.6 + Math.random() * 0.3, 'mg');
      const tintColor = favelaColors[Math.floor(Math.random() * favelaColors.length)];
      this._tintModel(model, tintColor);
    }

    // Third row (far back) → background
    for (let i = 0; i < 6; i++) {
      const url = brazilBldgs[Math.floor(Math.random() * brazilBldgs.length)];
      const x = -(RH + 25 + Math.random() * 12);
      const model = this._placeModel(url, x, 0, -i * 40 - Math.random() * 15, Math.random() * Math.PI, 0.5 + Math.random() * 0.3, 'bg');
      const tintColor = favelaColors[Math.floor(Math.random() * favelaColors.length)];
      this._tintModel(model, tintColor);
    }

    // ── Palms between buildings → midground ──
    for (let i = 0; i < 10; i++) {
      const x = -(RH + 4 + Math.random() * 4);
      this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 28 - Math.random() * 12,
        Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.4, 'mg');
    }

    // ── Bushes along road edge → foreground ──
    for (let i = 0; i < 10; i++) {
      this._placeModel(MODEL_URLS.bush, -(RH + 2 + Math.random() * 1.5), 0,
        -i * 28 - Math.random() * 12, Math.random() * Math.PI * 2, 1, 'fg');
    }

    // ══════════════════════════════════════════
    //  RIGHT — Beach palms, bushes, boats
    // ══════════════════════════════════════════

    // Beach palms → foreground
    for (let i = 0; i < 15; i++) {
      const x = RH + 3 + Math.random() * 5;
      const lean = (Math.random() - 0.5) * 0.1; // slight lean
      const model = this._placeModel(MODEL_URLS.palmTree, x, 0,
        -i * 20 - Math.random() * 10, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.3, 'fg');
      model.rotation.z = lean;
    }

    // Beach bushes → foreground
    for (let i = 0; i < 8; i++) {
      this._placeModel(MODEL_URLS.bush, RH + 2.5 + Math.random() * 3, 0,
        -i * 35 - Math.random() * 15, Math.random() * Math.PI * 2, 1, 'fg');
    }

    // ── Boats on ocean → background ──
    const boatColors = [0xcc3333, 0x3366cc, 0xeeeedd, 0x33aa66, 0xdd8833];
    for (let i = 0; i < 5; i++) {
      const boatGroup = new THREE.Group();
      const boatColor = boatColors[Math.floor(Math.random() * boatColors.length)];
      // Hull
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.4, 2),
        new THREE.MeshStandardMaterial({ color: boatColor, roughness: 0.6 }),
      );
      hull.position.y = 0.2;
      boatGroup.add(hull);
      // Cabin
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }),
      );
      cabin.position.set(0, 0.6, 0.2);
      boatGroup.add(cabin);

      boatGroup.position.set(
        RH + 25 + Math.random() * 30, -0.3,
        -i * 60 - Math.random() * 30,
      );
      boatGroup.rotation.y = Math.random() * Math.PI * 2;
      boatGroup.scale.setScalar(1.5 + Math.random());
      this.scene.add(boatGroup);
      this.themeObjects.push(boatGroup);
      this.background.push(boatGroup);
    }

    // ── Left road additional palms (sparser, inland) ──
    for (let i = 0; i < 6; i++) {
      const x = -(RH + 4 + Math.random() * 6);
      this._placeModel(MODEL_URLS.palmTree, x, 0,
        -i * 35 - Math.random() * 15, Math.random() * Math.PI * 2, 0.7 + Math.random() * 0.3, 'fg');
    }
  }

  /** Tint a model's meshes with a color (multiplied over texture for favela effect). */
  _tintModel(model, color) {
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        // Multiply color over texture — preserves atlas detail with a color wash
        child.material.color.set(color);
        child.material.roughness = 0.7;
      }
    });
  }

  // =====================================================================
  //  USA — Chicago night city
  // =====================================================================
  _buildUSA() {
    const RH = ROAD_WIDTH / 2;

    // Moonlight — wide fill for silhouette visibility
    const moonLight = new THREE.PointLight(0x6677aa, 0.5, 500);
    moonLight.position.set(-50, 120, -250);
    this.scene.add(moonLight);
    this.themeObjects.push(moonLight);

    // ── City glow plane at horizon (light pollution) ──
    const cityGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 20),
      new THREE.MeshBasicMaterial({
        color: 0x2a1530, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    cityGlow.position.set(0, 8, -350);
    this.scene.add(cityGlow);
    this.themeObjects.push(cityGlow);
    this.background.push(cityGlow);

    // ── Lake Michigan — dark reflective plane on right side ──
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x0a1020, roughness: 0.4, metalness: 0.3,
      emissive: 0x050810, emissiveIntensity: 0.3,
    });
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(200, 600), lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(RH + 80, -0.3, -150);
    this.scene.add(lake);
    this.themeObjects.push(lake);

    // ══════════════════════════════════════════
    //  BACKGROUND SKYLINE — tall skyscrapers (20% scroll)
    // ══════════════════════════════════════════
    const windowColors = [0xffcc66, 0xffffff, 0xaaccff, 0xffaa44];

    if (this.modelsReady) {
      // Far skyline with Chicago skyscrapers → background (dense)
      const skyscrapers = [
        MODEL_URLS.chicagoSkyscraperA, MODEL_URLS.chicagoSkyscraperB,
        MODEL_URLS.chicagoSkyscraperC, MODEL_URLS.chicagoSkyscraperD,
        MODEL_URLS.chicagoSkyscraperE,
      ];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 12; i++) {
          const url = skyscrapers[Math.floor(Math.random() * skyscrapers.length)];
          const x = side * (RH + 30 + Math.random() * 25);
          const z = -i * 30 - Math.random() * 15;
          const scale = 0.7 + Math.random() * 0.6;
          const model = this._placeModel(url, x, 0, z, side > 0 ? Math.PI : 0, scale, 'bg');
          this._darkenForNight(model);
        }
      }

      // ── Midground buildings — lower buildings closer to road ──
      const lowBuildings = [
        MODEL_URLS.chicagoLowA, MODEL_URLS.chicagoLowB, MODEL_URLS.chicagoLowE,
        MODEL_URLS.chicagoLowL, MODEL_URLS.chicagoLowM,
      ];

      // Collect window positions for InstancedMesh batching
      const windowBuckets = {}; // color → [{x, y, z}]
      for (const wc of windowColors) windowBuckets[wc] = [];

      for (const side of [-1, 1]) {
        for (let i = 0; i < 12; i++) {
          const url = lowBuildings[Math.floor(Math.random() * lowBuildings.length)];
          const x = side * (RH + 8 + Math.random() * 10);
          const z = -i * 25 - Math.random() * 10;
          const heightScale = 0.8 + Math.random() * 0.5;
          const model = this._placeModel(url, x, 0, z, side > 0 ? Math.PI : 0, heightScale, 'mg');
          this._darkenForNight(model);

          // Collect window positions (batched below as InstancedMesh)
          const buildingHeight = heightScale * 8;
          const rows = Math.floor(buildingHeight / 1.2);
          const cols = 3 + Math.floor(Math.random() * 3);
          const faceOffset = side > 0 ? -1.2 : 1.2;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (Math.random() < 0.35) continue; // some windows dark
              const wc = windowColors[Math.floor(Math.random() * windowColors.length)];
              windowBuckets[wc].push({
                x: x + faceOffset, y: 1.2 + r * 1.2, z: z + (c - cols / 2) * 0.7,
              });
            }
          }
        }
      }

      // Batch all windows into InstancedMesh (1 draw call per color instead of hundreds)
      const winGeo = new THREE.PlaneGeometry(0.45, 0.55);
      for (const wc of windowColors) {
        const positions = windowBuckets[wc];
        if (positions.length === 0) continue;
        const winMat = new THREE.MeshBasicMaterial({ color: wc, side: THREE.DoubleSide });
        const instanced = new THREE.InstancedMesh(winGeo, winMat, positions.length);
        const dummy = new THREE.Object3D();
        for (let idx = 0; idx < positions.length; idx++) {
          const p = positions[idx];
          dummy.position.set(p.x, p.y, p.z);
          dummy.updateMatrix();
          instanced.setMatrixAt(idx, dummy.matrix);
        }
        instanced.instanceMatrix.needsUpdate = true;
        this.scene.add(instanced);
        this.themeObjects.push(instanced);
        this.midground.push(instanced);
      }

      // Roadside props → foreground
      this._scatterProps(
        [MODEL_URLS.dumpster, MODEL_URLS.trafficLight, MODEL_URLS.bench,
         MODEL_URLS.firehydrant, MODEL_URLS.trashcan, MODEL_URLS.mailbox],
        12, [2, 5], 28, 'fg',
      );
      this._scatterProps([MODEL_URLS.trafficCone], 8, [1.5, 2.5], 35, 'fg');
      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 4, [2.5, 5], 65, 'fg');
      this._scatterProps([MODEL_URLS.carSedan, MODEL_URLS.carTaxi, MODEL_URLS.carHatchback], 6, [2, 4], 50, 'fg');
    }

    // ── The Bean (Cloud Gate) — reflective metallic ellipsoid ──
    const beanGroup = new THREE.Group();
    const beanMat = new THREE.MeshStandardMaterial({
      color: 0x888899, metalness: 1.0, roughness: 0.05, envMapIntensity: 2.0,
    });
    const bean = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), beanMat);
    bean.scale.set(1.4, 0.7, 1.0);
    beanGroup.add(bean);
    beanGroup.position.set(-(RH + 22), 2.5, -120);
    this.scene.add(beanGroup);
    this.themeObjects.push(beanGroup);
    this.midground.push(beanGroup);

    // ── Procedural deciduous trees (not palms — it's Chicago) ──
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1f16 });
    const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x1a3a12, roughness: 0.85 });
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const treeG = new THREE.Group();
      const trH = 2.0 + Math.random() * 1.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, trH, 6), treeTrunkMat);
      trunk.position.y = trH / 2;
      treeG.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.0 + Math.random() * 0.5, 6, 5), treeLeafMat);
      canopy.position.y = trH + 0.4;
      canopy.scale.y = 0.7;
      treeG.add(canopy);

      treeG.position.set(side * (RH + 4 + Math.random() * 4), 0, -i * 30 - Math.random() * 15);
      this.scene.add(treeG);
      this.themeObjects.push(treeG);
      this.foreground.push(treeG);
    }

    // ── Neon signs (emissive mesh, PointLight only on every other for perf) ──
    const neonColors = [0xff00ff, 0x00ffff, 0xff4444, 0x44ff44, 0xff6600];
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const nColor = neonColors[Math.floor(Math.random() * neonColors.length)];
      const neonGroup = new THREE.Group();

      const board = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 0.1), boardMat);
      neonGroup.add(board);

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.6),
        new THREE.MeshBasicMaterial({ color: nColor }),
      );
      glow.position.z = 0.06;
      neonGroup.add(glow);

      neonGroup.position.set(side * (RH + 6), 4 + Math.random() * 2, -i * 35 - 15);
      neonGroup.rotation.y = side > 0 ? -0.3 : 0.3;
      this.scene.add(neonGroup);
      this.themeObjects.push(neonGroup);
      this.midground.push(neonGroup);

      // PointLight on every other sign only (halves light count)
      if (i % 2 === 0) {
        const nLight = new THREE.PointLight(nColor, 0.4, 10, 2);
        nLight.position.copy(neonGroup.position);
        this.scene.add(nLight);
        this.themeObjects.push(nLight);
        this.midground.push(nLight);
      }
    }

    // ── Street lamps (emissive fixture only — no PointLights for perf) ──
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 });
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lampGroup = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4, 5), poleMat);
      pole.position.y = 2;
      lampGroup.add(pole);
      const fixture = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 3), fixtureMat);
      fixture.position.y = 4.1;
      lampGroup.add(fixture);

      lampGroup.position.set(side * (RH + 1.5), 0, -i * 35 - Math.random() * 10);
      this.scene.add(lampGroup);
      this.themeObjects.push(lampGroup);
      this.foreground.push(lampGroup);
    }
  }

  /** Darken a model for night scene (preserves texture). */
  _darkenForNight(model) {
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        // Darken via color multiply — texture stays, just rendered darker
        child.material.color.multiplyScalar(0.35);
        child.material.roughness = 0.8;
        child.material.metalness = 0;
        child.material.envMapIntensity = 0;
      }
    });
  }

  // =====================================================================
  //  PERU — Andean mountain pass
  // =====================================================================
  _buildPeru() {
    const RH = ROAD_WIDTH / 2;

    // ── Green valley ground planes (both sides) ──
    const valleyMat = new THREE.MeshStandardMaterial({ color: 0x4a7a2a, roughness: 0.9 });
    for (const side of [-1, 1]) {
      const valley = new THREE.Mesh(new THREE.PlaneGeometry(80, 600), valleyMat);
      valley.rotation.x = -Math.PI / 2;
      valley.position.set(side * (RH + 30), -0.05, -150);
      this.scene.add(valley);
      this.themeObjects.push(valley);
    }

    // ══════════════════════════════════════════
    //  MOUNTAINS (background, 20% scroll)
    // ══════════════════════════════════════════
    const mtColors = [0x7a8a6a, 0x6a7a5a, 0x8a8a7a, 0x5a7a4a, 0x6a8a5a];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const radius = 12 + Math.random() * 15;
        const height = 30 + Math.random() * 45;
        const color = mtColors[Math.floor(Math.random() * mtColors.length)];
        const mt = new THREE.Mesh(
          new THREE.ConeGeometry(radius, height, 5 + Math.floor(Math.random() * 3)),
          new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
        );
        // Place center far enough that base edge (center - radius) clears road
        const minX = radius + 20; // radius + 20-unit buffer from road center
        mt.position.set(
          side * (minX + 20 + Math.random() * 25), height / 2 - 4,
          -i * 55 - Math.random() * 20,
        );
        this.scene.add(mt);
        this.themeObjects.push(mt);
        this.background.push(mt);

        // Snow cap
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

    // ── Distant mountain range silhouette (far back, very tall) ──
    // Placed on both sides, never crossing the road zone (|x| > radius + 20)
    const rangeMat = new THREE.MeshStandardMaterial({ color: 0x6a7a8a, roughness: 0.9 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const h = 40 + Math.random() * 30;
        const r = 15 + Math.random() * 10;
        const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), rangeMat);
        // Ensure center is far enough that base edge doesn't reach road
        const x = side * (r + 30 + i * 20 + Math.random() * 10);
        peak.position.set(x, h / 2 - 6, -350 - Math.random() * 50);
        this.scene.add(peak);
        this.themeObjects.push(peak);
        this.background.push(peak);
      }
    }

    // ── Mist/cloud layers between mountains ──
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0xddeeff, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 5; i++) {
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(60 + Math.random() * 40, 6 + Math.random() * 4), mistMat);
      mist.position.set(
        (Math.random() - 0.5) * 100, 10 + Math.random() * 15, -80 - i * 50 - Math.random() * 30,
      );
      mist.lookAt(0, mist.position.y, 0);
      this.scene.add(mist);
      this.themeObjects.push(mist);
      this.background.push(mist);
    }

    // ══════════════════════════════════════════
    //  ROLLING HILLS (midground, 60% scroll)
    // ══════════════════════════════════════════
    const hillColors = [0x5a8a3a, 0x4a7a2a, 0x6a9a4a];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const r = 4 + Math.random() * 5;
        const hill = new THREE.Mesh(
          new THREE.SphereGeometry(r, 10, 6),
          new THREE.MeshStandardMaterial({
            color: hillColors[Math.floor(Math.random() * hillColors.length)], roughness: 0.9,
          }),
        );
        hill.scale.y = 0.3;
        hill.position.set(side * (RH + 14 + Math.random() * 14), -1.5, -i * 45 - Math.random() * 20);
        this.scene.add(hill);
        this.themeObjects.push(hill);
        this.midground.push(hill);
      }
    }

    // ══════════════════════════════════════════
    //  INCA TERRACES (midground) — enhanced with grass tops
    // ══════════════════════════════════════════
    const terrMats = [0x7a6b4f, 0x8a7a5a, 0x6a5b3f, 0x7a6a44].map(
      c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
    );
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x66aa44, roughness: 0.85 });
    for (let i = 0; i < 5; i++) {
      const terrGroup = new THREE.Group();
      for (let level = 0; level < 6; level++) {
        const w = 6 - level * 0.9;
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(w, 0.7, w + 2),
          terrMats[Math.min(level, terrMats.length - 1)],
        );
        step.position.y = level * 0.7;
        terrGroup.add(step);

        const grass = new THREE.Mesh(
          new THREE.BoxGeometry(w - 0.2, 0.12, w + 1.6), grassMat,
        );
        grass.position.y = level * 0.7 + 0.4;
        terrGroup.add(grass);
      }
      const side = i % 2 === 0 ? -1 : 1;
      terrGroup.position.set(
        side * (RH + 16 + Math.random() * 10), 0, -i * 70 - 30,
      );
      this.scene.add(terrGroup);
      this.themeObjects.push(terrGroup);
      this.midground.push(terrGroup);
    }

    // ══════════════════════════════════════════
    //  ICHU GRASS CLUMPS (foreground) — shared materials
    // ══════════════════════════════════════════
    const ichuMats = [0x9aaa3a, 0x8a9a2a, 0x7a8a1a, 0xaaaa4a].map(
      c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
    );
    const clumpGeo = new THREE.SphereGeometry(0.3, 4, 3);
    for (let i = 0; i < 30; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const clump = new THREE.Mesh(clumpGeo, ichuMats[i % ichuMats.length]);
      const s = 0.6 + Math.random() * 0.8;
      clump.scale.set(s, s * 0.5, s);
      clump.position.set(side * (RH + 4 + Math.random() * 14), 0, -i * 13 - Math.random() * 5);
      this.scene.add(clump);
      this.themeObjects.push(clump);
      this.foreground.push(clump);
    }

    // ══════════════════════════════════════════
    //  ROCKS / BOULDERS (foreground) — shared geometry + materials
    // ══════════════════════════════════════════
    const rockMats = [0x6b5b45, 0x7a6b55, 0x5a4a35].map(
      c => new THREE.MeshStandardMaterial({ color: c, roughness: 1.0 })
    );
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const s = 0.6 + Math.random() * 1.0;
      const rock = new THREE.Mesh(rockGeo, rockMats[i % rockMats.length]);
      rock.scale.setScalar(s);
      rock.position.set(side * (RH + 4 + Math.random() * 7), s * 0.2, -i * 25 - Math.random() * 10);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      this.scene.add(rock);
      this.themeObjects.push(rock);
      this.foreground.push(rock);
    }

    // ══════════════════════════════════════════
    //  LOADED MODELS
    // ══════════════════════════════════════════
    if (this.modelsReady) {
      // Peru buildings (Andean village clusters) → midground
      const peruBldgs = [
        MODEL_URLS.peruBuildingA, MODEL_URLS.peruBuildingB, MODEL_URLS.peruBuildingC,
        MODEL_URLS.peruBuildingD, MODEL_URLS.peruBuildingE, MODEL_URLS.peruBuildingF,
        MODEL_URLS.peruBuildingR, MODEL_URLS.peruBuildingS, MODEL_URLS.peruBuildingT,
      ];
      // Village clusters along hillsides
      for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const url = peruBldgs[Math.floor(Math.random() * peruBldgs.length)];
        const x = side * (RH + 10 + Math.random() * 10);
        const y = Math.random() * 1.5;
        this._placeModel(url, x, y, -i * 35 - Math.random() * 15,
          Math.random() * Math.PI * 2, 0.7 + Math.random() * 0.4, 'mg');
      }

      // Peru trees → foreground/midground
      for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const url = Math.random() > 0.5 ? MODEL_URLS.peruTreeLarge : MODEL_URLS.peruTreeSmall;
        this._placeModel(url, side * (RH + 4 + Math.random() * 8), 0,
          -i * 30 - Math.random() * 15, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.4, 'fg');
      }

      // Planters near road → foreground
      this._scatterProps([MODEL_URLS.peruPlanter], 6, [2, 5], 45, 'fg');

      // Existing props
      this._scatterProps([MODEL_URLS.bush], 8, [4, 9], 30, 'fg');
      this._scatterProps([MODEL_URLS.flowers], 8, [3, 12], 30, 'fg');
      this._scatterProps([MODEL_URLS.stoneWall], 6, [4, 10], 45, 'fg');

      // Andean huts → midground
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        this._placeModel(MODEL_URLS.hut, side * (RH + 12 + Math.random() * 6), 0,
          -i * 80 - 30, Math.random() * Math.PI * 2, 0.9 + Math.random() * 0.2, 'mg');
      }

      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 4, [2, 4], 70, 'fg');
    } else {
      // ── Procedural fallback trees ──
      const foliageColors = [0x2d5a1e, 0x3a6a2a, 0x4a8a3a];
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const treeGroup = new THREE.Group();
          const trunkH = 1.5 + Math.random() * 1.2;
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6), trunkMat);
          trunk.position.y = trunkH / 2;
          treeGroup.add(trunk);

          const fMat = new THREE.MeshStandardMaterial({
            color: foliageColors[Math.floor(Math.random() * foliageColors.length)], roughness: 0.8,
          });
          for (let f = 0; f < 2; f++) {
            const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 6, 5), fMat);
            foliage.position.set((Math.random() - 0.5) * 0.3, trunkH + 0.3 + f * 0.25, (Math.random() - 0.5) * 0.3);
            treeGroup.add(foliage);
          }
          treeGroup.position.set(side * (RH + 5 + Math.random() * 7), 0, -i * 35 - Math.random() * 15);
          this.scene.add(treeGroup);
          this.themeObjects.push(treeGroup);
          this.foreground.push(treeGroup);
        }
      }
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
