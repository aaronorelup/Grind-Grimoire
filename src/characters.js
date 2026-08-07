// Procedural character meshes — every model built from primitives.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const { noCache, ...rest } = opts;
  const key = `${color}|${rest.emissive || 0}|${rest.emissiveIntensity || 0}`;
  if (!noCache && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, ...rest });
  if (!noCache) matCache.set(key, m);
  return m;
}

const SKIN = 0xd9a066, SKIN_PALE = 0xa8b58a;

function box(w, h, d, color, opts) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts)); m.castShadow = true; return m; }
function cyl(rt, rb, h, color, seg = 10, opts) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts)); m.castShadow = true; return m; }
function ball(r, color, seg = 12, opts) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), mat(color, opts)); m.castShadow = true; return m; }

// limb pivoted at its top so rotation acts like a joint
function limb(mesh, len) { const g = new THREE.Group(); mesh.position.y = -len / 2; g.add(mesh); return g; }

// ============================== KAI, THE WIZARD ==============================
export function makeWizard() {
  const root = new THREE.Group();

  // --- skateboard ---
  const board = new THREE.Group();
  const deck = box(0.28, 0.035, 1.02, 0x4a3220);
  deck.position.y = 0.115;
  const tail = box(0.27, 0.033, 0.2, 0x4a3220); tail.position.set(0, 0.145, -0.56); tail.rotation.x = -0.45;
  const nose = box(0.27, 0.033, 0.2, 0x4a3220); nose.position.set(0, 0.145, 0.56); nose.rotation.x = 0.45;
  const under = box(0.26, 0.012, 0.98, 0x2ec4b6); under.position.y = 0.092; // teal griptape underside pop
  board.add(deck, tail, nose, under);
  const wheels = [];
  for (const [x, z] of [[-0.11, 0.32], [0.11, 0.32], [-0.11, -0.32], [0.11, -0.32]]) {
    const w = cyl(0.052, 0.052, 0.045, 0xffe9c9, 10);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.052, z);
    board.add(w); wheels.push(w);
  }
  root.add(board);

  // --- figure (stands sideways on the board, faces travel direction) ---
  const fig = new THREE.Group();
  fig.position.y = 0.135;
  fig.rotation.y = -1.15; // skate stance
  root.add(fig);

  // legs (mostly under robe; shoes visible)
  const legL = limb(cyl(0.055, 0.05, 0.34, 0x2a2138), 0.34);
  const legR = limb(cyl(0.055, 0.05, 0.34, 0x2a2138), 0.34);
  legL.position.set(0, 0.62, 0.19); legR.position.set(0, 0.62, -0.19);
  const shoeL = box(0.13, 0.09, 0.26, 0xf5f0e6); shoeL.position.set(0, -0.32, 0.02);
  const shoeR = box(0.13, 0.09, 0.26, 0xf5f0e6); shoeR.position.set(0, -0.32, 0.02);
  legL.add(shoeL); legR.add(shoeR);
  fig.add(legL, legR);

  // robe
  const robe = cyl(0.17, 0.4, 0.75, 0x6c3fb5, 12);
  robe.position.y = 0.95;
  const belt = cyl(0.2, 0.21, 0.07, 0xffc94d, 12); belt.position.y = 0.78;
  const trim = cyl(0.4, 0.41, 0.05, 0xffc94d, 12); trim.position.y = 0.6;
  fig.add(robe, belt, trim);

  // arms
  const armL = limb(cyl(0.05, 0.045, 0.42, 0x6c3fb5), 0.42);
  const armR = limb(cyl(0.05, 0.045, 0.42, 0x6c3fb5), 0.42);
  armL.position.set(0, 1.28, 0.24); armR.position.set(0, 1.28, -0.24);
  const handL = ball(0.06, SKIN); handL.position.y = -0.46;
  const handR = ball(0.06, SKIN); handR.position.y = -0.46;
  armL.add(handL); armR.add(handR);
  armL.rotation.x = 0.25; armR.rotation.x = -0.25;
  fig.add(armL, armR);

  // head
  const headG = new THREE.Group();
  headG.position.y = 1.42;
  headG.rotation.y = 1.0; // look where you're going
  const head = ball(0.155, SKIN, 14); head.position.y = 0.1;
  const nosee = ball(0.035, SKIN); nosee.position.set(0.155, 0.09, 0);
  // eyes so you can read where Kai is looking in cutscenes
  const eyeW_L = ball(0.032, 0xffffff, 8); eyeW_L.position.set(0.13, 0.14, 0.06);
  const eyeW_R = ball(0.032, 0xffffff, 8); eyeW_R.position.set(0.13, 0.14, -0.06);
  const pupL = ball(0.016, 0x1a1a2a, 6); pupL.position.set(0.155, 0.14, 0.06);
  const pupR = ball(0.016, 0x1a1a2a, 6); pupR.position.set(0.155, 0.14, -0.06);
  // eyebrows: permanently confident
  const browL = box(0.02, 0.015, 0.07, 0x3a2a1a); browL.position.set(0.145, 0.195, 0.06); browL.rotation.x = 0.15;
  const browR = box(0.02, 0.015, 0.07, 0x3a2a1a); browR.position.set(0.145, 0.195, -0.06); browR.rotation.x = -0.15;
  headG.add(head, nosee, eyeW_L, eyeW_R, pupL, pupR, browL, browR);

  // wizard hat
  const hatG = new THREE.Group(); hatG.position.y = 0.2; hatG.rotation.z = -0.12;
  const brim = cyl(0.3, 0.32, 0.03, 0x5a32a0, 14); brim.position.y = 0.02;
  const cone = cyl(0.005, 0.19, 0.5, 0x5a32a0, 12); cone.position.y = 0.27; cone.rotation.z = -0.15;
  const band = cyl(0.165, 0.185, 0.07, 0xffc94d, 12); band.position.y = 0.06;
  const star = ball(0.035, 0xffe08a, 8, { emissive: 0xffcf5c, emissiveIntensity: 0.8 }); star.position.set(0.14, 0.09, 0);
  hatG.add(brim, cone, band, star);
  headG.add(hatG);
  fig.add(headG);

  // ---------- DRIP attachments (hidden until purchased) ----------
  const drip = {};
  // Prism Shades
  const shades = new THREE.Group();
  const lens = box(0.06, 0.07, 0.26, 0x101018, { emissive: 0x5ce0ff, emissiveIntensity: 0.35, noCache: true });
  lens.position.set(0.13, 0.1, 0);
  shades.add(lens); shades.visible = false;
  headG.add(shades); drip.shades = shades;
  // Chain of Intention
  const chain = new THREE.Group();
  const chainT = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 20), mat(0xffd75c, { emissive: 0xaa7700, emissiveIntensity: 0.4 }));
  chainT.rotation.x = 0.55; chainT.position.set(0.03, 1.3, 0); chainT.scale.set(1, 1, 0.6);
  const pendant = ball(0.05, 0xffd75c, 8, { emissive: 0xaa7700, emissiveIntensity: 0.5 }); pendant.position.set(0.14, 1.18, 0);
  chain.add(chainT, pendant); chain.visible = false;
  fig.add(chain); drip.chain = chain;
  // Midnight Sherpa (collar + torso overlay)
  const sherpa = new THREE.Group();
  const jacket = cyl(0.21, 0.3, 0.42, 0x1d2440, 12, { noCache: true }); jacket.position.y = 1.18;
  const collar = cyl(0.24, 0.22, 0.1, 0xf5f0e6, 12); collar.position.y = 1.38;
  sherpa.add(jacket, collar); sherpa.visible = false;
  fig.add(sherpa); drip.sherpa = sherpa;
  // Halo Snapback (gold halo above hat)
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 24), mat(0xfff3b0, { emissive: 0xffd75c, emissiveIntensity: 1.4 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 0.75; halo.visible = false;
  hatG.add(halo); drip.halo = halo;
  // Cloudstep Kicks (glow soles)
  const kicksL = box(0.14, 0.03, 0.28, 0x5ce0ff, { emissive: 0x2fb8e0, emissiveIntensity: 1.6, noCache: true });
  const kicksR = kicksL.clone(); kicksL.position.set(0, -0.375, 0.02); kicksR.position.set(0, -0.375, 0.02);
  kicksL.visible = kicksR.visible = false;
  legL.add(kicksL); legR.add(kicksR); drip.kicks = { visible: false, set v(x) { kicksL.visible = kicksR.visible = x; this.visible = x; } };
  // Aura Cape
  const capeGeo = new THREE.PlaneGeometry(0.5, 0.85, 4, 8);
  const capeMat = new THREE.MeshLambertMaterial({ color: 0xff4fa0, side: THREE.DoubleSide, emissive: 0x8a1a55, emissiveIntensity: 0.35 });
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(-0.22, 1.0, 0); cape.rotation.y = Math.PI / 2; cape.visible = false;
  fig.add(cape); drip.cape = cape;

  root.traverse(o => { o.castShadow = true; });
  return {
    group: root,
    parts: { board, wheels, fig, legL, legR, armL, armR, headG, hatG, robe, cape, handR, handL },
    drip,
  };
}

// Wizard procedural animation. state: {mode:'ground'|'air'|'grind', speed, lean, pushT, crouch, t}
export function animWizard(w, dt, s) {
  const p = w.parts;
  const t = s.t;
  // wheels spin
  const spin = s.mode === 'air' ? 6 : s.speed * 3.2;
  for (const wh of p.wheels) wh.rotation.x += spin * dt;
  // board + figure lean into turns
  p.board.rotation.z = THREE.MathUtils.lerp(p.board.rotation.z, -s.lean * 0.35, 12 * dt);
  p.fig.rotation.z = THREE.MathUtils.lerp(p.fig.rotation.z, -s.lean * 0.3, 10 * dt);

  let targetBob = 0, armLX = 0.25, armRX = -0.25, boardRX = 0, figY = 0.135;
  if (s.mode === 'ground') {
    targetBob = Math.sin(t * (4 + s.speed * 0.5)) * 0.02 * Math.min(1, s.speed / 8);
    figY = 0.135 - s.crouch * 0.12 + targetBob;
    // push kick
    if (s.pushT > 0) {
      const k = Math.sin(Math.min(1, 1 - s.pushT) * Math.PI);
      p.legR.rotation.x = k * 0.9;
    } else p.legR.rotation.x = THREE.MathUtils.lerp(p.legR.rotation.x, 0, 8 * dt);
    armLX = 0.25 + Math.sin(t * 3) * 0.08;
    armRX = -0.25 - Math.sin(t * 3.3) * 0.08;
  } else if (s.mode === 'air') {
    figY = 0.1; boardRX = 0.12;
    armLX = 2.5; armRX = -0.9; // one arm up, rad!
    p.legR.rotation.x = THREE.MathUtils.lerp(p.legR.rotation.x, 0.4, 10 * dt);
  } else if (s.mode === 'grind') {
    figY = 0.135 - 0.1 + Math.sin(t * 18) * 0.008;
    armLX = 1.5; armRX = -1.5; // balance arms out
    boardRX = 0;
  }
  if (s.casting > 0) armRX = -2.4; // throw fireball
  p.fig.position.y = THREE.MathUtils.lerp(p.fig.position.y, figY, 14 * dt);
  p.armL.rotation.x = THREE.MathUtils.lerp(p.armL.rotation.x, armLX, 10 * dt);
  p.armR.rotation.x = THREE.MathUtils.lerp(p.armR.rotation.x, armRX, 12 * dt);
  p.board.rotation.x = THREE.MathUtils.lerp(p.board.rotation.x, boardRX, 10 * dt);
  // cape flutter
  if (p.cape.visible) {
    p.cape.rotation.x = 0.25 + Math.min(0.9, s.speed * 0.05) + Math.sin(t * 6) * 0.08;
  }
  // hat bounce
  p.hatG.rotation.x = Math.sin(t * 5) * 0.03 * Math.min(1, s.speed / 10);
}

// ============================== THE FIENDS ==============================
const HOODIES = [0x4a4a52, 0x5a4632, 0x5c3040, 0x37474f, 0x4a3d5c];
export function makeFiend() {
  const root = new THREE.Group();
  const hoodie = HOODIES[(Math.random() * HOODIES.length) | 0];
  const fig = new THREE.Group(); root.add(fig);

  const legL = limb(cyl(0.06, 0.05, 0.42, 0x2e2a26), 0.42);
  const legR = limb(cyl(0.06, 0.05, 0.42, 0x2e2a26), 0.42);
  legL.position.set(0.09, 0.72, 0); legR.position.set(-0.09, 0.72, 0);
  fig.add(legL, legR);

  const torso = new THREE.Group(); torso.position.y = 0.72; torso.rotation.x = 0.5; // hunched
  const chest = cyl(0.16, 0.2, 0.5, hoodie, 8); chest.position.y = 0.25;
  // tattered hem
  const hem = cyl(0.2, 0.26, 0.12, hoodie, 6); hem.position.y = 0.0;
  torso.add(chest, hem);
  const armL = limb(cyl(0.045, 0.04, 0.48, hoodie), 0.48);
  const armR = limb(cyl(0.045, 0.04, 0.48, hoodie), 0.48);
  armL.position.set(0.2, 0.45, 0.05); armR.position.set(-0.2, 0.45, 0.05);
  armL.rotation.x = -1.5; armR.rotation.x = -1.65; // arms forward!
  const handL = ball(0.05, SKIN_PALE); handL.position.y = -0.5; armL.add(handL);
  const handR = ball(0.05, SKIN_PALE); handR.position.y = -0.5; armR.add(handR);
  torso.add(armL, armR);

  const headG = new THREE.Group(); headG.position.y = 0.58; headG.rotation.x = -0.35;
  const head = ball(0.14, SKIN_PALE, 10); headG.add(head);
  const hood = cyl(0.15, 0.18, 0.22, hoodie, 8); hood.position.set(0, 0.05, -0.06); hood.rotation.x = 0.3; headG.add(hood);
  const eyeL = ball(0.028, 0xff2222, 6, { emissive: 0xff2222, emissiveIntensity: 2.2 });
  const eyeR = eyeL.clone(); eyeL.position.set(0.055, 0.02, 0.125); eyeR.position.set(-0.055, 0.02, 0.125);
  const jaw = box(0.09, 0.05, 0.06, SKIN_PALE); jaw.position.set(0, -0.12, 0.1);
  headG.add(eyeL, eyeR, jaw);
  torso.add(headG);
  fig.add(torso);

  root.traverse(o => { o.castShadow = true; });
  return { group: root, parts: { fig, legL, legR, armL, armR, torso, headG, jaw }, phase: Math.random() * 9 };
}

export function animFiend(f, t, speed) {
  const p = f.parts, ph = f.phase;
  const rate = 6 + speed * 1.1;
  p.legL.rotation.x = Math.sin(t * rate + ph) * 0.55;
  p.legR.rotation.x = -Math.sin(t * rate + ph) * 0.55;
  p.armL.rotation.x = -1.5 + Math.sin(t * rate * 0.5 + ph) * 0.15;
  p.armR.rotation.x = -1.65 - Math.sin(t * rate * 0.5 + ph + 1) * 0.15;
  p.fig.position.y = Math.abs(Math.sin(t * rate + ph)) * 0.04;
  p.torso.rotation.z = Math.sin(t * (rate * 0.5) + ph) * 0.08;
  p.jaw.position.y = -0.12 - Math.abs(Math.sin(t * 3 + ph)) * 0.03; // chatter
  p.headG.rotation.z = Math.sin(t * 0.7 + ph) * 0.15; // unsettling head roll
}

// ============================== CIVILIANS / FRIENDS ==============================
const SHIRTS = [0xff6b5c, 0x5ce0ff, 0xffd75c, 0xff8ad1, 0x8affc1, 0xc9b8ff, 0xffffff, 0x364a8a];
const PANTS = [0x30405c, 0x4a3220, 0x222831, 0x6e6a86, 0xd9d2c5];
export function makePerson({ shirt, pants, hat, skin = SKIN } = {}) {
  shirt = shirt ?? SHIRTS[(Math.random() * SHIRTS.length) | 0];
  pants = pants ?? PANTS[(Math.random() * PANTS.length) | 0];
  const root = new THREE.Group();
  const fig = new THREE.Group(); root.add(fig);
  const legL = limb(cyl(0.06, 0.05, 0.48, pants), 0.48);
  const legR = limb(cyl(0.06, 0.05, 0.48, pants), 0.48);
  legL.position.set(0.09, 0.78, 0); legR.position.set(-0.09, 0.78, 0);
  const torso = cyl(0.15, 0.19, 0.55, shirt, 10); torso.position.y = 1.06;
  const armL = limb(cyl(0.042, 0.038, 0.45, shirt), 0.45);
  const armR = limb(cyl(0.042, 0.038, 0.45, shirt), 0.45);
  armL.position.set(0.21, 1.3, 0); armR.position.set(-0.21, 1.3, 0);
  const head = ball(0.15, skin, 12); head.position.y = 1.5;
  const pupilL = ball(0.02, 0x1a1a2a, 6); pupilL.position.set(0.055, 1.53, 0.135);
  const pupilR = ball(0.02, 0x1a1a2a, 6); pupilR.position.set(-0.055, 1.53, 0.135);
  fig.add(legL, legR, torso, armL, armR, head, pupilL, pupilR);
  let hatMesh = null;
  if (hat) {
    hatMesh = cyl(0.16, 0.16, 0.1, hat, 10); hatMesh.position.y = 1.63;
    const bill = box(0.18, 0.03, 0.14, hat); bill.position.set(0, 1.6, 0.18);
    fig.add(hatMesh, bill);
  }
  root.traverse(o => { o.castShadow = true; });
  return { group: root, parts: { fig, legL, legR, armL, armR, head }, phase: Math.random() * 9 };
}

export function animWalk(p, t, speed) {
  const s = p.parts, ph = p.phase;
  const rate = 5.5 * Math.min(1.5, Math.max(0.001, speed) / 1.8);
  if (speed > 0.05) {
    s.legL.rotation.x = Math.sin(t * rate + ph) * 0.5;
    s.legR.rotation.x = -Math.sin(t * rate + ph) * 0.5;
    s.armL.rotation.x = -Math.sin(t * rate + ph) * 0.35;
    s.armR.rotation.x = Math.sin(t * rate + ph) * 0.35;
    s.fig.position.y = Math.abs(Math.sin(t * rate + ph)) * 0.03;
  } else {
    for (const l of [s.legL, s.legR, s.armL, s.armR]) l.rotation.x *= 0.9;
    s.fig.position.y = Math.sin(t * 1.5 + ph) * 0.012; // idle breathing
  }
}

// ============================== KICKFLIP THE DOG ==============================
export function makeDog() {
  const root = new THREE.Group();
  const fig = new THREE.Group(); root.add(fig);
  const bodyC = 0xd98e4a, creamC = 0xf2e3c8;
  const body = box(0.24, 0.24, 0.52, bodyC); body.position.y = 0.4;
  const chest = box(0.2, 0.18, 0.2, creamC); chest.position.set(0, 0.36, 0.24);
  const headG = new THREE.Group(); headG.position.set(0, 0.56, 0.3);
  const head = box(0.24, 0.2, 0.22, bodyC);
  const snout = box(0.1, 0.09, 0.12, creamC); snout.position.set(0, -0.03, 0.15);
  const noseTip = box(0.045, 0.04, 0.03, 0x222222); noseTip.position.set(0, -0.01, 0.22);
  const earL = cyl(0.005, 0.05, 0.12, bodyC, 4); earL.position.set(0.08, 0.15, 0);
  const earR = earL.clone(); earR.position.x = -0.08;
  const eyeL = ball(0.02, 0x1a1a1a, 6); eyeL.position.set(0.07, 0.03, 0.12);
  const eyeR = eyeL.clone(); eyeR.position.x = -0.07;
  headG.add(head, snout, noseTip, earL, earR, eyeL, eyeR);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 6, 10, Math.PI * 1.3), mat(creamC));
  tail.position.set(0, 0.55, -0.26); tail.rotation.y = Math.PI / 2;
  const legs = [];
  for (const [x, z] of [[0.09, 0.2], [-0.09, 0.2], [0.09, -0.2], [-0.09, -0.2]]) {
    const l = limb(cyl(0.032, 0.028, 0.28, bodyC, 6), 0.28);
    l.position.set(x, 0.32, z); legs.push(l); fig.add(l);
  }
  fig.add(body, chest, headG, tail);
  root.traverse(o => { o.castShadow = true; });
  return { group: root, parts: { fig, legs, headG, tail }, phase: 0 };
}

export function animDog(d, t, speed) {
  const p = d.parts;
  const rate = 9 * Math.min(1.6, Math.max(0.001, speed) / 3);
  if (speed > 0.1) {
    p.legs[0].rotation.x = Math.sin(t * rate) * 0.7;
    p.legs[1].rotation.x = -Math.sin(t * rate) * 0.7;
    p.legs[2].rotation.x = -Math.sin(t * rate) * 0.7;
    p.legs[3].rotation.x = Math.sin(t * rate) * 0.7;
    p.fig.position.y = Math.abs(Math.sin(t * rate)) * 0.05;
  } else {
    for (const l of p.legs) l.rotation.x *= 0.9;
    p.fig.position.y = 0;
  }
  p.tail.rotation.z = Math.sin(t * 10) * 0.5; // perpetual wag
  p.headG.rotation.y = Math.sin(t * 0.8) * 0.2;
}

// ============================== SHOPKEEPER ==============================
export function makeShopkeeper(apron = 0x3ecf9a) {
  const p = makePerson({ shirt: 0xf5f0e6 });
  const ap = box(0.26, 0.4, 0.02, apron); ap.position.set(0, 1.05, 0.17);
  p.group.children[0].add(ap);
  return p;
}
