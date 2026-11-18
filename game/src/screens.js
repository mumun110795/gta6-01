function show(element) {
  if (element) element.style.display = 'grid';
}

function hide(element) {
  if (element) element.style.display = 'none';
}

function setContent(id, title, copy, actionLabel) {
  const card = document.getElementById(id);
  if (!card) return;
  const heading = card.querySelector('#endcard-title') ?? card.querySelector('h2');
  const copyElement = card.querySelector('.overlay-copy');
  const action = card.querySelector('[data-action="respawn"], [data-action="reload"]');
  if (heading) heading.textContent = title;
  if (copyElement) copyElement.textContent = copy;
  if (action) action.textContent = actionLabel;
}

function createMapOverlay() {
  const existing = document.getElementById('map-overlay');
  if (existing) return existing;
  const overlay = document.createElement('section');
  overlay.id = 'map-overlay';
  overlay.className = 'overlay';
  overlay.style.display = 'none';
  const card = document.createElement('div');
  const heading = document.createElement('h2');
  heading.className = 'title';
  heading.style.fontSize = 'clamp(36px, 7vw, 68px)';
  heading.textContent = 'Island Map';
  const canvas = document.createElement('canvas');
  canvas.id = 'fullmap';
  canvas.width = 680;
  canvas.height = 680;
  canvas.style.maxWidth = 'min(88vw, 680px)';
  canvas.style.border = '2px solid rgba(255,179,71,.55)';
  canvas.style.borderRadius = '14px';
  canvas.style.background = '#0b3b4d';
  const actions = document.createElement('div');
  actions.className = 'menu-actions';
  const close = document.createElement('button');
  close.type = 'button';
  close.dataset.action = 'close-map';
  close.textContent = 'Close Map';
  actions.append(close);
  card.append(heading, canvas, actions);
  overlay.append(card);
  document.body.append(overlay);
  return overlay;
}

function wireButton(parent, selector, handler) {
  const button = parent?.querySelector(selector);
  if (!button) return;
  button.addEventListener('click', () => handler());
}

function bindCloseMap(overlay, onClose) {
  if (!overlay || overlay.dataset.closeBound === 'true') return;
  overlay.dataset.closeBound = 'true';
  wireButton(overlay, '[data-action="close-map"]', onClose);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) onClose();
  });
}

export function createScreens(refs = {}) {
  const menu = refs.menu ?? document.getElementById('menu');
  const pause = refs.pause ?? document.getElementById('pause');
  const endcard = refs.endcard ?? document.getElementById('endcard');
  const mapOverlay = refs.mapOverlay ?? createMapOverlay();
  const fullMap = refs.fullMap ?? mapOverlay.querySelector('#fullmap');
  let currentEndKind = '';
  let endHandler = null;

  function endAction() {
    const handler = endHandler;
    hide(endcard);
    endHandler = null;
    if (handler) handler(currentEndKind);
  }

  return {
    showTitle(onStart) {
      show(menu);
      hide(pause);
      hide(endcard);
      hide(mapOverlay);
      const start = menu?.querySelector('[data-action="start"]');
      const resume = menu?.querySelector('[data-action="continue"]');
      if (start && !start.dataset.wired) {
        start.dataset.wired = 'true';
        start.addEventListener('click', () => {
          hide(menu);
          if (typeof onStart === 'function') onStart();
        });
      }
      if (resume && !resume.dataset.wired) {
        resume.dataset.wired = 'true';
        resume.addEventListener('click', () => {
          hide(menu);
          if (typeof onStart === 'function') onStart();
        });
      }
    },
    hideTitle() {
      hide(menu);
    },
    showPause() {
      show(pause);
    },
    hidePause() {
      hide(pause);
    },
    showMap() {
      show(mapOverlay);
      bindCloseMap(mapOverlay, () => this.hideMap());
    },
    hideMap() {
      hide(mapOverlay);
    },
    showEnd(kind, stats = {}, onAction = null) {
      const title = kind === 'complete'
        ? 'Ceniza Complete'
        : kind === 'busted' ? 'Busted' : 'Wasted';
      const lines = {
        complete: 'Every contract is closed. The island knows your name.',
        busted: 'The Ceniza police took your cut and your liberty.',
        wasted: 'Isla Ceniza keeps the change.',
      };
      setContent('endcard', title, lines[kind] ?? '', kind === 'complete' ? 'Restart' : 'Clinic');
      if (stats?.reward) {
        const copyElement = endcard?.querySelector('.overlay-copy');
        if (copyElement) copyElement.textContent = `${copyElement.textContent} Earned $${stats.reward.toLocaleString('en-US')}.`;
      }
      endHandler = onAction;
      currentEndKind = kind;
      show(endcard);
    },
  };
}
