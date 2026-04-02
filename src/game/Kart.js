import * as THREE from 'three';
import { Tween, Easing } from '@tweenjs/tween.js';
import { LANE_POSITIONS, LANE_SWITCH_DURATION, DRIVER_TYPES } from '../utils/constants.js';

export class Kart {
  constructor(scene) {
    this.group = new THREE.Group();
    this.wheels = [];
    this.currentLane = 1;
    this.isSwitching = false;
    this.driverGroup = null;

    this._buildKart(DRIVER_TYPES[0]);
    this.group.position.set(LANE_POSITIONS[1], 0, 0);
    scene.add(this.group);
  }

  _buildKart(driver) {
    // Clear previous
    while (this.group.children.length) {
      this.group.remove(this.group.children[0]);
    }
    this.wheels = [];

    const kartBody = driver.kartBody;
    const kartAccent = driver.kartAccent;

    // === KART CHASSIS ===
    // Main body — low and wide
    const chassisGeo = new THREE.BoxGeometry(2.0, 0.3, 3.2);
    const chassisMat = new THREE.MeshStandardMaterial({ color: kartBody, metalness: 0.4, roughness: 0.5 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.35;
    this.group.add(chassis);

    // Front nose (tapered)
    const noseGeo = new THREE.BoxGeometry(1.6, 0.25, 0.8);
    const noseMat = new THREE.MeshStandardMaterial({ color: kartAccent, metalness: 0.3, roughness: 0.6 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 0.33, -1.8);
    this.group.add(nose);

    // Front bumper
    const bumperGeo = new THREE.BoxGeometry(2.2, 0.15, 0.15);
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6 });
    const bumper = new THREE.Mesh(bumperGeo, bumperMat);
    bumper.position.set(0, 0.3, -2.15);
    this.group.add(bumper);

    // Side panels
    for (const side of [-1, 1]) {
      const panelGeo = new THREE.BoxGeometry(0.12, 0.4, 2.6);
      const panel = new THREE.Mesh(panelGeo, new THREE.MeshStandardMaterial({ color: kartAccent, metalness: 0.3 }));
      panel.position.set(side * 1.0, 0.5, -0.2);
      this.group.add(panel);
    }

    // Rear engine block
    const engineGeo = new THREE.BoxGeometry(1.2, 0.5, 0.6);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.set(0, 0.6, 1.4);
    this.group.add(engine);

    // Exhaust pipes
    for (const side of [-0.35, 0.35]) {
      const exhaustGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8);
      const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
      const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(side, 0.55, 1.85);
      this.group.add(exhaust);
    }

    // Seat
    const seatBaseGeo = new THREE.BoxGeometry(0.8, 0.12, 0.7);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const seatBase = new THREE.Mesh(seatBaseGeo, seatMat);
    seatBase.position.set(0, 0.56, 0.3);
    this.group.add(seatBase);

    const seatBackGeo = new THREE.BoxGeometry(0.75, 0.6, 0.12);
    const seatBack = new THREE.Mesh(seatBackGeo, seatMat);
    seatBack.position.set(0, 0.85, 0.65);
    seatBack.rotation.x = 0.1;
    this.group.add(seatBack);

    // Steering column
    const steerColGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const steerMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 });
    const steerCol = new THREE.Mesh(steerColGeo, steerMat);
    steerCol.rotation.x = -0.5;
    steerCol.position.set(0, 0.7, -0.5);
    this.group.add(steerCol);

    // Steering wheel
    const steerWheelGeo = new THREE.TorusGeometry(0.15, 0.025, 8, 16);
    const steerWheel = new THREE.Mesh(steerWheelGeo, steerMat);
    steerWheel.position.set(0, 0.9, -0.7);
    steerWheel.rotation.x = -0.5;
    this.group.add(steerWheel);

    // Headlights
    const hlGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 0.8 });
    for (const x of [-0.7, 0.7]) {
      const hl = new THREE.Mesh(hlGeo, hlMat);
      hl.position.set(x, 0.35, -2.15);
      this.group.add(hl);
    }

    // Tail lights
    const tlGeo = new THREE.BoxGeometry(0.2, 0.1, 0.05);
    const tlMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    for (const x of [-0.7, 0.7]) {
      const tl = new THREE.Mesh(tlGeo, tlMat);
      tl.position.set(x, 0.4, 1.6);
      this.group.add(tl);
    }

    // === WHEELS ===
    const wheelPositions = [
      { x: -1.1, y: 0.22, z: -1.3 },
      { x: 1.1, y: 0.22, z: -1.3 },
      { x: -1.1, y: 0.22, z: 1.0 },
      { x: 1.1, y: 0.22, z: 1.0 },
    ];

    wheelPositions.forEach(pos => {
      const wheelGroup = new THREE.Group();

      // Tire
      const tireGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 16);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      wheelGroup.add(tire);

      // Hub
      const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.24, 8);
      const hubMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7 });
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);

      wheelGroup.position.set(pos.x, pos.y, pos.z);
      this.group.add(wheelGroup);
      this.wheels.push(wheelGroup);
    });

    // === ROLL BAR ===
    const rollBarMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 });
    // Vertical posts
    for (const x of [-0.5, 0.5]) {
      const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8);
      const post = new THREE.Mesh(postGeo, rollBarMat);
      post.position.set(x, 1.15, 0.6);
      this.group.add(post);
    }
    // Cross bar
    const crossGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8);
    const cross = new THREE.Mesh(crossGeo, rollBarMat);
    cross.rotation.z = Math.PI / 2;
    cross.position.set(0, 1.5, 0.6);
    this.group.add(cross);

    // === NUMBER PLATE ===
    const plateGeo = new THREE.BoxGeometry(0.5, 0.3, 0.02);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.4, -2.17);
    this.group.add(plate);

    // === BUILD DRIVER ===
    this._buildDriver(driver);
  }

  _buildDriver(driver) {
    const dg = new THREE.Group();
    this.driverGroup = dg;

    const skinMat = new THREE.MeshStandardMaterial({ color: driver.skinColor, roughness: 0.8 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: driver.shirtColor, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: driver.pantsColor, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: driver.hairColor, roughness: 0.9 });

    const scale = driver.type === 'kid' ? 0.75 : 1.0;

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.5 * scale, 0.55 * scale, 0.3 * scale);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.set(0, 0.9, 0.2);
    dg.add(torso);

    // Head
    const headGeo = new THREE.SphereGeometry(0.2 * scale, 12, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.35 * scale + (driver.type === 'kid' ? 0.15 : 0.0), 0.2);
    dg.add(head);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
    for (const x of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(
        head.position.x + x,
        head.position.y + 0.03,
        head.position.z - 0.17 * scale
      );
      dg.add(eye);
    }

    // Upper legs (seated)
    for (const x of [-0.12, 0.12]) {
      const legGeo = new THREE.BoxGeometry(0.14 * scale, 0.12 * scale, 0.45 * scale);
      const leg = new THREE.Mesh(legGeo, pantsMat);
      leg.position.set(x, 0.6, 0.0);
      dg.add(leg);
    }

    // Lower legs
    for (const x of [-0.12, 0.12]) {
      const lowerGeo = new THREE.BoxGeometry(0.13 * scale, 0.35 * scale, 0.13 * scale);
      const lower = new THREE.Mesh(lowerGeo, pantsMat);
      lower.position.set(x, 0.45, -0.22);
      dg.add(lower);
    }

    // Shoes
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    for (const x of [-0.12, 0.12]) {
      const shoeGeo = new THREE.BoxGeometry(0.14 * scale, 0.08, 0.2);
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(x, 0.28, -0.28);
      dg.add(shoe);
    }

    // Arms reaching toward steering wheel
    const armMat = shirtMat;
    for (const side of [-1, 1]) {
      // Upper arm
      const upperGeo = new THREE.BoxGeometry(0.12 * scale, 0.3 * scale, 0.12 * scale);
      const upper = new THREE.Mesh(upperGeo, armMat);
      upper.position.set(side * 0.32, 0.85, 0.05);
      upper.rotation.x = -0.3;
      dg.add(upper);

      // Forearm
      const foreGeo = new THREE.BoxGeometry(0.11 * scale, 0.28 * scale, 0.11 * scale);
      const fore = new THREE.Mesh(foreGeo, skinMat);
      fore.position.set(side * 0.25, 0.78, -0.25);
      fore.rotation.x = -0.8;
      dg.add(fore);

      // Hand on steering wheel
      const handGeo = new THREE.SphereGeometry(0.05 * scale, 6, 6);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.set(side * 0.15, 0.82, -0.55);
      dg.add(hand);
    }

    // === CHARACTER-SPECIFIC FEATURES ===
    if (driver.type === 'professor') {
      // Glasses - two round lenses + bridge
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7 });
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff, transparent: true, opacity: 0.4, metalness: 0.8
      });

      for (const x of [-0.08, 0.08]) {
        // Frame
        const frameGeo = new THREE.TorusGeometry(0.055, 0.008, 8, 16);
        const frame = new THREE.Mesh(frameGeo, glassMat);
        frame.position.set(
          head.position.x + x,
          head.position.y + 0.02,
          head.position.z - 0.18
        );
        dg.add(frame);

        // Lens
        const lensGeo = new THREE.CircleGeometry(0.05, 12);
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(
          head.position.x + x,
          head.position.y + 0.02,
          head.position.z - 0.185
        );
        dg.add(lens);
      }

      // Bridge
      const bridgeGeo = new THREE.BoxGeometry(0.08, 0.012, 0.01);
      const bridge = new THREE.Mesh(bridgeGeo, glassMat);
      bridge.position.set(head.position.x, head.position.y + 0.02, head.position.z - 0.18);
      dg.add(bridge);

      // White/gray hair — messy tufts
      for (let i = 0; i < 8; i++) {
        const tuftGeo = new THREE.BoxGeometry(
          0.06 + Math.random() * 0.04,
          0.08 + Math.random() * 0.06,
          0.06 + Math.random() * 0.04
        );
        const tuft = new THREE.Mesh(tuftGeo, hairMat);
        const angle = (i / 8) * Math.PI * 2;
        tuft.position.set(
          head.position.x + Math.cos(angle) * 0.16,
          head.position.y + 0.12 + Math.random() * 0.06,
          head.position.z + Math.sin(angle) * 0.14
        );
        dg.add(tuft);
      }

      // Mustache
      const mustGeo = new THREE.BoxGeometry(0.12, 0.03, 0.03);
      const must = new THREE.Mesh(mustGeo, hairMat);
      must.position.set(head.position.x, head.position.y - 0.06, head.position.z - 0.17);
      dg.add(must);

      // Lab coat collar
      const collarGeo = new THREE.BoxGeometry(0.55, 0.08, 0.35);
      const collarMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
      const collar = new THREE.Mesh(collarGeo, collarMat);
      collar.position.set(0, 1.15, 0.2);
      dg.add(collar);
    }

    if (driver.type === 'kid') {
      // Baseball cap
      const capMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.7 });
      // Cap dome
      const capGeo = new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(head.position.x, head.position.y + 0.03, head.position.z);
      dg.add(cap);

      // Cap brim
      const brimGeo = new THREE.BoxGeometry(0.3, 0.02, 0.15);
      const brim = new THREE.Mesh(brimGeo, capMat);
      brim.position.set(head.position.x, head.position.y + 0.01, head.position.z - 0.2);
      dg.add(brim);

      // Freckles (small dots)
      const freckleMat = new THREE.MeshBasicMaterial({ color: 0xbb8855 });
      for (const pos of [[-0.06, -0.02], [0.06, -0.02], [-0.04, -0.05], [0.04, -0.05]]) {
        const fGeo = new THREE.SphereGeometry(0.012, 4, 4);
        const f = new THREE.Mesh(fGeo, freckleMat);
        f.position.set(
          head.position.x + pos[0],
          head.position.y + pos[1],
          head.position.z - 0.19
        );
        dg.add(f);
      }

      // Backpack
      const bpGeo = new THREE.BoxGeometry(0.3, 0.35, 0.15);
      const bpMat = new THREE.MeshStandardMaterial({ color: 0x2980b9 });
      const bp = new THREE.Mesh(bpGeo, bpMat);
      bp.position.set(0, 0.9, 0.4);
      dg.add(bp);
    }

    if (driver.type === 'woman') {
      // Blonde hair — long, flowing
      // Hair top
      const hairTopGeo = new THREE.SphereGeometry(0.22, 12, 10);
      const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
      hairTop.position.set(head.position.x, head.position.y + 0.06, head.position.z + 0.02);
      hairTop.scale.set(1, 0.9, 1.1);
      dg.add(hairTop);

      // Hair sides flowing down
      for (const side of [-1, 1]) {
        const sideHairGeo = new THREE.BoxGeometry(0.08, 0.35, 0.14);
        const sideHair = new THREE.Mesh(sideHairGeo, hairMat);
        sideHair.position.set(
          head.position.x + side * 0.18,
          head.position.y - 0.15,
          head.position.z + 0.04
        );
        dg.add(sideHair);
      }

      // Ponytail
      const ptGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.4, 8);
      const pt = new THREE.Mesh(ptGeo, hairMat);
      pt.position.set(head.position.x, head.position.y - 0.05, head.position.z + 0.22);
      pt.rotation.x = 0.4;
      dg.add(pt);

      // Lips
      const lipGeo = new THREE.BoxGeometry(0.06, 0.02, 0.02);
      const lipMat = new THREE.MeshStandardMaterial({ color: 0xcc4455 });
      const lip = new THREE.Mesh(lipGeo, lipMat);
      lip.position.set(head.position.x, head.position.y - 0.09, head.position.z - 0.18);
      dg.add(lip);

      // Earrings
      const earMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 });
      for (const side of [-1, 1]) {
        const earGeo = new THREE.SphereGeometry(0.025, 6, 6);
        const ear = new THREE.Mesh(earGeo, earMat);
        ear.position.set(
          head.position.x + side * 0.2,
          head.position.y - 0.08,
          head.position.z
        );
        dg.add(ear);
      }
    }

    // Smile (shared)
    const smileMat = new THREE.MeshBasicMaterial({ color: 0xcc4444 });
    if (driver.type !== 'woman') {
      const smileGeo = new THREE.BoxGeometry(0.07, 0.015, 0.015);
      const smile = new THREE.Mesh(smileGeo, smileMat);
      smile.position.set(head.position.x, head.position.y - 0.08, head.position.z - 0.18);
      dg.add(smile);
    }

    // Helmet visor (shared racing safety)
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x333333, metalness: 0.3, roughness: 0.5
    });

    this.group.add(dg);
  }

  setDriver(index) {
    const driver = DRIVER_TYPES[index] || DRIVER_TYPES[0];
    if (this.driverGroup) {
      this.group.remove(this.driverGroup);
    }
    this._buildKart(driver);
    // Reset lane state so controls work immediately
    this.currentLane = 1;
    this.isSwitching = false;
    this.group.position.x = LANE_POSITIONS[1];
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
    const spinRate = speed * 0.3;
    this.wheels.forEach(w => {
      // Spin the wheel group's first child (the tire cylinder) around X
      w.children.forEach(child => {
        child.rotation.x += spinRate * delta;
      });
    });
  }
}
