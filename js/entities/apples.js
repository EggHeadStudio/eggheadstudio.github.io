// Apple entity
import { gameState } from "../core/game-state.js"
import { APPLE_SIZE, TILE_SIZE, APPLE_THROW_SPEED } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { updateAppleCounter } from "../ui/ui-manager.js"

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

// Throw an apple
export function throwApple() {
  const { player, isMobile, mousePosition, canvas, thrownApples } = gameState

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

    // Set the throwing animation state
    player.throwingApple = Date.now()

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
  const { thrownApples, gameOver, camera, ctx, canvas, enemies, bombs } = gameState

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

    // Check for collisions with enemies
    for (let j = 0; j < enemies.length; j++) {
      const enemy = enemies[j]
      const distance = getDistance(apple.x, apple.y, enemy.x, enemy.y)

      if (distance < apple.size + enemy.size) {
        // Remove enemy and apple
        enemies.splice(j, 1)
        thrownApples.splice(i, 1)
        i--
        break
      }
    }

    // Check for collisions with bombs
    for (let j = 0; j < bombs.length; j++) {
      const bomb = bombs[j]
      const distance = getDistance(apple.x, apple.y, bomb.x, bomb.y)

      if (distance < apple.size + bomb.size) {
        // Remove apple
        thrownApples.splice(i, 1)
        i--
        break
      }
    }
  }
}
