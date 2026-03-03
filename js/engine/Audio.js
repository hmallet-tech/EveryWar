// js/engine/Audio.js – Procedural Web Audio API sound engine
// All sounds are synthesised, no external files needed.

let _ctx = null;
let _muted = false;

function ctx() {
    if (!_ctx) {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
}

/** master gain 0-1 */
export function setVolume(v) {
    // We use per-sound gains; to mute we just skip
    _muted = (v <= 0);
}

/** Low-level: play a shaped tone */
function _tone({ freq = 440, freq2 = null, type = 'square', duration = 0.12,
    attack = 0.005, decay = 0.05, sustain = 0.3, release = 0.07,
    gain = 0.25, filterFreq = null, pan = 0 } = {}) {
    if (_muted) return;
    const ac = ctx();
    const now = ac.currentTime;

    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freq2 !== null) osc.frequency.linearRampToValueAtTime(freq2, now + duration);

    const envGain = ac.createGain();
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.linearRampToValueAtTime(gain, now + attack);
    envGain.gain.linearRampToValueAtTime(gain * sustain, now + attack + decay);
    envGain.gain.setValueAtTime(gain * sustain, now + duration);
    envGain.gain.linearRampToValueAtTime(0, now + duration + release);

    let chain = osc;
    if (filterFreq) {
        const filt = ac.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = filterFreq;
        chain.connect(filt);
        chain = filt;
    }
    if (pan !== 0) {
        const panner = ac.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        chain.connect(panner);
        chain = panner;
    }

    chain.connect(envGain);
    envGain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + release + 0.01);
}

/** Noise burst (for explosions/hits) */
function _noise({ duration = 0.15, gain = 0.3, filterFreq = 1200, filterQ = 0.7, attack = 0.002, release = 0.12 } = {}) {
    if (_muted) return;
    const ac = ctx();
    const now = ac.currentTime;
    const bufLen = Math.ceil(ac.sampleRate * (duration + release));
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src = ac.createBufferSource();
    src.buffer = buf;

    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filterFreq;
    filt.Q.value = filterQ;

    const envGain = ac.createGain();
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.linearRampToValueAtTime(gain, now + attack);
    envGain.gain.linearRampToValueAtTime(0, now + duration + release);

    src.connect(filt);
    filt.connect(envGain);
    envGain.connect(ac.destination);
    src.start(now);
    src.stop(now + duration + release + 0.01);
}

// ─── PUBLIC SOUNDS ─────────────────────────────────────────────────────────────

/** Sword clang / melee hit */
export function playMeleeHit() {
    _noise({ duration: 0.04, gain: 0.4, filterFreq: 2500, filterQ: 3, attack: 0.001, release: 0.08 });
    _tone({ freq: 340, freq2: 180, type: 'sawtooth', duration: 0.06, gain: 0.15, filterFreq: 800 });
}

/** Arrow / projectile hit */
export function playRangedHit() {
    _noise({ duration: 0.03, gain: 0.2, filterFreq: 3500, filterQ: 2, release: 0.06 });
    _tone({ freq: 580, freq2: 280, type: 'triangle', duration: 0.04, gain: 0.12 });
}

/** Unit dies */
export function playDeath() {
    _noise({ duration: 0.08, gain: 0.45, filterFreq: 400, filterQ: 0.5, release: 0.25 });
    _tone({ freq: 200, freq2: 60, type: 'sawtooth', duration: 0.18, gain: 0.2, release: 0.3 });
}

/** Building placed / work starts */
export function playConstruct() {
    _tone({ freq: 320, freq2: 480, type: 'square', duration: 0.06, gain: 0.18, filterFreq: 1200 });
    setTimeout(() => _tone({ freq: 480, freq2: 640, type: 'square', duration: 0.06, gain: 0.14, filterFreq: 1200 }), 70);
}

/** Building completed */
export function playBuildComplete() {
    [440, 550, 660, 880].forEach((f, i) => {
        setTimeout(() => _tone({ freq: f, type: 'sine', duration: 0.12, gain: 0.2, attack: 0.01, release: 0.1 }), i * 80);
    });
}

/** Unit trained */
export function playUnitReady() {
    _tone({ freq: 660, type: 'sine', duration: 0.08, gain: 0.18 });
    setTimeout(() => _tone({ freq: 880, type: 'sine', duration: 0.1, gain: 0.2 }), 90);
}

/** Gold mined (small clink) */
export function playGoldClink() {
    _tone({ freq: 1200, freq2: 900, type: 'sine', duration: 0.05, gain: 0.12, attack: 0.001, release: 0.08 });
}

/** Tree chopped */
export function playWoodChop() {
    _noise({ duration: 0.05, gain: 0.28, filterFreq: 600, filterQ: 1.5, release: 0.07 });
}

/** Alert / under attack */
export function playAlert() {
    [480, 480, 640].forEach((f, i) => {
        setTimeout(() => _tone({ freq: f, type: 'square', duration: 0.1, gain: 0.3, filterFreq: 2000 }), i * 120);
    });
}

/** Explosion (spell / mage fireball hit) */
export function playExplosion() {
    _noise({ duration: 0.12, gain: 0.55, filterFreq: 350, filterQ: 0.4, release: 0.35 });
    _tone({ freq: 80, freq2: 30, type: 'sawtooth', duration: 0.2, gain: 0.3, attack: 0.005, release: 0.4 });
}

/** Lightning (chaman) */
export function playLightning() {
    _noise({ duration: 0.06, gain: 0.4, filterFreq: 4000, filterQ: 3, release: 0.15 });
    _tone({ freq: 1200, freq2: 400, type: 'sawtooth', duration: 0.08, gain: 0.2 });
}

/** Button click (UI) */
export function playClick() {
    _tone({ freq: 600, type: 'sine', duration: 0.03, gain: 0.12, attack: 0.001, release: 0.04 });
}

/** Research complete */
export function playResearch() {
    [330, 392, 440, 523, 659].forEach((f, i) => {
        setTimeout(() => _tone({ freq: f, type: 'sine', duration: 0.1, gain: 0.18, release: 0.1 }), i * 70);
    });
}

/** Weather – rain ambiance (looping buffer) */
let _rainNode = null;
export function startRain() {
    if (_muted || _rainNode) return;
    const ac = ctx();
    const bufLen = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 3000;
    const gainNode = ac.createGain();
    gainNode.gain.value = 0.12;
    src.connect(filt); filt.connect(gainNode); gainNode.connect(ac.destination);
    src.start();
    _rainNode = { src, gainNode };
}
export function stopRain() {
    if (!_rainNode) return;
    _rainNode.gainNode.gain.linearRampToValueAtTime(0, ctx().currentTime + 0.5);
    setTimeout(() => { _rainNode?.src.stop(); _rainNode = null; }, 600);
}
