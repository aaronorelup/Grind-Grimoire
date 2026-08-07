// Kai — skateboarding wizard. Carving physics, grind-on-any-edge, wall jumps,
// HP/MP/stamina/ego, homing fireballs.
import * as THREE from 'three';
import { makeWizard, animWizard } from './characters.js';

const GRAV = 30, JUMP = 11, WALLJUMP = 10, R = 0.45, HEIGHT = 1.75;

export class Player {
  constructor(G) {
    this.G = G;
    const { group, parts, drip } = makeWizard();
    this.mesh = group; this.parts = parts; this.dripMeshes = drip;
    G.scene.add(group);

    this.pos = new THREE.Vector3(-35, 0, -12);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.heading = Math.PI; // faces +z... heading angle; forward=(sin,0,cos)
    this.mode = 'ground';
    this.grind = null;          // {rail, s, sign, speed}
    this.grindCD = 0;           // no re-grab right after leaving a rail
    this.lastRail = null;       // the rail we just left
    this.lastRailCD = 0;
    this.wallNormal = new THREE.Vector3();
    this.wallTimer = 0;
    this.lastGrounded = 0;
    this.pushT = 0; this.castAnim = 0; this.iframes = 0;
    this.lean = 0;
    this.airTime = 0;
    this.barkCD = 0;
    this.tumble = 0;            // ragdoll spin timer after a car hit

    // ---- stats ----
    this.ego = 0;
    this.hp = 100; this.mp = 100; this.st = 100;
    this.stats = { fiends: 0, grinds: 0, wallJumps: 0, bestAir: 0, compliments: 0 };

    this.fireballs = [];
    this.lightPool = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xff8830, 0, 14, 2);
      G.scene.add(l);
      this.lightPool.push(l);
    }
    this.hasDog = false;
  }

  get maxHp() { return Math.round(100 * (1 + this.ego / 140)); }
  get maxMp() { return Math.round(100 * (1 + this.ego / 140)); }
  get maxSt() { return Math.round(100 * (1 + this.ego / 140)); }
  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  get speed() { return this.mode === 'grind' ? this.grind.speed : Math.hypot(this.vel.x, this.vel.z); }

  addEgo(n) {
    this.ego = Math.min(100, this.ego + n);
    this.hp = Math.min(this.maxHp, this.hp + n * 1.5);
  }

  refill() { this.hp = this.maxHp; this.mp = this.maxMp; this.st = this.maxSt; }

  teleport(x, z, heading = this.heading) {
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.vy = 0;
    this.heading = heading; this.mode = 'ground'; this.grind = null;
    this.syncMesh(0.016);
  }

  // ============================== main update ==============================
  update(dt, t) {
    const { input, world, audio, fx } = this.G;
    this.iframes = Math.max(0, this.iframes - dt);
    this.barkCD = Math.max(0, this.barkCD - dt);
    this.grindCD = Math.max(0, this.grindCD - dt);
    this.lastRailCD = Math.max(0, this.lastRailCD - dt);
    this.wallTimer = Math.max(0, this.wallTimer - dt);
    this.castAnim = Math.max(0, this.castAnim - dt);
    this.pushT = Math.max(0, this.pushT - dt * 1.4);

    const steer = (input.key('KeyA') ? 1 : 0) - (input.key('KeyD') ? 1 : 0);
    const fwd = input.key('KeyW') ? 1 : 0;
    const brake = input.key('KeyS') ? 1 : 0;
    const boosting = input.key('ShiftLeft') && this.st > 1 && fwd;
    this.lean = THREE.MathUtils.lerp(this.lean, steer * Math.min(1, this.speed / 10), 10 * dt);

    if (this.mode === 'grind') this.updateGrind(dt, steer, input);
    else this.updateSkate(dt, t, steer, fwd, brake, boosting, input);

    // stamina
    if (boosting && this.mode !== 'grind') this.st = Math.max(0, this.st - 20 * dt);
    else this.st = Math.min(this.maxSt, this.st + (this.speed < 1 ? 18 : 11) * dt);

    // fireball input
    if ((input.clicked || input.hit('KeyF')) && this.G.state === 'play') this.castFireball();
    this.updateFireballs(dt);

    // fell in the Pacific — wizards sink (the robe). Soft respawn on the sand.
    if (this.pos.x < -93.5 && this.pos.y < 0.6 && this.mode !== 'grind') this.splash();

    // audio loops
    const groundSpeed = this.mode === 'ground' ? this.speed : 0;
    audio.loopStart('roll', 'roll', { vol: 0 });
    audio.loopSet('roll', Math.min(0.5, groundSpeed / 40), 0.8 + groundSpeed / 30);
    audio.loopStart('waves', 'waves', { vol: 0 });
    audio.loopSet('waves', THREE.MathUtils.clamp(1 - (this.pos.x + 95) / 110, 0, 1) * 0.7);
    if (this.mode === 'grind') {
      audio.loopStart('grind', 'grind', { vol: 0.5 });
      audio.loopSet('grind', Math.min(0.7, this.grind.speed / 30));
    } else audio.loopStop('grind');

    // ego aura
    if (this.ego >= 50 && Math.random() < dt * 8) {
      fx.burst({ pos: this.pos.clone().add(new THREE.Vector3((Math.random() - .5), 0.6 + Math.random(), (Math.random() - .5))), count: 1, color: 0xc98aff, color2: 0xffd75c, speed: 0.4, up: 1, size: 0.35, life: 0.8, gravity: 0.5, alpha: 0.7 });
    }
    this.syncMesh(dt, t);
  }

  updateSkate(dt, t, steer, fwd, brake, boosting, input) {
    const grounded = this.mode === 'ground';
    const sp = this.speed;
    // steering: rotate heading; carve velocity toward heading
    const turnRate = grounded ? 2.7 - Math.min(1.1, sp / 26) : 1.6;
    this.heading += steer * turnRate * dt;

    if (grounded) {
      const maxSp = boosting ? 26 : 17;
      if (fwd) {
        const f = this.forward;
        const acc = boosting ? 34 : 24;
        this.vel.x += f.x * acc * dt; this.vel.z += f.z * acc * dt;
        if (this.pushT <= 0 && sp < maxSp * 0.85) this.pushT = 1; // kick animation
      }
      if (brake) { this.vel.multiplyScalar(Math.max(0, 1 - 4.5 * dt)); }
      // carve: velocity direction eases toward heading (keeps magnitude — feels like rails under wheels)
      const s2 = Math.hypot(this.vel.x, this.vel.z);
      if (s2 > 0.3) {
        const cur = Math.atan2(this.vel.x, this.vel.z);
        let diff = this.heading - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const grip = 7.5;
        const na = cur + diff * Math.min(1, grip * dt);
        this.vel.x = Math.sin(na) * s2; this.vel.z = Math.cos(na) * s2;
      }
      // friction + clamp
      this.vel.multiplyScalar(Math.max(0, 1 - 0.45 * dt));
      const s3 = Math.hypot(this.vel.x, this.vel.z);
      const mx = boosting ? 27 : 30; // hard cap (momentum from tricks can exceed cruise cap)
      if (s3 > mx) this.vel.multiplyScalar(mx / s3);
    } else {
      // air: slight steer of velocity
      const s2 = Math.hypot(this.vel.x, this.vel.z);
      if (s2 > 0.5) {
        const cur = Math.atan2(this.vel.x, this.vel.z);
        const na = cur + steer * 0.9 * dt;
        this.vel.x = Math.sin(na) * s2; this.vel.z = Math.cos(na) * s2;
      }
      this.airTime += dt;
    }

    // jump / wall jump
    const canJump = grounded || (performance.now() / 1000 - this.lastGrounded < 0.12);
    if (input.hit('Space')) {
      if (canJump) {
        this.vy = JUMP; this.mode = 'air'; this.airTime = 0;
        this.G.audio.sfx('jump', { vol: 0.7 });
      } else if (this.wallTimer > 0) {
        // WALL JUMP — reflect + boost
        const n = this.wallNormal;
        const d = this.vel.clone();
        const dot = d.x * n.x + d.z * n.z;
        this.vel.x = d.x - 2 * dot * n.x + n.x * 7;
        this.vel.z = d.z - 2 * dot * n.z + n.z * 7;
        const s2 = Math.hypot(this.vel.x, this.vel.z);
        const target = Math.min(30, s2 * 1.18 + 3);
        if (s2 > 0.1) this.vel.multiplyScalar(target / s2);
        this.vy = WALLJUMP;
        this.heading = Math.atan2(this.vel.x, this.vel.z);
        this.wallTimer = 0;
        this.stats.wallJumps++;
        this.G.audio.sfx('wall_jump');
        this.G.fx.burst({ pos: this.pos.clone().add(new THREE.Vector3(-n.x * 0.4, 1, -n.z * 0.4)), count: 14, color: 0x5ce0ff, color2: 0xffffff, speed: 5, size: 0.35, life: 0.5 });
      }
    }

    // integrate
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.vy -= GRAV * dt;
    this.pos.y += this.vy * dt;

    // try to start grinding while falling
    if (this.mode === 'air' && this.vy < 3.5) this.tryGrind();

    if (this.mode !== 'grind') this.collide(prevY);
  }

  collide(prevY) {
    const { world, audio, fx } = this.G;
    let grounded = false;
    if (this.pos.y <= 0) { this.pos.y = 0; if (this.vy < 0) this.vy = 0; grounded = true; }

    for (const c of world.colliders) {
      if (this.pos.x < c.min.x - R || this.pos.x > c.max.x + R || this.pos.z < c.min.z - R || this.pos.z > c.max.z + R) continue;
      if (this.pos.y >= c.max.y || this.pos.y + HEIGHT <= c.min.y) continue;
      // land on top?
      if (this.vy <= 0 && prevY >= c.max.y - 0.12 && c.max.y - this.pos.y < 1.2) {
        this.pos.y = c.max.y; this.vy = 0; grounded = true; continue;
      }
      // low curb — step up smoothly while grounded
      if (c.max.y - this.pos.y <= 0.42 && this.mode === 'ground') { this.pos.y = c.max.y; grounded = true; continue; }
      // push out horizontally (smallest penetration)
      const pens = [
        { d: (c.max.x + R) - this.pos.x, nx: 1, nz: 0 },
        { d: this.pos.x - (c.min.x - R), nx: -1, nz: 0 },
        { d: (c.max.z + R) - this.pos.z, nx: 0, nz: 1 },
        { d: this.pos.z - (c.min.z - R), nx: 0, nz: -1 },
      ];
      pens.sort((a, b) => a.d - b.d);
      const p = pens[0];
      this.pos.x += p.nx * p.d; this.pos.z += p.nz * p.d;
      if (c.wall !== false) {
        this.wallNormal.set(p.nx, 0, p.nz);
        this.wallTimer = 0.22;
        // kill velocity into the wall
        const into = this.vel.x * -p.nx + this.vel.z * -p.nz;
        if (into > 0) { this.vel.x += p.nx * into; this.vel.z += p.nz * into; }
      }
    }

    if (grounded) {
      if (this.mode === 'air') {
        audio.sfx('land', { vol: Math.min(0.8, 0.3 + this.airTime * 0.3) });
        fx.burst({ pos: this.pos.clone(), count: 8, color: 0xd8cbb0, speed: 3, up: 1.5, size: 0.3, life: 0.4, alpha: 0.5 });
        if (this.airTime > this.stats.bestAir) this.stats.bestAir = this.airTime;
      }
      this.mode = 'ground';
      this.lastGrounded = performance.now() / 1000;
      this.airTime = 0;
    } else if (this.mode === 'ground') this.mode = 'air';
  }

  // ============================== grinding ==============================
  tryGrind() {
    if (this.grindCD > 0) return;
    const world = this.G.world;
    const near = world.railsNear(this.pos);
    if (!near) return;
    let best = null, bestD = 1.35;
    for (const i of near) {
      const r = world.rails[i];
      if (r === this.lastRail && this.lastRailCD > 0) continue; // don't re-stick to the rail we just left
      // closest point on segment
      const apx = this.pos.x - r.a.x, apz = this.pos.z - r.a.z;
      let s = (apx * r.dir.x + apz * r.dir.z);
      s = THREE.MathUtils.clamp(s, 0, r.len);
      const px = r.a.x + r.dir.x * s, pz = r.a.z + r.dir.z * s;
      const py = r.a.y + r.dir.y * s;
      const dxz = Math.hypot(this.pos.x - px, this.pos.z - pz);
      const dy = this.pos.y - py;
      if (dxz < 1.0 && dy > -0.35 && dy < 1.3 && dxz + Math.abs(dy) * 0.4 < bestD) {
        bestD = dxz + Math.abs(dy) * 0.4;
        best = { rail: r, s };
      }
    }
    if (!best) return;
    const r = best.rail;
    const along = this.vel.x * r.dir.x + this.vel.z * r.dir.z;
    const sign = along >= 0 ? 1 : -1;
    const speed = Math.max(Math.abs(along) * 1.02, Math.max(this.speed * 0.85, 7.5));
    this.grind = { rail: r, s: best.s, sign, speed };
    this.mode = 'grind';
    this.vy = 0;
    this.stats.grinds++;
    this.G.fx.burst({ pos: this.pos.clone(), count: 10, color: 0xffd75c, speed: 4, size: 0.28, life: 0.35 });
  }

  updateGrind(dt, steer, input) {
    const g = this.grind, r = g.rail;
    g.speed = Math.min(27, g.speed + 3.2 * dt); // grinding builds momentum
    g.s += g.speed * g.sign * dt;
    if (g.s < 0 || g.s > r.len) {
      // chain onto a linked segment (curved rails / light strings)
      const nxt = g.sign > 0 ? r.next : r.prev;
      if (nxt) {
        const over = g.sign > 0 ? g.s - r.len : -g.s;
        g.rail = nxt;
        g.s = g.sign > 0 ? Math.min(over, nxt.len) : Math.max(nxt.len - over, 0);
      } else {
        // fly off the end
        const s = THREE.MathUtils.clamp(g.s, 0, r.len);
        this.exitGrind(g.speed, r, s, 3.6);
        return;
      }
    }
    const cr = g.rail;
    this.pos.set(cr.a.x + cr.dir.x * g.s, cr.a.y + cr.dir.y * g.s + 0.02, cr.a.z + cr.dir.z * g.s);
    const targetH = Math.atan2(cr.dir.x * g.sign, cr.dir.z * g.sign);
    let dh = targetH - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += dh * Math.min(1, 18 * dt); // smooth around curves
    // sparks
    if (Math.random() < dt * 40) {
      this.G.fx.burst({ pos: this.pos.clone().add(new THREE.Vector3(0, 0.05, 0)), count: 2, color: 0xffd75c, color2: 0xff8830, speed: 3, up: 1, size: 0.22, life: 0.3 });
    }
    // jumping out of a grind pops HIGHER than a normal ollie (momentum reward)
    if (input.hit('Space')) this.exitGrind(g.speed, g.rail, g.s, JUMP * 1.28 + Math.min(2.5, g.speed * 0.06), true);
  }

  exitGrind(speed, rail, s, vy, jumped = false) {
    this.vel.set(rail.dir.x * speed * this.grind.sign, 0, rail.dir.z * speed * this.grind.sign);
    this.vy = vy;
    this.pos.set(rail.a.x + rail.dir.x * s, rail.a.y + rail.dir.y * s + 0.05, rail.a.z + rail.dir.z * s);
    this.mode = 'air';
    this.airTime = 0;
    this.grind = null;
    // brief no-grab window so rail ends/corners don't snap you back on
    this.grindCD = jumped ? 0.18 : 0.35;
    this.lastRail = rail;
    this.lastRailCD = 0.8;
    if (jumped) {
      this.G.audio.sfx('jump', { vol: 0.75 });
      this.G.fx.burst({ pos: this.pos.clone(), count: 12, color: 0xffd75c, color2: 0x5ce0ff, speed: 4, up: 2, size: 0.3, life: 0.45 });
    } else this.G.audio.sfx('jump', { vol: 0.5, rate: 1.2 });
  }

  // ============================== fireballs ==============================
  castFireball() {
    const { audio, fx, hud } = this.G;
    const cost = 12;
    if (this.mp < cost) {
      audio.sfx('pickup', { vol: 0.2, rate: 0.5 });
      hud.toast('Out of MP — a wizard needs a little treat. Visit a shop!', 'gold');
      if (this.barkCD <= 0) { audio.voice('k_lowmp_1', 30); this.barkCD = 9; }
      return;
    }
    this.mp -= cost;
    this.castAnim = 0.3;
    const egoK = 1 + this.ego / 100;
    const dir = this.forward.clone();
    dir.y = 0.08;
    // gentle homing target
    const target = this.G.enemies?.nearestInCone(this.pos, dir, 30, 0.55);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 * (1 + this.ego / 160), 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd88 })
    );
    mesh.position.copy(this.pos).add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(dir, 0.7);
    this.G.scene.add(mesh);
    const light = this.lightPool.find(l => l.intensity === 0);
    if (light) { light.intensity = 2.5 * egoK; light.color.set(this.ego > 60 ? 0xc95cff : 0xff8830); }
    this.fireballs.push({ mesh, vel: dir.multiplyScalar(34), life: 2.2, light, target, egoK });
    audio.sfx('fireball_cast', { vol: 0.8, rate: 1.05 - this.ego / 400 });
    if (this.barkCD <= 0 && Math.random() < 0.3 && this.G.state === 'play') {
      audio.voice(Math.random() < 0.5 ? 'k_fire_1' : 'k_fire_2', 10);
      this.barkCD = 8;
    }
  }

  updateFireballs(dt) {
    const { fx, audio, enemies } = this.G;
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      f.life -= dt;
      // homing
      if (f.target && !f.target.dead) {
        const to = f.target.pos.clone().add(new THREE.Vector3(0, 1, 0)).sub(f.mesh.position).normalize();
        f.vel.lerp(to.multiplyScalar(36), Math.min(1, 3.5 * dt));
      }
      f.vel.y -= 3 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      if (f.light) f.light.position.copy(f.mesh.position);
      // trail
      fx.burst({ pos: f.mesh.position, count: 2, color: f.egoK > 1.6 ? 0xc95cff : 0xff8830, color2: 0xffdd55, speed: 0.8, up: 0.5, size: 0.5 * f.egoK, life: 0.35, gravity: 1, alpha: 0.9 });

      let boom = f.life <= 0 || f.mesh.position.y < 0.1;
      // world hit
      if (!boom) {
        const p = f.mesh.position;
        for (const c of this.G.world.colliders) {
          if (p.x > c.min.x && p.x < c.max.x && p.z > c.min.z && p.z < c.max.z && p.y > c.min.y && p.y < c.max.y) { boom = true; break; }
        }
      }
      // enemy hit
      if (!boom && enemies) {
        for (const e of enemies.list) {
          if (!e.dead && e.pos.distanceToSquared(f.mesh.position) < 1.7) { boom = true; break; }
        }
      }
      if (boom) this.explodeFireball(f, i);
    }
  }

  explodeFireball(f, idx) {
    const { fx, audio, enemies } = this.G;
    const egoK = f.egoK;
    const radius = 2.4 + this.ego * 0.03;
    const p = f.mesh.position;
    fx.burst({ pos: p, count: Math.round(26 * egoK), color: egoK > 1.6 ? 0xc95cff : 0xff7722, color2: 0xffdd55, speed: 9 * egoK, up: 3, size: 0.65, life: 0.6, spread: 1.6 });
    fx.ring({ pos: p, color: egoK > 1.6 ? 0xc98aff : 0xffaa55, maxR: radius * 1.5, y: Math.max(0.1, p.y - 0.5) });
    audio.sfx(this.ego >= 60 ? 'explosion_big' : 'fireball_hit', { vol: 0.75 });
    this.G.shake?.(0.25 * egoK);
    enemies?.damageAt(p, radius, 34 * egoK);
    this.G.scene.remove(f.mesh);
    f.mesh.geometry.dispose(); f.mesh.material.dispose();
    if (f.light) f.light.intensity = 0;
    this.fireballs.splice(idx, 1);
  }

  // hit by a car — full ragdoll launch
  carHit(carDir, speed = 16) {
    if (this.iframes > 0 || this.G.state !== 'play') return false;
    this.hp = Math.max(0, this.hp - 12);
    this.iframes = 1.6;
    this.vy = 13;
    this.vel.set(carDir.x * speed + (Math.random() - 0.5) * 5, 0, carDir.z * speed + (Math.random() - 0.5) * 5);
    this.mode = 'air';
    this.airTime = 0;
    this.grind = null;
    this.tumble = 3;
    this.G.audio.sfx('hurt');
    this.G.audio.sfx('car_horn', { vol: 0.9 });
    this.G.shake?.(0.7);
    this.G.fx.burst({ pos: this.pos.clone().add(new THREE.Vector3(0, 1, 0)), count: 16, color: 0xffffff, color2: 0xffd75c, speed: 6, up: 4, size: 0.4, life: 0.6 });
    if (this.barkCD <= 0) { this.G.audio.voice('k_hurt_1', 15); this.barkCD = 6; }
    if (this.hp <= 0) this.G.story.onPlayerDeath();
    return true;
  }

  splash() {
    const z = THREE.MathUtils.clamp(this.pos.z, -230, 230);
    this.G.fx.burst({ pos: this.pos.clone().setY(0.5), count: 26, color: 0x5ce0ff, color2: 0xffffff, speed: 5, up: 4, size: 0.5, life: 0.8, spread: 1.4 });
    this.G.fx.ring({ pos: this.pos.clone().setY(0.4), color: 0x8ae0ff, maxR: 3 });
    this.G.audio.sfx('splat', { vol: 0.9, rate: 0.7 });
    this.teleport(-86, z, Math.PI / 2);
    this.iframes = 1;
    this.G.hud.toast('The Pacific says no. Wizards sink — it’s the robe.');
  }

  // ============================== damage ==============================
  hurt(dmg, fromPos) {
    if (this.iframes > 0 || this.G.state !== 'play') return;
    this.hp = Math.max(0, this.hp - dmg);
    this.iframes = 1;
    const away = this.pos.clone().sub(fromPos).setY(0).normalize();
    this.vel.addScaledVector(away, 9);
    this.vy = Math.max(this.vy, 5);
    this.mode = 'air';
    this.G.audio.sfx('hurt');
    this.G.shake?.(0.35);
    if (this.barkCD <= 0 && Math.random() < 0.5) { this.G.audio.voice('k_hurt_1', 15); this.barkCD = 7; }
    if (this.hp <= 0) this.G.story.onPlayerDeath();
  }

  // ============================== visuals ==============================
  syncMesh(dt, t = 0) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // car-hit ragdoll tumble
    if (this.tumble > 0 && this.mode === 'air') {
      this.tumble -= dt;
      this.mesh.rotation.x += dt * 11;
      this.mesh.rotation.z += dt * 7.5;
    } else if (this.mesh.rotation.x !== 0 || this.mesh.rotation.z !== 0) {
      this.mesh.rotation.x = 0;
      this.mesh.rotation.z = 0;
      this.tumble = 0;
    }
    animWizard({ parts: this.parts }, dt, {
      mode: this.mode, speed: this.speed, lean: this.lean,
      pushT: this.pushT, crouch: 0, t: t || performance.now() / 1000,
      casting: this.castAnim,
    });
  }

  applyDrip(key) {
    const d = this.dripMeshes;
    if (key === 'kicks') d.kicks.v = true;
    else if (d[key]) d[key].visible = true;
  }
}
