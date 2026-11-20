/**
 * player.js
 * Tekken-style skeleton-based character animation.
 * The character is drawn as articulated limb segments (thick rounded strokes)
 * with distinct poses per state: idle, walk, jump, fall, punch, blast, charge, hurt.
 *
 * Controls
 * --------
 *   ← → / A D        Move
 *   ↑ / W / Space    Jump
 *   Z / J            Punch
 *   X / K            Ki Blast (costs 20 ki)
 *   C / L  (hold)    Charge Ki → Super Saiyan at max!
 */
export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width  = 44;
    this.height = 64;

    this.vx = 0;
    this.vy = 0;

    this.hp    = 100;
    this.maxHp = 100;
    this.ki    = 0;
    this.maxKi = 100;
    this.score = 0;

    this.speed     = 4.5;
    this.jumpForce = -13.5;

    this.onGround  = false;
    this.facing    = 1;
    this.state     = 'idle';
    this.stateTimer = 0;

    this.hitTimer  = 0;
    this.iFrames   = 0;

    this.superSaiyan = false;
    this.superTimer  = 0;

    this._prevPunch = false;
    this._prevBlast = false;
    this._walkFrame = 0;
    this._time      = 0;   // increments every frame, drives idle bob etc.

    this.onFire  = null;
    this.onPunch = null;
    this.onDeath = null;
  }

  get cx() { return this.x + this.width  / 2; }
  get cy() { return this.y + this.height / 2; }

  takeDamage(amount) {
    if (this.iFrames > 0 || this.state === 'dead') return;
    const dmg = this.superSaiyan ? Math.floor(amount * 0.5) : amount;
    this.hp      -= dmg;
    this.hitTimer = 14;
    this.iFrames  = 32;
    if (this.state !== 'punch' && this.state !== 'blast') {
      this.state      = 'hurt';
      this.stateTimer = 14;
    }
    if (this.hp <= 0) {
      this.hp    = 0;
      this.state = 'dead';
      if (this.onDeath) this.onDeath();
    }
  }

  punchDamage() { return this.superSaiyan ? 30 : 14; }
  blastDamage()  { return this.superSaiyan ? 42 : 22; }

  // ── Update ────────────────────────────────────────────────────────

  update(input, world) {
    if (this.state === 'dead') return;
    this._time++;
    this._tickTimers();
    this._handleCharge(input);

    const locked = this.stateTimer > 0 && ['punch','blast','hurt'].includes(this.state);
    if (!locked) {
      this._handleMovement(input);
      this._handleJump(input);
      this._handleAttacks(input);
    }

    this._applyPhysics(world);
    this._resolveGround(world);
    this._clampToWorld(world);
    this._updateAnimState();
  }

  _tickTimers() {
    if (this.stateTimer > 0) this.stateTimer--;
    if (this.hitTimer   > 0) this.hitTimer--;
    if (this.iFrames    > 0) this.iFrames--;
    if (this.superTimer > 0) {
      this.superTimer--;
      this.ki = Math.max(0, this.ki - 0.05);
      if (this.superTimer <= 0) this.superSaiyan = false;
    }
  }

  _handleCharge(input) {
    const charging = input.isDown('KeyC') || input.isDown('KeyL');
    if (charging && this.stateTimer <= 0 && this.state !== 'dead') {
      this.state = 'charge';
      this.ki    = Math.min(this.maxKi, this.ki + 0.9);
      this.vx   *= 0.4;
      if (this.ki >= this.maxKi && !this.superSaiyan) {
        this.superSaiyan = true;
        this.superTimer  = 720;
      }
    } else if (this.state === 'charge') {
      this.state = 'idle';
    }
  }

  _handleMovement(input) {
    if (this.state === 'charge') return;
    const left  = input.isDown('ArrowLeft')  || input.isDown('KeyA');
    const right = input.isDown('ArrowRight') || input.isDown('KeyD');
    if (left)       { this.vx = -this.speed; this.facing = -1; }
    else if (right) { this.vx =  this.speed; this.facing =  1; }
    else { this.vx *= 0.75; if (Math.abs(this.vx) < 0.3) this.vx = 0; }
  }

  _handleJump(input) {
    const j = input.isPressed('ArrowUp') || input.isPressed('KeyW') || input.isPressed('Space');
    if (j && this.onGround) {
      this.vy = this.jumpForce;
      this.onGround = false;
    }
  }

  _handleAttacks(input) {
    const punchNow = input.isDown('KeyZ') || input.isDown('KeyJ');
    if (punchNow && !this._prevPunch && this.stateTimer <= 0) {
      this.state      = 'punch';
      this.stateTimer = 22;
      if (this.onPunch) this.onPunch(this.facing, this.cx, this.cy);
    }
    this._prevPunch = punchNow;

    const blastNow = input.isDown('KeyX') || input.isDown('KeyK');
    if (blastNow && !this._prevBlast && this.stateTimer <= 0 && this.ki >= 20) {
      this.state      = 'blast';
      this.stateTimer = 26;
      this.ki        -= 20;
      if (this.onFire) {
        this.onFire({
          x: this.x + (this.facing > 0 ? this.width : 0),
          y: this.cy - 8,
          vx: this.facing * 13,
          vy: 0,
          radius: this.superSaiyan ? 14 : 9,
          colour: this.superSaiyan ? '#FFD700' : '#00CCFF',
          damage: this.blastDamage(),
          life: 70,
          fromEnemy: false,
        });
      }
    }
    this._prevBlast = blastNow;
  }

  _applyPhysics(world) {
    this.vy += world.gravity;
    this.x  += this.vx;
    this.y  += this.vy;
  }

  _resolveGround(world) {
    if (this.y + this.height >= world.groundY) {
      this.y = world.groundY - this.height;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  _clampToWorld(world) {
    if (this.x < 0) { this.x = 0; this.vx = 0; }
  }

  _updateAnimState() {
    if (this.stateTimer > 0 && ['punch','blast','hurt'].includes(this.state)) return;
    if (this.state === 'charge' || this.state === 'dead') return;
    if (!this.onGround) {
      this.state = this.vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(this.vx) > 0.4) {
      this.state = 'walk';
      this._walkFrame++;
    } else {
      this.state = 'idle';
      this._walkFrame = 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DRAWING — skeleton-based Tekken-style renderer
  // ═══════════════════════════════════════════════════════════════════

  draw(ctx, world) {
    if (this.state === 'dead') return;
    const sx = world.toScreenX(this.cx);
    const sy = this.cy;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(this.facing, 1);
    if (this.hitTimer > 0) ctx.globalAlpha = 0.45;

    // Energy auras (drawn before character)
    this._drawAura(ctx);

    // Character skeleton
    const pose = this._getPose();
    this._renderSkeleton(ctx, pose);

    ctx.restore();
  }

  // ── Aura effects ──────────────────────────────────────────────────

  _drawAura(ctx) {
    if (this.superSaiyan) {
      const p = Math.sin(this._time * 0.15) * 5;
      const g = ctx.createRadialGradient(0, 0, 5, 0, 0, 38 + p);
      g.addColorStop(0,   'rgba(255,220,0,0.45)');
      g.addColorStop(0.5, 'rgba(255,180,0,0.2)');
      g.addColorStop(1,   'rgba(255,140,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 2, 28 + p, 50 + p, 0, 0, Math.PI * 2);
      ctx.fill();
      // Electric sparks
      for (let i = 0; i < 3; i++) {
        const a = (this._time * 0.2 + i * 2.1) % (Math.PI * 2);
        const r = 22 + Math.sin(this._time * 0.3 + i) * 6;
        ctx.strokeStyle = 'rgba(255,240,80,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4) * 1.5);
        ctx.lineTo(Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r * 1.5);
        ctx.stroke();
      }
    }
    if (this.state === 'charge') {
      const p = Math.sin(this._time * 0.2) * 4;
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30 + p);
      g.addColorStop(0,   'rgba(50,180,255,0.4)');
      g.addColorStop(1,   'rgba(0,100,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 2, 22 + p, 42 + p, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Pose calculator ───────────────────────────────────────────────

  /**
   * Returns a pose object with all joint positions.
   * All coords are relative to the sprite centre (0,0), y-down.
   *
   * Joints:
   *   head, neck, chest, hip
   *   lSh, lEl, lHa   (left / back arm: shoulder, elbow, hand)
   *   rSh, rEl, rHa   (right / front arm)
   *   lHj, lKn, lAn   (left / back leg: hip-joint, knee, ankle)
   *   rHj, rKn, rAn   (right / front leg)
   */
  _getPose() {
    const t = this._time;

    // ── IDLE — fighting stance with breathing bob ──────────────────
    if (this.state === 'idle') {
      const bob = Math.sin(t * 0.06) * 1.8;
      const sway = Math.sin(t * 0.04) * 0.8;
      return {
        head: { x: sway - 1, y: -27 + bob },
        neck: { x: sway,     y: -19 + bob * 0.6 },
        chest:{ x: 1,        y: -10 },
        hip:  { x: 2,        y:   3 },
        // Front arm (right) — guard position
        rSh:  { x: -3, y: -15 }, rEl: { x:  9, y: -10 + bob * 0.4 }, rHa: { x: 15, y: -5 + bob * 0.4 },
        // Back arm (left) — chin guard
        lSh:  { x: -6, y: -14 }, lEl: { x: -14, y: -10 }, lHa: { x: -11, y: -4 },
        // Front leg (right) — forward, bent
        rHj:  { x:  6, y:  5 }, rKn: { x: 10, y: 18 }, rAn: { x:  7, y: 30 },
        // Back leg (left) — behind, bent
        lHj:  { x: -3, y:  5 }, lKn: { x: -9, y: 18 }, lAn: { x: -8, y: 30 },
      };
    }

    // ── WALK — fighter shuffle ─────────────────────────────────────
    if (this.state === 'walk') {
      const p = this._walkFrame * 0.28;
      const legF  =  Math.sin(p) * 10;   // front-back leg swing
      const armF  = -Math.sin(p) * 7;    // arms swing opposite
      const bob   =  Math.abs(Math.sin(p)) * -2;
      return {
        head: { x: 0,  y: -27 + bob },
        neck: { x: 0,  y: -19 + bob * 0.5 },
        chest:{ x: 0,  y: -10 },
        hip:  { x: 1,  y:   3 },
        rSh:  { x: -3, y: -15 }, rEl: { x: 7 + armF * 0.4, y: -11 }, rHa: { x: 12 + armF, y: -5 },
        lSh:  { x: -5, y: -14 }, lEl: { x: -12 - armF * 0.4, y: -11 }, lHa: { x: -9 - armF, y: -5 },
        rHj:  { x:  5 + legF * 0.3, y: 5 }, rKn: { x:  8 + legF * 0.6, y: 17 + bob }, rAn: { x:  6 + legF, y: 30 },
        lHj:  { x: -2 - legF * 0.3, y: 5 }, lKn: { x: -7 - legF * 0.6, y: 17 + bob }, lAn: { x: -7 - legF, y: 30 },
      };
    }

    // ── JUMP ──────────────────────────────────────────────────────
    if (this.state === 'jump') {
      return {
        head: { x: 0,  y: -28 },
        neck: { x: 0,  y: -20 },
        chest:{ x: 0,  y: -10 },
        hip:  { x: 1,  y:   2 },
        rSh:  { x: -2, y: -15 }, rEl: { x:  8, y: -22 }, rHa: { x: 15, y: -20 },
        lSh:  { x: -5, y: -15 }, lEl: { x: -12, y: -22 }, lHa: { x: -14, y: -18 },
        // Legs tucked up for jump
        rHj:  { x:  6, y:  5 }, rKn: { x: 12, y:  8 }, rAn: { x: 10, y: 20 },
        lHj:  { x: -2, y:  5 }, lKn: { x: -8, y:  8 }, lAn: { x: -6, y: 20 },
      };
    }

    // ── FALL ──────────────────────────────────────────────────────
    if (this.state === 'fall') {
      return {
        head: { x: 1,  y: -26 },
        neck: { x: 1,  y: -18 },
        chest:{ x: 1,  y:  -9 },
        hip:  { x: 2,  y:   3 },
        rSh:  { x: -2, y: -14 }, rEl: { x:  10, y: -8 }, rHa: { x: 17, y:  2 },
        lSh:  { x: -5, y: -13 }, lEl: { x: -14, y: -6 }, lHa: { x: -16, y:  4 },
        rHj:  { x:  6, y:  5  }, rKn: { x: 13, y: 16 }, rAn: { x:  9, y: 28 },
        lHj:  { x: -3, y:  5  }, lKn: { x: -9, y: 16 }, lAn: { x: -7, y: 28 },
      };
    }

    // ── PUNCH ─────────────────────────────────────────────────────
    // stateTimer: 22→0   phases: coil (>16), extend (16→8), hold (8→4), retract (<4)
    if (this.state === 'punch') {
      const st = this.stateTimer;
      if (st > 16) {
        // Coil — pull weight back, left arm cocks way back
        return {
          head: { x: -3, y: -27 },
          neck: { x: -2, y: -19 },
          chest:{ x: -2, y: -10 },
          hip:  { x:  1, y:   3 },
          rSh:  { x: -4, y: -15 }, rEl: { x:  7, y: -11 }, rHa: { x: 13, y: -5 },
          lSh:  { x: -7, y: -15 }, lEl: { x: -17, y: -14 }, lHa: { x: -16, y: -6 },
          rHj:  { x:  5, y:  5  }, rKn: { x:  9, y: 18 }, rAn: { x:  6, y: 30 },
          lHj:  { x: -4, y:  5  }, lKn: { x: -9, y: 18 }, lAn: { x: -7, y: 30 },
        };
      } else if (st > 5) {
        // EXTEND — full body rotation into punch, left arm fully launched forward
        const ext = 1 - (st - 5) / 11;   // 0→1 as punch reaches full extension
        const reach = ext * 28;
        return {
          head: { x: 2 + ext * 3,   y: -27 },
          neck: { x: 1 + ext * 2,   y: -19 },
          chest:{ x: 2 + ext * 2,   y: -10 },
          hip:  { x: 2,             y:   3 },
          // Back arm (left) — the punching arm — fully extended
          lSh:  { x: -5, y: -15 }, lEl: { x: 4 + reach * 0.4, y: -13 }, lHa: { x: 10 + reach, y: -8 },
          // Front arm (right) — guard pulled back
          rSh:  { x: -4, y: -15 }, rEl: { x:  4, y: -10 }, rHa: { x:  8, y: -5 },
          rHj:  { x:  6, y:  5  }, rKn: { x: 11, y: 19 }, rAn: { x:  8, y: 31 },
          lHj:  { x: -3, y:  5  }, lKn: { x: -8, y: 19 }, lAn: { x: -6, y: 31 },
        };
      } else {
        // Retract
        return {
          head: { x: 1,  y: -27 },
          neck: { x: 1,  y: -19 },
          chest:{ x: 1,  y: -10 },
          hip:  { x: 2,  y:   3 },
          lSh:  { x: -5, y: -15 }, lEl: { x: -2, y: -14 }, lHa: { x: -8, y: -6 },
          rSh:  { x: -3, y: -15 }, rEl: { x:  9, y: -11 }, rHa: { x: 15, y: -5 },
          rHj:  { x:  6, y:  5  }, rKn: { x: 10, y: 18 }, rAn: { x:  7, y: 30 },
          lHj:  { x: -3, y:  5  }, lKn: { x: -9, y: 18 }, lAn: { x: -8, y: 30 },
        };
      }
    }

    // ── KI BLAST ─────────────────────────────────────────────────
    // Both hands pushed forward, palms out (kamehameha-inspired)
    if (this.state === 'blast') {
      const st = this.stateTimer;
      if (st > 18) {
        // Wind-up — bring hands together at waist
        return {
          head: { x: -1, y: -27 },
          neck: { x: -1, y: -19 },
          chest:{ x:  0, y: -10 },
          hip:  { x:  1, y:   3 },
          lSh:  { x: -6, y: -14 }, lEl: { x: -4, y:  2 }, lHa: { x:  2, y:  8 },
          rSh:  { x: -4, y: -14 }, rEl: { x: -2, y:  2 }, rHa: { x:  4, y:  8 },
          rHj:  { x:  5, y:  5  }, rKn: { x:  8, y: 18 }, rAn: { x:  6, y: 30 },
          lHj:  { x: -4, y:  5  }, lKn: { x: -9, y: 18 }, lAn: { x: -8, y: 30 },
        };
      } else {
        // RELEASE — both arms thrust forward together
        return {
          head: { x:  2, y: -27 },
          neck: { x:  2, y: -19 },
          chest:{ x:  3, y: -10 },
          hip:  { x:  2, y:   3 },
          lSh:  { x: -4, y: -14 }, lEl: { x:  8, y: -10 }, lHa: { x: 22, y: -8 },
          rSh:  { x: -3, y: -16 }, rEl: { x:  8, y: -14 }, rHa: { x: 22, y: -12 },
          rHj:  { x:  6, y:  5  }, rKn: { x: 12, y: 20 }, rAn: { x:  9, y: 32 },
          lHj:  { x: -2, y:  5  }, lKn: { x: -6, y: 20 }, lAn: { x: -4, y: 32 },
        };
      }
    }

    // ── CHARGE ───────────────────────────────────────────────────
    // Wide stance, arms spread and slightly back, head back
    {
      const pulse = Math.sin(t * 0.22) * 3;
      return {
        head: { x: -1, y: -28 - pulse * 0.3 },
        neck: { x: -1, y: -20 },
        chest:{ x:  0, y: -10 },
        hip:  { x:  0, y:   5 },
        rSh:  { x: -4, y: -15 }, rEl: { x:  14 + pulse, y: -14 }, rHa: { x: 20 + pulse, y: -8 + pulse },
        lSh:  { x: -6, y: -15 }, lEl: { x: -16 - pulse, y: -14 }, lHa: { x: -22 - pulse, y: -8 + pulse },
        rHj:  { x:  8, y:  5  }, rKn: { x: 14, y: 20 }, rAn: { x: 10, y: 32 },
        lHj:  { x: -7, y:  5  }, lKn: { x:-14, y: 20 }, lAn: { x:-10, y: 32 },
      };
    }
  }

  // ── Skeleton renderer ─────────────────────────────────────────────

  _renderSkeleton(ctx, p) {
    const ss = this.superSaiyan;
    // Colour palette
    const C = {
      skin:     '#FFCC88',
      skinDark: '#CC9944',
      gi:       '#FF6600',
      giDark:   '#CC4400',
      pants:    '#2244BB',
      pantsDark:'#112277',
      belt:     '#FFFFFF',
      hair:     ss ? '#FFD700' : '#1A1008',
      hairHi:   ss ? '#FFF080' : '#3A2810',
      outline:  '#0A0A0A',
      eye:      ss ? '#00BBFF' : '#1A0A00',
    };

    // ── Draw order: back limbs → torso → front limbs → head ───────

    // Back leg (left)
    this._limb(ctx, p.lHj, p.lKn, p.lAn, 8, 7, C.pants, C.outline);
    // Boot left
    this._seg(ctx, p.lAn, { x: p.lAn.x - 3, y: p.lAn.y + 2 }, 8, C.outline);
    this._seg(ctx, p.lAn, { x: p.lAn.x - 3, y: p.lAn.y + 2 }, 6, C.pantsDark);

    // Back arm (left)
    this._limb(ctx, p.lSh, p.lEl, p.lHa, 7, 6, C.gi, C.outline);
    // Fist left
    this._circle(ctx, p.lHa.x, p.lHa.y, 5, C.outline);
    this._circle(ctx, p.lHa.x, p.lHa.y, 4, C.skin);

    // Torso (chest to hip)
    this._seg(ctx, p.neck, p.hip, 13, C.outline);
    this._seg(ctx, p.neck, p.hip, 11, C.gi);
    // Gi lapels
    this._seg(ctx, p.chest, { x: p.chest.x - 3, y: p.chest.y - 6 }, 4, C.pants);
    this._seg(ctx, p.chest, { x: p.chest.x + 3, y: p.chest.y - 6 }, 4, C.pants);
    // Belt
    this._seg(ctx,
      { x: p.hip.x - 9,  y: p.hip.y - 3 },
      { x: p.hip.x + 11, y: p.hip.y - 3 }, 5, C.outline);
    this._seg(ctx,
      { x: p.hip.x - 9,  y: p.hip.y - 3 },
      { x: p.hip.x + 11, y: p.hip.y - 3 }, 3, C.belt);

    // Front leg (right)
    this._limb(ctx, p.rHj, p.rKn, p.rAn, 9, 8, C.pants, C.outline);
    // Boot right
    this._seg(ctx, p.rAn, { x: p.rAn.x + 5, y: p.rAn.y + 2 }, 9, C.outline);
    this._seg(ctx, p.rAn, { x: p.rAn.x + 5, y: p.rAn.y + 2 }, 7, C.pantsDark);

    // Head
    const hx = p.head.x, hy = p.head.y;
    // Neck
    this._seg(ctx, p.neck, p.head, 7, C.outline);
    this._seg(ctx, p.neck, p.head, 5, C.skin);
    // Head circle (outline then fill)
    this._circle(ctx, hx, hy, 11, C.outline);
    this._circle(ctx, hx, hy, 9,  C.skin);
    // Hair block
    this._drawHair(ctx, hx, hy, C.hair, C.hairHi);
    // Ear
    this._circle(ctx, hx + 8, hy + 1, 4, C.outline);
    this._circle(ctx, hx + 8, hy + 1, 3, C.skin);
    // Brow
    ctx.strokeStyle = C.outline; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 5, hy - 3); ctx.lineTo(hx - 1, hy - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 1, hy - 5); ctx.lineTo(hx + 5, hy - 3); ctx.stroke();
    // Eye
    this._circle(ctx, hx + 2, hy - 1, 3, C.outline);
    this._circle(ctx, hx + 2, hy - 1, 2, C.eye);
    this._circle(ctx, hx + 3, hy - 2, 1, '#FFFFFF');
    // Mouth (determined smirk)
    ctx.strokeStyle = C.outline; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(hx + 1, hy + 4); ctx.quadraticCurveTo(hx + 4, hy + 5, hx + 6, hy + 3); ctx.stroke();

    // Front arm (right) — on top of everything
    this._limb(ctx, p.rSh, p.rEl, p.rHa, 8, 7, C.gi, C.outline);
    // Gi sleeve detail
    this._seg(ctx, p.rSh, { x: p.rSh.x + 2, y: p.rSh.y + 4 }, 5, C.pants);
    // Fist right
    this._circle(ctx, p.rHa.x, p.rHa.y, 6, C.outline);
    this._circle(ctx, p.rHa.x, p.rHa.y, 5, C.skin);
    // Knuckle lines
    ctx.strokeStyle = C.skinDark; ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(p.rHa.x + 2, p.rHa.y + i * 2 - 1);
      ctx.lineTo(p.rHa.x + 5, p.rHa.y + i * 2 - 1);
      ctx.stroke();
    }
  }

  // ── Segment drawing helpers ───────────────────────────────────────

  _seg(ctx, a, b, width, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  _circle(ctx, x, y, r, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Draw a two-segment limb: shoulder→elbow→hand with outline + fill */
  _limb(ctx, a, b, c, outW, fillW, colour, outlineCol) {
    // Outline pass
    ctx.strokeStyle = outlineCol;
    ctx.lineWidth   = outW;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    // Colour pass
    ctx.strokeStyle = colour;
    ctx.lineWidth   = fillW;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    // Joint circle
    this._circle(ctx, b.x, b.y, outW / 2 - 0.5, colour);
  }

  // ── Hair ──────────────────────────────────────────────────────────

  _drawHair(ctx, hx, hy, col, hiCol) {
    // Base
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(hx - 2, hy - 5, 9, 7, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Spikes — wider and more dramatic for Super Saiyan
    const tall = this.superSaiyan;
    const spikes = tall ? [
      [hx - 10, hy - 8,  hx - 8,  hy - 28, hx - 4,  hy - 8 ],
      [hx -  5, hy - 9,  hx - 2,  hy - 32, hx +  2, hy - 9 ],
      [hx +  0, hy - 10, hx +  4, hy - 35, hx +  8, hy - 10],
      [hx +  5, hy - 8,  hx + 10, hy - 28, hx + 12, hy - 8 ],
    ] : [
      [hx - 9,  hy - 7,  hx - 8,  hy - 20, hx - 4,  hy - 7 ],
      [hx - 4,  hy - 9,  hx - 1,  hy - 23, hx +  2, hy - 9 ],
      [hx + 1,  hy - 9,  hx +  4, hy - 22, hx +  7, hy - 9 ],
      [hx + 5,  hy - 7,  hx +  8, hy - 18, hx + 10, hy - 7 ],
    ];

    spikes.forEach(([x1, y1, tx, ty, x2, y2]) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(tx, ty);
      ctx.lineTo(x2, y2);
      ctx.fill();
      // Highlight streak on each spike
      ctx.strokeStyle = hiCol;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo((x1 + tx) / 2 + 1, (y1 + ty) / 2);
      ctx.lineTo(tx + 1, ty + 4);
      ctx.stroke();
    });
  }
}
