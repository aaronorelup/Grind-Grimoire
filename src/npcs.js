// Strangers (drip compliments), friends heading to the party, Kickflip the dog,
// and DJ Crates, purveyor of Ocean Front Heat Vol. 9.
import * as THREE from 'three';
import { makePerson, animWalk, makeDog, animDog, mat } from './characters.js';

export class NPCs {
  constructor(G) {
    this.G = G;
    this.strangers = [];
    this.friends = {};
    this.complimentCD = 0;

    // wandering boardwalk strangers
    for (let i = 0; i < 14; i++) {
      const p = makePerson({});
      const z = -200 + Math.random() * 400;
      p.group.position.set(-42 + Math.random() * 14, 0, z);
      G.scene.add(p.group);
      this.strangers.push({
        anim: p, mesh: p.group, pos: p.group.position,
        dir: Math.random() < 0.5 ? 1 : -1, speed: 1 + Math.random() * 0.8,
        cd: 0, kind: 'boardwalk',
      });
    }
    // downtown strollers
    for (let i = 0; i < 6; i++) {
      const p = makePerson({});
      p.group.position.set(88 + Math.random() * 48, 0, -170 + Math.random() * 40);
      G.scene.add(p.group);
      this.strangers.push({ anim: p, mesh: p.group, pos: p.group.position, dir: Math.random() < 0.5 ? 1 : -1, speed: 1 + Math.random(), cd: 0, kind: 'promenade' });
    }

    // friends
    const friendDefs = [
      { id: 'dev', pos: [-66, 0, 80], look: 0.5, shirt: 0xc94040, hat: 0xc94040 },   // skatepark
      { id: 'juno', pos: [98, 0, -148], look: -2, shirt: 0xffd75c, hat: null },      // promenade
      { id: 'tyler', pos: [-38, 0, -148], look: 2.6, shirt: 0x3ca86a, hat: 0xf0f0f0 }, // pier entrance
    ];
    for (const fd of friendDefs) {
      const p = makePerson({ shirt: fd.shirt, hat: fd.hat });
      p.group.position.set(...fd.pos);
      p.group.rotation.y = fd.look;
      G.scene.add(p.group);
      this.friends[fd.id] = { anim: p, mesh: p.group, pos: p.group.position, met: false };
      G.world.zones.push({ id: `friend_${fd.id}`, kind: 'friend', pos: p.group.position, radius: 3, label: fd.id.toUpperCase() });
    }

    // DJ Crates — the mixtape guy, posted up on the boardwalk
    const dj = makePerson({ shirt: 0x1c1c22, pants: 0x2e2e38, hat: 0x8a5ac9 });
    dj.group.position.set(-31.5, 0, -52);
    dj.group.rotation.y = -Math.PI / 2;
    // the merchandise
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.12), mat(0xffffff));
    tape.position.set(0.28, 1.06, 0.12);
    dj.group.children[0].add(tape);
    // the boombox
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.3), mat(0x24242c));
    boom.position.set(-31.5, 0.2, -51.2);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.05), mat(0x5ce0ff, { emissive: 0x2fb8e0, emissiveIntensity: 0.8, noCache: true }));
    grill.position.set(-31.5, 0.2, -51.03);
    boom.castShadow = true;
    G.scene.add(dj.group, boom, grill);
    this.mixtapeGuy = dj;
    dj.parts.armR.rotation.x = -1.3; // forever holding out the tape
    G.world.zones.push({ id: 'mixtape', kind: 'mixtape', pos: dj.group.position, radius: 3, label: 'DJ CRATES' });

    // the rooftop-party promoter, chilling on the pier
    const promoter = makePerson({ shirt: 0x8affc1, pants: 0x222228, hat: 0x111111 });
    promoter.group.position.set(-88, 2.6, -155);
    promoter.group.rotation.y = Math.PI / 2;
    G.scene.add(promoter.group);
    this.promoter = promoter;
    G.world.zones.push({ id: 'roofparty', kind: 'roofparty', pos: promoter.group.position, radius: 3.2, label: 'PROMOTER' });

    // Kickflip (hidden until the kombucha shop scene)
    const d = makeDog();
    this.dog = d;
    d.group.visible = false;
    G.scene.add(d.group);
    this.dogActive = false;
    this.dogPos = d.group.position;
    this.dogBarkCD = 0;
    this.dogVel = new THREE.Vector3();

    // party crowd (spawned at finale)
    this.crowd = [];
  }

  activateDog(pos) {
    this.dogActive = true;
    this.dog.group.visible = true;
    this.dog.group.position.copy(pos);
  }

  spawnPartyCrowd() {
    const yard = this.G.world.partyYard;
    for (let i = 0; i < 14; i++) {
      const p = makePerson({});
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 6;
      p.group.position.set(214 + Math.cos(a) * r * 0.9 - 4, 0, 227 + Math.sin(a) * r * 0.55);
      p.group.lookAt(yard.stage.x, 0, yard.stage.z);
      this.G.scene.add(p.group);
      this.crowd.push({ anim: p, mesh: p.group, phase: Math.random() * 9 });
    }
  }

  update(dt, t) {
    const player = this.G.player;
    this.complimentCD = Math.max(0, this.complimentCD - dt);
    this.dogBarkCD = Math.max(0, this.dogBarkCD - dt);

    // strangers wander + compliment the drip
    for (const s of this.strangers) {
      s.cd = Math.max(0, s.cd - dt);
      if (s.kind === 'boardwalk') {
        s.pos.z += s.dir * s.speed * dt;
        if (s.pos.z > 225 || s.pos.z < -225) s.dir *= -1;
        s.mesh.rotation.y = s.dir > 0 ? 0 : Math.PI;
      } else {
        s.pos.x += s.dir * s.speed * dt;
        if (s.pos.x > 142 || s.pos.x < 88) s.dir *= -1;
        s.mesh.rotation.y = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      animWalk(s.anim, t, s.speed);

      // compliments: ONE per drip piece, each unique — and Kai hates every second
      const queue = this.G.story?.complimentQueue;
      if (queue?.length && s.cd <= 0 && this.complimentCD <= 0 && this.G.state === 'play') {
        const d = s.pos.distanceTo(player.pos);
        if (d < 8) {
          const c = queue.shift();
          s.cd = 30; this.complimentCD = 8;
          s.mesh.lookAt(player.pos.x, 0, player.pos.z);
          this.G.hud.compliment(c.text);
          this.G.audio.sfx('ego_up', { vol: 0.6 });
          player.addEgo(10);
          player.stats.compliments++;
          this.G.fx.burst({ pos: player.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), count: 18, color: 0xffd75c, color2: 0xff8ad1, speed: 3, up: 3, size: 0.4, life: 0.9, gravity: 1 });
          this.G.hud.toast('+10 EGO (max stats up) — Kai would like everyone to stop', 'gold');
          // the compliment, then Kai's reluctant reply
          this.G.audio.voice(c.line, 40).then(() => {
            if (this.G.state === 'play') this.G.audio.voice(c.kai, 50);
          });
          if (player.ego >= 50 && !this._egoLine) { this._egoLine = true; setTimeout(() => { if (this.G.state === 'play') this.G.audio.voice('k_ego_1', 40); }, 9000); }
        }
      }
    }

    // friends idle
    for (const id of Object.keys(this.friends)) {
      const f = this.friends[id];
      animWalk(f.anim, t, 0);
      const d = f.pos.distanceTo(player.pos);
      if (d < 10) f.mesh.lookAt(player.pos.x, 0, player.pos.z);
    }

    // dog follows
    if (this.dogActive && this.G.state === 'play') {
      const target = player.pos.clone().sub(player.forward.clone().multiplyScalar(2.2));
      const to = target.sub(this.dogPos); to.y = 0;
      const d = to.length();
      if (d > 30) this.dog.group.position.set(player.pos.x - 2, 0, player.pos.z - 2); // teleport catch-up
      else if (d > 1.2) {
        const sp = Math.min(d * 2.2, Math.max(7, player.speed * 1.15));
        to.normalize();
        this.dogPos.x += to.x * sp * dt;
        this.dogPos.z += to.z * sp * dt;
        this.dog.group.rotation.y = Math.atan2(to.x, to.z);
        animDog(this.dog, t, sp);
      } else animDog(this.dog, t, 0);
      // bark at nearby fiends
      if (this.dogBarkCD <= 0) {
        for (const e of this.G.enemies.list) {
          if (!e.dead && e.pos.distanceToSquared(this.dogPos) < 49) {
            this.G.audio.sfxAt('dog_bark', this.G.player.pos.distanceTo(this.dogPos), 30, { vol: 0.9 });
            this.dogBarkCD = 4 + Math.random() * 4;
            break;
          }
        }
      }
    } else if (this.dogActive) animDog(this.dog, t, 0);

    // party crowd vibing
    for (const c of this.crowd) {
      c.anim.parts.fig.position.y = Math.abs(Math.sin(t * 3.6 + c.phase)) * 0.09;
      c.anim.parts.armL.rotation.x = -2.6 + Math.sin(t * 3.6 + c.phase) * 0.3;
      c.anim.parts.armR.rotation.x = -2.6 + Math.cos(t * 3.4 + c.phase) * 0.3;
    }
  }
}
