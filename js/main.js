/**
 * main.js — entry point & game loop
 */

import { Input        } from './input.js';
import { World        } from './world.js';
import { Player       } from './player.js';
import { buildEnemyList } from './enemy.js';
import { drawBar, drawText, drawOrb, spawnParticles, tickParticles } from './renderer.js';

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = 800;
canvas.height = 450;

// ── Game objects ──────────────────────────────────────────────────────────────
const input   = new Input();
const world   = new World(canvas.width, canvas.height);
const player  = new Player(180, world.groundY - 64);
let enemies   = buildEnemyList(world.groundY);

let projectiles = [];
let particles   = [];
let floatTexts  = [];
let gameState   = 'playing';
let screenFlash = 0;
let prevSuper   = false;

// ── Player callbacks ──────────────────────────────────────────────────────────
player.onFire = (blast) => projectiles.push(blast);

player.onPunch = (facing, cx, cy) => {
  const reach = 88;
  enemies.forEach(e => {
    if (e.dead || !e.active) return;
    const edgeSrc = facing > 0 ? e.x     : e.x + e.w;
    const near    = facing > 0 ? edgeSrc > cx && edgeSrc < cx + reach
                               : edgeSrc < cx && edgeSrc > cx - reach;
    const vertOk  = Math.abs((e.y + e.h / 2) - cy) < 72;
    if (near && vertOk) {
      const dmg = player.punchDamage();
      e.takeDamage(dmg);
      player.score += dmg;
      spawnImpact(e.x + e.w / 2, e.y + e.h / 3, '#FF8800', dmg);
    }
  });
};

player.onDeath = () => { gameState = 'gameover'; };

// ── Helpers ───────────────────────────────────────────────────────────────────
function spawnImpact(wx, wy, col, dmg) {
  particles.push(...spawnParticles(wx, wy, col, 12));
  floatTexts.push({ x: wx, y: wy, vy: -1.8, text: `-${dmg}`, colour: col, life: 45, maxLife: 45 });
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── Update ────────────────────────────────────────────────────────────────────
function update() {
  if (gameState !== 'playing') { input.clearPressed(); return; }

  player.update(input, world);
  world.updateCamera(player.x);

  // Flash on Super Saiyan activation
  if (player.superSaiyan && !prevSuper) screenFlash = 10;
  prevSuper = player.superSaiyan;
  if (screenFlash > 0) screenFlash--;

  // Enemies
  enemies.forEach(e => {
    const blast = e.update(player, world);
    if (blast) projectiles.push(blast);
  });

  // Projectiles
  projectiles = projectiles.filter(b => {
    b.x   += b.vx;
    b.y   += b.vy;
    b.life--;
    if (b.life <= 0 || b.x < 0 || b.x > world.width) return false;

    if (!b.fromEnemy) {
      for (const e of enemies) {
        if (e.dead || !e.active) continue;
        if (overlap(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2,
                    e.x, e.y, e.w, e.h)) {
          e.takeDamage(b.damage);
          player.score += b.damage;
          spawnImpact(b.x, b.y, b.colour, b.damage);
          return false;
        }
      }
    } else {
      if (overlap(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2,
                  player.x, player.y, player.width, player.height)) {
        player.takeDamage(b.damage);
        spawnImpact(player.cx, player.cy, '#FF3333', b.damage);
        return false;
      }
    }
    return true;
  });

  tickParticles(ctx, particles, world.camera);
  floatTexts = floatTexts.filter(t => { t.y += t.vy; t.life--; return t.life > 0; });

  if (enemies.every(e => e.dead)) gameState = 'victory';

  input.clearPressed();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  world.draw(ctx);
  enemies.forEach(e => e.draw(ctx, world));

  projectiles.forEach(b => {
    drawOrb(ctx, world.toScreenX(b.x), b.y, b.radius, b.colour);
  });

  player.draw(ctx, world);

  // Float texts
  ctx.save();
  floatTexts.forEach(t => {
    ctx.globalAlpha = t.life / t.maxLife;
    drawText(ctx, t.text, world.toScreenX(t.x), t.y, {
      font: 'bold 15px sans-serif', colour: t.colour, align: 'center',
    });
  });
  ctx.restore();

  if (screenFlash > 0) {
    ctx.fillStyle = `rgba(255,230,50,${screenFlash / 12})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawHUD();

  if (gameState === 'gameover') drawOverlay('GAME OVER', '#FF3333', 'Press R to retry');
  if (gameState === 'victory')  drawOverlay('YOU WIN!',  '#FFD700', 'Press R to play again');
}

function drawHUD() {
  // HP bar
  drawBar(ctx, 12, 12, 185, 13, player.hp, player.maxHp, '#33CC44');
  drawText(ctx, 'HP', 16, 23, { font: 'bold 10px sans-serif', colour: '#FFF' });

  // Ki bar
  drawBar(ctx, 12, 30, 185, 10, player.ki, player.maxKi, '#00AAFF');
  drawText(ctx, 'KI', 16, 39, { font: 'bold 9px sans-serif', colour: '#AAD' });

  // Super Saiyan timer
  if (player.superSaiyan) {
    drawBar(ctx, 12, 45, 185, 5, player.superTimer, 720, '#FFD700', '#332200');
    drawText(ctx, '★ SUPER SAIYAN', 12, 60, { font: 'bold 11px sans-serif', colour: '#FFD700' });
  }

  // Score
  drawText(ctx, `Score: ${player.score}`, canvas.width - 10, 22, {
    font: 'bold 13px sans-serif', colour: '#FFFFFF', align: 'right',
  });

  // Enemies remaining
  const alive = enemies.filter(e => !e.dead).length;
  drawText(ctx, `Enemies: ${alive}`, canvas.width - 10, 38, {
    font: '11px sans-serif', colour: '#AAAAAA', align: 'right',
  });

  // Boss HP bar at top-center
  const boss = enemies.find(e => e.type === 'boss');
  if (boss && !boss.dead && boss.active) {
    const bw = 300;
    const bx = canvas.width / 2 - bw / 2;
    drawBar(ctx, bx, 8, bw, 16, boss.hp, boss.maxHp, '#CC0000');
    drawText(ctx, `BOSS  ${boss.hp} / ${boss.maxHp}`, canvas.width / 2, 21, {
      font: 'bold 10px sans-serif', colour: '#FFF', align: 'center',
    });
  }

  // Controls
  drawText(ctx, 'Z: Punch   X: Ki Blast   C: Charge Ki', canvas.width / 2, canvas.height - 8, {
    font: '10px sans-serif', colour: '#444', align: 'center', shadow: false,
  });
}

function drawOverlay(title, titleCol, sub) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawText(ctx, title, canvas.width / 2, canvas.height / 2 - 18, {
    font: 'bold 54px sans-serif', colour: titleCol, align: 'center',
  });
  drawText(ctx, sub, canvas.width / 2, canvas.height / 2 + 28, {
    font: '18px sans-serif', colour: '#FFFFFF', align: 'center',
  });
  drawText(ctx, `Final score: ${player.score}`, canvas.width / 2, canvas.height / 2 + 56, {
    font: '14px sans-serif', colour: '#AAAAAA', align: 'center',
  });
}

// ── Restart ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && gameState !== 'playing') restart();
});

function restart() {
  player.x = 180; player.y = world.groundY - 64;
  player.vx = player.vy = 0;
  player.hp = player.maxHp;
  player.ki = 0;
  player.score = 0;
  player.state = 'idle';
  player.stateTimer = player.hitTimer = player.iFrames = 0;
  player.superSaiyan = false; player.superTimer = 0;
  world.camera.x = 0;
  enemies     = buildEnemyList(world.groundY);
  projectiles = [];
  particles   = [];
  floatTexts  = [];
  screenFlash = 0;
  prevSuper   = false;
  gameState   = 'playing';
}

// ── Loop ──────────────────────────────────────────────────────────────────────
(function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
})();
