import * as THREE from 'three';
import {
  LANE_POSITIONS, COLORS, PLATE_SPAWN_INTERVAL,
  PLATE_COLLISION_Z_THRESHOLD, ROAD_SEGMENT_LENGTH
} from '../utils/constants.js';

const PLATE_POOL_SIZE = 20;

// Procedural radial glow texture for plate sprites
function createGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(57,255,20,0.6)');
  gradient.addColorStop(0.4, 'rgba(57,255,20,0.2)');
  gradient.addColorStop(1, 'rgba(57,255,20,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class Plate {
  constructor(scene) {
    this.scene = scene;
    this.plates = [];
    this.particles = [];
    this.timeSinceSpawn = 0;
    this.spawnInterval = PLATE_SPAWN_INTERVAL;

    const plateGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 16);
    const glowTex = createGlowTexture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    for (let i = 0; i < PLATE_POOL_SIZE; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.plate,
        emissive: COLORS.plate,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.9,
        metalness: 0.4,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(plateGeo, mat);
      mesh.position.set(0, 0.05, -999);
      mesh.visible = false;
      mesh.userData = { active: false, hit: false, lane: 0 };

      // Glow sprite (child of plate — moves with it)
      const glow = new THREE.Sprite(glowMat.clone());
      glow.scale.set(3, 3, 1);
      glow.position.y = 0.1;
      mesh.add(glow);

      scene.add(mesh);
      this.plates.push(mesh);
    }

    // Particle pool
    const particleGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const particleMat = new THREE.MeshBasicMaterial({ color: COLORS.plateGlow });
    for (let i = 0; i < 30; i++) {
      const p = new THREE.Mesh(particleGeo, particleMat.clone());
      p.visible = false;
      p.userData = { velocity: new THREE.Vector3(), life: 0 };
      scene.add(p);
      this.particles.push(p);
    }
  }

  spawnPlate(aheadZ) {
    const plate = this.plates.find(p => !p.userData.active);
    if (!plate) return;

    const laneIdx = Math.floor(Math.random() * 3);
    plate.position.set(LANE_POSITIONS[laneIdx], 0.05, aheadZ);
    plate.visible = true;
    plate.scale.set(1, 1, 1);
    plate.material.emissiveIntensity = 0.5;
    plate.material.opacity = 0.9;
    plate.userData.active = true;
    plate.userData.hit = false;
    plate.userData.lane = laneIdx;
  }

  checkCollision(playerLane) {
    for (const plate of this.plates) {
      if (!plate.userData.active || plate.userData.hit) continue;
      if (plate.userData.lane === playerLane && Math.abs(plate.position.z) < PLATE_COLLISION_Z_THRESHOLD) {
        plate.userData.hit = true;
        this.animateHit(plate);
        return true;
      }
    }
    return false;
  }

  animateHit(plate) {
    // Press down + flash
    const startY = plate.position.y;
    const duration = 300;
    const start = performance.now();

    const animate = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      plate.scale.y = 1 - t * 0.8;
      plate.material.emissiveIntensity = 0.5 + Math.sin(t * Math.PI * 4) * 2;
      plate.material.opacity = 1 - t * 0.7;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        plate.visible = false;
        plate.userData.active = false;
      }
    };
    animate();

    // Spawn particles
    this.spawnParticles(plate.position.x, plate.position.z);
  }

  spawnParticles(x, z) {
    let count = 0;
    for (const p of this.particles) {
      if (p.visible || count >= 6) continue;
      p.visible = true;
      p.position.set(x + (Math.random() - 0.5) * 0.5, 0.2, z + (Math.random() - 0.5) * 0.5);
      p.userData.velocity.set(
        (Math.random() - 0.5) * 2,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 2
      );
      p.userData.life = 1.0;
      p.material.opacity = 1;
      p.material.transparent = true;
      count++;
    }
  }

  update(delta, speed) {
    const move = speed * delta;
    this.timeSinceSpawn += delta;

    // Spawn new plates
    if (this.timeSinceSpawn >= this.spawnInterval) {
      this.timeSinceSpawn = 0;
      // Spawn 1-2 plates ahead
      const spawnZ = -(ROAD_SEGMENT_LENGTH * 0.8 + Math.random() * 40);
      this.spawnPlate(spawnZ);
      if (Math.random() > 0.5) {
        this.spawnPlate(spawnZ - 8 - Math.random() * 10);
      }
    }

    // Move plates
    for (const plate of this.plates) {
      if (!plate.userData.active) continue;
      plate.position.z += move;

      // Animate: pulse glow + hover bob + slow spin
      if (!plate.userData.hit) {
        const t = performance.now() * 0.001;
        plate.material.emissiveIntensity = 0.5 + Math.sin(t * 5) * 0.3;
        plate.position.y = 0.05 + Math.sin(t * 3 + plate.position.x) * 0.08;
        plate.rotation.y += delta * 1.5;
      }

      // Deactivate plates that passed behind — track misses
      if (plate.position.z > 10) {
        if (!plate.userData.hit) {
          plate.userData.missed = true;
        }
        plate.visible = false;
        plate.userData.active = false;
      }
    }

    // Update particles
    for (const p of this.particles) {
      if (!p.visible) continue;
      p.userData.life -= delta * 2;
      if (p.userData.life <= 0) {
        p.visible = false;
        continue;
      }
      p.position.x += p.userData.velocity.x * delta;
      p.position.y += p.userData.velocity.y * delta;
      p.position.z += p.userData.velocity.z * delta + move;
      p.userData.velocity.y -= 5 * delta; // gravity
      p.material.opacity = p.userData.life;
      p.scale.setScalar(p.userData.life);
    }
  }

  checkMisses() {
    let missed = false;
    for (const plate of this.plates) {
      if (plate.userData.missed) {
        plate.userData.missed = false;
        missed = true;
      }
    }
    return missed;
  }

  setSpawnRate(interval) {
    this.spawnInterval = interval;
  }

  resetSpawnRate() {
    this.spawnInterval = PLATE_SPAWN_INTERVAL;
  }
}
