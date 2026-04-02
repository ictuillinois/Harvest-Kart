import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, COLORS } from '../utils/constants.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.decorations = [];

    // --- Gradient sky dome ---
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(COLORS.skyTop) },
        midColor: { value: new THREE.Color(COLORS.skyMid) },
        bottomColor: { value: new THREE.Color(COLORS.skyBottom) },
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
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x554466, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffaa77, 0.8);
    dirLight.position.set(10, 20, -10);
    scene.add(dirLight);

    // Subtle hemisphere light for color variation
    const hemiLight = new THREE.HemisphereLight(0xff8866, 0x443366, 0.3);
    scene.add(hemiLight);

    // --- Ground plane (beyond road) ---
    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    scene.add(ground);

    // --- Barriers / Guardrails ---
    const barrierMat = new THREE.MeshStandardMaterial({ color: COLORS.barrier, metalness: 0.5, roughness: 0.6 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const barrierGeo = new THREE.BoxGeometry(0.3, 0.8, ROAD_SEGMENT_LENGTH * 0.9);
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(
          side * (ROAD_WIDTH / 2 + 0.5),
          0.4,
          -i * ROAD_SEGMENT_LENGTH * 0.9
        );
        scene.add(barrier);
        this.decorations.push(barrier);
      }
    }

    // --- Building silhouettes ---
    const buildingMat = new THREE.MeshStandardMaterial({ color: COLORS.building, roughness: 0.9 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 15; i++) {
        const w = 3 + Math.random() * 6;
        const h = 5 + Math.random() * 20;
        const d = 3 + Math.random() * 6;
        const buildingGeo = new THREE.BoxGeometry(w, h, d);
        const building = new THREE.Mesh(buildingGeo, buildingMat);
        building.position.set(
          side * (ROAD_WIDTH / 2 + 4 + Math.random() * 8),
          h / 2,
          -i * 25 - Math.random() * 10
        );
        scene.add(building);
        this.decorations.push(building);

        // Random window lights
        if (Math.random() > 0.5) {
          const windowMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
          for (let wy = 0; wy < Math.min(h / 3, 4); wy++) {
            for (let wx = 0; wx < 2; wx++) {
              if (Math.random() > 0.4) continue;
              const winGeo = new THREE.BoxGeometry(0.5, 0.8, 0.1);
              const win = new THREE.Mesh(winGeo, windowMat);
              win.position.set(
                (wx - 0.5) * 1.5,
                -h / 2 + 2 + wy * 2.5,
                -d / 2 - 0.05
              );
              building.add(win);
            }
          }
        }
      }
    }

    // --- Trees / Poles for depth ---
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1a4a1a });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const treeGroup = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, 6);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1;
        treeGroup.add(trunk);

        const foliageGeo = new THREE.SphereGeometry(1.2, 8, 6);
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 2.8;
        foliage.scale.y = 1.3;
        treeGroup.add(foliage);

        treeGroup.position.set(
          side * (ROAD_WIDTH / 2 + 2 + Math.random() * 3),
          0,
          -i * 30 - Math.random() * 15
        );
        scene.add(treeGroup);
        this.decorations.push(treeGroup);
      }
    }
  }

  update(delta, speed) {
    const move = speed * delta;
    for (const deco of this.decorations) {
      deco.position.z += move;
      // Recycle far decorations
      if (deco.position.z > 80) {
        deco.position.z -= 350;
      }
    }
  }
}
