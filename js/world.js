export class World {
  constructor(canvasWidth, canvasHeight) {
    this.width        = 7000;
    this.canvasWidth  = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.groundY      = canvasHeight - 70;
    this.gravity      = 0.55;
    this.camera       = { x: 0, y: 0 };
    this._leadX       = canvasWidth / 3;
  }

  updateCamera(playerX) {
    const target = playerX - this._leadX;
    this.camera.x += (target - this.camera.x) * 0.12;
    this.camera.x = Math.max(0, Math.min(this.width - this.canvasWidth, this.camera.x));
  }

  toScreenX(worldX) { return worldX - this.camera.x; }
  toScreenY(worldY) { return worldY; }

  draw(ctx) {
    this._sky(ctx);
    this._mountains(ctx);
    this._rocks(ctx);
    this._ground(ctx);
  }

  _sky(ctx) {
    ctx.fillStyle = '#1A2E6E';
    ctx.fillRect(0, 0, this.canvasWidth, this.groundY);
    // stars
    ctx.fillStyle = '#AABBFF';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 131 + Math.floor(this.camera.x * 0.01) * i) % this.canvasWidth;
      const sy = 10 + (i * 43) % 120;
      ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
  }

  _mountains(ctx) {
    const par = 0.25, period = this.canvasWidth + 400;
    ctx.fillStyle = '#142060';
    for (let i = 0; i < 12; i++) {
      const sx = ((i * 680 - this.camera.x * par) % period + period) % period - 200;
      const h  = 130 + (i % 3) * 45;
      ctx.beginPath();
      ctx.moveTo(sx, this.groundY);
      ctx.lineTo(sx + 170, this.groundY - h);
      ctx.lineTo(sx + 340, this.groundY);
      ctx.fill();
    }
  }

  _rocks(ctx) {
    const par = 0.65, period = this.canvasWidth + 500;
    ctx.fillStyle = '#3D1A08';
    for (let i = 0; i < 10; i++) {
      const sx = ((i * 850 - this.camera.x * par) % period + period) % period - 150;
      ctx.fillRect(sx, this.groundY - 28, 130, 28);
      ctx.fillRect(sx + 30, this.groundY - 52, 70, 26);
    }
  }

  _ground(ctx) {
    ctx.fillStyle = '#5A2810';
    ctx.fillRect(0, this.groundY, this.canvasWidth, this.canvasHeight - this.groundY);
    ctx.fillStyle = '#3D1808';
    ctx.fillRect(0, this.groundY, this.canvasWidth, 7);
    ctx.fillStyle = '#4A2010';
    const period = this.canvasWidth + 100;
    for (let i = 0; i < 22; i++) {
      const sx = ((i * 95 - this.camera.x * 0.97) % period + period) % period;
      ctx.fillRect(sx, this.groundY + 14, 55, 3);
    }
  }
}
