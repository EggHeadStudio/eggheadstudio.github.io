// Explosion entity
import { gameState } from "../core/game-state.js"
import { modifyTerrainInRadius } from "../terrain/terrain-modifier.js"
import { getDistance } from "../utils/math-utils.js"
import { getExplosionParticleColor } from "../utils/color-utils.js"
import { checkBombChainReaction } from "./bombs.js"
import { damageWoodenBox } from "./wooden-boxes.js" // Import wooden box damage function
import { incrementKillCount } from "../ui/ui-manager.js"
import { damageCar } from "./cars.js"

// Create explosion
export function createExplosion(x, y, radius) {
  const { explosions, enemies, player, bombs, woodenBoxes } = gameState

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

      // Increment kill count
      incrementKillCount()
    }
  }

  // Check for wooden boxes in explosion radius and destroy them instantly
  for (let i = woodenBoxes.length - 1; i >= 0; i--) {
    const box = woodenBoxes[i]
    const distance = getDistance(x, y, box.x, box.y)

    if (distance < explosionRadius + box.size) {
      // Set hitPoints to 0 to ensure instant destruction and create destruction effect
      box.hitPoints = 0
      damageWoodenBox(box, 3) // Force destruction by dealing full damage
    }
  }

  // Check if player is in explosion radius
  const distanceToPlayer = getDistance(x, y, player.x, player.y)
  if (distanceToPlayer < explosionRadius) {
    player.health = 0
    gameState.gameOver = true
    document.getElementById("gameOver").classList.add("active")
  }

  // Check for chain reaction with other bombs
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

// Apply explosion damage to entities
function applyExplosionDamage(explosion) {
  const { player, enemies, rocks, woodenBoxes, bombs, cars, isInCar, drivingCar } = gameState
  const explosionRadius = explosion.size
  
  // Check player damage
  if (!isInCar) {
    const playerDistance = getDistance(player.x, player.y, explosion.x, explosion.y)
    if (playerDistance < explosionRadius) {
      // Player takes damage if in explosion radius and not in a car
      if (Date.now() - player.lastHit > 1000) {
        player.health--
        player.lastHit = Date.now()
        
        // Game over if health is 0
        if (player.health <= 0) {
          gameState.gameOver = true
        }
      }
    }
  }
  
  // ... rest of the function
}
