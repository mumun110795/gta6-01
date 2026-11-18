const STORAGE_KEY = 'islaCenizaSaveV1';

function numberOr(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function currentCarIdOr(value) {
  return value === null || value === undefined || value === '' ? null : value;
}

export function saveGame(state = {}) {
  try {
    const payload = {
      cash: numberOr(state.cash),
      completedIds: Array.isArray(state.completedIds) ? [...state.completedIds] : [],
      playerPos: {
        x: numberOr(state.playerPos && state.playerPos.x),
        z: numberOr(state.playerPos && state.playerPos.z),
      },
      timeOfDay: numberOr(state.timeOfDay),
      currentCarId: currentCarIdOr(state.currentCarId),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
