// Web Audio API sound generator - zero dependencies, synthesized in-browser

let audioCtx = null;
let masterGain = null;
let soundEnabled = true;

try {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem('netwise.soundEnabled') : null;
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
} catch {
  soundEnabled = true;
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Browsers may keep the context suspended until a later user gesture.
    });
  }
  return audioCtx;
}

function connectOutput(osc, gain) {
  osc.connect(gain);
  gain.connect(masterGain || audioCtx.destination);
}

function scheduleTone({ frequency, endFrequency = frequency, start, duration, volume = 0.12, type = 'sine' }) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = start ?? ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    if (endFrequency !== frequency) {
      osc.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
    }

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.025);
    gain.gain.setValueAtTime(volume, startTime + Math.max(0.025, duration - 0.08));
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    connectOutput(osc, gain);
    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {
    // Ignore unsupported or interrupted Web Audio operations.
  }
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('netwise.soundEnabled', String(soundEnabled));
    }
  } catch {
    // Ignore storage errors
  }
}

export function toggleSound() {
  const next = !soundEnabled;
  setSoundEnabled(next);
  if (next) {
    getAudioContext();
    playChirp();
  }
  return next;
}

export function playPacketHop() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  scheduleTone({ frequency: 440, endFrequency: 660, start: ctx.currentTime, duration: 0.14, volume: 0.18 });
}

export function playPingSuccess() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    scheduleTone({
      frequency,
      start: now + index * 0.12,
      duration: 0.32,
      volume: 0.22,
      type: 'triangle',
    });
  });
}

export function playPacketDrop() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  scheduleTone({ frequency: 220, endFrequency: 98, start: ctx.currentTime, duration: 0.38, volume: 0.2, type: 'sawtooth' });
}

export function playChirp() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  scheduleTone({ frequency: 700, endFrequency: 1050, start: ctx.currentTime, duration: 0.22, volume: 0.18, type: 'sine' });
}
