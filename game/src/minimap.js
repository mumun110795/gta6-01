import { DISTRICTS } from './config.js';

const ISLAND_RADIUS = 690;
const OCEAN = '#0e7d99';
const LAND = '#2fa84f';
const ROAD = '#333a45';
const ACCENT = '#ffd43b';

function positionOf(entity) {
  if (!entity) return null;
  if (entity.position && Number.isFinite(entity.position.x) && Number.isFinite(entity.position.z)) {
    return entity.position;
  }
  if (entity.car?.position) return entity.car.position;
  if (Number.isFinite(entity.x) && Number.isFinite(entity.z)) return entity;
  return null;
}

function policeList(state) {
  if (Array.isArray(state?.police)) return state.police;
  if (Array.isArray(state?.policeUnits)) return state.policeUnits;
  if (Array.isArray(state?.policeCars)) return state.policeCars;
  return [];
}

function isChasing(unit) {
  return Boolean(unit?.chasing || unit?.pursuing || unit?.state === 'chase' ||
    unit?.car?.chasing || unit?.car?.pursuing);
}

function centerOf(state) {
  const player = positionOf(state?.player);
  return player ? { x: player.x, z: player.z } : { x: 0, z: 0 };
}

function viewFor(canvas, state, fullMap) {
  if (fullMap) {
    return {
      center: { x: 0, z: 0 },
      radius: Math.max(ISLAND_RADIUS * 1.08, 720),
      size: canvas.width,
      player: positionOf(state?.player),
      heading: state?.player?.heading ?? state?.player?.car?.heading ?? 0,
    };
  }
  const player = positionOf(state?.player);
  return {
    center: centerOf(state),
    radius: 235,
    size: canvas.width,
    player,
    heading: state?.player?.heading ?? state?.player?.car?.heading ?? 0,
  };
}

function worldToCanvas(point, view) {
  const scale = (view.size * 0.5) / view.radius;
  return {
    x: view.size / 2 + (point.x - view.center.x) * scale,
    y: view.size / 2 + (point.z - view.center.z) * scale,
  };
}

function clipToCircle(context, view) {
  context.beginPath();
  context.arc(view.size / 2, view.size / 2, view.size / 2 - 2, 0, Math.PI * 2);
  context.clip();
}

function drawLand(context, view) {
  const center = worldToCanvas({ x: 0, z: 0 }, view);
  const radius = ISLAND_RADIUS * ((view.size * 0.5) / view.radius);
  context.fillStyle = OCEAN;
  context.fillRect(0, 0, view.size, view.size);
  context.fillStyle = LAND;
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawRoads(context, roads, view) {
  context.strokeStyle = ROAD;
  context.lineCap = 'round';
  for (const road of roads ?? []) {
    const first = worldToCanvas(road, view);
    const second = worldToCanvas({ x: road.x2, z: road.z2 }, view);
    context.lineWidth = Math.max(1, (road.width ?? 8) * ((view.size * 0.5) / view.radius) * 0.7);
    context.beginPath();
    context.moveTo(first.x, first.y);
    context.lineTo(second.x, second.y);
    context.stroke();
  }
}

function drawDistrictLabels(context, view) {
  if (view.radius < 500) return;
  const scale = (view.size * 0.5) / view.radius;
  context.font = `${Math.max(11, Math.floor(view.size / 45))}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const district of DISTRICTS) {
    const point = worldToCanvas({
      x: (district.minX + district.maxX) / 2,
      z: (district.minZ + district.maxZ) / 2,
    }, view);
    context.fillStyle = 'rgba(255,255,255,.82)';
    context.fillText(district.name.toUpperCase(), point.x, point.y);
  }
}

function drawBlips(context, state, view, elapsed) {
  const pulse = 0.62 + Math.sin(elapsed * 4.5) * 0.22;
  for (const unit of policeList(state)) {
    const point = positionOf(unit?.car ?? unit);
    if (!point) continue;
    const screen = worldToCanvas(point, view);
    const chasing = isChasing(unit);
    context.fillStyle = chasing ? (Math.floor(elapsed * 6) % 2 ? '#ff5d5d' : '#448aff') : '#7fa0d0';
    context.beginPath();
    context.arc(screen.x, screen.y, chasing ? 4.5 : 3.2, 0, Math.PI * 2);
    context.fill();
  }
  const beaconPoint = positionOf(state?.beacon);
  if (beaconPoint) {
    const screen = worldToCanvas(beaconPoint, view);
    context.globalAlpha = pulse;
    context.fillStyle = '#ffca56';
    context.beginPath();
    context.arc(screen.x, screen.y, 6 + pulse * 3, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = ACCENT;
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawPlayer(context, view) {
  if (!view.player) return;
  const screen = worldToCanvas(view.player, view);
  context.save();
  context.translate(screen.x, screen.y);
  context.rotate(-view.heading);
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#111820';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(5.5, 7);
  context.lineTo(0, 4);
  context.lineTo(-5.5, 7);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawNorth(context, view) {
  context.save();
  context.translate(view.size / 2, 16);
  context.fillStyle = ACCENT;
  context.font = '700 10px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('N', 0, 0);
  context.beginPath();
  context.moveTo(0, -7);
  context.lineTo(3.5, 5);
  context.lineTo(0, 2.5);
  context.lineTo(-3.5, 5);
  context.closePath();
  context.fill();
  context.restore();
}

function render(canvas, world, state, elapsed, fullMap) {
  const context = canvas.getContext('2d');
  const view = viewFor(canvas, state, fullMap);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  clipToCircle(context, view);
  drawLand(context, view);
  drawRoads(context, world?.roads, view);
  if (fullMap) drawDistrictLabels(context, view);
  drawBlips(context, state, view, elapsed);
  drawPlayer(context, view);
  drawNorth(context, view);
  context.restore();
}

export function createMinimap(canvas, world) {
  let elapsed = 0;
  return {
    update(dt) {
      elapsed += Math.max(0, Number(dt) || 0);
    },
    draw(state) {
      render(canvas, world, state, elapsed, false);
    },
  };
}

export function drawFullMap(canvas, world, state) {
  render(canvas, world, state ?? {}, performance.now() / 1000, true);
}
