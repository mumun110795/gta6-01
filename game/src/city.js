import * as THREE from 'three';
import { ROAD_LAYOUT, WORLD, PALETTE, DISTRICTS } from './config.js';

export const ROADS = [];
export const INTERSECTIONS = [];
export const CITY_NIGHT_MATERIALS = [];

const roadMaterial = new THREE.MeshStandardMaterial({
  color: PALETTE.asphalt,
  roughness: 0.86,
  metalness: 0.04,
});

const railMaterial = new THREE.MeshStandardMaterial({
  color: 0xb8bdc4,
  roughness: 0.36,
  metalness: 0.7,
});

function addRoad(x1, z1, x2, z2, width, parent = null) {
  const segment = { x1, z1, x2, z2, width };
  ROADS.push(segment);
  const length = Math.hypot(x2 - x1, z2 - z1);
  const angle = Math.atan2(z2 - z1, x2 - x1);
  const geometry = new THREE.BoxGeometry(length, 0.12, width, 1, 1, 1);
  const mesh = new THREE.Mesh(geometry, roadMaterial);
  mesh.position.set((x1 + x2) / 2, WORLD.roadY - 0.03, (z1 + z2) / 2);
  mesh.rotation.y = -angle;
  mesh.receiveShadow = true;
  (parent ?? sceneForRoads).add(mesh);
  return segment;
}

function addAABB(object, padding = 0) {
  const box = new THREE.Box3().setFromObject(object);
  collidersForCity.push({
    minX: box.min.x - padding,
    maxX: box.max.x + padding,
    minZ: box.min.z - padding,
    maxZ: box.max.z + padding,
  });
}

function makeTerrain() {
  const geometry = new THREE.CircleGeometry(690, 128);
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE.grass,
    roughness: 0.96,
    metalness: 0,
  });
  const island = new THREE.Mesh(geometry, material);
  island.rotation.x = -Math.PI / 2;
  island.receiveShadow = true;

  const sand = new THREE.Mesh(
    new THREE.RingGeometry(630, 705, 128),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.92 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.02;
  sand.receiveShadow = true;

  const rock = new THREE.Mesh(
    new THREE.CircleGeometry(615, 96),
    new THREE.MeshStandardMaterial({ color: PALETTE.rock, roughness: 0.98 }),
  );
  rock.rotation.x = -Math.PI / 2;
  rock.position.y = 0.01;

  const northern = new THREE.Mesh(
    new THREE.CircleGeometry(410, 80, Math.PI, Math.PI),
    new THREE.MeshStandardMaterial({ color: PALETTE.volcanicRock, roughness: 0.98 }),
  );
  northern.rotation.x = -Math.PI / 2;
  northern.position.set(0, 0.03, -220);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(238, 210, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: PALETTE.volcanicRock, roughness: 0.94, flatShading: true }),
  );
  cone.position.set(ROAD_LAYOUT.volcano.center.x, 85, ROAD_LAYOUT.volcano.center.z);
  cone.castShadow = true;
  cone.receiveShadow = true;

  const crater = new THREE.Mesh(
    new THREE.CylinderGeometry(54, 78, 30, 16, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x222020,
      emissive: 0xb33a20,
      emissiveIntensity: 0.8,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  crater.position.set(ROAD_LAYOUT.volcano.center.x, 184, ROAD_LAYOUT.volcano.center.z);
  crater.material.userData.baseGlow = 0.7;
  CITY_NIGHT_MATERIALS.push(crater.material);

  return [island, sand, rock, northern, cone, crater];
}

function makeCoastRing() {
  const { radiusX, radiusZ, corners, width } = ROAD_LAYOUT.coastRing;
  for (let index = 0; index < corners; index += 1) {
    const angle = (index / corners) * Math.PI * 2;
    const nextAngle = ((index + 1) / corners) * Math.PI * 2;
    addRoad(
      Math.cos(angle) * radiusX,
      Math.sin(angle) * radiusZ,
      Math.cos(nextAngle) * radiusX,
      Math.sin(nextAngle) * radiusZ,
      width,
    );
  }
}

function makeCityGrid() {
  const { minX, maxX, minZ, maxZ, avenueSpacing, avenueWidth, streetSpacing, streetWidth } = ROAD_LAYOUT.city;
  for (let x = minX; x <= maxX + 0.1; x += avenueSpacing) {
    addRoad(x, minZ, x, maxZ, avenueWidth);
    INTERSECTIONS.push({ x, z: minZ }, { x, z: maxZ });
  }
  for (let z = minZ; z <= maxZ + 0.1; z += streetSpacing) {
    addRoad(minX, z, maxX, z, streetWidth);
    INTERSECTIONS.push({ x: minX, z }, { x: maxX, z });
  }
}

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#a7b3bc';
  context.fillRect(0, 0, 128, 128);
  const foreground = document.createElement('canvas');
  foreground.width = 128;
  foreground.height = 128;
  const foregroundContext = foreground.getContext('2d');
  foregroundContext.fillStyle = '#000000';
  foregroundContext.fillRect(0, 0, 128, 128);
  for (let y = 5; y < 121; y += 14) {
    for (let x = 6; x < 122; x += 13) {
      const bright = Math.random() > 0.42;
      context.fillStyle = bright ? '#cfe1e7' : '#616b74';
      context.fillRect(x, y, 8, 9);
      foregroundContext.fillStyle = bright ? '#ffd18a' : '#131719';
      foregroundContext.fillRect(x, y, 8, 9);
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  const emissiveMap = new THREE.CanvasTexture(foreground);
  map.wrapS = map.wrapT = emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  return { map, emissiveMap };
}

function makeBuildings(scene) {
  const { minX, maxX, minZ, maxZ } = ROAD_LAYOUT.city;
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const plainMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.72 });
  const warmMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.concreteWarm, roughness: 0.78 });
  const facadeColors = [
    0xff6b6b, 0x20c997, 0xffd43b, 0x4dabf7, 0xf783ac, 0x63e6be,
    0xff922b, 0x9775fa, 0x51cf66, 0xff8787, 0x3bc9db, 0xfcc419,
    0xff7b9c, 0x74c0fc, 0xa9e34b, 0xffa94d,
  ];
  const facadeMaterials = facadeColors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.62 }));
  const { map, emissiveMap } = makeWindowTexture();
  const towerMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8f1f5,
    map,
    emissive: 0xffd48a,
    emissiveMap,
    emissiveIntensity: 0,
    roughness: 0.55,
    metalness: 0.08,
  });
  CITY_NIGHT_MATERIALS.push(towerMaterial);

  for (let x = minX + 24; x < maxX - 24; x += 48) {
    for (let z = minZ + 24; z < maxZ - 24; z += 44) {
      const distanceDowntown = 1 - Math.hypot(x - 300, z - 300) / 300;
      const depth = 19 + Math.random() * 10;
      const width = 24 + Math.random() * 10;
      const height = 12 + Math.max(0, distanceDowntown) * 112 + Math.random() * 24;
      const roll = Math.random();
      const material = roll > 0.86
        ? towerMaterial
        : roll > 0.76
          ? (Math.random() > 0.5 ? plainMaterial : warmMaterial)
          : facadeMaterials[Math.floor(Math.random() * facadeMaterials.length)];
      const building = new THREE.Mesh(boxGeometry, material);
      building.scale.set(width, height, depth);
      building.position.set(x + 16, height / 2, z + 14);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
      addAABB(building, 0.5);
    }
  }

  const downtown = DISTRICTS.find((district) => district.id === 'downtown');
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 18, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffb347,
      emissive: 0xffb347,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85,
    }),
  );
  beacon.position.set((downtown.minX + downtown.maxX) / 2, 145, (downtown.minZ + downtown.maxZ) / 2);
  scene.add(beacon);
}

function makeTree(scene, x, z, trunkGeometry, frondGeometry, trunkMaterial, frondMaterial) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 5;
  trunk.castShadow = true;
  group.add(trunk);
  for (let index = 0; index < 5; index += 1) {
    const frond = new THREE.Mesh(frondGeometry, frondMaterial);
    frond.position.y = 10;
    frond.rotation.z = 0.45;
    frond.rotation.y = (index / 5) * Math.PI * 2;
    frond.castShadow = true;
    group.add(frond);
  }
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

function makeVegetation(scene) {
  const trunkGeometry = new THREE.CylinderGeometry(0.25, 0.48, 10, 7);
  const frondGeometry = new THREE.PlaneGeometry(9, 1.8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 0.88 });
  const frondMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.frond,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  let placed = 0;
  let seed = 42;
  while (placed < 210) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const x = ((seed / 4294967296) * 1280) - 640;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const z = ((seed / 4294967296) * 1280) - 640;
    if (Math.hypot(x / 550, z / 590) > 1.02) continue;
    if (x > 70 && x < 520 && z > 100 && z < 510) continue;
    if (Math.hypot(x - ROAD_LAYOUT.volcano.center.x, z - ROAD_LAYOUT.volcano.center.z) < 240) continue;
    makeTree(scene, x, z, trunkGeometry, frondGeometry, trunkMaterial, frondMaterial);
    placed += 1;
  }
}

function makeStreetLights(scene) {
  const poleGeometry = new THREE.CylinderGeometry(0.16, 0.24, 8, 6);
  const lampGeometry = new THREE.SphereGeometry(0.42, 8, 6);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x485058, roughness: 0.5, metalness: 0.5 });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0x777777,
    emissive: PALETTE.lamp,
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  CITY_NIGHT_MATERIALS.push(lampMaterial);
  const spacing = 140;
  for (let index = 0; index < ROADS.length; index += 5) {
    const road = ROADS[index];
    if (Math.hypot(road.x2 - road.x1, road.z2 - road.z1) < spacing) continue;
    for (const point of [{ x: road.x1, z: road.z1 }, { x: road.x2, z: road.z2 }]) {
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(point.x + road.width / 2 + 0.6, 4, point.z + road.width / 2 + 0.6);
      pole.castShadow = true;
      const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
      lamp.position.set(point.x + road.width / 2 + 0.6, 8, point.z + road.width / 2 + 0.6);
      scene.add(pole, lamp);
    }
  }
}

function makeNeonSign(scene, x, y, z, rotationY, text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#08040a';
  context.fillRect(0, 0, 512, 128);
  context.font = 'bold 66px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = color;
  context.shadowBlur = 30;
  context.fillStyle = color;
  context.fillText(text, 256, 68);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    opacity: 0.95,
  });
  material.userData.isNeon = true;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), material);
  sign.position.set(x, y, z);
  sign.rotation.y = rotationY;
  scene.add(sign);
  CITY_NIGHT_MATERIALS.push(material);
}

function makeContainer(scene, x, z, rotation, color, level = 0) {
  const container = new THREE.Mesh(
    new THREE.BoxGeometry(12, 2.8, 2.6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 }),
  );
  container.position.set(x, 1.4 + level * 2.85, z);
  container.rotation.y = rotation;
  container.castShadow = true;
  container.receiveShadow = true;
  scene.add(container);
  if (level === 0) addAABB(container, 0.3);
  return container;
}

function makeCrane(scene, x, z, rotation, color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.35 });
  const legGeometry = new THREE.BoxGeometry(0.9, 21, 0.9);
  for (const side of [-6, 6]) {
    const leg = new THREE.Mesh(legGeometry, paint);
    leg.position.set(side, 10.5, 0);
    leg.castShadow = true;
    group.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(15, 1.4, 1.4), paint);
  beam.position.y = 21;
  beam.castShadow = true;
  group.add(beam);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 19), paint);
  jib.position.set(0, 20.4, 4);
  jib.castShadow = true;
  group.add(jib);
  const cable = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 9, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.6 }),
  );
  cable.position.set(0, 15.5, 10);
  group.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), paint);
  hook.position.set(0, 10.6, 10);
  group.add(hook);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
  addAABB(group, 0.3);
}

function makeBoat(scene, x, z, rotation, hullColor) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.4, 10.5),
    new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.4, metalness: 0.2 }),
  );
  hull.position.y = 0.35;
  hull.castShadow = true;
  group.add(hull);
  const bow = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.1, 2.6),
    new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.4, metalness: 0.2 }),
  );
  bow.position.set(0, 0.4, 6.2);
  group.add(bow);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 1.5, 2.8),
    new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.35 }),
  );
  cabin.position.set(0, 1.7, -1.2);
  cabin.castShadow = true;
  group.add(cabin);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 6.5, 6),
    new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.4, metalness: 0.6 }),
  );
  mast.position.set(0, 4.4, 1.8);
  group.add(mast);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

function makeHarbor(scene) {
  const { center } = ROAD_LAYOUT.harbor;
  addRoad(center.x - 105, center.z - 20, center.x + 125, center.z - 20, ROAD_LAYOUT.harbor.roadWidth, scene);
  addRoad(center.x - 20, center.z - 80, center.x - 20, center.z + 115, ROAD_LAYOUT.harbor.roadWidth, scene);
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x8f9aa3, roughness: 0.8 });
  const deckGeometry = new THREE.BoxGeometry(14, 2, 105);
  for (const [x, z, rotation] of [[-510, 505, 0], [-466, 522, 0], [-380, 505, 0.15]]) {
    const deck = new THREE.Mesh(deckGeometry, deckMaterial);
    deck.position.set(x, 1, z);
    deck.rotation.y = rotation;
    deck.receiveShadow = true;
    scene.add(deck);
  }
  const crateGeometry = new THREE.BoxGeometry(4, 4, 4);
  const crateColors = [0xe63946, 0x1d9e75, 0xf4a261, 0x4361ee, 0xe9c46a, 0x9b5de5, 0x00b4d8, 0xef476f];
  for (let index = 0; index < 18; index += 1) {
    const crate = new THREE.Mesh(crateGeometry, new THREE.MeshStandardMaterial({ color: crateColors[index % crateColors.length], roughness: 0.75 }));
    crate.position.set(center.x - 90 + (index % 6) * 18, 2, center.z + 65 + Math.floor(index / 6) * 12);
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
    addAABB(crate);
  }
  const containerStacks = [
    [-492, 478, 0.3, 0xe63946, 0], [-492, 478, 0.3, 0x4361ee, 1], [-479, 482, 0.3, 0x2a9d8f, 0],
    [-458, 492, -0.2, 0x1d9e75, 0], [-458, 492, -0.2, 0xf4a261, 1], [-445, 488, -0.2, 0xe9c46a, 0],
    [-425, 470, 0.5, 0xe9c46a, 0], [-425, 470, 0.5, 0xe63946, 1],
    [-482, 452, 0.9, 0x00b4d8, 0], [-505, 462, 0.15, 0xef476f, 0],
  ];
  for (const [x, z, rotation, color, level] of containerStacks) makeContainer(scene, x, z, rotation, color, level);
  makeCrane(scene, -478, 502, 0.4, 0xff7b00);
  makeCrane(scene, -436, 514, -0.3, 0xffc300);
  makeBoat(scene, -520, 560, 0.5, 0xe63946);
  makeBoat(scene, -498, 584, -0.35, 0x00b4d8);
  makeBoat(scene, -592, 516, 1.1, 0xffc300);
  makeBoat(scene, -442, 592, 0.9, 0xef476f);
  makeBoat(scene, -472, 618, -0.6, 0x2a9d8f);
  const warehouse = new THREE.Mesh(
    new THREE.BoxGeometry(86, 28, 50),
    new THREE.MeshStandardMaterial({ color: 0x2f6f9f, roughness: 0.7 }),
  );
  warehouse.position.set(-345, 14, 415);
  warehouse.castShadow = true;
  warehouse.receiveShadow = true;
  scene.add(warehouse);
  addAABB(warehouse);
}

function makeCauseway(scene) {
  const { islandEnd, cayEnd, width } = ROAD_LAYOUT.causeway;
  const start = { x: islandEnd.x, z: islandEnd.z };
  const end = { x: cayEnd.x, z: cayEnd.z };
  const deckLength = Math.hypot(end.x - start.x, end.z - start.z) + 40;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(deckLength, 1.8, width + 4),
    new THREE.MeshStandardMaterial({ color: 0x707879, roughness: 0.85 }),
  );
  deck.position.set((start.x + end.x) / 2 - 15, 0.9, (start.z + end.z) / 2);
  deck.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
  deck.receiveShadow = true;
  scene.add(deck);
  addRoad(start.x - 20, start.z, end.x + 20, end.z, width, scene);
  const railGeometry = new THREE.BoxGeometry(deckLength, 1.2, 0.45);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.position.copy(deck.position);
    rail.position.y += 1.4;
    rail.position.x += Math.cos(deck.rotation.y) * side * (width / 2 + 1.2);
    rail.position.z -= Math.sin(deck.rotation.y) * side * (width / 2 + 1.2);
    rail.rotation.copy(deck.rotation);
    scene.add(rail);
  }
  const cay = new THREE.Mesh(
    new THREE.CircleGeometry(82, 64),
    new THREE.MeshStandardMaterial({ color: 0x554e5e, roughness: 0.95 }),
  );
  cay.rotation.x = -Math.PI / 2;
  cay.position.set(-780, 0.35, -150);
  scene.add(cay);
}

function makeNeonDistrict(scene) {
  const signs = [
    [-752, 16, -168, 0.2, 'CALIENTE', '#ff4fa3'],
    [-809, 19, -141, -0.18, 'MIRAGE 88', '#58d5ff'],
    [-780, 24, -119, Math.PI, 'TINDER PALM', '#ffb347'],
    [-818, 12, -184, 0.6, 'VOLTA CLUB', '#b78dff'],
  ];
  for (const [x, y, z, rotation, text, color] of signs) makeNeonSign(scene, x, y, z, rotation, text, color);
  const structureGeometry = new THREE.BoxGeometry(22, 24, 22);
  const structureMaterial = new THREE.MeshStandardMaterial({ color: 0x27242d, roughness: 0.68, metalness: 0.18 });
  for (const [x, z] of [[-752, -174], [-807, -134], [-779, -118], [-821, -188]]) {
    const structure = new THREE.Mesh(structureGeometry, structureMaterial);
    structure.position.set(x, 12, z);
    structure.castShadow = true;
    structure.receiveShadow = true;
    scene.add(structure);
    addAABB(structure);
  }
}

function makeOutlyingRoads() {
  for (const connector of ROAD_LAYOUT.coastConnectors) {
    addRoad(connector.x1, connector.z1, connector.x2, connector.z2, connector.width);
  }
  const suburb = ROAD_LAYOUT.suburb;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    addRoad(
      suburb.center.x + Math.cos(angle) * suburb.radius,
      suburb.center.z + Math.sin(angle) * suburb.radius,
      suburb.center.x + Math.cos(angle + Math.PI / 4) * suburb.radius,
      suburb.center.z + Math.sin(angle + Math.PI / 4) * suburb.radius,
      suburb.width,
    );
  }
  addRoad(suburb.center.x - suburb.radius, suburb.center.z, suburb.center.x + suburb.radius, suburb.center.z, suburb.width);
  addRoad(suburb.center.x, suburb.center.z - suburb.radius, suburb.center.x, suburb.center.z + suburb.radius, suburb.width);
  const volcano = ROAD_LAYOUT.volcano;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
    addRoad(
      volcano.center.x + Math.cos(angle) * volcano.roadRadius,
      volcano.center.z + Math.sin(angle) * volcano.roadRadius,
      volcano.center.x + Math.cos(angle + Math.PI / 3) * volcano.roadRadius,
      volcano.center.z + Math.sin(angle + Math.PI / 3) * volcano.roadRadius,
      volcano.width,
    );
  }
}

let sceneForRoads = null;
let collidersForCity = [];

export function buildCity(scene) {
  ROADS.length = 0;
  INTERSECTIONS.length = 0;
  collidersForCity = [];
  sceneForRoads = scene;
  scene.add(...makeTerrain());
  makeCoastRing();
  makeCityGrid();
  makeOutlyingRoads();
  makeBuildings(scene);
  makeHarbor(scene);
  makeCauseway(scene);
  makeNeonDistrict(scene);
  makeVegetation(scene);
  makeStreetLights(scene);
  return {
    roads: ROADS,
    intersections: INTERSECTIONS,
    colliders: collidersForCity,
    districtShapes: DISTRICTS,
    nightMaterials: CITY_NIGHT_MATERIALS,
  };
}
