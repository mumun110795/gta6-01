import * as THREE from 'three';
import { SPAWN_POINTS, WORLD } from './config.js';
import { buildCity } from './city.js';
import { createEnvironment, setTimeOfDay, updateEnvironment } from './environment.js';
import { createCar, flashPoliceLights, spawnParkedCars, syncCarMesh, updateCar, updateCarLighting } from './cars.js';
import { createPlayer, exitCar, updatePlayerOnFoot, tryEnterCar } from './player.js';
import { createAgent, createPedestrians, createStaticPedestrian, updatePedestrians } from './pedestrians.js';
import { createTraffic, spawnAgent, updateTraffic } from './traffic.js';
import { createWanted, updateWanted } from './wanted.js';
import { createPolice, spawnPoliceUnits, updatePolice } from './police.js';
import { combatCrashDamage, createCombat, firePlayerWeapon, updateCombat } from './combat.js';
import { createMissions } from './missions.js';
import { MISSIONS } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap, drawFullMap } from './minimap.js';
import { createScreens } from './screens.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { createParticles } from './particles.js';
import { applyShotScene } from './shots.js';

const keys = new Map();
const pointer = {
  down: false,
  button: 0,
  x: 0,
  y: 0,
};
const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const speedElement = document.querySelector('#hud-speed');
const clockElement = document.querySelector('#hud-clock');
const starsElement = document.querySelector('#hud-stars');
const healthElement = document.querySelector('#hud-health');
const healthTextElement = document.querySelector('#hud-health-text');
const statusElement = document.querySelector('#hud-status');
const endcardElement = document.querySelector('#endcard');
const endcardTitleElement = document.querySelector('#endcard-title');
const endcardCopyElement = document.querySelector('#endcard .overlay-copy');
const menuElement = document.querySelector('#menu');
const fullMapCanvas = document.querySelector('#fullmap') ?? document.createElement('canvas');
let cameraDistance = 7;
let environment;
let player;
let traffic;
let pedestrians;
let wanted;
let police;
let combat;
let cars = [];
let colliders = [];
const world = {
  roads: [],
  scene: null,
  colliders,
  cars,
  combat: null,
  player: null,
};
const state = { events: [], playerDown: null };

let hud;
let screens;
let audio;
let minimap;
let missions;
let gameState = 'title';
let cash = 500;
let nextAutosave = 30;
let radioStation = -1;
let stepTimer = 0;
let lastFootPosition = new THREE.Vector3();
let beacon;
let titleClock = 0;
let mapOpen = false;
let particles;
let carHeadlight;
let shotObjective = '';
let shotElapsed = 0;
let shotApplied = false;
let shotExposure = 1;

const container = document.querySelector('#game-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const city = buildCity(scene);
world.roads = city.roads;
world.scene = scene;
  particles = createParticles(scene);
colliders = city.colliders;
world.colliders = colliders;
cars = [];

hud = createHud();
screens = createScreens();
audio = createAudio();
minimap = createMinimap(document.querySelector('#minimap'), {
  roads: city.roads,
  cars,
  policeUnits: [],
});

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.25, 4200);
camera.position.set(SPAWN_POINTS.playerStart.x + 8, 4, SPAWN_POINTS.playerStart.z + 8);

async function bootWorld() {
  environment = createEnvironment(scene, city.nightMaterials);
  cars = [
    createCar('luxury', 0xd90429, { x: 181.5, z: 260 }, Math.PI),
    ...spawnParkedCars(scene, city, 100),
  ];
  world.cars = cars;
  for (const car of cars) {
    car.parked = true;
    scene.add(car.mesh);
  }
  traffic = createTraffic({ ...city, scene, colliders });
  traffic.cars = cars;
  pedestrians = createPedestrians({
    ...city,
    scene,
    colliders,
    playerStart: SPAWN_POINTS.playerStart,
  });
  pedestrians.onPedestrianHit.push((pedestrian, car) => {
    state.events.push({ type: 'pedestrianHit', car });
  });
  player = createPlayer(scene, SPAWN_POINTS.playerStart);
  wanted = createWanted();
  combat = createCombat(world);
  police = createPolice(world);
  world.player = player;
  world.combat = combat;
  combat.onShotFired.push((position, context = witnessContext()) => {
    wanted.reportCrime('shotFired', position, context);
  });
  combat.onEnemyDown.push((enemy) => {
    wanted.reportCrime('enemyDown', enemy.position, witnessContext());
  });
  combat.onWasted.push(() => setPlayerDown('wasted'));
  police.onBusted.push(() => setPlayerDown('busted'));
  police.onWasted.push(() => setPlayerDown('wasted'));
  combat.onShotFired.push((position, context = {}) => {
    const origin = context.impactPosition ?? position;
    particles.burst(origin.clone().setY(origin.y + 0.8), { count: 7, life: 0.45, spread: 4.5 });
  });
  missions = createMissions({
    player,
    cars,
    wanted,
    scene,
    spawnEnemy: (point, options) => {
      const enemy = spawnEnemy(point, options);
      scene.add(enemy.mesh);
      combat.enemies.push(enemy);
      return enemy;
    },
    addCar: (point, spec) => {
      const car = createCar(spec?.kind ?? 'sedan', spec?.color ?? 0x8b929a, point, point.heading ?? 0);
      car.wasParked = true;
      cars.push(car);
      scene.add(car.mesh);
      return car;
    },
    addHeat: (heat) => {
      wanted.reportCrime('shotFired', player.position, witnessContext());
      if (typeof heat === 'number') wanted.heat = Math.max(wanted.heat, heat);
    },
    setWanted: (stars) => {
      wanted.heat = Math.max(wanted.heat, stars * 20 + 1);
      wanted.stars = stars;
      wanted.searching = true;
    },
  });
  missions.onMissionComplete.push(onMissionComplete);
  missions.onMissionFail.push(onMissionFail);

  carHeadlight = new THREE.SpotLight(0xfff1c8, 0, 95, 0.48, 0.35, 1.4);
  scene.add(carHeadlight, carHeadlight.target);

  beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 34, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffca56,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const beaconLight = new THREE.PointLight(0xffca56, 36, 44, 1.8);
  beaconLight.position.y = 5;
  beacon.add(beaconLight);

  cameraTarget.copy(player.position).setY(player.position.y + 1.2);
  screens.showTitle(startGame);
}

function onMissionComplete({ id, reward }) {
  cash += reward;
  hud.setBanner('MISSION COMPLETE', MISSIONS.find((mission) => mission.id === id)?.title ?? '');
  audio.playCash();
  saveGame(snapshot());
  if (missions.completedIds.size >= MISSIONS.length) {
    gameState = 'complete';
    screens.showEnd('complete', { cash, missionsDone: missions.completedIds.size }, () => {});
  }
}

function onMissionFail({ reason }) {
  hud.setBanner('MISSION FAILED', reason);
}

function snapshot() {
  return {
    cash,
    completedIds: [...missions.completedIds],
    playerPos: { x: player.position.x, z: player.position.z },
    timeOfDay: environment.timeOfDay,
    currentCarId: player.mode === 'car' ? cars.indexOf(player.car) : null,
  };
}

function startGame() {
  audio.resume();
  const save = loadGame();
  if (save) {
    cash = Number(save.cash) || 0;
    for (const id of save.completedIds ?? []) {
      if (MISSIONS.some((mission) => mission.id === id)) missions.completedIds.add(id);
    }
    if (save.playerPos) player.position.set(save.playerPos.x, WORLD.roadY, save.playerPos.z);
    player.mesh.position.copy(player.position);
    setTimeOfDay(environment, save.timeOfDay ?? environment.timeOfDay);
    const savedCar = save.currentCarId === null ? null : cars[save.currentCarId];
    if (savedCar) {
      player.mode = 'car';
      player.car = savedCar;
      savedCar.driver = 'player';
      savedCar.parked = false;
      player.mesh.visible = false;
    }
  }
  if (missions.completedIds.size < MISSIONS.length) missions.start();
  gameState = 'playing';
  screens.hideTitle();
}

bootWorld().catch((error) => {
  console.error('Failed to start Isla Ceniza:', error);
});

function isDown(...codes) {
  return codes.some((code) => keys.get(code) === true);
}

function drivingInput() {
  return {
    throttle: (isDown('KeyW', 'ArrowUp') ? 1 : 0) - (isDown('KeyS', 'ArrowDown') ? 1 : 0),
    steer: (isDown('KeyA', 'ArrowLeft') ? 1 : 0) - (isDown('KeyD', 'ArrowRight') ? 1 : 0),
    brake: isDown('Space'),
  };
}

function witnessContext() {
  return {
    pedestrians,
    traffic,
    policeUnits: police?.units ?? [],
    colliders,
  };
}

function setPlayerDown(reason) {
  if (state.playerDown) return;
  state.playerDown = reason;
  keys.clear();
  pointer.down = false;
  gameState = 'down';
  screens.showEnd(reason, { cash, missionsDone: missions?.completedIds.size ?? 0 }, respawn);
}

function respawn(kind) {
  combat.playerHealth = 100;
  player.health = 100;
  wanted.heat = 0;
  wanted.stars = 0;
  wanted.searching = false;
  wanted.lastSeen = null;
  wanted.searchTimer = 0;
  wanted.searchDuration = 0;
  if (kind === 'wasted') cash = Math.floor(cash * 0.9);
  player.position.set(SPAWN_POINTS.clinic.x, WORLD.roadY, SPAWN_POINTS.clinic.z);
  player.mesh.position.copy(player.position);
  state.playerDown = null;
  gameState = 'playing';
  endcardElement.style.display = 'none';
}

function onKeydown(event) {
  if (event.repeat) return;
  keys.set(event.code, true);
  if (state.playerDown) {
    if (event.code === 'KeyE') respawn(state.playerDown);
    return;
  }
  if (gameState === 'paused') {
    if (event.code === 'Escape' || event.code === 'KeyP') togglePause();
    return;
  }
  if (gameState === 'playing' && (event.code === 'Escape' || event.code === 'KeyP')) {
    togglePause();
    return;
  }
  if (gameState === 'playing' && event.code === 'KeyM') toggleMap();
  if (gameState === 'playing' && event.code === 'KeyR' && player?.mode === 'car') {
    radioStation = radioStation === -1 ? 0 : radioStation === 0 ? 1 : -1;
    audio.setRadio(radioStation);
    hud.flashMessage(audio.stationName());
  }
  if (event.code === 'KeyN') {
    const muted = audio.toggleMute();
    hud.flashMessage(muted ? 'Audio muted' : 'Audio on');
  }
  if (event.code === 'KeyE' && player?.mode === 'foot') {
    const car = tryEnterCar(player, cars);
    if (car) {
      const theft = car.previousDriver === 'traffic' || car.wasParked;
      if (theft) wanted.reportCrime('carTheft', car.position, witnessContext());
    }
  }
  else if (event.code === 'KeyE' && player?.mode === 'car') exitCar(player);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    screens.showPause();
  } else if (gameState === 'paused') {
    gameState = 'playing';
    screens.hidePause();
  }
}

function toggleMap() {
  if (mapOpen) {
    screens.hideMap();
    mapOpen = false;
  } else {
    drawFullMap(fullMapCanvas, { roads: city.roads }, mapState());
    screens.showMap();
    mapOpen = true;
  }
}

function mapState() {
  return {
    player: player.mode === 'car' ? player.car : player,
    beacon: missions?.beacon,
    policeUnits: police?.units ?? [],
  };
}

function updateBeacon() {
  const point = missions?.beacon;
  if (!point) {
    beacon.visible = false;
    return;
  }
  beacon.visible = true;
  beacon.position.set(point.x, WORLD.roadY + 17, point.z);
  beacon.rotation.y += 0.01;
}

function updateGameHud(dt) {
  const car = player.mode === 'car' ? player.car : null;
  const focus = car ? car.position : player.position;
  hud.setCash(cash);
  hud.setClock(formatClock());
  hud.setSpeed(car ? Math.abs(car.speed) * 3.6 : 0);
  hud.setObjective(missions?.current?.objectiveText ?? 'Explore the island');
  if (shotParam) hud.setObjective(shotObjective || missions?.current?.objectiveText || 'Explore the island');
  hud.update(dt);
  minimap.update(dt);
  minimap.draw(mapState());
  updateBeacon();
  audio.setEngine(Boolean(car), car ? Math.min(1, Math.abs(car.speed) / car.tuning.topSpeed) : 0);
  const chased = (police?.units ?? []).some((unit) => (
    unit.state === 'pursuit'
    && Math.hypot(unit.position.x - focus.x, unit.position.z - focus.z) <= 60
  ));
  audio.setSiren(chased);

  if (player.mode === 'foot' && player.speed > 0.7) {
    const travelled = lastFootPosition.distanceTo(player.position);
    stepTimer += travelled;
    if (stepTimer >= 1.45) {
      audio.playStep();
      stepTimer = 0;
    }
  } else {
    stepTimer = 0;
  }
  lastFootPosition.copy(car ? car.position : player.position);
}

function footInput() {
  return {
    forward: isDown('KeyW', 'ArrowUp'),
    back: isDown('KeyS', 'ArrowDown'),
    left: isDown('KeyA', 'ArrowLeft'),
    right: isDown('KeyD', 'ArrowRight'),
    run: isDown('ShiftLeft', 'ShiftRight'),
  };
}

function onKeyup(event) {
  keys.set(event.code, false);
}

function onPointerDown(event) {
  pointer.down = true;
  pointer.button = event.button;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
  if (
    !state.playerDown
    && event.button === 0
    && player?.mode === 'foot'
    && firePlayerWeapon(combat, { player, camera, enemies: combat.enemies, pedestrians })
  ) {
    wanted.reportCrime('shotFired', player.position, witnessContext());
  }
}

function onPointerMove(event) {
  if (!pointer.down) return;
  if (state.playerDown) return;
  const deltaX = event.clientX - pointer.x;
  const deltaY = event.clientY - pointer.y;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (pointer.button === 2) {
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + deltaY * 0.015, 4, 19);
  } else {
    player.cameraYaw -= deltaX * 0.0045;
    player.cameraPitch = THREE.MathUtils.clamp(player.cameraPitch + deltaY * 0.003, 0.04, 1.15);
  }
}

function onPointerUp(event) {
  pointer.down = false;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
}

function onWheel(event) {
  event.preventDefault();
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + Math.sign(event.deltaY) * 0.7, 4, 19);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function formatClock() {
  const hour = Math.floor(environment.timeOfDay);
  const minute = Math.floor((environment.timeOfDay - hour) * 60);
  const day = Math.floor(environment.elapsed / (132 * 24)) % 7;
  const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} · ${labels[day]}`;
}

function updateHud() {
  if (shotParam) hud.setObjective(shotObjective || missions?.current?.objectiveText || 'Explore the island');
  const stars = wanted.stars;
  starsElement.textContent = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
  starsElement.classList.toggle('active', stars > 0);
  starsElement.style.visibility = wanted.searching && Math.floor(performance.now() / 320) % 2 === 0
    ? 'hidden'
    : 'visible';
  const health = Math.max(0, Math.round(combat.playerHealth));
  healthElement.style.width = `${health}%`;
  healthTextElement.textContent = String(health);
  statusElement.textContent = player.mode === 'car' ? 'Driving' : 'On foot';
}

function processEvents() {
  while (state.events.length > 0) {
    const event = state.events.shift();
    if (
      event.type === 'pedestrianHit'
      && (event.car?.driver === 'player' || event.car?.lastPlayerDriver)
    ) {
      wanted.reportCrime('hitAndRun', event.car.position, witnessContext());
    }
  }
}

function updateCamera(dt) {
  if (player.mode === 'foot') {
    const horizontalDistance = Math.cos(player.cameraPitch) * cameraDistance;
    const height = 2.1 + Math.sin(player.cameraPitch) * cameraDistance * 0.55;
    desiredCameraPosition.set(
      player.position.x - Math.sin(player.cameraYaw) * horizontalDistance,
      player.position.y + height,
      player.position.z - Math.cos(player.cameraYaw) * horizontalDistance,
    );
    cameraTarget.lerp(new THREE.Vector3(player.position.x, player.position.y + 1.2, player.position.z), 1 - Math.exp(-10 * dt));
  } else {
    const car = player.car;
    const speedDistance = shotParam
      ? 12.5
      : 8 + Math.min(4.5, Math.abs(car.speed) * 0.24);
    desiredCameraPosition.set(
      car.position.x - Math.sin(car.heading) * speedDistance,
      car.position.y + (shotParam ? 7.8 : 3.2),
      car.position.z - Math.cos(car.heading) * speedDistance,
    );
    cameraTarget.lerp(new THREE.Vector3(car.position.x, car.position.y + 1.35, car.position.z), 1 - Math.exp(-8 * dt));
  }
  desiredCameraPosition.y = Math.max(WORLD.roadY + 0.6, desiredCameraPosition.y);
  camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-5 * dt));
  camera.lookAt(cameraTarget);
}

function updateShotCamera() {
  const target = player.mode === 'car' ? player.car : player;
  const forwardX = Math.sin(target.heading);
  const forwardZ = Math.cos(target.heading);
  const driving = player.mode === 'car';
  const preset = typeof scene.userData.shotCamera === 'object' ? scene.userData.shotCamera : {};
  const behind = driving ? 9.5 : preset.behind ?? 5.5;
  const height = driving ? 3.4 : preset.height ?? 2.2;
  const side = driving ? 2 : 0;
  desiredCameraPosition.set(
    target.position.x - forwardX * behind + forwardZ * side,
    target.position.y + height,
    target.position.z - forwardZ * behind - forwardX * side,
  );
  desiredCameraPosition.y = Math.max(WORLD.roadY + (driving ? 3.2 : preset.height ?? 2.2), desiredCameraPosition.y);
  camera.position.copy(desiredCameraPosition);
  cameraTarget.set(
    target.position.x + forwardX * (driving ? 6 : 0),
    target.position.y + (driving ? 0 : 1.4),
    target.position.z + forwardZ * (driving ? 6 : 0),
  );
  camera.lookAt(cameraTarget);
}

function freezeShotPolice(dt) {
  for (const unit of police.units) {
    const car = unit.car;
    car.speed = 0;
    car.lateralSpeed = 0;
    car.steering = 0;
    car.lightClock += dt;
    syncCarMesh(car, 0);
    flashPoliceLights(car.mesh, car.lightClock);
  }
}

function updateFrame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!player || !environment) {
    renderer.render(scene, camera);
    requestAnimationFrame(updateFrame);
    return;
  }

  if (shotParam && !shotApplied) {
    try {
      applyShotScene(shotParam, {
        scene,
        camera,
        player,
        cars,
        traffic,
        pedestrians,
        roads: city.roads,
        wanted,
        police,
        missions,
        setTimeOfDay: (hours) => setTimeOfDay(environment, hours),
        setWanted: (stars) => {
          wanted.heat = stars === 0 ? 0 : Math.max(wanted.heat, stars * 75 + 5);
          wanted.stars = stars;
          wanted.searching = stars > 0;
          wanted.lastSeen = stars > 0 ? { x: player.position.x, z: player.position.z } : null;
          wanted.searchTimer = stars > 0 ? 3600 : 0;
          wanted.searchDuration = wanted.searchTimer;
        },
        setObjective: (text) => {
          shotObjective = text;
          hud.setObjective(text);
        },
        spawnPolice: (count, options = {}) => spawnPoliceUnits(
          police,
          player.mode === 'car'
            ? { ...player.car.position, heading: player.car.heading }
            : { ...player.position, heading: player.heading },
          count,
          options,
        ),
        sprinkleLife: ({ cars: carCount = 0, pedestrians: pedestrianCount = 0 }) => {
          const focus = player.mode === 'car' ? player.car.position : player.position;
          for (let index = 0; index < carCount; index += 1) spawnAgent(traffic, focus);
          for (let index = 0; index < pedestrianCount; index += 1) createAgent(pedestrians, focus);
        },
        spawnPoliceAt: (point) => spawnPoliceUnits(police, point, 1, { distance: 0 }),
        spawnPedestrian: (point) => createStaticPedestrian(pedestrians, point),
        spawnCar: (kind, color, point) => {
          const car = createCar(kind, color, point, point.heading ?? 0);
          car.driver = 'shot-traffic';
          car.parked = true;
          scene.add(car.mesh);
          cars.push(car);
        },
        addHeadlight: ({ x, z, targetX, targetZ }) => {
          const headlight = new THREE.SpotLight(0xffd9a0, 9, 52, 0.72, 0.7, 1.2);
          headlight.position.set(x, 1.2, z);
          headlight.target.position.set(targetX, WORLD.roadY, targetZ);
          scene.add(headlight, headlight.target);
        },
        placeCrate: (point, size = 2) => {
          const crate = new THREE.Mesh(
            new THREE.BoxGeometry(size, size, size),
            new THREE.MeshStandardMaterial({ color: 0x9a6b3d, roughness: 0.9 }),
          );
          crate.position.set(point.x, size / 2, point.z);
          crate.rotation.y = (point.x + point.z) * 0.012;
          crate.castShadow = true;
          crate.receiveShadow = true;
          scene.add(crate);
        },
        placeNeon: (x, y, z, rotation, text, color) => {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 128;
          const context = canvas.getContext('2d');
          context.fillStyle = '#100718';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.font = 'bold 64px sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.shadowColor = color;
          context.shadowBlur = 28;
          context.fillStyle = color;
          context.fillText(text, 256, 68);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(30, 7.5),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, side: THREE.DoubleSide }),
          );
          sign.position.set(x, y, z);
          sign.rotation.y = rotation;
          scene.add(sign);
        },
        setExposure: (value) => {
          shotExposure = value;
          environment.hemisphere.intensity *= value;
          environment.moon.intensity *= value;
          renderer.toneMappingExposure = value;
        },
        setPlayerAt: (point, driving) => {
          player.mesh.visible = !driving;
          player.position.set(point.x, WORLD.roadY, point.z);
          player.heading = point.heading ?? 0;
          player.cameraYaw = player.heading;
          if (driving) {
            const car = createCar('luxury', 0xd90429, point, point.heading ?? 0);
            player.mesh.position.copy(player.position);
            car.driver = 'player';
            car.speed = 0;
            car.parked = false;
            scene.add(car.mesh);
            cars.push(car);
            player.mode = 'car';
            player.car = car;
          } else player.mode = 'foot';
        },
        SPAWN_POINTS,
      });
      // Shot scenes are static (sun and focus never move): bake the shadow
      // map once instead of re-rendering it every frame — under SwiftShader
      // the per-frame shadow pass otherwise dominates capture time.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      gameState = 'playing';
      screens.hideTitle();
      updateCamera(0);
      updateShotCamera();
    } catch (error) {
      console.error('Failed to apply shot scene:', error);
    }
    shotApplied = true;
  }

  if (shotParam) {
    shotElapsed += dt;
    if (shotObjective) hud.setObjective(shotObjective);
    if (player.mode === 'car') {
      player.car.driver = 'shot-player';
      player.car.speed = 0;
      player.car.lateralSpeed = 0;
      player.car.steering = 0;
      player.mesh.position.copy(player.car.position);
      player.mesh.rotation.y = player.car.heading;
      player.mesh.visible = false;
    }
    if (!window.__shotReady && shotElapsed >= 2.5) window.__shotReady = true;
  }
  if (shotParam) freezeShotPolice(dt);

  if (gameState === 'title') {
    titleClock += dt;
    updateEnvironment(environment, dt, player.position);
    const angle = titleClock * 0.16;
    camera.position.set(
      player.position.x + Math.sin(angle) * 12,
      player.position.y + 4.8,
      player.position.z + Math.cos(angle) * 12,
    );
    cameraTarget.set(player.position.x, player.position.y + 1.2, player.position.z);
    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
    requestAnimationFrame(updateFrame);
    return;
  }

  if (gameState === 'paused' || gameState === 'complete' || gameState === 'down') {
    renderer.render(scene, camera);
    requestAnimationFrame(updateFrame);
    return;
  }

  if (player.mode === 'foot') updatePlayerOnFoot(player, footInput(), dt, colliders);
  else if (!shotParam) {
    const impactSpeed = updateCar(player.car, drivingInput(), dt, colliders);
    if (impactSpeed >= 6) {
      combatCrashDamage(combat, impactSpeed, dt);
      wanted.reportCrime('vehicleCollision', player.car.position, witnessContext());
    }
  }

  const focus = player.mode === 'car' ? player.car.position : player.position;
  processEvents();
  if (!shotParam) updateTraffic(traffic, dt, player, pedestrians);
  updatePedestrians(pedestrians, dt, { player, cars });
  const combatContext = {
    player,
    cars,
    pedestrians,
    traffic,
    colliders,
    scene,
    enemies: combat.enemies,
    policeUnits: police.units,
    combat,
    wanted,
  };
  updateWanted(wanted, dt, { ...combatContext, playerPosition: focus });
  if (!shotParam) updatePolice(police, dt, combatContext);
  updateCombat(combat, dt, combatContext);
  const nightGlow = updateEnvironment(environment, dt, focus);
  for (const car of cars) updateCarLighting(car, nightGlow);
  if (player.mode === 'car') {
    carHeadlight.intensity = 16 + nightGlow * 180;
    carHeadlight.position.copy(player.car.position).setY(player.car.position.y + 0.9);
    carHeadlight.target.position.set(
      player.car.position.x + Math.sin(player.car.heading) * 34,
      player.car.position.y + 0.15,
      player.car.position.z + Math.cos(player.car.heading) * 34,
    );
  } else carHeadlight.intensity = 0;
  for (const car of cars) {
    if (car.lastCollision) {
      particles.burst(car.lastCollision, { count: Math.min(20, 5 + car.lastCollision.speed), life: 0.55, spread: 5.5 });
      car.lastCollision = null;
    }
    if (car.damage >= 75) particles.smoke(car.position.clone().setY(car.position.y + 0.75), dt);
  }
  particles.update(dt);
  if (!shotParam) missions.update(dt, { player, cars, wanted });
  updateCamera(dt);
  if (shotParam) updateShotCamera();
  updateHud();
  updateGameHud(dt);
  if (mapOpen) drawFullMap(fullMapCanvas, { roads: city.roads }, mapState());
  nextAutosave -= dt;
  if (nextAutosave <= 0) {
    saveGame(snapshot());
    nextAutosave = 30;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(updateFrame);
}

function unusedLegacyFrame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.playerDown) {
    const input = player.mode === 'foot'
      ? { forward: false, back: false, left: false, right: false, run: false }
      : { throttle: 0, steer: 0, brake: true };
    if (player.mode === 'foot') updatePlayerOnFoot(player, input, dt, colliders);
    else updateCar(player.car, input, dt, colliders);
  } else if (player.mode === 'foot') updatePlayerOnFoot(player, footInput(), dt, colliders);
  else {
    const impactSpeed = updateCar(player.car, drivingInput(), dt, colliders);
    if (impactSpeed >= 6) {
      combatCrashDamage(combat, impactSpeed, dt);
      wanted.reportCrime('vehicleCollision', player.car.position, witnessContext());
    }
  }

  const focus = player.mode === 'car' ? player.car.position : player.position;
  processEvents();
  updateTraffic(traffic, dt, player, pedestrians);
  updatePedestrians(pedestrians, dt, { player, cars });
  const combatContext = {
    player,
    cars,
    pedestrians,
    traffic,
    colliders,
    scene,
    enemies: combat.enemies,
    policeUnits: police.units,
    combat,
    wanted,
  };
  updateWanted(wanted, dt, { ...combatContext, playerPosition: focus });
  updatePolice(police, dt, combatContext);
  updateCombat(combat, dt, combatContext);
  updateEnvironment(environment, dt, focus);
  updateCamera(dt);
  updateHud();
  if (player.mode === 'car') {
    speedElement.style.display = 'block';
    speedElement.textContent = `${Math.max(0, Math.round(Math.abs(player.car.speed) * 3.6))} km/h`;
  } else {
    speedElement.style.display = 'none';
  }
  clockElement.textContent = formatClock();
  renderer.render(scene, camera);
  requestAnimationFrame(updateFrame);
}

const shotParam = new URLSearchParams(window.location.search).get('shot');
window.__shotParam = shotParam;
menuElement.style.display = 'none';
hud.setCash(cash);
screens.showTitle(startGame);

requestAnimationFrame(updateFrame);

window.addEventListener('keydown', onKeydown);
window.addEventListener('keyup', onKeyup);
window.addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', onPointerDown);
renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerup', onPointerUp);
renderer.domElement.addEventListener('pointercancel', onPointerUp);
renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('resize', onResize);
