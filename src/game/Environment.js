import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, MAP_THEMES } from '../utils/constants.js';

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
  }

  build(themeIndex) {
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

    const theme = MAP_THEMES[themeIndex] || MAP_THEMES[0];
    this.currentTheme = theme;

    // =================================================================
    //  SKY — Preetham atmospheric scattering + procedural FBM clouds
    // =================================================================
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    this.scene.add(this.sky);

    const skyUniforms = this.sky.material.uniforms;

    // Atmosphere
    skyUniforms['turbidity'].value = theme.sky.turbidity;
    skyUniforms['rayleigh'].value = theme.sky.rayleigh;
    skyUniforms['mieCoefficient'].value = theme.sky.mieCoefficient;
    skyUniforms['mieDirectionalG'].value = theme.sky.mieDirectionalG;

    // Sun position from elevation + azimuth
    const phi = THREE.MathUtils.degToRad(90 - theme.sky.sunElevation);
    const theta = THREE.MathUtils.degToRad(theme.sky.sunAzimuth);
    this.sunDirection.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(this.sunDirection);

    // Procedural clouds
    skyUniforms['cloudCoverage'].value = theme.clouds.coverage;
    skyUniforms['cloudDensity'].value = theme.clouds.density;
    skyUniforms['cloudScale'].value = theme.clouds.scale;
    skyUniforms['cloudSpeed'].value = theme.clouds.speed;
    skyUniforms['cloudElevation'].value = theme.clouds.elevation;
    skyUniforms['time'].value = 0;

    // Tone-mapping exposure per theme
    this.renderer.toneMappingExposure = theme.sky.exposure;

    // =================================================================
    //  FOG — tinted to match horizon
    // =================================================================
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);

    // =================================================================
    //  LIGHTING — synced to sun direction
    // =================================================================
    this.ambientLight = new THREE.AmbientLight(theme.ambientColor, theme.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(theme.dirColor, theme.dirIntensity);
    this.dirLight.position.copy(this.sunDirection).multiplyScalar(100);
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(
      theme.dirColor, theme.ground, 0.25
    );
    this.scene.add(this.hemiLight);

    // =================================================================
    //  GROUND
    // =================================================================
    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.1;
    this.scene.add(this.ground);

    // =================================================================
    //  STARS (USA night theme)
    // =================================================================
    if (theme.stars) {
      this._buildStarField();
    }

    // =================================================================
    //  BARRIERS (shared across all maps)
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
    //  THEME-SPECIFIC DECORATIONS
    // =================================================================
    switch (theme.id) {
      case 'brazil': this._buildBrazil(); break;
      case 'usa': this._buildUSA(); break;
      case 'peru': this._buildPeru(); break;
    }
  }

  // =====================================================================
  //  STAR FIELD — thousands of points on a large sphere
  // =====================================================================
  _buildStarField() {
    const COUNT = 2500;
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // Random positions on a sphere, biased to upper hemisphere
      const r = 400 + Math.random() * 100;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85); // mostly above horizon

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      sizes[i] = 0.5 + Math.random() * 2.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader for twinkle effect
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `
        attribute float size;
        uniform float time;
        varying float vBrightness;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          // Twinkle: each star gets a unique phase from its position
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
          // Soft circular point
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
  //  BRAZIL — tropical vibes
  // =====================================================================
  _buildBrazil() {
    // --- Sun glow meshes (complement the Sky shader's sun disc) ---
    const sunPos = this.sunDirection.clone().multiplyScalar(300);
    // Outer corona
    const coronaGeo = new THREE.SphereGeometry(30, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33, transparent: true, opacity: 0.12, depthWrite: false
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    corona.position.copy(sunPos);
    this.scene.add(corona);
    this.themeObjects.push(corona);

    // Middle glow
    const glowGeo = new THREE.SphereGeometry(18, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffdd66, transparent: true, opacity: 0.2, depthWrite: false
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(sunPos);
    this.scene.add(glow);
    this.themeObjects.push(glow);

    // Core
    const coreGeo = new THREE.SphereGeometry(8, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(sunPos);
    this.scene.add(core);
    this.themeObjects.push(core);

    // --- Palm trees ---
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.7 });

    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        const palmGroup = new THREE.Group();
        const height = 5 + Math.random() * 4;

        for (let s = 0; s < 5; s++) {
          const segGeo = new THREE.CylinderGeometry(0.15 - s * 0.02, 0.18 - s * 0.02, height / 5, 6);
          const seg = new THREE.Mesh(segGeo, trunkMat);
          seg.position.y = (s + 0.5) * height / 5;
          seg.position.x = Math.sin(s * 0.15) * 0.3;
          palmGroup.add(seg);
        }

        for (let f = 0; f < 7; f++) {
          const leafGeo = new THREE.BoxGeometry(0.3, 0.05, 2.5 + Math.random());
          const leaf = new THREE.Mesh(leafGeo, leafMat);
          leaf.position.set(0, height + 0.2, 0);
          leaf.rotation.y = (f / 7) * Math.PI * 2;
          leaf.rotation.x = 0.4 + Math.random() * 0.3;
          palmGroup.add(leaf);
        }

        palmGroup.position.set(
          side * (ROAD_WIDTH / 2 + 2 + Math.random() * 5),
          0,
          -i * 28 - Math.random() * 10
        );
        this.scene.add(palmGroup);
        this.themeObjects.push(palmGroup);
        this.decorations.push(palmGroup);
      }
    }

    // --- Colorful low-rise buildings ---
    const buildingColors = [0xffccaa, 0xffddbb, 0xff9966, 0xffaa88, 0xeedd99, 0xffcc77];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const w = 3 + Math.random() * 4;
        const h = 3 + Math.random() * 6;
        const d = 3 + Math.random() * 4;
        const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const bGeo = new THREE.BoxGeometry(w, h, d);
        const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
        const building = new THREE.Mesh(bGeo, bMat);
        building.position.set(
          side * (ROAD_WIDTH / 2 + 6 + Math.random() * 8),
          h / 2,
          -i * 30 - Math.random() * 15
        );
        this.scene.add(building);
        this.themeObjects.push(building);
        this.decorations.push(building);

        const roofGeo = new THREE.BoxGeometry(w + 0.2, 0.1, d + 0.2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xcc8866 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = h / 2 + 0.05;
        building.add(roof);
      }
    }

    // --- Beach sand ---
    const sandGeo = new THREE.PlaneGeometry(200, 30);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xf4d99a, roughness: 1 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(60, -0.05, -150);
    this.scene.add(sand);
    this.themeObjects.push(sand);
  }

  // =====================================================================
  //  USA — night city
  // =====================================================================
  _buildUSA() {
    // --- Moon with crater detail + glow ---
    const moonGroup = new THREE.Group();
    // Core sphere
    const moonGeo = new THREE.SphereGeometry(10, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moon);

    // Craters (darker subtle circles)
    const craterMat = new THREE.MeshBasicMaterial({ color: 0xccccdd });
    for (let i = 0; i < 5; i++) {
      const cGeo = new THREE.CircleGeometry(1 + Math.random() * 2, 12);
      const crater = new THREE.Mesh(cGeo, craterMat);
      const angle1 = Math.random() * Math.PI * 0.6 - 0.3;
      const angle2 = Math.random() * Math.PI * 0.6 - 0.3;
      crater.position.set(
        Math.sin(angle1) * 9,
        Math.sin(angle2) * 9,
        -Math.cos(angle1) * Math.cos(angle2) * 10 - 0.5
      );
      crater.lookAt(0, 0, 0);
      moonGroup.add(crater);
    }

    // Moon glow halo
    const moonGlowGeo = new THREE.SphereGeometry(18, 32, 32);
    const moonGlowMat = new THREE.MeshBasicMaterial({
      color: 0x8888cc, transparent: true, opacity: 0.08, depthWrite: false
    });
    const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
    moonGroup.add(moonGlow);

    moonGroup.position.set(-60, 130, -280);
    this.scene.add(moonGroup);
    this.themeObjects.push(moonGroup);

    // Moonlight
    const moonLight = new THREE.PointLight(0x6677aa, 0.4, 500);
    moonLight.position.copy(moonGroup.position);
    this.scene.add(moonLight);
    this.themeObjects.push(moonLight);

    // --- Tall modern skyscrapers ---
    const glassColors = [0x1a1a3e, 0x222244, 0x252548, 0x2a2a55, 0x1e1e42];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });

    for (const side of [-1, 1]) {
      for (let i = 0; i < 18; i++) {
        const w = 4 + Math.random() * 8;
        const h = 10 + Math.random() * 35;
        const d = 4 + Math.random() * 6;
        const color = glassColors[Math.floor(Math.random() * glassColors.length)];

        const bGeo = new THREE.BoxGeometry(w, h, d);
        const bMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
        const building = new THREE.Mesh(bGeo, bMat);
        building.position.set(
          side * (ROAD_WIDTH / 2 + 4 + Math.random() * 12),
          h / 2,
          -i * 22 - Math.random() * 10
        );
        this.scene.add(building);
        this.themeObjects.push(building);
        this.decorations.push(building);

        const rows = Math.floor(h / 3);
        const cols = Math.floor(w / 2);
        for (let wy = 0; wy < Math.min(rows, 8); wy++) {
          for (let wx = 0; wx < Math.min(cols, 3); wx++) {
            if (Math.random() > 0.4) continue;
            const winGeo = new THREE.BoxGeometry(0.6, 0.9, 0.05);
            const win = new THREE.Mesh(winGeo, windowMat);
            win.position.set(
              (wx - (cols - 1) / 2) * 1.8,
              -h / 2 + 2 + wy * 3,
              -d / 2 - 0.03
            );
            building.add(win);
          }
        }

        if (h > 30) {
          const antGeo = new THREE.CylinderGeometry(0.05, 0.08, 5, 6);
          const antMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
          const ant = new THREE.Mesh(antGeo, antMat);
          ant.position.y = h / 2 + 2.5;
          building.add(ant);

          const blinkGeo = new THREE.SphereGeometry(0.15, 6, 6);
          const blinkMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
          const blink = new THREE.Mesh(blinkGeo, blinkMat);
          blink.position.y = h / 2 + 5;
          building.add(blink);
        }
      }
    }

    // --- Neon signs ---
    const neonColors = [0xff00ff, 0x00ffff, 0xff4444, 0x44ff44];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const nGeo = new THREE.BoxGeometry(2 + Math.random() * 2, 0.8, 0.1);
      const nColor = neonColors[Math.floor(Math.random() * neonColors.length)];
      const nMat = new THREE.MeshBasicMaterial({ color: nColor });
      const neon = new THREE.Mesh(nGeo, nMat);
      neon.position.set(
        side * (ROAD_WIDTH / 2 + 3),
        4 + Math.random() * 3,
        -i * 40 - 20
      );
      this.scene.add(neon);
      this.themeObjects.push(neon);
      this.decorations.push(neon);
    }
  }

  // =====================================================================
  //  PERU — mountains & valleys
  // =====================================================================
  _buildPeru() {
    // --- Mountains ---
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
          color: 0x4a8a2a + Math.floor(Math.random() * 0x101010),
          roughness: 0.9
        });
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.scale.y = 0.4;
        hill.position.set(
          side * (ROAD_WIDTH / 2 + 5 + Math.random() * 10),
          -1,
          -i * 30 - Math.random() * 15
        );
        this.scene.add(hill);
        this.themeObjects.push(hill);
        this.decorations.push(hill);
      }
    }

    // --- Trees ---
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
            (Math.random() - 0.5) * 0.6,
            trunkH + 0.5 + f * 0.4,
            (Math.random() - 0.5) * 0.6
          );
          treeGroup.add(foliage);
        }

        treeGroup.position.set(
          side * (ROAD_WIDTH / 2 + 2 + Math.random() * 6),
          0,
          -i * 22 - Math.random() * 10
        );
        this.scene.add(treeGroup);
        this.themeObjects.push(treeGroup);
        this.decorations.push(treeGroup);
      }
    }

    // --- Inca-like terraces ---
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
        (i % 2 === 0 ? -1 : 1) * (ROAD_WIDTH / 2 + 10 + Math.random() * 5),
        0,
        -i * 80 - 40
      );
      this.scene.add(terrGroup);
      this.themeObjects.push(terrGroup);
      this.decorations.push(terrGroup);
    }

    // (No manual cloud meshes needed — procedural clouds are in the Sky shader)
  }

  // =====================================================================
  //  UPDATE — animate clouds, stars, and scroll decorations
  // =====================================================================
  update(delta, speed) {
    // Animate procedural clouds
    if (this.sky) {
      this.sky.material.uniforms['time'].value += delta;
    }

    // Twinkle stars
    if (this.starField) {
      this.starField.material.uniforms.time.value += delta;
    }

    // Scroll decorations
    const move = speed * delta;
    for (const deco of this.decorations) {
      deco.position.z += move;
      if (deco.position.z > 80) {
        deco.position.z -= 350;
      }
    }
  }
}
