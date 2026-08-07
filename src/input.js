// Keyboard + mouse state with edge detection.
export class Input {
  constructor() {
    this.down = {};
    this.pressed = {};
    this.clicked = false;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down[e.code] = true;
      this.pressed[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.down[e.code] = false; });
    addEventListener('mousedown', (e) => { if (e.button === 0) this.clicked = true; });
    addEventListener('blur', () => { this.down = {}; });
  }
  key(c) { return !!this.down[c]; }
  hit(c) { return !!this.pressed[c]; }        // pressed this frame
  endFrame() { this.pressed = {}; this.clicked = false; }
}
