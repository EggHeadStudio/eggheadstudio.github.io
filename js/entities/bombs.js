// Bomb entity
import { gameState } from "../core/game-state.js"
import { BOMB_SIZE, TILE_SIZE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow, roundRect } from "../utils/rendering-utils.js"
import { createExplosion } from "./explosions.js"
import { getRandomColor } from "../utils/color-utils.js"

// Generate bombs
export function generateBombs(count) {
  const { terrain, bombs } = gameState

  for (let i = 0; i < count; i++) {
    const bomb = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
      size: BOMB_SIZE,
      color: getRandomColor(),
      countdown: null,
      exploding: false,
    }

    // Ensure bomb is not on water
    const tileX = Math.floor(bomb.x / TILE_SIZE)
    const tileY = Math.floor(bomb.y / TILE_SIZE)
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== 0 // TERRAIN_TYPES.WATER
    ) {
      bombs.push(bomb)
    } else {
      i-- // Try again
    }
  }
}

// Try to grab a bomb
export function tryGrabBomb() {
  const { player, bombs } = gameState

  for (let i = 0; i < bombs.length; i++) {
    const bomb = bombs[i]

    // Skip bombs that are counting down
    if (bomb.countdown !== null) continue

    const distance = getDistance(player.x, player.y, bomb.x, bomb.y)

    if (distance < player.size + bomb.size) {
      gameState.isGrabbing = true
      gameState.grabbedBomb = bomb
      bombs.splice(i, 1) // Remove from bombs array
      return true
    }
  }
  return false
}

// Detonate any bomb that has a countdown
export function detonateAnyBombWithCountdown() {
  const { bombs } = gameState

  for (let i = 0; i < bombs.length; i++) {
    const bomb = bombs[i]

    // Only consider bombs that are counting down
    if (bomb.countdown !== null) {
      // Detonate the bomb immediately
      const explosionRadius = 100 + Math.random() * 50
      createExplosion(bomb.x, bomb.y, explosionRadius)

      // Store the bomb position before removing it
      const bombX = bomb.x
      const bombY = bomb.y

      // Remove the bomb from the array
      bombs.splice(i, 1)

      // Check for chain reaction with other bombs
      // Use setTimeout to ensure this runs after the current function completes
      setTimeout(() => {
        checkBombChainReaction(bombX, bombY, explosionRadius)
      }, 0)

      return true
    }
  }
  return false
}

// Check for chain reaction with other bombs
export function checkBombChainReaction(explosionX, explosionY, explosionRadius) {
  const { bombs } = gameState

  // Create a copy of the bombs array to safely modify the original during iteration
  const bombsToCheck = [...bombs]

  // Track bombs that will be detonated in the chain reaction
  const bombsToDetonate = []

  // Check each bomb to see if it's in the explosion radius
  for (let i = 0; i < bombsToCheck.length; i++) {
    const bomb = bombsToCheck[i]

    // Skip the bomb if it's already counting down
    if (bomb.countdown !== null) continue

    // Calculate distance from explosion center to this bomb
    const distance = getDistance(explosionX, explosionY, bomb.x, bomb.y)

    // If bomb is within explosion radius, add it to detonation list
    if (distance < explosionRadius + bomb.size) {
      // Find the index in the original bombs array
      const bombIndex = bombs.indexOf(bomb)
      if (bombIndex !== -1) {
        bombsToDetonate.push({
          bomb: bomb,
          index: bombIndex,
          // Add a small random delay for more natural chain reaction
          delay: Math.random() * 200 + 50,
        })
      }
    }
  }

  // Detonate each affected bomb with a slight delay
  bombsToDetonate.forEach((bombData) => {
    setTimeout(() => {
      // Make sure the bomb still exists in the array (it might have been removed by another explosion)
      const currentIndex = bombs.indexOf(bombData.bomb)
      if (currentIndex !== -1) {
        // Create explosion for this bomb
        const chainExplosionRadius = 100 + Math.random() * 50
        createExplosion(bombData.bomb.x, bombData.bomb.y, chainExplosionRadius)

        // Remove the bomb from the array
        bombs.splice(currentIndex, 1)

        // Recursively check for more chain reactions
        checkBombChainReaction(bombData.bomb.x, bombData.bomb.y, chainExplosionRadius)
      }
    }, bombData.delay)
  })
}

// Release a grabbed bomb
export function releaseBomb() {
  const { grabbedBomb, bombs } = gameState

  if (grabbedBomb) {
    // Start countdown when released
    grabbedBomb.countdown = Date.now() + 3000 // 3 seconds
    bombs.push(grabbedBomb)
    gameState.grabbedBomb = null
    gameState.isGrabbing = false
    return true
  }
  return false
}

// Modify the drawAndUpdateBombs function to use normal shadow scale
export function drawAndUpdateBombs() {
  try {
    const { bombs, camera, ctx } = gameState

    for (let i = bombs.length - 1; i >= 0; i--) {
      const bomb = bombs[i]
      if (!bomb) continue // Skip if bomb is undefined

      const screenX = bomb.x - camera.x
      const screenY = bomb.y - camera.y

      // Skip if bomb is off-screen
      if (
        screenX < -bomb.size ||
        screenX > ctx.canvas.width + bomb.size ||
        screenY < -bomb.size ||
        screenY > ctx.canvas.height + bomb.size
      ) {
        // If bomb is counting down but off-screen, still check for explosion
        if (bomb.countdown !== null && Date.now() >= bomb.countdown) {
          const explosionRadius = 100 + Math.random() * 50 // Random radius between 100-150
          createExplosion(bomb.x, bomb.y, explosionRadius)

          // Store the bomb position before removing it
          const bombX = bomb.x
          const bombY = bomb.y

          bombs.splice(i, 1)

          // Check for chain reaction
          setTimeout(() => {
            checkBombChainReaction(bombX, bombY, explosionRadius)
          }, 0)
        }
        continue
      }

      // Draw shadow using shape-specific shadow for rounded rectangle
      // Increase shadow size for better visibility
      // Use normal shadow scale (1.0) for bombs on the ground
      createShadow(
        ctx,
        screenX,
        screenY,
        bomb.size * 1.2,
        "rectangle",
        {
          width: bomb.size,
          height: bomb.size,
          radius: bomb.size / 4,
        },
        0,
        1.0,
      )

      // Check if bomb should explode
      if (bomb.countdown !== null && Date.now() >= bomb.countdown) {
        const explosionRadius = 100 + Math.random() * 50 // Random radius between 100-150
        createExplosion(bomb.x, bomb.y, explosionRadius)

        // Store the bomb position before removing it
        const bombX = bomb.x
        const bombY = bomb.y

        bombs.splice(i, 1)

        // Check for chain reaction
        setTimeout(() => {
          checkBombChainReaction(bombX, bombY, explosionRadius)
        }, 0)

        continue
      }

      // Draw bomb (rounded rectangle with fuse)
      ctx.fillStyle = bomb.color
      roundRect(ctx, screenX - bomb.size / 2, screenY - bomb.size / 2, bomb.size, bomb.size, bomb.size / 4)

      // Draw bomb fuse
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(screenX, screenY - bomb.size / 2)

      // Make fuse wiggle
      const time = Date.now() / 200
      const fuseHeight = bomb.size / 2
      const wiggle = Math.sin(time) * 5

      ctx.bezierCurveTo(
        screenX + wiggle,
        screenY - bomb.size / 2 - fuseHeight / 3,
        screenX - wiggle,
        screenY - bomb.size / 2 - (fuseHeight * 2) / 3,
        screenX,
        screenY - bomb.size / 2 - fuseHeight,
      )
      ctx.stroke()

      // Draw spark on fuse if counting down
      if (bomb.countdown !== null) {
        const countdownProgress = 1 - (bomb.countdown - Date.now()) / 3000
        const sparkY = screenY - bomb.size / 2 - fuseHeight * countdownProgress

        // Draw spark
        ctx.fillStyle = "#ffcc00"
        ctx.beginPath()
        ctx.arc(screenX, sparkY, 4, 0, Math.PI * 2)
        ctx.fill()

        // Draw countdown text
        const secondsLeft = Math.ceil((bomb.countdown - Date.now()) / 1000)
        ctx.fillStyle = "white"
        ctx.font = "16px Arial"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(secondsLeft.toString(), screenX, screenY)

        // Draw pulsing circle around bomb
        const pulseSize = Math.sin(Date.now() / 100) * 5 + 10
        ctx.strokeStyle = "rgba(255, 0, 0, 0.7)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(screenX, screenY, bomb.size / 2 + pulseSize, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  } catch (error) {
    console.error("Error in drawAndUpdateBombs:", error)
  }
}
