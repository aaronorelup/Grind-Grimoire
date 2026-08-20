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
    this.ready = false;      // sfx decoded — the game is playable
    this.allReady = false;   // music and voice decoded too
    this._waiters = new Map();
    this._voiceSeq = 0;
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
      this._waiters.get(key)?.forEach((fn) => fn());
      this._waiters.delete(key);
      onProgress?.(++done, entries.length);
    };
    const chunked = async (list) => {
      for (let i = 0; i < list.length; i += 8) await Promise.all(list.slice(i, i + 8).map(load));
    };

    // Blocking on all of it meant 9MB before the title screen would let you in —
    // 10-15s on a home connection. The sfx are 700KB and are the only thing the
    // game cannot fake, so they are the only thing worth waiting for. Music and
    // voice (8MB between them) stream in behind the title screen, and voice() waits
    // briefly on the one line it needs rather than on the whole cast.
    const critical = entries.filter(([k]) => k.startsWith('sfx/'));
    const deferred = entries.filter(([k]) => !k.startsWith('sfx/'));
    await chunked(critical);
    this.ready = true;

    // ordered so the intro narration and the day theme land first
    const weight = (k) => (k.startsWith('music/day') ? 0 : /^voice\/(n_intro|k_intro)/.test(k) ? 1 : k.startsWith('voice/') ? 2 : 3);
    deferred.sort((a, b) => weight(a[0]) - weight(b[0]));
    this.rest = chunked(deferred).then(() => { this.allReady = true; });
  }

  // resolve once `key` is decoded, or after `ms` — a late voice line should delay
  // its own subtitle, never the scene
  waitFor(key, ms = 1200) {
    if (this.buffers.has(key) || this.allReady) return Promise.resolve(this.buffers.has(key));
    return new Promise((resolve) => {
      const list = this._waiters.get(key) || [];
      const t = setTimeout(() => resolve(this.buffers.has(key)), ms);
      list.push(() => { clearTimeout(t); resolve(true); });
      this._waiters.set(key, list);
    });
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
  async voice(id, textLen = 40) {
    this.stopVoice();
    const seq = ++this._voiceSeq;
    await this.waitFor(`voice/${id}`);
    if (seq !== this._voiceSeq) return;   // superseded while we waited on the buffer
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
