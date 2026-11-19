import * as THREE from 'three';
import { createCar, updateCar } from './cars.js';
import { Enemy, spawnEnemy } from './combat.js';
import { WORLD } from './config.js';

const HELI_CIRCLE_RADIUS = 17;
const HELI_ALTITUDE = 30;
const HELI_DOWN = new THREE.Vector3(0, -1, 0);
const _heliFocus = new THREE.Vector3();
const _heliLocal = new THREE.Vector3();
const _heliBelly = new THREE.Vector3();
const _heliDir = new THREE.Vector3();
const _heliAimPoint = new THREE.Vector3();

let heliPoliceMaterialCache = null;
function heliPoliceMaterial() {
  if (heliPoliceMaterialCache) return heliPoliceMaterialCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 512, 128);
  context.font = '900 82px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#ffffff';
  context.fillText('POLICE', 256, 68);
  const texture = new THREE.CanvasTexture(canvas);
  heliPoliceMaterialCache = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  return heliPoliceMaterialCache;
}

export function buildHelicopter() {
  const group = new THREE.Group();
  group.name = 'police-helicopter';
  const whitePaint = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.34, metalness: 0.28 });
  const bluePaint = new THREE.MeshStandardMaterial({ color: 0x2d62d9, roughness: 0.4, metalness: 0.2 });
  const darkPaint = new THREE.MeshStandardMaterial({ color: 0x191d23, roughness: 0.55, metalness: 0.3 });
  const glassPaint = new THREE.MeshStandardMaterial({ color: 0x0e141d, roughness: 0.08, metalness: 0.65 });
  const metalPaint = new THREE.MeshStandardMaterial({ color: 0x8f979f, roughness: 0.35, metalness: 0.8 });
  function box(w, h, d, paint, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }
  box(1.9, 1.5, 3.4, whitePaint, 0, 0, 0);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), whitePaint);
  nose.scale.set(0.92, 0.72, 1.05);
  nose.position.set(0, -0.05, 1.55);
  nose.castShadow = true;
  group.add(nose);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), glassPaint);
  cockpit.scale.set(0.8, 0.55, 0.85);
  cockpit.position.set(0, 0.28, 1.62);
  group.add(cockpit);
  box(1.94, 0.44, 3.44, bluePaint, 0, -0.08, 0);
  box(1.7, 0.34, 3.0, darkPaint, 0, -0.86, 0);
  const flankGeometry = new THREE.PlaneGeometry(2.1, 0.4);
  const flankMaterial = heliPoliceMaterial();
  for (const sideSign of [-1, 1]) {
    const flank = new THREE.Mesh(flankGeometry, flankMaterial);
    flank.position.set(sideSign * 0.99, -0.08, 0);
    flank.rotation.y = sideSign * Math.PI * 0.5;
    group.add(flank);
  }
  box(0.44, 0.52, 3.8, whitePaint, 0, 0.28, -3.4);
  box(0.1, 1.05, 0.72, bluePaint, 0, 0.85, -5.15);
  box(1.15, 0.07, 0.5, whitePaint, 0, 0.42, -5.0);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.16, 0.85, -5.15);
  tailRotor.add(
    new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.16), darkPaint),
    new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 1.1), darkPaint),
  );
  group.add(tailRotor);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.4, 8), metalPaint);
  mast.position.set(0, 0.92, 0.1);
  group.add(mast);
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.14, 0.1);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(3.9, 32),
    new THREE.MeshBasicMaterial({ color: 0x1a1d22, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  rotor.add(
    new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.05, 0.44), darkPaint),
    new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 7.8), darkPaint),
    disc,
  );
  group.add(rotor);
  for (const sideSign of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.1, 8), metalPaint);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(sideSign * 0.88, -1.32, 0);
    rail.castShadow = true;
    group.add(rail);
    for (const z of [-0.95, 0.95]) box(0.07, 0.55, 0.07, metalPaint, sideSign * 0.88, -1.05, z);
  }
  const redLight = box(0.12, 0.12, 0.12, new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2.4 }), -1.0, -0.08, 0.7);
  const whiteLight = box(0.12, 0.12, 0.12, new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffffff, emissiveIntensity: 2.2 }), 1.0, -0.08, 0.7);
  const tailLight = box(0.1, 0.1, 0.1, new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffffff, emissiveIntensity: 1.8 }), 0, 0.9, -5.55);
  redLight.castShadow = false;
  whiteLight.castShadow = false;
  tailLight.castShadow = false;
  const spot = new THREE.SpotLight(0xfff1c4, 1100, 130, 0.32, 0.6, 1.1);
  spot.position.set(0, -0.95, 0.5);
  group.add(spot);
  group.add(spot.target);
  spot.target.position.set(0, -30, 0.5);
  const coneGeometry = new THREE.CylinderGeometry(0.3, 3.4, 1, 20, 1, true);
  coneGeometry.translate(0, -0.5, 0);
  const cone = new THREE.Mesh(coneGeometry, new THREE.MeshBasicMaterial({
    color: 0xffe9b0, transparent: true, opacity: 0.13,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  cone.position.set(0, -0.95, 0.5);
  group.add(cone);
  group.userData.rotor = rotor;
  group.userData.tailRotor = tailRotor;
  group.userData.spot = spot;
  group.userData.spotTarget = spot.target;
  group.userData.cone = cone;
  return group;
}

export function aimHelicopterSearchlight(heli, worldPoint) {
  if (!heli?.userData?.cone || !heli?.userData?.spotTarget) return;
  const { cone, spotTarget } = heli.userData;
  _heliLocal.copy(worldPoint);
  heli.worldToLocal(_heliLocal);
  spotTarget.position.copy(_heliLocal);
  _heliBelly.set(0, -0.95, 0.5);
  _heliDir.copy(_heliLocal).sub(_heliBelly);
  const distance = Math.max(1, _heliDir.length());
  _heliDir.normalize();
  cone.position.copy(_heliBelly);
  cone.quaternion.setFromUnitVectors(HELI_DOWN, _heliDir);
  cone.scale.set(1, distance, 1);
}

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
    heli: null,
    heliAngle: 0,
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

  // Police helicopter: circles the focus at wanted >= 4, gone below that.
  try {
    const starsNow = wanted?.stars ?? 0;
    if (starsNow >= 4 && !police.heli && police.scene) {
      police.heli = buildHelicopter();
      police.heliAngle = Math.random() * Math.PI * 2;
      police.scene.add(police.heli);
    } else if (starsNow < 4 && police.heli) {
      police.scene?.remove(police.heli);
      police.heli = null;
    }
    if (police.heli) {
      police.heliAngle = (police.heliAngle ?? 0) + dt * 0.24;
      const heli = police.heli;
      _heliFocus.set(focus.x, focus.y ?? WORLD.roadY, focus.z);
      heli.position.set(
        _heliFocus.x + Math.cos(police.heliAngle) * HELI_CIRCLE_RADIUS,
        _heliFocus.y + HELI_ALTITUDE,
        _heliFocus.z + Math.sin(police.heliAngle) * HELI_CIRCLE_RADIUS,
      );
      heli.lookAt(_heliFocus.x, _heliFocus.y + 1, _heliFocus.z);
      heli.rotateZ(0.3);
      if (heli.userData.rotor) heli.userData.rotor.rotation.y += dt * 26;
      if (heli.userData.tailRotor) heli.userData.tailRotor.rotation.x += dt * 30;
      heli.updateMatrixWorld(true);
      _heliAimPoint.set(_heliFocus.x, _heliFocus.y + 0.6, _heliFocus.z);
      aimHelicopterSearchlight(heli, _heliAimPoint);
    }
  } catch {
    // The helicopter is cosmetic; never let it break the wanted loop.
  }

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
