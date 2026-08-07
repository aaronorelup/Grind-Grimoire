// DOM HUD: stat bars, clock, objective, toasts, interaction prompt,
// compliment popups, and a live canvas minimap.
export class HUD {
  constructor(G) {
    this.G = G;
    this.el = {
      hud: document.getElementById('hud'),
      hp: document.getElementById('bar-hp'), mp: document.getElementById('bar-mp'),
      st: document.getElementById('bar-st'), ego: document.getElementById('bar-ego'),
      thp: document.getElementById('txt-hp'), tmp: document.getElementById('txt-mp'),
      tst: document.getElementById('txt-st'), tego: document.getElementById('txt-ego'),
      clock: document.getElementById('clock'), objective: document.getElementById('objective'),
      inspo: document.getElementById('inspo-count'), cash: document.getElementById('cash'),
      drip: document.getElementById('drip'), prompt: document.getElementById('prompt'),
      toasts: document.getElementById('toasts'), compliment: document.getElementById('compliment'),
      vignette: document.getElementById('vignette'),
    };
    this.map = document.getElementById('minimap').getContext('2d');
    this._lastPrompt = undefined;
  }

  show() { this.el.hud.classList.remove('hidden'); }

  setClock(hour) {
    const h24 = ((hour % 24) + 24) % 24;
    const h12 = Math.floor(h24) % 12 || 12;
    const m = Math.floor((h24 % 1) * 60);
    this.el.clock.textContent = `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  }
  setObjective(t) { this.el.objective.textContent = t; }
  setInspo(n, total) { this.el.inspo.textContent = n; }
  setCash(n) { this.el.cash.textContent = `$${n}`; }
  setDrip(n) { this.el.drip.textContent = `drip ${n}/6`; }

  prompt(html) {
    if (html === this._lastPrompt) return;
    this._lastPrompt = html;
    if (!html) this.el.prompt.classList.add('hidden');
    else { this.el.prompt.innerHTML = html; this.el.prompt.classList.remove('hidden'); }
  }

  toast(msg, cls = '', ms = 4200) {
    const d = document.createElement('div');
    d.className = `toast ${cls}`;
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => { d.style.transition = 'opacity .5s'; d.style.opacity = 0; setTimeout(() => d.remove(), 550); }, ms);
  }

  compliment(text) {
    const c = this.el.compliment;
    c.textContent = text;
    c.classList.remove('hidden');
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    clearTimeout(this._compT);
    this._compT = setTimeout(() => c.classList.add('hidden'), 2600);
  }

  update() {
    const p = this.G.player;
    const pct = (v, m) => `${Math.max(0, Math.min(100, (v / m) * 100))}%`;
    this.el.hp.style.width = pct(p.hp, p.maxHp);
    this.el.mp.style.width = pct(p.mp, p.maxMp);
    this.el.st.style.width = pct(p.st, p.maxSt);
    this.el.ego.style.width = `${p.ego}%`;
    this.el.thp.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    this.el.tmp.textContent = `${Math.ceil(p.mp)}/${p.maxMp}`;
    this.el.tst.textContent = `${Math.ceil(p.st)}/${p.maxSt}`;
    this.el.tego.textContent = `${Math.round(p.ego)}`;
    this.el.vignette.style.opacity = p.hp < p.maxHp * 0.35 ? 0.35 + 0.4 * (1 - p.hp / (p.maxHp * 0.35)) : (p.iframes > 0.6 ? 0.5 : 0);
    this.drawMap();
  }

  drawMap() {
    const ctx = this.map, S = 180, W2 = 250;
    const X = (x) => ((x + W2) / (W2 * 2)) * S, Z = (z) => ((z + W2) / (W2 * 2)) * S;
    ctx.clearRect(0, 0, S, S);
    // terrain hints
    ctx.fillStyle = 'rgba(30,90,130,0.9)'; ctx.fillRect(0, 0, X(-95), S);            // ocean
    ctx.fillStyle = 'rgba(210,190,140,0.5)'; ctx.fillRect(X(-95), 0, X(-45) - X(-95), S); // sand
    ctx.fillStyle = 'rgba(160,140,100,0.5)'; ctx.fillRect(X(-45), 0, X(-25) - X(-45), S); // boardwalk
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2;
    for (const cx of [10, 80, 150]) { ctx.beginPath(); ctx.moveTo(X(cx), 0); ctx.lineTo(X(cx), S); ctx.stroke(); }
    for (const cz of [-180, -120, -60, 0, 60, 120, 180]) { ctx.beginPath(); ctx.moveTo(X(-25), Z(cz)); ctx.lineTo(S, Z(cz)); ctx.stroke(); }
    // shops
    for (const id of Object.keys(this.G.world.shops)) {
      const s = this.G.world.shops[id];
      ctx.fillStyle = `#${s.color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(X(s.door.x) - 2, Z(s.door.z) - 2, 4, 4);
    }
    // inspiration (gold pulses)
    const t = performance.now() / 400;
    for (const ins of this.G.world.inspirations) {
      if (ins.taken) continue;
      ctx.fillStyle = `rgba(255,215,90,${0.6 + Math.sin(t + ins.pos.x) * 0.4})`;
      ctx.beginPath(); ctx.arc(X(ins.pos.x), Z(ins.pos.z), 3, 0, 7); ctx.fill();
    }
    // friends
    ctx.fillStyle = '#7dffa8';
    for (const id of Object.keys(this.G.npcs?.friends || {})) {
      const f = this.G.npcs.friends[id];
      if (!f.met) { ctx.beginPath(); ctx.arc(X(f.pos.x), Z(f.pos.z), 2.5, 0, 7); ctx.fill(); }
    }
    // rooftop side quest marker (promoter / meeting point)
    const story = this.G.story;
    if (story && story.roofQuest < 2) {
      const m = story.roofMarker || this.G.npcs?.promoter?.group.position;
      if (m) {
        ctx.fillStyle = `rgba(140,255,190,${0.55 + Math.sin(t) * 0.35})`;
        ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), 3.2, 0, 7); ctx.fill();
      }
    }
    // party star
    const py = this.G.world.partyYard;
    ctx.fillStyle = '#ffd75c';
    ctx.font = '900 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★', X(py.center.x), Z(py.center.z) + 4);
    // fiends nearby
    ctx.fillStyle = 'rgba(255,60,60,0.9)';
    for (const e of this.G.enemies?.list || []) {
      if (e.dead || e.pos.distanceTo(this.G.player.pos) > 70) continue;
      ctx.fillRect(X(e.pos.x) - 1.2, Z(e.pos.z) - 1.2, 2.4, 2.4);
    }
    // player arrow
    const p = this.G.player;
    ctx.save();
    ctx.translate(X(p.pos.x), Z(p.pos.z));
    ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) * -1 + Math.PI / 2 + Math.PI);
    ctx.fillStyle = '#5ce0ff';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.4, 4); ctx.lineTo(-3.4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
