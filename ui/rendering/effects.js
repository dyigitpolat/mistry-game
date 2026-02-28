import { TILE, CANVAS_W, CANVAS_H } from "../constants/grid.js";

const DEFAULT_MOOD = { dim: 0, warm: 0, cold: 0, dusty: 0, eerie: 0, damp: 0, opulent: 0, desolate: 0, tense: 0, serene: 0 };

export function resolveMood(room) {
  if (room?.mood && typeof room.mood === "object") {
    return { ...DEFAULT_MOOD, ...room.mood };
  }
  return { ...DEFAULT_MOOD };
}

export function createParticles(count = 30) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * CANVAS_W,
    y: Math.random() * CANVAS_H,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -0.1 - Math.random() * 0.2,
    alpha: 0.15 + Math.random() * 0.25,
    size: 1 + Math.random() * 2,
    phase: Math.random() * Math.PI * 2,
  }));
}

export function updateParticles(particles) {
  for (const p of particles) {
    p.x += p.vx + Math.sin(p.phase) * 0.15;
    p.y += p.vy;
    p.phase += 0.01;
    p.alpha += (Math.random() - 0.5) * 0.02;
    p.alpha = Math.max(0.05, Math.min(0.4, p.alpha));
    if (p.y < -5) { p.y = CANVAS_H + 5; p.x = Math.random() * CANVAS_W; }
    if (p.x < -5) p.x = CANVAS_W + 5;
    if (p.x > CANVAS_W + 5) p.x = -5;
  }
}

function particleColor(mood) {
  if (mood.eerie > 0.3) return "#b0a0d0";
  if (mood.damp > 0.3) return "#90b8c8";
  if (mood.warm > 0.3) return "#ffe8a0";
  if (mood.opulent > 0.3) return "#f0d888";
  return "#d0cce0";
}

export function drawParticles(ctx, particles, mood) {
  const intensity = Math.max(mood.dusty, mood.damp * 0.7, mood.eerie * 0.5, 0.2);
  const color = particleColor(mood);
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = p.alpha * intensity * 1.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawVignette(ctx, mood) {
  const dimBase = mood.dim * 0.4;
  const eerieBoost = mood.eerie * 0.15;
  const tensionBoost = mood.tense * 0.1;
  const sereneDim = mood.serene > 0.5 ? -0.05 : 0;
  const intensity = Math.min(0.7, Math.max(0.15, 0.2 + dimBase + eerieBoost + tensionBoost + sereneDim));

  const gradient = ctx.createRadialGradient(
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.25,
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

export function drawColorTemperature(ctx, mood) {
  ctx.save();
  if (mood.warm > 0.1) {
    ctx.globalAlpha = mood.warm * 0.08;
    ctx.fillStyle = "#ffaa40";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  if (mood.cold > 0.1) {
    ctx.globalAlpha = mood.cold * 0.08;
    ctx.fillStyle = "#4060ff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  if (mood.eerie > 0.2) {
    ctx.globalAlpha = mood.eerie * 0.05;
    ctx.fillStyle = "#6030a0";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  if (mood.damp > 0.2) {
    ctx.globalAlpha = mood.damp * 0.04;
    ctx.fillStyle = "#305060";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  if (mood.opulent > 0.2) {
    ctx.globalAlpha = mood.opulent * 0.04;
    ctx.fillStyle = "#d4a840";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  if (mood.tense > 0.3) {
    ctx.globalAlpha = mood.tense * 0.03;
    ctx.fillStyle = "#a02020";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  ctx.restore();
}

export function drawLightGlows(ctx, objects) {
  const lightKeywords = ["candle", "lantern", "lamp", "torch", "light", "glow"];
  ctx.save();
  for (const obj of objects) {
    const desc = (obj.name || "").toLowerCase() + " " + (obj.description || "").toLowerCase();
    const isLight = lightKeywords.some(kw => desc.includes(kw));
    if (!isLight) continue;
    const w = Math.max(obj.w ?? 1, 1) * TILE;
    const h = Math.max(obj.h ?? 1, 1) * TILE;
    const cx = obj.x * TILE + w / 2;
    const cy = obj.y * TILE + h / 2;
    const radius = Math.max(w, h) * 1.8;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, "rgba(255, 230, 140, 0.12)");
    gradient.addColorStop(0.5, "rgba(255, 200, 80, 0.05)");
    gradient.addColorStop(1, "rgba(255, 200, 80, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

export function drawEffects(ctx, room, particles, mood) {
  if (!room) return;
  drawLightGlows(ctx, room.objects || []);
  drawColorTemperature(ctx, mood);
  drawVignette(ctx, mood);
  drawParticles(ctx, particles, mood);
}
