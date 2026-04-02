import * as THREE from 'three';
import { Tween, Easing } from '@tweenjs/tween.js';
import { COLORS, TOTAL_LAMP_POSTS, ROAD_WIDTH } from '../utils/constants.js';

export class LampPost {
  constructor(scene) {
    this.scene = scene;
    this.posts = [];
    this.nextToLight = 0;

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.4 });
    const headOffMat = new THREE.MeshStandardMaterial({
      color: COLORS.lampOff,
      emissive: 0x000000,
      emissiveIntensity: 0,
      metalness: 0.3,
      roughness: 0.5,
    });

    for (let i = 0; i < TOTAL_LAMP_POSTS; i++) {
      const group = new THREE.Group();

      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 6, 8);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 3;
      group.add(pole);

      // Arm extending over road
      const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(-1.25, 5.8, 0);
      group.add(arm);

      // Lamp head
      const headMat = headOffMat.clone();
      const headGeo = new THREE.SphereGeometry(0.4, 12, 12);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(-2.5, 5.7, 0);
      group.add(head);

      // PointLight (off initially)
      const light = new THREE.PointLight(COLORS.lampLight, 0, 25, 1.5);
      light.position.set(-2.5, 5.5, 0);
      group.add(light);

      // Place along right side of road, spaced evenly
      const side = i % 2 === 0 ? 1 : -1;
      group.position.set(
        side * (ROAD_WIDTH / 2 + 0.5),
        0,
        -30 - i * 35
      );
      if (side === -1) {
        group.scale.x = -1; // Mirror for left side
      }

      scene.add(group);
      this.posts.push({ group, head, headMat, light, lit: false });
    }
  }

  lightUp(index) {
    if (index >= this.posts.length) return;
    const post = this.posts[index];
    if (post.lit) return;
    post.lit = true;

    // Tween light intensity
    new Tween(post.light)
      .to({ intensity: 15 }, 800)
      .easing(Easing.Quadratic.Out)
      .start();

    // Tween emissive glow
    const color = { r: 0, g: 0, b: 0 };
    const targetColor = new THREE.Color(COLORS.lampOn);
    new Tween(color)
      .to({ r: targetColor.r, g: targetColor.g, b: targetColor.b }, 800)
      .easing(Easing.Quadratic.Out)
      .onUpdate(() => {
        post.headMat.emissive.setRGB(color.r, color.g, color.b);
        post.headMat.emissiveIntensity = 2;
      })
      .start();

    post.headMat.color.setHex(COLORS.lampOn);
  }

  lightNext() {
    if (this.nextToLight < this.posts.length) {
      this.lightUp(this.nextToLight);
      this.nextToLight++;
    }
  }

  resetAll() {
    this.nextToLight = 0;
    for (const post of this.posts) {
      post.lit = false;
      post.light.intensity = 0;
      post.headMat.color.setHex(COLORS.lampOff);
      post.headMat.emissive.setRGB(0, 0, 0);
      post.headMat.emissiveIntensity = 0;
    }
  }

  update(delta, speed) {
    // Scroll posts with road
    const move = speed * delta;
    for (const post of this.posts) {
      post.group.position.z += move;
    }
  }
}
