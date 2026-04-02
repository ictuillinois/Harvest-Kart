import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, ROAD_SEGMENT_COUNT, COLORS } from '../utils/constants.js';

// Generate a procedural asphalt texture via Canvas
function createAsphaltTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base dark asphalt
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, size, size);

  // Noise grain for texture
  for (let i = 0; i < 15000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = 25 + Math.random() * 30;
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // Subtle cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 20); // stretch across road width, repeat along length
  return tex;
}

export class Road {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.lineGroups = [];

    const asphaltTex = createAsphaltTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: COLORS.road,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.roadTexture = asphaltTex;

    const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.roadLine });
    const dashedMat = new THREE.MeshBasicMaterial({ color: COLORS.roadLineDashed });

    for (let i = 0; i < ROAD_SEGMENT_COUNT; i++) {
      // Road surface with texture
      const roadGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.1, ROAD_SEGMENT_LENGTH);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.position.set(0, -0.05, -i * ROAD_SEGMENT_LENGTH);
      road.receiveShadow = true;
      scene.add(road);
      this.segments.push(road);

      // Lane lines group
      const lineGroup = new THREE.Group();
      lineGroup.position.z = road.position.z;

      // Side lines (solid)
      for (const x of [-ROAD_WIDTH / 2 + 0.1, ROAD_WIDTH / 2 - 0.1]) {
        const geo = new THREE.BoxGeometry(0.15, 0.02, ROAD_SEGMENT_LENGTH);
        const line = new THREE.Mesh(geo, lineMat);
        line.position.set(x, 0.01, 0);
        lineGroup.add(line);
      }

      // Dashed center lines
      for (const x of [-1.5, 1.5]) {
        for (let d = 0; d < ROAD_SEGMENT_LENGTH; d += 4) {
          const geo = new THREE.BoxGeometry(0.12, 0.02, 2);
          const dash = new THREE.Mesh(geo, dashedMat);
          dash.position.set(x, 0.01, -ROAD_SEGMENT_LENGTH / 2 + d + 1);
          lineGroup.add(dash);
        }
      }

      // Road edge curbs (thin raised strips)
      for (const x of [-ROAD_WIDTH / 2, ROAD_WIDTH / 2]) {
        const curbGeo = new THREE.BoxGeometry(0.2, 0.15, ROAD_SEGMENT_LENGTH);
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
        const curb = new THREE.Mesh(curbGeo, curbMat);
        curb.position.set(x, 0.02, 0);
        lineGroup.add(curb);
      }

      scene.add(lineGroup);
      this.lineGroups.push(lineGroup);
    }
  }

  update(delta, speed) {
    const move = speed * delta;

    // Scroll road texture UV for surface motion
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
