// Moving traffic. Regular cars cruise the avenues and streets; hitting one
// ragdolls you. Rarely, a white car appears driving recklessly — its driver is
// quite sure YOU are the dangerous one.
import * as THREE from 'three';
import { mat } from './characters.js';

const CAR_COLORS = [0xc94040, 0x4079c9, 0xd8d8d8, 0x36384a, 0xe8a03c, 0x3ca86a, 0x8a5ac9];

function makeCarMesh(color, karen = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.3), mat(color, { noCache: true }));
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.2), mat(karen ? 0xfff4f8 : color, { noCache: true }));
  cabin.position.y = 1.05;
  g.add(body, cabin);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10), mat(0x1a1a1e));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.3, z);
    g.add(w); wheels.push(w);
  }
  // headlights (glow at night via emissive)
  const hlMat = new THREE.MeshLambertMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.8 });
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), hlMat);
    hl.position.set(x, 0.62, 2.16);
    g.add(hl);
  }
  if (karen) {
    // the driver: blonde, sunglasses, unbothered
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat(0xe8b890));
    head.position.set(0, 1.42, 0.4);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), mat(0xf0d878));
    hair.position.set(0, 1.52, 0.32);
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.08), mat(0x111118));
    shades.position.set(0, 1.44, 0.55);
    g.add(head, hair, shades);
  }
  g.traverse(o => { o.castShadow = true; });
  return { group: g, wheels };
}

export class Traffic {
  constructor(G) {
    this.G = G;
    this.cars = [];
    this.karen = null;
    this.karenTimer = 40 + Math.random() * 50;
    this.hornCD = 0;

    // avenue cruisers (N-S)
    for (const cx of [10, 80, 150]) {
      for (const dirZ of [1, -1]) {
        for (let k = 0; k < 2; k++) {
          this.spawnCar({
            axis: 'z', lane: cx + dirZ * 2.8, dir: dirZ,
            pos: -220 + Math.random() * 440, speed: 9 + Math.random() * 4.5,
          });
        }
      }
    }
    // cross-street cruisers (E-W)
    for (const cz of [-60, 60, -120]) {
      const dirX = Math.random() < 0.5 ? 1 : -1;
      this.spawnCar({ axis: 'x', lane: cz - dirX * 2.8, dir: dirX, pos: -200 + Math.random() * 400, speed: 8 + Math.random() * 4 });
    }
  }

  spawnCar(def) {
    const { group, wheels } = makeCarMesh(CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0]);
    this.G.scene.add(group);
    this.cars.push({ ...def, mesh: group, wheels });
  }

  spawnKaren() {
    const { group, wheels } = makeCarMesh(0xffffff, true);
    this.G.scene.add(group);
    const p = this.G.player.pos;
    // enter on the avenue nearest the player, a block away
    const lane = [10, 80, 150].reduce((a, b) => Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a);
    const z = THREE.MathUtils.clamp(p.z + (Math.random() < 0.5 ? -70 : 70), -230, 230);
    this.karen = {
      mesh: group, wheels,
      x: lane, z, heading: 0, speed: 0,
      state: 'chase', stateT: 0, hits: 0, giveUp: 45,
      lineCD: 2, screechCD: 0,
    };
    this.G.hud.toast('… you hear reckless driving approaching', '', 3000);
  }

  _nearestRoadPoint(p) {
    let best = null, bd = 1e9;
    for (const ax of [10, 80, 150]) {
      const d = Math.abs(p.x - ax);
      if (d < bd) { bd = d; best = { x: ax, z: THREE.MathUtils.clamp(p.z, -235, 235) }; }
    }
    for (const sz of [-180, -120, -60, 0, 60, 120, 180]) {
      const d = Math.abs(p.z - sz);
      if (d < bd && p.x > -25) { bd = d; best = { x: THREE.MathUtils.clamp(p.x, -20, 245), z: sz }; }
    }
    return { point: best, dist: bd };
  }

  _placeCar(c) {
    const weave = c.weave || 0;
    if (c.axis === 'z') {
      c.mesh.position.set(c.lane + weave, 0, c.pos);
      c.mesh.rotation.y = c.dir > 0 ? 0 : Math.PI;
    } else {
      c.mesh.position.set(c.pos, 0, c.lane + weave);
      c.mesh.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  _carDir(c) {
    return c.axis === 'z' ? new THREE.Vector3(0, 0, c.dir) : new THREE.Vector3(c.dir, 0, 0);
  }

  _hitTest(c) {
    const p = this.G.player;
    const cp = c.mesh.position;
    const hx = c.axis === 'z' ? 1.15 : 2.4, hz = c.axis === 'z' ? 2.4 : 1.15;
    if (p.pos.y < 1.5 && Math.abs(p.pos.x - cp.x) < hx && Math.abs(p.pos.z - cp.z) < hz) {
      return p.carHit(this._carDir(c), 16);
    }
    // flatten fiends
    for (const e of this.G.enemies.list) {
      if (e.dead) continue;
      if (Math.abs(e.pos.x - cp.x) < hx + 0.3 && Math.abs(e.pos.z - cp.z) < hz + 0.3) this.G.enemies.kill(e);
    }
    return false;
  }

  update(dt, t) {
    this.hornCD = Math.max(0, this.hornCD - dt);
    const player = this.G.player;

    for (const c of this.cars) {
      c.pos += c.dir * c.speed * dt;
      if (c.pos > 238) c.pos = -238;
      if (c.pos < -238) c.pos = 238;
      this._placeCar(c);
      for (const w of c.wheels) w.rotation.x += c.speed * dt * 3;
      this._hitTest(c);
      // honk if the wizard is in the road ahead
      if (this.hornCD <= 0) {
        const cp = c.mesh.position, d = this._carDir(c);
        const ahead = (player.pos.x - cp.x) * d.x + (player.pos.z - cp.z) * d.z;
        const lateral = Math.abs((player.pos.x - cp.x) * d.z - (player.pos.z - cp.z) * d.x);
        if (ahead > 3 && ahead < 16 && lateral < 2.5) {
          this.G.audio.sfxAt('car_horn', cp.distanceTo(player.pos), 35, { vol: 0.8 });
          this.hornCD = 3.5;
        }
      }
    }

    // ---- the rare one: she CHASES now ----
    if (!this.karen) {
      this.karenTimer -= dt;
      if (this.karenTimer <= 0 && this.G.state === 'play' && !this.G.story.partyStarted) this.spawnKaren();
    } else this.updateKaren(dt);
  }

  updateKaren(dt) {
    const k = this.karen, G = this.G, player = G.player;
    k.lineCD = Math.max(0, k.lineCD - dt);
    k.screechCD = Math.max(0, k.screechCD - dt);
    k.stateT -= dt;

    // she pursues the player — but only onto roads; off-road she waits on the
    // nearest road, revving, until the timer runs out
    const road = this._nearestRoadPoint(player.pos);
    const playerOnRoad = road.dist < 10;
    const target = playerOnRoad ? player.pos : road.point;
    const tx = target.x - k.x, tz = target.z - k.z;
    const distT = Math.hypot(tx, tz);
    const distP = Math.hypot(player.pos.x - k.x, player.pos.z - k.z);

    if (k.state !== 'leave') {
      k.giveUp -= dt;
      if (k.hits >= 3 || k.giveUp <= 0) {
        k.state = 'leave';
        k.stateT = 14;
        if (G.state === 'play') G.audio.voice('kar_4', 50);
        G.hud.toast(k.hits >= 3 ? 'DRIVER: "UGH, whatever?? I have pilates??" — she got you 3 times' : 'The reckless driver gives up. For now.');
      }
    }

    // steering
    const desired = k.state === 'leave' ? k.heading : Math.atan2(tx, tz);
    let dh = desired - k.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const behind = Math.abs(dh) > Math.PI * 0.6;

    let targetSpeed;
    if (k.state === 'chase') {
      k.heading += THREE.MathUtils.clamp(dh, -1, 1) * 2.6 * dt;
      targetSpeed = playerOnRoad || distT > 4 ? 24 : 6; // rev menacingly at the curb
      // overshot the player -> slam it into reverse
      if (behind && distP < 14) {
        k.state = 'reverse'; k.stateT = 1.1 + Math.random() * 0.6;
        this._screech(k);
      }
    } else if (k.state === 'reverse') {
      // back up fast, steering the tail toward the target
      k.heading -= THREE.MathUtils.clamp(dh, -1, 1) * 2.2 * dt;
      targetSpeed = -15;
      if (k.stateT <= 0 || distP > 26) { k.state = 'chase'; this._screech(k); }
    } else { // leave
      targetSpeed = 28;
    }
    k.speed += (targetSpeed - k.speed) * Math.min(1, 3.5 * dt);

    // drive
    k.x += Math.sin(k.heading) * k.speed * dt;
    k.z += Math.cos(k.heading) * k.speed * dt;
    // don't phase through buildings
    for (const c of G.world.colliders) {
      if (c.max.y < 1.2) continue;
      if (k.x > c.min.x - 1.1 && k.x < c.max.x + 1.1 && k.z > c.min.z - 1.1 && k.z < c.max.z + 1.1) {
        const pens = [
          { d: (c.max.x + 1.1) - k.x, x: 1, z: 0 }, { d: k.x - (c.min.x - 1.1), x: -1, z: 0 },
          { d: (c.max.z + 1.1) - k.z, x: 0, z: 1 }, { d: k.z - (c.min.z - 1.1), x: 0, z: -1 },
        ].sort((a, b) => a.d - b.d)[0];
        k.x += pens.x * pens.d; k.z += pens.z * pens.d;
      }
    }
    k.mesh.position.set(k.x, 0, k.z);
    k.mesh.rotation.y = k.heading;
    k.mesh.rotation.z = THREE.MathUtils.clamp(-dh * 0.12, -0.12, 0.12) * Math.sign(k.speed);
    for (const w of k.wheels) w.rotation.x += k.speed * dt * 3;

    // commentary — it is, of course, your fault
    if (distP < 30 && k.screechCD <= 0 && Math.abs(k.speed) > 12) this._screech(k);
    if (distP < 18 && k.lineCD <= 0 && G.state === 'play' && k.state !== 'leave') {
      G.audio.voice(Math.random() < 0.5 ? 'kar_1' : 'kar_2', 40);
      G.hud.compliment(Math.random() < 0.5 ? '"I\'m literally driving here??"' : '"you can NOT just exist in the road??"');
      k.lineCD = 9;
    }

    // impact
    if (distP < 2.4 && player.pos.y < 1.6 && Math.abs(k.speed) > 5) {
      const dir = new THREE.Vector3(Math.sin(k.heading), 0, Math.cos(k.heading)).multiplyScalar(Math.sign(k.speed));
      if (player.carHit(dir, 22)) {
        k.hits++;
        if (G.state === 'play') G.audio.voice('kar_3', 40);
        G.hud.toast(`DRIVER: "You hit my CAR!!" (${k.hits}/3)`);
        k.state = 'reverse'; k.stateT = 1.6;
      }
    }
    // flatten fiends too
    for (const e of G.enemies.list) {
      if (!e.dead && Math.abs(k.speed) > 6 && Math.hypot(e.pos.x - k.x, e.pos.z - k.z) < 2.4) G.enemies.kill(e);
    }

    // exit stage left
    if (k.state === 'leave' && (Math.abs(k.x) > 244 || Math.abs(k.z) > 244 || k.stateT <= 0)) {
      G.scene.remove(k.mesh);
      this.karen = null;
      this.karenTimer = 70 + Math.random() * 80;
    }
  }

  _screech(k) {
    if (k.screechCD > 0) return;
    this.G.audio.sfxAt('tire_screech', Math.hypot(this.G.player.pos.x - k.x, this.G.player.pos.z - k.z), 45, { vol: 0.9 });
    k.screechCD = 1.8 + Math.random() * 1.5;
  }
}
