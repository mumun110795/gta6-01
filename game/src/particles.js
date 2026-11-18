import * as THREE from 'three';

const CAPACITY = 360;
const GRAVITY = 16;
const SMOKE_COLOR = 0x8d9196;

function makeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.72)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createParticles(scene) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(CAPACITY * 3);
  const sizes = new Float32Array(CAPACITY);
  const alphas = new Float32Array(CAPACITY);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, CAPACITY);

  const material = new THREE.PointsMaterial({
    map: makeTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexColors: true,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const colors = new Float32Array(CAPACITY * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const particles = Array.from({ length: CAPACITY }, () => ({
    active: false, age: 0, life: 1, size: 1,
    velocity: new THREE.Vector3(), drag: 0,
  }));
  let cursor = 0;
  let smokeTimer = 0;

  function spawn(position, options = {}) {
    const particle = particles[cursor];
    cursor = (cursor + 1) % CAPACITY;
    const index = particles.indexOf(particle);
    particle.active = true;
    particle.age = 0;
    particle.life = options.life ?? 0.7;
    particle.size = options.size ?? 0.35;
    particle.drag = options.drag ?? 2;
    particle.velocity.set(
      (Math.random() - 0.5) * (options.spread ?? 5),
      Math.random() * (options.up ?? 3.4),
      (Math.random() - 0.5) * (options.spread ?? 5),
    );
    positions[index * 3] = position.x;
    positions[index * 3 + 1] = position.y;
    positions[index * 3 + 2] = position.z;
    const color = new THREE.Color(options.color ?? 0xffd08a);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  function burst(position, options = {}) {
    const count = Math.min(options.count ?? 10, 22);
    for (let index = 0; index < count; index += 1) spawn(position, options);
  }

  function update(deltaTime) {
    const sizeAttribute = geometry.getAttribute('size');
    const alphaAttribute = geometry.getAttribute('alpha');
    const colorAttribute = geometry.getAttribute('color');
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (!particle.active) {
        alphaAttribute.setX(index, 0);
        continue;
      }
      particle.age += deltaTime;
      if (particle.age >= particle.life) {
        particle.active = false;
        alphaAttribute.setX(index, 0);
        continue;
      }
      const ratio = particle.age / particle.life;
      particle.velocity.y -= GRAVITY * deltaTime;
      particle.velocity.multiplyScalar(Math.max(0, 1 - particle.drag * deltaTime));
      positions[index * 3] += particle.velocity.x * deltaTime;
      positions[index * 3 + 1] += particle.velocity.y * deltaTime;
      positions[index * 3 + 2] += particle.velocity.z * deltaTime;
      sizeAttribute.setX(index, particle.size * (0.7 + ratio * 1.5));
      alphaAttribute.setX(index, 1 - ratio);
    }
    geometry.attributes.position.needsUpdate = true;
    sizeAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  }

  function smoke(position, deltaTime) {
    smokeTimer += deltaTime;
    const interval = 0.09;
    while (smokeTimer >= interval) {
      smokeTimer -= interval;
      spawn(position, {
        color: SMOKE_COLOR,
        count: 1,
        life: 0.9,
        size: 0.8,
        up: 1,
        spread: 1,
        drag: 1.2,
      });
    }
  }

  return { burst, smoke, update };
}
