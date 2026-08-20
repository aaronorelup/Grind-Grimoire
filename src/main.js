// GRIND & GRIMOIRE — bootstrap + game loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './input.js';
import { AudioManager } from './audio.js';
import { FX } from './fx.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { NPCs } from './npcs.js';
import { Traffic } from './traffic.js';
import { HUD } from './hud.js';
import { Cinema } from './cutscenes.js';
import { Story } from './story.js';

const G = { state: 'title', timeHour: 14 };
window.G = G; // debug

// ---------------- renderer ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(-60, 20, 40);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.55, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function fitViewport() {
  const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight);
  const size = new THREE.Vector2();
  renderer.getSize(size);
  if (size.x === w && size.y === h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
addEventListener('resize', fitViewport);

// ---------------- game objects ----------------
G.scene = scene; G.camera = camera; G.renderer = renderer;
G.input = new Input();
G.audio = new AudioManager();
G.fx = new FX(scene);
G.world = new World(scene);
G.player = new Player(G);
G.enemies = new Enemies(G);
G.npcs = new NPCs(G);
G.traffic = new Traffic(G);
G.hud = new HUD(G);
G.cine = new Cinema(G);
G.story = new Story(G);
G.camLook = new THREE.Vector3().copy(G.player.pos);

// screen shake
let shakeAmt = 0;
G.shake = (a) => { shakeAmt = Math.min(1, shakeAmt + a); };

// ---------------- title / boot ----------------
const startBtn = document.getElementById('start-btn');
const loadStatus = document.getElementById('load-status');

async function boot() {
  try {
    await G.audio.init((done, total) => {
      loadStatus.textContent = `summoning audio… ${done}/${total}`;
    });
    loadStatus.textContent = G.audio.buffers.size
      ? `${G.audio.buffers.size} sounds conjured ✓`
      : 'no audio files found — running silent (run: npm run audio)';
  } catch (e) {
    loadStatus.textContent = 'audio failed to load — running silent';
  }
  startBtn.disabled = false;
  startBtn.textContent = 'BEGIN THE QUEST';
}
boot();

startBtn.addEventListener('click', async () => {
  G.audio.resume();
  document.getElementById('title').classList.add('hidden');
  document.getElementById('fade').style.opacity = 0;
  G.audio.music('day');
  await intro();
});

document.getElementById('replay-btn').addEventListener('click', () => location.reload());

async function intro() {
  G.state = 'cutscene';
  await G.cine.play([
    { pos: [-190, 30, 80], look: [-60, 0, -20], move: 0.01, hold: 0.4 },
    { pos: [-95, 14, 30], look: [-35, 2, -12], move: 7, line: 'n_intro_1' },
    { pos: [-38, 3.5, 45], look: [-22, 4, -40], move: 7, line: 'n_intro_2' },
    { pos: [120, 34, -190], look: [200, 3, 210], move: 7, line: 'n_intro_3' },
    { pos: [-39, 1.8, -7], look: [-35, 1.3, -12], move: 3, line: 'k_intro_1' },
  ]);
  G.state = 'play';
  G.hud.show();
  G.hud.setObjective('Collect 12 ✒ inspiration — shops, shards, and fresh drip');
  G.hud.setCash(G.story.cash);
  G.hud.toast('WASD skate · SPACE ollie & wall-jump · land on ANY edge to grind', '', 7000);
  G.hud.toast('CLICK to cast fireballs (uses MP) — refill MP at shops', '', 7000);
}

// ---------------- camera follow ----------------
const camPos = new THREE.Vector3(-40, 4, -4);
function followCamera(dt) {
  const p = G.player;
  const dist = 8.6 + Math.min(3, p.speed * 0.09);
  const h = 3.4 + Math.min(1.5, p.speed * 0.03);
  const back = p.forward.multiplyScalar(-dist);
  const target = p.pos.clone().add(back).add(new THREE.Vector3(0, h, 0));
  // don't sink the camera into the ground
  target.y = Math.max(target.y, p.pos.y + 1.2, 1.2);
  const k = 1 - Math.pow(0.0001, dt);
  camPos.lerp(target, k);
  const look = p.pos.clone().add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(p.vel, 0.06);
  G.camLook.lerp(look, 1 - Math.pow(0.00001, dt));
  camera.position.copy(camPos);
  camera.lookAt(G.camLook);
  const fovT = 62 + Math.min(18, p.speed * 0.62);
  camera.fov += (fovT - camera.fov) * Math.min(1, 5 * dt);
  camera.updateProjectionMatrix();
}

// ---------------- time of day ----------------
let lastAppliedHour = -1;
let nightToastDone = false;
function advanceTime(dt) {
  if (G.state === 'play') {
    G.timeHour = Math.min(25.98, G.timeHour + dt / 75); // 1 game hour per 75s
  }
  if (Math.abs(G.timeHour - lastAppliedHour) > 0.004) {
    lastAppliedHour = G.timeHour;
    G.world.setTime(G.timeHour);
    G.hud.setClock(G.timeHour);
    bloom.strength = 0.42 + G.world.night01 * 0.35;
  }
  // the mixtape mercifully runs out after a while
  if (G.audio.currentMusic?.name === 'mixtape' && G.story.mixtapeT > 0) {
    G.story.mixtapeT -= dt;
    if (G.story.mixtapeT <= 0) {
      G.audio.music(G.world.night01 > 0.5 ? 'night' : 'day', 2.5);
      G.hud.toast('🎵 The mixtape ends. Silence. Then, mercifully, the vibes return.');
    }
  }
  if (G.timeHour >= 20 && !nightToastDone) {
    nightToastDone = true;
    if (!G.story.partyStarted) {
      if (G.audio.currentMusic?.name !== 'mixtape') G.audio.music('night'); // the mixtape outranks the night
      G.hud.toast('🌙 Night falls on Venice. The fiends grow bold…', 'gold', 6000);
    }
  }
}

// ---------------- adaptive quality ----------------
// Integrated GPUs run out of draw-call budget here long before they run out of
// fill rate, so the ladder gives up resolution and post first and the shadow map
// last.
//
// `cull` is the radius past which crowd actors stop being drawn. The top tier
// never culls, so hardware that was already fine sees exactly the scene it saw
// before; only a machine that has proven it cannot keep up trades pop-in for
// playable. Characters are ~8 draw calls each, so this is the largest single
// lever left once the static world is welded.
// `shadow: 0` turns the shadow map off outright. That is worth more than any
// other single rung: the shadow pass is a second render of every caster in the
// sun's frustum (~190 draw calls here) *and* a texture lookup in every lit
// fragment. A machine that cannot hold 30fps at 'low' gets a flat-lit world and
// roughly double the frame rate for it.
const TIERS = [
  { name: 'potato', dpr: 0.6,  bloom: false, shadow: 0,    cull: 55 },
  { name: 'low',    dpr: 0.75, bloom: false, shadow: 1024, cull: 70 },
  { name: 'medium', dpr: 1.0,  bloom: true,  shadow: 1024, cull: 115 },
  { name: 'high',   dpr: 1.75, bloom: true,  shadow: 2048, cull: Infinity },
];
let tier = TIERS.length - 1;
let tierFloor = Infinity;   // lowest tier that has already failed — never retried
let tierPinned = false;     // set by G.setQuality()
const samples = [];

function applyTier() {
  const q = TIERS[tier];
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.dpr));
  composer.setSize(innerWidth, innerHeight);
  const sun = G.world.sun;
  const wantShadows = q.shadow > 0;
  if (renderer.shadowMap.enabled !== wantShadows) {
    renderer.shadowMap.enabled = wantShadows;
    sun.castShadow = wantShadows;
    // whether a material samples a shadow map is compiled into it, so every
    // material has to be rebuilt when this flips
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
    });
  }
  if (wantShadows && sun.shadow.mapSize.x !== q.shadow) {
    sun.shadow.mapSize.set(q.shadow, q.shadow);
    // force three to rebuild the shadow target at the new size
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  if (!wantShadows && sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  G.quality = q.name;
}
applyTier();

// crowd actors are groups of ~8 small meshes; hiding a whole group past the
// tier's radius is worth ~8 draw calls apiece. Positions only — nothing in the
// AI or the story reads `visible`.
const _cullVec = new THREE.Vector3();
function cullDistant() {
  const R = TIERS[tier].cull;
  if (!isFinite(R)) return;
  const R2 = R * R, p = G.player.pos;
  const test = (o) => {
    if (!o || !o.isObject3D) return;
    o.visible = o.getWorldPosition(_cullVec).distanceToSquared(p) <= R2;
  };
  const each = (v, fn) => {
    if (Array.isArray(v)) v.forEach(fn);
    else if (v && typeof v === 'object') Object.values(v).forEach(fn);
  };
  each(G.npcs.strangers, (n) => test(n.group || n.mesh));
  each(G.npcs.friends, (n) => test(n.group || n.mesh));
  each(G.traffic.cars, (c) => test(c.group || c.mesh));
  each(G.enemies.list, (e) => test(e.group || e.mesh));
  each(G.world.shops, (s) => test(s.keeper && s.keeper.group));
}

// The signal is the frame *period*, not the CPU time we spend inside the frame:
// a GPU-bound machine finishes our JavaScript quickly and then waits, so CPU
// time would report everything is fine while the picture crawls. Sampled as a
// median over ~60 frames so one GC pause cannot demote the whole session, and
// never while hidden (the loop deliberately falls back to a 50ms setTimeout
// there, which would otherwise read as 20fps).
function sampleQuality(periodMs, force = false) {
  if (tierPinned || (document.hidden && !force)) return;
  samples.push(periodMs);
  if (samples.length < 60) return;
  const med = samples.slice().sort((a, b) => a - b)[samples.length >> 1];
  samples.length = 0;
  if (med > 22 && tier > 0) {            // slower than ~45fps — drop a notch
    tierFloor = Math.min(tierFloor, tier);
    tier--;
    applyTier();
  } else if (med < 13 && tier + 1 < tierFloor && tier < TIERS.length - 1) {
    tier++;                              // >75fps, and this tier has never failed
    applyTier();
  }
}

// ---------------- main loop ----------------
// The simulation used to advance by `Math.min(0.05, delta)`, which meant any
// machine under 20fps ran the world in literal slow motion — it did not just
// *look* choppy on a weak laptop, the game genuinely moved slower. A big delta
// is now split into fixed 1/60 slices so wall-clock time stays honest down to
// ~10fps. Fast machines keep the old single variable-length step, so nothing
// about the feel changes on hardware that was already fine.
const clock = new THREE.Clock();
const FIXED = 1 / 60;
const MAX_SUBSTEPS = 6;
let tGlobal = 0;

function loop() {
  // keep simulating even when the tab is hidden (rAF throttles there)
  if (document.hidden) setTimeout(loop, 50);
  else requestAnimationFrame(loop);

  const period = clock.getDelta();
  // beyond MAX_SUBSTEPS of debt we drop time on purpose rather than death-spiral
  let dt = Math.min(period, FIXED * MAX_SUBSTEPS);

  if (dt <= FIXED * 1.5) {
    step(dt);
    G.input.endFrame();
  } else {
    let n = 0;
    while (dt > 1e-4 && n < MAX_SUBSTEPS) {
      const slice = Math.min(FIXED, dt);
      step(slice);
      dt -= slice;
      if (n === 0) G.input.endFrame();   // only the first slice sees a keypress edge
      n++;
    }
  }

  render();
  sampleQuality(period * 1000);
}

function step(dt) {
  tGlobal += dt;

  G.world.update(dt, tGlobal);
  G.fx.update(dt);

  if (G.state === 'play') {
    G.player.update(dt, tGlobal);
    G.enemies.update(dt, tGlobal);
    G.npcs.update(dt, tGlobal);
    G.traffic.update(dt, tGlobal);
    G.story.update(dt);
    advanceTime(dt);
    followCamera(dt);
  } else if (G.state === 'cutscene') {
    G.player.syncMesh(dt, tGlobal);
    G.npcs.update(dt, tGlobal);
    camera.position.copy(G.cine.cam.pos);
    camera.lookAt(G.cine.cam.look);
    G.camLook.copy(G.cine.cam.look);
    camPos.copy(camera.position);
  } else if (G.state === 'shopping') {
    G.player.syncMesh(dt, tGlobal);
    if (G.input.hit('KeyE') || G.input.hit('Escape')) G.story.closeShopMenu();
    followCamera(dt);
  } else if (G.state === 'title' || G.state === 'ended') {
    // idle orbit over the beach
    const a = tGlobal * 0.05;
    camera.position.set(-60 + Math.cos(a) * 40, 22, Math.sin(a) * 60);
    camera.lookAt(-30, 0, 0);
  } else if (G.state === 'dead') {
    G.player.syncMesh(dt, tGlobal);
  }

  if (shakeAmt > 0.001) shakeAmt *= Math.pow(0.001, dt);
  else shakeAmt = 0;
}

function render() {
  fitViewport();
  cullDistant();

  // shake is a view offset, not simulation — applied once, after the last slice
  if (shakeAmt > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.5;
    camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.5;
  }

  if (G.state !== 'title' && G.state !== 'ended') G.hud.update();
  if (TIERS[tier].bloom) composer.render();
  else renderer.render(scene, camera);
}
loop();

// ---- debug hooks (used by automated tests; harmless in production) ----
G.tick = (dt) => { step(dt); G.input.endFrame(); render(); };
// pin the quality ladder — for benchmarking, and for anyone stuck on a machine
// where the auto-detect guesses wrong. `G.setQuality(null)` hands control back.
// feed the ladder a synthetic frame period — lets a test walk the tiers without
// needing a real slow GPU (and without a visible, compositing page).
G.feedFrameTime = (periodMs) => { sampleQuality(periodMs, true); return G.quality; };
G.setQuality = (name) => {
  if (name === null) { tierPinned = false; tierFloor = Infinity; samples.length = 0; return G.quality; }
  const i = TIERS.findIndex((t) => t.name === name);
  if (i < 0) return G.quality;
  tier = i; tierPinned = true; samples.length = 0;
  applyTier();
  return G.quality;
};
G.composer = composer;
G.capture = async (name) => {
  composer.render();
  const data = renderer.domElement.toDataURL('image/png');
  if (!import.meta.env.DEV) return; // dev-server sink only; no-op in the deployed build
  await fetch('/__shot', { method: 'POST', body: JSON.stringify({ name, data }) }).catch(() => {});
  return 'saved ' + name;
};
