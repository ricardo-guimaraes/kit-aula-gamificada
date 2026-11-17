// Sons sintetizados com Web Audio: nada para baixar, nada para licenciar.
let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Chame num clique/tecla para destravar o áudio no navegador. */
export const unlockAudio = () => void ac();
export const setSound = (on: boolean) => {
  enabled = on;
};
export const soundOn = () => enabled;

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, when = 0, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function knock(when: number, gain: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const len = Math.floor(a.sampleRate * 0.12);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  tone(140, 0.18, 'sine', gain * 0.8, when, 60);
}

/** Martelo: duas batidas e uma terceira mais forte. */
export function playGavel() {
  knock(0, 0.5);
  knock(0.16, 0.5);
  knock(0.38, 0.9);
}

export const playTick = (urgent = false) => tone(urgent ? 1100 : 880, 0.06, 'square', 0.05);
export const playBid = () => {
  tone(660, 0.08, 'triangle', 0.12);
  tone(990, 0.12, 'triangle', 0.1, 0.06);
};
export const playFlip = () => tone(300, 0.25, 'sine', 0.12, 0, 900);
export const playFanfare = () => {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.14, i * 0.12));
};
