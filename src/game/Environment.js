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
      this._buildSunsetSky();
      this.sunDirection.set(-0.5, 0.25, -0.8).normalize(); // low sun, left side
      this.renderer.toneMappingExposure = 1.3;
    } else if (theme.id === 'peru') {
      this._buildMountainSky();
      this.sunDirection.set(0.3, 0.85, -0.3).normalize();
      this.renderer.toneMappingExposure = 1.3;
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
    const shadowRes = (navigator.maxTouchPoints > 0) ? 512 : 1024;
    this.dirLight.shadow.mapSize.width = shadowRes;
    this.dirLight.shadow.mapSize.height = shadowRes;
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
      this.hemiLight = new THREE.HemisphereLight(0x7788bb, 0xaa8855, 0.5);
      this.dirLight.position.set(-30, 15, -100); // low sunset angle
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
    // Preserve the Y offset from normalizeToHeight (base-on-ground correction)
    model.position.set(x, model.position.y + y, z);
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
    model.position.set(x, model.position.y + y, z);
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
  //  SUNSET SKY (USA — golden hour gradient with sun disc)
  // =====================================================================
  _buildSunsetSky() {
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

          // 5-stop sunset gradient: zenith deep blue → horizon golden
          vec3 zenith  = vec3(0.10, 0.10, 0.30);   // #1a1a4e deep blue-purple
          vec3 upper   = vec3(0.25, 0.18, 0.45);   // dusky purple
          vec3 mid     = vec3(0.80, 0.33, 0.20);   // #cc5533 warm orange-red
          vec3 lower   = vec3(0.95, 0.60, 0.25);   // bright orange
          vec3 horizon = vec3(1.00, 0.80, 0.40);   // #ffcc66 golden yellow

          vec3 col;
          if (h > 0.5) col = mix(upper, zenith, (h - 0.5) / 0.5);
          else if (h > 0.25) col = mix(mid, upper, (h - 0.25) / 0.25);
          else if (h > 0.08) col = mix(lower, mid, (h - 0.08) / 0.17);
          else if (h > 0.0) col = mix(horizon, lower, h / 0.08);
          else col = horizon;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // Sun glow sprite at horizon
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 128;
    sunCanvas.height = 128;
    const sctx = sunCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,200,1.0)');
    grad.addColorStop(0.15, 'rgba(255,200,100,0.8)');
    grad.addColorStop(0.4, 'rgba(255,150,50,0.3)');
    grad.addColorStop(1, 'rgba(255,100,30,0.0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const sunTex = new THREE.CanvasTexture(sunCanvas);
    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTex, color: 0xffeeaa, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    sunSprite.scale.set(40, 40, 1);
    sunSprite.position.set(-60, 8, -300);
    this.scene.add(sunSprite);
    this.themeObjects.push(sunSprite);

    // Sunset cloud sprites
    const cloudTex = this._makeCloudTexture();
    const cloudColors = [0xff9955, 0xffaa66, 0xff8844, 0xffbb77, 0xcc6644];
    for (let i = 0; i < 6; i++) {
      const w = 40 + Math.random() * 40;
      const h = 8 + Math.random() * 8;
      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true,
        opacity: 0.3 + Math.random() * 0.2,
        depthWrite: false, side: THREE.DoubleSide,
        color: cloudColors[Math.floor(Math.random() * cloudColors.length)],
      });
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloudMat);
      cloud.position.set(
        -80 + Math.random() * 160,
        22 + Math.random() * 20,
        -200 - Math.random() * 120,
      );
      cloud.lookAt(0, cloud.position.y, 0);
      this.scene.add(cloud);
      this.themeObjects.push(cloud);
      this.background.push(cloud);
    }
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

    // ── SUGARLOAF MOUNTAIN — on the LEFT (land side), behind the city ──
    const sugarloaf = new THREE.Mesh(
      new THREE.ConeGeometry(18, 35, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.85, flatShading: true }),
    );
    sugarloaf.position.set(-(RH + 80), 12, -280);
    this.scene.add(sugarloaf);
    this.themeObjects.push(sugarloaf);
    this.background.push(sugarloaf);

    // Second peak
    const sugarloaf2 = new THREE.Mesh(
      new THREE.ConeGeometry(12, 25, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a7a4a, roughness: 0.85, flatShading: true }),
    );
    sugarloaf2.position.set(-(RH + 60), 8, -250);
    this.scene.add(sugarloaf2);
    this.themeObjects.push(sugarloaf2);
    this.background.push(sugarloaf2);

    // ── CHRIST THE REDEEMER — on top of Corcovado mountain, far left background ──
    const corcovadoGroup = new THREE.Group();

    // Mountain base (Corcovado)
    const mtHeight = 50;
    const mtRadius = 22;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(mtRadius, mtHeight, 7),
      new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.85, flatShading: true }),
    );
    mountain.position.y = mtHeight / 2;
    corcovadoGroup.add(mountain);

    // Statue on top
    const statueMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee, emissive: 0xcccccc, emissiveIntensity: 0.25, roughness: 0.5,
    });
    const statueGroup = new THREE.Group();
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1), statueMat);
    body.position.y = 3;
    statueGroup.add(body);
    // Arms
    const arms = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 0.8), statueMat);
    arms.position.y = 5.2;
    statueGroup.add(arms);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), statueMat);
    head.position.y = 6.8;
    statueGroup.add(head);
    // Pedestal
    const ped = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2, 3),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 }),
    );
    ped.position.y = -1;
    statueGroup.add(ped);

    statueGroup.scale.setScalar(1.8);
    statueGroup.position.y = mtHeight;
    corcovadoGroup.add(statueGroup);

    // Place far left and deep in background so it's always visible
    corcovadoGroup.position.set(-(RH + 120), 0, -400);
    this.scene.add(corcovadoGroup);
    this.themeObjects.push(corcovadoGroup);
    this.background.push(corcovadoGroup);

    // Distant city skyline removed for performance

    if (!this.modelsReady) return;

    // All buildings removed for performance

    // ── Palms between buildings → midground ──
    for (let i = 0; i < 6; i++) {
      const x = -(RH + 4 + Math.random() * 4);
      this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 28 - Math.random() * 12,
        Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.4, 'mg');
    }

    // ── Bushes along road edge → foreground ──
    for (let i = 0; i < 5; i++) {
      this._placeModel(MODEL_URLS.bush, -(RH + 2 + Math.random() * 1.5), 0,
        -i * 28 - Math.random() * 12, Math.random() * Math.PI * 2, 1, 'fg');
    }

    // ══════════════════════════════════════════
    //  RIGHT — Beach palms, bushes, boats
    // ══════════════════════════════════════════

    // Beach palms → foreground
    for (let i = 0; i < 8; i++) {
      const x = RH + 3 + Math.random() * 5;
      const lean = (Math.random() - 0.5) * 0.1; // slight lean
      const model = this._placeModel(MODEL_URLS.palmTree, x, 0,
        -i * 20 - Math.random() * 10, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.3, 'fg');
      model.rotation.z = lean;
    }

    // Beach bushes → foreground
    for (let i = 0; i < 4; i++) {
      this._placeModel(MODEL_URLS.bush, RH + 2.5 + Math.random() * 3, 0,
        -i * 35 - Math.random() * 15, Math.random() * Math.PI * 2, 1, 'fg');
    }

    // ── Boats on ocean → background ──
    const boatColors = [0xcc3333, 0x3366cc, 0xeeeedd, 0x33aa66, 0xdd8833];
    for (let i = 0; i < 3; i++) {
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
    for (let i = 0; i < 3; i++) {
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
  //  USA — Chicago sunset with varied architecture
  // =====================================================================

  /** Generate a canvas window texture for a building face. */
  _buildingWindowTex(wSegs, hSegs, wallColor, facingSun) {
    const cW = 16, cH = 20;
    const canvas = document.createElement('canvas');
    canvas.width = wSegs * cW;
    canvas.height = hSegs * cH;
    const ctx = canvas.getContext('2d');
    const wc = new THREE.Color(wallColor);
    ctx.fillStyle = `rgb(${wc.r * 255 | 0},${wc.g * 255 | 0},${wc.b * 255 | 0})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < hSegs; y++) {
      for (let x = 0; x < wSegs; x++) {
        const wx = x * cW + 3, wy = y * cH + 4, ww = cW - 6, wh = cH - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);

        if (facingSun && Math.random() > 0.15) {
          const r = 200 + (Math.random() * 55 | 0);
          const g = 130 + (Math.random() * 60 | 0);
          const b = 40 + (Math.random() * 40 | 0);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else if (!facingSun && Math.random() > 0.55) {
          const v = 160 + (Math.random() * 80 | 0);
          ctx.fillStyle = `rgb(${v},${v - 25},${v - 70})`;
        } else {
          const d = 20 + (Math.random() * 20 | 0);
          ctx.fillStyle = `rgb(${d},${d + 5},${d + 15})`;
        }
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
    // Ground-floor awning
    if (hSegs > 3) {
      const gy = (hSegs - 1) * cH;
      const awnings = ['#cc3333', '#336699', '#339966', '#cc6633', '#996633'];
      ctx.fillStyle = awnings[(Math.random() * awnings.length) | 0];
      ctx.fillRect(2, gy, canvas.width - 4, 3);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  /** Create a procedural Chicago building with varied facade. */
  _createChicagoBuilding(w, h, d) {
    // Random architectural style
    const styles = [
      { color: 0x8B4513, r: 0.9, m: 0.02 },  // red brick
      { color: 0x6B2A1A, r: 0.92, m: 0.02 }, // dark brick
      { color: 0x7B7B85, r: 0.85, m: 0.05 }, // gray concrete
      { color: 0xA09888, r: 0.8, m: 0.03 },  // limestone
      { color: 0x445566, r: 0.15, m: 0.6 },  // glass tower
      { color: 0xD4C8A8, r: 0.75, m: 0.02 }, // cream painted
      { color: 0x7A6B5A, r: 0.88, m: 0.03 }, // brownstone
    ];
    const style = styles[(Math.random() * styles.length) | 0];

    const wSegs = Math.max(2, (w / 1.5) | 0);
    const dSegs = Math.max(2, (d / 1.5) | 0);
    const hSegs = Math.max(3, (h / 2.5) | 0);

    const sunFront = this._buildingWindowTex(wSegs, hSegs, style.color, true);
    const shadeFront = this._buildingWindowTex(wSegs, hSegs, style.color, false);
    const sunSide = this._buildingWindowTex(dSegs, hSegs, style.color, true);
    const shadeSide = this._buildingWindowTex(dSegs, hSegs, style.color, false);

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
    const baseMat = new THREE.MeshStandardMaterial({ color: style.color, roughness: style.r, metalness: style.m });

    // BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z]
    // Sun comes from -Z, -X direction
    const mats = [
      new THREE.MeshBasicMaterial({ map: shadeSide }),  // +X shadow
      new THREE.MeshBasicMaterial({ map: sunSide }),    // -X sun
      roofMat,
      baseMat,
      new THREE.MeshBasicMaterial({ map: sunFront }),   // +Z sun
      new THREE.MeshBasicMaterial({ map: shadeFront }), // -Z shadow
    ];

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.y = h / 2;
    return mesh;
  }

  _buildUSA() {
    const RH = ROAD_WIDTH / 2;

    // ── Warm fill light ──
    const warmFill = new THREE.DirectionalLight(0xff8844, 0.6);
    warmFill.position.set(20, 10, 50);
    this.scene.add(warmFill);
    this.themeObjects.push(warmFill);

    // ── Lake Michigan ──
    const lake = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 600),
      new THREE.MeshStandardMaterial({
        color: 0x2a5577, roughness: 0.3, metalness: 0.2,
        emissive: 0x332211, emissiveIntensity: 0.15,
      }),
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(RH + 80, -0.2, -150);
    this.scene.add(lake);
    this.themeObjects.push(lake);

    // ══════════════════════════════════════════
    //  BACKGROUND SKYLINE — GLTF skyscrapers (far, 20% scroll)
    // ══════════════════════════════════════════
    if (this.modelsReady) {
      const skyscrapers = [
        MODEL_URLS.chicagoSkyscraperA, MODEL_URLS.chicagoSkyscraperB,
        MODEL_URLS.chicagoSkyscraperC, MODEL_URLS.chicagoSkyscraperD,
        MODEL_URLS.chicagoSkyscraperE,
      ];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 12; i++) {
          const url = skyscrapers[(Math.random() * skyscrapers.length) | 0];
          this._placeModel(url, side * (RH + 30 + Math.random() * 25), 0,
            -i * 30 - Math.random() * 15, side > 0 ? Math.PI : 0,
            0.7 + Math.random() * 0.6, 'bg');
        }
      }

      // Roadside props
      this._scatterProps(
        [MODEL_URLS.dumpster, MODEL_URLS.trafficLight, MODEL_URLS.bench,
         MODEL_URLS.firehydrant, MODEL_URLS.trashcan, MODEL_URLS.mailbox],
        12, [2, 5], 28, 'fg',
      );
      this._scatterProps([MODEL_URLS.trafficCone], 8, [1.5, 2.5], 35, 'fg');
      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 4, [2.5, 5], 65, 'fg');
      this._scatterProps([MODEL_URLS.carSedan, MODEL_URLS.carTaxi, MODEL_URLS.carHatchback], 6, [2, 4], 50, 'fg');
    }

    // ══════════════════════════════════════════
    //  MIDGROUND — Procedural buildings with varied facades (60% scroll)
    // ══════════════════════════════════════════
    for (const side of [-1, 1]) {
      let z = 10;
      while (z > -320) {
        const w = 4 + Math.random() * 6;
        const h = 6 + Math.random() * 14;
        const d = 4 + Math.random() * 5;
        const gap = 0.5 + Math.random() * 1.5;

        const bldg = this._createChicagoBuilding(w, h, d);
        bldg.position.x = side * (RH + 8 + d / 2 + Math.random() * 4);
        bldg.position.z = z - w / 2;
        this.scene.add(bldg);
        this.themeObjects.push(bldg);
        this.midground.push(bldg);

        z -= w + gap;
      }
    }

    // ══════════════════════════════════════════
    //  FOREGROUND — Trees, lamps, signs
    // ══════════════════════════════════════════

    // ── The Bean ──
    const bean = new THREE.Mesh(
      new THREE.SphereGeometry(4, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xaa9988, metalness: 1.0, roughness: 0.05, envMapIntensity: 2.0 }),
    );
    bean.scale.set(1.4, 0.7, 1.0);
    bean.position.set(-(RH + 22), 2.5, -120);
    this.scene.add(bean);
    this.themeObjects.push(bean);
    this.midground.push(bean);

    // ── Grass strips along roadside (blends ground into vegetation) ──
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a7a35, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(5, 600), grassMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(side * (RH + 3.5), 0.01, -150);
      this.scene.add(strip);
      this.themeObjects.push(strip);
    }

    // ── Deciduous trees — dense along sidewalks + second row behind ──
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18 });
    const canopyColors = [0x3d6b2e, 0x4a7a3a, 0x356328, 0x4d7040, 0x3a5c2a];
    const canopyMats = canopyColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 2.5, 5);
    const canopyGeo = new THREE.SphereGeometry(1, 4, 3);

    // Front row — close to road (sidewalk trees)
    for (const side of [-1, 1]) {
      for (let z = 10; z > -320; z -= 6 + Math.random() * 8) {
        if (Math.random() > 0.7) continue;
        const treeG = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
        trunk.position.y = 1.25;
        treeG.add(trunk);
        const canopy = new THREE.Mesh(canopyGeo,
          canopyMats[(Math.random() * canopyMats.length) | 0]);
        canopy.position.y = 3.2 + Math.random() * 0.5;
        canopy.scale.set(0.8 + Math.random() * 0.5, 0.6 + Math.random() * 0.3, 0.8 + Math.random() * 0.5);
        treeG.add(canopy);
        treeG.position.set(side * (RH + 2.5 + Math.random() * 2), 0, z);
        treeG.scale.setScalar(0.8 + Math.random() * 0.4);
        this.scene.add(treeG);
        this.themeObjects.push(treeG);
        this.foreground.push(treeG);
      }
    }

    // Back row — behind buildings (park trees, larger)
    for (const side of [-1, 1]) {
      for (let z = 0; z > -320; z -= 12 + Math.random() * 18) {
        if (Math.random() > 0.6) continue;
        const treeG = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
        trunk.position.y = 1.25;
        treeG.add(trunk);
        const canopy = new THREE.Mesh(canopyGeo,
          canopyMats[(Math.random() * canopyMats.length) | 0]);
        canopy.position.y = 3.5 + Math.random() * 0.5;
        canopy.scale.set(1.0 + Math.random() * 0.6, 0.7 + Math.random() * 0.3, 1.0 + Math.random() * 0.6);
        treeG.add(canopy);
        treeG.position.set(side * (RH + 18 + Math.random() * 8), 0, z);
        treeG.scale.setScalar(1.0 + Math.random() * 0.5);
        this.scene.add(treeG);
        this.themeObjects.push(treeG);
        this.midground.push(treeG);
      }
    }

    // ── Street lamps ──
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lampGroup = new THREE.Group();
      lampGroup.add((() => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4, 5), poleMat);
        p.position.y = 2; return p;
      })());
      lampGroup.add((() => {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 3), fixtureMat);
        f.position.y = 4.1; return f;
      })());
      lampGroup.position.set(side * (RH + 1.5), 0, -i * 35 - Math.random() * 10);
      this.scene.add(lampGroup);
      this.themeObjects.push(lampGroup);
      this.foreground.push(lampGroup);
    }

    // ── Signs ──
    const signColors = [0xcc4444, 0x3366aa, 0xddaa33, 0x448844, 0xcc6633];
    const signMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sg = new THREE.Group();
      sg.add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 0.1), signMat));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7),
        new THREE.MeshStandardMaterial({ color: signColors[(Math.random() * signColors.length) | 0], roughness: 0.5 }));
      face.position.z = 0.06;
      sg.add(face);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 4), signMat);
      pole.position.y = -2;
      sg.add(pole);
      sg.position.set(side * (RH + 5), 4.5 + Math.random() * 1.5, -i * 45 - 20);
      this.scene.add(sg);
      this.themeObjects.push(sg);
      this.midground.push(sg);
    }
  }

  // =====================================================================
  //  PERU — Andean mountain pass (improved)
  // =====================================================================

  /** Create a mountain with vertex displacement + altitude gradient colors. */
  _createAndeanMountain(radius, height) {
    // Simple cone with solid color (no vertexColors — avoids unique shader variant)
    const geo = new THREE.ConeGeometry(radius, height, 6);
    const pos = geo.attributes.position;

    // Light vertex displacement for organic shape
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const hNorm = (y + height / 2) / height;
      if (hNorm > 0.95) continue;
      const noise = Math.sin(x * 3.7 + z * 2.3) * Math.cos(y * 1.8 + x * 4.1);
      const disp = noise * radius * 0.08;
      const dist = Math.sqrt(x * x + z * z);
      if (dist > 0.01) {
        pos.setX(i, x + (x / dist) * disp);
        pos.setZ(i, z + (z / dist) * disp);
      }
    }
    geo.computeVertexNormals();

    // Solid color based on height (green for short, gray-brown for tall)
    const t = Math.min(1, height / 50);
    const col = new THREE.Color(0x4a7a33).lerp(new THREE.Color(0x8a7a65), t);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: col, roughness: 0.88,
    }));
  }

  // _applyAtmosphere removed (mountains use solid colors now)

  _buildPeru() {
    const RH = ROAD_WIDTH / 2;

    // ── Valley ground (warm green) ──
    const valleyMat = new THREE.MeshStandardMaterial({ color: 0x5a7a40, roughness: 0.9 });
    for (const side of [-1, 1]) {
      const valley = new THREE.Mesh(new THREE.PlaneGeometry(80, 600), valleyMat);
      valley.rotation.x = -Math.PI / 2;
      valley.position.set(side * (RH + 30), -0.05, -150);
      this.scene.add(valley);
      this.themeObjects.push(valley);
    }

    // ── Ground variation patches (dirt, light grass, dark grass, rock) ──
    const patchGeo = new THREE.CircleGeometry(1, 6);
    const patchMats = [
      new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.95 }), // dirt
      new THREE.MeshStandardMaterial({ color: 0x6a9a4a, roughness: 0.95 }), // light grass
      new THREE.MeshStandardMaterial({ color: 0x3a5a25, roughness: 0.95 }), // dark grass
      new THREE.MeshStandardMaterial({ color: 0x7a7a6a, roughness: 0.92 }), // rock
    ];
    for (let z = 15; z > -300; z -= 40 + Math.random() * 30) {
      for (const side of [-1, 1]) {
        if (Math.random() > 0.2) continue;
        const patch = new THREE.Mesh(patchGeo, patchMats[(Math.random() * patchMats.length) | 0]);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(side * (RH + 5 + Math.random() * 18), 0.01 + Math.random() * 0.01, z);
        patch.scale.setScalar(1.5 + Math.random() * 3.5);
        this.scene.add(patch);
        this.themeObjects.push(patch);
        this.foreground.push(patch);
      }
    }

    // ══════════════════════════════════════════
    //  MOUNTAINS — vertex-colored + displaced (background)
    // ══════════════════════════════════════════
    const mtConfigs = [
      { r: 28, h: 55, x: -55, z: -250 },
      { r: 22, h: 48, x: 60, z: -280 },
      { r: 20, h: 40, x: -80, z: -200 },
      { r: 24, h: 44, x: -90, z: -310 },
    ];
    for (const cfg of mtConfigs) {
      // Main peak
      const mt = this._createAndeanMountain(cfg.r, cfg.h);
      mt.position.set(cfg.x, cfg.h / 2 - 4, cfg.z);
      const dist = Math.abs(cfg.z) / 350;
      // Atmospheric tint via material color instead of vertex colors
      if (dist > 0.3) mt.material.color.lerp(new THREE.Color(0xaabbcc), dist * 0.25);
      this.scene.add(mt);
      this.themeObjects.push(mt);
      this.background.push(mt);

      // Single ridge behind larger peaks only
      if (cfg.h > 40) {
        const rr = cfg.r * 0.6;
        const rh = cfg.h * 0.5;
        const ridge = this._createAndeanMountain(rr, rh);
        ridge.position.set(cfg.x + cfg.r * 0.3, rh / 2 - 4, cfg.z - 8);
        if (dist > 0.3) ridge.material.color.lerp(new THREE.Color(0xaabbcc), dist * 0.25);
        this.scene.add(ridge);
        this.themeObjects.push(ridge);
        this.background.push(ridge);
      }
    }

    // ── Mist layers ──
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0xccddee, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide,
    });
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(120, 8), mistMat);
    mist.position.set(0, 12, -180);
    mist.lookAt(0, mist.position.y, 0);
    this.scene.add(mist);
    this.themeObjects.push(mist);
    this.background.push(mist);

    // ══════════════════════════════════════════
    //  ROLLING HILLS (midground)
    // ══════════════════════════════════════════
    const hillMats = [0x5a8a3a, 0x4a7a2a, 0x6a9a4a].map(
      c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    const hillGeo = new THREE.SphereGeometry(6, 6, 4);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const hill = new THREE.Mesh(hillGeo, hillMats[i % hillMats.length]);
        hill.scale.set(0.7 + Math.random() * 0.6, 0.3, 0.7 + Math.random() * 0.6);
        hill.position.set(side * (RH + 14 + Math.random() * 14), -1.5, -i * 70 - Math.random() * 30);
        this.scene.add(hill);
        this.themeObjects.push(hill);
        this.midground.push(hill);
      }
    }

    // ══════════════════════════════════════════
    //  INCA TERRACES (midground)
    // ══════════════════════════════════════════
    const terrMat = new THREE.MeshStandardMaterial({ color: 0x7a6b4f, roughness: 0.9 });
    const tGrassMat = new THREE.MeshStandardMaterial({ color: 0x5a9a3a, roughness: 0.85 });
    for (let i = 0; i < 1; i++) {
      const terrGroup = new THREE.Group();
      const levels = 3;
      const baseW = 8 + Math.random() * 4;
      for (let level = 0; level < levels; level++) {
        const w = baseW - level * (baseW * 0.12);
        const step = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, 3), terrMat);
        step.position.set(0, level * 1.0 + 0.5, level * 0.6);
        terrGroup.add(step);
        const grass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.1, 2.6), tGrassMat);
        grass.position.set(0, level * 1.0 + 1.05, level * 0.6);
        terrGroup.add(grass);
      }
      const side = i % 2 === 0 ? -1 : 1;
      terrGroup.position.set(side * (RH + 16 + Math.random() * 10), 0, -i * 65 - 25);
      terrGroup.rotation.y = (Math.random() - 0.5) * 0.3;
      this.scene.add(terrGroup);
      this.themeObjects.push(terrGroup);
      this.midground.push(terrGroup);
    }

    // Houses removed for performance — GLTF building models provide structures

    // ══════════════════════════════════════════
    //  TREES — dense, 3 types (foreground + midground)
    // ══════════════════════════════════════════
    // Trunks removed for performance — trees are canopy-only blobs
    const pineGeo = new THREE.ConeGeometry(1.2, 3.5, 5);
    const bushGeo = new THREE.SphereGeometry(0.8, 4, 3);
    const roundGeo = new THREE.SphereGeometry(1.0, 4, 3);
    const canopyColors = [0x2d5a1e, 0x3a6a2a, 0x4a7a35, 0x356328, 0x4d7040];

    // Pre-create shared canopy materials (5 shades)
    const canopyMats = canopyColors.map(
      c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })
    );
    const pickCanopy = () => canopyMats[(Math.random() * canopyMats.length) | 0];

    // Procedural trees removed for performance — GLTF tree models provide vegetation

    // Rocks removed for performance

    // ══════════════════════════════════════════
    //  LOADED MODELS (if available)
    // ══════════════════════════════════════════
    // All GLTF buildings/models removed for performance
  }

  // =====================================================================
  //  UPDATE
  // =====================================================================
  update(delta, speed) {
    if (this.sky && this.sky.material.uniforms['time']) this.sky.material.uniforms['time'].value += delta;
    if (this.starField) this.starField.material.uniforms.time.value += delta;
    // Ocean wave animation removed for performance

    const move = speed * delta;
    this._parFrame = (this._parFrame || 0) + 1;

    // Foreground: every frame (closest to camera, most visible motion)
    const fgMove = move * 1.0;
    for (const obj of this.foreground) {
      obj.position.z += fgMove;
      if (obj.position.z > 60) obj.position.z -= 400;
    }

    // Midground: every frame (still visible)
    const mgMove = move * 0.6;
    for (const obj of this.midground) {
      obj.position.z += mgMove;
      if (obj.position.z > 60) obj.position.z -= 400;
    }

    // Background: every other frame (distant, 20% speed, imperceptible difference)
    if ((this._parFrame & 1) === 0) {
      const bgMove = move * 0.2 * 2; // 2x to compensate for half-rate
      for (const obj of this.background) {
        obj.position.z += bgMove;
        if (obj.position.z > 60) obj.position.z -= 400;
      }
    }
  }
}
