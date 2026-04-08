import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
    // --- Cleanup: remove from scene and dispose GPU resources ---
    for (const obj of this.themeObjects) {
      this.scene.remove(obj);
      obj.traverse?.(node => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
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
    } else if (theme.id === 'shanghai') {
      this._buildShanghaiSky();
      this.sunDirection.set(0.5, 0.45, -0.5).normalize(); // rising sun, east
      this.renderer.toneMappingExposure = 1.3;
    } else if (theme.id === 'delhi') {
      this._buildDelhiSky();
      this.sunDirection.set(-0.3, 0.2, -0.8).normalize();
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
    } else if (theme.id === 'shanghai') {
      this.hemiLight = new THREE.HemisphereLight(0x99bbdd, 0x556644, 0.65);
      this.dirLight.position.set(30, 25, -40); // morning sun from east
    } else if (theme.id === 'delhi') {
      this.hemiLight = new THREE.HemisphereLight(0xcc9966, 0x664433, 0.5);
      this.dirLight.position.set(-25, 15, -80);
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
    const barrierMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
    for (const side of [-1, 1]) {
      const geos = [];
      for (let i = 0; i < 6; i++) {
        const g = new THREE.BoxGeometry(0.3, 0.8, ROAD_SEGMENT_LENGTH * 0.9);
        g.translate(side * (ROAD_WIDTH / 2 + 0.5), 0.4, -i * ROAD_SEGMENT_LENGTH * 0.9);
        geos.push(g);
      }
      const merged = new THREE.Mesh(mergeGeometries(geos, false), barrierMat);
      this.scene.add(merged);
      this.themeObjects.push(merged);
      this.foreground.push(merged);
    }

    // =================================================================
    //  THEME DECORATIONS
    // =================================================================
    switch (theme.id) {
      case 'brazil': this._buildBrazil(); break;
      case 'usa': this._buildUSA(); break;
      case 'peru': this._buildPeru(); break;
      case 'shanghai': this._buildShanghai(); break;
      case 'delhi': this._buildDelhi(); break;
    }

    // ICT billboards along the road (all maps)
    this._buildBillboards(theme.id);
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
    for (let i = 0; i < 3; i++) {
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
    for (let i = 0; i < 3; i++) {
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
    for (let i = 0; i < 3; i++) {
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

    // ── Rio de Janeiro backdrop (fixed on left horizon) ──
    const rioTex = new THREE.TextureLoader().load(asset('rio-de-janeiro.webp'));
    rioTex.colorSpace = THREE.SRGBColorSpace;
    const rioMat = new THREE.MeshBasicMaterial({
      map: rioTex, transparent: true, opacity: 0.5,
      depthWrite: false, side: THREE.FrontSide, fog: false,
    });
    const rioPlane = new THREE.Mesh(new THREE.PlaneGeometry(200, 70), rioMat);
    rioPlane.position.set(-160, 20, -350);
    rioPlane.rotation.y = 0.4; // angled toward the player from far left
    rioPlane.renderOrder = -1;
    this.scene.add(rioPlane);
    this.themeObjects.push(rioPlane);
    // NOT in any parallax layer — stays fixed on the horizon

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

    // ── Green mountains surrounding the Rio backdrop ──
    const brMtColors = [0x3a6a2a, 0x4a7a3a, 0x2a5a1a, 0x5a8a4a, 0x3a7030];
    const brMtConfigs = [
      // Tight cluster around the backdrop (X:-160, Z:-350) — low profile
      { r: 22, h: 22, x: -190, z: -340 },
      { r: 18, h: 20, x: -130, z: -360 },
      { r: 25, h: 26, x: -175, z: -380 },
      { r: 20, h: 21, x: -145, z: -330 },
      { r: 16, h: 17, x: -200, z: -370 },
      { r: 24, h: 24, x: -160, z: -400 },
      { r: 20, h: 20, x: -210, z: -350 },
      { r: 18, h: 19, x: -135, z: -390 },
      // Wider spread — left side mountain range
      { r: 20, h: 26, x: -110, z: -280 },
      { r: 28, h: 32, x: -140, z: -250 },
      { r: 15, h: 20, x: -90,  z: -300 },
      { r: 22, h: 28, x: -170, z: -220 },
      { r: 18, h: 24, x: -120, z: -200 },
      { r: 26, h: 30, x: -155, z: -290 },
      { r: 14, h: 18, x: -100, z: -340 },
      { r: 20, h: 25, x: -185, z: -260 },
      { r: 16, h: 22, x: -130, z: -180 },
      { r: 22, h: 26, x: -160, z: -310 },
      { r: 18, h: 20, x: -105, z: -240 },
      // Closer to road — foothills
      { r: 12, h: 15, x: -60,  z: -220 },
      { r: 14, h: 18, x: -70,  z: -300 },
      { r: 10, h: 14, x: -55,  z: -160 },
      { r: 16, h: 20, x: -80,  z: -260 },
      { r: 11, h: 14, x: -50,  z: -120 },
      { r: 13, h: 16, x: -65,  z: -180 },
      { r: 12, h: 15, x: -58,  z: -340 },
      { r: 14, h: 17, x: -75,  z: -140 },
    ];
    for (const cfg of brMtConfigs) {
      const geo = new THREE.ConeGeometry(cfg.r, cfg.h, 6 + ((cfg.r > 20) ? 2 : 0));
      const col = new THREE.Color(brMtColors[(cfg.r * 7 + cfg.h) % brMtColors.length]);
      const mt = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: col, roughness: 0.85, flatShading: true,
      }));
      mt.position.set(cfg.x, cfg.h / 2 - 3, cfg.z);
      this.scene.add(mt);
      this.themeObjects.push(mt);
      this.background.push(mt);
    }

    if (!this.modelsReady) return;

    // All buildings removed for performance

    // ── Palms lining the left side of the road ──
    for (let i = 0; i < 22; i++) {
      const x = -(RH + 3 + Math.random() * 15);
      this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 15 - Math.random() * 10,
        Math.random() * Math.PI * 2, 0.6 + Math.random() * 0.6, 'mg');
    }

    // ══════════════════════════════════════════
    //  RIGHT — Beach palms, boats
    // ══════════════════════════════════════════

    // Beach palms → foreground
    for (let i = 0; i < 5; i++) {
      const x = RH + 3 + Math.random() * 5;
      const lean = (Math.random() - 0.5) * 0.1;
      const model = this._placeModel(MODEL_URLS.palmTree, x, 0,
        -i * 30 - Math.random() * 15, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.3, 'fg');
      model.rotation.z = lean;
    }

    // ── Boats on ocean → background ──
    const boatColors = [0xcc3333, 0x3366cc, 0xeeeedd, 0x33aa66, 0xdd8833];
    for (let i = 0; i < 2; i++) {
      const boatGroup = new THREE.Group();
      const boatColor = boatColors[Math.floor(Math.random() * boatColors.length)];
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.4, 2),
        new THREE.MeshBasicMaterial({ color: boatColor }),
      );
      hull.position.y = 0.2;
      boatGroup.add(hull);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xeeeeee }),
      );
      cabin.position.set(0, 0.6, 0.2);
      boatGroup.add(cabin);

      boatGroup.position.set(
        RH + 25 + Math.random() * 30, -0.3,
        -i * 80 - Math.random() * 40,
      );
      boatGroup.rotation.y = Math.random() * Math.PI * 2;
      boatGroup.scale.setScalar(1.5 + Math.random());
      this.scene.add(boatGroup);
      this.themeObjects.push(boatGroup);
      this.background.push(boatGroup);
    }

    // ── Left road additional palms (sparser, inland) ──
    for (let i = 0; i < 2; i++) {
      const x = -(RH + 4 + Math.random() * 6);
      this._placeModel(MODEL_URLS.palmTree, x, 0,
        -i * 50 - Math.random() * 20, Math.random() * Math.PI * 2, 0.7 + Math.random() * 0.3, 'fg');
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

  /**
   * Pre-generate a shared pool of building window textures.
   * 3 style groups × 1 reference size = 3 base textures.
   */
  _buildWindowTexPool() {
    const REF = 6;
    const groups = [0x7B3020, 0x8A8A90, 0x445566]; // brick, concrete, glass
    const pool = {};
    for (let gi = 0; gi < groups.length; gi++) {
      const tex = this._buildingWindowTex(REF, REF, groups[gi], true);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      pool[`${gi}_${true}`] = tex;
    }
    return pool;
  }

  /** Create a procedural Chicago building using shared texture pool (single material). */
  _createChicagoBuilding(w, h, d, texPool) {
    // Random architectural style → map to 3 groups
    const styleGroups = [0, 0, 1, 1, 2, 1, 0]; // brick, brick, concrete, concrete, glass, concrete, brick
    const gi = styleGroups[(Math.random() * styleGroups.length) | 0];

    const segs = Math.max(2, (Math.max(w, d) / 1.5) | 0);
    const hSegs = Math.max(3, (h / 2.5) | 0);
    const REF = 6;

    // Single sun-facing texture for all faces (player moves fast, difference imperceptible)
    const tex = texPool[`${gi}_${true}`].clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(segs / REF, hSegs / REF);

    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = h / 2;
    return mesh;
  }

  _buildUSA() {
    const RH = ROAD_WIDTH / 2;

    // ── Chicago skyline backdrop (fixed, full-width horizon) ──
    const chiTex = new THREE.TextureLoader().load(asset('chicago.webp'));
    chiTex.colorSpace = THREE.SRGBColorSpace;
    const chiMat = new THREE.MeshBasicMaterial({
      map: chiTex, transparent: true, opacity: 0.55,
      depthWrite: false, side: THREE.FrontSide, fog: false,
    });
    const chiPlane = new THREE.Mesh(new THREE.PlaneGeometry(640, 160), chiMat);
    chiPlane.position.set(0, 35, -380);
    chiPlane.renderOrder = -1;
    this.scene.add(chiPlane);
    this.themeObjects.push(chiPlane);

    // ── Lake Michigan ──
    const lake = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 600),
      new THREE.MeshBasicMaterial({ color: 0x2a5577 }),
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(RH + 80, -0.2, -150);
    this.scene.add(lake);
    this.themeObjects.push(lake);

    // ══════════════════════════════════════════
    //  ROADSIDE PROPS
    // ══════════════════════════════════════════
    if (this.modelsReady) {
      this._scatterProps(
        [MODEL_URLS.dumpster, MODEL_URLS.trafficLight, MODEL_URLS.bench,
         MODEL_URLS.firehydrant, MODEL_URLS.trashcan, MODEL_URLS.mailbox],
        6, [2, 5], 55, 'fg',
      );
      this._scatterProps([MODEL_URLS.trafficCone], 3, [1.5, 2.5], 85, 'fg');
      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 2, [2.5, 5], 110, 'fg');
    }

    // ══════════════════════════════════════════
    //  MIDGROUND — Procedural buildings, single material each (60% scroll)
    // ══════════════════════════════════════════
    const texPool = this._buildWindowTexPool();
    for (const side of [-1, 1]) {
      let z = 10;
      while (z > -370) {
        const w = 6 + Math.random() * 8;
        const h = 6 + Math.random() * 14;
        const d = 4 + Math.random() * 5;
        const gap = 3 + Math.random() * 5;

        const bldg = this._createChicagoBuilding(w, h, d, texPool);
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
      new THREE.SphereGeometry(4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xaa9988 }),
    );
    bean.scale.set(1.4, 0.7, 1.0);
    bean.position.set(-(RH + 22), 2.5, -120);
    this.scene.add(bean);
    this.themeObjects.push(bean);
    this.midground.push(bean);

    // ── Grass strips along roadside (blends ground into vegetation) ──
    const grassMat = new THREE.MeshBasicMaterial({ color: 0x3a6a28 });
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(5, 600), grassMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(side * (RH + 3.5), 0.01, -150);
      this.scene.add(strip);
      this.themeObjects.push(strip);
    }

    // ── Street lamps (merged pole+fixture per lamp) ──
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, emissive: 0xffdd88, emissiveIntensity: 0.15 });
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 4, 5);
    const fixtureGeo = new THREE.SphereGeometry(0.15, 4, 3);
    poleGeo.translate(0, 2, 0);
    fixtureGeo.translate(0, 4.1, 0);
    const lampMerged = mergeGeometries([poleGeo, fixtureGeo], false);
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lamp = new THREE.Mesh(lampMerged, poleMat);
      lamp.position.set(side * (RH + 1.5), 0, -i * 35 - Math.random() * 10);
      this.scene.add(lamp);
      this.themeObjects.push(lamp);
      this.foreground.push(lamp);
    }

    // ── Signs (merged backing+pole per sign) ──
    const signColors = [0xcc4444, 0x3366aa, 0xddaa33, 0x448844, 0xcc6633];
    const signMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const signBackGeo = new THREE.BoxGeometry(2.5, 1.0, 0.1);
    const signPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 3, 4);
    signPoleGeo.translate(0, -2, 0);
    const signMerged = mergeGeometries([signBackGeo, signPoleGeo], false);
    for (let i = 0; i < 3; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sg = new THREE.Group();
      sg.add(new THREE.Mesh(signMerged, signMat));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7),
        new THREE.MeshBasicMaterial({ color: signColors[(Math.random() * signColors.length) | 0] }));
      face.position.z = 0.06;
      sg.add(face);
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

    // ── Machu Picchu backdrop (fixed horizon — never scrolls) ──
    const mpTex = new THREE.TextureLoader().load(asset('machu-pichu.webp'));
    mpTex.colorSpace = THREE.SRGBColorSpace;
    const mpMat = new THREE.MeshBasicMaterial({
      map: mpTex, transparent: true, opacity: 0.55,
      depthWrite: false, side: THREE.FrontSide, fog: false,
    });
    const mpPlane = new THREE.Mesh(new THREE.PlaneGeometry(560, 160), mpMat);
    mpPlane.position.set(0, 35, -380);
    mpPlane.renderOrder = -1; // render behind everything
    this.scene.add(mpPlane);
    this.themeObjects.push(mpPlane);
    // NOT added to any parallax layer — stays fixed on the horizon

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
    // Mixed green + brown palette for Andean mountains
    const peruMtColors = [0x4a7a33, 0x3a6a25, 0x6a8a45, 0x8a7a55, 0x7a6a45, 0x9a8a65, 0x5a7040, 0x6a6040];

    const mtConfigs = [
      // Central peaks (behind road)
      { r: 28, h: 55, x: -55, z: -250 },
      { r: 22, h: 48, x: 60,  z: -280 },
      { r: 20, h: 40, x: -80, z: -200 },
      { r: 24, h: 44, x: -90, z: -310 },
      { r: 18, h: 38, x: 40,  z: -220 },
      { r: 26, h: 50, x: -40, z: -300 },
      { r: 16, h: 35, x: 70,  z: -180 },
      { r: 20, h: 42, x: -65, z: -340 },
    ];
    for (const cfg of mtConfigs) {
      const mt = this._createAndeanMountain(cfg.r, cfg.h);
      mt.material.color.set(peruMtColors[(cfg.r + cfg.h) % peruMtColors.length]);
      mt.position.set(cfg.x, cfg.h / 2 - 4, cfg.z);
      const dist = Math.abs(cfg.z) / 350;
      if (dist > 0.3) mt.material.color.lerp(new THREE.Color(0xaabbcc), dist * 0.25);
      this.scene.add(mt);
      this.themeObjects.push(mt);
      this.background.push(mt);

      if (cfg.h > 40) {
        const rr = cfg.r * 0.6;
        const rh = cfg.h * 0.5;
        const ridge = this._createAndeanMountain(rr, rh);
        ridge.material.color.set(peruMtColors[(cfg.r + cfg.h + 3) % peruMtColors.length]);
        ridge.position.set(cfg.x + cfg.r * 0.3, rh / 2 - 4, cfg.z - 8);
        if (dist > 0.3) ridge.material.color.lerp(new THREE.Color(0xaabbcc), dist * 0.25);
        this.scene.add(ridge);
        this.themeObjects.push(ridge);
        this.background.push(ridge);
      }
    }

    // ── Big flanking mountain ranges (both sides) ──
    const flankConfigs = [
      // Left side
      { r: 35, h: 65, x: -110, z: -120 },
      { r: 30, h: 58, x: -125, z: -200 },
      { r: 40, h: 70, x: -105, z: -320 },
      { r: 28, h: 50, x: -140, z: -160 },
      { r: 32, h: 55, x: -115, z: -260 },
      { r: 22, h: 42, x: -95,  z: -180 },
      { r: 26, h: 48, x: -130, z: -290 },
      { r: 18, h: 36, x: -100, z: -340 },
      { r: 34, h: 60, x: -120, z: -370 },
      // Right side
      { r: 34, h: 62, x: 115,  z: -140 },
      { r: 38, h: 68, x: 105,  z: -230 },
      { r: 30, h: 55, x: 130,  z: -300 },
      { r: 26, h: 48, x: 120,  z: -180 },
      { r: 36, h: 60, x: 110,  z: -350 },
      { r: 22, h: 40, x: 100,  z: -160 },
      { r: 28, h: 52, x: 125,  z: -260 },
      { r: 20, h: 38, x: 95,   z: -320 },
      { r: 32, h: 56, x: 115,  z: -400 },
    ];
    for (const cfg of flankConfigs) {
      const mt = this._createAndeanMountain(cfg.r, cfg.h);
      mt.material.color.set(peruMtColors[(cfg.r * 3 + cfg.h) % peruMtColors.length]);
      mt.position.set(cfg.x, cfg.h / 2 - 4, cfg.z);
      const dist = Math.abs(cfg.z) / 400;
      mt.material.color.lerp(new THREE.Color(0x9aaabb), dist * 0.3);
      this.scene.add(mt);
      this.themeObjects.push(mt);
      this.background.push(mt);
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

    // Trees, rocks, and GLTF buildings removed for performance
  }

  // =====================================================================
  //  SHANGHAI SKY (dawn/dusk gradient — lavender to peach)
  // =====================================================================
  _buildShanghaiSky() {
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
          vec3 zenith  = vec3(0.22, 0.35, 0.60);   // crisp morning blue
          vec3 upper   = vec3(0.40, 0.55, 0.75);   // light blue
          vec3 mid     = vec3(0.65, 0.70, 0.80);   // pale sky
          vec3 lower   = vec3(0.90, 0.75, 0.65);   // warm peach-pink
          vec3 horizon = vec3(1.00, 0.80, 0.55);   // golden sunrise glow

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

    // Morning clouds — cool white/pink tints
    const cloudTex = this._makeCloudTexture();
    const tints = [0xeeddff, 0xffddcc, 0xddeeff];
    for (let i = 0; i < 3; i++) {
      const w = 40 + Math.random() * 50;
      const h = 6 + Math.random() * 6;
      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true,
        opacity: 0.3 + Math.random() * 0.15,
        depthWrite: false, side: THREE.DoubleSide,
        color: tints[i],
      });
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloudMat);
      cloud.position.set(
        -70 + Math.random() * 140,
        30 + Math.random() * 25,
        -150 - Math.random() * 150,
      );
      cloud.lookAt(0, cloud.position.y, 0);
      this.scene.add(cloud);
      this.themeObjects.push(cloud);
      this.background.push(cloud);
    }
  }

  // =====================================================================
  //  SHANGHAI — Bund buildings + pagodas (left), Huangpu River + Pudong (right)
  // =====================================================================
  _buildShanghai() {
    const RH = ROAD_WIDTH / 2;

    // No river — buildings on BOTH sides like Chicago.
    // Pudong skyline far in background, Chinese hoardings on left.

    // ── Sidewalk strips (both sides) ──
    const sidewalkMat = new THREE.MeshBasicMaterial({ color: 0x555550 });
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(5, 600), sidewalkMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(side * (RH + 3.5), 0.01, -150);
      this.scene.add(strip);
      this.themeObjects.push(strip);
    }

    // ══════════════════════════════════════════
    //  ROADSIDE PROPS
    // ══════════════════════════════════════════
    if (this.modelsReady) {
      this._scatterProps(
        [MODEL_URLS.bench, MODEL_URLS.trafficLight, MODEL_URLS.trashcan,
         MODEL_URLS.firehydrant, MODEL_URLS.trafficCone],
        6, [2, 5], 55, 'fg',
      );
    }

    // ══════════════════════════════════════════
    //  MIDGROUND — Buildings on BOTH sides (like Chicago)
    // ══════════════════════════════════════════
    const texPool = this._buildShanghaiTexPool();
    for (const side of [-1, 1]) {
      let z = 10;
      while (z > -370) {
        const w = 5 + Math.random() * 8;
        const h = 6 + Math.random() * 14;
        const d = 4 + Math.random() * 5;
        const gap = 3 + Math.random() * 4;
        const bldg = this._createShanghaiBuilding(w, h, d, texPool);
        bldg.position.x = side * (RH + 8 + d / 2 + Math.random() * 3);
        bldg.position.z = z - w / 2;
        this.scene.add(bldg);
        this.themeObjects.push(bldg);
        this.midground.push(bldg);
        z -= w + gap;
      }
    }

    // ══════════════════════════════════════════
    //  MIDGROUND LEFT — Pagodas rising above buildings
    // ══════════════════════════════════════════
    const pagodaMat = new THREE.MeshStandardMaterial({ color: 0x8b3510, roughness: 0.75 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.7 });

    for (const pp of [
      { x: -(RH + 20), z: -70, levels: 6, scale: 1.0 },
      { x: -(RH + 24), z: -200, levels: 4, scale: 0.85 },
      { x: -(RH + 18), z: -330, levels: 5, scale: 0.75 },
    ]) {
      const pg = new THREE.Group();
      for (let lv = 0; lv < pp.levels; lv++) {
        const sc = 1 - lv * 0.13;
        const bw = 5 * sc;
        const body = new THREE.Mesh(new THREE.BoxGeometry(bw, 2.5, bw), pagodaMat);
        body.position.y = lv * 3.5 + 1.25; pg.add(body);
        const rw = bw + 1.5;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(rw * 0.7, 1.2, 4), roofMat);
        roof.position.y = lv * 3.5 + 2.9; roof.rotation.y = Math.PI / 4; pg.add(roof);
      }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.2, 3, 6), goldMat);
      spire.position.y = pp.levels * 3.5 + 1.5; pg.add(spire);
      pg.scale.setScalar(pp.scale);
      pg.position.set(pp.x, 0, pp.z);
      this.scene.add(pg); this.themeObjects.push(pg); this.midground.push(pg);
    }

    // ── Chinese paifang gates (left side) ──
    const gateMat = new THREE.MeshStandardMaterial({ color: 0xaa2222, roughness: 0.7 });
    for (const gz of [-140, -280]) {
      const gg = new THREE.Group();
      for (const gx of [-2.5, 2.5]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 7, 6), gateMat);
        p.position.set(gx, 3.5, 0); gg.add(p);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 1), gateMat);
      beam.position.y = 7; gg.add(beam);
      const gr = new THREE.Mesh(new THREE.ConeGeometry(4, 1.5, 4), roofMat);
      gr.position.y = 8; gr.rotation.y = Math.PI / 4; gg.add(gr);
      gg.position.set(-(RH + 14), 0, gz);
      this.scene.add(gg); this.themeObjects.push(gg); this.midground.push(gg);
    }

    // ── Chinese hoardings/signs (left side, above buildings) ──
    const signTexts = ['上海', '火锅', '奶茶', '小笼包', '饺子', '福'];
    const signBgColors = ['#cc2222', '#dd8811', '#2255aa', '#228833', '#cc2266', '#aa6600'];
    const hoardingTextures = signTexts.map((txt, i) => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      const cx = c.getContext('2d');
      cx.fillStyle = signBgColors[i];
      cx.fillRect(0, 0, 128, 64);
      // Gold border
      cx.strokeStyle = '#ffcc44';
      cx.lineWidth = 4;
      cx.strokeRect(4, 4, 120, 56);
      cx.fillStyle = '#ffdd44';
      cx.font = 'bold 36px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(txt, 64, 34);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      return t;
    });
    for (let i = 0; i < 6; i++) {
      const hg = new THREE.Group();
      // Sign board
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 0.1),
        new THREE.MeshBasicMaterial({ map: hoardingTextures[i] }));
      hg.add(board);
      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 4),
        new THREE.MeshStandardMaterial({ color: 0x555555 }));
      pole.position.y = -2; hg.add(pole);
      const side = i % 2 === 0 ? -1 : 1;
      hg.position.set(side * (RH + 5 + Math.random() * 2), 5 + Math.random() * 2, -i * 50 - 20);
      this.scene.add(hg); this.themeObjects.push(hg); this.midground.push(hg);
    }

    // ══════════════════════════════════════════
    //  BACKGROUND — Pudong skyline (far, visible between buildings)
    // ══════════════════════════════════════════

    // Distant skyline buildings on both sides
    const bgColors = [0x556677, 0x445566, 0x667788, 0x334455, 0x778899];
    for (let i = 0; i < 12; i++) {
      const w = 4 + Math.random() * 6;
      const h = 15 + Math.random() * 30;
      const d = 4 + Math.random() * 5;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color: bgColors[i % bgColors.length] }),
      );
      const side = i < 6 ? 1 : -1;
      bldg.position.set(
        side * (RH + 35 + Math.random() * 45), h / 2,
        -i * 30 - 60 - Math.random() * 30,
      );
      this.scene.add(bldg); this.themeObjects.push(bldg); this.background.push(bldg);
    }

    // ── Oriental Pearl Tower (far right, visible between right-side buildings) ──
    const pearlGroup = new THREE.Group();
    const pearlMat = new THREE.MeshStandardMaterial({
      color: 0xccbbcc, metalness: 0.6, roughness: 0.2,
      emissive: 0xff4488, emissiveIntensity: 0.15,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 45, 8), pearlMat);
    shaft.position.y = 22.5; pearlGroup.add(shaft);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff6699, metalness: 0.4, roughness: 0.3, emissive: 0xff2266, emissiveIntensity: 0.3 });
    const ls = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), sphereMat);
    ls.position.y = 14; pearlGroup.add(ls);
    const us = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), sphereMat);
    us.position.y = 35; pearlGroup.add(us);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 8, 6), pearlMat);
    spire.position.y = 49; pearlGroup.add(spire);
    pearlGroup.position.set(RH + 60, 0, -150);
    this.scene.add(pearlGroup); this.themeObjects.push(pearlGroup); this.background.push(pearlGroup);

    // ── Shanghai Tower (tallest) ──
    const shTower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 60, 6),
      new THREE.MeshStandardMaterial({ color: 0x6688aa, metalness: 0.7, roughness: 0.15, emissive: 0x334466, emissiveIntensity: 0.2 }));
    shTower.position.set(RH + 75, 30, -280);
    this.scene.add(shTower); this.themeObjects.push(shTower); this.background.push(shTower);

    // ── SWFC ──
    const swfc = new THREE.Mesh(new THREE.BoxGeometry(4, 50, 4),
      new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.6, roughness: 0.2, emissive: 0x223344, emissiveIntensity: 0.15 }));
    swfc.position.set(RH + 65, 25, -300);
    this.scene.add(swfc); this.themeObjects.push(swfc); this.background.push(swfc);

    // ── Jin Mao Tower ──
    const jinMao = new THREE.Mesh(new THREE.BoxGeometry(3.5, 40, 3.5),
      new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.5, roughness: 0.2, emissive: 0x445566, emissiveIntensity: 0.15 }));
    jinMao.position.set(-(RH + 55), 20, -350);
    this.scene.add(jinMao); this.themeObjects.push(jinMao); this.background.push(jinMao);

    // ══════════════════════════════════════════
    //  FOREGROUND — Lamps, trees, signs
    // ══════════════════════════════════════════

    // ── Street lamps (both sides) ──
    const lampPoleMat = new THREE.MeshStandardMaterial({
      color: 0x222222, metalness: 0.6, roughness: 0.2,
      emissive: 0xffaa55, emissiveIntensity: 0.1,
    });
    const lpGeo = new THREE.CylinderGeometry(0.04, 0.05, 4.5, 5);
    const lfGeo = new THREE.SphereGeometry(0.2, 4, 3);
    lpGeo.translate(0, 2.25, 0);
    lfGeo.translate(0, 4.6, 0);
    const lampMerged = mergeGeometries([lpGeo, lfGeo], false);
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lamp = new THREE.Mesh(lampMerged, lampPoleMat);
      lamp.position.set(side * (RH + 1.5), 0, -i * 35 - Math.random() * 10);
      this.scene.add(lamp); this.themeObjects.push(lamp); this.foreground.push(lamp);
    }

    // ── Trees (both sides, between buildings) ──
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.8 });
    for (let i = 0; i < 8; i++) {
      const tg = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.5, 5), trunkMat);
      trunk.position.y = 1.25; tg.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.5, 6, 5), leafMat);
      canopy.position.y = 3.5; canopy.scale.set(1, 0.7, 1); tg.add(canopy);
      const side = i % 2 === 0 ? -1 : 1;
      tg.position.set(side * (RH + 2.5 + Math.random() * 2), 0, -i * 40 - Math.random() * 15);
      this.scene.add(tg); this.themeObjects.push(tg); this.foreground.push(tg);
    }

    // ── Chinese street stalls (food carts + shops) ──
    const stallWood = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.8 });
    const stallNames = ['包子', '烧烤', '奶茶', '炒面', '饺子'];
    const stallBgs = ['#cc2222', '#dd7711', '#22aa44', '#2255bb', '#cc2266'];
    const stallSignTex = stallNames.map((name, i) => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 48;
      const cx = c.getContext('2d');
      cx.fillStyle = stallBgs[i];
      cx.fillRect(0, 0, 128, 48);
      cx.strokeStyle = '#ffcc44'; cx.lineWidth = 3;
      cx.strokeRect(3, 3, 122, 42);
      cx.fillStyle = '#ffdd44';
      cx.font = 'bold 26px sans-serif';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(name, 64, 25);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      return t;
    });
    const canopyColors = [0xcc2222, 0xdd8811, 0x228833, 0x2255aa, 0xcc2266];
    for (let i = 0; i < 5; i++) {
      const sg = new THREE.Group();
      // Cart body
      const cart = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 1.2), stallWood);
      cart.position.y = 0.9; sg.add(cart);
      // Counter shelf
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x554433 }));
      shelf.position.set(0, 0.95, 0.8); sg.add(shelf);
      // Canopy with Chinese curved roof shape
      const canopyBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 2),
        new THREE.MeshBasicMaterial({ color: canopyColors[i] }));
      canopyBase.position.set(0, 2.1, 0.2); sg.add(canopyBase);
      const canopyRoof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 4),
        new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
      canopyRoof.position.set(0, 2.5, 0.2); canopyRoof.rotation.y = Math.PI / 4; sg.add(canopyRoof);
      // Sign with Chinese text
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.05),
        new THREE.MeshBasicMaterial({ map: stallSignTex[i] }));
      sign.position.set(0, 2.15, 0.95); sg.add(sign);
      // Small stool
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 5),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.3 }));
      stool.position.set(0.5, 0.2, 1.2); sg.add(stool);
      // Steam pot (round on counter)
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 6),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 }));
      pot.position.set(-0.3, 1.15, 0.5); sg.add(pot);

      const side = i % 2 === 0 ? -1 : 1;
      sg.position.set(side * (RH + 2.5), 0, -i * 60 - 25);
      sg.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.scene.add(sg); this.themeObjects.push(sg); this.foreground.push(sg);
    }

    // ── Red lanterns (hanging between lamp posts — Chinese street vibe) ──
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    for (let i = 0; i < 6; i++) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), lanternMat);
      const side = i % 2 === 0 ? -1 : 1;
      lantern.position.set(side * (RH + 1.2), 3.8, -i * 45 - 10 - Math.random() * 10);
      lantern.scale.set(1, 1.3, 1);
      this.scene.add(lantern); this.themeObjects.push(lantern); this.foreground.push(lantern);
    }
  }

  /** Procedural texture for Shanghai Bund-style buildings. */
  _shanghaiWindowTex(wSegs, hSegs, wallColor) {
    const cW = 16, cH = 20;
    const canvas = document.createElement('canvas');
    canvas.width = wSegs * cW;
    canvas.height = hSegs * cH;
    const ctx = canvas.getContext('2d');
    const wc = new THREE.Color(wallColor);
    ctx.fillStyle = `rgb(${wc.r * 255 | 0},${wc.g * 255 | 0},${wc.b * 255 | 0})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Horizontal floor lines (colonial style)
    for (let y = 0; y < hSegs; y++) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, y * cH, canvas.width, 1);
    }
    for (let y = 0; y < hSegs; y++) {
      for (let x = 0; x < wSegs; x++) {
        const wx = x * cW + 3, wy = y * cH + 4, ww = cW - 6, wh = cH - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
        if (Math.random() > 0.2) {
          const r = 200 + (Math.random() * 55 | 0);
          const g = 160 + (Math.random() * 50 | 0);
          const b = 60 + (Math.random() * 50 | 0);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          const d = 20 + (Math.random() * 20 | 0);
          ctx.fillStyle = `rgb(${d},${d + 5},${d + 15})`;
        }
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
    // Ground floor shopfront
    if (hSegs > 2) {
      const gy = (hSegs - 1) * cH;
      const awnings = ['#cc2222', '#ddaa11', '#226633', '#2255aa'];
      ctx.fillStyle = awnings[(Math.random() * awnings.length) | 0];
      ctx.fillRect(1, gy, canvas.width - 2, 4);
    }
    // Cornice at top
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, canvas.width, 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  _buildShanghaiTexPool() {
    const REF = 6;
    // Bund colonial palette: warm brick, cream stone, gray concrete, terracotta
    const colors = [0x8B5533, 0xDDCCAA, 0x889988, 0xBB7744, 0x776666];
    const pool = {};
    for (let gi = 0; gi < colors.length; gi++) {
      const tex = this._shanghaiWindowTex(REF, REF, colors[gi]);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      pool[gi] = tex;
    }
    return pool;
  }

  _createShanghaiBuilding(w, h, d, texPool) {
    const poolSize = 5;
    const gi = (Math.random() * poolSize) | 0;
    const segs = Math.max(2, (Math.max(w, d) / 1.5) | 0);
    const hSegs = Math.max(3, (h / 2.5) | 0);
    const REF = 6;
    const tex = texPool[gi].clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(segs / REF, hSegs / REF);

    const group = new THREE.Group();

    // Building body
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    group.add(body);

    // Chinese curved roof on top (wider than building, dark tiles)
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const roofW = w + 1.5;
    const roofD = d + 1.0;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(roofW * 0.55, 1.8, 4), roofMat);
    roof.position.y = h + 0.6;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Ridge ornament (gold tip on some buildings)
    if (Math.random() > 0.4) {
      const ridgeMat = new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.6 });
      const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1, 4), ridgeMat);
      ridge.position.y = h + 1.8;
      group.add(ridge);
    }

    // Eave overhang (flat wider rim under the roof — classic Chinese style)
    const eaveMat = new THREE.MeshBasicMaterial({ color: 0x2a2222 });
    const eave = new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.15, roofD), eaveMat);
    eave.position.y = h + 0.05;
    group.add(eave);

    return group;
  }

  // =====================================================================
  //  DELHI SKY — warm dusk gradient (saffron → deep indigo)
  // =====================================================================
  _buildDelhiSky() {
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
          vec3 zenith  = vec3(0.10, 0.08, 0.22);   // deep indigo night
          vec3 upper   = vec3(0.20, 0.14, 0.38);   // purple-blue
          vec3 mid     = vec3(0.50, 0.30, 0.45);   // dusky mauve
          vec3 lower   = vec3(0.85, 0.50, 0.30);   // warm saffron
          vec3 horizon = vec3(1.00, 0.70, 0.35);   // golden-orange haze

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

    // Warm-tinted clouds
    const cloudTex = this._makeCloudTexture();
    const tints = [0xffcc88, 0xffaa66, 0xeebb77];
    for (let i = 0; i < 3; i++) {
      const w = 40 + Math.random() * 50;
      const h = 6 + Math.random() * 6;
      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true,
        opacity: 0.3 + Math.random() * 0.15,
        depthWrite: false, side: THREE.DoubleSide,
        color: tints[i],
      });
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloudMat);
      cloud.position.set(
        -70 + Math.random() * 140,
        30 + Math.random() * 25,
        -150 - Math.random() * 150,
      );
      cloud.lookAt(0, cloud.position.y, 0);
      this.scene.add(cloud);
      this.themeObjects.push(cloud);
      this.background.push(cloud);
    }
  }

  // =====================================================================
  //  DELHI — Indian street with temples, colorful havelis, banyan trees
  // =====================================================================

  /** Procedural texture for vibrant Indian haveli buildings. */
  _delhiHaveliTex(wSegs, hSegs, wallColor) {
    const cW = 16, cH = 20;
    const canvas = document.createElement('canvas');
    canvas.width = wSegs * cW;
    canvas.height = hSegs * cH;
    const ctx = canvas.getContext('2d');
    const wc = new THREE.Color(wallColor);
    ctx.fillStyle = `rgb(${wc.r * 255 | 0},${wc.g * 255 | 0},${wc.b * 255 | 0})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Horizontal decorative bands between floors (Rajasthani pattern)
    for (let y = 0; y < hSegs; y++) {
      ctx.fillStyle = 'rgba(255,220,120,0.3)';
      ctx.fillRect(0, y * cH, canvas.width, 2);
    }

    for (let y = 0; y < hSegs; y++) {
      for (let x = 0; x < wSegs; x++) {
        const wx = x * cW + 2, wy = y * cH + 4, ww = cW - 4, wh = cH - 7;
        // Arched window frame (bright contrast)
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
        // Draw arch top
        ctx.beginPath();
        ctx.arc(wx + ww / 2, wy, ww / 2, Math.PI, 0);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();

        // Bright warm window interior (lit up)
        if (Math.random() > 0.2) {
          const warmR = 220 + (Math.random() * 35 | 0);
          const warmG = 150 + (Math.random() * 70 | 0);
          const warmB = 40 + (Math.random() * 60 | 0);
          ctx.fillStyle = `rgb(${warmR},${warmG},${warmB})`;
        } else {
          // Some dark windows
          const d = 20 + (Math.random() * 15 | 0);
          ctx.fillStyle = `rgb(${d},${d + 5},${d + 10})`;
        }
        ctx.fillRect(wx, wy, ww, wh);

        // Tiny balcony rail on some windows
        if (Math.random() > 0.5) {
          ctx.fillStyle = 'rgba(200,170,80,0.6)';
          ctx.fillRect(wx - 1, wy + wh - 2, ww + 2, 2);
        }
      }
    }
    // Ground-floor shopfronts (vivid Indian market colors)
    if (hSegs > 2) {
      const gy = (hSegs - 1) * cH;
      const awnings = ['#ff4422', '#dd2266', '#22aa55', '#ff9911', '#7722cc', '#dd6600', '#2288bb'];
      ctx.fillStyle = awnings[(Math.random() * awnings.length) | 0];
      ctx.fillRect(1, gy, canvas.width - 2, 5);
    }
    // Bold decorative trim at roofline (gold/white)
    ctx.fillStyle = '#ddcc66';
    ctx.fillRect(0, 0, canvas.width, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 3, canvas.width, 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  /** Pool of 6 haveli wall styles — vivid Rajasthani palette. */
  _buildHaveliTexPool() {
    const REF = 6;
    const colors = [
      0xEE6633,  // bright terracotta orange
      0xDDBB22,  // vivid marigold yellow
      0xDD5588,  // Jaipur pink
      0x44AAAA,  // teal / turquoise (Jodhpur blue-ish)
      0xCC4444,  // deep red (sandstone)
      0x88BB44,  // lime green
    ];
    const pool = {};
    for (let gi = 0; gi < colors.length; gi++) {
      const tex = this._delhiHaveliTex(REF, REF, colors[gi]);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      pool[gi] = tex;
    }
    return pool;
  }

  /** Create a single procedural haveli building (shared texture pool). */
  _createHaveli(w, h, d, texPool) {
    const poolSize = 6;
    const gi = (Math.random() * poolSize) | 0;
    const segs = Math.max(2, (Math.max(w, d) / 1.5) | 0);
    const hSegs = Math.max(3, (h / 2.5) | 0);
    const REF = 6;
    const tex = texPool[gi].clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(segs / REF, hSegs / REF);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = h / 2;
    return mesh;
  }

  _buildDelhi() {
    const RH = ROAD_WIDTH / 2;

    // Layout: LEFT = havelis + temples + trees | RIGHT = open lake + Taj + fort
    // No backdrop image, no right-side buildings — clean lake view.

    // ── LAKE — right side only, bright blue, sits ABOVE ground (ground is Y=-0.1) ──
    // PlaneGeometry is centered on its position, so width 200 at X = RH+108
    // covers from X=8 (just past road edge) to X=208 — right side only.
    const lake = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 600),
      new THREE.MeshBasicMaterial({ color: 0x2288bb }),
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(RH + 108, 0.0, -150);
    this.scene.add(lake);
    this.themeObjects.push(lake);

    // ── Grass strip (LEFT side only) ──
    const grassStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 600),
      new THREE.MeshBasicMaterial({ color: 0x3a5a28 }),
    );
    grassStrip.rotation.x = -Math.PI / 2;
    grassStrip.position.set(-(RH + 3.5), 0.01, -150);
    this.scene.add(grassStrip);
    this.themeObjects.push(grassStrip);

    // ══════════════════════════════════════════
    //  ROADSIDE PROPS (LEFT side only)
    // ══════════════════════════════════════════
    if (this.modelsReady) {
      this._scatterProps(
        [MODEL_URLS.bench, MODEL_URLS.trafficLight, MODEL_URLS.trashcan],
        4, [2, 4], 70, 'fg',
      );
    }

    // ══════════════════════════════════════════
    //  MIDGROUND — LEFT side ONLY: colorful havelis
    // ══════════════════════════════════════════
    const haveliPool = this._buildHaveliTexPool();
    {
      let z = 10;
      while (z > -370) {
        const w = 5 + Math.random() * 6;
        const h = 4 + Math.random() * 8;
        const d = 3 + Math.random() * 4;
        const gap = 2 + Math.random() * 4;

        const bldg = this._createHaveli(w, h, d, haveliPool);
        bldg.position.x = -(RH + 8 + d / 2 + Math.random() * 3);
        bldg.position.z = z - w / 2;
        this.scene.add(bldg);
        this.themeObjects.push(bldg);
        this.midground.push(bldg);

        z -= w + gap;
      }
    }

    // ══════════════════════════════════════════
    //  MIDGROUND — LEFT: Temple gopurams (rise above havelis)
    // ══════════════════════════════════════════
    const templeStoneMat = new THREE.MeshStandardMaterial({
      color: 0xaa7744, roughness: 0.75, metalness: 0.05,
      emissive: 0x553322, emissiveIntensity: 0.1,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xccaa44, metalness: 0.6, roughness: 0.3,
    });

    for (const tp of [
      { x: -(RH + 18), z: -60, scale: 1.0 },
      { x: -(RH + 22), z: -180, scale: 0.85 },
      { x: -(RH + 16), z: -300, scale: 0.7 },
    ]) {
      const templeGroup = new THREE.Group();
      const levels = 5;
      for (let lv = 0; lv < levels; lv++) {
        const sc = 1 - lv * 0.14;
        const bw = 5 * sc;
        const bh = 2.5;
        const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), templeStoneMat);
        body.position.y = lv * 3 + bh / 2;
        templeGroup.add(body);
      }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(1, 5, 6), goldMat);
      spire.position.y = levels * 3 + 2.5;
      templeGroup.add(spire);
      templeGroup.scale.setScalar(tp.scale);
      templeGroup.position.set(tp.x, 0, tp.z);
      this.scene.add(templeGroup);
      this.themeObjects.push(templeGroup);
      this.midground.push(templeGroup);
    }

    // ── Mughal archway gates (LEFT side) ──
    const archMat = new THREE.MeshStandardMaterial({ color: 0xcc8844, roughness: 0.7 });
    const archDomeMat = new THREE.MeshStandardMaterial({ color: 0xddaa55, roughness: 0.5 });
    for (const az of [-120, -250]) {
      const ag = new THREE.Group();
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 8, 1.5), archMat);
      p1.position.set(-2.5, 4, 0); ag.add(p1);
      const p2 = p1.clone(); p2.position.set(2.5, 4, 0); ag.add(p2);
      const top = new THREE.Mesh(new THREE.BoxGeometry(7, 1.5, 1.5), archMat);
      top.position.y = 8.5; ag.add(top);
      const ad = new THREE.Mesh(
        new THREE.SphereGeometry(2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), archDomeMat);
      ad.position.y = 9.5; ag.add(ad);
      ag.position.set(-(RH + 14), 0, az);
      this.scene.add(ag);
      this.themeObjects.push(ag);
      this.midground.push(ag);
    }

    // ══════════════════════════════════════════
    //  BACKGROUND — Delhi landmarks across the lake (like Shanghai skyline)
    //  Spread across Z: Lotus Temple, Qutub Minar, Red Fort
    // ══════════════════════════════════════════

    // Shared materials
    const sandstoneMat = new THREE.MeshStandardMaterial({
      color: 0xcc9966, roughness: 0.75, metalness: 0.05,
      emissive: 0x553322, emissiveIntensity: 0.08,
    });
    const redStoneMat = new THREE.MeshStandardMaterial({
      color: 0x8b4422, roughness: 0.7,
      emissive: 0x331100, emissiveIntensity: 0.1,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf0e8dd, roughness: 0.3, metalness: 0.1,
      emissive: 0xeeddcc, emissiveIntensity: 0.1,
    });
    const goldFinialMat = new THREE.MeshStandardMaterial({
      color: 0xccaa44, metalness: 0.6, roughness: 0.3,
    });

    // ── 1. LOTUS TEMPLE (Z = -80) — iconic petal-shaped Bahai temple ──
    const lotusGroup = new THREE.Group();
    // Base platform (circular)
    const lotusBase = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 10, 2, 12), sandstoneMat);
    lotusBase.position.y = 1;
    lotusGroup.add(lotusBase);
    // Inner pool ring
    const poolRing = new THREE.Mesh(
      new THREE.CylinderGeometry(9.5, 9.5, 0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x3399cc }),
    );
    poolRing.position.y = 0.15;
    lotusGroup.add(poolRing);
    // Outer petals (9 petals arranged in a circle, leaning outward)
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xf5f0e8, metalness: 0.2, roughness: 0.2,
      emissive: 0xffeedd, emissiveIntensity: 0.15,
    });
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      // Outer petal (tall, leaning out)
      const outerPetal = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 12, 4), petalMat);
      outerPetal.position.set(Math.cos(angle) * 5, 8, Math.sin(angle) * 5);
      outerPetal.rotation.x = Math.sin(angle) * 0.25;
      outerPetal.rotation.z = -Math.cos(angle) * 0.25;
      lotusGroup.add(outerPetal);
      // Inner petal (shorter, more upright)
      const innerPetal = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 9, 4), petalMat);
      innerPetal.position.set(Math.cos(angle) * 3, 6.5, Math.sin(angle) * 3);
      innerPetal.rotation.x = Math.sin(angle) * 0.1;
      innerPetal.rotation.z = -Math.cos(angle) * 0.1;
      lotusGroup.add(innerPetal);
    }
    // Central spire
    const lotusCrown = new THREE.Mesh(
      new THREE.ConeGeometry(1, 5, 6), petalMat);
    lotusCrown.position.y = 16;
    lotusGroup.add(lotusCrown);

    lotusGroup.position.set(RH + 50, 0, -80);
    this.scene.add(lotusGroup);
    this.themeObjects.push(lotusGroup);
    this.background.push(lotusGroup);

    // ── 2. QUTUB MINAR (Z = -180) — tapered tower with gate ──
    const qutubGroup = new THREE.Group();
    // Base platform
    const qPlatform = new THREE.Mesh(new THREE.BoxGeometry(16, 1.5, 10), sandstoneMat);
    qPlatform.position.y = 0.75;
    qutubGroup.add(qPlatform);
    // Tower — 5 tapered tiers, alternating red/sandstone
    let towerY = 1.5;
    for (let t = 0; t < 5; t++) {
      const botR = 2.2 - t * 0.35;
      const topR = botR - 0.25;
      const tierH = 7 - t * 0.8;
      const tier = new THREE.Mesh(
        new THREE.CylinderGeometry(topR, botR, tierH, 8),
        t % 2 === 0 ? redStoneMat : sandstoneMat);
      tier.position.y = towerY + tierH / 2;
      qutubGroup.add(tier);
      if (t < 4) {
        const balcony = new THREE.Mesh(
          new THREE.CylinderGeometry(topR + 0.4, topR + 0.4, 0.4, 8), whiteMat);
        balcony.position.y = towerY + tierH;
        qutubGroup.add(balcony);
      }
      towerY += tierH;
    }
    const qCap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2, 6), whiteMat);
    qCap.position.y = towerY + 1;
    qutubGroup.add(qCap);
    // Alai Darwaza (gate with dome)
    const gateBody = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), sandstoneMat);
    gateBody.position.set(-5, 4, 0);
    qutubGroup.add(gateBody);
    const gateArch = new THREE.Mesh(new THREE.BoxGeometry(2, 3.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    gateArch.position.set(-5, 3, 2.6);
    qutubGroup.add(gateArch);
    const gateDome = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), whiteMat);
    gateDome.position.set(-5, 6.5, 0);
    qutubGroup.add(gateDome);
    const gateFinial = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.5, 5), goldFinialMat);
    gateFinial.position.set(-5, 9.5, 0);
    qutubGroup.add(gateFinial);

    qutubGroup.position.set(RH + 55, 0, -180);
    this.scene.add(qutubGroup);
    this.themeObjects.push(qutubGroup);
    this.background.push(qutubGroup);

    // ── 3. RED FORT (Z = -280) — iconic Mughal fortress ──
    const fortGroup = new THREE.Group();
    // Main wall (long, red sandstone)
    const fortWall = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 5), redStoneMat);
    fortWall.position.y = 5;
    fortGroup.add(fortWall);
    // Crenellations along the top
    for (let c = -13; c <= 13; c += 2.5) {
      const cren = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 5.2), redStoneMat);
      cren.position.set(c, 11, 0);
      fortGroup.add(cren);
    }
    // Two corner towers
    for (const tx of [-15, 15]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 14, 8), redStoneMat);
      tower.position.set(tx, 7, 0);
      fortGroup.add(tower);
      // Domed cap on each tower
      const tCap = new THREE.Mesh(
        new THREE.SphereGeometry(2.8, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), whiteMat);
      tCap.position.set(tx, 14, 0);
      fortGroup.add(tCap);
      const tFinial = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.5, 5), goldFinialMat);
      tFinial.position.set(tx, 17, 0);
      fortGroup.add(tFinial);
    }
    // Central gate (Lahori Gate)
    const mainGate = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 6), redStoneMat);
    mainGate.position.y = 7;
    fortGroup.add(mainGate);
    const mainGateArch = new THREE.Mesh(new THREE.BoxGeometry(3.5, 7, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    mainGateArch.position.set(0, 5, 3.1);
    fortGroup.add(mainGateArch);
    // Central dome
    const mainDome = new THREE.Mesh(
      new THREE.SphereGeometry(4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), whiteMat);
    mainDome.position.y = 14;
    fortGroup.add(mainDome);
    const mainFinial = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2, 5), goldFinialMat);
    mainFinial.position.y = 18.5;
    fortGroup.add(mainFinial);

    fortGroup.position.set(RH + 50, 0, -280);
    this.scene.add(fortGroup);
    this.themeObjects.push(fortGroup);
    this.background.push(fortGroup);

    // Distant buildings far LEFT (behind temples)
    const bgColors = [0x8b6644, 0x776655, 0x996644, 0x665544, 0x887766];
    for (let i = 0; i < 6; i++) {
      const w = 4 + Math.random() * 6;
      const h = 10 + Math.random() * 20;
      const d = 4 + Math.random() * 5;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color: bgColors[i % bgColors.length] }),
      );
      bldg.position.set(-(RH + 35 + Math.random() * 40), h / 2, -i * 50 - 60 - Math.random() * 30);
      this.scene.add(bldg);
      this.themeObjects.push(bldg);
      this.background.push(bldg);
    }

    // ══════════════════════════════════════════
    //  FOREGROUND — RIGHT: Park strip (benches, tea stall, small trees)
    // ══════════════════════════════════════════

    // ── Park grass strip (between road and lake) ──
    const parkGrass = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 600),
      new THREE.MeshBasicMaterial({ color: 0x4a8a2a }),
    );
    parkGrass.rotation.x = -Math.PI / 2;
    parkGrass.position.set(RH + 4, 0.02, -150);
    this.scene.add(parkGrass);
    this.themeObjects.push(parkGrass);

    // ── Sitting benches along the lake edge ──
    const benchWoodMat = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.85 });
    const benchLegMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.4, roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const benchGroup = new THREE.Group();
      // Seat plank
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.6), benchWoodMat);
      seat.position.y = 0.5;
      benchGroup.add(seat);
      // Back rest
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.08), benchWoodMat);
      back.position.set(0, 0.85, -0.25);
      benchGroup.add(back);
      // Two legs
      for (const lx of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), benchLegMat);
        leg.position.set(lx, 0.25, 0);
        benchGroup.add(leg);
      }
      benchGroup.position.set(RH + 3 + Math.random() * 3, 0, -i * 50 - 15 - Math.random() * 10);
      benchGroup.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      this.scene.add(benchGroup);
      this.themeObjects.push(benchGroup);
      this.foreground.push(benchGroup);
    }

    // ── Tea stalls with name signs ──
    const stallWallMat = new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.8 });
    const canopyColors = [0xcc3333, 0xff9922, 0x2266aa, 0x33aa55];
    const stallNames = ['CHAI', 'LASSI', 'SAMOSA'];
    // Build name textures
    const stallNameTextures = stallNames.map(name => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 40;
      const cx = c.getContext('2d');
      cx.fillStyle = '#222222';
      cx.fillRect(0, 0, 128, 40);
      cx.fillStyle = '#ffcc00';
      cx.font = 'bold 24px Arial, sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(name, 64, 20);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      return t;
    });

    for (let i = 0; i < 3; i++) {
      const stallGroup = new THREE.Group();
      // Shack body
      const shack = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.5), stallWallMat);
      shack.position.y = 1;
      stallGroup.add(shack);
      // Counter (front)
      const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.7 }));
      counter.position.set(0, 1.0, 1.0);
      stallGroup.add(counter);
      // Canopy (angled roof)
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 2.2),
        new THREE.MeshBasicMaterial({ color: canopyColors[i % canopyColors.length] }));
      canopy.position.set(0, 2.3, 0.3);
      canopy.rotation.x = -0.15;
      stallGroup.add(canopy);
      // Named sign board
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06),
        new THREE.MeshBasicMaterial({ map: stallNameTextures[i] }));
      sign.position.set(0, 2.55, 0.8);
      stallGroup.add(sign);

      stallGroup.position.set(RH + 3.5, 0, -i * 100 - 40);
      stallGroup.rotation.y = -Math.PI / 2;
      this.scene.add(stallGroup);
      this.themeObjects.push(stallGroup);
      this.foreground.push(stallGroup);
    }

    // ── Cheering crowd with Indian flags ──
    const skinColors = [0xc68642, 0x8d5524, 0xe0ac69, 0xb07040];
    const shirtColors = [0xff6633, 0x2288cc, 0xeeee33, 0x33cc55, 0xcc33aa, 0xffffff, 0xff9933];
    // India flag colors
    const flagSaffron = 0xff9933;
    const flagWhite = 0xffffff;
    const flagGreen = 0x138808;

    for (let i = 0; i < 10; i++) {
      const personGroup = new THREE.Group();
      const skinCol = skinColors[i % skinColors.length];
      const shirtCol = shirtColors[i % shirtColors.length];

      // Body
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.25),
        new THREE.MeshBasicMaterial({ color: shirtCol }));
      torso.position.y = 1.0;
      personGroup.add(torso);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 5, 4),
        new THREE.MeshBasicMaterial({ color: skinCol }));
      head.position.y = 1.5;
      personGroup.add(head);
      // Legs
      for (const lx of [-0.1, 0.1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.15),
          new THREE.MeshBasicMaterial({ color: 0x333355 }));
        leg.position.set(lx, 0.4, 0);
        personGroup.add(leg);
      }
      // Raised arm (waving)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1),
        new THREE.MeshBasicMaterial({ color: skinCol }));
      arm.position.set(0.28, 1.35, 0);
      arm.rotation.z = -0.6 - Math.random() * 0.4;
      personGroup.add(arm);

      // Indian flag in hand (every other person)
      if (i % 2 === 0) {
        const flagGroup = new THREE.Group();
        // Pole
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 3),
          new THREE.MeshBasicMaterial({ color: 0x888888 }));
        pole.position.y = 0.4;
        flagGroup.add(pole);
        // Saffron stripe
        const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12),
          new THREE.MeshBasicMaterial({ color: flagSaffron, side: THREE.DoubleSide }));
        s1.position.set(0.2, 0.74, 0);
        flagGroup.add(s1);
        // White stripe
        const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12),
          new THREE.MeshBasicMaterial({ color: flagWhite, side: THREE.DoubleSide }));
        s2.position.set(0.2, 0.62, 0);
        flagGroup.add(s2);
        // Green stripe
        const s3 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12),
          new THREE.MeshBasicMaterial({ color: flagGreen, side: THREE.DoubleSide }));
        s3.position.set(0.2, 0.50, 0);
        flagGroup.add(s3);

        flagGroup.position.set(0.35, 1.2, 0);
        flagGroup.rotation.z = -0.3;
        personGroup.add(flagGroup);
      }

      // Place along both sides of the road
      const side = i % 3 === 0 ? 1 : -1;
      const xOff = side > 0 ? (RH + 1.5 + Math.random() * 1.5) : -(RH + 1.5 + Math.random() * 1.5);
      personGroup.position.set(xOff, 0, -i * 30 - 10 - Math.random() * 15);
      this.scene.add(personGroup);
      this.themeObjects.push(personGroup);
      this.foreground.push(personGroup);
    }

    // ── Small park trees (right side, along the lake edge) ──
    const parkTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.9 });
    const parkLeafMat = new THREE.MeshStandardMaterial({ color: 0x33882a, roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 2.5, 5), parkTrunkMat);
      trunk.position.y = 1.25;
      treeGroup.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.5, 5, 4), parkLeafMat);
      canopy.position.y = 3.2;
      canopy.scale.set(1, 0.7, 1);
      treeGroup.add(canopy);
      treeGroup.position.set(RH + 2 + Math.random() * 4, 0, -i * 55 - 25 - Math.random() * 15);
      this.scene.add(treeGroup);
      this.themeObjects.push(treeGroup);
      this.foreground.push(treeGroup);
    }

    // ── Low park railing (between grass and lake) ──
    const railMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.4, roughness: 0.3 });
    const railGeo = new THREE.BoxGeometry(0.06, 0.6, 30);
    for (let i = 0; i < 6; i++) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(RH + 7, 0.3, -i * 50 - 25);
      this.scene.add(rail);
      this.themeObjects.push(rail);
      this.foreground.push(rail);
    }

    // ── Boats on the lake ──
    const boatColors = [0xcc4422, 0x2266aa, 0xeeeecc, 0x33aa55, 0xdd8822, 0xcc3366];
    for (let i = 0; i < 5; i++) {
      const boatGroup = new THREE.Group();
      const bCol = boatColors[i % boatColors.length];
      // Hull
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.35, 2.2),
        new THREE.MeshBasicMaterial({ color: bCol }),
      );
      hull.position.y = 0.18;
      boatGroup.add(hull);
      // Cabin / canopy
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.35, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xeeeeee }),
      );
      cabin.position.set(0, 0.52, 0.2);
      boatGroup.add(cabin);
      boatGroup.position.set(
        RH + 15 + Math.random() * 40, 0.05,
        -i * 60 - 30 - Math.random() * 30,
      );
      boatGroup.rotation.y = Math.random() * Math.PI * 2;
      boatGroup.scale.setScalar(1.5 + Math.random() * 0.8);
      this.scene.add(boatGroup);
      this.themeObjects.push(boatGroup);
      this.background.push(boatGroup);
    }

    // ── Eater joints / dhabas (larger food stalls with seating) ──
    const dhabaRoofColors = [0xdd4422, 0x22aa44, 0xeeaa11, 0x2255bb];
    for (let i = 0; i < 3; i++) {
      const dhabaGroup = new THREE.Group();
      // Main structure (wider than tea stall)
      const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2),
        new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.8 }));
      body.position.y = 1.1;
      dhabaGroup.add(body);
      // Open front counter
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1),
        new THREE.MeshStandardMaterial({ color: 0x665533, roughness: 0.7 }));
      counter.position.set(0, 0.9, 1.3);
      dhabaGroup.add(counter);
      // Corrugated roof (colored)
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 3),
        new THREE.MeshBasicMaterial({ color: dhabaRoofColors[i % dhabaRoofColors.length] }));
      roof.position.set(0, 2.5, 0.3);
      roof.rotation.x = -0.1;
      dhabaGroup.add(roof);
      // Two stools in front
      const stoolMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.3 });
      for (const sx of [-0.7, 0.7]) {
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 5), stoolMat);
        stool.position.set(sx, 0.25, 1.8);
        dhabaGroup.add(stool);
      }
      // Menu board
      const menu = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.05),
        new THREE.MeshBasicMaterial({ color: 0x222222 }));
      menu.position.set(0, 2.6, 1.05);
      dhabaGroup.add(menu);
      const menuText = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
      menuText.position.set(0, 2.6, 1.08);
      dhabaGroup.add(menuText);

      dhabaGroup.position.set(RH + 3, 0, -i * 110 - 70);
      dhabaGroup.rotation.y = -Math.PI / 2;
      this.scene.add(dhabaGroup);
      this.themeObjects.push(dhabaGroup);
      this.foreground.push(dhabaGroup);
    }

    // ══════════════════════════════════════════
    //  FOREGROUND — LEFT: Banyan trees, lamps, signs
    // ══════════════════════════════════════════

    // ── Banyan trees (LEFT side only) ──
    const banyanTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.9 });
    const banyanLeafMat = new THREE.MeshStandardMaterial({ color: 0x2a6a22, roughness: 0.75 });
    for (let i = 0; i < 5; i++) {
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 4, 6), banyanTrunkMat);
      trunk.position.y = 2; treeGroup.add(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(3, 6, 5), banyanLeafMat);
      canopy.position.y = 5; canopy.scale.set(1.4, 0.6, 1.4); treeGroup.add(canopy);
      for (let r = 0; r < 3; r++) {
        const root = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.04, 2 + Math.random(), 3), banyanTrunkMat);
        root.position.set((Math.random() - 0.5) * 2, 3 + Math.random(), (Math.random() - 0.5) * 2);
        treeGroup.add(root);
      }
      treeGroup.position.set(-(RH + 2.5 + Math.random() * 2), 0, -i * 55 - Math.random() * 20);
      this.scene.add(treeGroup);
      this.themeObjects.push(treeGroup);
      this.foreground.push(treeGroup);
    }

    // ── Street lamps (LEFT side only — right is open lake) ──
    const lampPoleMat = new THREE.MeshStandardMaterial({
      color: 0x332211, metalness: 0.5, roughness: 0.3,
      emissive: 0xffaa44, emissiveIntensity: 0.12,
    });
    const lpGeo = new THREE.CylinderGeometry(0.05, 0.06, 4.5, 5);
    const lfGeo = new THREE.SphereGeometry(0.25, 5, 4);
    lpGeo.translate(0, 2.25, 0);
    lfGeo.translate(0, 4.7, 0);
    const lampMerged = mergeGeometries([lpGeo, lfGeo], false);
    for (let i = 0; i < 8; i++) {
      const lamp = new THREE.Mesh(lampMerged, lampPoleMat);
      lamp.position.set(-(RH + 1.5), 0, -i * 35 - Math.random() * 10);
      this.scene.add(lamp);
      this.themeObjects.push(lamp);
      this.foreground.push(lamp);
    }

    // ── Colorful market signs (LEFT side) ──
    const signColors = [0xff6633, 0xcc3366, 0x339966, 0xff9933, 0x6633cc];
    const signMat = new THREE.MeshStandardMaterial({ color: 0x555544 });
    const signBackGeo = new THREE.BoxGeometry(2.5, 1.0, 0.1);
    const signPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 3, 4);
    signPoleGeo.translate(0, -2, 0);
    const signMerged = mergeGeometries([signBackGeo, signPoleGeo], false);
    for (let i = 0; i < 3; i++) {
      const sg = new THREE.Group();
      sg.add(new THREE.Mesh(signMerged, signMat));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7),
        new THREE.MeshBasicMaterial({ color: signColors[(Math.random() * signColors.length) | 0] }));
      face.position.z = 0.06; sg.add(face);
      sg.position.set(-(RH + 5), 4.5 + Math.random() * 1.5, -i * 55 - 30);
      this.scene.add(sg);
      this.themeObjects.push(sg);
      this.midground.push(sg);
    }
  }

  // =====================================================================
  //  BILLBOARDS — ICT logo signs along the road
  // =====================================================================

  _buildBillboards(style) {
    const RH = ROAD_WIDTH / 2;
    const COUNT = 4;
    const SPACING = 100;

    // Load logo textures once (shared across map rebuilds)
    if (!Environment._bbTextures) {
      const loader = new THREE.TextureLoader();
      const load = (path) => { const t = loader.load(asset(path)); t.colorSpace = THREE.SRGBColorSpace; return t; };
      Environment._bbTextures = [
        { tex: load('ICT-Logo.png'), bgColor: 0x0a1e3d, large: false },
        { tex: load('logos/eoh-short.webp'), bgColor: 0xffffff, large: true },
        { tex: load('logos/asce.webp'), bgColor: 0xffffff, large: true },
      ];
    }
    const variants = Environment._bbTextures;

    // Per-map post/frame style
    const styles = {
      brazil:   { postColor: 0x8b6914, postRoughness: 0.85, frameColor: 0xa07828, frameRoughness: 0.7, postWidth: 0.25, postDepth: 0.25, panelBack: 0x6b4e1e, roadOffset: 4 },
      usa:      { postColor: 0x888899, postRoughness: 0.2,  frameColor: 0x666677, frameRoughness: 0.15, postWidth: 0.15, postDepth: 0.15, panelBack: 0x444455, roadOffset: 1.5 },
      peru:     { postColor: 0x7a6b50, postRoughness: 0.9,  frameColor: 0x5a4a3a, frameRoughness: 0.8, postWidth: 0.30, postDepth: 0.30, panelBack: 0x5a4a32, roadOffset: 4 },
      shanghai: { postColor: 0x555566, postRoughness: 0.15, frameColor: 0x444455, frameRoughness: 0.1, postWidth: 0.12, postDepth: 0.12, panelBack: 0x333344, roadOffset: 2 },
      delhi:    { postColor: 0x8b6914, postRoughness: 0.80, frameColor: 0x7a5a2a, frameRoughness: 0.7, postWidth: 0.22, postDepth: 0.22, panelBack: 0x5a4020, roadOffset: 3 },
    };
    const s = styles[style] || styles.usa;
    const isMetal = style === 'usa';

    // Shared structural materials
    const postMat = new THREE.MeshStandardMaterial({ color: s.postColor, roughness: s.postRoughness, metalness: isMetal ? 0.7 : 0.1 });
    const frameMat = new THREE.MeshStandardMaterial({ color: s.frameColor, roughness: s.frameRoughness, metalness: isMetal ? 0.6 : 0.1 });

    // Shared geometries
    const postH = 5.5;
    const panelW = 3.2, panelH = 2.0;
    const logoScaleSmall = 0.6;
    const logoScaleLarge = 0.75;
    const postGeo = new THREE.BoxGeometry(s.postWidth, postH, s.postDepth);
    postGeo.translate(0, postH / 2, 0);
    const blackFrameGeo = new THREE.BoxGeometry(panelW + 0.4, panelH + 0.4, 0.08);
    const blackFrameMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const frameGeo = new THREE.BoxGeometry(panelW + 0.1, panelH + 0.1, 0.08);
    const logoGeoSmall = new THREE.PlaneGeometry(panelW * logoScaleSmall, panelH * logoScaleSmall);
    const logoGeoLarge = new THREE.PlaneGeometry(panelW * logoScaleLarge, panelH * logoScaleLarge);

    for (let i = 0; i < COUNT; i++) {
      const v = variants[i % variants.length];
      const group = new THREE.Group();

      // Post
      group.add(new THREE.Mesh(postGeo, postMat));

      // Black frame (slightly larger box behind the panel)
      const frameMesh = new THREE.Mesh(blackFrameGeo, blackFrameMat);
      frameMesh.position.set(0, postH + panelH / 2, 0);
      group.add(frameMesh);

      // Billboard panel — colored background
      const panelMat = new THREE.MeshBasicMaterial({ color: v.bgColor });
      const panelBox = new THREE.Mesh(frameGeo, panelMat);
      panelBox.position.set(0, postH + panelH / 2, 0.06);
      group.add(panelBox);

      // Logo (60% size, centered, well in front of the panel box)
      const logoMat = new THREE.MeshBasicMaterial({ map: v.tex, transparent: true });
      const logo = new THREE.Mesh(v.large ? logoGeoLarge : logoGeoSmall, logoMat);
      logo.position.set(0, postH + panelH / 2, 0.18);
      group.add(logo);

      // Alternate sides
      const side = i % 2 === 0 ? 1 : -1;
      const xOffset = RH + s.roadOffset + Math.random() * 1.5;
      group.position.set(side * xOffset, 0, -i * SPACING - 20 - Math.random() * 20);
      group.rotation.y = side > 0 ? -0.15 : 0.15;

      this.scene.add(group);
      this.themeObjects.push(group);
      this.midground.push(group);
    }
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
