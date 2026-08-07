// AudioManager — loads the ElevenLabs-generated files from /audio/,
// plays SFX / looped ambience / crossfaded music / voice lines with promises.
// Falls back to tiny synth blips if a file is missing so the game never breaks.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.currentMusic = null;   // { src, gain, name }
    this.currentVoice = null;   // { src, resolve }
    this.loops = new Map();     // name -> {src,gain}
    this.masters = {};
    this.ready = false;
  }

  async init(onProgress) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const mk = (v) => { const g = this.ctx.createGain(); g.gain.value = v; g.connect(this.ctx.destination); return g; };
    this.masters = { sfx: mk(0.9), music: mk(0.5), voice: mk(1.0), amb: mk(0.55) };

    let manifest = { voice: {}, sfx: {}, music: {} };
    try { manifest = await (await fetch(`${import.meta.env.BASE_URL}audio/manifest.json`)).json(); } catch { /* no audio generated */ }
    this.manifest = manifest;

    const entries = [];
    for (const kind of ['voice', 'sfx', 'music'])
      for (const [id, file] of Object.entries(manifest[kind] || {}))
        entries.push([`${kind}/${id}`, `${import.meta.env.BASE_URL}audio/${file}`]);

    let done = 0;
    const load = async ([key, url]) => {
      try {
        const ab = await (await fetch(url)).arrayBuffer();
        this.buffers.set(key, await this.ctx.decodeAudioData(ab));
      } catch { /* missing file -> synth fallback */ }
      onProgress?.(++done, entries.length);
    };
    // load in chunks of 8
    for (let i = 0; i < entries.length; i += 8)
      await Promise.all(entries.slice(i, i + 8).map(load));
    this.ready = true;
  }

  resume() { this.ctx?.resume(); }

  _play(key, { vol = 1, rate = 1, loop = false, out = 'sfx' } = {}) {
    const buf = this.buffers.get(key);
    if (!buf || !this.ctx) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = loop; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.masters[out]);
    src.start();
    return { src, gain: g, stop: (fade = 0.05) => { try { g.gain.setTargetAtTime(0, this.ctx.currentTime, fade); src.stop(this.ctx.currentTime + fade * 4 + 0.01); } catch {} } };
  }

  sfx(name, opts = {}) {
    const h = this._play(`sfx/${name}`, opts);
    if (!h) this._blip(opts.vol ?? 0.5);
    return h;
  }

  // volume from distance to listener (the player)
  sfxAt(name, dist, maxDist = 40, opts = {}) {
    if (dist > maxDist) return null;
    const vol = (opts.vol ?? 1) * Math.pow(1 - dist / maxDist, 1.6);
    return this.sfx(name, { ...opts, vol });
  }

  loopStart(name, key, opts = {}) {
    if (this.loops.has(key)) return this.loops.get(key);
    const h = this._play(`sfx/${name}`, { ...opts, loop: true, out: opts.out || 'amb' });
    if (h) this.loops.set(key, h);
    return h;
  }
  loopSet(key, vol, rate) {
    const h = this.loops.get(key);
    if (!h || !this.ctx) return;
    h.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.08);
    if (rate) h.src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.1);
  }
  loopStop(key) { this.loops.get(key)?.stop(0.2); this.loops.delete(key); }

  music(name, fade = 1.6) {
    if (this.currentMusic?.name === name) return;
    const old = this.currentMusic;
    if (old) { old.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3); setTimeout(() => { try { old.src.stop(); } catch {} }, fade * 1000 + 300); }
    const h = this._play(`music/${name}`, { vol: 0, loop: true, out: 'music' });
    if (h) {
      h.gain.gain.setTargetAtTime(1, this.ctx.currentTime, fade / 3);
      this.currentMusic = { ...h, name };
    } else this.currentMusic = null;
  }
  duckMusic(on) {
    if (!this.ctx) return;
    this.masters.music.gain.setTargetAtTime(on ? 0.22 : 0.5, this.ctx.currentTime, 0.25);
  }

  // Play a voice line; resolves when it ends. Falls back to a reading-time delay.
  voice(id, textLen = 40) {
    this.stopVoice();
    return new Promise((resolve) => {
      const h = this._play(`voice/${id}`, { out: 'voice' });
      if (!h) { const t = setTimeout(resolve, 900 + textLen * 45); this.currentVoice = { stop: () => { clearTimeout(t); resolve(); } }; return; }
      let finished = false;
      const done = () => { if (!finished) { finished = true; this.currentVoice = null; clearTimeout(guard); resolve(); } };
      // safety net: if the context is suspended (hidden tab), onended never fires
      const guard = setTimeout(done, h.src.buffer.duration * 1000 + 1500);
      h.src.onended = done;
      this.currentVoice = { stop: () => { h.stop(0.03); done(); } };
    });
  }
  stopVoice() { this.currentVoice?.stop(); this.currentVoice = null; }

  _blip(vol = 0.4) { // fallback synth click so silent installs still give feedback
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = 300 + Math.random() * 500; o.type = 'triangle';
    g.gain.setValueAtTime(vol * 0.25, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    o.connect(g); g.connect(this.masters.sfx); o.start(); o.stop(this.ctx.currentTime + 0.13);
  }
}
