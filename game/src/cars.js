import * as THREE from 'three';
import {
  GAMEPLAY,
  PALETTE,
  ROAD_LAYOUT,
  SPAWN_POINTS,
  WORLD,
} from './config.js';

export const CAR_KINDS = Object.freeze([
  'compact',
  'sedan',
  'pickup',
  'sports',
  'van',
  'police',
]);

const KIND_SPECS = Object.freeze({
  compact: Object.freeze({ width: 1.62, length: 3.55, bodyHeight: 0.52, cabinLength: 1.45, wheelRadius: 0.31, topSpeed: 36, acceleration: 10.5, grip: 7.2, steerRate: 2.55 }),
  sedan: Object.freeze({ width: 1.78, length: 4.42, bodyHeight: 0.55, cabinLength: 1.88, wheelRadius: 0.34, topSpeed: 44, acceleration: 12.4, grip: 6.8, steerRate: 2.25 }),
  pickup: Object.freeze({ width: 1.88, length: 4.92, bodyHeight: 0.64, cabinLength: 1.42, wheelRadius: 0.39, topSpeed: 42, acceleration: 10.8, grip: 5.8, steerRate: 1.95 }),
  sports: Object.freeze({ width: 1.86, length: 4.28, bodyHeight: 0.4, cabinLength: 1.3, wheelRadius: 0.34, topSpeed: 56, acceleration: 18.5, grip: 7.8, steerRate: 2.5 }),
  van: Object.freeze({ width: 1.95, length: 4.86, bodyHeight: 0.92, cabinLength: 2.65, wheelRadius: 0.37, topSpeed: 38, acceleration: 8.8, grip: 6.1, steerRate: 1.75 }),
  police: Object.freeze({ width: 1.86, length: 4.55, bodyHeight: 0.56, cabinLength: 1.78, wheelRadius: 0.35, topSpeed: 48, acceleration: 14.6, grip: 7.3, steerRate: 2.35 }),
});

const PAINT_COLORS = Object.freeze([
  PALETTE.accent,
  PALETTE.police,
  PALETTE.sand,
  PALETTE.concreteWarm,
  0xd85563,
  0x2f9e73,
  0x9c6ade,
  0x74808c,
  0xe7eaf2,
  0x272b33,
]);

const geometryCache = new Map();

function cachedGeometry(key, makeGeometry) {
  if (!geometryCache.has(key)) geometryCache.set(key, makeGeometry());
  return geometryCache.get(key);
}

function boxGeometry(width, height, depth) {
  return cachedGeometry(`${width}x${height}x${depth}`, () => new THREE.BoxGeometry(width, height, depth, 1, 1, 1));
}

function wheelGeometry(radius, width) {
  return cachedGeometry(`wheel-${radius}x${width}`, () => new THREE.CylinderGeometry(radius, radius, width, 10, 1));
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.48,
    metalness: options.metalness ?? 0.24,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
  });
}

function addBox(parent, geometry, paint, x, y, z, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, paint);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function makeCarMesh(kind = 'sedan', color = PAINT_COLORS[0]) {
  const spec = KIND_SPECS[kind] ?? KIND_SPECS.sedan;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const bodyPaint = material(kind === 'police' ? 0xf3f5f8 : color);
  const cabinPaint = material(kind === 'police' ? 0xf3f5f8 : color, { roughness: 0.38 });
  const glassPaint = material(PALETTE.glassDay, { roughness: 0.12, metalness: 0.5 });
  const trimPaint = material(0x22252a, { roughness: 0.68, metalness: 0.12 });
  const tirePaint = material(0x17191c, { roughness: 0.92, metalness: 0.02 });
  const hubPaint = material(0xb9bfc7, { roughness: 0.28, metalness: 0.8 });

  const bodyY = spec.wheelRadius + spec.bodyHeight * 0.58;
  const bodyMesh = addBox(
    body,
    boxGeometry(spec.width, spec.bodyHeight, spec.length),
    bodyPaint,
    0,
    bodyY,
    0,
  );
  bodyMesh.name = 'body';

  const cabinHeight = kind === 'van' ? 0.78 : kind === 'sports' ? 0.38 : 0.54;
  const cabinZ = kind === 'pickup' ? -0.15 : kind === 'van' ? -0.1 : -0.08;
  const cabin = addBox(
    body,
    boxGeometry(spec.width * 0.82, cabinHeight, spec.cabinLength),
    kind === 'pickup' ? trimPaint : cabinPaint,
    0,
    bodyY + spec.bodyHeight * 0.5 + cabinHeight * 0.5,
    cabinZ,
  );
  cabin.name = 'cabin';
  addBox(
    body,
    boxGeometry(spec.width * 0.84, cabinHeight * 0.52, spec.cabinLength * 0.78),
    glassPaint,
    0,
    bodyY + spec.bodyHeight * 0.5 + cabinHeight * 0.52,
    cabinZ,
    false,
  );

  if (kind === 'pickup') {
    addBox(body, boxGeometry(spec.width * 0.9, 0.14, spec.length * 0.42), trimPaint, 0, bodyY + spec.bodyHeight * 0.53, spec.length * 0.24);
  } else if (kind === 'police') {
    addBox(body, boxGeometry(spec.width + 0.015, spec.bodyHeight * 0.34, spec.length * 0.3), material(0x20313d), 0, bodyY, 0);
  } else {
    addBox(body, boxGeometry(spec.width * 0.34, spec.bodyHeight * 0.1, spec.length * 0.7), trimPaint, 0, bodyY + spec.bodyHeight * 0.55, 0, false);
  }

  const wheelSpacingX = spec.width * 0.5;
  const wheelSpacingZ = spec.length * (kind === 'pickup' ? 0.32 : 0.31);
  const wheelPositions = [
    [-wheelSpacingX, wheelSpacingZ, true],
    [wheelSpacingX, wheelSpacingZ, true],
    [-wheelSpacingX, -wheelSpacingZ, false],
    [wheelSpacingX, -wheelSpacingZ, false],
  ];
  const wheels = wheelPositions.map(([x, z, isFront]) => {
    const wheel = new THREE.Group();
    wheel.position.set(x, spec.wheelRadius, z);
    const tire = new THREE.Mesh(wheelGeometry(spec.wheelRadius, kind === 'sports' ? 0.24 : 0.28), tirePaint);
    tire.rotation.z = Math.PI * 0.5;
    tire.castShadow = true;
    const hub = new THREE.Mesh(wheelGeometry(spec.wheelRadius * 0.5, kind === 'sports' ? 0.26 : 0.3), hubPaint);
    hub.rotation.z = Math.PI * 0.5;
    wheel.add(tire, hub);
    const steeringGroup = new THREE.Group();
    if (isFront) {
      steeringGroup.name = 'front-wheel';
      steeringGroup.add(wheel);
      steeringGroup.position.set(x, spec.wheelRadius, z);
      wheel.position.set(0, 0, 0);
      body.add(steeringGroup);
      return steeringGroup;
    }
    body.add(wheel);
    return wheel;
  });

  const lightWidth = spec.width * 0.22;
  const headlightPaint = material(0xfff2cf, { emissive: 0xfff0b8, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.1 });
  const taillightPaint = material(0x5a0d10, { emissive: 0xff1d24, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0.05 });
  const headlightBoxes = [
    addBox(body, boxGeometry(lightWidth, 0.12, 0.1), headlightPaint, -spec.width * 0.31, bodyY, spec.length * 0.5 + 0.02, false),
    addBox(body, boxGeometry(lightWidth, 0.12, 0.1), headlightPaint, spec.width * 0.31, bodyY, spec.length * 0.5 + 0.02, false),
  ];
  addBox(body, boxGeometry(lightWidth, 0.1, 0.08), taillightPaint, -spec.width * 0.31, bodyY, -spec.length * 0.5 - 0.02, false);
  addBox(body, boxGeometry(lightWidth, 0.1, 0.08), taillightPaint, spec.width * 0.31, bodyY, -spec.length * 0.5 - 0.02, false);
  addBox(body, boxGeometry(spec.width * 0.3, 0.07, 0.07), material(0x3a3f45, { metalness: 0.85, roughness: 0.25 }), 0, bodyY + spec.bodyHeight * 0.28, -spec.length * 0.5 - 0.04, false);

  let lightBar = null;
  if (kind === 'police') {
    lightBar = new THREE.Group();
    lightBar.name = 'light-bar';
    lightBar.position.set(0, bodyY + spec.bodyHeight * 0.5 + cabinHeight + 0.08, cabinZ);
    const redLight = addBox(lightBar, boxGeometry(spec.width * 0.26, 0.12, 0.14), material(0x671014, { emissive: 0xff2020, emissiveIntensity: 2.2 }), -spec.width * 0.16, 0, 0, false);
    const blueLight = addBox(lightBar, boxGeometry(spec.width * 0.26, 0.12, 0.14), material(0x10245a, { emissive: 0x2255ff, emissiveIntensity: 2.2 }), spec.width * 0.16, 0, 0, false);
    lightBar.userData.lights = [redLight, blueLight];
    addBox(lightBar, boxGeometry(spec.width * 0.6, 0.05, 0.1), trimPaint, 0, -0.075, 0, false);
    body.add(lightBar);
  }

  root.userData = {
    kind,
    originalColor: new THREE.Color(color),
    bodyPaint,
    bodyMesh,
    cabin,
    wheels,
    lightBar,
    headlightBoxes,
    headlightMaterial: headlightPaint,
    baseBodyY: bodyY,
  };
  return root;
}

export function flashPoliceLights(mesh, elapsed) {
  const lightBar = mesh?.userData.lightBar;
  if (!lightBar) return;
  const [redLight, blueLight] = lightBar.userData.lights;
  const phase = Math.floor(elapsed * 5) % 2 === 0;
  redLight.material.emissiveIntensity = phase ? 3.5 : 0.05;
  blueLight.material.emissiveIntensity = phase ? 0.05 : 3.5;
}

export function updateCarLighting(car, nightGlow) {
  if (!car?.mesh?.userData?.headlightMaterial) return;
  car.nightGlow = nightGlow;
  car.mesh.userData.headlightMaterial.emissiveIntensity = 0.35 + nightGlow * 2.7;
}

export function createCar(kind = 'sedan', color = PAINT_COLORS[0], position = { x: 0, z: 0 }, heading = 0) {
  const safeKind = KIND_SPECS[kind] ? kind : 'sedan';
  const mesh = makeCarMesh(safeKind, color);
  const vehicleTuning = GAMEPLAY.vehicle;
  const tuning = {
    ...KIND_SPECS[safeKind],
    acceleration: KIND_SPECS[safeKind].acceleration * (vehicleTuning.maxEngineForce / 15),
    topSpeed: KIND_SPECS[safeKind].topSpeed,
    grip: KIND_SPECS[safeKind].grip * (vehicleTuning.grip / 6.2),
    drag: vehicleTuning.drag,
  };
  tuning.maxSpeedKmh = Math.round(tuning.topSpeed * 3.6);
  const car = {
    kind: safeKind,
    color,
    position: new THREE.Vector3(position.x, WORLD.roadY, position.z),
    heading,
    speed: 0,
    lateralSpeed: 0,
    steering: 0,
    damage: 0,
    driver: null,
    parked: false,
    mesh,
    tuning,
    halfWidth: tuning.width * 0.5 + 0.04,
    halfLength: tuning.length * 0.5 + 0.04,
    wheelSpin: 0,
    bodyTilt: new THREE.Vector2(),
    lastImpactSpeed: 0,
    lightClock: 0,
  };
  syncCarMesh(car);
  return car;
}

function makeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function nearestOpenPointOnRoad(road, random) {
  const directionX = road.x2 - road.x1;
  const directionZ = road.z2 - road.z1;
  const length = Math.hypot(directionX, directionZ);
  if (length < 10) return null;
  const heading = Math.atan2(directionX, directionZ);
  const travel = (0.16 + random() * 0.68) * length;
  const side = random() < 0.5 ? -1 : 1;
  const offset = (road.width * 0.5 + 1.15) * side;
  return {
    x: road.x1 + (directionX / length) * travel + Math.cos(heading) * offset,
    z: road.z1 + (directionZ / length) * travel + Math.sin(heading) * offset,
    heading,
  };
}

function isInsideCarAABB(point, cars, clearance = 2.7) {
  return cars.some((car) => Math.abs(car.position.x - point.x) < clearance && Math.abs(car.position.z - point.z) < clearance);
}

function isBlockedByCollider(point, colliders = [], clearance = 1.1) {
  return colliders.some((collider) => (
    point.x > collider.minX - clearance &&
    point.x < collider.maxX + clearance &&
    point.z > collider.minZ - clearance &&
    point.z < collider.maxZ + clearance
  ));
}

function addParkedCar(scene, cars, kind, color, spot) {
  const car = createCar(kind, color, spot, spot.heading);
  car.parked = true;
  scene.add(car.mesh);
  cars.push(car);
  return car;
}

export function spawnParkedCars(scene, world, count = 90) {
  const roads = world?.roads ?? [];
  const colliders = world?.colliders ?? [];
  const cars = [];
  if (!scene || roads.length === 0) return cars;
  const random = makeRandom(20261118);
  const usableRoads = roads.filter((road) => {
    const centerX = (road.x1 + road.x2) / 2;
    const centerZ = (road.z1 + road.z2) / 2;
    return Math.abs(centerX) < 680 && Math.abs(centerZ) < 680;
  });

  const carLot = SPAWN_POINTS.carLot;
  const lotHeading = Math.PI * 0.5;
  for (let index = 0; index < Math.min(10, Math.max(2, Math.round(count * 0.1))); index += 1) {
    const row = Math.floor(index / 5);
    addParkedCar(scene, cars, CAR_KINDS[1 + ((index * 3 + 2) % (CAR_KINDS.length - 2))], PAINT_COLORS[(index * 2 + 1) % PAINT_COLORS.length], {
      x: carLot.x + (index % 5 - 2) * 3.1,
      z: carLot.z + row * 5.6 - 2.8,
      heading: lotHeading,
    });
  }

  const harbor = ROAD_LAYOUT.harbor.center;
  const harborSpots = [
    { x: harbor.x - 84, z: harbor.z - 32, heading: 0 },
    { x: harbor.x - 64, z: harbor.z - 32, heading: 0 },
    { x: harbor.x - 44, z: harbor.z - 32, heading: 0 },
    { x: harbor.x - 27, z: harbor.z - 9, heading: Math.PI * 0.5 },
    { x: harbor.x - 27, z: harbor.z + 10, heading: Math.PI * 0.5 },
    { x: harbor.x - 27, z: harbor.z + 30, heading: Math.PI * 0.5 },
    { x: harbor.x - 8, z: harbor.z - 32, heading: 0 },
  ];
  for (const [index, spot] of harborSpots.entries()) {
    addParkedCar(scene, cars, CAR_KINDS[2 + (index % 3)], PAINT_COLORS[(index * 2 + 1) % PAINT_COLORS.length], spot);
  }

  const targetRoadCars = Math.max(0, count - cars.length);
  let attempts = 0;
  while (cars.length < count && attempts < targetRoadCars * 14) {
    attempts += 1;
    const road = usableRoads[Math.floor(random() * usableRoads.length)];
    const spot = nearestOpenPointOnRoad(road, random);
    if (!spot || Math.abs(spot.x) > WORLD.halfIsland || Math.abs(spot.z) > WORLD.halfIsland) continue;
    if (isInsideCarAABB(spot, cars) || isBlockedByCollider(spot, colliders)) continue;
    const kind = CAR_KINDS[Math.floor(random() * (CAR_KINDS.length - 1))];
    addParkedCar(scene, cars, kind, PAINT_COLORS[Math.floor(random() * PAINT_COLORS.length)], spot);
  }
  return cars;
}

function directionalSpeeds(car) {
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  return {
    worldX: car.speed * sin + car.lateralSpeed * cos,
    worldZ: car.speed * cos - car.lateralSpeed * sin,
    sin,
    cos,
  };
}

function carAABB(car) {
  const absSin = Math.abs(Math.sin(car.heading));
  const absCos = Math.abs(Math.cos(car.heading));
  const radiusX = car.halfLength * absSin + car.halfWidth * absCos;
  const radiusZ = car.halfLength * absCos + car.halfWidth * absSin;
  return {
    minX: car.position.x - radiusX,
    maxX: car.position.x + radiusX,
    minZ: car.position.z - radiusZ,
    maxZ: car.position.z + radiusZ,
  };
}

function resolveCollisions(car, velocityX, velocityZ, colliders, dt) {
  let impactSpeed = 0;
  const box = carAABB(car);
  const testBox = {
    minX: box.minX + velocityX * dt,
    maxX: box.maxX + velocityX * dt,
    minZ: box.minZ + velocityZ * dt,
    maxZ: box.maxZ + velocityZ * dt,
  };
  for (const collider of colliders) {
    const overlapsX = testBox.maxX > collider.minX && testBox.minX < collider.maxX;
    const overlapsZ = testBox.maxZ > collider.minZ && testBox.minZ < collider.maxZ;
    if (!overlapsX || !overlapsZ) continue;
    const centerX = car.position.x;
    const centerZ = car.position.z;
    const overlapLeft = testBox.maxX - collider.minX;
    const overlapRight = collider.maxX - testBox.minX;
    const overlapSouth = testBox.maxZ - collider.minZ;
    const overlapNorth = collider.maxZ - testBox.minZ;
    const minimum = Math.min(overlapLeft, overlapRight, overlapSouth, overlapNorth);
    let normalX = 0;
    let normalZ = 0;
    if (minimum === overlapLeft && velocityX > 0) normalX = -1;
    else if (minimum === overlapRight && velocityX < 0) normalX = 1;
    else if (minimum === overlapSouth && velocityZ > 0) normalZ = -1;
    else if (minimum === overlapNorth && velocityZ < 0) normalZ = 1;
    if (normalX === 0 && normalZ === 0) continue;
    const intoWallSpeed = Math.abs(velocityX * normalX + velocityZ * normalZ);
    impactSpeed = Math.max(impactSpeed, intoWallSpeed);
    car.damage = Math.min(100, car.damage + Math.max(0, (intoWallSpeed - 2.2) * 2.9));
    if (intoWallSpeed > 3.5) {
      car.lastCollision = {
        x: car.position.x + normalX * car.halfLength,
        y: car.position.y + 0.55,
        z: car.position.z + normalZ * car.halfLength,
        speed: intoWallSpeed,
      };
    }
    if (normalX !== 0) velocityX = 0;
    if (normalZ !== 0) velocityZ = 0;
  }
  return { velocityX, velocityZ, impactSpeed };
}

function applyCoastBounds(car, velocityX, velocityZ) {
  const limit = WORLD.halfIsland - 4;
  let impactSpeed = 0;
  if ((car.position.x <= -limit && velocityX < 0) || (car.position.x >= limit && velocityX > 0)) {
    impactSpeed = Math.max(impactSpeed, Math.abs(velocityX));
    velocityX = 0;
  }
  if ((car.position.z <= -limit && velocityZ < 0) || (car.position.z >= limit && velocityZ > 0)) {
    impactSpeed = Math.max(impactSpeed, Math.abs(velocityZ));
    velocityZ = 0;
  }
  car.position.x = THREE.MathUtils.clamp(car.position.x, -limit, limit);
  car.position.z = THREE.MathUtils.clamp(car.position.z, -limit, limit);
  if (impactSpeed > 0) car.damage = Math.min(100, car.damage + Math.max(0, (impactSpeed - 2.8) * 2.2));
  if (impactSpeed > 3.5) {
    car.lastCollision = {
      x: car.position.x + Math.sign(velocityX) * car.halfWidth,
      y: car.position.y + 0.55,
      z: car.position.z + Math.sign(velocityZ) * car.halfWidth,
      speed: impactSpeed,
    };
  }
  return { velocityX, velocityZ, impactSpeed };
}

function fromWorldVelocities(car, velocityX, velocityZ) {
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  car.speed = velocityX * sin + velocityZ * cos;
  car.lateralSpeed = velocityX * cos - velocityZ * sin;
}

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  return ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
}

export function updateCar(car, input = {}, deltaTime = 0, colliders = []) {
  if (!car || deltaTime <= 0) return 0;
  const throttle = THREE.MathUtils.clamp(Number.isFinite(input.throttle) ? input.throttle : 0, -1, 1);
  const steerInput = THREE.MathUtils.clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1);
  const brake = Boolean(input.brake);
  const tuning = car.tuning;
  const substepCount = 2;
  const dt = deltaTime / substepCount;
  let largestImpact = 0;

  for (let step = 0; step < substepCount; step += 1) {
    const speedFactor = THREE.MathUtils.clamp(1.15 - Math.abs(car.speed) / (tuning.topSpeed * 1.25), 0.38, 1);
    const steerTarget = steerInput * speedFactor;
    const steerChange = tuning.steerRate * dt * (Math.abs(car.speed) > 0.15 ? 1 : 0.4);
    car.steering += THREE.MathUtils.clamp(steerTarget - car.steering, -steerChange, steerChange);

    if (brake) {
      if (car.speed > 0.2) car.speed -= Math.max(7, tuning.acceleration * 1.55) * dt;
      else car.speed = Math.max(-tuning.topSpeed * 0.34, car.speed - tuning.acceleration * 0.62 * dt);
    } else if (throttle > 0) {
      car.speed += tuning.acceleration * throttle * dt * (1 - Math.max(0, car.speed / tuning.topSpeed) * 0.68);
    } else if (throttle < 0) {
      if (car.speed > 0.25) car.speed += tuning.acceleration * throttle * 0.72 * dt;
      else car.speed = Math.max(-tuning.topSpeed * 0.34, car.speed + tuning.acceleration * throttle * 0.5 * dt);
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 2.4 * dt);
    }

    const drag = tuning.drag * 0.045 + Math.abs(car.speed) * tuning.drag * 0.006;
    car.speed -= car.speed * drag * dt;
    car.speed = THREE.MathUtils.clamp(car.speed, -tuning.topSpeed * 0.34, tuning.topSpeed);
    car.lateralSpeed -= car.lateralSpeed * Math.min(1, tuning.grip * dt);

    const steerAngle = car.steering * (0.35 + tuning.steerRate * 0.085);
    car.heading += (car.speed / Math.max(1.8, tuning.length)) * Math.tan(steerAngle) * dt;
    car.heading = normalizeAngle(car.heading);
    car.lateralSpeed += car.steering * car.speed * 0.018 * (7 / tuning.grip);

    let { worldX: velocityX, worldZ: velocityZ } = directionalSpeeds(car);
    let collision = resolveCollisions(car, velocityX, velocityZ, colliders, dt);
    velocityX = collision.velocityX;
    velocityZ = collision.velocityZ;
    car.position.x += velocityX * dt;
    car.position.z += velocityZ * dt;
    collision = applyCoastBounds(car, velocityX, velocityZ);
    fromWorldVelocities(car, collision.velocityX, collision.velocityZ);
    largestImpact = Math.max(largestImpact, collision.impactSpeed);
  }

  car.lastImpactSpeed = largestImpact;
  syncCarMesh(car, deltaTime);
  return largestImpact;
}

function applyDamageVisuals(car, accelerationTilt) {
  const data = car.mesh.userData;
  const damageRatio = THREE.MathUtils.clamp(car.damage / 100, 0, 1);
  const darkened = data.bodyPaint.color.copy(data.originalColor);
  darkened.multiplyScalar(1 - damageRatio * 0.48);
  if (car.kind === 'police') darkened.lerp(new THREE.Color(0xf3f5f8), 0.82);
  const crumple = 1 - damageRatio * 0.13;
  data.cabin.scale.set(1 + damageRatio * 0.04, crumple, 1 - damageRatio * 0.025);
  data.bodyMesh.scale.y = 1 - damageRatio * 0.035;
  accelerationTilt.y += damageRatio * Math.sin(car.lightClock * 4) * 0.006;
}

export function syncCarMesh(car, deltaTime = 0) {
  if (!car?.mesh) return;
  const data = car.mesh.userData;
  car.lightClock += deltaTime;
  car.mesh.position.copy(car.position);
  car.mesh.rotation.y = car.heading;

  const previousSpin = car.wheelSpin;
  car.wheelSpin += car.speed * deltaTime / car.tuning.wheelRadius;
  const spinThisFrame = car.wheelSpin - previousSpin;
  const wheelAngle = car.steering * (0.36 + car.tuning.steerRate * 0.085);
  for (const wheel of data.wheels) {
    for (const wheelPart of wheel.children) {
      if (wheelPart.name === 'front-wheel') continue;
      wheelPart.rotation.x += spinThisFrame;
    }
    if (wheel.name === 'front-wheel') wheel.rotation.y = wheelAngle;
  }

  const accelerationTilt = car.bodyTilt.clone();
  accelerationTilt.multiplyScalar(Math.exp(-6 * deltaTime));
  accelerationTilt.y -= (car.speed - (car.previousSpeed ?? car.speed)) * Math.min(1, deltaTime * 10) * 0.012;
  accelerationTilt.x = THREE.MathUtils.clamp(accelerationTilt.x + wheelAngle * Math.min(1, Math.abs(car.speed) / 10) * 0.13, -0.08, 0.08);
  accelerationTilt.y = THREE.MathUtils.clamp(accelerationTilt.y, -0.055, 0.055);
  car.bodyTilt.copy(accelerationTilt);
  data.bodyMesh.rotation.set(accelerationTilt.y, 0, accelerationTilt.x);
  data.bodyMesh.position.y = data.baseBodyY;
  applyDamageVisuals(car, accelerationTilt);
  car.previousSpeed = car.speed;
  if (car.kind === 'police') flashPoliceLights(car.mesh, car.lightClock);
}
