// Apple entity
import { gameState } from "../core/game-state.js"
import { APPLE_SIZE, TILE_SIZE, APPLE_THROW_SPEED } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { updateAppleCounter } from "../ui/ui-manager.js"
import { damageWoodenBox } from "../entities/wooden-boxes.js"
import { incrementKillCount } from "../ui/ui-manager.js"

// Generate apples
export function generateApples(count) {
  const { player, terrain, apples } = gameState

  for (let i = 0; i < count; i++) {
    // Generate apples closer to the player's position
    const maxDistance = 1500 // Maximum distance from player
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * maxDistance

    const apple = {
      x: player.x + Math.cos(angle) * distance,
      y: player.y + Math.sin(angle) * distance,
      size: APPLE_SIZE,
      color: "#e74c3c",
    }

    // Ensure apple is not on water
    const tileX = Math.floor(apple.x / TILE_SIZE)
    const tileY = Math.floor(apple.y / TILE_SIZE)
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== 0 // TERRAIN_TYPES.WATER
    ) {
      apples.push(apple)
    } else {
      i-- // Try again
    }
  }
}

// Create apple splash particles
function createAppleSplash(x, y, velocityX, velocityY) {
  if (!gameState.appleSplashes) {
    gameState.appleSplashes = []
  }

  // Create 8-12 apple pieces
  const particleCount = 8 + Math.floor(Math.random() * 5)
  const splash = {
    particles: [],
    createdAt: Date.now(),
  }

  // Base velocity from the thrown apple
  const baseVelX = velocityX * 0.3
  const baseVelY = velocityY * 0.3

  for (let i = 0; i < particleCount; i++) {
    // Random angle for particle dispersion
    const angle = Math.random() * Math.PI * 2
    // Random speed between 1 and 3
    const speed = 1 + Math.random() * 2
    // Random size between 2 and 5
    const size = 2 + Math.random() * 3
    // Random lifetime between 300ms and 800ms
    const lifetime = 300 + Math.random() * 500

    splash.particles.push({
      x: x,
      y: y,
      size: size,
      velocityX: baseVelX + Math.cos(angle) * speed,
      velocityY: baseVelY + Math.sin(angle) * speed,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      lifetime: lifetime,
      maxLifetime: lifetime,
      // Slightly different shades of red for apple pieces
      color: `hsl(${0 + Math.random() * 10}, ${80 + Math.random() * 20}%, ${40 + Math.random() * 20}%)`,
    })
  }

  gameState.appleSplashes.push(splash)
}

// Draw and update apple splash particles
function drawAndUpdateAppleSplashes() {
  if (!gameState.appleSplashes) return

  const { camera, ctx } = gameState

  for (let i = gameState.appleSplashes.length - 1; i >= 0; i--) {
    const splash = gameState.appleSplashes[i]
    const elapsed = Date.now() - splash.createdAt

    // Remove splash if all particles are dead
    if (splash.particles.length === 0) {
      gameState.appleSplashes.splice(i, 1)
      continue
    }

    // Update and draw each particle
    for (let j = splash.particles.length - 1; j >= 0; j--) {
      const particle = splash.particles[j]

      // Update particle position
      particle.x += particle.velocityX
      particle.y += particle.velocityY

      // Apply gravity
      particle.velocityY += 0.1

      // Apply friction
      particle.velocityX *= 0.95
      particle.velocityY *= 0.95

      // Update rotation
      particle.rotation += particle.rotationSpeed

      // Decrease lifetime
      particle.lifetime -= 16 // Roughly 60fps

      // Remove dead particles
      if (particle.lifetime <= 0) {
        splash.particles.splice(j, 1)
        continue
      }

      // Calculate screen position
      const screenX = particle.x - camera.x
      const screenY = particle.y - camera.y

      // Skip if off-screen
      if (
        screenX < -particle.size ||
        screenX > ctx.canvas.width + particle.size ||
        screenY < -particle.size ||
        screenY > ctx.canvas.height + particle.size
      ) {
        continue
      }

      // Calculate opacity based on lifetime
      const opacity = particle.lifetime / particle.maxLifetime

      // Draw particle
      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.rotate(particle.rotation)

      // Draw apple piece (irregular shape)
      ctx.fillStyle = particle.color
      ctx.globalAlpha = opacity

      ctx.beginPath()
      // Draw an irregular apple piece shape
      ctx.moveTo(0, -particle.size)
      ctx.bezierCurveTo(particle.size, -particle.size, particle.size, particle.size, 0, particle.size)
      ctx.bezierCurveTo(-particle.size, particle.size, -particle.size, -particle.size, 0, -particle.size)
      ctx.fill()

      ctx.globalAlpha = 1
      ctx.restore()
    }
  }
}

// Throw an apple
export function throwApple() {
  const { player, isMobile, mousePosition, canvas, thrownApples } = gameState

  // Set the throwing animation state regardless of apple count
  player.throwingApple = Date.now()

  // Only create and throw an apple if the player has apples
  if (player.apples > 0) {
    let angle

    if (isMobile) {
      // Use player's current direction on mobile
      angle = player.direction
    } else {
      // Use mouse position on desktop
      angle = Math.atan2(mousePosition.y - canvas.height / 2, mousePosition.x - canvas.width / 2)
    }

    thrownApples.push({
      x: player.x,
      y: player.y,
      size: APPLE_SIZE,
      color: "#e74c3c",
      velocityX: Math.cos(angle) * APPLE_THROW_SPEED,
      velocityY: Math.sin(angle) * APPLE_THROW_SPEED,
    })

    // Ensure we only decrement the apple count once
    player.apples--
    updateAppleCounter()

    return true
  }

  return false
}

// Draw and update apples
export function drawAndUpdateApples() {
  const { apples, camera, ctx, player, canvas } = gameState

  for (let i = 0; i < apples.length; i++) {
    const apple = apples[i]
    const screenX = apple.x - camera.x
    const screenY = apple.y - camera.y

    // Skip if apple is off-screen
    if (
      screenX < -apple.size ||
      screenX > canvas.width + apple.size ||
      screenY < -apple.size ||
      screenY > canvas.height + apple.size
    ) {
      continue
    }

    // Draw apple shadow using standardized function
    createShadow(ctx, screenX, screenY, apple.size, "circle")

    // Draw apple
    ctx.fillStyle = apple.color
    ctx.beginPath()
    ctx.arc(screenX, screenY, apple.size, 0, Math.PI * 2)
    ctx.fill()

    // Draw stem
    ctx.fillStyle = "#27ae60"
    ctx.fillRect(screenX - 1, screenY - apple.size, 2, apple.size / 2)

    // Check if player collects apple
    const distance = getDistance(player.x, player.y, apple.x, apple.y)
    if (distance < player.size + apple.size) {
      player.apples++
      apples.splice(i, 1)
      i--
      updateAppleCounter()
    }
  }
}

// Draw and update thrown apples
export function drawAndUpdateThrownApples() {
  const { thrownApples, gameOver, camera, ctx, canvas, enemies, bombs, rocks, woodenBoxes } = gameState

  // Draw and update apple splashes first
  drawAndUpdateAppleSplashes()

  for (let i = 0; i < thrownApples.length; i++) {
    const apple = thrownApples[i]

    // Update apple position if game is not over
    if (!gameOver) {
      apple.x += apple.velocityX
      apple.y += apple.velocityY
    }

    const screenX = apple.x - camera.x
    const screenY = apple.y - camera.y

    // Skip if apple is off-screen
    if (
      screenX < -apple.size ||
      screenX > canvas.width + apple.size ||
      screenY < -apple.size ||
      screenY > canvas.height + apple.size
    ) {
      thrownApples.splice(i, 1)
      i--
      continue
    }

    // Draw apple shadow using standardized function
    createShadow(ctx, screenX, screenY, apple.size, "circle")

    // Draw apple
    ctx.fillStyle = apple.color
    ctx.beginPath()
    ctx.arc(screenX, screenY, apple.size, 0, Math.PI * 2)
    ctx.fill()

    // Draw stem
    ctx.fillStyle = "#27ae60"
    ctx.fillRect(screenX - 1, screenY - apple.size, 2, apple.size / 2)

    // Check for collisions with enemies
    let hasCollided = false
    for (let j = 0; j < enemies.length; j++) {
      const enemy = enemies[j]
      const distance = getDistance(apple.x, apple.y, enemy.x, enemy.y)

      if (distance < apple.size + enemy.size) {
        // Create apple splash effect
        createAppleSplash(apple.x, apple.y, apple.velocityX, apple.velocityY)

        // Remove enemy and apple
        enemies.splice(j, 1)
        thrownApples.splice(i, 1)
        i--
        hasCollided = true

        // Increment kill count
        incrementKillCount()

        break
      }
    }

    if (hasCollided) continue

    // Check for collisions with bombs
    for (let j = 0; j < bombs.length; j++) {
      const bomb = bombs[j]
      const distance = getDistance(apple.x, apple.y, bomb.x, bomb.y)

      if (distance < apple.size + bomb.size) {
        // Create apple splash effect
        createAppleSplash(apple.x, apple.y, apple.velocityX, apple.velocityY)

        // Remove apple
        thrownApples.splice(i, 1)
        i--
        hasCollided = true
        break
      }
    }

    if (hasCollided) continue

    // Check for collisions with rocks
    for (let j = 0; j < rocks.length; j++) {
      const rock = rocks[j]
      const distance = getDistance(apple.x, apple.y, rock.x, rock.y)

      if (distance < apple.size + rock.size * 0.8) {
        // Create apple splash effect
        createAppleSplash(apple.x, apple.y, apple.velocityX, apple.velocityY)

        // Remove apple
        thrownApples.splice(i, 1)
        i--
        hasCollided = true
        break
      }
    }

    if (hasCollided) continue

    // Check for collisions with wooden boxes
    if (woodenBoxes) {
      for (let j = 0; j < woodenBoxes.length; j++) {
        const box = woodenBoxes[j]
        const distance = getDistance(apple.x, apple.y, box.x, box.y)

        if (distance < apple.size + box.size * 0.8) {
          // Create apple splash effect
          createAppleSplash(apple.x, apple.y, apple.velocityX, apple.velocityY)

          // Damage the box
          damageWoodenBox(box)

          // Remove apple
          thrownApples.splice(i, 1)
          i--
          hasCollided = true
          break
        }
      }
    }
  }
}
