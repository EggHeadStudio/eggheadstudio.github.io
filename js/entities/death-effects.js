import { gameState } from "../core/game-state.js"

const DEATH_EFFECT_DURATION = 3000
const BLOOD_POOL_SETTLE_DURATION = 260
const PARTICLE_BASE_STEP = 16

function drawDropletPath(ctx, radius, length) {
  ctx.beginPath()
  ctx.moveTo(0, -length)
  ctx.bezierCurveTo(radius * 0.92, -length * 0.55, radius * 1.12, radius * 0.18, 0, radius * 1.18)
  ctx.bezierCurveTo(-radius * 1.12, radius * 0.18, -radius * 0.92, -length * 0.55, 0, -length)
  ctx.closePath()
}

function drawIrregularSplatPath(ctx, points, scaleX = 1, scaleY = 1) {
  if (!points || points.length < 3) {
    return
  }

  ctx.beginPath()

  for (let i = 0; i < points.length; i++) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    const currentX = Math.cos(current.angle) * current.radius * scaleX
    const currentY = Math.sin(current.angle) * current.radius * scaleY
    const nextX = Math.cos(next.angle) * next.radius * scaleX
    const nextY = Math.sin(next.angle) * next.radius * scaleY
    const controlAngle = (current.angle + next.angle) * 0.5
    const controlRadius = Math.max(current.radius, next.radius) * 1.08
    const controlX = Math.cos(controlAngle) * controlRadius * scaleX
    const controlY = Math.sin(controlAngle) * controlRadius * scaleY

    if (i === 0) {
      ctx.moveTo(currentX, currentY)
    }

    ctx.quadraticCurveTo(controlX, controlY, nextX, nextY)
  }

  ctx.closePath()
}

function getBloodParticleColor() {
  const palette = [
    "rgba(126, 10, 18, 0.92)",
    "rgba(154, 18, 28, 0.9)",
    "rgba(184, 24, 34, 0.88)",
    "rgba(98, 6, 14, 0.94)",
  ]

  return palette[Math.floor(Math.random() * palette.length)]
}

export function createDeathEffect({ x, y, size, sourceVelocityX = 0, sourceVelocityY = 0 } = {}) {
  if (typeof x !== "number" || typeof y !== "number" || typeof size !== "number") {
    return
  }

  if (!gameState.deathEffects) {
    gameState.deathEffects = []
  }

  const createdAt = Date.now()
  const particleCount = 12 + Math.floor(Math.random() * 5)
  const effect = {
    x,
    y,
    size,
    createdAt,
    lastUpdatedAt: createdAt,
    duration: DEATH_EFFECT_DURATION,
    splatProfile: [],
    splatRays: [],
    splashDrops: [],
    particles: [],
  }

  const profilePointCount = 16 + Math.floor(Math.random() * 7)
  for (let i = 0; i < profilePointCount; i++) {
    const angle = (i / profilePointCount) * Math.PI * 2
    const spikeBoost = Math.random() > 0.72 ? 0.28 + Math.random() * 0.34 : 0
    effect.splatProfile.push({
      angle,
      radius: size * (0.4 + Math.random() * 0.36 + spikeBoost),
    })
  }

  const rayCount = 8 + Math.floor(Math.random() * 7)
  for (let i = 0; i < rayCount; i++) {
    const angle = Math.random() * Math.PI * 2
    effect.splatRays.push({
      angle,
      length: size * (0.55 + Math.random() * 1.25),
      width: size * (0.05 + Math.random() * 0.09),
      bend: (Math.random() - 0.5) * size * 0.18,
      alpha: 0.48 + Math.random() * 0.28,
    })
  }

  const dropCount = 10 + Math.floor(Math.random() * 8)
  for (let i = 0; i < dropCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const distance = size * (0.6 + Math.random() * 1.5)
    effect.splashDrops.push({
      offsetX: Math.cos(angle) * distance,
      offsetY: Math.sin(angle) * distance * 0.72 + size * 0.18,
      radius: size * (0.05 + Math.random() * 0.12),
      stretch: 0.8 + Math.random() * 1.8,
      rotation: angle + (Math.random() - 0.5) * 0.8,
      alpha: 0.45 + Math.random() * 0.4,
    })
  }

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 2.4 + Math.random() * 5.8
    const lifetime = 380 + Math.random() * 780
    effect.particles.push({
      x,
      y,
      size: 3 + Math.random() * Math.max(4, size * 0.18),
      velocityX: sourceVelocityX * 0.18 + Math.cos(angle) * speed,
      velocityY: sourceVelocityY * 0.18 + Math.sin(angle) * speed - 0.7 - Math.random() * 2.1,
      gravity: 0.16 + Math.random() * 0.07,
      drag: 0.96 + Math.random() * 0.015,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.24,
      width: 1.8 + Math.random() * Math.max(2.4, size * 0.1),
      length: 5 + Math.random() * Math.max(6, size * 0.34),
      lifetime,
      maxLifetime: lifetime,
      color: getBloodParticleColor(),
    })
  }

  gameState.deathEffects.push(effect)
}

export function drawAndUpdateDeathEffects() {
  if (!gameState.deathEffects || gameState.deathEffects.length === 0) {
    return
  }

  const { camera, ctx, canvas } = gameState
  const now = Date.now()

  for (let i = gameState.deathEffects.length - 1; i >= 0; i--) {
    const effect = gameState.deathEffects[i]
    const elapsed = now - effect.createdAt
    const delta = Math.min(now - effect.lastUpdatedAt, 34)
    effect.lastUpdatedAt = now

    const screenX = effect.x - camera.x
    const screenY = effect.y - camera.y
    const poolProgress = Math.min(elapsed / BLOOD_POOL_SETTLE_DURATION, 1)
    const fade = Math.max(0, 1 - elapsed / effect.duration)
    const poolRadiusX = effect.size * (0.9 + poolProgress * 0.8)
    const poolRadiusY = effect.size * (0.45 + poolProgress * 0.34)

    if (
      screenX > -poolRadiusX * 2 &&
      screenX < canvas.width + poolRadiusX * 2 &&
      screenY > -poolRadiusY * 3 &&
      screenY < canvas.height + poolRadiusY * 3
    ) {
      ctx.save()
      ctx.translate(screenX, screenY + effect.size * 0.14)

      ctx.globalAlpha = 0.92 * fade
      ctx.fillStyle = "rgba(92, 6, 16, 0.98)"
      drawIrregularSplatPath(ctx, effect.splatProfile, 0.42 + poolProgress * 0.9, 0.3 + poolProgress * 0.56)
      ctx.fill()

      for (const ray of effect.splatRays) {
        ctx.save()
        ctx.rotate(ray.angle)
        ctx.globalAlpha = ray.alpha * fade
        ctx.beginPath()
        ctx.moveTo(-ray.width * 0.5, 0)
        ctx.quadraticCurveTo(ray.width * 0.4, -ray.length * 0.32, ray.bend, -ray.length * (0.55 + poolProgress * 0.28))
        ctx.quadraticCurveTo(ray.width * 0.36, -ray.length * (0.88 + poolProgress * 0.14), 0, -ray.length * (1.08 + poolProgress * 0.16))
        ctx.quadraticCurveTo(-ray.width * 0.44, -ray.length * (0.88 + poolProgress * 0.14), -ray.bend, -ray.length * (0.55 + poolProgress * 0.28))
        ctx.quadraticCurveTo(-ray.width * 0.42, -ray.length * 0.24, -ray.width * 0.5, 0)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      ctx.globalAlpha = 0.28 * fade
      ctx.fillStyle = "rgba(218, 54, 68, 0.96)"
      drawIrregularSplatPath(ctx, effect.splatProfile, 0.22 + poolProgress * 0.38, 0.16 + poolProgress * 0.24)
      ctx.fill()

      for (const drop of effect.splashDrops) {
        ctx.save()
        ctx.translate(drop.offsetX * (0.2 + poolProgress * 0.8), drop.offsetY)
        ctx.rotate(drop.rotation)
        ctx.globalAlpha = drop.alpha * fade
        drawDropletPath(ctx, drop.radius * (0.75 + poolProgress * 0.35), drop.radius * drop.stretch * (1 + poolProgress * 0.22))
        ctx.fill()
        ctx.restore()
      }

      ctx.restore()
    }

    const stepScale = delta / PARTICLE_BASE_STEP
    for (let particleIndex = effect.particles.length - 1; particleIndex >= 0; particleIndex--) {
      const particle = effect.particles[particleIndex]
      particle.x += particle.velocityX * stepScale
      particle.y += particle.velocityY * stepScale
      particle.velocityY += particle.gravity * stepScale
      particle.velocityX *= particle.drag
      particle.velocityY *= particle.drag
      particle.rotation += particle.rotationSpeed * stepScale
      particle.lifetime -= delta

      if (particle.lifetime <= 0) {
        effect.particles.splice(particleIndex, 1)
        continue
      }

      const particleX = particle.x - camera.x
      const particleY = particle.y - camera.y
      if (
        particleX < -particle.size * 4 ||
        particleX > canvas.width + particle.size * 4 ||
        particleY < -particle.size * 4 ||
        particleY > canvas.height + particle.size * 4
      ) {
        continue
      }

      const particleFade = particle.lifetime / particle.maxLifetime
      ctx.save()
      ctx.translate(particleX, particleY)
      ctx.rotate(particle.rotation)
      ctx.globalAlpha = particleFade * 0.95
      ctx.fillStyle = particle.color
      drawDropletPath(ctx, particle.width, particle.length)
      ctx.fill()

      ctx.globalAlpha = particleFade * 0.28
      ctx.fillStyle = "rgba(255, 110, 120, 0.7)"
      drawDropletPath(ctx, particle.width * 0.34, particle.length * 0.44)
      ctx.fill()
      ctx.restore()
    }

    if (elapsed >= effect.duration && effect.particles.length === 0) {
      gameState.deathEffects.splice(i, 1)
    }
  }
}

export { DEATH_EFFECT_DURATION }