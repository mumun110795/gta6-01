import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeFigure } from './player.js';

const ACTIVE_PEDESTRIANS = 26;
const SPAWN_INNER_RADIUS = 38;
const SPAWN_OUTER_RADIUS = 155;
const DESPAWN_RADIUS = 205;
const WALK_SPEED = 1.45;
const RUN_SPEED = 5.4;
const HIT_SPEED = 7.5;
const HIT_DISTANCE = 2.15;
const DANGER_DISTANCE = 10.5;

const SHIRTS = new Int32Array([0xd8543f, 0x2f9e73, 0x386fae, 0xe0a742, 0x8d6db3, 0xe7eaf2, 0x2b3541]);
const PANTS = new Int32Array([0x2b3541, 0x57606d, 0x7c6a56, 0x26343b, 0x8f96a2, 0x3f3a35]);
const SKINS = new Int32Array([0xf0c39c, 0xc99168, 0x9c6b46, 0x754c33, 0x5a3a28, 0xd8a878]);

function makeRandom(seed) {
  let state = seed >>> 0 || 0x44491;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function roadDirection(road) {
  const dx = road.x2 - road.x1;
  const dz = road.z2 - road.z1;
  const length = Math.hypot(dx, dz) || 1;
  return { dx: dx / length, dz: dz / length, length };
}

function pointOnWalkway(path, distance) {
  const travel = THREE.MathUtils.clamp(distance, 0, path.length);
  return {
    x: path.x1 + path.dx * travel,
    z: path.z1 + path.dz * travel,
    heading: path.heading,
  };
}

function makeRoadPath(road, side) {
  const { dx, dz, length } = roadDirection(road);
  const offset = (road.width * 0.5 + 1.55) * side;
  return {
    kind: 'sidewalk',
    x1: road.x1 + dz * offset,
    z1: road.z1 - dx * offset,
    x2: road.x2 + dz * offset,
    z2: road.z2 - dx * offset,
    dx,
    dz,
    length,
    heading: Math.atan2(dx, dz),
    road,
    side,
  };
}

function makeDeckPath(x1, z1, x2, z2) {
  const { dx, dz, length } = roadDirection({ x1, z1, x2, z2 });
  return {
    kind: 'promenade',
    x1,
    z1,
    x2,
    z2,
    dx,
    dz,
    length,
    heading: Math.atan2(dx, dz),
  };
}

function intersectionKey(x, z) {
  return `${Math.round(x * 2)}:${Math.round(z * 2)}`;
}

function endpointKey(path, end) {
  return intersectionKey(end === 1 ? path.x2 : path.x1, end === 1 ? path.z2 : path.z1);
}

function buildWalkGraph(world) {
  const paths = [];
  const endpoints = new Map();
  for (const road of world?.roads ?? []) {
    paths.push(makeRoadPath(road, -1), makeRoadPath(road, 1));
  }
  paths.push(
    makeDeckPath(440, -185, 440, 325),
    makeDeckPath(-525, 415, -315, 415),
    makeDeckPath(-525, 570, -315, 570),
    makeDeckPath(-525, 415, -525, 570),
    makeDeckPath(-315, 415, -315, 570),
    makeDeckPath(-420, 455, -420, 590),
  );

  for (const path of paths) {
    for (const end of [0, 1]) {
      const key = endpointKey(path, end);
      let node = endpoints.get(key);
      if (!node) {
        const position = pointOnWalkway(path, end * path.length);
        node = { key, x: position.x, z: position.z, paths: [] };
        endpoints.set(key, node);
      }
      node.paths.push({ path, end });
    }
  }
  return { paths, endpoints };
}

function positionIsValid(x, z, colliders) {
  if (Math.hypot(x / WORLD.halfIsland, z / WORLD.halfIsland) > 1) return false;
  for (const collider of colliders ?? []) {
    if (x > collider.minX - 0.35 && x < collider.maxX + 0.35 && z > collider.minZ - 0.35 && z < collider.maxZ + 0.35) return false;
  }
  return true;
}

function pathAt(path, distance) {
  return pointOnWalkway(path, distance);
}

function chooseNextPath(graph, path, backward, random) {
  let node = graph.endpoints.get(endpointKey(path, backward ? 0 : 1));
  if (!node) return null;
  const options = node.paths.filter((option) => option.path !== path);
  const selected = options.length && random() > 0.12
    ? options[Math.floor(random() * options.length)]
    : null;
  if (selected) {
    return {
      path: selected.path,
      distance: selected.end === 1 ? selected.path.length - 0.01 : 0.01,
      backward: selected.end === 1,
    };
  }
  return {
    path,
    distance: backward ? 0.01 : path.length - 0.01,
    backward: !backward,
  };
}

function animateFigure(mesh, distance, down) {
  const parts = mesh.userData.parts;
  if (down) {
    mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, Math.PI * 0.48, 0.16);
    mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, WORLD.roadY + 0.1, 0.12);
    for (const part of ['left-leg', 'right-leg', 'left-arm', 'right-arm']) parts[part].rotation.x *= 0.86;
    return;
  }
  mesh.userData.walkPhase = (mesh.userData.walkPhase + distance * 2.1) % (Math.PI * 2);
  const swing = Math.sin(mesh.userData.walkPhase) * Math.min(0.75, 0.2 + distance * 3.5);
  parts['left-leg'].rotation.x = swing;
  parts['right-leg'].rotation.x = -swing;
  parts['left-arm'].rotation.x = -swing * 0.82;
  parts['right-arm'].rotation.x = swing * 0.82;
  parts.hips.position.y = 0.88 + Math.abs(Math.sin(mesh.userData.walkPhase)) * 0.026;
}

function configurePedestrian(pedestrian, path, distance, focus) {
  const point = pathAt(path, distance);
  pedestrian.path = path;
  pedestrian.distance = THREE.MathUtils.clamp(distance, 0, path.length);
  pedestrian.backward = false;
  pedestrian.position.set(point.x, WORLD.roadY, point.z);
  pedestrian.heading = path.heading;
  pedestrian.speed = WALK_SPEED;
  pedestrian.fleeTimer = 0;
  pedestrian.fleeHeading = point.heading;
  pedestrian.crossTimer = 4 + pedestrian.system.random() * 18;
  pedestrian.down = false;
  pedestrian.downTime = 0;
  pedestrian.hitReported = false;
  pedestrian.mesh.visible = true;
  pedestrian.mesh.rotation.set(0, point.heading, 0);
  animateFigure(pedestrian.mesh, 0, false);
}

export function createAgent(system, focus) {
  const mesh = makeFigure(
    SHIRTS[system.random() * SHIRTS.length | 0],
    PANTS[system.random() * PANTS.length | 0],
    SKINS[system.random() * SKINS.length | 0],
  );
  system.scene.add(mesh);
  const pedestrian = {
    system,
    mesh,
    position: new THREE.Vector3(),
    heading: 0,
    speed: WALK_SPEED,
    path: null,
    distance: 0,
    backward: false,
    fleeTimer: 0,
    fleeHeading: 0,
    crossTimer: 0,
    down: false,
    downTime: 0,
  };
  system.agents.push(pedestrian);
  respawnPedestrian(pedestrian, focus);
  return pedestrian;
}

export function createStaticPedestrian(system, point) {
  const pedestrian = createAgent(system, point);
  pedestrian.path = null;
  pedestrian.position.set(point.x, WORLD.roadY, point.z);
  pedestrian.heading = point.heading ?? 0;
  pedestrian.speed = 0;
  pedestrian.mesh.position.copy(pedestrian.position);
  pedestrian.mesh.rotation.set(0, pedestrian.heading, 0);
  animateFigure(pedestrian.mesh, 0, false);
  return pedestrian;
}

function respawnPedestrian(pedestrian, focus) {
  const system = pedestrian.system;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const path = system.graph.paths[Math.floor(system.random() * system.graph.paths.length)];
    const distance = system.random() * path.length;
    const point = pathAt(path, distance);
    const range = Math.hypot(point.x - focus.x, point.z - focus.z);
    if (range < SPAWN_INNER_RADIUS || range > SPAWN_OUTER_RADIUS) continue;
    if (!positionIsValid(point.x, point.z, system.colliders)) continue;
    configurePedestrian(pedestrian, path, distance, focus);
    return true;
  }
  pedestrian.mesh.visible = false;
  return false;
}

function nearestPathDistance(path, position) {
  return THREE.MathUtils.clamp(
    (position.x - path.x1) * path.dx + (position.z - path.z1) * path.dz,
    0,
    path.length,
  );
}

function approachDanger(pedestrian, cars) {
  let danger = null;
  for (const car of cars ?? []) {
    const deltaX = pedestrian.position.x - car.position.x;
    const deltaZ = pedestrian.position.z - car.position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance > DANGER_DISTANCE) continue;

    const carSpeed = car.speed ?? 0;
    const speed = Math.abs(carSpeed);
    const travelSign = Math.sign(carSpeed) || 1;
    const forward = deltaX * Math.sin(car.heading) + deltaZ * Math.cos(car.heading);
    const travelForward = forward * travelSign;
    const lateral = deltaX * Math.cos(car.heading) - deltaZ * Math.sin(car.heading);
    const alignment = travelForward / Math.max(distance, 0.001);

    if (distance < HIT_DISTANCE && speed > HIT_SPEED) {
      pedestrian.down = true;
      pedestrian.downTime = 0;
      pedestrian.speed = 0;
      pedestrian.fleeTimer = 0;
      if (!pedestrian.hitReported) {
        pedestrian.hitReported = true;
        for (const callback of pedestrian.system.onPedestrianHit) {
          callback(pedestrian, car);
        }
      }
      return { hit: true };
    }

    if (
      !danger &&
      speed > 4 &&
      alignment > 0.68 &&
      travelForward > 0.5 &&
      Math.abs(lateral) < 4.2
    ) {
      const timeToImpact = travelForward / Math.max(2, speed * alignment);
      if (timeToImpact < 1.15) {
        const side = Math.sign(lateral) || 1;
        danger = {
          heading: Math.atan2(side * Math.cos(car.heading), -side * Math.sin(car.heading)),
          timer: 0.7 + Math.min(0.6, speed * 0.025),
        };
      }
    }
  }
  return danger;
}

function moveWhileFleeing(pedestrian, dt) {
  const deltaX = Math.sin(pedestrian.fleeHeading) * pedestrian.speed * dt;
  const deltaZ = Math.cos(pedestrian.fleeHeading) * pedestrian.speed * dt;
  if (positionIsValid(
    pedestrian.position.x + deltaX,
    pedestrian.position.z + deltaZ,
    pedestrian.system.colliders,
  )) {
    pedestrian.position.x += deltaX;
    pedestrian.position.z += deltaZ;
  } else {
    pedestrian.fleeHeading += Math.PI * 0.72;
  }
  pedestrian.heading = pedestrian.fleeHeading;
}

function moveAlongPath(pedestrian, dt) {
  const path = pedestrian.path;
  if (!path) return;

  pedestrian.distance = nearestPathDistance(path, pedestrian.position);
  const pathEnd = pedestrian.distance <= 0.06 && pedestrian.backward;
  const pathStart = pedestrian.distance >= path.length - 0.06 && !pedestrian.backward;
  if (pathEnd || pathStart) {
    const next = chooseNextPath(pedestrian.system.graph, path, pedestrian.backward, pedestrian.system.random);
    if (!next || !next.path) {
      respawnPedestrian(pedestrian, pedestrian.position);
      return;
    }
    pedestrian.path = next.path;
    pedestrian.distance = next.distance;
    pedestrian.backward = next.backward;
  }

  const direction = pedestrian.backward ? -1 : 1;
  pedestrian.distance = THREE.MathUtils.clamp(
    pedestrian.distance + pedestrian.speed * dt * direction,
    0,
    pedestrian.path.length,
  );
  const point = pathAt(pedestrian.path, pedestrian.distance);
  pedestrian.position.x = point.x;
  pedestrian.position.z = point.z;
  pedestrian.heading = pedestrian.path.heading + (pedestrian.backward ? Math.PI : 0);
}

export function createPedestrians(world) {
  const system = {
    graph: buildWalkGraph(world),
    scene: world?.scene,
    colliders: world?.colliders ?? [],
    agents: [],
    random: makeRandom(60013),
    onPedestrianHit: [],
    fleeFrom(point) {
      for (const pedestrian of system.agents) {
        const distance = Math.hypot(pedestrian.position.x - point.x, pedestrian.position.z - point.z);
        if (pedestrian.down || distance > DANGER_DISTANCE) continue;
        pedestrian.fleeHeading = Math.atan2(
          pedestrian.position.x - point.x,
          pedestrian.position.z - point.z,
        );
        pedestrian.fleeTimer = Math.max(pedestrian.fleeTimer, 1.1);
        pedestrian.speed = RUN_SPEED;
      }
    },
  };

  for (let index = 0; index < ACTIVE_PEDESTRIANS; index += 1) createAgent(system, world?.playerStart ?? { x: 0, z: 0 });
  return system;
}

export function updatePedestrians(system, dt, context = {}) {
  if (!system || dt <= 0) return;
  const player = context.player;
  const focus = player?.mode === 'car' ? player.car?.position : player?.position;
  if (!focus) return;
  const cars = context.cars ?? [];

  for (let index = system.agents.length - 1; index >= 0; index -= 1) {
    const pedestrian = system.agents[index];
    if (!pedestrian.path) continue;
    const distanceToPlayer = Math.hypot(
      pedestrian.position.x - focus.x,
      pedestrian.position.z - focus.z,
    );
    if (distanceToPlayer > DESPAWN_RADIUS || !pedestrian.mesh.visible) {
      respawnPedestrian(pedestrian, focus);
      continue;
    }

    if (pedestrian.down) {
      pedestrian.downTime += dt;
      animateFigure(pedestrian.mesh, 0, true);
      continue;
    }

    const danger = approachDanger(pedestrian, cars);
    if (danger?.hit) {
      animateFigure(pedestrian.mesh, 0, true);
      continue;
    }
    if (danger) {
      pedestrian.fleeHeading = danger.heading;
      pedestrian.fleeTimer = Math.max(pedestrian.fleeTimer, danger.timer);
    }

    if (pedestrian.fleeTimer > 0) {
      pedestrian.fleeTimer -= dt;
      pedestrian.speed = RUN_SPEED;
      moveWhileFleeing(pedestrian, dt);
    } else {
      pedestrian.fleeTimer = 0;
      pedestrian.speed = WALK_SPEED;
      pedestrian.crossTimer -= dt;
      if (pedestrian.crossTimer <= 0) {
        pedestrian.backward = !pedestrian.backward;
        pedestrian.crossTimer = 9 + system.random() * 20;
      }
      moveAlongPath(pedestrian, dt);
    }

    pedestrian.mesh.position.copy(pedestrian.position);
    pedestrian.mesh.rotation.y = pedestrian.heading;
    animateFigure(pedestrian.mesh, pedestrian.speed * dt, false);
  }
}
