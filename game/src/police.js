import * as THREE from 'three';
import { createCar, updateCar } from './cars.js';
import { Enemy, spawnEnemy } from './combat.js';
import { WORLD } from './config.js';

const UNIT_TARGETS = [0, 1, 2, 3, 4, 6];
const DESPAWN_DISTANCE = 270;
const PATROL_DISTANCE = 55;

function normalizeAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
}

function pointOnRoad(road, amount) {
  return {
    x: THREE.MathUtils.lerp(road.x1, road.x2, amount),
    z: THREE.MathUtils.lerp(road.z1, road.z2, amount),
    heading: Math.atan2(road.x2 - road.x1, road.z2 - road.z1),
  };
}

function randomRoadPoint(world, focus, minimum = 90, maximum = 140) {
  const roads = world.roads ?? [];
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const road = roads[Math.floor(Math.random() * roads.length)];
    const point = pointOnRoad(road, Math.random());
    const distance = Math.hypot(point.x - focus.x, point.z - focus.z);
    if (distance < minimum || distance > maximum) continue;
    return { ...point, heading: Math.random() < 0.5 ? point.heading : point.heading + Math.PI };
  }
  const road = roads[Math.floor(Math.random() * roads.length)];
  return pointOnRoad(road, Math.random());
}

function segmentBlocked(start, target, colliders) {
  const deltaX = target.x - start.x;
  const deltaZ = target.z - start.z;
  for (const box of colliders) {
    let near = 0;
    let far = 1;
    let valid = true;
    for (const [origin, direction, minimum, maximum] of [
      [start.x, deltaX, box.minX, box.maxX],
      [start.z, deltaZ, box.minZ, box.maxZ],
    ]) {
      if (Math.abs(direction) < 1e-8) {
        if (origin < minimum || origin > maximum) valid = false;
        continue;
      }
      const first = (minimum - origin) / direction;
      const second = (maximum - origin) / direction;
      near = Math.max(near, Math.min(first, second));
      far = Math.min(far, Math.max(first, second));
      if (near > far) valid = false;
    }
    if (valid) return true;
  }
  return false;
}

function createUnit(police, position, heading = 0) {
  const car = createCar('police', 0xf5f6f8, position, heading);
  car.driver = 'police';
  car.policeUnit = true;
  police.scene.add(car.mesh);
  police.world.cars.push(car);
  const unit = {
    id: ++police.nextId,
    car,
    position: car.position,
    officers: [],
    deployed: false,
    state: 'pursuit',
    boxTimer: 0,
    stopTimer: 0,
  };
  police.units.push(unit);
  return unit;
}

export function createPolice(world) {
  return {
    world,
    scene: world?.scene,
    colliders: world?.colliders ?? [],
    cars: world?.cars ?? [],
    units: [],
    roadblocks: [],
    nextId: 0,
    bustTimer: 0,
    busted: false,
    wasted: false,
    onBusted: [],
    onWasted: [],
  };
}

export function spawnPoliceUnits(police, focus, count = 1, options = {}) {
  const units = [];
  const distance = options.distance ?? 45;
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 4.5;
    const position = {
      x: focus.x - Math.sin(focus.heading) * distance + Math.cos(focus.heading) * offset,
      z: focus.z - Math.cos(focus.heading) * distance - Math.sin(focus.heading) * offset,
      heading: focus.heading,
    };
    units.push(createUnit(police, position, focus.heading));
  }
  return units;
}

function spawnOfficers(police, unit, count = 1) {
  while (unit.officers.length < count) {
    const side = unit.officers.length % 2 === 0 ? -1 : 1;
    const officer = spawnEnemy({
      x: unit.car.position.x + Math.cos(unit.car.heading) * (unit.car.halfWidth + 0.65) * side,
      z: unit.car.position.z - Math.sin(unit.car.heading) * (unit.car.halfWidth + 0.65) * side,
    }, { role: 'police', accuracy: 0.52, health: 80, damage: 7, range: 72, parentUnit: unit });
    police.scene.add(officer.mesh);
    police.world.combat?.enemies.push(officer);
    unit.officers.push(officer);
  }
}

function removeUnit(police, index) {
  const unit = police.units[index];
  for (const officer of unit.officers) {
    officer.parentUnit = null;
    officer.state = 'idle';
    officer.retired = true;
  }
  police.scene.remove(unit.car.mesh);
  const carIndex = police.cars.indexOf(unit.car);
  if (carIndex >= 0) police.cars.splice(carIndex, 1);
  police.units.splice(index, 1);
}

function steerTowardTarget(police, unit, target, player, dt, wanted) {
  const car = unit.car;
  const targetX = target.x;
  const targetZ = target.z;
  const targetHeading = Math.atan2(targetX - car.position.x, targetZ - car.position.z);
  const headingError = normalizeAngle(targetHeading - car.heading);
  const distance = Math.hypot(targetX - car.position.x, targetZ - car.position.z);
  let steer = THREE.MathUtils.clamp(headingError * 2.5, -1, 1);
  let throttle = THREE.MathUtils.clamp(1.05 - distance / 75, 0.16, 0.92);
  let brake = false;
  if (unit.state === 'search') throttle = distance > 16 ? 0.4 : 0.1;
  if (distance < 12) throttle = Math.max(0.08, throttle * 0.5);
  if (unit.boxTimer > 0) unit.boxTimer -= dt;
  if (wanted.stars >= 4 && distance < 34 && unit.boxTimer <= 0 && Math.abs(headingError) < 0.5) {
    throttle = 0.85;
    unit.boxTimer = 2 + Math.random() * 1.6;
    unit.boxOffset = (unit.id % 3 - 1) * 2.6;
  }
  if (unit.boxOffset) steer = THREE.MathUtils.clamp(steer + unit.boxOffset * 0.05, -1, 1);
  const playerSpeed = Math.abs(player.mode === 'car' ? player.car.speed : player.speed);
  if (distance < 8 && playerSpeed < 1.5) {
    throttle = -0.1;
    brake = true;
  }
  updateCar(car, { throttle, steer, brake }, dt, police.colliders);
}

function spawnRoadblock(police, focus, heading) {
  const across = heading + Math.PI * 0.5;
  const cars = [-1, 1].map((side) => {
    const offset = side * 2.4;
    const car = createCar('police', 0xf5f6f8, {
      x: focus.x + Math.sin(across) * offset,
      z: focus.z + Math.cos(across) * offset,
    }, across + Math.PI * 0.16);
    car.parked = true;
    car.driver = 'police-roadblock';
    car.policeUnit = true;
    police.scene.add(car.mesh);
    police.cars.push(car);
    return car;
  });
  const officers = [];
  for (let index = 0; index < 2; index += 1) {
    const officer = spawnEnemy({
      x: focus.x + Math.sin(across) * (index === 0 ? -5 : 5),
      z: focus.z + Math.cos(across) * (index === 0 ? -5 : 5),
    }, { role: 'police', accuracy: 0.55, damage: 8, range: 78 });
    police.scene.add(officer.mesh);
    police.world.combat?.enemies.push(officer);
    officers.push(officer);
  }
  police.roadblocks.push({ cars, officers, position: new THREE.Vector3(focus.x, WORLD.roadY, focus.z), created: 0 });
}

function updateRoadblocks(police, dt, focus, wanted) {
  const stars = wanted?.stars ?? 0;
  for (let index = police.roadblocks.length - 1; index >= 0; index -= 1) {
    const block = police.roadblocks[index];
    block.created += dt;
    const distance = Math.hypot(block.position.x - focus.x, block.position.z - focus.z);
    if (stars < 4 || distance > DESPAWN_DISTANCE || block.created > 90) {
      for (const car of block.cars) {
        const carIndex = police.cars.indexOf(car);
        if (carIndex >= 0) police.cars.splice(carIndex, 1);
        police.scene.remove(car.mesh);
      }
      for (const officer of block.officers) officer.retired = true;
      police.roadblocks.splice(index, 1);
    }
  }
  const desiredRoadblocks = stars >= 5 ? 2 : stars === 4 ? 1 : 0;
  if (police.roadblocks.length < desiredRoadblocks) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const road = police.world.roads[Math.floor(Math.random() * police.world.roads.length)];
      const point = pointOnRoad(road, 0.2 + Math.random() * 0.6);
      const distance = Math.hypot(point.x - focus.x, point.z - focus.z);
      const ahead = playerAheadHeading(police.world.player);
      if (distance < 65 || distance > 155) continue;
      if (segmentBlocked(point, focus, police.colliders)) continue;
      spawnRoadblock(police, point, ahead ? ahead + Math.PI : point.heading);
      break;
    }
  }
}

function playerAheadHeading(player) {
  if (player?.mode === 'car') return player.car.heading;
  if (player?.mode === 'foot') return player.heading;
  return null;
}

function cleanRetiredEnemies(police) {
  const enemies = police.world.combat?.enemies;
  if (!enemies) return;
  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index];
    if (!enemy.retired || !enemy.dead) continue;
    police.scene.remove(enemy.mesh);
    enemies.splice(index, 1);
  }
}

export function updatePolice(police, dt, context = {}) {
  const player = context.player;
  if (!police || !player || dt <= 0) return;
  const wanted = context.wanted;
  const focus = player.mode === 'car' ? player.car.position : player.position;
  const targetUnitCount = UNIT_TARGETS[Math.max(0, Math.min(5, wanted?.stars ?? 0))];
  while (police.units.length < targetUnitCount) {
    const point = randomRoadPoint(police.world, focus, 90, 140);
    if (!segmentBlocked(point, focus, police.colliders)) createUnit(police, point, point.heading);
  }
  while (police.units.length > targetUnitCount) removeUnit(police, police.units.length - 1);
  updateRoadblocks(police, dt, focus, wanted);

  let nearestPolice = Infinity;
  for (let index = police.units.length - 1; index >= 0; index -= 1) {
    const unit = police.units[index];
    const carDistance = Math.hypot(unit.car.position.x - focus.x, unit.car.position.z - focus.z);
    nearestPolice = Math.min(nearestPolice, carDistance);
    if (carDistance > DESPAWN_DISTANCE || unit.car.damage >= 90) {
      removeUnit(police, index);
      continue;
    }
    const chaseTarget = wanted?.seenByPolice ? focus : wanted?.lastSeen;
    unit.state = wanted?.seenByPolice ? 'pursuit' : wanted?.searching ? 'search' : 'patrol';
    let target = chaseTarget ?? unit.car.position;
    if (unit.state === 'search' && chaseTarget && Math.hypot(chaseTarget.x - unit.car.position.x, chaseTarget.z - unit.car.position.z) < 12) {
      if (!unit.patrolTarget || unit.car.position.distanceTo(unit.patrolTarget) < 7) {
        unit.patrolTarget = randomRoadPoint(police.world, chaseTarget, 6, PATROL_DISTANCE);
      }
      target = unit.patrolTarget;
    }

    const shouldStop = carDistance < (wanted?.stars >= 3 ? 20 : 12)
      || Math.abs(unit.car.speed) < 0.7
      || player.mode === 'foot' && carDistance < 28;
    unit.deployed = shouldStop;
    if (unit.deployed) {
      updateCar(unit.car, { throttle: 0, steer: 0, brake: true }, dt, police.colliders);
      spawnOfficers(police, unit, Math.max(1, Math.min(2, Math.floor((wanted?.stars ?? 1) / 2) + 1)));
      for (const officer of unit.officers) {
        nearestPolice = Math.min(nearestPolice, officer.position.distanceTo(focus));
        if (officer.dead) continue;
        const carOffset = new THREE.Vector3(Math.sin(unit.car.heading + Math.PI * 0.5), 0, Math.cos(unit.car.heading + Math.PI * 0.5));
        const targetPosition = unit.car.position.clone().addScaledVector(carOffset, officer === unit.officers[0] ? -1.3 : 1.3);
        officer.position.lerp(targetPosition, 1 - Math.exp(-5 * dt));
        officer.mesh.position.copy(officer.position);
        officer.heading = Math.atan2(focus.x - officer.position.x, focus.z - officer.position.z);
        officer.mesh.rotation.y = officer.heading;
      }
    } else {
      for (const officer of unit.officers) {
        const returnPosition = unit.car.position.clone();
        officer.position.lerp(returnPosition, 1 - Math.exp(-9 * dt));
        officer.mesh.position.copy(officer.position);
        if (officer.position.distanceTo(unit.car.position) < 1.1) officer.mesh.visible = false;
      }
      steerTowardTarget(police, unit, target, player, dt, wanted);
    }
  }

  const speed = Math.abs(player.mode === 'car' ? player.car.speed : player.speed);
  const withinBust = nearestPolice <= 4.2 && speed < 0.75;
  police.bustTimer = withinBust ? Math.min(2.5, police.bustTimer + dt) : Math.max(0, police.bustTimer - dt * 1.5);
  if (police.bustTimer >= 2.5 && !police.busted && !police.wasted) {
    police.busted = true;
    for (const callback of police.onBusted) callback(police, context);
  }
  if (context.combat?.playerHealth <= 0 && !police.wasted) {
    police.wasted = true;
    for (const callback of police.onWasted) callback(police, context);
  }
  if (context.combat?.playerHealth > 0) police.wasted = false;
  cleanRetiredEnemies(police);
}
