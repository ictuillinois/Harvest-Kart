import * as THREE from 'three';
import { Tween, Easing } from '@tweenjs/tween.js';
import { LANE_POSITIONS, LANE_SWITCH_DURATION, KART_VARIANTS } from '../utils/constants.js';

export class Car {
  constructor(scene) {
    this.group = new THREE.Group();
    this.wheels = [];
    this.currentLane = 1;
    this.isSwitching = false;

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 3);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: KART_VARIANTS[0].body, metalness: 0.3, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, this.bodyMat);
    body.position.y = 0.5;
    this.group.add(body);

    // Cockpit
    const cockpitGeo = new THREE.BoxGeometry(1.4, 0.5, 1.2);
    this.cockpitMat = new THREE.MeshStandardMaterial({ color: KART_VARIANTS[0].accent, metalness: 0.2, roughness: 0.7 });
    const cockpit = new THREE.Mesh(cockpitGeo, this.cockpitMat);
    cockpit.position.set(0, 1.05, -0.2);
    this.group.add(cockpit);

    // Windshield
    const windshieldGeo = new THREE.BoxGeometry(1.3, 0.4, 0.05);
    const windshieldMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.6, metalness: 0.8 });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0, 1.1, -0.85);
    windshield.rotation.x = -0.3;
    this.group.add(windshield);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const positions = [
      { x: -1.0, y: 0.3, z: -1.0 },
      { x: 1.0, y: 0.3, z: -1.0 },
      { x: -1.0, y: 0.3, z: 1.0 },
      { x: 1.0, y: 0.3, z: 1.0 },
    ];

    positions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, pos.y, pos.z);
      this.group.add(wheel);
      this.wheels.push(wheel);
    });

    // Headlights
    const headlightGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 0.8 });
    for (const x of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(headlightGeo, headlightMat);
      hl.position.set(x, 0.5, -1.55);
      this.group.add(hl);
    }

    // Rear spoiler
    const spoilerGeo = new THREE.BoxGeometry(1.8, 0.08, 0.3);
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
    const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
    spoiler.position.set(0, 1.1, 1.3);
    this.group.add(spoiler);
    const spoilerLegs = new THREE.BoxGeometry(0.08, 0.3, 0.08);
    for (const x of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(spoilerLegs, spoilerMat);
      leg.position.set(x, 0.95, 1.3);
      this.group.add(leg);
    }

    this.group.position.set(LANE_POSITIONS[1], 0, 0);
    scene.add(this.group);
  }

  setVariant(index) {
    const variant = KART_VARIANTS[index] || KART_VARIANTS[0];
    this.bodyMat.color.setHex(variant.body);
    this.cockpitMat.color.setHex(variant.accent);
  }

  switchLane(direction) {
    if (this.isSwitching) return;
    const newLane = direction === 'left'
      ? Math.max(0, this.currentLane - 1)
      : Math.min(2, this.currentLane + 1);

    if (newLane === this.currentLane) return;
    this.currentLane = newLane;
    this.isSwitching = true;

    const targetX = LANE_POSITIONS[this.currentLane];
    new Tween(this.group.position)
      .to({ x: targetX }, LANE_SWITCH_DURATION)
      .easing(Easing.Quadratic.Out)
      .onComplete(() => { this.isSwitching = false; })
      .start();
  }

  update(delta, speed) {
    // Spin wheels
    const spinRate = speed * 0.3;
    this.wheels.forEach(w => {
      w.rotation.x += spinRate * delta;
    });
  }
}
