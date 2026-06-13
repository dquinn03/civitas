'use strict';
/* CIVITAS audio.js — Sensory Environment (Module A support).
   Tone.js (CDN) generates infinite brown noise, pink noise, and a rain filter
   to protect cognitive bandwidth. Degrades gracefully if the CDN is absent. */

const Sensory = (() => {

  let current = null;   // 'brown' | 'pink' | 'rain' | null
  let nodes = [];
  let volume = 0.5;

  function available() { return typeof Tone !== 'undefined'; }

  function disposeAll() {
    nodes.forEach(n => { try { n.stop && n.stop(); } catch {} try { n.dispose(); } catch {} });
    nodes = [];
  }

  function applyVolume() {
    if (!available()) return;
    // map 0..1 slider to -48dB..0dB, hard-mute at zero
    Tone.Destination.volume.value = volume <= 0 ? -Infinity : (volume - 1) * 48;
  }

  async function start(mode) {
    if (!available()) { U.toast('Tone.js CDN not loaded — audio unavailable offline', 'warn'); return; }
    await Tone.start();   // browsers require a user gesture before audio
    stop();
    if (mode === 'brown' || mode === 'pink') {
      const noise = new Tone.Noise(mode).toDestination();
      noise.start();
      nodes.push(noise);
    } else if (mode === 'rain') {
      // pink noise through a swept low-pass = steady rainfall on a tin roof
      const filter = new Tone.Filter(900, 'lowpass').toDestination();
      const noise = new Tone.Noise('pink').connect(filter);
      const lfo = new Tone.LFO(0.07, 500, 1400).start();
      lfo.connect(filter.frequency);
      // faint high hiss for droplet texture
      const hiss = new Tone.Gain(0.04).toDestination();
      const hp = new Tone.Filter(4000, 'highpass').connect(hiss);
      const white = new Tone.Noise('white').connect(hp);
      noise.start(); white.start();
      nodes.push(noise, white, filter, hp, hiss, lfo);
    }
    current = mode;
    applyVolume();
    render();
  }

  function stop() {
    disposeAll();
    current = null;
    render();
  }

  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    applyVolume();
  }

  function render() {
    document.querySelectorAll('[data-noise]').forEach(btn => {
      btn.classList.toggle('noise-on', btn.dataset.noise === current);
    });
  }

  function bind() {
    document.querySelectorAll('[data-noise]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.noise;
        (current === mode) ? stop() : start(mode);
      });
    });
    const vol = document.getElementById('noise-volume');
    if (vol) vol.addEventListener('input', () => setVolume(+vol.value / 100));
  }

  return { start, stop, setVolume, bind, get current() { return current; } };
})();
