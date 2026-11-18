export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  let engine = null;
  let engineTarget = 0;
  let siren = null;
  let radio = null;
  let station = -1;
  let engineRpm = 0;

  function ensure() {
    if (!context || !master) return null;
    return context;
  }

  function setValue(param, value, ramp = 0.05) {
    const time = context.currentTime;
    param.cancelScheduledValues(time);
    param.setValueAtTime(param.value, time);
    param.linearRampToValueAtTime(value, time + ramp);
  }

  function makeEngine() {
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 45;
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.Q.value = 6;
    gain.gain.value = 0;
    oscillator.connect(filter).connect(gain).connect(master);
    oscillator.start();
    return { oscillator, filter, gain };
  }

  function setEngine(on, rpm01 = 0) {
    if (!ensure()) return;
    const wanted = on ? 0.09 : 0;
    if (on && !engine) engine = makeEngine();
    if (!engine) return;
    engineTarget = wanted;
    setValue(engine.gain.gain, wanted, on ? 0.1 : 0.18);
    if (!on) return;
    const rpm = Math.min(1, Math.max(0, Number(rpm01) || 0));
    engineRpm = rpm;
    const now = context.currentTime;
    engine.oscillator.frequency.cancelScheduledValues(now);
    engine.filter.frequency.cancelScheduledValues(now);
    engine.oscillator.frequency.linearRampToValueAtTime(46 + rpm * 145, now + 0.07);
    engine.filter.frequency.linearRampToValueAtTime(280 + rpm * 1750, now + 0.07);
  }

  function makeSiren() {
    const oscillator = context.createOscillator();
    const lfo = context.createOscillator();
    const depth = context.createGain();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 800;
    lfo.type = 'sine';
    lfo.frequency.value = 0.55;
    depth.gain.value = 150;
    gain.gain.value = 0;
    lfo.connect(depth).connect(oscillator.frequency);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    lfo.start();
    return { oscillator, gain };
  }

  function setSiren(on, mode = 'off') {
    if (!ensure()) return;
    if (on && !siren) siren = makeSiren();
    if (!siren) return;
    const active = on && mode === 'wail';
    setValue(siren.gain.gain, active ? 0.07 : 0, active ? 0.08 : 0.2);
  }

  function burst(duration, gainValue, filterType, frequency) {
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      const decay = 1 - index / frames;
      data[index] = (Math.random() * 2 - 1) * decay * decay;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(filter).connect(gain).connect(master);
    source.start();
    return { source, gain };
  }

  function blip(type, frequency, duration, gainValue, endFrequency) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    }
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function playShot() {
    if (!ensure()) return;
    const noise = burst(0.16, 0.28, 'lowpass', 1500);
    const now = context.currentTime;
    noise.gain.gain.setValueAtTime(0.28, now);
    noise.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    noise.source.start(now);
    blip('square', 220, 0.08, 0.13, 70);
  }

  function playHit() {
    if (!ensure()) return;
    blip('sine', 105, 0.15, 0.24, 42);
    burst(0.06, 0.07, 'lowpass', 360);
  }

  function playCash() {
    if (!ensure()) return;
    blip('sine', 880, 0.11, 0.16);
    window.setTimeout(() => {
      if (context) blip('sine', 1320, 0.13, 0.13);
    }, 85);
  }

  function playStep() {
    if (!ensure()) return;
    burst(0.035, 0.05, 'bandpass', 880);
  }

  function stopRadio() {
    if (!radio) return;
    if (radio.timer) window.clearInterval(radio.timer);
    const current = radio;
    radio = null;
    if (current.gain) setValue(current.gain.gain, 0, 0.18);
    window.setTimeout(() => {
      current.oscillators.forEach((oscillator) => {
        try { oscillator.stop(); } catch { }
      });
    }, 220);
  }

  function stationName() {
    return station === 0 ? 'Radio Ceniza' : station === 1 ? 'Neon FM' : 'Off';
  }

  function startRadio(index) {
    stopRadio();
    station = index;
    if (!ensure() || index !== 0 && index !== 1) return;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    setValue(gain.gain, 0.26, 0.25);
    const oscillators = [];
    let nextTime = context.currentTime + 0.12;
    let step = 0;
    const cenizaChords = [
      [147, 220, 262, 330],
      [131, 196, 233, 294],
      [110, 165, 208, 262],
      [123, 185, 220, 294],
    ];
    const cenizaBass = [37, 33, 28, 31];
    const neonArpeggio = [330, 392, 440, 523, 440, 392, 349, 330];
    const neonBass = [83, 83, 62, 70];

    function voice(type, frequency, time, duration, level) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, time);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(level, time + Math.min(0.1, duration * 0.3));
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(envelope).connect(gain);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.03);
      oscillators.push(oscillator);
      return oscillator;
    }

    function schedule() {
      while (nextTime < context.currentTime + 0.8) {
        if (station === 0) {
          const chord = cenizaChords[step % 4];
          chord.forEach((frequency, noteIndex) => {
            voice('triangle', frequency, nextTime, 1.7, 0.055 - noteIndex * 0.007);
          });
          voice('sine', cenizaBass[step % 4] * 2, nextTime, 1.55, 0.13);
          nextTime += 1.7;
        } else {
          const barStep = step % 16;
          voice('square', neonArpeggio[barStep % 8], nextTime, 0.18, 0.055);
          if (barStep % 4 === 0) {
            voice('sine', neonBass[(barStep / 4 | 0) % 4] * 2, nextTime, 0.4, 0.15);
          }
          nextTime += 0.19;
        }
        step += 1;
      }
    }

    schedule();
    radio = { gain, oscillators, timer: window.setInterval(schedule, 220) };
  }

  function setRadio(index) {
    station = index;
    if (!ensure()) return;
    startRadio(index);
  }

  function toggleMute() {
    muted = !muted;
    if (ensure()) setValue(master.gain.gain, muted ? 0 : 1, 0.05);
    return muted;
  }

  function resume() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
    setEngine(engineTarget > 0, engineRpm);
    if (station === 0 || station === 1) startRadio(station);
  }

  return {
    resume,
    setEngine,
    setSiren,
    playShot,
    playHit,
    playCash,
    playStep,
    setRadio,
    toggleMute,
    get muted() { return muted; },
    stationName,
  };
}
