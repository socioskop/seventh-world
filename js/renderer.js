export function drawBar(ctx, x, y, width, height, value, max, fillColour, bgColour = '#1A1A2E') {
  const ratio = Math.max(0, Math.min(1, value / max));
  ctx.fillStyle = bgColour;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = fillColour;
  ctx.fillRect(x, y, width * ratio, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
}

export function drawText(ctx, text, x, y, {
  font = 'bold 14px sans-serif',
  colour = '#FFFFFF',
  align = 'left',
  shadow = true,
} = {}) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawOrb(ctx, x, y, radius, coreColour) {
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = coreColour;
  ctx.beginPath(); ctx.arc(x, y, radius * 2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2); ctx.fill();
}

export function spawnParticles(worldX, worldY, colour, count = 10) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x: worldX, y: worldY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 20 + Math.floor(Math.random() * 15),
      maxLife: 35,
      colour,
      size: 2 + Math.random() * 3,
    });
  }
  return particles;
}

export function tickParticles(ctx, particles, camera) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle   = p.colour;
    ctx.fillRect(p.x - camera.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
