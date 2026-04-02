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

    this.hemiLight = new THREE.HemisphereLight(theme.dirColor, theme.ground, 0.25);
    this.scene.add(this.hemiLight);

    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1 });
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

    // ── OCEAN — bright tropical water, close to road for visibility ──
    const waterGeo = new THREE.PlaneGeometry(300, 600);
    const waterNormals = new THREE.TextureLoader().load(asset('textures/waternormals.jpg'), (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
    this.water = new Water(waterGeo, {
      textureWidth: 512, textureHeight: 512, waterNormals,
      sunDirection: this.sunDirection.clone(),
      sunColor: 0xffffee,
      waterColor: 0x001e0f,
      distortionScale: 5.0,     // strong visible waves
      fog: this.scene.fog !== undefined,
      alpha: 0.95,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(ROAD_WIDTH / 2 + 8, -0.12, -100);
    // Override to bright tropical turquoise — visible against sand
    this.water.material.uniforms['waterColor'].value.set(0x006688);
    this.scene.add(this.water);
    this.themeObjects.push(this.water);

    // ── SAND — bright beach strip right at road edge ──
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 600),
      new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: 0.95 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(ROAD_WIDTH / 2 + 2, -0.02, -150);
    sand.receiveShadow = true;
    this.scene.add(sand);
    this.themeObjects.push(sand);

    // ── FOAM LINE — white strip where sand meets water ──
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 600),
      new THREE.MeshBasicMaterial({ color: 0xeeffff, transparent: true, opacity: 0.5 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(ROAD_WIDTH / 2 + 6, 0.0, -150);
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

    // Palms → midground
    for (let i = 0; i < 12; i++) {
      const x = ROAD_WIDTH / 2 + 1.5 + Math.random() * 4;
      this._placeModel(MODEL_URLS.palmTree, x, 0, -i * 24 - Math.random() * 10, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.4, 'mg');
    }

    // Bushes → foreground
    for (let i = 0; i < 8; i++) {
      this._placeModel(MODEL_URLS.bush, ROAD_WIDTH / 2 + 0.8 + Math.random() * 2, 0, -i * 32 - Math.random() * 12, Math.random() * Math.PI * 2, 1, 'fg');
    }
  }

  // =====================================================================
  //  USA — night city
  // =====================================================================
  _buildUSA() {
    // Moon
    const moonGroup = new THREE.Group();
    moonGroup.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 32), new THREE.MeshBasicMaterial({ color: 0xeeeeff })));
    const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0x8888cc, transparent: true, opacity: 0.08, depthWrite: false });
    moonGroup.add(new THREE.Mesh(new THREE.SphereGeometry(18, 32, 32), moonGlowMat));
    moonGroup.position.set(-60, 130, -280);
    this.scene.add(moonGroup);
    this.themeObjects.push(moonGroup);

    const moonLight = new THREE.PointLight(0x6677aa, 0.4, 500);
    moonLight.position.copy(moonGroup.position);
    this.scene.add(moonLight);
    this.themeObjects.push(moonLight);

    // Buildings (scaled reasonably, pushed back from road)
    const usaBuildings = [MODEL_URLS.buildingE, MODEL_URLS.buildingF, MODEL_URLS.buildingG, MODEL_URLS.buildingH, MODEL_URLS.buildingC, MODEL_URLS.buildingD];

    if (this.modelsReady) {
      // Buildings → midground
      for (const side of [-1, 1]) {
        for (let i = 0; i < 12; i++) {
          const url = usaBuildings[Math.floor(Math.random() * usaBuildings.length)];
          const x = side * (ROAD_WIDTH / 2 + 8 + Math.random() * 10);
          const z = -i * 25 - Math.random() * 10;
          const model = this._placeModel(url, x, 0, z, side > 0 ? Math.PI : 0, 0.8 + Math.random() * 0.4, 'mg');
          model.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
              child.material.color.multiplyScalar(0.45);
            }
          });
        }
      }

      // Roadside props → foreground
      this._scatterProps(
        [MODEL_URLS.dumpster, MODEL_URLS.trafficLight, MODEL_URLS.bench, MODEL_URLS.firehydrant, MODEL_URLS.trashcan, MODEL_URLS.mailbox],
        12, [2, 5], 28, 'fg'
      );
      this._scatterProps([MODEL_URLS.trafficCone], 8, [1.5, 2.5], 35, 'fg');
      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 4, [2.5, 5], 65, 'fg');
      this._scatterProps([MODEL_URLS.carSedan, MODEL_URLS.carTaxi, MODEL_URLS.carHatchback], 6, [2, 4], 50, 'fg');
    }

    // Neon signs (attached to building height, pushed back)
    const neonColors = [0xff00ff, 0x00ffff, 0xff4444, 0x44ff44];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const nGeo = new THREE.BoxGeometry(2.5, 0.6, 0.1);
      const nMat = new THREE.MeshBasicMaterial({ color: neonColors[Math.floor(Math.random() * neonColors.length)] });
      const neon = new THREE.Mesh(nGeo, nMat);
      neon.position.set(side * (ROAD_WIDTH / 2 + 6), 3 + Math.random() * 2, -i * 45 - 20);
      this.scene.add(neon);
      this.themeObjects.push(neon);
      this.decorations.push(neon);
    }
  }

  // =====================================================================
  //  PERU — mountains & valleys
  // =====================================================================
  _buildPeru() {
    // Mountains (distant, large — not scrolling)
    const mountainColors = [0x556B2F, 0x4a7a3a, 0x6B8E23, 0x5a8a4a, 0x3a6a2a];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const radius = 20 + Math.random() * 30;
        const height = 25 + Math.random() * 45;
        const color = mountainColors[Math.floor(Math.random() * mountainColors.length)];
        const mGeo = new THREE.ConeGeometry(radius, height, 6 + Math.floor(Math.random() * 3));
        const mMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
        const mountain = new THREE.Mesh(mGeo, mMat);
        mountain.position.set(
          side * (ROAD_WIDTH / 2 + 25 + Math.random() * 35),
          height / 2 - 3,
          -i * 50 - Math.random() * 20
        );
        this.scene.add(mountain);
        this.themeObjects.push(mountain);
        this.background.push(mountain); // slow parallax scroll

        if (height > 40) {
          const snowGeo = new THREE.ConeGeometry(radius * 0.2, height * 0.12, 6);
          const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
          const snow = new THREE.Mesh(snowGeo, snowMat);
          snow.position.y = height * 0.45;
          mountain.add(snow);
        }
      }
    }

    // Rolling hills (smaller, further from road)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const hillGeo = new THREE.SphereGeometry(5 + Math.random() * 4, 10, 6);
        const hillMat = new THREE.MeshStandardMaterial({
          color: 0x4a8a2a + Math.floor(Math.random() * 0x101010), roughness: 0.9
        });
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.scale.y = 0.3;
        hill.position.set(
          side * (ROAD_WIDTH / 2 + 8 + Math.random() * 12), -1.5,
          -i * 45 - Math.random() * 15
        );
        this.scene.add(hill);
        this.themeObjects.push(hill);
        this.midground.push(hill);
      }
    }

    // Trees (procedural, properly spaced from road)
    const foliageColors = [0x2d5a1e, 0x3a6a2a, 0x1a5a1a, 0x4a8a3a];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });

    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const treeGroup = new THREE.Group();
        const trunkH = 1.5 + Math.random() * 1.5;
        const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, trunkH, 6);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkH / 2;
        treeGroup.add(trunk);

        const fColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
        const fMat = new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.8 });
        for (let f = 0; f < 2; f++) {
          const fGeo = new THREE.SphereGeometry(0.6 + Math.random() * 0.4, 6, 5);
          const foliage = new THREE.Mesh(fGeo, fMat);
          foliage.position.set((Math.random() - 0.5) * 0.4, trunkH + 0.3 + f * 0.3, (Math.random() - 0.5) * 0.4);
          treeGroup.add(foliage);
        }

        treeGroup.position.set(
          side * (ROAD_WIDTH / 2 + 3 + Math.random() * 6), 0,
          -i * 28 - Math.random() * 10
        );
        this.scene.add(treeGroup);
        this.themeObjects.push(treeGroup);
        this.foreground.push(treeGroup);
      }
    }

    // Loaded models with parallax layers
    if (this.modelsReady) {
      this._scatterProps([MODEL_URLS.bush], 10, [3, 8], 28, 'fg');
      this._scatterProps([MODEL_URLS.flowers], 8, [3, 10], 32, 'fg');
      this._scatterProps([MODEL_URLS.llama], 5, [4, 10], 55, 'mg');
      this._scatterProps([MODEL_URLS.stoneWall], 4, [3, 7], 70, 'mg');

      // Andean huts → midground
      for (let i = 0; i < 3; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        this._placeModel(MODEL_URLS.hut, side * (ROAD_WIDTH / 2 + 12 + Math.random() * 5), 0, -i * 90 - 40, Math.random() * Math.PI * 2, 1, 'mg');
      }

      this._scatterProps([MODEL_URLS.tires, MODEL_URLS.raceBarrier], 4, [1.5, 3], 70, 'fg');
    }

    // Inca terraces (procedural, pushed further back)
    const terrMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const terrGroup = new THREE.Group();
      for (let level = 0; level < 4; level++) {
        const w = 4 - level * 0.8;
        const geo = new THREE.BoxGeometry(w, 0.8, w);
        const step = new THREE.Mesh(geo, terrMat);
        step.position.y = level * 0.8;
        terrGroup.add(step);
      }
      terrGroup.position.set(
        (i % 2 === 0 ? -1 : 1) * (ROAD_WIDTH / 2 + 14 + Math.random() * 5), 0,
        -i * 100 - 50
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
    if (this.sky) this.sky.material.uniforms['time'].value += delta;
    if (this.starField) this.starField.material.uniforms.time.value += delta;
    if (this.water) this.water.material.uniforms['time'].value += delta * 0.5;

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
