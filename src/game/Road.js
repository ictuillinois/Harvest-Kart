import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, ROAD_SEGMENT_COUNT, COLORS } from '../utils/constants.js';

export class Road {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.lineGroups = [];

    const roadMat = new THREE.MeshStandardMaterial({ color: COLORS.road, roughness: 0.9 });
    const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.roadLine });
    const dashedMat = new THREE.MeshBasicMaterial({ color: COLORS.roadLineDashed });

    for (let i = 0; i < ROAD_SEGMENT_COUNT; i++) {
      // Road surface
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

      // Dashed center lines (between lanes at x = -1.5 and x = 1.5)
      for (const x of [-1.5, 1.5]) {
        for (let d = 0; d < ROAD_SEGMENT_LENGTH; d += 4) {
          const geo = new THREE.BoxGeometry(0.12, 0.02, 2);
          const dash = new THREE.Mesh(geo, dashedMat);
          dash.position.set(x, 0.01, -ROAD_SEGMENT_LENGTH / 2 + d + 1);
          lineGroup.add(dash);
        }
      }

      scene.add(lineGroup);
      this.lineGroups.push(lineGroup);
    }
  }

  update(delta, speed) {
    const move = speed * delta;
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].position.z += move;
      this.lineGroups[i].position.z += move;

      // Recycle segment that passed behind camera
      if (this.segments[i].position.z > ROAD_SEGMENT_LENGTH) {
        // Find the furthest segment
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
