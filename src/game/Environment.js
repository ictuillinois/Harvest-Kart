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
    this.decorations = [];
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
    this.decorations = [];

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

    // =================================================================
    //  FOG + LIGHTING + GROUND
    // =================================================================
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);

    this.ambientLight = new THREE.AmbientLight(theme.ambientColor, theme.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(theme.dirColor, theme.dirIntensity);
    this.dirLight.position.copy(this.sunDirection).multiplyScalar(100);
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(theme.dirColor, theme.ground, 0.25);
    this.scene.add(this.hemiLight);

    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.1;
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
        this.decorations.push(barrier);
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

  // --- Helper: place a loaded model ---
  _placeModel(url, x, y, z, scale = 1, rotY = 0) {
    const model = getModel(url);
    model.position.set(x, y, z);
    model.scale.setScalar(scale);
    model.rotation.y = rotY;
    this.scene.add(model);
    this.themeObjects.push(model);
    this.decorations.push(model);
    return model;
  }

  // --- Helper: place model without scrolling (static sky objects) ---
  _placeStatic(url, x, y, z, scale = 1, rotY = 0) {
    const model = getModel(url);
    model.position.set(x, y, z);
    model.scale.setScalar(scale);
    model.rotation.y = rotY;
    this.scene.add(model);
    this.themeObjects.push(model);
    return model;
  }

  // --- Helper: scatter roadside props ---
  _scatterProps(propUrls, count, xRange, zSpacing, scale = 1) {
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const url = propUrls[Math.floor(Math.random() * propUrls.length)];
      const x = side * (ROAD_WIDTH / 2 + xRange[0] + Math.random() * (xRange[1] - xRange[0]));
      const z = -i * zSpacing - Math.random() * zSpacing * 0.5;
      const s = scale * (0.8 + Math.random() * 0.4);
      this._placeModel(url, x, 0, z, s, Math.random() * Math.PI * 2);
    }
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
  // =====================================================================
  _buildBrazil() {
    // --- Sun glow ---
    const sunPos = this.sunDirection.clone().multiplyScalar(300);
    for (const [size, color, opacity] of [[30, 0xffaa33, 0.12], [18, 0xffdd66, 0.2], [8, 0xffee88, 1.0]]) {
      const geo = new THREE.SphereGeometry(size, 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: opacity < 1, opacity, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(sunPos);
      this.scene.add(mesh);
      this.themeObjects.push(mesh);
    }

    // =================================================================
    //  ANIMATED OCEAN (right side of road)
    // =================================================================
    const waterGeo = new THREE.PlaneGeometry(400, 400);
    const waterNormals = new THREE.TextureLoader().load(asset('textures/waternormals.jpg'), (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
    this.water = new Water(waterGeo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: this.sunDirection.clone(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: this.scene.fog !== undefined,
      alpha: 0.9,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(ROAD_WIDTH / 2 + 60, -0.4, -150);
    this.scene.add(this.water);
    this.themeObjects.push(this.water);

    // =================================================================
    //  SAND STRIP (between road and ocean, right side)
    // =================================================================
    const sandGeo = new THREE.PlaneGeometry(30, 500);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xf4d99a, roughness: 1 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(ROAD_WIDTH / 2 + 15, -0.08, -150);
    this.scene.add(sand);
    this.themeObjects.push(sand);

    // =================================================================
    //  LEFT SIDE — City buildings + palm trees
    // =================================================================
    const brazilBuildings = [MODEL_URLS.buildingA, MODEL_URLS.buildingB, MODEL_URLS.buildingC, MODEL_URLS.buildingD];
    if (this.modelsReady) {
      // City buildings on left
      for (let i = 0; i < 10; i++) {
        const url = brazilBuildings[Math.floor(Math.random() * brazilBuildings.length)];
        const x = -(ROAD_WIDTH / 2 + 6 + Math.random() * 6);
        const z = -i * 30 - Math.random() * 15;
        this._placeModel(url, x, 0, z, 1.8 + Math.random() * 1.5, 0);
      }

      // Bushes on left side
      for (let i = 0; i < 10; i++) {
        const x = -(ROAD_WIDTH / 2 + 1.5 + Math.random() * 2.5);
        this._placeModel(MODEL_URLS.bush, x, 0, -i * 32 - Math.random() * 10, 1.5, Math.random() * Math.PI * 2);
      }

      // Palm trees on left (city side) — loaded model
      for (let i = 0; i < 10; i++) {
        const x = -(ROAD_WIDTH / 2 + 2 + Math.random() * 4);
        this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 30 - Math.random() * 10, 1.2 + Math.random() * 0.6, Math.random() * Math.PI * 2);
      }

      // =================================================================
      //  RIGHT SIDE — Beach with props, palm trees, ocean
      // =================================================================

      // Palm trees along the beach
      for (let i = 0; i < 12; i++) {
        const x = ROAD_WIDTH / 2 + 2 + Math.random() * 8;
        this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 26 - Math.random() * 10, 1.0 + Math.random() * 0.8, Math.random() * Math.PI * 2);
      }

      // Beach umbrellas + chairs (placed in pairs)
      for (let i = 0; i < 8; i++) {
        const x = ROAD_WIDTH / 2 + 10 + Math.random() * 12;
        const z = -i * 38 - Math.random() * 15;
        this._placeModel(MODEL_URLS.beachUmbrella, x, 0, z, 1.0 + Math.random() * 0.3, Math.random() * Math.PI * 2);
        // Chair next to umbrella
        this._placeModel(MODEL_URLS.beachChair, x + 1.5 + Math.random(), 0, z + (Math.random() - 0.5) * 2, 1.0, Math.random() * Math.PI);
      }

      // Surfboards stuck in sand
      for (let i = 0; i < 6; i++) {
        const x = ROAD_WIDTH / 2 + 8 + Math.random() * 10;
        const z = -i * 50 - Math.random() * 20;
        this._placeModel(MODEL_URLS.surfboard, x, 0.3, z, 0.8 + Math.random() * 0.4, Math.random() * Math.PI * 2);
      }

      // Beach balls scattered
      for (let i = 0; i < 6; i++) {
        const x = ROAD_WIDTH / 2 + 6 + Math.random() * 15;
        const z = -i * 45 - Math.random() * 20;
        this._placeModel(MODEL_URLS.beachBall, x, 0.3, z, 0.6 + Math.random() * 0.4, Math.random() * Math.PI * 2);
      }

      // Crabs on the sand
      for (let i = 0; i < 8; i++) {
        const x = ROAD_WIDTH / 2 + 5 + Math.random() * 18;
        const z = -i * 36 - Math.random() * 15;
        this._placeModel(MODEL_URLS.crab, x, 0, z, 0.4 + Math.random() * 0.3, Math.random() * Math.PI * 2);
      }

      // Lifeguard towers (2-3 along the beach)
      for (let i = 0; i < 3; i++) {
        const x = ROAD_WIDTH / 2 + 14 + Math.random() * 4;
        const z = -i * 100 - 30;
        this._placeModel(MODEL_URLS.lifeguardTower, x, 0, z, 1.2, Math.PI * 0.5);
      }

      // Sailboats on the ocean (static, further out)
      for (let i = 0; i < 4; i++) {
        const x = ROAD_WIDTH / 2 + 40 + Math.random() * 30;
        const z = -i * 80 - 40 - Math.random() * 30;
        const boat = this._placeStatic(MODEL_URLS.sailboat, x, -0.2, z, 1.5 + Math.random() * 0.5, Math.random() * Math.PI * 2);
      }

      // Seagulls hovering above the beach
      for (let i = 0; i < 6; i++) {
        const x = ROAD_WIDTH / 2 + 8 + Math.random() * 25;
        const z = -i * 50 - Math.random() * 20;
        const y = 4 + Math.random() * 6;
        this._placeStatic(MODEL_URLS.seagull, x, y, z, 0.8 + Math.random() * 0.5, Math.random() * Math.PI * 2);
      }
    }
  }

  // =====================================================================
  //  USA — night city
  // =====================================================================
  _buildUSA() {
    // --- Moon ---
    const moonGroup = new THREE.Group();
    const moonGeo = new THREE.SphereGeometry(10, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
    moonGroup.add(new THREE.Mesh(moonGeo, moonMat));

    const craterMat = new THREE.MeshBasicMaterial({ color: 0xccccdd });
    for (let i = 0; i < 5; i++) {
      const cGeo = new THREE.CircleGeometry(1 + Math.random() * 2, 12);
      const crater = new THREE.Mesh(cGeo, craterMat);
      const a1 = Math.random() * 0.6 - 0.3, a2 = Math.random() * 0.6 - 0.3;
      crater.position.set(Math.sin(a1) * 9, Math.sin(a2) * 9, -Math.cos(a1) * Math.cos(a2) * 10 - 0.5);
      crater.lookAt(0, 0, 0);
      moonGroup.add(crater);
    }

    const moonGlowGeo = new THREE.SphereGeometry(18, 32, 32);
    const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0x8888cc, transparent: true, opacity: 0.08, depthWrite: false });
    moonGroup.add(new THREE.Mesh(moonGlowGeo, moonGlowMat));
    moonGroup.position.set(-60, 130, -280);
    this.scene.add(moonGroup);
    this.themeObjects.push(moonGroup);

    const moonLight = new THREE.PointLight(0x6677aa, 0.4, 500);
    moonLight.position.copy(moonGroup.position);
    this.scene.add(moonLight);
    this.themeObjects.push(moonLight);

    // --- Tall buildings (loaded KayKit models, scaled up) ---
    const usaBuildings = [
      MODEL_URLS.buildingE, MODEL_URLS.buildingF, MODEL_URLS.buildingG, MODEL_URLS.buildingH,
      MODEL_URLS.buildingC, MODEL_URLS.buildingD,
    ];

    if (this.modelsReady) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 16; i++) {
          const url = usaBuildings[Math.floor(Math.random() * usaBuildings.length)];
          const x = side * (ROAD_WIDTH / 2 + 4 + Math.random() * 10);
          const z = -i * 22 - Math.random() * 10;
          const s = 3.0 + Math.random() * 4.0; // tall city scale
          const model = this._placeModel(url, x, 0, z, s, side > 0 ? Math.PI : 0);

          // Tint buildings darker for nighttime city feel
          model.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
              child.material.color.multiplyScalar(0.35);
            }
          });
        }
      }

      // Roadside urban props
      this._scatterProps(
        [MODEL_URLS.dumpster, MODEL_URLS.trafficLight, MODEL_URLS.bench, MODEL_URLS.firehydrant,
         MODEL_URLS.trashcan, MODEL_URLS.mailbox],
        16, [1.2, 3], 22, 1.3
      );

      // Traffic cones along road edges
      this._scatterProps([MODEL_URLS.trafficCone], 12, [0.8, 1.5], 26, 1.0);

      // Tire stacks and barriers at roadside
      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 6, [1.5, 3.5], 50, 1.0);

      // Parked cars along roadside
      this._scatterProps(
        [MODEL_URLS.carSedan, MODEL_URLS.carTaxi, MODEL_URLS.carHatchback],
        8, [1.5, 3], 40, 1.2
      );
    }

    // --- Neon signs (keep as emissive boxes — good for neon effect) ---
    const neonColors = [0xff00ff, 0x00ffff, 0xff4444, 0x44ff44];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const nGeo = new THREE.BoxGeometry(2 + Math.random() * 2, 0.8, 0.1);
      const nColor = neonColors[Math.floor(Math.random() * neonColors.length)];
      const nMat = new THREE.MeshBasicMaterial({ color: nColor });
      const neon = new THREE.Mesh(nGeo, nMat);
      neon.position.set(side * (ROAD_WIDTH / 2 + 3), 4 + Math.random() * 3, -i * 40 - 20);
      this.scene.add(neon);
      this.themeObjects.push(neon);
      this.decorations.push(neon);
    }
  }

  // =====================================================================
  //  PERU — mountains & valleys
  // =====================================================================
  _buildPeru() {
    // --- Mountains (keep procedural — they look good at large scale) ---
    const mountainColors = [0x556B2F, 0x4a7a3a, 0x6B8E23, 0x5a8a4a, 0x3a6a2a];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const radius = 15 + Math.random() * 25;
        const height = 20 + Math.random() * 50;
        const color = mountainColors[Math.floor(Math.random() * mountainColors.length)];
        const mGeo = new THREE.ConeGeometry(radius, height, 6 + Math.floor(Math.random() * 4));
        const mMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
        const mountain = new THREE.Mesh(mGeo, mMat);
        mountain.position.set(
          side * (ROAD_WIDTH / 2 + 15 + Math.random() * 30),
          height / 2 - 2,
          -i * 40 - Math.random() * 20
        );
        this.scene.add(mountain);
        this.themeObjects.push(mountain);

        if (height > 40) {
          const snowGeo = new THREE.ConeGeometry(radius * 0.25, height * 0.15, 6);
          const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
          const snow = new THREE.Mesh(snowGeo, snowMat);
          snow.position.y = height * 0.45;
          mountain.add(snow);
        }
      }
    }

    // --- Rolling green hills ---
    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const hillGeo = new THREE.SphereGeometry(8 + Math.random() * 6, 12, 8);
        const hillMat = new THREE.MeshStandardMaterial({
          color: 0x4a8a2a + Math.floor(Math.random() * 0x101010), roughness: 0.9
        });
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.scale.y = 0.4;
        hill.position.set(
          side * (ROAD_WIDTH / 2 + 5 + Math.random() * 10), -1,
          -i * 30 - Math.random() * 15
        );
        this.scene.add(hill);
        this.themeObjects.push(hill);
        this.decorations.push(hill);
      }
    }

    // --- Trees (procedural + loaded bushes alongside) ---
    const foliageColors = [0x2d5a1e, 0x3a6a2a, 0x1a5a1a, 0x4a8a3a];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });

    for (const side of [-1, 1]) {
      for (let i = 0; i < 14; i++) {
        const treeGroup = new THREE.Group();
        const trunkH = 1.5 + Math.random() * 2;
        const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, trunkH, 6);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkH / 2;
        treeGroup.add(trunk);

        const fColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
        const fMat = new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.8 });
        for (let f = 0; f < 3; f++) {
          const fGeo = new THREE.SphereGeometry(0.8 + Math.random() * 0.6, 8, 6);
          const foliage = new THREE.Mesh(fGeo, fMat);
          foliage.position.set(
            (Math.random() - 0.5) * 0.6, trunkH + 0.5 + f * 0.4,
            (Math.random() - 0.5) * 0.6
          );
          treeGroup.add(foliage);
        }

        treeGroup.position.set(
          side * (ROAD_WIDTH / 2 + 2 + Math.random() * 6), 0,
          -i * 22 - Math.random() * 10
        );
        this.scene.add(treeGroup);
        this.themeObjects.push(treeGroup);
        this.decorations.push(treeGroup);
      }
    }

    // --- Loaded models ---
    if (this.modelsReady) {
      // Bushes and flowers scattered between trees
      this._scatterProps([MODEL_URLS.bush], 16, [1.5, 8], 20, 1.8);
      this._scatterProps([MODEL_URLS.flowers], 14, [2, 10], 24, 0.8);

      // Llamas grazing alongside the road
      this._scatterProps([MODEL_URLS.llama], 8, [3, 12], 38, 0.6);

      // Stone walls (Inca ruins alongside road)
      this._scatterProps([MODEL_URLS.stoneWall], 6, [2, 6], 52, 1.2);

      // Andean huts (small villages)
      for (let i = 0; i < 5; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        this._placeModel(
          MODEL_URLS.hut,
          side * (ROAD_WIDTH / 2 + 8 + Math.random() * 6), 0,
          -i * 65 - 30,
          1.2 + Math.random() * 0.5, Math.random() * Math.PI * 2
        );
      }

      // Race barriers along road edges
      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 6, [0.8, 2], 55, 0.9);
    }

    // --- Inca-like terraces (keep procedural) ---
    const terrMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const terrGroup = new THREE.Group();
      for (let level = 0; level < 4; level++) {
        const w = 6 - level * 1.2;
        const geo = new THREE.BoxGeometry(w, 1, w);
        const step = new THREE.Mesh(geo, terrMat);
        step.position.y = level * 1;
        terrGroup.add(step);
      }
      terrGroup.position.set(
        (i % 2 === 0 ? -1 : 1) * (ROAD_WIDTH / 2 + 10 + Math.random() * 5), 0,
        -i * 80 - 40
      );
      this.scene.add(terrGroup);
      this.themeObjects.push(terrGroup);
      this.decorations.push(terrGroup);
    }
  }

  // =====================================================================
  //  UPDATE
  // =====================================================================
  update(delta, speed) {
    if (this.sky) this.sky.material.uniforms['time'].value += delta;
    if (this.starField) this.starField.material.uniforms.time.value += delta;
    if (this.water) this.water.material.uniforms['time'].value += delta * 0.5;

    const move = speed * delta;
    for (const deco of this.decorations) {
      deco.position.z += move;
      if (deco.position.z > 80) {
        deco.position.z -= 350;
      }
    }
  }
}
