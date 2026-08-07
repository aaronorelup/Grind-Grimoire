// Cinematic engine: letterboxed shots with eased camera moves, typewriter
// subtitles synced to voice lines. SPACE advances a line, ESC skips the scene
// (running every remaining shot action so game state stays consistent).
import * as THREE from 'three';
import { LINES } from './dialogue.js';

const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export class Cinema {
  constructor(G) {
    this.G = G;
    this.active = false;
    this.cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.el = {
      cine: document.getElementById('cine'),
      dialogue: document.getElementById('dialogue'),
      speaker: document.getElementById('speaker'),
      dtext: document.getElementById('dtext'),
    };
    this._skipScene = false;
    this._advance = false;
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Space' || e.code === 'Enter') { this._advance = true; e.preventDefault(); }
      if (e.code === 'Escape') this._skipScene = true;
    });
    addEventListener('mousedown', () => { if (this.active) this._advance = true; });
  }

  /** shots: [{ pos:[..], look:[..], move, hold, line, text, speaker, action }] */
  async play(shots, { lockPlayer = true } = {}) {
    const G = this.G;
    this.active = true;
    this._skipScene = false;
    const prevState = G.state;
    G.state = 'cutscene';
    G.audio.duckMusic(true);
    this.el.cine.classList.remove('hidden');
    void this.el.cine.offsetWidth; // force reflow so the letterbox transition plays
    this.el.cine.classList.add('active');
    // start from the current camera
    this.cam.pos.copy(G.camera.position);
    this.cam.look.copy(G.camLook || G.player.pos);

    for (const shot of shots) {
      if (this._skipScene) { shot.action?.(G); continue; }
      shot.action?.(G);
      const from = this.cam.pos.clone(), fromL = this.cam.look.clone();
      const to = shot.pos ? new THREE.Vector3(...shot.pos) : from.clone();
      const toL = shot.look ? new THREE.Vector3(...shot.look) : fromL.clone();
      const move = shot.move ?? 2;

      // camera tween runs while dialogue plays
      const t0 = performance.now();
      let camDone = false;
      const tick = () => {
        if (this.active) {
          const k = move <= 0 ? 1 : Math.min(1, (performance.now() - t0) / (move * 1000));
          this.cam.pos.lerpVectors(from, to, ease(k));
          this.cam.look.lerpVectors(fromL, toL, ease(k));
          if (k < 1 && !this._skipScene) {
            if (document.hidden) setTimeout(tick, 50); else requestAnimationFrame(tick);
          } else { this.cam.pos.copy(to); this.cam.look.copy(toL); camDone = true; }
        }
      };
      tick();

      if (shot.line || shot.text) {
        const line = shot.line ? LINES[shot.line] : { speaker: shot.speaker || '', text: shot.text };
        await this.say(line, shot.line);
      } else {
        await this.wait((move + (shot.hold ?? 0.3)) * 1000);
      }
      if (shot.hold && (shot.line || shot.text)) await this.wait(shot.hold * 1000);
    }

    this.el.dialogue.classList.add('hidden');
    this.el.cine.classList.remove('active');
    await this.wait(650);
    this.el.cine.classList.add('hidden');
    G.audio.duckMusic(false);
    G.audio.stopVoice();
    this.active = false;
    G.state = prevState === 'cutscene' ? 'play' : prevState;
    G.input.endFrame();
  }

  say(line, lineId) {
    return new Promise((resolve) => {
      this._advance = false;
      this.el.dialogue.classList.remove('hidden');
      this.el.speaker.textContent = line.speaker;
      this.el.dtext.innerHTML = '<span class="caret">▍</span>';
      const chars = [...line.text];
      let typeDone = false, voiceDone = false, resolved = false;
      const t0 = performance.now();
      let skipTyping = false;

      const finish = () => {
        if (resolved) return;
        if (typeDone && voiceDone) { resolved = true; resolve(); }
      };

      const typeTimer = setInterval(() => {
        if (this._skipScene) skipTyping = true;
        else if (this._advance && !typeDone) { skipTyping = true; this._advance = false; }
        const i = skipTyping ? chars.length : Math.floor((performance.now() - t0) / 22);
        this.el.dtext.textContent = chars.slice(0, i).join('');
        if (i >= chars.length) {
          typeDone = true;
          clearInterval(typeTimer);
          finish();
        }
      }, 24);

      const voicePromise = lineId
        ? this.G.audio.voice(lineId, line.text.length)
        : this.G.audio.voice('__none__', line.text.length); // synthetic wait
      voicePromise.then(() => { voiceDone = true; finish(); });

      // allow skipping the voice via SPACE after text is done
      const poll = setInterval(() => {
        if (resolved || !this.active) { clearInterval(poll); if (!resolved) { resolved = true; resolve(); } return; }
        if (this._skipScene || (this._advance && typeDone)) {
          this._advance = false;
          this.G.audio.stopVoice();
          voiceDone = true; typeDone = true;
          clearInterval(poll);
          finish();
        }
      }, 60);
    });
  }

  wait(ms) {
    return new Promise((r) => {
      const t0 = performance.now();
      const poll = setInterval(() => {
        if (performance.now() - t0 >= ms || this._skipScene || this._advance) {
          this._advance = false;
          clearInterval(poll); r();
        }
      }, 40);
    });
  }
}
