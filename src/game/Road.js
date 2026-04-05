import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, ROAD_SEGMENT_COUNT, COLORS, ROAD_SURFACE_COLORS } from '../utils/constants.js';

function createAsphaltTexture() {
  const size = 256; // reduced from 512 — road is distant, no visible quality loss
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = 90 + Math.random() * 50;
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 20);
  return tex;
}

export class Road {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.lineGroups = [];

    const asphaltTex = createAsphaltTexture();
    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: COLORS.road,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.roadTexture = asphaltTex;
    const roadMat = this.roadMaterial;

    // Shared materials (one instance for all segments)
    const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.roadLine });
    const dashedMat = new THREE.MeshBasicMaterial({ color: COLORS.roadLineDashed });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });

    for (let i = 0; i < ROAD_SEGMENT_COUNT; i++) {
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(ROAD_WIDTH, 0.1, ROAD_SEGMENT_LENGTH),
        roadMat,
      );
      road.position.set(0, -0.05, -i * ROAD_SEGMENT_LENGTH);
      road.receiveShadow = true;
      scene.add(road);
      this.segments.push(road);

      // ── Merge ALL lane markings + curbs into 2 meshes per segment ──
      // (was ~55 individual meshes per segment → now 2)

      // Solid lines: side lines + curbs → merge into 1 mesh
      const solidGeos = [];
      for (const x of [-ROAD_WIDTH / 2 + 0.1, ROAD_WIDTH / 2 - 0.1]) {
        const g = new THREE.BoxGeometry(0.15, 0.02, ROAD_SEGMENT_LENGTH);
        g.translate(x, 0.01, 0);
        solidGeos.push(g);
      }
      const solidMesh = new THREE.Mesh(mergeGeometries(solidGeos), lineMat);
      solidGeos.forEach(g => g.dispose());

      // Dashed lines → merge into 1 mesh
      const dashGeos = [];
      for (const x of [-1.5, 1.5]) {
        for (let d = 0; d < ROAD_SEGMENT_LENGTH; d += 4) {
          const g = new THREE.BoxGeometry(0.12, 0.02, 2);
          g.translate(x, 0.01, -ROAD_SEGMENT_LENGTH / 2 + d + 1);
          dashGeos.push(g);
        }
      }
      const dashMesh = new THREE.Mesh(mergeGeometries(dashGeos), dashedMat);
      dashGeos.forEach(g => g.dispose());

      // Curbs → merge into 1 mesh
      const curbGeos = [];
      for (const x of [-ROAD_WIDTH / 2, ROAD_WIDTH / 2]) {
        const g = new THREE.BoxGeometry(0.2, 0.15, ROAD_SEGMENT_LENGTH);
        g.translate(x, 0.02, 0);
        curbGeos.push(g);
      }
      const curbMesh = new THREE.Mesh(mergeGeometries(curbGeos), curbMat);
      curbGeos.forEach(g => g.dispose());

      const lineGroup = new THREE.Group();
      lineGroup.position.z = road.position.z;
      lineGroup.add(solidMesh, dashMesh, curbMesh);
      scene.add(lineGroup);
      this.lineGroups.push(lineGroup);
    }
  }

  setThemeColor(themeId) {
    const color = ROAD_SURFACE_COLORS[themeId] || ROAD_SURFACE_COLORS.brazil;
    this.roadMaterial.color.set(color);
  }

  update(delta, speed) {
    const move = speed * delta;
    this.roadTexture.offset.y += speed * delta * 0.03;

    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].position.z += move;
      this.lineGroups[i].position.z += move;

      if (this.segments[i].position.z > ROAD_SEGMENT_LENGTH) {
        let minZ = Infinity;
        for (const seg of this.segments) {
          if (seg.position.z < minZ) minZ = seg.position.z;
        }
        this.segments[i].position.z = minZ - ROAD_SEGMENT_LENGTH;
        this.lineGroups[i].position.z = this.segments[i].position.z;
      }
    }
  }
}
