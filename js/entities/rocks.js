// Rock entity
import { gameState } from "../core/game-state.js"
import { ROCK_SIZE, TILE_SIZE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"

// Generate rocks
export function generateRocks(count) {
  const { terrain, rocks, bombs, apples, enemies, player } = gameState

  for (let i = 0; i < count; i++) {
    const rock = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
      size: ROCK_SIZE,
      texture: Math.floor(Math.random() * 3), // 0, 1, or 2 for different rock textures
      rotation: Math.random() * Math.PI * 2, // Random rotation for variety
    }

    // Ensure rock is not on water and not overlapping with other objects
    const tileX = Math.floor(rock.x / TILE_SIZE)
    const tileY = Math.floor(rock.y / TILE_SIZE)

    let validPosition = false
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== 0 // TERRAIN_TYPES.WATER
    ) {
      // Check for overlap with other rocks
      validPosition = true
      for (const otherRock of rocks) {
        if (getDistance(rock.x, rock.y, otherRock.x, otherRock.y) < rock.size + otherRock.size) {
          validPosition = false
          break
        }
      }

      // Check for overlap with bombs
      if (validPosition) {
        for (const bomb of bombs) {
          if (getDistance(rock.x, rock.y, bomb.x, bomb.y) < rock.size + bomb.size) {
            validPosition = false
            break
          }
        }
      }

      // Check for overlap with apples
      if (validPosition) {
        for (const apple of apples) {
          if (getDistance(rock.x, rock.y, apple.x, apple.y) < rock.size + apple.size * 2) {
            validPosition = false
            break
          }
        }
      }

      // Check for overlap with enemies
      if (validPosition) {
        for (const enemy of enemies) {
          if (getDistance(rock.x, rock.y, enemy.x, enemy.y) < rock.size + enemy.size * 2) {
            validPosition = false
            break
          }
        }
      }

      // Check if too close to player
      if (validPosition) {
        if (getDistance(rock.x, rock.y, player.x, player.y) < rock.size + player.size + 100) {
          validPosition = false
        }
      }
    } else {
      validPosition = false
    }

    if (validPosition) {
      rocks.push(rock)
    } else {
      i-- // Try again
    }
  }
}

// Try to grab a rock
export function tryGrabRock() {
  const { player, rocks } = gameState

  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i]
    const distance = getDistance(player.x, player.y, rock.x, rock.y)

    if (distance < player.size + rock.size) {
      gameState.isGrabbing = true
      gameState.grabbedRock = rock
      rocks.splice(i, 1) // Remove from rocks array
      return true
    }
  }
  return false
}

// Release a grabbed rock
export function releaseRock() {
  const { player, grabbedRock, rocks } = gameState

  if (grabbedRock) {
    // Calculate position in front of player based on facing direction
    const throwDistance = player.size * 3.5 // Half a player size away
    const newX = player.x + Math.cos(player.direction) * throwDistance
    const newY = player.y + Math.sin(player.direction) * throwDistance

    // Update rock position before releasing
    grabbedRock.x = newX
    grabbedRock.y = newY

    rocks.push(grabbedRock)
    gameState.grabbedRock = null
    gameState.isGrabbing = false
    return true
  }
  return false
}

// Modify the drawAndUpdateRocks function to use normal shadow scale
export function drawAndUpdateRocks() {
  try {
    const { rocks, camera, ctx } = gameState

    for (let i = 0; i < rocks.length; i++) {
      const rock = rocks[i]
      if (!rock) continue // Skip if rock is undefined

      const screenX = rock.x - camera.x
      const screenY = rock.y - camera.y

      // Skip if rock is off-screen
      if (
        screenX < -rock.size ||
        screenX > ctx.canvas.width + rock.size ||
        screenY < -rock.size ||
        screenY > ctx.canvas.height + rock.size
      ) {
        continue
      }

      // Draw shadow using shape-specific shadow with normal scale (1.0)
      if (rock.texture === 0) {
        // Rounded rock shadow
        createShadow(ctx, screenX, screenY, rock.size, "circle", null, 0, 1.0)
      } else if (rock.texture === 1) {
        // Angular rock shadow
        createShadow(ctx, screenX, screenY, rock.size, "polygon", null, rock.rotation, 1.0)
      } else {
        // Oval rock shadow
        createShadow(ctx, screenX, screenY, rock.size, "oval", null, rock.rotation, 1.0)
      }

      // Draw rock
      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.rotate(rock.rotation)

      // Base rock shape
      ctx.fillStyle = "#7f8c8d" // Base rock color
      ctx.beginPath()

      // Different rock shapes based on texture
      if (rock.texture === 0) {
        // Rounded rock
        ctx.arc(0, 0, rock.size * 0.8, 0, Math.PI * 2)
      } else if (rock.texture === 1) {
        // Angular rock
        ctx.beginPath()
        for (let j = 0; j < 7; j++) {
          const angle = (j * Math.PI * 2) / 7
          const radius = rock.size * (0.7 + Math.sin(j * 5) * 0.1)
          if (j === 0) {
            ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
          } else {
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
          }
        }
        ctx.closePath()
      } else {
        // Oval rock
        ctx.ellipse(0, 0, rock.size * 0.85, rock.size * 0.65, 0, 0, Math.PI * 2)
      }
      ctx.fill()

      // Add texture details
      ctx.fillStyle = "#6c7a7a" // Darker color for details
      for (let j = 0; j < 5; j++) {
        const detailX = (Math.random() - 0.5) * rock.size
        const detailY = (Math.random() - 0.5) * rock.size
        const detailSize = 2 + Math.random() * 5

        // Only draw details inside the rock
        if (detailX * detailX + detailY * detailY < rock.size * 0.7 * (rock.size * 0.7)) {
          ctx.beginPath()
          ctx.arc(detailX, detailY, detailSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Add highlights
      ctx.fillStyle = "#95a5a6" // Lighter color for highlights
      ctx.beginPath()
      ctx.arc(-rock.size * 0.3, -rock.size * 0.3, rock.size * 0.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }
  } catch (error) {
    console.error("Error in drawAndUpdateRocks:", error)
  }
}
