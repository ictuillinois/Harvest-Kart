import * as THREE from 'three';
import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';
import { COLORS, TOTAL_LAMP_POSTS, ROAD_WIDTH } from '../utils/constants.js';

export class LampPost {
  constructor(scene) {
    this.scene = scene;
    this.posts = [];
    this.nextToLight = 0;

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.4 });

    for (let i = 0; i < TOTAL_LAMP_POSTS; i++) {
      const group = new THREE.Group();

      // Pole (4.5 units tall — prominent along road, taller than kart+driver)
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2.25;
      group.add(pole);

      // Arm extending toward road
      const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(-0.9, 4.3, 0);
      group.add(arm);

      // Lamp housing
      const housingGeo = new THREE.BoxGeometry(0.5, 0.2, 0.35);
      const housingMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.4 });
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(-1.8, 4.35, 0);
      group.add(housing);

      // Lamp head (bulb)
      const headMat = new THREE.MeshStandardMaterial({
        color: COLORS.lampDim,
        emissive: COLORS.lampDim,
        emissiveIntensity: 0.15,
        metalness: 0.2,
        roughness: 0.4,
      });
      const headGeo = new THREE.SphereGeometry(0.25, 10, 10);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(-1.8, 4.15, 0);
      group.add(head);

      // PointLight
      const light = new THREE.PointLight(COLORS.lampLight, 0.3, 18, 2);
      light.position.set(-1.8, 4.0, 0);
      group.add(light);

      // Light cone visual
      const coneGeo = new THREE.ConeGeometry(1.0, 3.5, 8, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: COLORS.lampDim,
        transparent: true,
        opacity: 0.03,
        side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(-1.8, 2.2, 0);
      cone.rotation.x = Math.PI;
      group.add(cone);

      // Place along road sides
      const side = i % 2 === 0 ? 1 : -1;
      group.position.set(
        side * (ROAD_WIDTH / 2 + 1.5),
        0,
        -30 - i * 35
      );
      if (side === -1) group.scale.x = -1;

      scene.add(group);
      this.posts.push({ group, head, headMat, light, cone, coneMat, lit: false });
    }
  }

  lightUp(index) {
    if (index >= this.posts.length) return;
    const post = this.posts[index];
    if (post.lit) return;
    post.lit = true;

    // Dramatically increase light intensity (dim → very bright)
    new Tween(post.light, tweenGroup)
      .to({ intensity: 20, distance: 20 }, 1000)
      .easing(Easing.Quadratic.Out)
      .start();

    // Bright emissive glow on bulb
    const targetColor = new THREE.Color(COLORS.lampOn);
    const color = { r: post.headMat.emissive.r, g: post.headMat.emissive.g, b: post.headMat.emissive.b };
    new Tween(color, tweenGroup)
      .to({ r: targetColor.r, g: targetColor.g, b: targetColor.b }, 1000)
      .easing(Easing.Quadratic.Out)
      .onUpdate(() => {
        post.headMat.emissive.setRGB(color.r, color.g, color.b);
        post.headMat.emissiveIntensity = 3;
      })
      .start();

    post.headMat.color.setHex(COLORS.lampOn);

    // Light cone becomes visible
    new Tween(post.coneMat, tweenGroup)
      .to({ opacity: 0.15 }, 1000)
      .easing(Easing.Quadratic.Out)
      .start();
    post.coneMat.color.setHex(COLORS.lampOn);
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
      post.light.intensity = 0.3;
      post.light.distance = 15;
      post.headMat.color.setHex(COLORS.lampDim);
      post.headMat.emissive.setHex(COLORS.lampDim);
      post.headMat.emissiveIntensity = 0.15;
      post.coneMat.opacity = 0.03;
      post.coneMat.color.setHex(COLORS.lampDim);
    }
  }

  update(delta, speed) {
    const move = speed * delta;
    for (const post of this.posts) {
      post.group.position.z += move;
    }
  }
}
