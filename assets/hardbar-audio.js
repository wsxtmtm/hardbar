/* ══════════════════════════════════════════════════
   ХАРДБАР — Audio Engine
   Dark Techno Ambient — 132 BPM — Procedural Web Audio
   ══════════════════════════════════════════════════ */
(function () {
  let ctx = null;
  let master = null;
  let started = false;
  let stopRequested = false;
  let nextStep = 0;
  let stepIdx = 0;
  const bpm = 132;
  const stepDur = 60 / bpm / 4;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1024) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6);
    }
    shaper.curve = curve;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 6500;
    master.connect(shaper);
    shaper.connect(lpf);
    lpf.connect(ctx.destination);
  }

  function fadeIn() {
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 1.2);
  }

  function fadeOut() {
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.8);
  }

  function kick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.4);
    const c = ctx.createOscillator();
    const cg = ctx.createGain();
    c.type = "triangle"; c.frequency.value = 1200;
    cg.gain.setValueAtTime(0.4, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    c.connect(cg); cg.connect(master);
    c.start(t); c.stop(t + 0.03);
  }

  function hat(t, open) {
    open = open || false;
    const bufSize = ctx.sampleRate * (open ? 0.15 : 0.04);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(open ? 0.15 : 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.18 : 0.05));
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(t);
  }

  function acid(t, freq, dur) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 14;
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.04);
    f.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function drone(t) {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = "sawtooth"; o1.frequency.value = 55;
    o2.type = "sawtooth"; o2.frequency.value = 55.4;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 320; f.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.12, t + 4);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(t); o2.start(t);
    return function() { o1.stop(); o2.stop(); };
  }

  let droneStop = null;
  const acidPattern = [
    {n:0,o:1},{n:null},{n:0,o:1,a:0.5},{n:null},
    {n:3,o:1},{n:null},{n:0,o:1},{n:null},
    {n:7,o:1},{n:null},{n:0,o:2},{n:5,o:1,a:0.3},
    {n:0,o:1},{n:null},{n:-2,o:1},{n:null}
  ];

  function scheduler() {
    if (stopRequested) return;
    while (nextStep < ctx.currentTime + 0.15) {
      const s = stepIdx % 16;
      if (s % 4 === 0) kick(nextStep);
      if (s % 2 === 1) hat(nextStep, false);
      if (s === 6 || s === 14) hat(nextStep, true);
      const p = acidPattern[s];
      if (p && p.n !== null) {
        const f = 55 * Math.pow(2, p.n / 12) * (p.o || 1);
        acid(nextStep, f, p.a || stepDur * 0.9);
      }
      nextStep += stepDur;
      stepIdx++;
    }
    setTimeout(scheduler, 25);
  }

  window.HardbarAudio = {
    start: function() {
      if (started) { fadeIn(); return; }
      init();
      if (ctx.state === "suspended") ctx.resume();
      started = true;
      stopRequested = false;
      nextStep = ctx.currentTime + 0.1;
      stepIdx = 0;
      droneStop = drone(nextStep);
      fadeIn();
      scheduler();
    },
    pause: function() {
      if (!started) return;
      stopRequested = true;
      started = false;
      fadeOut();
      setTimeout(function() {
        if (droneStop) { try { droneStop(); } catch(e){} droneStop = null; }
      }, 900);
    },
    toggle: function() {
      if (started) { this.pause(); return false; }
      else { this.start(); return true; }
    },
    isPlaying: function() { return started; }
  };
})();
