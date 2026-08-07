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

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let tGlobal = 0;

function loop() {
  // keep simulating even when the tab is hidden (rAF throttles there)
  if (document.hidden) setTimeout(loop, 50);
  else requestAnimationFrame(loop);
  tick(Math.min(0.05, clock.getDelta()));
}

function tick(dt) {
  fitViewport();
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

  // screen shake
  if (shakeAmt > 0.001) {
    shakeAmt *= Math.pow(0.001, dt);
    camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.5;
    camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.5;
  }

  if (G.state !== 'title' && G.state !== 'ended') G.hud.update();
  composer.render();
  G.input.endFrame();
}
loop();

// ---- debug hooks (used by automated tests; harmless in production) ----
G.tick = tick;
G.composer = composer;
G.capture = async (name) => {
  composer.render();
  const data = renderer.domElement.toDataURL('image/png');
  if (!import.meta.env.DEV) return; // dev-server sink only; no-op in the deployed build
  await fetch('/__shot', { method: 'POST', body: JSON.stringify({ name, data }) }).catch(() => {});
  return 'saved ' + name;
};
