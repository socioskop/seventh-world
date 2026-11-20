export class Input {
  constructor() {
    this._down    = {};
    this._pressed = {};
    window.addEventListener('keydown', (e) => {
      if (!this._down[e.code]) this._pressed[e.code] = true;
      this._down[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this._down[e.code] = false; });
  }
  isDown(code)    { return !!this._down[code]; }
  isPressed(code) { return !!this._pressed[code]; }
  clearPressed()  { this._pressed = {}; }
}
