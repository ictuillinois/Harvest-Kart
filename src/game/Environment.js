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
      brazil: { postColor: 0x8b6914, postRoughness: 0.85, frameColor: 0xa07828, frameRoughness: 0.7, postWidth: 0.25, postDepth: 0.25, panelBack: 0x6b4e1e, roadOffset: 4 },
      usa:    { postColor: 0x888899, postRoughness: 0.2,  frameColor: 0x666677, frameRoughness: 0.15, postWidth: 0.15, postDepth: 0.15, panelBack: 0x444455, roadOffset: 1.5 },
      peru:   { postColor: 0x7a6b50, postRoughness: 0.9,  frameColor: 0x5a4a3a, frameRoughness: 0.8, postWidth: 0.30, postDepth: 0.30, panelBack: 0x5a4a32, roadOffset: 4 },
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
