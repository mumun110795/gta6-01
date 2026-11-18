import { SPAWN_POINTS } from './config.js';

const RADIUS = {
  foot: 4.5,
  vehicle: 7.5,
};

function at(point, heading = 0) {
  return { ...point, heading };
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function playerTransform(gameState) {
  if (gameState?.player?.mode === 'car' && gameState.player.car) {
    return {
      position: gameState.player.car.position,
      heading: gameState.player.car.heading,
      inCar: true,
      car: gameState.player.car,
    };
  }
  return {
    position: gameState?.player?.position ?? { x: 0, z: 0 },
    heading: gameState?.player?.heading ?? 0,
    inCar: false,
    car: null,
  };
}

const MISSIONS = [
  {
    id: 'm1',
    title: 'First Wheels',
    giver: 'Valeria Prats',
    reward: 150,
    intro: [
      { speaker: 'Valeria', text: 'Renzo. You parked like a tourist, so at least you look harmless.' },
      { speaker: 'Renzo', text: 'I can drive. I just cannot eat a steering wheel.' },
      { speaker: 'Valeria', text: 'Good. Sit at my cafe table and learn what "quiet work" means on Ceniza.' },
    ],
    objectives: [
      {
        kind: 'goTo',
        text: 'Meet Valeria at the harbor cafe',
        point: at(SPAWN_POINTS.harborCafe, SPAWN_POINTS.harborCafe.heading),
        radius: RADIUS.foot,
      },
      {
        kind: 'spawnCar',
        text: 'Take the marked gray sedan',
        point: at({ x: -398, z: 432 }, 0.2),
        car: { kind: 'sedan', color: 0x8b929a },
      },
      {
        kind: 'driveTo',
        text: "Deliver the cousin's package to the Centro Sur garage",
        point: at(SPAWN_POINTS.centroGarage, SPAWN_POINTS.centroGarage.heading),
        radius: RADIUS.vehicle,
        requireCar: true,
      },
    ],
  },
  {
    id: 'm2',
    title: 'Harbor Run',
    giver: 'Valeria Prats',
    reward: 250,
    bonus: 50,
    intro: [
      { speaker: 'Valeria', text: 'The warehouse holds sealed cargo. The club across the causeway wants it hot and fast.' },
      { speaker: 'Renzo', text: 'Hot like temperature, or hot like the police?' },
      { speaker: 'Valeria', text: 'Both. Finish under 150 seconds and I will pay for your nerves.' },
    ],
    objectives: [
      {
        kind: 'goTo',
        text: 'Collect the sealed cargo at the harbor warehouse',
        point: at(SPAWN_POINTS.warehouse, SPAWN_POINTS.warehouse.heading),
        radius: RADIUS.foot,
      },
      {
        kind: 'driveTo',
        text: 'Run the causeway to Cayo Brasa before the cargo cools',
        point: at(SPAWN_POINTS.neonClub, SPAWN_POINTS.neonClub.heading),
        radius: RADIUS.vehicle,
        time: 150,
        bonusWanted: 2,
      },
    ],
  },
  {
    id: 'm3',
    title: 'Hot Cargo',
    giver: 'Valeria Prats',
    reward: 300,
    intro: [
      { speaker: 'Valeria', text: 'Three crates slipped customs. One man moves them before the dock audit.' },
      { speaker: 'Renzo', text: 'And the audit happens when?' },
      { speaker: 'Valeria', text: 'At the second crate, you will stop asking that.' },
    ],
    objectives: [
      {
        kind: 'collect',
        text: 'Lift crate one from the east quay',
        point: at({ x: -350, z: 400 }, 0.4),
        radius: 4.2,
      },
      {
        kind: 'collect',
        text: 'Lift crate two from the warehouse floor',
        point: at({ x: -340, z: 425 }, 0.2),
        radius: 4.2,
        heat: 1,
      },
      {
        kind: 'collect',
        text: 'Lift crate three behind the grain shed',
        point: at({ x: -455, z: 430 }, 1.5),
        radius: 4.2,
      },
      {
        kind: 'driveTo',
        text: 'Drop everything at the north cove',
        point: at(SPAWN_POINTS.northCove, SPAWN_POINTS.northCove.heading),
        radius: RADIUS.vehicle,
      },
    ],
  },
  {
    id: 'm4',
    title: 'Dockside Debt',
    giver: 'Valeria Prats',
    reward: 400,
    intro: [
      { speaker: 'Valeria', text: 'Ovidio borrowed from people I have to answer for. Visit Lomas Dulces with manners.' },
      { speaker: 'Renzo', text: 'If his manners are bad?' },
      { speaker: 'Valeria', text: 'Then answer in a language everyone understands, then disappear.' },
    ],
    objectives: [
      {
        kind: 'goTo',
        text: 'Find Ovidio Sarria in the suburbs',
        point: at({ x: -265, z: -225 }, Math.PI * 0.5),
        radius: RADIUS.foot,
      },
      {
        kind: 'defeat',
        text: 'Confront Ovidio and his two collectors',
        wave: [
          { x: -280, z: -210, health: 72, accuracy: 0.54 },
          { x: -248, z: -212, health: 72, accuracy: 0.54 },
        ],
      },
      {
        kind: 'escape',
        text: 'Escape the block or lose the heat',
        radius: 170,
        clearWanted: true,
      },
    ],
  },
  {
    id: 'm5',
    title: 'Neon Run',
    giver: 'Valeria Prats',
    reward: 450,
    intro: [
      { speaker: 'Valeria', text: 'Cayo Brasa needs a moving receipt from your headlights. Six gates, no excuses.' },
      { speaker: 'Renzo', text: 'Who am I racing?' },
      { speaker: 'Valeria', text: 'The clock, the tide, and everyone who underestimates you.' },
    ],
    objectives: [
      {
        kind: 'race',
        text: 'Complete all six neon gates in 120 seconds',
        time: 120,
        radius: 9,
        checkpoints: [
          { x: -810, z: -110 },
          { x: -700, z: -150 },
          { x: -575, z: -115 },
          { x: 260, z: 540 },
          { x: 480, z: 230 },
          { x: 220, z: 300 },
        ],
      },
    ],
  },
  {
    id: 'm6',
    title: 'The Vault Job',
    giver: 'Valeria Prats',
    reward: 700,
    intro: [
      { speaker: 'Valeria', text: 'A vault truck carries nothing today but credibility. We need it at the chop shop.' },
      { speaker: 'Renzo', text: 'Keep it pretty and keep it calm?' },
      { speaker: 'Valeria', text: 'Keep it under sixty percent, then shed every blue light before you enter.' },
    ],
    objectives: [
      {
        kind: 'spawnCar',
        text: 'Steal the armored sedan outside Centro Sur bank',
        point: at({ x: SPAWN_POINTS.bank.x + 12, z: SPAWN_POINTS.bank.z + 8 }, Math.PI * 0.88),
        car: { kind: 'police', color: 0x3a4450, label: 'vault-car' },
        heat: 3,
      },
      {
        kind: 'driveTo',
        text: 'Deliver the truck to Puerto Caldra under 60% damage',
        point: at(SPAWN_POINTS.chopShop, SPAWN_POINTS.chopShop.heading),
        radius: RADIUS.vehicle,
        requireCar: true,
        carTag: 'vault-car',
        maxDamage: 60,
      },
      {
        kind: 'clearWanted',
        text: 'Lose the police before the shop opens the bay door',
        point: at({ x: SPAWN_POINTS.chopShop.x + 30, z: SPAWN_POINTS.chopShop.z + 18 }, 0),
        radius: 60,
      },
    ],
  },
  {
    id: 'm7',
    title: 'Last Ferry',
    giver: 'Valeria Prats',
    reward: 1000,
    intro: [
      { speaker: 'Renzo', text: 'I heard a ferry leaves tonight. I also heard your name in that sentence.' },
      { speaker: 'Valeria', text: 'Collect me at Cayo Brasa. The people buying Ceniza would prefer we never board.' },
      { speaker: 'Renzo', text: 'Thirty seconds of ugly, then one clean horizon. I can do that.' },
    ],
    objectives: [
      {
        kind: 'goTo',
        text: 'Pick up Valeria at the neon club',
        point: at(SPAWN_POINTS.neonClub, SPAWN_POINTS.neonClub.heading),
        radius: RADIUS.foot,
      },
      {
        kind: 'driveTo',
        text: 'Drive Valeria to the north ferry pier',
        point: at(SPAWN_POINTS.ferryDock, SPAWN_POINTS.ferryDock.heading),
        radius: RADIUS.vehicle,
        requireCar: true,
      },
      {
        kind: 'survive',
        text: 'Hold the pier for 30 seconds against three waves',
        time: 30,
        waves: [1, 2, 3],
        radius: 75,
      },
      {
        kind: 'driveTo',
        text: 'Board the last ferry',
        point: at(SPAWN_POINTS.ferryDock, SPAWN_POINTS.ferryDock.heading),
        radius: RADIUS.vehicle,
        requireCar: true,
      },
    ],
  },
];

export { MISSIONS };

function setObjectiveText(mission, objective, extra = '') {
  const time = extra || (objective.timer !== undefined ? `${Math.ceil(objective.timer)}s` : '');
  return `${mission.title} — ${objective.text}${time ? ` (${time})` : ''}`;
}

function spawnWave(api, objective, waveIndex) {
  const spawnEnemy = api.spawnEnemy;
  if (!spawnEnemy) return [];
  const center = objective.point ?? { x: 0, z: 0 };
  const angles = [-Math.PI / 3, 0, Math.PI / 3];
  return angles.map((angle, index) => spawnEnemy(
    {
      x: center.x + Math.sin(angle) * 24,
      z: center.z + Math.cos(angle) * 24,
    },
    {
      health: 78,
      accuracy: 0.53 + waveIndex * 0.03,
      fireInterval: 0.98 - waveIndex * 0.08,
      role: `mission-wave-${waveIndex}`,
    },
  ));
}

function currentMissionObject() {
  return {
    index: -1,
    objectiveIndex: 0,
    objectiveText: 'No active contract',
    data: null,
  };
}

export function createMissions(context = {}) {
  const api = {
    spawnEnemy: context.spawnEnemy,
    addCar: context.addCar,
    addHeat: context.addHeat,
    setWanted: context.setWanted,
    scene: context.scene,
    cars: context.cars,
  };
  const completedIds = new Set();
  const onMissionComplete = [];
  const onMissionFail = [];
  let index = -1;
  let mission = null;
  let objectiveIndex = 0;
  let objectiveText = 'No active contract';
  let beacon = null;
  let collected = 0;
  let checkpoint = 0;
  let aliveEnemies = [];
  let spawnedTaggedCars = [];
  let objectiveStarted = false;
  let elapsed = 0;
  let current = currentMissionObject();
  let cashEarned = 0;

  function resetObjective() {
    collected = 0;
    checkpoint = 0;
    aliveEnemies = [];
    objectiveStarted = false;
    elapsed = 0;
  }

  function refreshCurrent() {
    current = {
      index,
      objectiveIndex,
      objectiveText,
      data: mission,
    };
  }

  function fail(reason = 'Contract failed') {
    if (!mission) return;
    const failedId = mission.id;
    index = -1;
    mission = null;
    objectiveIndex = 0;
    objectiveText = reason;
    beacon = null;
    resetObjective();
    for (const callback of onMissionFail) callback({ id: failedId, reason, restartable: true });
    refreshCurrent();
  }

  function complete() {
    const reward = mission.reward;
    cashEarned += reward;
    completedIds.add(mission.id);
    const completedId = mission.id;
    const rewardPaid = reward;
    index = -1;
    mission = null;
    objectiveIndex = 0;
    objectiveText = completedId === 'm7' ? 'Story complete' : 'Call Valeria for the next job';
    beacon = null;
    resetObjective();
    for (const callback of onMissionComplete) callback({ id: completedId, reward: rewardPaid });
    refreshCurrent();
    return rewardPaid;
  }

  function advanceObjective() {
    objectiveIndex += 1;
    resetObjective();
    if (objectiveIndex >= mission.objectives.length) {
      const reward = complete();
      return { completed: true, reward };
    }
    objectiveText = setObjectiveText(mission, mission.objectives[objectiveIndex]);
    refreshCurrent();
    return { completed: false };
  }

  function startObjective(objective) {
    objectiveStarted = true;
    if (objective.time !== undefined) objective.timer = objective.time;
    if (objective.heat && api.addHeat) api.addHeat(objective.heat);
    else if (objective.heat && api.setWanted) api.setWanted(Math.min(5, objective.heat));
    if (objective.kind === 'spawnCar' && api.addCar) {
      const car = api.addCar(objective.point, objective.car);
      if (car && objective.car?.label) {
        car.missionTag = objective.car.label;
        spawnedTaggedCars.push(car);
      }
    }
    if (objective.kind === 'defeat' && objective.wave) aliveEnemies = spawnWave(api, { point: objective.point }, 0);
    if (objective.kind === 'survive') aliveEnemies = spawnWave(api, objective, 1);
  }

  function updateObjective(objective, gameState) {
    const transform = playerTransform(gameState);
    const position = objective.point ?? transform.position;
    if (objective.kind === 'spawnCar') {
      if (!objectiveStarted) startObjective(objective);
      objectiveText = objective.text;
      beacon = objective.point;
      if (transform.inCar && objective.car?.label && transform.car.missionTag === objective.car.label) {
        return advanceObjective();
      }
      return false;
    }
    if (!objectiveStarted) startObjective(objective);

    if (objective.time !== undefined && objective.kind !== 'survive') {
      objective.timer -= gameState.dt;
      if (objective.timer <= 0) return fail('Time ran out');
    } else if (objective.kind === 'collect') {
      beacon = objective.point;
      if (distance(transform.position, objective.point) <= objective.radius) return advanceObjective();
    } else if (objective.kind === 'defeat') {
      beacon = objective.point;
      aliveEnemies = aliveEnemies.filter((enemy) => enemy && !enemy.dead);
      if (aliveEnemies.length === 0) return advanceObjective();
    } else if (objective.kind === 'escape') {
      beacon = null;
      const wantedStars = gameState.wanted?.stars ?? 0;
      const outside = distance(transform.position, objective.point) > objective.radius;
      if ((objective.clearWanted && wantedStars === 0) || outside) return advanceObjective();
    } else if (objective.kind === 'clearWanted') {
      beacon = objective.point;
      if ((gameState.wanted?.stars ?? 0) === 0 && distance(transform.position, objective.point) <= objective.radius) {
        return advanceObjective();
      }
    } else if (objective.kind === 'race') {
      const point = objective.checkpoints[checkpoint];
      beacon = point;
      if (distance(transform.position, point) <= objective.radius) {
        checkpoint += 1;
        if (checkpoint >= objective.checkpoints.length) return advanceObjective();
      }
    } else if (objective.kind === 'survive') {
      beacon = objective.point;
      elapsed += gameState.dt;
      aliveEnemies = aliveEnemies.filter((enemy) => enemy && !enemy.dead);
      const waveIndex = Math.max(0, Math.min(objective.waves.length - 1, Math.floor((elapsed / objective.time) * objective.waves.length)));
      if (waveIndex > (objective.currentWave ?? 0)) {
        objective.currentWave = waveIndex;
        aliveEnemies.push(...spawnWave(api, objective, waveIndex + 1));
      }
      if (distance(transform.position, objective.point) > objective.radius) return fail('You abandoned Valeria at the pier');
      if (elapsed >= objective.time) return advanceObjective();
    }
    objectiveText = setObjectiveText(mission, objective);
    refreshCurrent();
    return false;
  }

  function beginMission(nextIndex) {
    index = nextIndex;
    mission = MISSIONS[index];
    objectiveIndex = 0;
    resetObjective();
    objectiveText = setObjectiveText(mission, mission.objectives[0]);
    refreshCurrent();
    return {
      id: mission.id,
      title: mission.title,
      giver: mission.giver,
      dialogue: mission.intro,
      reward: mission.reward,
    };
  }

  return {
    get current() {
      return current;
    },
    get beacon() {
      return beacon;
    },
    get dialogueQueue() {
      return mission?.intro ?? [];
    },
    cashEarned,
    completedIds,
    onMissionComplete,
    onMissionFail,
    start() {
      if (index === -1 && completedIds.size === 0) return beginMission(0);
      return null;
    },
    restartCurrent() {
      const failedIndex = completedIds.size;
      if (failedIndex >= MISSIONS.length) return null;
      return beginMission(failedIndex);
    },
    failPlayer(reason = 'busted') {
      fail(reason === 'busted' ? 'Renzo was busted' : 'Renzo was wasted');
    },
    failTargetCar(car) {
      if (mission && spawnedTaggedCars.includes(car) && (car.destroyed || car.damage >= 100)) {
        fail('The mission vehicle was destroyed');
      }
    },
    update(dt, gameState) {
      if (dt <= 0 || !mission) return null;
      const result = updateObjective(mission.objectives[objectiveIndex], { ...gameState, dt });
      if (result?.completed && mission?.id === 'm2') {
        const wantedStars = gameState.wanted?.stars ?? 0;
        if (wantedStars >= 2) {
          cashEarned += mission.bonus;
          return { completed: true, reward: mission.reward, bonus: mission.bonus };
        }
      }
      return result;
    },
  };
}
