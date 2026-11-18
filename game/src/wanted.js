import { GAMEPLAY } from './config.js';

const SIGHT_RANGE = 35;
const HEARD_CRIMES = new Set(['shotFired', 'enemyDown']);
const HEARD_RANGES = { shotFired: 85, enemyDown: 48 };
const CRIME_HEAT = {
  carTheft: 54,
  hitAndRun: 78,
  vehicleCollision: 9,
  shotFired: 31,
  enemyDown: 46,
  missionCrime: 105,
};

function segmentBlockedByBox(start, end, box) {
  const direction = { x: end.x - start.x, z: end.z - start.z };
  let near = 0;
  let far = 1;
  for (const axis of ['x', 'z']) {
    const origin = axis === 'x' ? start.x : start.z;
    const denominator = axis === 'x' ? direction.x : direction.z;
    const minimum = (box.minX - origin) / denominator;
    const maximum = (box.maxX - origin) / denominator;
    const low = Math.min(minimum, maximum);
    const high = Math.max(minimum, maximum);
    near = Math.max(near, low);
    far = Math.min(far, high);
    if (near > far) return true;
  }
  return false;
}

function clearLine(start, end, colliders = []) {
  for (const box of colliders) {
    if (segmentBlockedByBox(start, end, box)) return false;
  }
  return true;
}

function distance2(first, second) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    lastSeen: null,
    searchTimer: 0,
    searchDuration: 0,
    seenByPolice: false,
    searching: false,
    clearLineOfSight: clearLine,
    reportCrime(kind, position, context = {}) {
      const amount = CRIME_HEAT[kind] ?? 0;
      if (!amount || !position) return false;
      if (HEARD_CRIMES.has(kind)) {
        const radius = HEARD_RANGES[kind] ?? HEARD_RANGES.shotFired;
        const heard = witnessPositions(context).some((witness) => distance2(witness, position) <= radius);
        if (!heard) return false;
      } else if (!hasWitness(kind, position, context)) {
        return false;
      }
      this.heat = Math.min(400, this.heat + amount);
      this.lastSeen = { x: position.x, z: position.z };
      this.searchDuration = searchTimeFor(this.heat);
      this.searchTimer = this.searchDuration;
      return true;
    },
  };
}

function witnessPositions(context = {}) {
  const witnesses = [
    ...(context.pedestrians?.agents ?? []),
    ...(context.traffic?.agents ?? []).map((agent) => agent.car?.position).filter(Boolean),
    ...(context.policeUnits ?? []),
  ];
  return witnesses.map((witness) => witness.position ?? witness).filter((witness) => Number.isFinite(witness.x));
}

function hasWitness(kind, position, context = {}) {
  const witnesses = witnessPositions(context);
  for (const witness of witnesses) {
    const witnessDistance = distance2(witness, position);
    if (witnessDistance > SIGHT_RANGE) continue;
    if (kind === 'carTheft' && !witness.isPolice && !context.pedestrians?.agents?.includes(witness)) continue;
    if (!clearLine(position, witness, context.colliders ?? [])) continue;
    return true;
  }
  return false;
}

function starsForHeat(heat) {
  let stars = 0;
  for (const level of GAMEPLAY.wanted) {
    if (heat >= level.threshold) stars = level.id;
  }
  return stars;
}

function searchTimeFor(heat) {
  return 8 + starsForHeat(heat) * 3.5;
}

export function updateWanted(wanted, dt, context = {}) {
  const playerPosition = context.playerPosition;
  if (!wanted || !playerPosition) return wanted;
  const units = context.policeUnits ?? [];
  wanted.seenByPolice = units.some((unit) => {
    const position = unit.position ?? unit;
    return distance2(position, playerPosition) <= 55 && clearLine(position, playerPosition, context.colliders ?? []);
  });

  wanted.stars = starsForHeat(wanted.heat);
  if (wanted.seenByPolice) {
    wanted.lastSeen = { x: playerPosition.x, z: playerPosition.z };
    wanted.searchDuration = searchTimeFor(wanted.heat);
    wanted.searchTimer = wanted.searchDuration;
    wanted.searching = wanted.stars > 0;
    return wanted;
  }

  if (wanted.stars === 0) {
    wanted.searching = false;
    wanted.searchTimer = 0;
    wanted.heat = Math.max(0, wanted.heat - 18 * dt);
    return wanted;
  }

  if (wanted.searchTimer > 0) wanted.searchTimer = Math.max(0, wanted.searchTimer - dt);
  wanted.searching = wanted.searchTimer > 0 || Boolean(wanted.lastSeen);
  if (wanted.searchTimer === 0) {
    const previousStars = wanted.stars;
    wanted.heat = Math.max(0, wanted.heat - (34 + wanted.stars * 9) * dt);
    wanted.stars = starsForHeat(wanted.heat);
    if (wanted.stars < previousStars) {
      wanted.searchDuration = searchTimeFor(wanted.heat);
      wanted.searchTimer = wanted.searchDuration;
      if (wanted.stars === 0) wanted.lastSeen = null;
    }
  }
  return wanted;
}
