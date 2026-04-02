import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, MAP_THEMES } from '../utils/constants.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.decorations = [];
    this.themeObjects = []; // everything theme-specific, for cleanup on rebuild
    this.sky = null;
    this.ambientLight = null;
    this.dirLight = null;
    this.hemiLight = null;
    this.ground = null;
  }

  build(themeIndex) {
    // Remove old theme objects
    for (const obj of this.themeObjects) {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    this.themeObjects = [];
    this.decorations = [];

    // Remove old shared objects
    if (this.sky) this.scene.remove(this.sky);
    if (this.ambientLight) this.scene.remove(this.ambientLight);
    if (this.dirLight) this.scene.remove(this.dirLight);
    if (this.hemiLight) this.scene.remove(this.hemiLight);
    if (this.ground) this.scene.remove(this.ground);

    const theme = MAP_THEMES[themeIndex] || MAP_THEMES[0];

    // === SKY DOME ===
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(theme.skyTop) },
        midColor: { value: new THREE.Color(theme.skyMid) },
        bottomColor: { value: new THREE.Color(theme.skyBottom) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 color;
          if (h > 0.0) {
            color = mix(midColor, topColor, h);
          } else {
            color = mix(midColor, bottomColor, -h);
          }
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // === FOG ===
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);

    // === LIGHTING ===
    this.ambientLight = new THREE.AmbientLight(theme.ambientColor, theme.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(theme.dirColor, theme.dirIntensity);
    this.dirLight.position.set(10, 20, -10);
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(theme.skyMid, theme.ground, 0.3);
    this.scene.add(this.hemiLight);

    // === GROUND ===
    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.1;
    this.scene.add(this.ground);

    // === BARRIERS (shared) ===
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

    // === THEME-SPECIFIC DECORATIONS ===
    switch (theme.id) {
      case 'brazil': this._buildBrazil(); break;
      case 'usa': this._buildUSA(); break;
      case 'peru': this._buildPeru(); break;
    }
  }

  _buildBrazil() {
    // --- Sun ---
    const sunGeo = new THREE.SphereGeometry(15, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(80, 100, -200);
    this.scene.add(sun);
    this.themeObjects.push(sun);

    // Sun glow
    const glowGeo = new THREE.SphereGeometry(25, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.3 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(sun.position);
    this.scene.add(glow);
    this.themeObjects.push(glow);

    // --- Palm trees ---
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.7 });

    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        const palmGroup = new THREE.Group();
        const height = 5 + Math.random() * 4;

        // Curved trunk using multiple segments
        for (let s = 0; s < 5; s++) {
          const segGeo = new THREE.CylinderGeometry(0.15 - s * 0.02, 0.18 - s * 0.02, height / 5, 6);
          const seg = new THREE.Mesh(segGeo, trunkMat);
          seg.position.y = (s + 0.5) * height / 5;
          seg.position.x = Math.sin(s * 0.15) * 0.3;
          palmGroup.add(seg);
        }

        // Palm fronds (multiple leaves radiating out)
        for (let f = 0; f < 7; f++) {
          const leafGeo = new THREE.BoxGeometry(0.3, 0.05, 2.5 + Math.random());
          const leaf = new THREE.Mesh(leafGeo, leafMat);
          leaf.position.set(0, height + 0.2, 0);
          const angle = (f / 7) * Math.PI * 2;
          leaf.rotation.y = angle;
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

        // Roof terrace / flat roof detail
        const roofGeo = new THREE.BoxGeometry(w + 0.2, 0.1, d + 0.2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xcc8866 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = h / 2 + 0.05;
        building.add(roof);
      }
    }

    // --- Beach sand strip further out ---
    const sandGeo = new THREE.PlaneGeometry(200, 30);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xf4d99a, roughness: 1 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(60, -0.05, -150);
    this.scene.add(sand);
    this.themeObjects.push(sand);
  }

  _buildUSA() {
    // --- Moon ---
    const moonGeo = new THREE.SphereGeometry(8, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-50, 120, -250);
    this.scene.add(moon);
    this.themeObjects.push(moon);

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
        const bMat = new THREE.MeshStandardMaterial({
          color, metalness: 0.6, roughness: 0.3
        });
        const building = new THREE.Mesh(bGeo, bMat);
        building.position.set(
          side * (ROAD_WIDTH / 2 + 4 + Math.random() * 12),
          h / 2,
          -i * 22 - Math.random() * 10
        );
        this.scene.add(building);
        this.themeObjects.push(building);
        this.decorations.push(building);

        // Window lights (grid)
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

        // Antenna on tallest buildings
        if (h > 30) {
          const antGeo = new THREE.CylinderGeometry(0.05, 0.08, 5, 6);
          const antMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
          const ant = new THREE.Mesh(antGeo, antMat);
          ant.position.y = h / 2 + 2.5;
          building.add(ant);

          // Blinking red light
          const blinkGeo = new THREE.SphereGeometry(0.15, 6, 6);
          const blinkMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
          const blink = new THREE.Mesh(blinkGeo, blinkMat);
          blink.position.y = h / 2 + 5;
          building.add(blink);
        }
      }
    }

    // --- Neon signs (simple glowing boxes) ---
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

        // Snow caps on tall mountains
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

    // --- Trees (varied, lush) ---
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

        // Bushy foliage (multiple spheres)
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

    // --- Terrace structures (Inca-like) ---
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

    // --- Clouds ---
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 8; i++) {
      const cloudGroup = new THREE.Group();
      for (let p = 0; p < 4; p++) {
        const cGeo = new THREE.SphereGeometry(3 + Math.random() * 3, 8, 6);
        const puff = new THREE.Mesh(cGeo, cloudMat);
        puff.position.set(p * 3.5, Math.random() * 1.5, Math.random() * 2);
        puff.scale.y = 0.5;
        cloudGroup.add(puff);
      }
      cloudGroup.position.set(
        (Math.random() - 0.5) * 150,
        40 + Math.random() * 30,
        -i * 50 - Math.random() * 30
      );
      this.scene.add(cloudGroup);
      this.themeObjects.push(cloudGroup);
    }
  }

  update(delta, speed) {
    const move = speed * delta;
    for (const deco of this.decorations) {
      deco.position.z += move;
      if (deco.position.z > 80) {
        deco.position.z -= 350;
      }
    }
  }
}
