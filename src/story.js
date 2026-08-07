// Quest state + every scripted scene: intro, the five MP shops, clothing
// shops, friend encounters, inspiration, death, side quests, and the finale.
import * as THREE from 'three';
import { makePerson } from './characters.js';

const DRIP_ITEMS = {
  drip1: [
    { key: 'sherpa', name: 'Midnight Sherpa', fx: 'strangers will weep', price: 40 },
    { key: 'chain', name: 'Chain of Intention', fx: '14k intentional gold', price: 35 },
  ],
  drip2: [
    { key: 'cape', name: 'Aura Cape', fx: 'flutters even indoors', price: 60 },
    { key: 'shades', name: 'Prism Shades', fx: 'UV + hex protection', price: 25 },
  ],
  drip3: [
    { key: 'kicks', name: 'Cloudstep Kicks', fx: 'soles of pure vibe', price: 30 },
    { key: 'halo', name: 'Halo Snapback', fx: 'certified angel fit', price: 45 },
  ],
};

export class Story {
  constructor(G) {
    this.G = G;
    this.inspiration = 0;
    this.TOTAL = 12;
    this.cash = 20;
    this.dripCount = 0;
    this.owned = new Set();
    this.visited = new Set();   // shops with cutscene done
    this.firstDrip = false;
    this.partyStarted = false;
    this.shopOpen = null;
    this.busy = false;
    this.startTime = performance.now();
    this.mixtapeOwned = false;
    this.complimentQueue = [];   // one unique compliment queued per drip piece
    this.roofQuest = 0;          // 0 = pier intro, 1 = meet at the base, 2 = done
    this.roofMarker = null;      // minimap hint while quest is active
    this.roofBeam = null;
    this.roofBldg = null;
  }

  static COMPLIMENTS = {
    sherpa: { line: 'st_1', kai: 'k_comp_1', text: 'YO! THE DRIP IS CRAZY!' },
    chain:  { line: 'st_2', kai: 'k_comp_2', text: 'OMG THE FIT. THE FIT!' },
    cape:   { line: 'st_3', kai: 'k_comp_3', text: '"iconic. you look iconic."' },
    shades: { line: 'st_4', kai: 'k_comp_1', text: 'EXCUSE ME. THE SHADES??' },
    kicks:  { line: 'st_5', kai: 'k_comp_2', text: 'BRO IS GLOWING' },
    halo:   { line: 'st_6', kai: 'k_comp_3', text: 'ANGEL BEHAVIOR. ANGEL BEHAVIOR.' },
  };

  // ============================== helpers ==============================
  addInspiration(caption) {
    this.inspiration = Math.min(this.TOTAL, this.inspiration + 1);
    this.G.audio.sfx('pickup', { vol: 0.9 });
    this.G.hud.setInspo(this.inspiration, this.TOTAL);
    this.G.hud.toast(`✒ INSPIRATION ${this.inspiration}/${this.TOTAL} — “${caption}”`, 'gold');
    if (this.inspiration >= this.TOTAL) {
      this.G.hud.setObjective('You are READY. Get to the backyard party! (northeast — follow the ★)');
      this.G.hud.toast('★ The poem is complete in your heart. GET TO THE PARTY ★', 'gold');
    }
  }

  addCash(n) {
    this.cash += n;
    this.G.hud.setCash(this.cash);
  }

  // ============================== per-frame ==============================
  update(dt) {
    const G = this.G, p = G.player.pos;
    if (G.state !== 'play') { G.hud.prompt(null); return; }

    // collect inspiration shards
    for (const ins of G.world.inspirations) {
      if (ins.taken) continue;
      if (ins.pos.distanceTo(p) < 2.4 || (ins.core && ins.core.getWorldPosition(new THREE.Vector3()).distanceTo(p) < 2.4)) {
        ins.taken = true;
        ins.mesh.visible = false;
        G.fx.burst({ pos: p.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 24, color: 0xffd75c, color2: 0xfff3b0, speed: 4, up: 3, size: 0.45, life: 0.9 });
        this.addInspiration(ins.caption);
      }
    }
    // collect cash
    for (const c of G.world.cashes) {
      if (c.taken) continue;
      if (c.pos.distanceTo(p) < 1.7) {
        c.taken = true; c.mesh.visible = false;
        this.addCash(c.value);
        G.audio.sfx('cash', { vol: 0.7 });
        G.fx.burst({ pos: c.pos.clone(), count: 8, color: 0x4ec96a, speed: 3, up: 2.5, size: 0.3, life: 0.5 });
      }
    }

    // yard trespass check
    if (!this.partyStarted && p.x > 189 && p.z > 211 && this.inspiration < this.TOTAL) {
      G.player.teleport(184, 218, -Math.PI / 2);
      G.hud.toast(`A poet does not arrive unprepared — ${this.TOTAL - this.inspiration} inspiration still missing`);
    }
    if (!this.partyStarted && this.inspiration >= this.TOTAL && p.x > 189 && p.z > 211) {
      this.finale();
      return;
    }

    // interaction zones
    let zone = null, zd = 99;
    for (const z of G.world.zones) {
      const d = z.pos.distanceTo(p);
      if (d < z.radius && d < zd) { zone = z; zd = d; }
    }
    if (zone) {
      const labels = {
        shop: `<b>[E]</b> enter ${zone.label} ${this.visited.has(zone.id) ? '· refill MP' : ''}`,
        clothing: `<b>[E]</b> browse ${zone.label} — drip emporium`,
        friend: `<b>[E]</b> talk to ${zone.label}`,
        mixtape: this.mixtapeOwned ? `<b>[E]</b> DJ CRATES (no refunds)` : `<b>[E]</b> DJ CRATES — he has something for you`,
        roofparty: [`<b>[E]</b> PROMOTER — he knows about a party`, `<b>[E]</b> PROMOTER — take the “elevator”`, `<b>[E]</b> PROMOTER`][this.roofQuest],
        party: this.inspiration >= this.TOTAL ? `<b>[E]</b> ★ ENTER THE PARTY ★` : `<b>[E]</b> the party (${this.inspiration}/${this.TOTAL} inspiration)`,
      };
      G.hud.prompt(labels[zone.kind]);
      if (G.input.hit('KeyE') && !this.busy) this.interact(zone);
    } else G.hud.prompt(null);
  }

  async interact(zone) {
    this.busy = true;
    try {
      if (zone.kind === 'shop') {
        if (!this.visited.has(zone.id)) await this.shopScene(zone.id);
        else this.quickRefill(zone.id);
      } else if (zone.kind === 'clothing') this.openShopMenu(zone.id);
      else if (zone.kind === 'friend') await this.friendScene(zone.id.replace('friend_', ''));
      else if (zone.kind === 'mixtape') await this.mixtapeScene();
      else if (zone.kind === 'roofparty') await this.roofPartyScene();
      else if (zone.kind === 'party') {
        if (this.inspiration >= this.TOTAL) await this.finale();
        else {
          await this.G.cine.play([
            { pos: null, look: null, move: 0.4, line: 'k_gate_1' },
          ]);
          this.G.hud.toast(`${this.TOTAL - this.inspiration} more inspiration — check the gold beams & visit every shop`, 'gold');
        }
      }
    } finally { this.busy = false; }
  }

  quickRefill(id) {
    const G = this.G;
    G.player.refill();
    G.audio.sfx('slurp', { vol: 0.7 });
    G.fx.burst({ pos: G.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), count: 16, color: 0x4db8ff, speed: 2.5, up: 2, size: 0.4, life: 0.7 });
    const quip = {
      coffee: 'Another ube latte. Mira nods. Coldly. MP restored.',
      vape: 'One (1) polite puff. You see through time again. MP restored.',
      poke: 'Poke, zero wasabi this time. Growth. MP restored.',
      ice: 'You hold this scoop with both hands. MP restored.',
      kombucha: 'The booch flows. Kickflip approves. MP restored.',
    }[id];
    G.hud.toast(quip || 'MP restored.');
  }

  // ============================== SHOP CUTSCENES ==============================
  async shopScene(id) {
    const G = this.G;
    const shop = G.world.shops[id];
    const z = shop.z;
    const kx = -14.6;           // keeper x
    const px = -17.8;           // player-at-counter x
    G.player.teleport(px, z, Math.PI / 2);
    const camIn = [-21.5, 2.1, z + 3.6], lookK = [kx, 1.55, z], lookP = [px, 1.4, z];
    const camKai = [-15.5, 1.9, z - 2.8];
    const camDoor = [-31, 2.4, z + 5];

    const scenes = {
      coffee: [
        { pos: camDoor, look: [-25, 3, z], move: 1.6, text: "LALA'S LATTE — Venice's finest ube. The barista is very cute. This is a problem.", speaker: '2:00-ISH PM · OCEAN FRONT WALK' },
        { pos: camIn, look: lookK, move: 1.4, line: 'm_coffee_1' },
        { pos: camKai, look: lookP, move: 1.2, line: 'k_coffee_1' },
        { pos: camIn, look: lookK, move: 1.0, line: 'm_coffee_2' },
        { pos: camKai, look: lookP, move: 1.0, line: 'k_coffee_2', action: (G) => G.audio.sfx('purchase', { vol: 0.5 }) },
        {
          pos: [-19, 1.6, z - 4], look: [px, 1.2, z - 1], move: 2.2, line: 'k_coffee_3',
          action: (G) => { G.audio.sfx('slurp', { vol: 0.9 }); G.fx.burst({ pos: G.player.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), count: 10, color: 0xc9a0ff, speed: 1.5, up: 1.5, size: 0.35, life: 0.8 }); },
        },
      ],
      vape: [
        { pos: camDoor, look: [-25, 3, z], move: 1.6, text: 'CLOUD TEMPLE — the air in here is 40% mango.', speaker: 'OCEAN FRONT WALK' },
        { pos: camIn, look: lookK, move: 1.4, line: 'g_vape_1' },
        {
          pos: camKai, look: lookP, move: 1.2, line: 'k_vape_1',
          action: (G) => { G.audio.sfx('cough', { vol: 0.9 }); G.fx.burst({ pos: G.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), count: 30, color: 0xdddddd, color2: 0xffb8f0, speed: 2, up: 1.5, size: 0.8, life: 1.6, gravity: 0.5, alpha: 0.5 }); },
        },
        { pos: camIn, look: lookK, move: 1.0, line: 'g_vape_2' },
        { pos: camKai, look: lookP, move: 0.8, line: 'k_vape_2', action: (G) => G.audio.sfx('purchase', { vol: 0.5 }) },
      ],
      poke: [
        { pos: camDoor, look: [-25, 3, z], move: 1.6, text: 'POKE PARADISE — home of the freshest wasabi on the West Side.', speaker: 'OCEAN FRONT WALK' },
        { pos: camIn, look: lookK, move: 1.4, line: 'o_poke_1' },
        { pos: camKai, look: lookP, move: 1.2, line: 'k_poke_1' },
        {
          pos: [-16.5, 1.5, z + 2.2], look: [px, 1.5, z], move: 0.4, line: 'k_poke_2',
          action: (G) => {
            G.fx.burst({ pos: G.player.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), count: 26, color: 0x5cff5c, color2: 0xc6ff00, speed: 4, up: 3, size: 0.5, life: 0.8 });
            G.shake?.(0.5);
          },
        },
        { pos: camIn, look: lookK, move: 1.0, line: 'o_poke_2' },
      ],
      ice: [
        { pos: camDoor, look: [-25, 3, z], move: 1.6, text: 'SCOOP DREAMS — today\'s special: basil lime.', speaker: 'OCEAN FRONT WALK' },
        { pos: camIn, look: lookK, move: 1.4, line: 'p_ice_1' },
        { pos: camKai, look: lookP, move: 1.2, line: 'k_ice_1' },
        {
          pos: [-30, 2.2, z + 4], look: [-27.5, 1, z], move: 1.6, text: 'Ten seconds later, on the boardwalk...', speaker: 'FATE',
          action: (G) => G.player.teleport(-27.5, z, Math.PI),
        },
        {
          pos: [-29, 0.8, z - 2.5], look: [-27.5, 0.4, z], move: 0.5, line: 'k_ice_2',
          action: (G) => {
            G.audio.sfx('splat', { vol: 1 });
            G.fx.burst({ pos: new THREE.Vector3(-27.5, 0.3, z), count: 22, color: 0xd6ff9e, color2: 0xfff3e0, speed: 3.5, up: 2, size: 0.4, life: 0.8 });
            G.fx.ring({ pos: new THREE.Vector3(-27.5, 0, z), color: 0xd6ff9e, maxR: 1.4 });
          },
        },
      ],
      kombucha: [
        { pos: camDoor, look: [-25, 3, z], move: 1.6, text: 'THE BOOCH BARN — fermentation station. Something is watching you from behind the barrels.', speaker: 'OCEAN FRONT WALK' },
        { pos: camIn, look: lookK, move: 1.4, line: 's_kom_1' },
        {
          pos: camKai, look: lookP, move: 1.2, line: 'k_kom_1',
          action: (G) => {
            G.audio.sfx('slurp', { vol: 0.7 });
            G.npcs.activateDog(new THREE.Vector3(-16.5, 0, z + 3));
          },
        },
        { pos: [-18, 0.8, z + 1], look: [-16.5, 0.4, z + 3], move: 1.6, line: 's_kom_2', action: (G) => G.audio.sfx('dog_bark', { vol: 0.9 }) },
        { pos: [-19, 1.2, z + 2], look: [-16.5, 0.6, z + 3], move: 1.2, line: 'k_kom_2', action: (G) => G.audio.sfx('dog_bark', { vol: 0.7, rate: 1.15 }) },
      ],
    };

    await this.G.cine.play(scenes[id]);
    this.visited.add(id);
    G.player.refill();
    const inspoCaption = {
      coffee: 'a warm musubi, a tiny table, a graceful rejection',
      vape: 'I saw through time and it was mango-flavored',
      poke: 'my third eye wept and I called it seasoning',
      ice: 'love is a dropped scoop of basil lime',
      kombucha: 'a dog named Kickflip believes in me',
    }[id];
    this.addInspiration(inspoCaption);
    G.hud.toast('MP fully restored ✨');
    if (id === 'ice') {
      // the scoop is gone but the wisdom remains
    }
    if (id === 'kombucha') G.hud.toast('🐕 KICKFLIP joined you — fiends fear him', 'gold');
  }

  // ============================== THE MIXTAPE ==============================
  async mixtapeScene() {
    const G = this.G;
    const dj = G.npcs.mixtapeGuy;
    const dp = dj.group.position, pp = G.player.pos;
    const camDJ = [dp.x - 2.5, 1.9, dp.z + 3], lookDJ = [dp.x, 1.45, dp.z];
    const camKai = [pp.x - 2, 1.7, pp.z - 3], lookKai = [pp.x, 1.4, pp.z];

    if (this.mixtapeOwned) {
      await G.cine.play([{ pos: camDJ, look: lookDJ, move: 0.8, line: 'mx_4' }]);
      return;
    }
    const shots = [
      { pos: camDJ, look: lookDJ, move: 1.3, line: 'mx_1' },
      { pos: camKai, look: lookKai, move: 1, line: 'k_mx_1' },
      { pos: camDJ, look: lookDJ, move: 1, line: 'mx_2' },
    ];
    if (this.cash >= 15) {
      shots.push(
        {
          pos: camKai, look: lookKai, move: 1, line: 'k_mx_2',
          action: (G) => { this.cash -= 15; G.hud.setCash(this.cash); G.audio.sfx('purchase', { vol: 0.8 }); },
        },
        {
          pos: camDJ, look: lookDJ, move: 1, line: 'mx_3',
          action: (G) => { this.mixtapeOwned = true; },
        },
      );
    }
    await G.cine.play(shots);
    if (this.mixtapeOwned) {
      this.mixtapeT = 150; // mercy timer — the vibes return eventually
      G.audio.music('mixtape', 1.2);
      G.hud.toast('🎵 Now playing: OCEAN FRONT HEAT VOL. 9', 'gold', 6000);
      setTimeout(() => {
        if (G.state === 'play' && this.mixtapeOwned) {
          G.audio.voice('k_mx_3', 60);
          G.hud.toast('KAI: "This is the worst thing I have ever heard. I can\'t stop listening."');
        }
      }, 12000);
    } else {
      G.hud.toast('You pat your empty robe pockets. Come back with $15.');
    }
  }

  // ============================== ROOFTOP PARTY SIDE QUEST ==============================
  async roofPartyScene() {
    const G = this.G;
    const pr = G.npcs.promoter;
    const pp = pr.group.position, kp = G.player.pos;

    if (this.roofQuest === 0) {
      await G.cine.play([
        { pos: [pp.x - 2.5, pp.y + 2, pp.z + 3], look: [pp.x, pp.y + 1.5, pp.z], move: 1.2, line: 'rp_1' },
        { pos: [kp.x + 2, kp.y + 1.8, kp.z - 2.5], look: [kp.x, kp.y + 1.4, kp.z], move: 1, line: 'k_rp_1' },
      ]);
      // find the tallest building and a clear spot at its base
      const b = G.world.bldgs.reduce((a, c) => (c.h > a.h ? c : a));
      this.roofBldg = b;
      let base = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const bx = b.cx + dx * (b.w / 2 + 3), bz = b.cz + dz * (b.d / 2 + 3);
        const blocked = G.world.bldgs.some(o => o !== b && bx > o.cx - o.w / 2 - 1 && bx < o.cx + o.w / 2 + 1 && bz > o.cz - o.d / 2 - 1 && bz < o.cz + o.d / 2 + 1);
        if (!blocked) { base = new THREE.Vector3(bx, 0, bz); break; }
      }
      if (!base) base = new THREE.Vector3(b.cx + b.w / 2 + 3, 0, b.cz);
      pr.group.position.copy(base);
      pr.group.rotation.y = Math.atan2(b.cx - base.x, b.cz - base.z) + Math.PI;
      this.roofQuest = 1;
      this.roofMarker = base;
      this.roofBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.9, 34, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x8affc1, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      this.roofBeam.position.set(base.x, 17, base.z);
      G.scene.add(this.roofBeam);
      G.hud.toast('🏙 SIDE QUEST: meet the promoter at the base of the tallest building — follow the green beam', 'gold', 8000);
    } else if (this.roofQuest === 1) {
      const b = this.roofBldg;
      await G.cine.play([
        { pos: [pp.x - 2.5, 2, pp.z + 3], look: [pp.x, 1.5, pp.z], move: 1.2, line: 'rp_2' },
      ]);
      // the "elevator"
      const fade = document.getElementById('fade');
      fade.style.opacity = 1;
      await new Promise(r => setTimeout(r, 900));
      G.player.teleport(b.cx - 2, b.cz, Math.PI / 2);
      G.player.pos.y = b.h;
      pr.group.position.set(b.cx + 1.5, b.h, b.cz + 1);
      pr.group.rotation.y = -Math.PI / 2;
      this.spawnRoofParty(b);
      if (this.roofBeam) { G.scene.remove(this.roofBeam); this.roofBeam = null; }
      this.roofMarker = null;
      this.roofQuest = 2;
      fade.style.opacity = 0;
      await G.cine.play([
        { pos: [b.cx - 9, b.h + 5, b.cz + 9], look: [b.cx, b.h + 1, b.cz], move: 3, line: 'rp_3' },
        { pos: [b.cx + 2.5, b.h + 2, b.cz - 4], look: [b.cx - 2, b.h + 1.4, b.cz], move: 2, line: 'k_rp_2' },
      ]);
      G.player.addEgo(20);
      G.player.refill();
      G.audio.sfx('ego_up', { vol: 0.9 });
      G.hud.toast("+20 EGO (against Kai's will) · MP & HP restored · the roof edges are grindable", 'gold', 7000);
    } else {
      G.hud.toast('PROMOTER: "Vibe, man." The roof is yours.');
    }
  }

  spawnRoofParty(b) {
    const G = this.G;
    const g = new THREE.Group();
    const box = (w, h, d, c, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
      m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    };
    box(0.9, 1.5, 0.9, 0x16161c, b.cx + 3.2, b.h + 0.75, b.cz + 3.2);   // speakers
    box(0.9, 1.5, 0.9, 0x16161c, b.cx - 3.2, b.h + 0.75, b.cz + 3.2);
    box(1.1, 0.6, 0.7, 0xd8503c, b.cx - 2, b.h + 0.3, b.cz - 2.6);      // the cooler
    // ring of party bulbs
    const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff0c0, emissive: 0xffd98a, emissiveIntensity: 0.15 });
    G.world.nightMats.push({ mat: bulbMat, day: 0.15, night: 2.8 });
    const bulbGeo = new THREE.SphereGeometry(0.09, 6, 5);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const m = new THREE.Mesh(bulbGeo, bulbMat);
      m.position.set(b.cx + Math.cos(a) * 4.6, b.h + 2.2 + Math.sin(a * 3) * 0.15, b.cz + Math.sin(a) * 4.6);
      g.add(m);
    }
    const light = new THREE.PointLight(0xffc98a, 55, 32, 1.8);
    light.position.set(b.cx, b.h + 4, b.cz);
    g.add(light);
    G.scene.add(g);
    // guests — they join the crowd animator and vibe forever
    for (let i = 0; i < 6; i++) {
      const p = makePerson({});
      const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 2.6;
      p.group.position.set(b.cx + Math.cos(a) * r, b.h, b.cz + Math.sin(a) * r);
      p.group.rotation.y = Math.random() * 6.28;
      G.scene.add(p.group);
      G.npcs.crowd.push({ anim: p, mesh: p.group, phase: Math.random() * 9 });
    }
  }

  // ============================== FRIENDS ==============================
  async friendScene(id) {
    const G = this.G;
    const f = G.npcs.friends[id];
    const fp = f.pos;
    const pp = G.player.pos;
    const mid = fp.clone().add(pp).multiplyScalar(0.5);
    const side = new THREE.Vector3(fp.z - pp.z, 0, pp.x - fp.x).normalize().multiplyScalar(4);
    const lines = { dev: ['f_dev_1', 'k_fdev_1'], juno: ['f_juno_1', 'k_fjuno_1'], tyler: ['f_tyler_1', 'k_ftyler_1'] };
    if (!f.met) {
      f.met = true;
      await G.cine.play([
        { pos: [mid.x + side.x, 2, mid.z + side.z], look: [fp.x, 1.5, fp.z], move: 1.2, line: lines[id][0] },
        { pos: [mid.x + side.x * 0.8, 1.8, mid.z + side.z * 0.8], look: [pp.x, 1.4, pp.z], move: 1, line: lines[id][1] },
      ]);
      G.hud.toast(`${id.toUpperCase()} will be at the party — don't show up without your poem`, 'gold');
    } else {
      G.hud.toast({ dev: 'DEV: "Marinating?? Cook FASTER."', juno: 'JUNO: "Mid bars = I heckle. Lovingly."', tyler: 'TYLER: "Pre-production?? Bro."' }[id]);
    }
  }

  // ============================== CLOTHING ==============================
  openShopMenu(shopId) {
    const G = this.G;
    this.shopOpen = shopId;
    G.state = 'shopping';
    const el = document.getElementById('shopmenu');
    document.getElementById('shop-title').textContent = G.world.shops[shopId].name;
    const wrap = document.getElementById('shop-items');
    wrap.innerHTML = '';
    for (const item of DRIP_ITEMS[shopId]) {
      const div = document.createElement('div');
      const owned = this.owned.has(item.key);
      const broke = this.cash < item.price;
      div.className = `shop-item${owned ? ' owned' : broke ? ' broke' : ''}`;
      div.innerHTML = `<div><div class="nm">${item.name}</div><div class="fx">${item.fx}</div></div><div class="pr">${owned ? 'WORN' : '$' + item.price}</div>`;
      div.onclick = () => this.buyDrip(shopId, item, div);
      wrap.appendChild(div);
    }
    el.classList.remove('hidden');
  }

  closeShopMenu() {
    document.getElementById('shopmenu').classList.add('hidden');
    this.shopOpen = null;
    this.G.state = 'play';
    this.G.input.endFrame();
  }

  async buyDrip(shopId, item, div) {
    const G = this.G;
    if (this.owned.has(item.key)) return;
    if (this.cash < item.price) { G.hud.toast(`Need $${item.price} — fiends drop cash when vanquished`); return; }
    this.cash -= item.price;
    this.owned.add(item.key);
    this.dripCount++;
    G.hud.setCash(this.cash);
    G.hud.setDrip(this.dripCount);
    G.player.applyDrip(item.key);
    if (Story.COMPLIMENTS[item.key]) this.complimentQueue.push(Story.COMPLIMENTS[item.key]);
    G.audio.sfx('purchase', { vol: 0.9 });
    G.fx.burst({ pos: G.player.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), count: 20, color: 0xff8ad1, color2: 0xffd75c, speed: 3, up: 2, size: 0.4, life: 0.8 });
    div.className = 'shop-item owned';
    div.querySelector('.pr').textContent = 'WORN';
    if (!this.firstDrip) {
      this.firstDrip = true;
      this.closeShopMenu();
      const pp = G.player.pos, shop = G.world.shops[shopId];
      await G.cine.play([
        { pos: [pp.x - 3, 2, pp.z + 3.5], look: [pp.x, 1.3, pp.z], move: 1.2, line: 'r_drip_1' },
        { pos: [pp.x - 2, 1.6, pp.z - 3], look: [pp.x, 1.4, pp.z], move: 1, line: 'k_drip_1' },
      ]);
      this.addInspiration('confidence, it turns out, is machine-washable');
      G.hud.toast('Skate near strangers — they WILL notice the drip. Compliments boost EGO.', 'gold');
    } else {
      G.hud.toast(`${item.name} equipped — the drip grows stronger`, 'gold');
    }
  }

  // ============================== DEATH ==============================
  onPlayerDeath() {
    const G = this.G;
    if (G.state !== 'play') return;
    G.state = 'dead';
    const fade = document.getElementById('fade');
    fade.style.opacity = 1;
    setTimeout(() => {
      G.player.teleport(-35, -12, Math.PI);
      G.player.hp = Math.round(G.player.maxHp * 0.6);
      G.player.ego = Math.max(0, G.player.ego - 8);
      // clear nearby fiends so it's fair
      for (const e of G.enemies.list) if (!e.dead && e.pos.distanceTo(G.player.pos) < 45) { G.scene.remove(e.mesh); e.dead = true; }
      fade.style.opacity = 0;
      G.state = 'play';
      G.hud.toast('You got jumped. The pavement forgives. (-8 ego)');
    }, 1100);
  }

  // ============================== FINALE ==============================
  async finale() {
    if (this.partyStarted) return;
    this.partyStarted = true;
    const G = this.G;
    const yard = G.world.partyYard;
    G.timeHour = 26; // 2:00 AM
    G.hud.setClock(26);
    G.world.setTime(26);
    G.enemies.enabled = false;
    G.enemies.clearAll();
    G.audio.music('party', 0.8);
    G.world.partyLight.intensity = 120;
    G.world.stageLight.intensity = 60;
    G.npcs.spawnPartyCrowd();
    // friends join the crowd
    G.npcs.friends.dev.mesh.position.set(212, 0, 224);
    G.npcs.friends.juno.mesh.position.set(215, 0, 229);
    G.npcs.friends.tyler.mesh.position.set(210, 0, 228);
    for (const id of ['dev', 'juno', 'tyler']) G.npcs.friends[id].mesh.lookAt(yard.stage.x, 1, yard.stage.z);
    G.player.teleport(192, 222, Math.PI / 2);

    const mic = [219.5, 1.6, 231.2];
    await G.cine.play([
      { pos: [186, 2.4, 218], look: [208, 1.5, 227], move: 2.2, line: 't_party_1' },
      { pos: [200, 2.0, 222], look: mic, move: 2.4, text: 'The aux dies. Someone lowers a string light. The backyard turns to face the stage.', speaker: '2:00 AM · THE BACKYARD', action: (G) => { G.player.teleport(219.5, 231.8, -Math.PI / 2); G.player.pos.y = 0.6; } },
      { pos: [214, 2.2, 227], look: mic, move: 2.0, line: 'k_party_1' },
      { pos: [216, 1.7, 233], look: mic, move: 5.5, line: 'k_poem_1' },
      { pos: [222.5, 2.2, 228], look: mic, move: 6.5, line: 'k_poem_2' },
      { pos: [217, 3.4, 229], look: mic, move: 6.5, line: 'k_poem_3', action: (G) => G.fx.burst({ pos: new THREE.Vector3(219.5, 2.4, 231.2), count: 14, color: 0xffd75c, color2: 0xc98aff, speed: 1.2, up: 1.5, size: 0.4, life: 1.4, gravity: 0.3 }) },
      { pos: [215, 1.9, 230.5], look: mic, move: 7, line: 'k_poem_4' },
      {
        pos: [212, 2.6, 226], look: [219.5, 1.5, 231.2], move: 1.2, line: 'f_crowd_1',
        action: (G) => { G.audio.sfx('snaps', { vol: 1 }); G.fx.burst({ pos: new THREE.Vector3(214, 2, 227), count: 40, color: 0xffd75c, color2: 0xff8ad1, speed: 6, up: 5, size: 0.4, life: 1.2, spread: 1.5 }); },
      },
      { pos: [206, 14, 210], look: [214, 1, 228], move: 6, line: 'n_outro_1', action: (G) => G.audio.sfx('snaps', { vol: 0.7 }) },
    ]);

    // roll credits
    const fade = document.getElementById('fade');
    fade.style.opacity = 1;
    await new Promise(r => setTimeout(r, 1200));
    G.state = 'ended';
    const mins = Math.round((performance.now() - this.startTime) / 60000 * 10) / 10;
    const s = G.player.stats;
    document.getElementById('ending-stats').innerHTML =
      `inspiration <b>${this.inspiration}/${this.TOTAL}</b> · ego <b>${Math.round(G.player.ego)}</b> · drip <b>${this.dripCount}/6</b><br/>` +
      `fiends vanquished <b>${s.fiends}</b> · grinds <b>${s.grinds}</b> · wall jumps <b>${s.wallJumps}</b> · compliments <b>${s.compliments}</b><br/>` +
      `longest air <b>${s.bestAir.toFixed(1)}s</b> · real time <b>${mins} min</b> · Kickflip <b>${G.npcs.dogActive ? 'a very good boy' : 'never found ;('}</b>`;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('ending').classList.remove('hidden');
    fade.style.opacity = 0;
  }
}
