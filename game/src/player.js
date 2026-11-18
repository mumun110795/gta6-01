import * as THREE from 'three';
import { WORLD } from './config.js';

const PLAYER_RADIUS = 0.36;
const FIGURE_HEIGHT = 1.78;

function makeBox(width, height, depth, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04 }),
  );
}

function placePart(part, x, y, z) {
  part.position.set(x, y, z);
  part.castShadow = true;
  part.receiveShadow = true;
  return part;
}

export function makeFigure(shirtColor = 0xd8543f, pantsColor = 0x2b3541, skinColor = 0xc99168) {
  const figure = new THREE.Group();
  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = 0.88;
  figure.add(hips);

  const torso = placePart(makeBox(0.49, 0.62, 0.29, shirtColor), 0, 0.31, 0);
  torso.name = 'torso';
  const head = placePart(makeBox(0.24, 0.26, 0.25, skinColor), 0, 0.76, 0);
  head.name = 'head';
  const neck = placePart(makeBox(0.12, 0.08, 0.12, skinColor), 0, 0.62, 0);
  neck.name = 'neck';
  hips.add(torso, head, neck);

  const limbData = [
    { name: 'left-leg', color: pantsColor, x: -0.14, y: -0.02, length: 0.82 },
    { name: 'right-leg', color: pantsColor, x: 0.14, y: -0.02, length: 0.82 },
    { name: 'left-arm', color: shirtColor, x: -0.33, y: 0.52, length: 0.62 },
    { name: 'right-arm', color: shirtColor, x: 0.33, y: 0.52, length: 0.62 },
  ];

  const parts = { hips, torso, head };
  for (const item of limbData) {
    const pivot = new THREE.Group();
    pivot.name = item.name;
    pivot.position.set(item.x, item.y, 0);
    const limb = makeBox(item.name.endsWith('arm') ? 0.14 : 0.18, item.length, item.name.endsWith('arm') ? 0.14 : 0.21, item.color);
    limb.position.y = -item.length / 2;
    limb.castShadow = true;
    limb.receiveShadow = true;
    pivot.add(limb);
    if (item.name.endsWith('arm')) hips.add(pivot);
    else figure.add(pivot);
    parts[item.name] = pivot;
  }

  figure.userData = {
    height: FIGURE_HEIGHT,
    walkPhase: 0,
    parts,
    groundY: 0,
  };
  return figure;
}

function pointHitsCollider(x, z, colliders) {
  return colliders.some((collider) => (
    x >= collider.minX - PLAYER_RADIUS &&
    x <= collider.maxX + PLAYER_RADIUS &&
    z >= collider.minZ - PLAYER_RADIUS &&
    z <= collider.maxZ + PLAYER_RADIUS
  ));
}

function moveWithoutPenetrating(player, deltaX, deltaZ, colliders) {
  const originalX = player.position.x;
  const originalZ = player.position.z;
  player.position.x += deltaX;
  if (pointHitsCollider(player.position.x, originalZ, colliders)) player.position.x = originalX;
  player.position.z += deltaZ;
  if (pointHitsCollider(player.position.x, player.position.z, colliders)) player.position.z = originalZ;
  const limit = WORLD.halfIsland - 1.2;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -limit, limit);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -limit, limit);
}

function animateFigure(figure, travelDistance) {
  const data = figure.userData;
  data.walkPhase = (data.walkPhase + travelDistance * 2.15) % (Math.PI * 2);
  const swing = Math.sin(data.walkPhase) * Math.min(0.72, 0.18 + travelDistance * 3.5);
  const { parts } = data;
  parts['left-leg'].rotation.x = swing;
  parts['right-leg'].rotation.x = -swing;
  parts['left-arm'].rotation.x = -swing * 0.82;
  parts['right-arm'].rotation.x = swing * 0.82;
  parts.hips.position.y = 0.88 + Math.abs(Math.sin(data.walkPhase)) * 0.028;
}

export function createPlayer(scene, spawn = { x: 0, z: 0, heading: 0 }) {
  const mesh = makeFigure(0xd8543f, 0x2b3541, 0xc99168);
  mesh.position.set(spawn.x, WORLD.roadY, spawn.z);
  scene.add(mesh);
  return {
    mesh,
    position: new THREE.Vector3(spawn.x, WORLD.roadY, spawn.z),
    heading: spawn.heading ?? 0,
    speed: 0,
    health: 100,
    mode: 'foot',
    car: null,
    cameraYaw: spawn.heading ?? 0,
    cameraPitch: 0.25,
  };
}

export function updatePlayerOnFoot(player, input = {}, dt = 0, colliders = []) {
  if (!player || player.mode !== 'foot' || dt <= 0) return;
  const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const inputLength = Math.hypot(forward, strafe);
  const targetSpeed = input.run ? 8 : 4.5;
  const speedTarget = inputLength > 0 ? targetSpeed / Math.max(1, inputLength) : 0;
  player.speed = THREE.MathUtils.damp(player.speed, Math.min(targetSpeed, speedTarget), 10, dt);

  if (inputLength > 0.001) {
    const yaw = player.cameraYaw;
    const directionX = Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
    const directionZ = Math.cos(yaw) * forward - Math.sin(yaw) * strafe;
    const directionLength = Math.hypot(directionX, directionZ) || 1;
    const heading = Math.atan2(directionX / directionLength, directionZ / directionLength);
    let difference = heading - player.heading;
    difference = THREE.MathUtils.euclideanModulo(difference + Math.PI, Math.PI * 2) - Math.PI;
    const maxTurn = 12 * dt;
    player.heading += THREE.MathUtils.clamp(difference, -maxTurn, maxTurn);
    moveWithoutPenetrating(player, (directionX / directionLength) * player.speed * dt, (directionZ / directionLength) * player.speed * dt, colliders);
  } else {
    player.speed = THREE.MathUtils.damp(player.speed, 0, 12, dt);
  }

  player.position.y = WORLD.roadY;
  player.mesh.position.copy(player.position);
  player.mesh.rotation.y = player.heading;
  animateFigure(player.mesh, player.speed * dt);
}

export function tryEnterCar(player, cars = []) {
  if (!player || player.mode !== 'foot') return null;
  let nearest = null;
  let nearestDistance = 3.2;
  for (const car of cars) {
    const distance = Math.hypot(car.position.x - player.position.x, car.position.z - player.position.z);
    if (distance < nearestDistance) {
      nearest = car;
      nearestDistance = distance;
    }
  }
  if (!nearest) return null;
  player.mode = 'car';
  player.car = nearest;
  player.speed = 0;
  nearest.driver = 'player';
  nearest.parked = false;
  player.mesh.visible = false;
  return nearest;
}

export function exitCar(player) {
  if (!player || player.mode !== 'car' || !player.car) return null;
  const car = player.car;
  const sideX = Math.cos(car.heading);
  const sideZ = -Math.sin(car.heading);
  const exitX = car.position.x + sideX * (car.halfWidth + 0.72);
  const exitZ = car.position.z + sideZ * (car.halfWidth + 0.72);
  player.position.set(exitX, WORLD.roadY, exitZ);
  player.heading = car.heading;
  player.cameraYaw = car.heading;
  player.speed = 0;
  player.car = null;
  player.mode = 'foot';
  car.driver = null;
  player.mesh.visible = true;
  player.mesh.position.copy(player.position);
  player.mesh.rotation.y = player.heading;
  return car;
}
