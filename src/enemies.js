// The boardwalk fiends — crackhead zombies. They want your mana.
// More of them (and faster) after dark. Drop cash when vanquished.
import * as THREE from 'three';
import { makeFiend, animFiend } from './characters.js';

export class Enemies {
  constructor(G) {
    this.G = G;
    this.list = [];
    this.spawnTimer = 2;
    this.groanTimer = 4;
    this.enabled = true;
  }

  targetCount() {
    const n = this.G.world.night01;
    return Math.round(10 + n * 14);
  }

  spawn() {
    const pos = this.G.world.randomSpawnPos(this.G.player.pos);
    if (!pos) return;
    const f = makeFiend();
    f.group.position.copy(pos);
    this.G.scene.add(f.group);
    const night = this.G.world.night01;
    this.list.push({
      mesh: f.group, anim: f, pos: f.group.position,
      hp: 55, dead: false,
      speed: 3.4 + Math.random() * 1.4 + night * 2.2,
      state: 'wander', wanderA: Math.random() * Math.PI * 2, wanderT: 0,
      attackCD: 0, lungeT: 0, slowT: 0,
      vx: 0, vz: 0,
    });
  }

  nearestInCone(from, dir, maxDist, cosHalf) {
    let best = null, bestD = maxDist;
    for (const e of this.list) {
      if (e.dead) continue;
      const to = e.pos.clone().sub(from);
      const d = to.length();
      if (d > bestD) continue;
      to.normalize();
      if (to.dot(dir) > cosHalf) { best = e; bestD = d; }
    }
    return best;
  }

  damageAt(pos, radius, dmg) {
    for (const e of this.list) {
      if (e.dead) continue;
      const d = e.pos.distanceTo(pos);
      if (d < radius + 0.8) {
        e.hp -= dmg * (1 - Math.min(0.6, d / (radius + 0.8)));
        const away = e.pos.clone().sub(pos).setY(0).normalize();
        e.vx += away.x * 7; e.vz += away.z * 7;
        if (e.hp <= 0) this.kill(e);
        else this.G.audio.sfxAt('zombie_hit', d + this.G.player.pos.distanceTo(e.pos) * 0.3, 50, { vol: 0.8 });
      }
    }
  }

  kill(e) {
    e.dead = true;
    this.G.player.stats.fiends++;
    const p = e.pos.clone().add(new THREE.Vector3(0, 1, 0));
    this.G.fx.burst({ pos: p, count: 22, color: 0x9fb08a, color2: 0x5a3a6a, speed: 5, up: 3, size: 0.5, life: 0.7 });
    this.G.fx.ring({ pos: e.pos, color: 0x9fb08a, maxR: 2, y: 0.15 });
    this.G.audio.sfxAt('zombie_die', this.G.player.pos.distanceTo(e.pos), 55, { vol: 0.9 });
    // cash drop
    if (Math.random() < 0.85) {
      const cash = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.2), new THREE.MeshLambertMaterial({ color: 0x4ec96a, emissive: 0x1a7a30, emissiveIntensity: 0.5 }));
      cash.position.set(e.pos.x, 0.5, e.pos.z);
      this.G.scene.add(cash);
      this.G.world.cashes.push({ pos: cash.position, mesh: cash, taken: false, value: 5 + ((Math.random() * 2) | 0) * 5 });
    }
    this.G.scene.remove(e.mesh);
  }

  update(dt, t) {
    if (!this.enabled) return;
    const player = this.G.player;
    const night = this.G.world.night01;

    // population control
    this.spawnTimer -= dt;
    const alive = this.list.filter(e => !e.dead).length;
    if (this.spawnTimer <= 0 && alive < this.targetCount()) {
      this.spawn();
      this.spawnTimer = Math.max(0.6, 2.2 - night * 1.2);
    }

    // ambient groans + voice mutterings
    this.groanTimer -= dt;
    if (this.groanTimer <= 0) {
      this.groanTimer = 5 + Math.random() * 6 - night * 2;
      let closest = null, cd = 40;
      for (const e of this.list) if (!e.dead) { const d = e.pos.distanceTo(player.pos); if (d < cd) { cd = d; closest = e; } }
      if (closest) {
        if (Math.random() < 0.3 && this.G.state === 'play' && cd < 18) this.G.audio.sfxAt('zombie_groan', cd, 40, { vol: 1 });
        else this.G.audio.sfxAt('zombie_groan', cd, 40, { vol: 0.9, rate: 0.9 + Math.random() * 0.25 });
        if (Math.random() < 0.22 && cd < 14 && this.G.state === 'play')
          this.G.audio.voice(Math.random() < 0.5 ? 'z_1' : 'z_2', 20);
      }
    }

    const dogPos = this.G.npcs?.dogActive ? this.G.npcs.dogPos : null;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dead) { this.list.splice(i, 1); continue; }
      const toP = player.pos.clone().sub(e.pos); toP.y = 0;
      const dist = toP.length();

      // despawn far away
      if (dist > 130) { this.G.scene.remove(e.mesh); this.list.splice(i, 1); continue; }

      e.attackCD = Math.max(0, e.attackCD - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      // Kickflip the dog intimidates them
      if (dogPos && e.pos.distanceToSquared(dogPos) < 64) e.slowT = 0.5;

      let mvx = 0, mvz = 0, sp = e.speed * (e.slowT > 0 ? 0.45 : 1);
      if (dist < 26 && this.G.state === 'play') {
        e.state = 'chase';
        toP.normalize();
        mvx = toP.x; mvz = toP.z;
        // lunge attack
        if (dist < 1.7 && e.attackCD <= 0) {
          e.attackCD = 1.6;
          player.hurt(9 + night * 4, e.pos);
        }
      } else {
        e.state = 'wander';
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 3; e.wanderA = Math.random() * Math.PI * 2; }
        mvx = Math.sin(e.wanderA) * 0.35; mvz = Math.cos(e.wanderA) * 0.35;
      }

      // knockback decay
      e.vx *= Math.max(0, 1 - 6 * dt); e.vz *= Math.max(0, 1 - 6 * dt);
      e.pos.x += (mvx * sp + e.vx) * dt;
      e.pos.z += (mvz * sp + e.vz) * dt;

      // crude collision vs world (push out)
      for (const c of this.G.world.colliders) {
        if (c.max.y < 0.5) continue;
        if (e.pos.x > c.min.x - 0.4 && e.pos.x < c.max.x + 0.4 && e.pos.z > c.min.z - 0.4 && e.pos.z < c.max.z + 0.4 && c.max.y > 1) {
          const pens = [
            { d: (c.max.x + 0.4) - e.pos.x, x: 1, z: 0 }, { d: e.pos.x - (c.min.x - 0.4), x: -1, z: 0 },
            { d: (c.max.z + 0.4) - e.pos.z, x: 0, z: 1 }, { d: e.pos.z - (c.min.z - 0.4), x: 0, z: -1 },
          ].sort((a, b) => a.d - b.d)[0];
          e.pos.x += pens.x * pens.d; e.pos.z += pens.z * pens.d;
        }
      }

      if (mvx || mvz) e.mesh.rotation.y = THREE.MathUtils.lerp(e.mesh.rotation.y, Math.atan2(mvx, mvz), Math.min(1, 6 * dt));
      animFiend(e.anim, t, e.state === 'chase' ? sp : 1);
    }
  }

  clearAll() {
    for (const e of this.list) this.G.scene.remove(e.mesh);
    this.list = [];
  }
}
