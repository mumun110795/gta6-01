import * as THREE from 'three';
import { GAMEPLAY, WORLD } from './config.js';

const ENEMY_COLORS = {
  enemy: { shirt: 0x63372d, pants: 0x2b2f36, skin: 0xc99168 },
  police: { shirt: 0x2d62d9, pants: 0x1f2733, skin: 0xc99168 },
};

function makeBox(width, height, depth, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.05 }),
  );
}

function makeFigure(role = 'enemy') {
  const colors = ENEMY_COLORS[role] ?? ENEMY_COLORS.enemy;
  const root = new THREE.Group();
  const parts = {
    hips: makeBox(0.4, 0.18, 0.24, colors.pants),
    torso: makeBox(0.51, 0.6, 0.27, colors.shirt),
    head: makeBox(0.24, 0.26, 0.24, colors.skin),
    'left-arm': makeBox(0.12, 0.55, 0.14, colors.shirt),
    'right-arm': makeBox(0.12, 0.55, 0.14, colors.shirt),
    'left-leg': makeBox(0.16, 0.72, 0.18, colors.pants),
    'right-leg': makeBox(0.16, 0.72, 0.18, colors.pants),
  };
  parts.hips.position.y = 0.88;
  parts.torso.position.y = 1.27;
  parts.head.position.y = 1.7;
  parts['left-arm'].position.set(-0.33, 1.24, 0);
  parts['right-arm'].position.set(0.33, 1.24, 0);
  parts['left-leg'].position.set(-0.12, 0.44, 0);
  parts['right-leg'].position.set(0.12, 0.44, 0);
  for (const part of Object.values(parts)) {
    part.castShadow = true;
    root.add(part);
  }
  root.userData = { parts, walkPhase: 0 };
  return root;
}

function animateEnemy(enemy, dt) {
  const parts = enemy.mesh.userData.parts;
  if (enemy.dead) {
    enemy.mesh.rotation.x = THREE.MathUtils.lerp(enemy.mesh.rotation.x, Math.PI * 0.48, Math.min(1, dt * 7));
    enemy.mesh.position.y = THREE.MathUtils.lerp(enemy.mesh.position.y, WORLD.roadY + 0.12, Math.min(1, dt * 7));
    return;
  }
  enemy.mesh.userData.walkPhase = (enemy.mesh.userData.walkPhase + enemy.speed * dt * 2.1) % (Math.PI * 2);
  const swing = Math.sin(enemy.mesh.userData.walkPhase) * Math.min(0.62, enemy.speed * 0.16);
  parts['left-leg'].rotation.x = swing;
  parts['right-leg'].rotation.x = -swing;
  parts['left-arm'].rotation.x = -swing * 0.7;
  parts['right-arm'].rotation.x = swing * 0.7;
  enemy.mesh.rotation.x = THREE.MathUtils.lerp(enemy.mesh.rotation.x, 0, Math.min(1, dt * 8));
}

export class Enemy {
  constructor(position = { x: 0, z: 0 }, options = {}) {
    this.role = options.role ?? 'enemy';
    this.mesh = makeFigure(this.role);
    this.position = new THREE.Vector3(position.x, WORLD.roadY, position.z);
    this.mesh.position.copy(this.position);
    this.heading = options.heading ?? 0;
    this.health = options.health ?? (this.role === 'police' ? 75 : 60);
    this.maxHealth = this.health;
    this.state = options.state ?? 'idle';
    this.accuracy = options.accuracy ?? 0.58;
    this.fireInterval = options.fireInterval ?? 0.95;
    this.range = options.range ?? 78;
    this.damage = options.damage ?? 9;
    this.speed = 0;
    this.strafeDirection = Math.random() < 0.5 ? 1 : -1;
    this.fireTimer = 0.5 + Math.random() * 0.7;
    this.dead = false;
    this.deadTimer = 0;
    this.parentUnit = options.parentUnit ?? null;
  }
}

export function spawnEnemy(position, options = {}) {
  return new Enemy(position, options);
}

function makeTracer(start, end, color = 0xffd37a) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length() || 0.1;
  const geometry = new THREE.CylinderGeometry(0.018, 0.018, length, 5, 1, true);
  geometry.rotateX(Math.PI * 0.5);
  geometry.translate(0, 0, length * 0.5);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start);
  mesh.lookAt(end);
  return { mesh, life: 0.18, maxLife: 0.18 };
}

function makePuff(position) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 7, 5),
    new THREE.MeshBasicMaterial({ color: 0xd8d2c8, transparent: true, opacity: 0.8 }),
  );
  mesh.position.copy(position);
  mesh.scale.set(1, 0.8, 1);
  return { mesh, life: 0.3, maxLife: 0.3, velocity: new THREE.Vector3(0, 1.2, 0) };
}

export function createCombat(world = {}) {
  return {
    scene: world.scene,
    colliders: world.colliders ?? [],
    playerHealth: GAMEPLAY.player.maxHealth,
    damageDelay: 0,
    firing: false,
    fireCooldown: 0,
    crosshair: null,
    effects: [],
    enemies: [],
    onWasted: [],
    onShotFired: [],
    onEnemyDown: [],
  };
}

function addEffect(combat, effect) {
  combat.scene?.add(effect.mesh);
  combat.effects.push(effect);
}

function segmentHitsBox(start, end, box) {
  const direction = new THREE.Vector3().subVectors(end, start);
  let near = 0;
  let far = 1;
  for (const axis of ['x', 'z']) {
    const origin = axis === 'x' ? start.x : start.z;
    const denominator = axis === 'x' ? direction.x : direction.z;
    if (Math.abs(denominator) < 1e-8) {
      if (origin < (axis === 'x' ? box.minX : box.minZ) || origin > (axis === 'x' ? box.maxX : box.maxZ)) return false;
      continue;
    }
    const low = ((axis === 'x' ? box.minX : box.minZ) - origin) / denominator;
    const high = ((axis === 'x' ? box.maxX : box.maxZ) - origin) / denominator;
    near = Math.max(near, Math.min(low, high));
    far = Math.min(far, Math.max(low, high));
    if (near > far) return false;
  }
  return true;
}

function blockedDistance(start, end, colliders) {
  let closest = Infinity;
  for (const box of colliders) {
    if (!segmentHitsBox(start, end, box)) continue;
    const center = new THREE.Vector3((box.minX + box.maxX) / 2, start.y, (box.minZ + box.maxZ) / 2);
    closest = Math.min(closest, start.distanceTo(center));
  }
  return closest;
}

function enemyHitDistance(start, direction, enemy, maxDistance) {
  const center = enemy.position.clone().setY(enemy.position.y + 1.05);
  const toEnemy = new THREE.Vector3().subVectors(center, start);
  const along = toEnemy.dot(direction);
  if (along < 0 || along > maxDistance) return Infinity;
  const perpendicular = toEnemy.sub(direction.clone().multiplyScalar(along)).length();
  return perpendicular <= 0.55 ? along : Infinity;
}

function damagePlayer(combat, amount, dt = 0) {
  combat.playerHealth = Math.max(0, combat.playerHealth - amount);
  combat.damageDelay = 6;
  if (combat.playerHealth === 0) {
    for (const callback of combat.onWasted) callback(combat, dt);
    combat.playerHealth = 0;
  }
}

export function damageEnemy(combat, enemy, amount, context = {}) {
  if (!enemy || enemy.dead) return;
  enemy.health -= amount;
  enemy.state = enemy.health < enemy.maxHealth * 0.45 ? 'shoot' : 'strafe';
  if (enemy.health <= 0) {
    enemy.dead = true;
    enemy.state = 'dead';
    for (const callback of combat.onEnemyDown) callback(enemy, context);
  }
}

export function combatCrashDamage(combat, impactSpeed, dt = 0) {
  if (impactSpeed >= 11) damagePlayer(combat, (impactSpeed - 10) * 3.4, dt);
}

export function firePlayerWeapon(combat, context = {}) {
  const player = context.player;
  const camera = context.camera;
  if (!combat || !player || !camera || player.mode !== 'foot' || combat.fireCooldown > 0 || combat.playerHealth <= 0) return false;
  combat.fireCooldown = GAMEPLAY.combat.fireInterval;
  const start = player.position.clone().setY(player.position.y + 1.34);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const maximum = GAMEPLAY.combat.range;
  let hitDistance = Math.min(maximum, blockedDistance(start, start.clone().addScaledVector(direction, maximum), combat.colliders));
  let target = null;
  for (const enemy of context.enemies ?? combat.enemies) {
    if (enemy.dead || enemy.role === 'police') continue;
    const distance = enemyHitDistance(start, direction, enemy, hitDistance);
    if (distance < hitDistance) {
      hitDistance = distance;
      target = enemy;
    }
  }
  const end = start.clone().addScaledVector(direction, hitDistance);
  const flash = new THREE.PointLight(0xffca73, 6, 9, 2);
  flash.position.copy(start).addScaledVector(direction, 0.45);
  addEffect(combat, { mesh: flash, life: 0.07, maxLife: 0.07, light: true });
  addEffect(combat, makeTracer(start, end));
  addEffect(combat, makePuff(end));
  if (target) {
    const falloff = THREE.MathUtils.clamp(1 - hitDistance / maximum * 0.65, 0.35, 1);
    damageEnemy(combat, target, GAMEPLAY.combat.pistolDamage * falloff, context);
  }
  context.pedestrians?.fleeFrom?.(player.position);
  for (const callback of combat.onShotFired) callback(player.position, context);
  return true;
}

function enemyCanSee(enemy, target, combat) {
  const distance = enemy.position.distanceTo(target);
  if (distance > enemy.range) return false;
  return blockedDistance(enemy.position.clone().setY(enemy.position.y + 1.2), target.clone().setY(target.y + 1.1), combat.colliders) > distance;
}

function enemyShoot(combat, enemy, player, context) {
  enemy.fireTimer = enemy.fireInterval * (0.8 + Math.random() * 0.55);
  const start = enemy.position.clone().setY(enemy.position.y + 1.25);
  const playerCenter = player.position.clone().setY(player.position.y + 1.05);
  const spread = 1 - enemy.accuracy;
  playerCenter.x += (Math.random() - 0.5) * distanceBetween(enemy.position, player.position) * spread * 0.1;
  playerCenter.z += (Math.random() - 0.5) * distanceBetween(enemy.position, player.position) * spread * 0.1;
  const end = playerCenter.clone();
  if (Math.random() < enemy.accuracy) {
    damagePlayer(combat, enemy.damage * (1 - Math.min(0.45, start.distanceTo(end) / enemy.range * 0.45)));
  } else {
    end.add(new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 1.2, (Math.random() - 0.5) * 2.5));
  }
  addEffect(combat, makeTracer(start, end, enemy.role === 'police' ? 0x9fc7ff : 0xff7a5a));
  for (const callback of combat.onShotFired) callback(enemy.position, context);
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function moveEnemy(enemy, player, dt) {
  const delta = enemy.position.clone().sub(player.position);
  delta.y = 0;
  const distance = delta.length() || 1;
  delta.divideScalar(distance);
  const side = new THREE.Vector3(-delta.z, 0, delta.x).multiplyScalar(enemy.strafeDirection);
  const desired = side.multiplyScalar(0.7).addScaledVector(delta, distance > 18 ? -0.75 : 0.1);
  if (desired.lengthSq() < 0.01) return;
  desired.normalize();
  enemy.position.addScaledVector(desired, 3.1 * dt);
  enemy.heading = Math.atan2(desired.x, desired.z);
  enemy.speed = 3.1;
  enemy.strafeTimer = (enemy.strafeTimer ?? 1.6) - dt;
  if (enemy.strafeTimer <= 0) {
    enemy.strafeDirection *= -1;
    enemy.strafeTimer = 1.1 + Math.random() * 1.4;
  }
}

export function updateCombat(combat, dt, context = {}) {
  if (!combat || dt <= 0) return;
  const player = context.player;
  const playerPosition = player?.mode === 'car' ? player.car?.position : player?.position;
  combat.fireCooldown = Math.max(0, combat.fireCooldown - dt);
  combat.damageDelay = Math.max(0, combat.damageDelay - dt);
  if (combat.damageDelay === 0 && combat.playerHealth > 0) {
    combat.playerHealth = Math.min(GAMEPLAY.player.maxHealth, combat.playerHealth + 4.5 * dt);
  }

  const enemies = context.enemies ?? combat.enemies;
  for (const enemy of enemies) {
    if (enemy.dead) {
      enemy.deadTimer += dt;
      animateEnemy(enemy, dt);
      continue;
    }
    enemy.fireTimer -= dt;
    if (!playerPosition || !enemyCanSee(enemy, playerPosition, combat)) {
      enemy.state = 'idle';
      enemy.speed = THREE.MathUtils.damp(enemy.speed ?? 0, 0, 8, dt);
      animateEnemy(enemy, dt);
      continue;
    }
    enemy.state = enemy.fireTimer <= 0 ? 'shoot' : 'strafe';
    enemy.heading = Math.atan2(playerPosition.x - enemy.position.x, playerPosition.z - enemy.position.z);
    moveEnemy(enemy, { position: playerPosition }, dt);
    enemy.mesh.position.copy(enemy.position);
    enemy.mesh.rotation.y = enemy.heading;
    if (enemy.fireTimer <= 0 && (enemy.role !== 'police' || (context.wanted?.stars ?? 0) >= 3)) {
      enemyShoot(combat, enemy, { position: playerPosition }, context);
    }
    animateEnemy(enemy, dt);
  }

  if (combat.scene) {
    for (let index = combat.effects.length - 1; index >= 0; index -= 1) {
      const effect = combat.effects[index];
      effect.life -= dt;
      const alpha = Math.max(0, effect.life / effect.maxLife);
      if (effect.mesh.material) effect.mesh.material.opacity = alpha * 0.9;
      if (effect.velocity) {
        effect.mesh.position.addScaledVector(effect.velocity, dt);
        effect.mesh.scale.multiplyScalar(1 + dt * 1.5);
      }
      if (effect.light) effect.mesh.intensity = 7 * alpha;
      if (effect.life <= 0) {
        combat.scene.remove(effect.mesh);
        effect.mesh.geometry?.dispose?.();
        effect.mesh.material?.dispose?.();
        combat.effects.splice(index, 1);
      }
    }
  }
}
