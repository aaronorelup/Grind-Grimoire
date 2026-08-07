// GPU-friendly pooled particle system + expanding shock rings.
import * as THREE from 'three';

const MAX = 2200;

const VERT = `
attribute float size; attribute vec4 pcolor;
varying vec4 vColor;
void main(){ vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * (240.0 / -mv.z);
  gl_Position = projectionMatrix * mv; }`;
const FRAG = `
varying vec4 vColor;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.05, d) * vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a); }`;

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 4);
    this.sizes = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);   // remaining
    this.life0 = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.baseSize = new Float32Array(MAX);
    this.baseA = new Float32Array(MAX);
    this.head = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    this._c = new THREE.Color();
  }

  burst({ pos, count = 20, color = 0xffaa33, color2 = null, speed = 6, up = 2, size = 0.5, life = 0.7, gravity = -6, drag = 2, spread = 1, alpha = 1 }) {
    for (let n = 0; n < count; n++) {
      const i = this.head; this.head = (this.head + 1) % MAX;
      const th = Math.random() * Math.PI * 2, ph = (Math.random() - 0.5) * Math.PI * spread;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.pos[i * 3] = pos.x; this.pos[i * 3 + 1] = pos.y; this.pos[i * 3 + 2] = pos.z;
      this.vel[i * 3] = Math.cos(th) * Math.cos(ph) * sp;
      this.vel[i * 3 + 1] = Math.sin(ph) * sp + up;
      this.vel[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * sp;
      this._c.set(color2 && Math.random() < 0.5 ? color2 : color);
      const jitter = 0.8 + Math.random() * 0.35;
      this.col[i * 4] = this._c.r * jitter; this.col[i * 4 + 1] = this._c.g * jitter; this.col[i * 4 + 2] = this._c.b * jitter;
      this.baseA[i] = alpha; this.col[i * 4 + 3] = alpha;
      this.life0[i] = this.life[i] = life * (0.6 + Math.random() * 0.7);
      this.baseSize[i] = size * (0.6 + Math.random() * 0.8);
      this.grav[i] = gravity; this.drag[i] = drag;
    }
  }

  ring({ pos, color = 0xffcc66, maxR = 4, life = 0.45, y = 0.1 }) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, (pos.y ?? 0) + y, pos.z);
    m.userData = { t: 0, life, maxR };
    this.scene.add(m);
    this.rings.push(m);
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.sizes[i] = 0; continue; }
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.life0[i]);
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k + this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.03) { this.pos[i * 3 + 1] = 0.03; this.vel[i * 3 + 1] *= -0.3; }
      this.sizes[i] = this.baseSize[i] * (0.35 + f * 0.65);
      this.col[i * 4 + 3] = this.baseA[i] * f;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.pcolor.needsUpdate = true;
    g.attributes.size.needsUpdate = true;

    for (let r = this.rings.length - 1; r >= 0; r--) {
      const m = this.rings[r];
      m.userData.t += dt;
      const f = m.userData.t / m.userData.life;
      if (f >= 1) { this.scene.remove(m); m.material.dispose(); this.rings.splice(r, 1); continue; }
      const s = 0.15 + m.userData.maxR * f;
      m.scale.set(s, s, s);
      m.material.opacity = 0.9 * (1 - f);
    }
  }
}
