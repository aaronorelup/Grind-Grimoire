// The world: Venice Beach + Santa Monica, fully procedural.
// One painted 4096px ground map, atlas-textured merged buildings, batched props,
// animated ocean, sky dome shader, pier + ferris wheel, shops with interiors,
// grind rails auto-generated from every collider edge.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeShopkeeper } from './characters.js';

const W2 = 250; // world half-size

// ---------------------------------------------------------------- utilities
function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8;
  return t;
}

function setGeoColor(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

class Batcher {
  constructor() { this.geos = []; }
  add(geo, color, x, y, z, rot = null) {
    setGeoColor(geo, color);
    const m = new THREE.Matrix4();
    if (rot) m.makeRotationFromEuler(new THREE.Euler(rot.x || 0, rot.y || 0, rot.z || 0));
    m.setPosition(x, y, z);
    geo.applyMatrix4(m);
    delete geo.attributes.uv; // unify attributes for merging
    this.geos.push(geo);
    return this;
  }
  box(w, h, d, color, x, y, z, rot) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rot); }
  cyl(rt, rb, h, color, x, y, z, rot, seg = 8) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, rot); }
  build(material) {
    if (!this.geos.length) return null;
    const merged = mergeGeometries(this.geos, false);
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}

// remap a BoxGeometry's UVs so every side face shows atlas tile `ti`, top shows `roofTi`
function atlasBoxUV(geo, ti, roofTi, grid = 4) {
  const uv = geo.attributes.uv;
  const s = 1 / grid;
  const tileU = (i) => (i % grid) * s, tileV = (i) => Math.floor(i / grid) * s;
  // BoxGeometry face order: +x,-x,+y,-y,+z,-z — each 4 verts
  for (let f = 0; f < 6; f++) {
    const t = (f === 2 || f === 3) ? roofTi : ti;
    const u0 = tileU(t), v0 = tileV(t);
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, u0 + uv.getX(i) * s * 0.96 + s * 0.02, v0 + uv.getY(i) * s * 0.96 + s * 0.02);
    }
  }
  return geo;
}

// ---------------------------------------------------------------- painted textures
function paintGround(ctx, S) {
  const px = S / (W2 * 2); // pixels per meter
  const X = (wx) => (wx + W2) * px, Z = (wz) => (wz + W2) * px;
  const rect = (x0, z0, x1, z1, fill) => { ctx.fillStyle = fill; ctx.fillRect(X(x0), Z(z0), (x1 - x0) * px, (z1 - z0) * px); };

  rect(-W2, -W2, W2, W2, '#b3ada0');                    // base concrete
  rect(-W2, -W2, -45, W2, '#e8d5a4');                   // sand
  rect(-W2, -W2, -88, W2, '#cdb488');                   // wet sand
  // boardwalk planks
  rect(-45, -W2, -25, W2, '#c9a86a');
  for (let z = -W2; z < W2; z += 0.9) {
    ctx.fillStyle = `rgba(90,60,30,${0.25 + Math.random() * 0.2})`;
    ctx.fillRect(X(-45), Z(z), 20 * px, 1.2);
  }
  rect(-13, -W2, 4, W2, '#7ba05f');                     // green strip
  // dirt path through the green
  rect(-6, -W2, -4, W2, '#a08a5f');

  const roadC = '#43454a', edgeC = 'rgba(230,230,230,0.85)', dashC = '#e8c33c';
  const roadNS = (cx) => {
    rect(cx - 6, -W2, cx + 6, W2, roadC);
    ctx.fillStyle = dashC;
    for (let z = -W2; z < W2; z += 6) ctx.fillRect(X(cx) - 1.5, Z(z), 3, 3 * px);
    ctx.fillStyle = edgeC;
    ctx.fillRect(X(cx - 5.7), 0, 2, S); ctx.fillRect(X(cx + 5.7), 0, 2, S);
  };
  const roadEW = (cz) => {
    rect(-25, cz - 6, W2, cz + 6, roadC);
    ctx.fillStyle = dashC;
    for (let x = -25; x < W2; x += 6) ctx.fillRect(X(x), Z(cz) - 1.5, 3 * px, 3);
    ctx.fillStyle = edgeC;
    ctx.fillRect(X(-25), Z(cz - 5.7), S, 2); ctx.fillRect(X(-25), Z(cz + 5.7), S, 2);
  };
  for (const cz of [-180, -120, -60, 0, 60, 120, 180]) roadEW(cz);
  for (const cx of [10, 80, 150]) roadNS(cx);
  // crosswalks
  ctx.fillStyle = 'rgba(240,240,240,0.9)';
  for (const cx of [10, 80, 150]) for (const cz of [-180, -120, -60, 0, 60, 120, 180])
    for (let k = -4; k <= 4; k += 2) { ctx.fillRect(X(cx + k) - px * 0.4, Z(cz - 5), px * 0.8, 10 * px); }

  rect(-90, 55, -52, 115, '#b8bcc0');                   // skatepark slab
  ctx.fillStyle = 'rgba(90,95,105,0.35)';
  for (let i = 0; i < 40; i++) { const a = Math.random(); ctx.beginPath(); ctx.arc(X(-90 + Math.random() * 38), Z(55 + Math.random() * 60), a * 14, 0, 7); ctx.fill(); }
  rect(186, 210, 226, 236, '#6da34f');                  // party lawn
  rect(-25, -167, -13, -153, '#c9a86a');                // pier approach

  // speckle noise
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
}

function paintFacadeAtlas(ctx, S, night) {
  const T = S / 4;
  const pal = [
    { base: '#e8c8a0', win: '#5a7a9a' }, { base: '#d98f7a', win: '#4a6a8a' },
    { base: '#9ac0b8', win: '#3a5a7a' }, { base: '#e0d8c8', win: '#6a8aa8' },
    { base: '#c8a0c8', win: '#4a5a7a' }, { base: '#f0e0b0', win: '#5a6a8a' },
    { base: '#8898b8', win: '#28405c' }, { base: '#788898', win: '#203448' }, // downtown glass
    { base: '#687888', win: '#182a3c' }, { base: '#98a8c0', win: '#2a3e58' },
    { base: '#d8b890', win: '#5a7088' }, { base: '#b8c8d0', win: '#31465e' },
    { base: '#caa27c', win: '#4c6880' }, { base: '#e5cdb0', win: '#587090' },
    { base: '#a8b8a8', win: '#3c5670' },
  ];
  for (let t = 0; t < 15; t++) {
    const x0 = (t % 4) * T, y0 = Math.floor(t / 4) * T;
    ctx.fillStyle = night ? '#0a0c14' : pal[t].base;
    ctx.fillRect(x0, y0, T, T);
    const cols = 4 + (t % 3), rows = 5 + (t % 4);
    const ww = T / cols, wh = T / rows;
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
      const lit = Math.random() < 0.42;
      if (night) ctx.fillStyle = lit ? (Math.random() < 0.8 ? '#ffd98a' : '#a8d8ff') : '#05060a';
      else ctx.fillStyle = pal[t].win;
      ctx.fillRect(x0 + cx * ww + ww * 0.22, y0 + cy * wh + wh * 0.25, ww * 0.56, wh * 0.5);
      if (!night) { // sill highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x0 + cx * ww + ww * 0.22, y0 + cy * wh + wh * 0.72, ww * 0.56, 3);
      }
    }
    if (!night) { // grime
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x0, y0 + T - 14, T, 14);
    }
  }
  // tile 15 = roof
  ctx.fillStyle = night ? '#07080c' : '#6e6a68';
  ctx.fillRect(3 * (S / 4), 3 * (S / 4), T, T);
}

function paintSign(ctx, w, h, name, color, icon) {
  ctx.fillStyle = '#120a20'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color; ctx.lineWidth = 7;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.fillStyle = color;
  ctx.font = `900 ${h * 0.42}px Impact, Arial Black, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.fillText(`${icon}  ${name}`, w / 2, h / 2 + 2);
}

function paintGraffiti(ctx, w, h) {
  ctx.fillStyle = '#8a8078'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 30; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 30, 8);
  const colors = ['#ff4fa0', '#5ce0ff', '#ffd75c', '#8aff5c', '#ff6b3c', '#c98aff'];
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = colors[(Math.random() * colors.length) | 0];
    ctx.lineWidth = 8 + Math.random() * 14; ctx.lineCap = 'round';
    ctx.beginPath();
    let x = Math.random() * w, y = Math.random() * h;
    ctx.moveTo(x, y);
    for (let s = 0; s < 3; s++) ctx.bezierCurveTo(x + (Math.random() - .5) * 200, y + (Math.random() - .5) * 160, x + (Math.random() - .5) * 200, y + (Math.random() - .5) * 160, x += (Math.random() - .5) * 260, y += (Math.random() - .5) * 120);
    ctx.stroke();
  }
  for (const [txt, x, y, c, size] of [['VENICE', w * 0.25, h * 0.45, '#ffd75c', 110], ['SNAPS', w * 0.7, h * 0.6, '#5ce0ff', 90], ['drip', w * 0.55, h * 0.25, '#ff4fa0', 70]]) {
    ctx.font = `900 ${size}px Impact, Arial Black`; ctx.textAlign = 'center';
    ctx.strokeStyle = '#111'; ctx.lineWidth = 12; ctx.strokeText(txt, x, y);
    ctx.fillStyle = c; ctx.fillText(txt, x, y);
  }
}

// ============================================================================
export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];      // {min,max, grind, wall}
    this.rails = [];          // {a,b,dir,len}
    this.zones = [];          // interaction points
    this.shops = {};
    this.inspirations = [];
    this.cashes = [];
    this.nightMats = [];      // {mat, day, night} emissiveIntensity animation
    this.glowSprites = [];
    this.updaters = [];
    this.bldgs = [];          // building footprints (for roof rails & light strings)
    this.propBatch = new Batcher();

    this._buildLights();
    this._buildSky();
    this._buildGround();
    this._buildOcean();
    this._buildBuildings();
    this._buildBoardwalkShops();
    this._buildPier();
    this._buildSkatepark();
    this._buildPartyHouse();
    this._buildStreetProps();
    this._buildPalms();
    this._buildVeniceSign();
    this._buildGraffitiAlley();
    this._buildLifeguardTower();
    this._buildAccessRails();
    this._buildCityRails();
    this._buildRoofRails();
    this._buildStringLights();
    this._buildInspirations();
    this._buildCash();

    const propMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const props = this.propBatch.build(propMat);
    if (props) scene.add(props);

    this._buildRailGrid();
    this.setTime(14);
  }

  // ------------------------------------------------------------ collision api
  addCollider(cx, cy, cz, w, h, d, { grind = true, wall = true } = {}) {
    const c = {
      min: new THREE.Vector3(cx - w / 2, cy, cz - d / 2),
      max: new THREE.Vector3(cx + w / 2, cy + h, cz + d / 2),
      grind, wall,
    };
    this.colliders.push(c);
    if (grind && h >= 0.25) {
      const y = c.max.y, { min, max } = c;
      const edges = [
        [min.x, y, min.z, max.x, y, min.z], [min.x, y, max.z, max.x, y, max.z],
        [min.x, y, min.z, min.x, y, max.z], [max.x, y, min.z, max.x, y, max.z],
      ];
      for (const [ax, ay, az, bx, by, bz] of edges) {
        if (Math.hypot(bx - ax, bz - az) >= 1.2) this.addRail(ax, ay, az, bx, by, bz);
      }
    }
    return c;
  }
  addRail(ax, ay, az, bx, by, bz) {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
    const dir = b.clone().sub(a); const len = dir.length(); dir.normalize();
    const r = { a, b, dir, len, next: null, prev: null };
    this.rails.push(r);
    return r;
  }

  // A polyline/curve of linked rail segments — grinds chain through the joints,
  // which is what makes curved rails (and sagging light strings) skateable.
  addRailPath(points, { mesh = true, radius = 0.07, color = 0xe8b03c, emissive = 0x9a6600 } = {}) {
    let prev = null;
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i], q = points[i + 1];
      const r = this.addRail(p.x, p.y, p.z, q.x, q.y, q.z);
      if (prev) { prev.next = r; r.prev = prev; }
      prev = r;
    }
    if (mesh) {
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(12, points.length * 3), radius, 6, false),
        new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: 0.3 })
      );
      tube.castShadow = true;
      this.scene.add(tube);
    }
  }
  _buildRailGrid() {
    this.railGrid = new Map();
    const cell = 10;
    this.rails.forEach((r, i) => {
      const steps = Math.ceil(r.len / cell) + 1;
      for (let s = 0; s <= steps; s++) {
        const p = r.a.clone().lerp(r.b, s / steps);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const key = `${Math.floor(p.x / cell) + dx},${Math.floor(p.z / cell) + dz}`;
          let arr = this.railGrid.get(key);
          if (!arr) this.railGrid.set(key, arr = new Set());
          arr.add(i);
        }
      }
    });
  }
  railsNear(pos) {
    const key = `${Math.floor(pos.x / 10)},${Math.floor(pos.z / 10)}`;
    return this.railGrid.get(key);
  }

  // ------------------------------------------------------------ sky & light
  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5c, 0.9);
    this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.12);
    this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0xcfe8ff, 200, 800);
  }

  _buildSky() {
    this.skyU = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 },
      uTop: { value: new THREE.Color(0x3d8fd4) },
      uHorizon: { value: new THREE.Color(0xcfe8ff) },
      uSunCol: { value: new THREE.Color(0xfff3c0) },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(920, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: this.skyU,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uSunDir, uTop, uHorizon, uSunCol; uniform float uNight;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.99,78.23,45.16))) * 43758.55); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.6));
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunCol * (pow(sd, 500.0) * 2.2 + pow(sd, 8.0) * 0.35);
          vec3 cell = floor(d * 180.0);
          float sh = hash(cell);
          float star = step(0.9982, sh) * (0.5 + 0.5 * hash(cell + 7.0));
          col += vec3(star) * uNight * smoothstep(0.05, 0.25, d.y);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    this.scene.add(sky);
  }

  setTime(hour) { // 14 .. 26 (2pm -> 2am)
    this.hour = hour;
    const day = THREE.MathUtils.clamp(1 - (hour - 17.5) / 2.5, 0, 1);   // 1 until 17:30 -> 0 at 20:00
    const night = THREE.MathUtils.clamp((hour - 18.5) / 2.5, 0, 1);     // 0 until 18:30 -> 1 at 21:00
    const sunset = Math.max(0, 1 - Math.abs(hour - 18.7) / 1.9);
    this.night01 = night;

    // sun path: high at 14h, sets west (-x) ~19.5h
    const sa = THREE.MathUtils.mapLinear(Math.min(hour, 20), 14, 20, 1.15, -0.12);
    const sunDir = new THREE.Vector3(-Math.cos(sa), Math.sin(sa), 0.25).normalize();
    const moonDir = new THREE.Vector3(0.4, 0.7, -0.35).normalize();
    const lightDir = night > 0.85 ? moonDir : sunDir;
    this.sun.position.copy(lightDir).multiplyScalar(280);
    this.sun.intensity = 1.35 * day + 0.7 * sunset * (1 - night) + 0.34 * night;
    this.sun.color.setHSL(THREE.MathUtils.lerp(0.14, 0.05, sunset), THREE.MathUtils.lerp(0.25, 0.9, sunset), night > 0.85 ? 0.75 : 0.65);
    if (night > 0.85) this.sun.color.set(0x9ab0e8);

    const top = new THREE.Color(0x3d8fd4).lerp(new THREE.Color(0x2a2050), sunset * 0.6).lerp(new THREE.Color(0x070a1e), night);
    const hor = new THREE.Color(0xcfe8ff).lerp(new THREE.Color(0xff9a5c), sunset).lerp(new THREE.Color(0x141a38), night);
    this.skyU.uTop.value.copy(top);
    this.skyU.uHorizon.value.copy(hor);
    this.skyU.uSunDir.value.copy(sunDir);
    this.skyU.uNight.value = night;
    this.skyU.uSunCol.value.setHSL(0.09, 0.9, THREE.MathUtils.lerp(0.85, 0.55, sunset));

    this.scene.fog.color.copy(hor);
    this.scene.fog.near = THREE.MathUtils.lerp(200, 70, night);
    this.scene.fog.far = THREE.MathUtils.lerp(800, 480, night);

    this.hemi.color.copy(top).lerp(new THREE.Color(0xffffff), 0.4);
    this.hemi.groundColor.set(0x8a7a5c).lerp(new THREE.Color(0x1c1a2e), night);
    this.hemi.intensity = THREE.MathUtils.lerp(0.9, 0.52, night);

    for (const nm of this.nightMats) nm.mat.emissiveIntensity = THREE.MathUtils.lerp(nm.day, nm.night, night);
    for (const s of this.glowSprites) s.material.opacity = night * 0.85;
    if (this.oceanMat) this.oceanMat.color.copy(new THREE.Color(0x1273a0).lerp(new THREE.Color(0x0a1830), night));
  }

  // ------------------------------------------------------------ terrain
  _buildGround() {
    const tex = canvasTex(4096, 4096, (ctx) => paintGround(ctx, 4096));
    const g = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2, W2 * 2), new THREE.MeshLambertMaterial({ map: tex }));
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);
    // world borders (invisible)
    this.addCollider(0, 0, -W2 - 2, W2 * 2 + 8, 40, 4, { grind: false });
    this.addCollider(0, 0, W2 + 2, W2 * 2 + 8, 40, 4, { grind: false });
    this.addCollider(W2 + 2, 0, 0, 4, 40, W2 * 2 + 8, { grind: false });
    this.addCollider(-W2 - 20, 0, 0, 4, 40, W2 * 2 + 8, { grind: false }); // far ocean edge
    // (the ocean itself is open — falling in respawns you on the beach)
  }

  _buildOcean() {
    const geo = new THREE.PlaneGeometry(160, W2 * 2 + 200, 40, 110);
    this.oceanMat = new THREE.MeshPhongMaterial({ color: 0x1273a0, shininess: 140, specular: 0x88bbdd });
    this.oceanT = { value: 0 };
    this.oceanMat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.oceanT;
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        transformed.z += sin(position.x * 0.14 + uT * 1.4) * 0.16 + cos(position.y * 0.09 + uT * 0.9) * 0.14;
        transformed.z += sin((position.x + position.y) * 0.045 + uT * 0.6) * 0.2;
      `);
    };
    const sea = new THREE.Mesh(geo, this.oceanMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(-95 - 80, 0.55, 0);
    this.scene.add(sea);
    this.updaters.push((dt) => { this.oceanT.value += dt; });
  }

  // ------------------------------------------------------------ city blocks
  _buildBuildings() {
    const atlas = canvasTex(2048, 2048, (ctx) => paintFacadeAtlas(ctx, 2048, false));
    const nightAtlas = canvasTex(2048, 2048, (ctx) => paintFacadeAtlas(ctx, 2048, true), { srgb: false });
    const geos = [];
    const rng = (a, b) => a + Math.random() * (b - a);

    const lots = [];
    const xs = [[16, 74], [86, 144], [156, 244]];
    const zs = [[-244, -186], [-174, -126], [-114, -66], [-54, -6], [6, 54], [66, 114], [126, 174], [186, 244]];
    for (const [x0, x1] of xs) for (const [z0, z1] of zs) {
      // split each block into 4 lots
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      lots.push([x0, z0, mx, mz], [mx, z0, x1, mz], [x0, mz, mx, z1], [mx, mz, x1, z1]);
    }
    for (const [x0, z0, x1, z1] of lots) {
      if (Math.random() < 0.16) continue;                    // empty lot / park
      const cx = (x0 + x1) / 2 + rng(-2, 2), cz = (z0 + z1) / 2 + rng(-2, 2);
      // keep party yard clear
      if (cx > 170 && cz > 185) continue;
      const downtown = cz < -90;
      const w = Math.min(x1 - x0 - 7, rng(12, 24)), d = Math.min(z1 - z0 - 7, rng(12, 24));
      const h = downtown ? rng(14, 40) : rng(4.5, 10);
      const tile = downtown ? 6 + ((Math.random() * 6) | 0) : (Math.random() * 6) | 0;
      const geo = atlasBoxUV(new THREE.BoxGeometry(w, h, d), tile, 15);
      geo.applyMatrix4(new THREE.Matrix4().setPosition(cx, h / 2, cz));
      geos.push(geo);
      this.addCollider(cx, 0, cz, w, h, d);
      this.bldgs.push({ cx, cz, w, h, d });
    }
    const mat = new THREE.MeshLambertMaterial({ map: atlas, emissive: 0xffffee, emissiveMap: nightAtlas, emissiveIntensity: 0 });
    this.nightMats.push({ mat, day: 0, night: 1.15 });
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // ------------------------------------------------------------ shops
  _shopSign(name, color, icon, w = 10) {
    const tex = canvasTex(1024, 220, (ctx) => paintSign(ctx, 1024, 220, name, color, icon));
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 });
    this.nightMats.push({ mat, day: 0.12, night: 1.5 });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 220 / 1024), mat);
  }

  buildShop({ id, name, color, icon, z, x = -19, facing = -1, type }) {
    // facing -1 => door faces -x (west/boardwalk)
    const g = new THREE.Group();
    const W = 13, D = 12, H = 5.4;
    const front = x + facing * D / 2, back = x - facing * D / 2;
    const wallC = [0xf0e6d2, 0xe8d0b8, 0xd8e0d0, 0xf4dccc][(Math.random() * 4) | 0];
    const wm = new THREE.MeshLambertMaterial({ color: wallC });
    const box = (w, h, d, xx, yy, zz, m = wm) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(xx, yy, zz); b.castShadow = b.receiveShadow = true; g.add(b); return b;
    };
    // side walls + back + roof
    box(D, H, 0.4, x, H / 2, z - W / 2);
    box(D, H, 0.4, x, H / 2, z + W / 2);
    box(0.4, H, W, back, H / 2, z);
    box(D + 0.6, 0.4, W + 0.6, x, H + 0.1, z, new THREE.MeshLambertMaterial({ color: 0x8a8078 }));
    this.addCollider(x, 0, z - W / 2, D, H, 0.4);
    this.addCollider(x, 0, z + W / 2, D, H, 0.4);
    this.addCollider(back, 0, z, 0.4, H, W, { grind: false });
    // front wall with door gap (door 3 wide centered)
    const sideW = (W - 3.2) / 2;
    box(0.4, H, sideW, front, H / 2, z - W / 2 + sideW / 2);
    box(0.4, H, sideW, front, H / 2, z + W / 2 - sideW / 2);
    box(0.4, H - 2.9, 3.2, front, 2.9 + (H - 2.9) / 2, z); // header
    this.addCollider(front, 0, z - W / 2 + sideW / 2, 0.5, H, sideW, { grind: false });
    this.addCollider(front, 0, z + W / 2 - sideW / 2, 0.5, H, sideW, { grind: false });
    // roof parapet edge is auto-grindable via side wall colliders

    // door frame (so the entrance reads from the boardwalk)
    const frameM = new THREE.MeshLambertMaterial({ color });
    box(0.55, 3, 0.35, front, 1.45, z - 1.75, frameM);
    box(0.55, 3, 0.35, front, 1.45, z + 1.75, frameM);
    box(0.55, 0.35, 3.85, front, 3.05, z, frameM);
    // dark interior shadow plane behind the doorway
    const dk = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.85), new THREE.MeshBasicMaterial({ color: 0x14100c }));
    dk.position.set(front - facing * 0.5, 1.45, z);
    dk.rotation.y = facing < 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(dk);
    // awning
    const aw = box(1.8, 0.12, W * 0.8, front + facing * 1, 3.1, z, new THREE.MeshLambertMaterial({ color }));
    aw.rotation.z = facing * 0.25;
    // sign
    const sign = this._shopSign(name, `#${new THREE.Color(color).getHexString()}`, icon, 10);
    sign.position.set(front + facing * 0.35, 4.4, z);
    sign.rotation.y = facing * Math.PI / 2;
    g.add(sign);
    // interior: floor, counter, shelf, keeper
    const floorM = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.5, W - 0.5), new THREE.MeshLambertMaterial({ color: 0xd8cbb0 }));
    floorM.rotation.x = -Math.PI / 2; floorM.position.set(x, 0.03, z); floorM.receiveShadow = true; g.add(floorM);
    const counter = box(1.4, 1.1, 6, back + facing * 2.6, 0.55, z, new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
    this.addCollider(back + facing * 2.6, 0, z, 1.4, 1.1, 6);
    const shelf = box(0.6, 3, W - 2, back + facing * 0.6, 1.5, z, new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
    // themed props on shelf
    const themeC = { coffee: [0xc9803a, 0xf5f0e6], vape: [0xc95cff, 0x5ce0ff], poke: [0x2ec4b6, 0xff6b5c], ice: [0xffb8d8, 0xfff3e0], kombucha: [0xd9a04a, 0x8aff5c], clothing: [0xff4fa0, 0x5ce0ff] }[type] || [0xffffff, 0xcccccc];
    for (let i = 0; i < 8; i++) {
      const p = box(0.35, 0.4 + Math.random() * 0.3, 0.35, back + facing * 0.7, 2 + (i % 2) * 0.9, z - W / 2 + 2 + i * (W - 4) / 8, new THREE.MeshLambertMaterial({ color: themeC[i % 2] }));
    }
    // ceiling light strip (interior visible at night)
    const lamp = box(0.2, 0.06, W - 4, x, H - 0.4, z, new THREE.MeshLambertMaterial({ color: 0xfff8e0, emissive: 0xfff0c0, emissiveIntensity: 0.4 }));
    this.nightMats.push({ mat: lamp.material, day: 0.4, night: 2.2 });

    const keeper = makeShopkeeper(color);
    keeper.group.position.set(back + facing * 1.6, 0, z);
    keeper.group.rotation.y = facing < 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(keeper.group);

    this.scene.add(g);
    const doorPos = new THREE.Vector3(front + facing * 2.2, 0, z);
    const shop = { id, name, type, color, icon, door: doorPos, keeper, counterPos: new THREE.Vector3(back + facing * 2.6, 0, z), interiorPos: new THREE.Vector3(x + facing * 1, 0, z), facing, z, x };
    this.shops[id] = shop;
    this.zones.push({ id, kind: type === 'clothing' ? 'clothing' : 'shop', pos: doorPos, radius: 2.6, label: name });
    return shop;
  }

  _buildBoardwalkShops() {
    this.buildShop({ id: 'coffee', name: "LALA'S LATTE", color: 0xc9803a, icon: '☕', z: -30, type: 'coffee' });
    this.buildShop({ id: 'vape', name: 'CLOUD TEMPLE', color: 0xc95cff, icon: '☁', z: 10, type: 'vape' });
    this.buildShop({ id: 'poke', name: 'POKE PARADISE', color: 0x2ec4b6, icon: '🐟', z: 40, type: 'poke' });
    this.buildShop({ id: 'ice', name: 'SCOOP DREAMS', color: 0xff8ad1, icon: '🍦', z: 70, type: 'ice' });
    this.buildShop({ id: 'kombucha', name: 'BOOCH BARN', color: 0xd9a04a, icon: '🍹', z: 120, type: 'kombucha' });
    this.buildShop({ id: 'drip1', name: 'DRIP SANCTUARY', color: 0xff4fa0, icon: '👑', z: -70, type: 'clothing' });
    this.buildShop({ id: 'drip2', name: 'THREAD WIZARD', color: 0x5ce0ff, icon: '🧥', z: -105, type: 'clothing' });
    this.buildShop({ id: 'drip3', name: 'FIT CHECK', color: 0x8aff5c, icon: '🧢', z: 155, type: 'clothing' });
  }

  // ------------------------------------------------------------ pier + ferris wheel
  _buildPier() {
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x9a7448 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(120, 2.6, 16), deckMat);
    deck.position.set(-105, 1.3, -160);
    deck.castShadow = deck.receiveShadow = true;
    this.scene.add(deck);
    this.addCollider(-105, 0, -160, 120, 2.6, 16);
    // wider end platform
    const end = new THREE.Mesh(new THREE.BoxGeometry(26, 2.6, 26), deckMat);
    end.position.set(-155, 1.3, -160); end.castShadow = end.receiveShadow = true;
    this.scene.add(end);
    this.addCollider(-155, 0, -160, 26, 2.6, 26);
    // access ramp — shallow steps you can roll straight up
    for (let i = 0; i < 8; i++) {
      const h = 0.325 * (i + 1);
      const st = new THREE.Mesh(new THREE.BoxGeometry(2, h, 12), deckMat);
      st.position.set(-33 - i * 2, h / 2, -160);
      st.castShadow = st.receiveShadow = true;
      this.scene.add(st);
      this.addCollider(st.position.x, 0, -160, 2, h, 12, { grind: false });
    }
    // railings — long grindable rails over the ocean
    const railMat = new THREE.MeshLambertMaterial({ color: 0x3a6ea5 });
    for (const zz of [-167.5, -152.5]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 118, 6), railMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(-105, 3.7, zz); bar.castShadow = true;
      this.scene.add(bar);
      this.addRail(-46, 3.7, zz, -164, 3.7, zz);
      for (let x = -46; x > -164; x -= 6) this.propBatch.cyl(0.04, 0.04, 1.1, 0x3a6ea5, x, 3.15, zz);
    }
    // lamp posts on pier
    for (let x = -55; x > -150; x -= 18) this._lamp(x, -166.6, 2.6);

    // ---- FERRIS WHEEL ----
    const fw = new THREE.Group();
    fw.position.set(-155, 12.5, -160);
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.22, 8, 40), new THREE.MeshLambertMaterial({ color: 0xe84a6a }));
    wheel.add(rim);
    const spokeM = new THREE.MeshLambertMaterial({ color: 0xd8d8e0 });
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 17, 6), spokeM);
      sp.rotation.z = (i / 8) * Math.PI;
      wheel.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 10), new THREE.MeshLambertMaterial({ color: 0xffd75c }));
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    // bulbs
    const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff0c0, emissive: 0xffd98a, emissiveIntensity: 0.1 });
    this.nightMats.push({ mat: bulbMat, day: 0.1, night: 2.6 });
    for (let i = 0; i < 20; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), bulbMat);
      const a = (i / 20) * Math.PI * 2;
      b.position.set(Math.cos(a) * 8.5, Math.sin(a) * 8.5, 0);
      wheel.add(b);
    }
    // gondolas
    const gonCols = [0xff6b5c, 0x5ce0ff, 0xffd75c, 0x8aff5c, 0xff8ad1, 0xc98aff];
    this.gondolas = [];
    for (let i = 0; i < 6; i++) {
      const gm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1), new THREE.MeshLambertMaterial({ color: gonCols[i] }));
      gm.castShadow = true;
      wheel.add(gm);
      this.gondolas.push({ mesh: gm, angle: (i / 6) * Math.PI * 2 });
    }
    fw.add(wheel);
    this.wheel = wheel;
    // A-frame legs
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 13.5, 8), spokeM);
      leg.position.set(s * 3.4, -6.2, 0); leg.rotation.z = s * 0.26; leg.castShadow = true;
      fw.add(leg);
    }
    this.scene.add(fw);
    this.addCollider(-155, 2.6, -160, 7, 2.2, 2.5, { grind: true }); // base housing
    this.updaters.push((dt) => {
      this.wheel.rotation.z += dt * 0.12;
      for (const g of this.gondolas) {
        const a = g.angle + this.wheel.rotation.z;
        g.mesh.position.set(Math.cos(g.angle) * 8.5, Math.sin(g.angle) * 8.5, 0);
        g.mesh.rotation.z = -this.wheel.rotation.z; // stay upright
        g.mesh.position.y -= 0.8;
      }
    });
    // SANTA MONICA arch sign at pier entrance
    const archTex = canvasTex(1024, 200, (ctx) => {
      ctx.fillStyle = '#10306a'; ctx.beginPath(); ctx.roundRect(0, 0, 1024, 200, 40); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 92px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SANTA MONICA', 512, 74);
      ctx.font = '700 52px Georgia, serif'; ctx.fillStyle = '#ffd75c';
      ctx.fillText('· YACHT HARBOR · SPORT FISHING ·', 512, 152);
    });
    const archMat = new THREE.MeshLambertMaterial({ map: archTex, emissive: 0xffffff, emissiveMap: archTex, emissiveIntensity: 0.1, side: THREE.DoubleSide });
    this.nightMats.push({ mat: archMat, day: 0.1, night: 1.2 });
    const arch = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.1), archMat);
    arch.position.set(-38, 7.5, -160); arch.rotation.y = Math.PI / 2;
    this.scene.add(arch);
    for (const s of [-1, 1]) {
      this.propBatch.cyl(0.25, 0.3, 7.5, 0x10306a, -38, 3.75, -160 + s * 7.6);
      this.addCollider(-38, 0, -160 + s * 7.6, 0.6, 7.5, 0.6);
    }
  }

  // ------------------------------------------------------------ skatepark
  _buildSkatepark() {
    const cM = new THREE.MeshLambertMaterial({ color: 0xc2c6ca });
    const add = (w, h, d, x, z, color = 0xc2c6ca) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color === 0xc2c6ca ? cM : new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      this.addCollider(x, 0, z, w, h, d);
    };
    add(6, 1.1, 3, -82, 66);            // funbox
    add(8, 0.7, 2.4, -60, 74);          // ledge
    add(5, 1.4, 5, -70, 90);            // big block
    add(3, 0.5, 8, -85, 100);           // low ledge
    add(6, 1.0, 3, -58, 104);           // funbox 2
    // pyramid (stepped)
    for (let i = 0; i < 3; i++) add(8 - i * 2.4, 0.45 * (i + 1), 8 - i * 2.4, -72, 60, 0xb8bcc0);
    // flat rails
    const railM = new THREE.MeshLambertMaterial({ color: 0xe8b03c });
    const flatRail = (x, z, len, rotY = 0) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 8), railM);
      r.rotation.z = Math.PI / 2; r.rotation.y = rotY;
      r.position.set(x, 0.55, z); r.castShadow = true;
      this.scene.add(r);
      const dx = Math.cos(rotY) * len / 2, dz = -Math.sin(rotY) * len / 2;
      this.addRail(x - dx, 0.55, z - dz, x + dx, 0.55, z + dz);
      for (const s of [-0.7, 0.7]) this.propBatch.cyl(0.05, 0.05, 0.55, 0x888888, x + Math.cos(rotY) * len * s / 2, 0.27, z - Math.sin(rotY) * len * s / 2);
    };
    flatRail(-75, 78, 8);
    flatRail(-64, 92, 9, Math.PI / 4);
    flatRail(-80, 108, 10, -0.2);
  }

  // ------------------------------------------------------------ party house
  _buildPartyHouse() {
    const g = new THREE.Group();
    // house
    const hm = new THREE.MeshLambertMaterial({ color: 0xf0dfc0 });
    const house = new THREE.Mesh(new THREE.BoxGeometry(16, 6.5, 9), hm);
    house.position.set(206, 3.25, 205); house.castShadow = house.receiveShadow = true;
    g.add(house);
    this.addCollider(206, 0, 205, 16, 6.5, 9);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 0.5, 10), new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
    roof.position.set(206, 6.7, 205); g.add(roof);
    // yard fence (wood) — with gate gap on west side
    const fm = new THREE.MeshLambertMaterial({ color: 0x9a7448 });
    const fence = (x, z, w, d) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, 1.9, d), fm);
      f.position.set(x, 0.95, z); f.castShadow = true; g.add(f);
      this.addCollider(x, 0, z, w, 1.9, d);
    };
    // yard: x[188,226] z[210,238]
    fence(207, 238, 38, 0.3);            // south
    fence(226, 224, 0.3, 28);            // east
    fence(188, 231, 0.3, 14.5);          // west (south part)
    fence(188, 214.5, 0.3, 9);           // west (north part) — gap 219..224 = GATE
    fence(197.5, 210, 19, 0.3);          // north partial (house covers rest)
    // stage
    const stage = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
    stage.position.set(220, 0.3, 232); stage.castShadow = stage.receiveShadow = true;
    g.add(stage);
    this.addCollider(220, 0, 232, 7, 0.6, 5);
    // mic stand
    const micM = new THREE.MeshLambertMaterial({ color: 0x222228 });
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.5, 6), micM);
    mic.position.set(219.5, 1.35, 231.5); g.add(mic);
    const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), micM);
    micHead.position.set(219.5, 2.12, 231.5); g.add(micHead);
    // speakers
    for (const z of [229.4, 234.6]) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(1, 1.7, 1), new THREE.MeshLambertMaterial({ color: 0x16161c }));
      sp.position.set(222.4, 1.45, z); sp.castShadow = true; g.add(sp);
    }
    // string lights across the yard
    const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff0c0, emissive: 0xffd98a, emissiveIntensity: 0.15 });
    this.nightMats.push({ mat: bulbMat, day: 0.15, night: 3.2 });
    const bulbGeo = new THREE.SphereGeometry(0.09, 6, 5);
    for (let line = 0; line < 4; line++) {
      const z0 = 214 + line * 6;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = 189 + t * 36;
        const y = 4.4 - Math.sin(t * Math.PI) * 0 + Math.sin(Math.PI * t) * -0.9 + 4.4 * 0; // catenary dip
        const b = new THREE.Mesh(bulbGeo, bulbMat);
        b.position.set(x, 4.6 - Math.sin(Math.PI * t) * 0.9, z0 + Math.sin(i * 2.7) * 0.3);
        g.add(b);
      }
    }
    // party lights (off till finale)
    this.partyLight = new THREE.PointLight(0xffc98a, 0, 55, 1.6);
    this.partyLight.position.set(207, 6, 224);
    g.add(this.partyLight);
    this.stageLight = new THREE.PointLight(0xffe0b0, 0, 30, 1.6);
    this.stageLight.position.set(218, 5, 229);
    g.add(this.stageLight);
    this.scene.add(g);

    this.partyYard = {
      gate: new THREE.Vector3(187.5, 0, 221.5),
      stage: new THREE.Vector3(220, 0.6, 232),
      mic: new THREE.Vector3(219.5, 0.6, 231.2),
      center: new THREE.Vector3(208, 0, 226),
    };
    this.zones.push({ id: 'party', kind: 'party', pos: this.partyYard.gate, radius: 3.2, label: "THE PARTY — Dev's backyard" });
  }

  // ------------------------------------------------------------ street furniture
  _lamp(x, z, baseY = 0) {
    this.propBatch.cyl(0.07, 0.1, 5.2, 0x2a2e34, x, baseY + 2.6, z);
    this.propBatch.cyl(0.05, 0.05, 1.1, 0x2a2e34, x, baseY + 5.2, z, { z: Math.PI / 2 });
    if (!this.lampHeadMat) {
      this.lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xfff2cc, emissive: 0xffdf9e, emissiveIntensity: 0.05 });
      this.nightMats.push({ mat: this.lampHeadMat, day: 0.05, night: 2.4 });
      this.lampHeads = [];
      const geo = new THREE.SphereGeometry(0.22, 8, 6);
      this.lampGeo = geo;
      // glow sprite texture
      const gtex = canvasTex(128, 128, (ctx) => {
        const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
        g.addColorStop(0, 'rgba(255,220,150,0.85)'); g.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
      }, { srgb: false });
      this.glowTex = gtex;
    }
    const head = new THREE.Mesh(this.lampGeo, this.lampHeadMat);
    head.position.set(x + 0.5, baseY + 5.25, z);
    this.scene.add(head);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    spr.scale.set(4, 4, 1);
    spr.position.copy(head.position);
    this.scene.add(spr);
    this.glowSprites.push(spr);
  }

  _buildStreetProps() {
    // boardwalk lamps + benches
    for (let z = -220; z <= 220; z += 34) { this._lamp(-27, z); this._lamp(-43, z + 17); }
    for (let z = -200; z <= 220; z += 42) {
      // bench facing ocean
      this.propBatch.box(0.5, 0.1, 2.6, 0x8a6a42, -41, 0.55, z).box(0.12, 0.55, 2.6, 0x8a6a42, -40.8, 0.85, z);
      for (const s of [-1, 1]) this.propBatch.box(0.5, 0.5, 0.15, 0x4a4a52, -41, 0.27, z + s * 1.1);
      this.addRail(-41.25, 0.62, z - 1.3, -41.25, 0.62, z + 1.3);
      // trash can
      this.propBatch.cyl(0.35, 0.3, 0.9, 0x3c5e46, -29, 0.45, z + 14);
    }
    // street lamps along avenues
    for (const cx of [10, 80, 150]) for (let z = -210; z <= 210; z += 45) { this._lamp(cx - 7.5, z); this._lamp(cx + 7.5, z + 22); }
    // planters on the green strip — grindable
    for (let z = -160; z <= 200; z += 55) {
      this.propBatch.box(3.4, 0.62, 1.4, 0xb0a894, -8.5, 0.31, z);
      this.addCollider(-8.5, 0, z, 3.4, 0.62, 1.4);
      this.propBatch.box(3, 0.7, 1, 0x4e7a3a, -8.5, 0.95, z); // bush
    }
    // parked cars — grind the roofs
    const carCols = [0xc94040, 0x4079c9, 0xd8d8d8, 0x36384a, 0xe8a03c, 0x3ca86a, 0x8a5ac9];
    const car = (x, z, rotY) => {
      const c = carCols[(Math.random() * carCols.length) | 0];
      this.propBatch.box(1.9, 0.55, 4.3, c, x, 0.55, z, { y: rotY });
      this.propBatch.box(1.7, 0.5, 2.2, c, x, 1.05, z, { y: rotY });
      const cs = Math.cos(rotY), sn = Math.sin(rotY);
      for (const [ox, oz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]])
        this.propBatch.cyl(0.3, 0.3, 0.22, 0x1a1a1e, x + ox * cs + oz * sn, 0.3, z - ox * sn + oz * cs, { z: Math.PI / 2, y: rotY });
      this.addCollider(x, 0, z, Math.abs(cs) * 2 + Math.abs(sn) * 4.4, 1.32, Math.abs(cs) * 4.4 + Math.abs(sn) * 2);
    };
    for (const cx of [10, 80, 150]) {
      for (let z = -195; z <= 215; z += 48 + Math.random() * 30) {
        if (Math.abs(z % 60) < 9) continue; // keep intersections clear
        car(cx + (Math.random() < 0.5 ? -4.6 : 4.6), z, 0);
      }
    }
    for (let x = 25; x <= 235; x += 52 + Math.random() * 26) car(x, (Math.random() < 0.5 ? -60 : 60) + (Math.random() < 0.5 ? -4.6 : 4.6), Math.PI / 2);

    // downtown promenade (x 86..144 around z -150): planters, stairs w/ handrails
    for (let x = 92; x <= 138; x += 16) {
      this.propBatch.box(2.6, 0.62, 2.6, 0xb0a894, x, 0.31, -150);
      this.addCollider(x, 0, -150, 2.6, 0.62, 2.6);
      this.propBatch.cyl(0.14, 0.18, 2.6, 0x4a6a3a, x, 1.9, -150);
      this.propBatch.add(new THREE.SphereGeometry(1.1, 8, 6), 0x4e8a3c, x, 3.4, -150);
    }
    // stair set with handrails (classic skate spot)
    for (let i = 0; i < 3; i++) {
      this.propBatch.box(6, 0.25 * (i + 1), 1.2, 0xa8a8ac, 115, 0.125 * (i + 1), -132 - i * 1.2);
      this.addCollider(115, 0, -132 - i * 1.2, 6, 0.25 * (i + 1), 1.2);
    }
    for (const s of [-1, 1]) {
      this.propBatch.cyl(0.05, 0.05, 4.6, 0xe8b03c, 115 + s * 2.8, 1.15, -133.8, { x: Math.PI / 2 - 0.18 });
      this.addRail(115 + s * 2.8, 1.5, -131.5, 115 + s * 2.8, 0.75, -136);
    }
    // hydrants
    for (const [x, z] of [[18, -54], [88, 8], [158, 68], [18, 128], [88, -114]])
      this.propBatch.cyl(0.14, 0.16, 0.55, 0xd23c3c, x, 0.28, z);
    // boardwalk curb — endless grind line along the sand edge
    this.propBatch.box(0.5, 0.28, 440, 0xd8cbb0, -45.2, 0.14, 0);
    this.addCollider(-45.2, 0, 0, 0.5, 0.28, 440);
  }

  _buildPalms() {
    // build one palm geometry then scatter merged copies
    const geos = [];
    const mkPalm = (x, z, s, lean) => {
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const g = new THREE.CylinderGeometry(0.13 * s * (1 - i * 0.09), 0.16 * s * (1 - i * 0.09), 1.5 * s, 6);
        setGeoColor(g, i % 2 ? 0x8a6a4a : 0x7a5c3e);
        const m = new THREE.Matrix4().makeRotationZ(lean * (i / segs));
        m.setPosition(x + lean * i * i * 0.12 * s, (i + 0.5) * 1.35 * s, z);
        g.applyMatrix4(m);
        delete g.attributes.uv;
        geos.push(g);
      }
      const topX = x + lean * segs * segs * 0.105 * s, topY = segs * 1.32 * s;
      for (let f = 0; f < 9; f++) {
        const a = (f / 9) * Math.PI * 2 + Math.random() * 0.4;
        const droop = 0.5 + Math.random() * 0.35;
        // frond: wide tapered blade
        const g = new THREE.CylinderGeometry(0.02, 0.42 * s, 2.9 * s, 3, 1);
        setGeoColor(g, f % 2 ? 0x4e8a3c : 0x3f7a30);
        const m = new THREE.Matrix4().makeRotationY(a);
        m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - droop));
        m.multiply(new THREE.Matrix4().makeScale(1, 1, 0.06)); // flatten
        m.setPosition(topX + Math.sin(a) * 1.2 * s, topY + 0.15, z + Math.cos(a) * 1.2 * s);
        g.applyMatrix4(m);
        delete g.attributes.uv;
        geos.push(g);
      }
      // coconuts lol
      const cg = new THREE.SphereGeometry(0.14 * s, 6, 5);
      setGeoColor(cg, 0x5a4028);
      cg.applyMatrix4(new THREE.Matrix4().setPosition(topX + 0.2, topY - 0.1, z + 0.15));
      delete cg.attributes.uv;
      geos.push(cg);
      this.addCollider(x, 0, z, 0.5, 6.5 * s, 0.5, { grind: false });
    };
    // green strip palms + beach palms
    for (let z = -230; z <= 230; z += 24) mkPalm(-10 + Math.sin(z) * 2, z + Math.random() * 6, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5);
    for (let z = -120; z <= 230; z += 38) mkPalm(-60 - Math.random() * 20, z, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.7);
    for (const [x, z] of [[196, 214], [224, 236], [190, 236]]) mkPalm(x, z, 1.1, 0.2);
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    this.scene.add(mesh);
  }

  _buildVeniceSign() {
    const tex = canvasTex(1024, 256, (ctx) => {
      ctx.clearRect(0, 0, 1024, 256);
      const letters = 'VENICE';
      for (let i = 0; i < letters.length; i++) {
        const x = 90 + i * 155;
        ctx.fillStyle = '#10214a';
        ctx.beginPath(); ctx.arc(x, 128, 72, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ffd75c'; ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '900 96px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(letters[i], x, 132);
      }
    });
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.15, side: THREE.DoubleSide });
    this.nightMats.push({ mat, day: 0.15, night: 1.6 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), mat);
    sign.position.set(10, 8.8, 92);
    this.scene.add(sign);
    for (const s of [-1, 1]) {
      this.propBatch.cyl(0.22, 0.28, 11.5, 0x2a4a3a, 10 + s * 11.5, 5.75, 92);
      this.addCollider(10 + s * 11.5, 0, 92, 0.6, 11.5, 0.6);
    }
    this.addRail(-0.5, 11.6, 92, 20.5, 11.6, 92); // grind THE sign
    // parked truck below for wall-jump access
    this.propBatch.box(2.4, 2.6, 6, 0xe8e0d0, 5, 1.3, 96, { y: 0 });
    this.addCollider(5, 0, 96, 2.4, 2.6, 6);
  }

  _buildGraffitiAlley() {
    const tex1 = canvasTex(1024, 512, (ctx) => paintGraffiti(ctx, 1024, 512));
    const tex2 = canvasTex(1024, 512, (ctx) => paintGraffiti(ctx, 1024, 512));
    // two facing walls in the block x[16,74] z[6,54]
    const wall = (tex, x, z, rotY, len = 26) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 7, 0.8), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(x, 3.5, z); m.rotation.y = rotY;
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      this.addCollider(x, 0, z, rotY ? 0.8 : len, 7, rotY ? len : 0.8);
    };
    wall(tex1, 45, 26, 0);
    wall(tex2, 45, 33, 0);
  }

  _buildLifeguardTower() {
    const g = new THREE.Group();
    const bodyM = new THREE.MeshLambertMaterial({ color: 0x5cc8e8 });
    const hut = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.4), bodyM);
    hut.position.set(-72, 4, -40); hut.castShadow = true;
    g.add(hut);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 4.2), new THREE.MeshLambertMaterial({ color: 0xf0e6d2 }));
    roof.position.set(-72, 5.5, -40); g.add(roof);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.8, 6), new THREE.MeshLambertMaterial({ color: 0x9a7448 }));
      leg.position.set(-72 + sx * 1.4, 1.4, -40 + sz * 1.4); leg.castShadow = true;
      g.add(leg);
    }
    // access ramp — shallow steps
    const stepM = new THREE.MeshLambertMaterial({ color: 0x9a7448 });
    for (let i = 0; i < 8; i++) {
      const h = 0.35 * (i + 1);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 1.4), stepM);
      st.position.set(-72 + 6 - i * 0.85, h / 2, -37);
      st.castShadow = true; g.add(st);
      this.addCollider(st.position.x, 0, -37, 0.9, h, 1.4, { grind: false });
    }
    this.scene.add(g);
    this.addCollider(-72, 2.7, -40, 3.6, 2.9, 3.6);
  }

  // golden grind rails that carry you up to the hard-to-reach inspiration
  _buildAccessRails() {
    const railM = new THREE.MeshLambertMaterial({ color: 0xe8b03c, emissive: 0x9a6600, emissiveIntensity: 0.3 });
    const up = new THREE.Vector3(0, 1, 0);
    const mk = (x1, y1, z1, x2, y2, z2) => {
      const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
      const dir = b.clone().sub(a); const len = dir.length(); dir.normalize();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), railM);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, dir);
      m.castShadow = true;
      this.scene.add(m);
      this.addRail(x1, y1, z1, x2, y2, z2);
      const posts = Math.max(1, Math.floor(len / 5));
      for (let i = 0; i <= posts; i++) {
        const p = a.clone().lerp(b, i / posts);
        this.propBatch.cyl(0.045, 0.055, Math.max(0.3, p.y), 0x8a8078, p.x, Math.max(0.3, p.y) / 2, p.z);
      }
    };
    mk(-88, 0.7, -54, -73.4, 6.0, -41.6);   // beach -> lifeguard tower roof
    mk(10, 0.7, 128, 10, 11.7, 92.6);       // Pacific Ave -> up and over the VENICE sign
    mk(-40, 0.7, -138, -52, 3.75, -152.5);  // boardwalk -> pier railing
  }

  // curved street rails: corner arcs, an S-curve, a bowl rim
  _buildCityRails() {
    const arc = (cx, cz, r, a0, a1, y = 0.7, n = 8) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (i / n);
        pts.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
      }
      this.addRailPath(pts);
      for (let i = 0; i <= n; i += 2) {
        const p = pts[i];
        this.propBatch.cyl(0.045, 0.055, y, 0x8a8078, p.x, y / 2, p.z);
      }
    };
    // quarter-circle corner rails at intersections
    arc(10 + 14, -60 + 14, 9, Math.PI, Math.PI * 1.5);
    arc(80 - 14, 0 - 14, 9, 0, Math.PI * 0.5);
    arc(150 + 14, 120 + 14, 9, Math.PI, Math.PI * 1.5);
    arc(80 + 14, -120 - 14, 9, Math.PI * 0.5, Math.PI);
    // long S-curve weaving down the green strip
    const sPts = [];
    for (let i = 0; i <= 16; i++) {
      const z = -34 + i * (74 / 16);
      sPts.push(new THREE.Vector3(-8.5 + Math.sin(i * 0.7) * 3.2, 0.7 + Math.sin(i * 1.3) * 0.15, z));
    }
    this.addRailPath(sPts);
    for (let i = 0; i <= 16; i += 3) this.propBatch.cyl(0.045, 0.055, 0.7, 0x8a8078, sPts[i].x, 0.35, sPts[i].z);
    // skatepark bowl-rim circle (3/4)
    arc(-70, 100, 6.5, 0.3, Math.PI * 1.8, 0.8, 12);
  }

  // sloped rails from the street up to real rooftops (buildings are random,
  // so these adapt to whatever got built)
  _buildRoofRails() {
    const candidates = this.bldgs.filter(b => b.h > 5 && b.h < 24).sort((a, b) => a.cx + a.cz * 7 - (b.cx + b.cz * 7));
    const picked = [];
    for (const b of candidates) {
      if (picked.length >= 8) break;
      if (picked.some(p => Math.hypot(p.cx - b.cx, p.cz - b.cz) < 60)) continue;
      // find an approach direction whose start point is clear of other buildings
      const run = b.h * 2.1 + 6;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      let ok = null;
      for (const [dx, dz] of dirs) {
        const sx = b.cx + dx * (Math.abs(dx) * b.w / 2 + run);
        const sz = b.cz + dz * (Math.abs(dz) * b.d / 2 + run);
        if (Math.abs(sx) > 244 || Math.abs(sz) > 244) continue;
        if (sx > 170 && sz > 185) continue; // party yard
        const mx = (sx + b.cx) / 2, mz = (sz + b.cz) / 2, my = b.h * 0.45;
        const hits = (px, pz, py) => this.bldgs.some(o => o !== b && py < o.h + 1 && px > o.cx - o.w / 2 - 2 && px < o.cx + o.w / 2 + 2 && pz > o.cz - o.d / 2 - 2 && pz < o.cz + o.d / 2 + 2);
        if (!hits(sx, sz, 1) && !hits(mx, mz, my)) { ok = { sx, sz, dx, dz }; break; }
      }
      if (!ok) continue;
      picked.push(b);
      // gentle curve: ground -> up the slope -> flatten just over the roof edge
      const ex = b.cx + ok.dx * (b.w / 2 - 1), ez = b.cz + ok.dz * (b.d / 2 - 1);
      const pts = [
        new THREE.Vector3(ok.sx, 0.7, ok.sz),
        new THREE.Vector3((ok.sx + ex) / 2, b.h * 0.45, (ok.sz + ez) / 2),
        new THREE.Vector3(ex + ok.dx * 2.5, b.h + 0.35, ez + ok.dz * 2.5),
        new THREE.Vector3(ex, b.h + 0.25, ez),
      ];
      this.addRailPath(pts);
      for (let i = 0; i < 3; i++) {
        const p = pts[0].clone().lerp(pts[2], (i + 1) / 4);
        this.propBatch.cyl(0.05, 0.06, p.y, 0x8a8078, p.x, p.y / 2, p.z);
      }
    }
  }

  // festoon lights strung roof-to-roof — and yes, you can grind them
  _buildStringLights() {
    const bulbGeos = [], cableGeos = [];
    const bulbGeo = new THREE.SphereGeometry(0.11, 6, 5);
    let made = 0;
    const used = new Set();
    for (let i = 0; i < this.bldgs.length && made < 14; i++) {
      const a = this.bldgs[i];
      if (a.h < 4) continue;
      for (let j = i + 1; j < this.bldgs.length && made < 14; j++) {
        const b = this.bldgs[j];
        if (b.h < 4 || used.has(i) || used.has(j)) continue;
        const dist = Math.hypot(a.cx - b.cx, a.cz - b.cz);
        if (dist < 16 || dist > 40 || Math.abs(a.h - b.h) > 7) continue;
        used.add(i); used.add(j);
        made++;
        const p0 = new THREE.Vector3(a.cx, a.h + 0.15, a.cz);
        const p1 = new THREE.Vector3(b.cx, b.h + 0.15, b.cz);
        // pull the anchors to the facing roof edges
        const d = p1.clone().sub(p0).setY(0).normalize();
        p0.add(d.clone().multiplyScalar(Math.min(a.w, a.d) / 2 - 0.5));
        p1.add(d.clone().multiplyScalar(-(Math.min(b.w, b.d) / 2 - 0.5)));
        const sag = Math.min(3, dist * 0.1);
        const n = Math.max(8, Math.round(dist / 2.2));
        const pts = [];
        for (let s = 0; s <= n; s++) {
          const t = s / n;
          const p = p0.clone().lerp(p1, t);
          p.y -= Math.sin(Math.PI * t) * sag;
          pts.push(p);
          if (s % 1 === 0) {
            const g = bulbGeo.clone();
            g.applyMatrix4(new THREE.Matrix4().setPosition(p.x, p.y - 0.16, p.z));
            bulbGeos.push(g);
          }
        }
        this.addRailPath(pts, { mesh: false });
        const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.035, 5, false);
        cableGeos.push(cable);
        break;
      }
    }
    if (cableGeos.length) {
      const cables = new THREE.Mesh(mergeGeometries(cableGeos, false), new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
      this.scene.add(cables);
    }
    if (bulbGeos.length) {
      const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff0c0, emissive: 0xffd98a, emissiveIntensity: 0.15 });
      this.nightMats.push({ mat: bulbMat, day: 0.15, night: 2.8 });
      const bulbs = new THREE.Mesh(mergeGeometries(bulbGeos, false), bulbMat);
      this.scene.add(bulbs);
    }
  }

  // ------------------------------------------------------------ collectibles
  _buildInspirations() {
    const defs = [
      { pos: [-70, 2.6, 92], caption: 'the skatepark hums like a beehive of small braveries' },
      { pos: [-149.5, 3.8, -160], caption: 'a ferris wheel is just a clock that learned to have fun' },
      { pos: [45, 4.8, 29.5], caption: 'between two graffiti walls, the air itself is signed' },
      { pos: [-72.6, 6.6, -40.8], caption: 'the lifeguard tower watches even when the water sleeps' },
      { pos: [10, 12.4, 92.4], caption: 'six letters hang over the street like a spell: V-E-N-I-C-E' },
      { pos: [115, 3.2, -150], caption: 'downtown, even the fountains are auditioning' },
    ];
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd75c, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < defs.length; i++) {
      const grp = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc94d, emissiveIntensity: 1.6 }));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 26, 8, 1, true), beamMat);
      beam.position.y = 8;
      grp.add(core, beam);
      grp.position.set(...defs[i].pos);
      this.scene.add(grp);
      this.inspirations.push({ id: `world_${i}`, pos: grp.position.clone(), mesh: grp, core, caption: defs[i].caption, taken: false });
    }
    this.updaters.push((dt, t) => {
      for (const ins of this.inspirations) {
        if (ins.taken) continue;
        ins.core.rotation.y += dt * 1.8;
        ins.core.position.y = Math.sin(t * 2 + ins.pos.x) * 0.18;
      }
    });
  }

  _buildCash() {
    const geo = new THREE.BoxGeometry(0.34, 0.1, 0.2);
    const matC = new THREE.MeshLambertMaterial({ color: 0x4ec96a, emissive: 0x1a7a30, emissiveIntensity: 0.5 });
    const spots = [
      [-38, -60], [-32, 30], [-40, 130], [-36, 190], [-60, -100], [20, -30], [40, 70], [70, -140],
      [95, 30], [120, -60], [140, 100], [170, 150], [60, 130], [30, -170], [130, -190], [180, -40],
      [-80, 80], [-50, -180], [100, 180], [160, 10],
    ];
    this.cashSpawns = [];
    for (const [x, z] of spots) {
      const m = new THREE.Mesh(geo, matC);
      m.position.set(x, 0.5, z);
      this.scene.add(m);
      this.cashes.push({ pos: m.position, mesh: m, taken: false, value: 5 + ((Math.random() * 3) | 0) * 5 });
    }
    this.updaters.push((dt, t) => {
      for (const c of this.cashes) if (!c.taken) { c.mesh.rotation.y += dt * 2.5; c.mesh.position.y = 0.5 + Math.sin(t * 3 + c.pos.x) * 0.08; }
    });
  }

  // random street position for fiend spawning
  randomSpawnPos(playerPos) {
    for (let tries = 0; tries < 20; tries++) {
      const zones = [
        () => new THREE.Vector3(-35 + Math.random() * 10, 0, -220 + Math.random() * 440),   // boardwalk
        () => new THREE.Vector3(-88 + Math.random() * 40, 0, -220 + Math.random() * 440),   // beach
        () => new THREE.Vector3([10, 80, 150][(Math.random() * 3) | 0] + (Math.random() - 0.5) * 10, 0, -220 + Math.random() * 440), // avenues
        () => new THREE.Vector3(-20 + Math.random() * 260, 0, [-180, -120, -60, 0, 60, 120, 180][(Math.random() * 7) | 0] + (Math.random() - 0.5) * 10), // streets
      ];
      const p = zones[(Math.random() * zones.length) | 0]();
      const d = p.distanceTo(playerPos);
      if (d < 28 || d > 95) continue;
      if (p.x > 180 && p.z > 195) continue; // party yard is sacred
      let inside = false;
      for (const c of this.colliders) {
        if (p.x > c.min.x - 0.5 && p.x < c.max.x + 0.5 && p.z > c.min.z - 0.5 && p.z < c.max.z + 0.5 && c.max.y > 1.5) { inside = true; break; }
      }
      if (!inside) return p;
    }
    return null;
  }

  update(dt, t) { for (const u of this.updaters) u(dt, t); }
}
