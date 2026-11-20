/**
 * enemy.js
 * Three enemy types: grunt, elite, boss
 * Each activates when the player gets within range.
 */

export class Enemy {
  constructor(type, x, groundY) {
    this.type     = type;
    this.groundY  = groundY;
    this.dead     = false;
    this.active   = false;   // wakes up when player is close enough

    const cfg = {
      grunt: { hp:60,  w:40, h:60, spd:2.2, atk:8,  meleRange:70,  shootRange:0,   blastCooldown:0,   colour:'#6622AA', eyeCol:'#FF3333' },
      elite: { hp:100, w:42, h:62, spd:1.6, atk:14, meleRange:200, shootRange:300, blastCooldown:100, colour:'#1E8833', eyeCol:'#FF6600' },
      boss:  { hp:400, w:56, h:76, spd:2.8, atk:22, meleRange:80,  shootRange:400, blastCooldown:90,  colour:'#7733AA', eyeCol:'#FF2222' },
    }[type];

    Object.assign(this, cfg);
    this.maxHp = this.hp;
    this.x     = x;
    this.y     = groundY - this.h;
    this.vx    = 0;
    this.vy    = 0;
    this.facing    = -1;
    this.onGround  = false;
    this.state     = 'walk';
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.blastTimer = 0;
    this.hitTimer   = 0;      // flash white on hit
    this._walkFrame = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  /** Returns a projectile object if the enemy fires this frame, else null */
  update(player, world) {
    if (this.dead) return null;

    // Wake up when player is nearby
    if (!this.active && Math.abs(this.cx - (player.x + player.width / 2)) < 700) {
      this.active = true;
    }
    if (!this.active) return null;

    if (this.stateTimer  > 0) this.stateTimer--;
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.blastTimer  > 0) this.blastTimer--;
    if (this.hitTimer    > 0) this.hitTimer--;

    const px  = player.x + player.width  / 2;
    const dx  = px - this.cx;
    this.facing = dx > 0 ? 1 : -1;
    const dist  = Math.abs(dx);

    // Physics
    this.vy += world.gravity;
    this.x  += this.vx;
    this.y  += this.vy;
    if (this.y + this.h >= world.groundY) {
      this.y = world.groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.x = Math.max(0, Math.min(world.width - this.w, this.x));

    let firedBlast = null;

    if (this.type === 'grunt') {
      // Chase and punch
      if (dist > this.meleRange) {
        this.vx = this.facing * this.spd;
        this.state = 'walk';
        this._walkFrame++;
      } else {
        this.vx *= 0.6;
        if (this.attackCooldown <= 0) {
          this.state = 'punch';
          this.stateTimer = 20;
          this.attackCooldown = 80;
          // deal damage to player
          if (player.hitTimer <= 0) {
            player.takeDamage(this.atk);
          }
        } else {
          this.state = 'idle';
        }
      }
    } else if (this.type === 'elite') {
      // Stay mid-range and shoot
      if (dist > this.shootRange) {
        this.vx = this.facing * this.spd * 0.7;
        this.state = 'walk';
        this._walkFrame++;
      } else if (dist < this.meleRange * 0.6) {
        this.vx = -this.facing * this.spd * 0.5;
        this.state = 'walk';
      } else {
        this.vx *= 0.5;
        this.state = 'idle';
      }
      if (this.blastTimer <= 0 && dist < this.shootRange) {
        this.blastTimer = this.blastCooldown;
        this.state = 'blast';
        this.stateTimer = 26;
        firedBlast = this._makeBlast();
      }
    } else if (this.type === 'boss') {
      // Mix of melee chase and ranged blasts
      if (dist > this.meleRange + 20) {
        this.vx = this.facing * this.spd;
        this.state = 'walk';
        this._walkFrame++;
      } else {
        this.vx *= 0.5;
        if (this.attackCooldown <= 0) {
          this.state = 'punch';
          this.stateTimer = 22;
          this.attackCooldown = 60;
          if (player.hitTimer <= 0) {
            player.takeDamage(this.atk);
          }
        } else {
          this.state = 'idle';
        }
      }
      // Boss also shoots blasts periodically
      if (this.blastTimer <= 0 && dist < 500) {
        this.blastTimer = this.blastCooldown;
        firedBlast = this._makeBlast();
      }
    }

    return firedBlast;
  }

  _makeBlast() {
    return {
      x:      this.x + (this.facing > 0 ? this.w : 0),
      y:      this.cy - 8,
      vx:     this.facing * (this.type === 'boss' ? 9 : 7.5),
      vy:     0,
      radius: this.type === 'boss' ? 12 : 8,
      colour: this.type === 'boss' ? '#FF2200' : '#FF6600',
      damage: this.type === 'boss' ? 20 : 12,
      life:   90,
      fromEnemy: true,
    };
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitTimer = 12;
    if (this.hp <= 0) {
      this.hp   = 0;
      this.dead = true;
    }
  }

  draw(ctx, world) {
    if (this.dead) return;
    const sx = world.toScreenX(this.x + this.w / 2);
    const sy = this.y;

    ctx.save();
    ctx.translate(sx, sy + this.h / 2);
    ctx.scale(this.facing, 1);
    if (this.hitTimer > 0) ctx.globalAlpha = 0.45;

    if      (this.type === 'grunt') this._drawGrunt(ctx);
    else if (this.type === 'elite') this._drawElite(ctx);
    else                            this._drawBoss(ctx);

    ctx.restore();

    // HP bar above enemy
    this._drawHpBar(ctx, world);
  }

  _drawHpBar(ctx, world) {
    const bw  = this.type === 'boss' ? 100 : 50;
    const sx  = world.toScreenX(this.x + this.w / 2) - bw / 2;
    const sy  = this.y - 12;
    const pct = this.hp / this.maxHp;
    ctx.fillStyle = '#330000';
    ctx.fillRect(sx, sy, bw, 5);
    ctx.fillStyle = this.type === 'boss' ? '#FF2200' : '#FF6600';
    ctx.fillRect(sx, sy, bw * pct, 5);
  }

  // ── sprite drawing ───────────────────────────────────────────────

  _drawGrunt(ctx) {
    const hh = this.h / 2;
    const hw = this.w / 2;
    const swing = this.state === 'walk' ? Math.sin(this._walkFrame * 0.28) * 6 : 0;
    ctx.fillStyle = '#6622AA';
    ctx.fillRect(-hw + 2,  hh - 30 + swing, 10, 28);
    ctx.fillRect( hw - 12, hh - 30 - swing, 10, 28);
    ctx.fillStyle = '#2211AA';
    ctx.fillRect(-hw, hh - 6, 12, 8); ctx.fillRect(hw - 12, hh - 6, 12, 8);
    ctx.fillStyle = '#6622AA';
    ctx.fillRect(-hw, -hh + 4, this.w, hh - 4);
    ctx.fillStyle = '#AA44CC';
    ctx.fillRect(-5, -hh + 8, 10, 9);
    ctx.fillStyle = '#440088';
    ctx.fillRect(-hw - 7, -hh + 6, 8, 18); ctx.fillRect(hw - 1, -hh + 6, 8, 18);
    ctx.fillStyle = '#8844BB';
    ctx.beginPath(); ctx.ellipse(0, -hh - 8, 11, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#440088'; ctx.fillRect(-11, -hh - 14, 22, 5);
    ctx.fillStyle = '#FF3333'; ctx.fillRect(-5, -hh - 12, 3, 3); ctx.fillRect(2, -hh - 12, 3, 3);
  }

  _drawElite(ctx) {
    const hh = this.h / 2;
    const hw = this.w / 2;
    const swing = this.state === 'walk' ? Math.sin(this._walkFrame * 0.28) * 6 : 0;
    ctx.fillStyle = '#1E8833';
    ctx.fillRect(-hw + 2,  hh - 30 + swing, 10, 28);
    ctx.fillRect( hw - 12, hh - 30 - swing, 10, 28);
    ctx.fillStyle = '#0A3311';
    ctx.fillRect(-hw, hh - 6, 12, 8); ctx.fillRect(hw - 12, hh - 6, 12, 8);
    ctx.fillStyle = '#1E8833';
    ctx.fillRect(-hw, -hh + 4, this.w, hh - 4);
    ctx.fillStyle = '#053311';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(-5 + (i % 2) * 11, -hh + 10 + Math.floor(i / 2) * 11, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#1E8833';
    ctx.fillRect(-hw - 8, -hh + 6, 8, 20); ctx.fillRect(hw, -hh + 6, 8, 20);
    ctx.fillStyle = '#2AAA44';
    ctx.beginPath(); ctx.ellipse(0, -hh - 8, 13, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#053311';
    ctx.beginPath(); ctx.moveTo(0, -hh - 18); ctx.lineTo(-5, -hh - 30); ctx.lineTo(5, -hh - 30); ctx.closePath(); ctx.fill();
    ctx.fillRect(-3, -hh - 24, 6, 8);
    ctx.fillStyle = '#000'; ctx.fillRect(-6, -hh - 12, 4, 4); ctx.fillRect(2, -hh - 12, 4, 4);
    ctx.fillStyle = '#FF6600'; ctx.fillRect(-5, -hh - 14, 2, 2); ctx.fillRect(3, -hh - 14, 2, 2);
  }

  _drawBoss(ctx) {
    const hh = this.h / 2;
    const hw = this.w / 2;
    const swing = this.state === 'walk' ? Math.sin(this._walkFrame * 0.22) * 7 : 0;
    // cape
    ctx.fillStyle = '#AA88CC';
    ctx.beginPath(); ctx.moveTo(-8, hh - 36); ctx.quadraticCurveTo(hw + 20, hh - 10, hw - 2, hh + 2); ctx.quadraticCurveTo(10, hh + 12, -hw + 6, hh); ctx.fill();
    // legs
    ctx.fillStyle = '#E8E8F0';
    ctx.fillRect(-hw + 4,  hh - 36 + swing, 13, 34);
    ctx.fillRect( hw - 17, hh - 36 - swing, 13, 34);
    ctx.fillStyle = '#7733AA';
    ctx.fillRect(-hw + 2, hh - 6, 15, 10); ctx.fillRect(hw - 17, hh - 6, 15, 10);
    // torso
    ctx.fillStyle = '#E8E8F0';
    ctx.fillRect(-hw, -hh + 4, this.w, hh - 4);
    ctx.fillStyle = '#7733AA';
    ctx.fillRect(-hw - 2, -hh - 2, this.w + 4, 20);
    ctx.fillRect(-12, -hh + 18, 24, 10);
    // arms
    ctx.fillStyle = '#6622AA';
    ctx.fillRect(-hw - 12, -hh + 4, 14, 10);
    ctx.fillRect( hw - 2,  -hh + 4, 14, 10);
    ctx.fillStyle = '#E8E8F0';
    ctx.fillRect(-hw - 10, -hh + 12, 12, 28); ctx.fillRect(hw - 2, -hh + 12, 12, 28);
    ctx.fillStyle = '#CCB8E8';
    ctx.fillRect(-hw - 12, -hh + 38, 14, 12); ctx.fillRect(hw - 2, -hh + 38, 14, 12);
    // head
    ctx.fillStyle = '#F0EEF8';
    ctx.beginPath(); ctx.ellipse(0, -hh - 14, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7733AA';
    ctx.beginPath(); ctx.moveTo(-10, -hh - 24); ctx.lineTo(-17, -hh - 40); ctx.lineTo(-4, -hh - 26); ctx.fill();
    ctx.beginPath(); ctx.moveTo( 10, -hh - 24); ctx.lineTo( 17, -hh - 40); ctx.lineTo(  4, -hh - 26); ctx.fill();
    ctx.fillRect(-12, -hh - 22, 24, 5);
    ctx.fillStyle = '#FF2222'; ctx.fillRect(-6, -hh - 18, 4, 4); ctx.fillRect(2, -hh - 18, 4, 4);
  }
}

/**
 * Build the full enemy layout for the level.
 * Tweak positions / types freely here.
 */
export function buildEnemyList(groundY) {
  return [
    new Enemy('grunt', 900,  groundY),
    new Enemy('grunt', 1500, groundY),
    new Enemy('elite', 2100, groundY),
    new Enemy('grunt', 2700, groundY),
    new Enemy('elite', 3400, groundY),
    new Enemy('grunt', 4000, groundY),
    new Enemy('elite', 4700, groundY),
    new Enemy('boss',  5600, groundY),
  ];
}
