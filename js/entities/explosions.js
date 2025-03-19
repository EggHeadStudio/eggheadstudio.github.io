// Explosion entity
import { gameState } from "../core/game-state.js"
import { modifyTerrainInRadius } from "../terrain/terrain-modifier.js"
import { getDistance } from "../utils/math-utils.js"
import { getExplosionParticleColor } from "../utils/color-utils.js"
import { checkBombChainReaction } from "./bombs.js"

// Create explosion
export function createExplosion(x, y, radius) {
  const { explosions, enemies, player, bombs } = gameState

  // Create explosion object with larger radius
  const explosionRadius = radius * 2 + Math.random() * 100 // Much larger and more random radius

  const explosion = {
    x: x,
    y: y,
    radius: explosionRadius,
    maxRadius: explosionRadius,
    currentRadius: 0,
    particles: [],
    startTime: Date.now(),
    duration: 1000, // 1 second explosion animation
    color: "#ff9500",
  }

  // Create explosion particles
  const particleCount = 50 // More particles for bigger explosion
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 5 // Faster particles
    const size = 5 + Math.random() * 15 // Larger particles
    const life = 500 + Math.random() * 800 // Longer life

    explosion.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: size,
      life: life,
      maxLife: life,
      color: getExplosionParticleColor(),
    })
  }

  explosions.push(explosion)

  // Modify terrain in explosion radius
  modifyTerrainInRadius(x, y, explosionRadius)

  // Check for enemies in explosion radius
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i]
    const distance = getDistance(x, y, enemy.x, enemy.y)

    if (distance < explosionRadius) {
      enemies.splice(i, 1)
    }
  }

  // Check if player is in explosion radius
  const distanceToPlayer = getDistance(x, y, player.x, player.y)
  if (distanceToPlayer < explosionRadius) {
    player.health = 0
    updateHealthDisplay()
    gameState.gameOver = true
    document.getElementById("gameOver").classList.add("active")
  }

  // Check for chain reaction with other bombs
  // This is now handled in the bombs.js file
  checkBombChainReaction(x, y, explosionRadius)
}

// Draw and update explosions
export function drawAndUpdateExplosions() {
  const { explosions, camera, ctx, canvas } = gameState

  for (let i = explosions.length - 1; i >= 0; i--) {
    const explosion = explosions[i]
    const timeSinceStart = Date.now() - explosion.startTime

    // Update explosion radius
    if (timeSinceStart < explosion.duration) {
      explosion.currentRadius = (timeSinceStart / explosion.duration) * explosion.maxRadius
    } else {
      explosions.splice(i, 1)
      continue
    }

    // Draw explosion particles
    for (let j = 0; j < explosion.particles.length; j++) {
      const particle = explosion.particles[j]

      // Update particle position
      particle.x += particle.vx
      particle.y += particle.vy
      particle.life -= 16 // Reduce life based on frame rate

      // Skip if particle is dead
      if (particle.life <= 0) {
        explosion.particles.splice(j, 1)
        j--
        continue
      }

      const screenX = particle.x - camera.x
      const screenY = particle.y - camera.y

      // Skip if particle is off-screen
      if (
        screenX < -particle.size ||
        screenX > canvas.width + particle.size ||
        screenY < -particle.size ||
        screenY > canvas.height + particle.size
      ) {
        continue
      }

      // Draw particle
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// Import updateHealthDisplay after using it to avoid circular dependency
import { updateHealthDisplay } from "../ui/ui-manager.js"
