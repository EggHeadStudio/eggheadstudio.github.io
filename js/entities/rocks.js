// Rock entity
import { gameState } from "../core/game-state.js"
import { ROCK_SIZE, TILE_SIZE, WOODEN_BOX_SNAP_DISTANCE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { isPlayerPositionClear, movePlayerToNearestSafePosition } from "../utils/player-position-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { createSnapEffect } from "../entities/wooden-boxes.js"

const HAMMER_ROCK_SIZE_SCALE = 0.88

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
      snappedTo: null, // Reference to another object this rock is snapped to
      type: "rock", // Identify this as a rock for roof detection
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
      // If rock was snapped to another object, unsnap it
      if (rock.snappedTo) {
        rock.snappedTo = null
      }

      if (gameState.hasSledgehammer) {
        rock.isHammerShaped = true
        rock.rotation = 0
      }

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
  const { player, grabbedRock, rocks, woodenBoxes } = gameState

  if (grabbedRock) {
    const throwDistance = grabbedRock.isHammerShaped ? player.size + grabbedRock.size * 0.8 : player.size * 3.5
    const newX = player.x + Math.cos(player.direction) * throwDistance
    const newY = player.y + Math.sin(player.direction) * throwDistance

    // Update rock position before releasing
    grabbedRock.x = newX
    grabbedRock.y = newY

    // Check for rock snapping to other rocks or boxes
    checkForRockSnapping(grabbedRock, rocks, woodenBoxes)

    rocks.push(grabbedRock)

    if (!isPlayerPositionClear(player.x, player.y)) {
      movePlayerToNearestSafePosition(player.x, player.y, grabbedRock.x, grabbedRock.y)
    }

    gameState.grabbedRock = null
    gameState.isGrabbing = false
    return true
  }
  return false
}

// Check if a rock should snap to another rock or box
function checkForRockSnapping(rock, allRocks, allBoxes) {
  let closestObject = null
  let closestDistance = WOODEN_BOX_SNAP_DISTANCE
  let objectType = null

  // Find the closest rock within snapping distance
  for (const otherRock of allRocks) {
    // Skip self
    if (otherRock === rock) continue

    const distance = getDistance(rock.x, rock.y, otherRock.x, otherRock.y)
    if (distance < closestDistance) {
      closestDistance = distance
      closestObject = otherRock
      objectType = "rock"
    }
  }

  // Also check for nearby boxes
  for (const box of allBoxes) {
    // Skip boxes being carried or thrown or floating
    if (box === gameState.grabbedWoodenBox || box.isBeingThrown || box.isFloating) continue

    const distance = getDistance(rock.x, rock.y, box.x, box.y)
    if (distance < closestDistance) {
      closestDistance = distance
      closestObject = box
      objectType = "box"
    }
  }

  // If found a rock or box to snap to
  if (closestObject) {
    // Calculate the angle between the objects
    const angle = Math.atan2(rock.y - closestObject.y, rock.x - closestObject.x)

    // Round to nearest 90 degrees for edge alignment
    const snapAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2)

    // Calculate new position based on snap angle with reduced gap
    // Use 0.95 multiplier for both objects to make them almost touch
    const rockSnapSize = rock.isHammerShaped ? rock.size * HAMMER_ROCK_SIZE_SCALE : rock.size
    const targetSnapSize = closestObject.isHammerShaped ? closestObject.size * HAMMER_ROCK_SIZE_SCALE : closestObject.size
    const snapDistance = rockSnapSize * 0.95 + targetSnapSize * 0.95

    // Calculate the new position where the rock would snap
    const newX = closestObject.x + Math.cos(snapAngle) * snapDistance
    const newY = closestObject.y + Math.sin(snapAngle) * snapDistance

    // Check if player would get stuck
    const { player } = gameState
    if (player) {
      const distanceToPlayer = getDistance(newX, newY, player.x, player.y)

      // If player is too close to where the rock will snap
      if (distanceToPlayer < player.size + rock.size * 0.7) {
        // Push player away from the snapping area
        const pushAngle = Math.atan2(player.y - newY, player.x - newX)
        const pushDistance = player.size + rock.size * 0.7 - distanceToPlayer + 5 // Add 5px buffer

        // Move player away
        player.x += Math.cos(pushAngle) * pushDistance
        player.y += Math.sin(pushAngle) * pushDistance
      }
    }

    // Set the rock position
    rock.x = newX
    rock.y = newY

    // Store reference to snapped object
    rock.snappedTo = closestObject

    if (rock.isHammerShaped) {
      rock.rotation = 0
    }

    // Create a visual effect
    createSnapEffect(rock, closestObject)
  }
}

function drawRockShape(ctx, rock) {
  ctx.fillStyle = "#7f8c8d"

  if (rock.isHammerShaped) {
    const rockBlockSize = rock.size * HAMMER_ROCK_SIZE_SCALE
    const halfBlockSize = rockBlockSize / 2

    ctx.fillRect(-halfBlockSize, -halfBlockSize, rockBlockSize, rockBlockSize)
    ctx.fillStyle = "#6b7778"
    ctx.fillRect(-rockBlockSize * 0.34, -rockBlockSize * 0.34, rockBlockSize * 0.68, rockBlockSize * 0.16)
    ctx.fillRect(-rockBlockSize * 0.34, -rockBlockSize * 0.06, rockBlockSize * 0.68, rockBlockSize * 0.16)
    ctx.fillStyle = "#9aa8a8"
    ctx.fillRect(-rockBlockSize * 0.4, -rockBlockSize * 0.4, rockBlockSize * 0.26, rockBlockSize * 0.14)
    return
  }

  ctx.beginPath()

  if (rock.texture === 0) {
    ctx.arc(0, 0, rock.size * 0.8, 0, Math.PI * 2)
  } else if (rock.texture === 1) {
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
    ctx.ellipse(0, 0, rock.size * 0.85, rock.size * 0.65, 0, 0, Math.PI * 2)
  }

  ctx.fill()

  ctx.fillStyle = "#6c7a7a"
  for (let j = 0; j < 5; j++) {
    const detailX = (Math.random() - 0.5) * rock.size
    const detailY = (Math.random() - 0.5) * rock.size
    const detailSize = 2 + Math.random() * 5

    if (detailX * detailX + detailY * detailY < rock.size * 0.7 * (rock.size * 0.7)) {
      ctx.beginPath()
      ctx.arc(detailX, detailY, detailSize, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.fillStyle = "#95a5a6"
  ctx.beginPath()
  ctx.arc(-rock.size * 0.3, -rock.size * 0.3, rock.size * 0.2, 0, Math.PI * 2)
  ctx.fill()
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

      if (rock.isHammerShaped) {
        const rockBlockSize = rock.size * HAMMER_ROCK_SIZE_SCALE
        createShadow(ctx, screenX, screenY, rockBlockSize, "rectangle", { width: rockBlockSize, height: rockBlockSize, radius: 4 }, 0, 1.0)
      } else if (rock.texture === 0) {
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

      drawRockShape(ctx, rock)

      ctx.restore()
    }
  } catch (error) {
    console.error("Error in drawAndUpdateRocks:", error)
  }
}

// Draw the grabbed rock
export function drawGrabbedRock() {
  const { grabbedRock, player, camera, ctx } = gameState

  if (!grabbedRock) return

  // Calculate screen position (in front of player)
  const angle = player.direction
  const holdDistance = player.size + grabbedRock.size * 0.7

  const rockX = player.x + Math.cos(angle) * holdDistance
  const rockY = player.y + Math.sin(angle) * holdDistance

  const screenX = rockX - camera.x
  const screenY = rockY - camera.y

  if (grabbedRock.isHammerShaped) {
    const rockBlockSize = grabbedRock.size * HAMMER_ROCK_SIZE_SCALE
    createShadow(ctx, screenX, screenY, rockBlockSize, "rectangle", { width: rockBlockSize, height: rockBlockSize, radius: 4 }, 0, 0.95)
  } else if (grabbedRock.texture === 0) {
    // Rounded rock shadow
    createShadow(ctx, screenX, screenY, grabbedRock.size, "circle", null, 0, 0.95)
  } else if (grabbedRock.texture === 1) {
    // Angular rock shadow
    createShadow(ctx, screenX, screenY, grabbedRock.size, "polygon", null, grabbedRock.rotation, 0.95)
  } else {
    // Oval rock shadow
    createShadow(ctx, screenX, screenY, grabbedRock.size, "oval", null, grabbedRock.rotation, 0.95)
  }

  // Draw rock
  ctx.save()
  ctx.translate(screenX, screenY)
  ctx.rotate(grabbedRock.rotation)

  drawRockShape(ctx, grabbedRock)

  ctx.restore()

  // Draw connection line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  ctx.moveTo(player.x - camera.x, player.y - camera.y)
  ctx.lineTo(screenX, screenY)
  ctx.stroke()
  ctx.setLineDash([])
}