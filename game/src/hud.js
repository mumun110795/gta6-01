function setDisplay(element, visible) {
  if (element) element.style.display = visible ? 'block' : 'none';
}

export function createHud(refs = {}) {
  const cash = refs.cash ?? document.getElementById('hud-cash');
  const clock = refs.clock ?? document.getElementById('hud-clock');
  const speed = refs.speed ?? document.getElementById('hud-speed');
  const speedValue = refs.speedValue ?? document.getElementById('hud-speed-value');
  const banner = refs.banner ?? document.getElementById('hud-banner');
  const objective = refs.objective ?? document.getElementById('hud-objective');
  const dialogue = refs.dialogue ?? document.getElementById('dialogue');
  const dialogueName = refs.dialogueName ?? document.getElementById('dialogue-name') ??
    document.getElementById('dialogue-speaker');
  const dialogueText = refs.dialogueText ?? document.getElementById('dialogue-text');

  let bannerTimer = 0;
  let flashTimer = 0;
  let typeTimer = 0;
  let lineIndex = 0;
  let characterIndex = 0;
  let targetText = '';
  let lines = [];
  let onComplete = null;
  let typing = false;
  let keyHandler = null;
  let clickHandler = null;

  function clearDialogueListeners() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    if (clickHandler && dialogue) dialogue.removeEventListener('click', clickHandler);
    keyHandler = null;
    clickHandler = null;
  }

  function finishDialogue() {
    if (!typing && lineIndex >= lines.length) return;
    clearDialogueListeners();
    setDisplay(dialogue, false);
    if (dialogueText) dialogueText.textContent = '';
    lines = [];
    onComplete = null;
    typing = false;
    lineIndex = 0;
    characterIndex = 0;
    typeTimer = 0;
  }

  function completeLine() {
    characterIndex = targetText.length;
    if (dialogueText) dialogueText.textContent = targetText;
    typing = false;
    typeTimer = 0;
  }

  function startLine() {
    const line = lines[lineIndex] ?? {};
    targetText = String(line.text ?? '');
    characterIndex = 0;
    typing = true;
    if (dialogueName) dialogueName.textContent = String(line.speaker ?? line.name ?? '');
    if (dialogueText) dialogueText.textContent = '';
  }

  function advance() {
    if (!lines.length) return;
    if (typing) {
      completeLine();
      return;
    }
    lineIndex += 1;
    if (lineIndex >= lines.length) {
      const done = onComplete;
      finishDialogue();
      if (done) done();
      return;
    }
    startLine();
  }

  function update(dt) {
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) {
        bannerTimer = 0;
        if (banner) banner.textContent = '';
      }
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0 && banner) banner.textContent = '';
    }
    if (!typing) return;
    typeTimer += dt;
    const shown = Math.floor(typeTimer * 45);
    if (shown > characterIndex) {
      characterIndex = Math.min(shown, targetText.length);
      if (dialogueText) dialogueText.textContent = targetText.slice(0, characterIndex);
    }
    if (characterIndex >= targetText.length) typing = false;
  }

  return {
    update,
    setBanner(title, sub = '') {
      if (!banner) return;
      banner.textContent = sub ? `${title} — ${sub}` : title;
      bannerTimer = 4;
      flashTimer = 0;
    },
    setObjective(text) {
      if (objective) objective.textContent = text;
    },
    showDialogue(nextLines, onDone) {
      clearDialogueListeners();
      lines = Array.isArray(nextLines) ? nextLines : [];
      onComplete = typeof onDone === 'function' ? onDone : null;
      lineIndex = 0;
      setDisplay(dialogue, true);
      if (!lines.length) {
        finishDialogue();
        if (onComplete) onComplete();
        return;
      }
      keyHandler = (event) => {
        if (event.key === 'e' || event.key === 'E') {
          event.preventDefault();
          advance();
        }
      };
      clickHandler = (event) => {
        event.preventDefault();
        advance();
      };
      document.addEventListener('keydown', keyHandler);
      if (dialogue) dialogue.addEventListener('click', clickHandler);
      startLine();
    },
    hideDialogue() {
      finishDialogue();
    },
    setCash(value) {
      if (cash) cash.textContent = `$${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US')}`;
    },
    setClock(text) {
      if (clock) clock.textContent = text;
    },
    setSpeed(kmh) {
      if (speedValue) speedValue.textContent = String(Math.max(0, Math.floor(Number(kmh) || 0)));
      setDisplay(speed, Number(kmh) > 0);
    },
    flashMessage(text) {
      if (!banner) return;
      banner.textContent = text;
      flashTimer = 1.6;
      bannerTimer = 0;
    },
  };
}
