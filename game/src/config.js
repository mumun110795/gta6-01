export const WORLD = Object.freeze({
  islandSize: 1400,
  halfIsland: 700,
  oceanLevel: 0,
  roadY: 0.08,
  sceneScale: 1,
});

export const ROAD_LAYOUT = Object.freeze({
  coastRing: Object.freeze({
    radiusX: 550,
    radiusZ: 590,
    corners: 18,
    width: 11,
  }),
  city: Object.freeze({
    minX: 95,
    maxX: 505,
    minZ: 125,
    maxZ: 485,
    avenueSpacing: 90,
    avenueWidth: 12,
    streetSpacing: 78,
    streetWidth: 8,
  }),
  coastConnectors: Object.freeze([
    Object.freeze({ x1: -162, z1: 130, x2: 160, z2: 145, width: 10 }),
    Object.freeze({ x1: -85, z1: -45, x2: 100, z2: 250, width: 10 }),
    Object.freeze({ x1: -520, z1: -15, x2: -100, z2: 10, width: 10 }),
    Object.freeze({ x1: -70, z1: -540, x2: -75, z2: 45, width: 10 }),
    Object.freeze({ x1: 440, z1: 55, x2: 455, z2: 390, width: 9 }),
  ]),
  harbor: Object.freeze({
    center: Object.freeze({ x: -420, z: 435 }),
    roadWidth: 10,
  }),
  causeway: Object.freeze({
    islandEnd: Object.freeze({ x: -575, z: -115 }),
    cayEnd: Object.freeze({ x: -780, z: -150 }),
    width: 12,
  }),
  suburb: Object.freeze({
    center: Object.freeze({ x: -265, z: -225 }),
    radius: 190,
    width: 8,
  }),
  volcano: Object.freeze({
    center: Object.freeze({ x: 45, z: -415 }),
    roadRadius: 265,
    width: 9,
  }),
});

export const DISTRICTS = Object.freeze([
  Object.freeze({ id: 'downtown', name: 'Centro Sur', minX: 95, maxX: 505, minZ: 125, maxZ: 485, color: 0xffb347 }),
  Object.freeze({ id: 'harbor', name: 'Puerto Caldra', minX: -575, maxX: -265, minZ: 300, maxZ: 590, color: 0x63b3ff }),
  Object.freeze({ id: 'neon', name: 'Cayo Brasa', minX: -860, maxX: -700, minZ: -230, maxZ: -70, color: 0xff4fa3 }),
  Object.freeze({ id: 'beach', name: 'Playa Vidrio', minX: 445, maxX: 610, minZ: -180, maxZ: 320, color: 0xffd166 }),
  Object.freeze({ id: 'suburbs', name: 'Lomas Dulces', minX: -455, maxX: -75, minZ: -415, maxZ: -35, color: 0x8ce99a }),
  Object.freeze({ id: 'volcano', name: 'Mount Escoria', minX: -225, maxX: 315, minZ: -660, maxZ: -165, color: 0xff6b6b }),
]);

export const SPAWN_POINTS = Object.freeze({
  playerStart: Object.freeze({ x: 155, z: 260, heading: Math.PI * 0.75 }),
  clinic: Object.freeze({ x: 360, z: 390, heading: Math.PI }),
  hospital: Object.freeze({ x: 360, z: 390, heading: Math.PI }),
  harborCafe: Object.freeze({ x: -385, z: 405, heading: Math.PI * 0.82 }),
  pier: Object.freeze({ x: -463, z: 478, heading: -0.35 }),
  warehouse: Object.freeze({ x: -345, z: 415, heading: 0.45 }),
  centroGarage: Object.freeze({ x: 300, z: 355, heading: Math.PI }),
  neonClub: Object.freeze({ x: -781, z: -158, heading: 0.12 }),
  northCove: Object.freeze({ x: -185, z: -570, heading: Math.PI }),
  bank: Object.freeze({ x: 320, z: 300, heading: Math.PI }),
  chopShop: Object.freeze({ x: -430, z: 360, heading: 0.35 }),
  carLot: Object.freeze({ x: 435, z: 270, heading: -1.5 }),
  ferryDock: Object.freeze({ x: 385, z: 540, heading: Math.PI }),
});

export const PALETTE = Object.freeze({
  sand: 0xd9c08a,
  grass: 0x4f8a57,
  rock: 0x6c665f,
  volcanicRock: 0x3c3336,
  asphalt: 0x22252a,
  roadLine: 0xffd08a,
  concrete: 0x9a9da3,
  concreteWarm: 0xb0a598,
  glassDay: 0x89aebd,
  glassNight: 0xffd48a,
  water: 0x1b5f78,
  trunk: 0x77503b,
  frond: 0x3f8f4b,
  lamp: 0xffcf7a,
  police: 0x2d62d9,
  accent: 0xffb347,
});

export const GAMEPLAY = Object.freeze({
  player: Object.freeze({
    walkSpeed: 4.4,
    runSpeed: 7.8,
    turnSpeed: 3.4,
    maxHealth: 100,
    pickupRadius: 2.8,
  }),
  vehicle: Object.freeze({
    maxEngineForce: 15.5,
    maxSpeedKmh: 168,
    grip: 6.2,
    drag: 0.58,
    enterRadius: 4.1,
  }),
  combat: Object.freeze({
    pistolDamage: 18,
    rifleDamage: 29,
    fireInterval: 0.24,
    range: 185,
  }),
  wanted: Object.freeze([
    Object.freeze({ id: 1, threshold: 25, label: 'Reported', heatPerMinute: 3 }),
    Object.freeze({ id: 2, threshold: 70, label: 'Patrol pursuit', heatPerMinute: 5 }),
    Object.freeze({ id: 3, threshold: 130, label: 'Road units dispatched', heatPerMinute: 7 }),
    Object.freeze({ id: 4, threshold: 210, label: 'Tactical response', heatPerMinute: 9 }),
    Object.freeze({ id: 5, threshold: 320, label: 'Island lockdown', heatPerMinute: 12 }),
  ]),
  police: Object.freeze({
    carSpeed: 39,
    motorcycleSpeed: 46,
    helicopterAltitude: 96,
    bustDistance: 4.5,
  }),
  economy: Object.freeze({
    startingCash: 275,
    carTheftReward: 55,
    missionBonus: 145,
  }),
  missions: Object.freeze([
    Object.freeze({ id: 'salt-debt', name: 'Salt Debt', reward: 275, location: 'pier' }),
    Object.freeze({ id: 'iron-run', name: 'Iron Run', reward: 350, location: 'warehouse' }),
    Object.freeze({ id: 'pink-ledger', name: 'Pink Ledger', reward: 425, location: 'neonClub' }),
    Object.freeze({ id: 'clean-money', name: 'Clean Money', reward: 500, location: 'bank' }),
    Object.freeze({ id: 'hot-stock', name: 'Hot Stock', reward: 600, location: 'carLot' }),
    Object.freeze({ id: 'last-ferry', name: 'Last Ferry', reward: 725, location: 'ferryDock' }),
    Object.freeze({ id: 'ash-summit', name: 'Ash Summit', reward: 1000, location: 'hospital' }),
  ]),
  time: Object.freeze({
    startingHour: 9.5,
    dayLengthMinutes: 22,
    nightWindow: 0.22,
  }),
});
