import * as THREE from 'three';
import { CAR_KINDS, createCar, updateCar } from './cars.js';

const ACTIVE_CARS = 14;
const SPAWN_RADIUS = 260;
const DESPAWN_RADIUS = 350;
const LANE_OFFSET = 2.35;
const TRAFFIC_SPEEDS = new Float32Array([12, 15, 17, 19, 21, 23]);
const PAINTS = new Int32Array([0xd85563, 0x2f9e73, 0x9c6ade, 0x74808c, 0xe7eaf2, 0x272b33]);

function makeRandom(seed) {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function keyFor(x, z) {
  return `${Math.round(x * 4)}:${Math.round(z * 4)}`;
}

function edgeLength(edge) {
  return Math.hypot(edge.road.x2 - edge.road.x1, edge.road.z2 - edge.road.z1);
}

function nearestNode(nodes, x, z) {
  let nearest = nodes[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const distance = (node.x - x) ** 2 + (node.z - z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = node;
    }
  }
  return nearest;
}

function buildRouteGraph(roads, intersections) {
  const nodeMap = new Map();
  const nodes = [];
  const addNode = (x, z) => {
    const key = keyFor(x, z);
    let node = nodeMap.get(key);
    if (!node) {
      node = { id: key, x, z, edges: [] };
      nodeMap.set(key, node);
      nodes.push(node);
    }
    return node;
  };

  const marked = intersections.map((point) => addNode(point.x, point.z));
  const isMarked = (node) => intersections.some((point) => Math.hypot(point.x - node.x, point.z - node.z) < 2);
  for (const road of roads) {
    let from = addNode(road.x1, road.z1);
    let to = addNode(road.x2, road.z2);
    if (!isMarked(from)) {
      from = nearestNode(marked.length ? marked : nodes, road.x1, road.z);
    }
    if (!isMarked(to)) {
      to = nearestNode(marked.length ? marked : nodes, road.x2, road.z);
    }
    if (from === to) continue;
    const forward = { from, to, road, length: edgeLength({ road }), next: null };
    const reverse = { from: to, to: from, road, reverse: true, length: forward.length, next: null };
    forward.reverseEdge = reverse;
    reverse.reverseEdge = forward;
    from.edges.push(forward);
    to.edges.push(reverse);
  }

  for (const node of nodes) {
    let current = node.edges[0] ?? null;
    for (const edge of node.edges) {
      edge.next = current;
    }
  }
  return { nodes, nodeMap };
}

function chooseEdge(node, rejected, random) {
  if (!node?.edges.length) return null;
  const index = Math.floor(random() * node.edges.length);
  const edge = node.edges[index];
  if (edge === rejected && node.edges.length > 1) {
    return node.edges[(index + 1) % node.edges.length];
  }
  return edge;
}

function laneHeading(edge) {
  const road = edge.road;
  return edge.reverse ? Math.atan2(road.x1 - road.x2, road.z1 - road.z2) : Math.atan2(road.x2 - road.x1, road.z2 - road.z1);
}

function pointOnLane(edge, distance) {
  const road = edge.road;
  const dx = road.x2 - road.x1;
  const dz = road.z2 - road.z1;
  const length = Math.hypot(dx, dz) || 1;
  const travel = edge.reverse ? edge.length - distance : distance;
  const px = road.x1 + (dx * travel) / length;
  const pz = road.z1 + (dz * travel) / length;
  const side = edge.reverse ? 1 : -1;
  return {
    x: px + side * (dz / length) * LANE_OFFSET,
    z: pz - side * (dx / length) * LANE_OFFSET,
    heading: laneHeading(edge),
  };
}

function isAhead(car, x, z, heading, distance) {
  const dx = x - car.position.x;
  const dz = z - car.position.z;
  return Math.hypot(dx, dz) < distance && dx * Math.sin(heading) + dz * Math.cos(heading) > -0.4;
}

function obstacleDistance(agent, vehicles, playerState, pedestrians) {
  const heading = agent.heading;
  const range = 7 + Math.abs(agent.car.speed) * 0.55;
  const halfWidth = Math.max(1.25, agent.car.halfWidth + 0.55);
  let nearest = range;
  for (let index = 0; index < vehicles.length; index += 1) {
    const other = vehicles[index];
    if (other === agent.car) continue;
    const dx = other.position.x - agent.car.position.x;
    const dz = other.position.z - agent.car.position.z;
    const forward = dx * Math.sin(heading) + dz * Math.cos(heading);
    const lateral = dx * Math.cos(heading) - dz * Math.sin(heading);
    if (forward > -1 && forward < nearest && Math.abs(lateral) < halfWidth + other.halfWidth) {
      nearest = Math.max(0, forward - other.halfLength - agent.car.halfLength);
    }
  }

  const playerPosition = playerState.mode === 'car' ? playerState.car?.position : playerState.position;
  if (playerPosition) {
    const dx = playerPosition.x - agent.car.position.x;
    const dz = playerPosition.z - agent.car.position.z;
    const forward = dx * Math.sin(heading) + dz * Math.cos(heading);
    const lateral = dx * Math.cos(heading) - dz * Math.sin(heading);
    const radius = playerState.mode === 'car' ? 1.7 : 0.65;
    if (forward > -0.7 && forward < nearest && Math.abs(lateral) < halfWidth + radius) {
      nearest = Math.max(0, forward - agent.car.halfLength);
    }
  }

  for (let index = 0; index < pedestrians?.agents.length; index += 1) {
    const ped = pedestrians.agents[index];
    if (ped.down) continue;
    const dx = ped.position.x - agent.car.position.x;
    const dz = ped.position.z - agent.car.position.z;
    const forward = dx * Math.sin(heading) + dz * Math.cos(heading);
    const lateral = dx * Math.cos(heading) - dz * Math.sin(heading);
    if (forward > -0.4 && forward < nearest && Math.abs(lateral) < halfWidth + 0.45) {
      nearest = Math.max(0, forward - agent.car.halfLength - 0.35);
    }
  }
  return nearest;
}

function configureAgent(agent, edge, distance, speed) {
  const point = pointOnLane(edge, THREE.MathUtils.clamp(distance, 2, edge.length - 2));
  agent.edge = edge;
  agent.distance = THREE.MathUtils.clamp(distance, 2, edge.length - 2);
  agent.targetSpeed = speed;
  agent.stopTimer = 0;
  agent.car.position.set(point.x, agent.car.position.y, point.z);
  agent.car.heading = point.heading;
  agent.car.speed = speed;
  agent.car.lateralSpeed = 0;
  agent.car.damage = 0;
  agent.car.driver = 'traffic';
  agent.car.parked = false;
  agent.car.mesh.visible = true;
}

export function spawnAgent(traffic, focus) {
  const edge = chooseEdge(traffic.graph.nodes[Math.floor(traffic.random() * traffic.graph.nodes.length)], null, traffic.random);
  if (!edge) return;
  const point = pointOnLane(edge, edge.length * 0.5);
  if (Math.hypot(point.x - focus.x, point.z - focus.z) > SPAWN_RADIUS) return;
  let agent = traffic.retired.pop();
  if (!agent) {
    if (traffic.agents.length >= ACTIVE_CARS) return;
    const kind = CAR_KINDS[Math.floor(traffic.random() * (CAR_KINDS.length - 1))];
    const color = PAINTS[traffic.random() * PAINTS.length | 0];
    const car = createCar(kind, color, point, point.heading);
    traffic.scene.add(car.mesh);
    traffic.cars.push(car);
    agent = { car, edge, distance: edge.length * 0.5, targetSpeed: 15, stopTimer: 0 };
    traffic.agents.push(agent);
  }
  configureAgent(agent, edge, edge.length * (0.15 + traffic.random() * 0.7), TRAFFIC_SPEEDS[traffic.random() * TRAFFIC_SPEEDS.length | 0]);
}

export function createTraffic(world) {
  const graph = buildRouteGraph(world?.roads ?? [], world?.intersections ?? []);
  const traffic = {
    graph,
    scene: world?.scene,
    cars: [],
    agents: [],
    retired: [],
    random: makeRandom(91101),
  };
  return traffic;
}

export function updateTraffic(traffic, dt, playerState, pedestrians = null) {
  if (!traffic || !playerState) return;
  const focus = playerState.mode === 'car' ? playerState.car?.position : playerState.position;
  if (!focus) return;
  let attempts = 0;
  while (traffic.agents.length < ACTIVE_CARS && attempts < 90) {
    attempts += 1;
    const before = traffic.agents.length + traffic.retired.length;
    spawnAgent(traffic, focus);
    if (before === traffic.agents.length + traffic.retired.length) {
      traffic.random();
      if (attempts > 30) break;
    }
  }

  for (let index = traffic.agents.length - 1; index >= 0; index -= 1) {
    const agent = traffic.agents[index];
    const car = agent.car;
    if (car.driver !== 'traffic' || car.damage >= 70) {
      car.driver = null;
      car.parked = car.damage >= 70;
      traffic.agents.splice(index, 1);
      if (car.damage < 70) traffic.retired.push(agent);
      continue;
    }

    if (Math.hypot(car.position.x - focus.x, car.position.z - focus.z) > DESPAWN_RADIUS) {
      car.mesh.visible = false;
      traffic.agents.splice(index, 1);
      traffic.retired.push(agent);
      continue;
    }

    if (agent.stopTimer > 0) agent.stopTimer -= dt;
    const remaining = agent.edge.length - agent.distance;
    const obstacle = obstacleDistance(agent, traffic.cars, playerState, pedestrians);
    const nearIntersection = remaining < 7 && agent.edge.to.edges.length > 2;
    let throttle = 0.35;
    if (agent.stopTimer > 0 || obstacle < 3.2 || (nearIntersection && remaining < 4.5 && agent.edge.stop !== false && agent.distance % 37 < 10)) {
      throttle = obstacle < 1.4 ? -0.75 : -0.18;
      if (obstacle < 1.1) car.speed *= 0.55;
    } else {
      const difference = agent.targetSpeed - car.speed;
      throttle = THREE.MathUtils.clamp(difference * 0.25 + (remaining < 15 ? -0.08 : 0.04), -0.3, 0.75);
    }

    const laneTarget = pointOnLane(agent.edge, Math.min(agent.distance + 4, agent.edge.length));
    const targetHeading = Math.atan2(laneTarget.x - car.position.x, laneTarget.z - car.position.z);
    let headingError = targetHeading - car.heading;
    if (headingError > Math.PI) headingError -= Math.PI * 2;
    if (headingError < -Math.PI) headingError += Math.PI * 2;
    const steer = THREE.MathUtils.clamp(headingError * 2.3, -1, 1);
    updateCar(car, { throttle, steer, brake: obstacle < 1.2 }, dt, traffic.colliders ?? []);

    const lane = pointOnLane(agent.edge, Math.min(agent.distance, agent.edge.length));
    const towardLaneX = lane.x - car.position.x;
    const towardLaneZ = lane.z - car.position.z;
    const laneDistance = Math.hypot(towardLaneX, towardLaneZ) || 1;
    agent.distance += Math.max(0, (car.speed * Math.sin(car.heading) * towardLaneX + car.speed * Math.cos(car.heading) * towardLaneZ) / laneDistance * dt);
    if (agent.distance >= agent.edge.length) {
      const previous = agent.edge;
      const next = chooseEdge(agent.edge.to, previous.reverseEdge, traffic.random);
      if (!next) {
        car.mesh.visible = false;
        traffic.agents.splice(index, 1);
        traffic.retired.push(agent);
        continue;
      }
      if (agent.edge.to.edges.length > 2 && traffic.random() < 0.22) agent.stopTimer = 0.7 + traffic.random() * 1.1;
      agent.distance = 0;
      agent.edge = next;
      agent.targetSpeed = TRAFFIC_SPEEDS[traffic.random() * TRAFFIC_SPEEDS.length | 0];
    }
  }
}
