// Rock entity
import { gameState } from "../core/game-state.js"
import { ROCK_SIZE, TILE_SIZE, WOODEN_BOX_SNAP_DISTANCE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { isPlayerPositionClear, movePlayerToNearestSafePosition } from "../utils/player-position-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { createSnapEffect } from "../entities/wooden-boxes.js"
import { isSpawnPositionClear } from "../utils/spawn-utils.js"

const HAMMER_ROCK_SIZE_SCALE = 0.88
const TILE_SEARCH_RADIUS = 6
const OBJECT_SNAP_GAP = 2

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

    const validPosition = isSpawnPositionClear(rock.x, rock.y, rock.size, {
      requireLand: true,
      playerDistanceBuffer: 100,
    })

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

      if (gameState.hasSledgehammer && gameState.selectedTool === "sledgehammer") {
        rock.isHammerShaped = true
        rock.rotation = 0
        rock.size = TILE_SIZE / HAMMER_ROCK_SIZE_SCALE
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

    settleRockOnLand(grabbedRock, rocks, woodenBoxes)

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
    const snappedPosition = findAdjacentTileSnapPositionForRock(rock, closestObject, allRocks, allBoxes)
    if (!snappedPosition) {
      return
    }

    const newX = snappedPosition.x
    const newY = snappedPosition.y

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

function settleRockOnLand(rock, allRocks, allBoxes) {
  if (!rock) {
    return
  }

  snapRockToNearestTileCenter(rock)
  if (rock.isHammerShaped) {
    rock.rotation = 0
  }

  if (isRockOverlappingAnyObject(rock, allRocks, allBoxes)) {
    moveRockToNearestFreeTile(rock, allRocks, allBoxes)
  }

  checkForRockSnapping(rock, allRocks, allBoxes)

  if (isRockOverlappingAnyObject(rock, allRocks, allBoxes)) {
    moveRockToNearestFreeTile(rock, allRocks, allBoxes)
  }
}

function snapRockToNearestTileCenter(rock) {
  const { terrain } = gameState
  if (!terrain || terrain.length === 0 || terrain[0].length === 0) {
    return
  }

  const tileX = Math.round((rock.x - TILE_SIZE / 2) / TILE_SIZE)
  const tileY = Math.round((rock.y - TILE_SIZE / 2) / TILE_SIZE)

  rock.x = tileX * TILE_SIZE + TILE_SIZE / 2
  rock.y = tileY * TILE_SIZE + TILE_SIZE / 2
  clampRockToWorld(rock)
}

function clampRockToWorld(rock) {
  const { terrain } = gameState
  if (!terrain || terrain.length === 0 || terrain[0].length === 0) {
    return
  }

  const minX = rock.size
  const minY = rock.size
  const maxX = terrain[0].length * TILE_SIZE - rock.size
  const maxY = terrain.length * TILE_SIZE - rock.size

  rock.x = Math.max(minX, Math.min(maxX, rock.x))
  rock.y = Math.max(minY, Math.min(maxY, rock.y))
}

function isTileAvailableForRock(tileX, tileY, rock, allRocks, allBoxes) {
  const { terrain } = gameState
  if (!terrain || tileY < 0 || tileY >= terrain.length || tileX < 0 || tileX >= terrain[0].length) {
    return false
  }

  if (terrain[tileY][tileX] === 0) {
    return false
  }

  const candidateX = tileX * TILE_SIZE + TILE_SIZE / 2
  const candidateY = tileY * TILE_SIZE + TILE_SIZE / 2
  return !isRockOverlappingAnyObjectAt(candidateX, candidateY, rock, allRocks, allBoxes)
}

function isRockOverlappingAnyObject(rock, allRocks, allBoxes) {
  return isRockOverlappingAnyObjectAt(rock.x, rock.y, rock, allRocks, allBoxes)
}

function isRockOverlappingAnyObjectAt(x, y, rock, allRocks, allBoxes) {
  const candidateTile = getSnappedTileCoords(x, y)
  const movingIsGridWall = Boolean(rock.isHammerShaped)
  const movingHalfSize = movingIsGridWall ? TILE_SIZE * 0.5 : rock.size * 0.95

  for (const otherRock of allRocks) {
    if (!otherRock || otherRock === rock) {
      continue
    }

    const otherIsGridWall = Boolean(otherRock.isHammerShaped)

    if (movingIsGridWall && otherIsGridWall) {
      const otherTile = getSnappedTileCoords(otherRock.x, otherRock.y)
      if (otherTile.tileX === candidateTile.tileX && otherTile.tileY === candidateTile.tileY) {
        return true
      }
      continue
    }

    const otherHalfSize = otherIsGridWall ? TILE_SIZE * 0.5 : otherRock.size * 0.95
    const minDistance = movingHalfSize + otherHalfSize + OBJECT_SNAP_GAP
    if (getDistance(x, y, otherRock.x, otherRock.y) < minDistance) {
      return true
    }
  }

  for (const box of allBoxes) {
    if (!box || box === gameState.grabbedWoodenBox || box.isBeingThrown || box.isFloating) {
      continue
    }

    const boxIsGridWall = Boolean(box.isSledgeCube || box.isSledgeSpiked)

    if (movingIsGridWall && boxIsGridWall) {
      const boxTile = getSnappedTileCoords(box.x, box.y)
      if (boxTile.tileX === candidateTile.tileX && boxTile.tileY === candidateTile.tileY) {
        return true
      }
      continue
    }

    const boxHalfSize = boxIsGridWall ? TILE_SIZE * 0.5 : box.size * 0.95
    const minDistance = movingHalfSize + boxHalfSize + OBJECT_SNAP_GAP
    if (getDistance(x, y, box.x, box.y) < minDistance) {
      return true
    }
  }

  return false
}

function getSnappedTileCoords(x, y) {
  return {
    tileX: Math.round((x - TILE_SIZE / 2) / TILE_SIZE),
    tileY: Math.round((y - TILE_SIZE / 2) / TILE_SIZE),
  }
}

function moveRockToNearestFreeTile(rock, allRocks, allBoxes) {
  const baseTileX = Math.round((rock.x - TILE_SIZE / 2) / TILE_SIZE)
  const baseTileY = Math.round((rock.y - TILE_SIZE / 2) / TILE_SIZE)

  let bestCandidate = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let radius = 0; radius <= TILE_SEARCH_RADIUS; radius++) {
    for (let tileY = baseTileY - radius; tileY <= baseTileY + radius; tileY++) {
      for (let tileX = baseTileX - radius; tileX <= baseTileX + radius; tileX++) {
        if (radius > 0 && Math.max(Math.abs(tileX - baseTileX), Math.abs(tileY - baseTileY)) !== radius) {
          continue
        }

        if (!isTileAvailableForRock(tileX, tileY, rock, allRocks, allBoxes)) {
          continue
        }

        const candidateX = tileX * TILE_SIZE + TILE_SIZE / 2
        const candidateY = tileY * TILE_SIZE + TILE_SIZE / 2
        const distance = getDistance(rock.x, rock.y, candidateX, candidateY)

        if (distance < bestDistance) {
          bestDistance = distance
          bestCandidate = { x: candidateX, y: candidateY }
        }
      }
    }

    if (bestCandidate) {
      break
    }
  }

  if (bestCandidate) {
    rock.x = bestCandidate.x
    rock.y = bestCandidate.y
    clampRockToWorld(rock)
  }
}

function findAdjacentTileSnapPositionForRock(rock, anchorObject, allRocks, allBoxes) {
  if (!rock || !anchorObject) {
    return null
  }

  const rockIsGridWall = Boolean(rock.isHammerShaped)
  const anchorIsGridWall = Boolean(anchorObject.isHammerShaped || anchorObject.isSledgeCube || anchorObject.isSledgeSpiked)

  if (!rockIsGridWall || !anchorIsGridWall) {
    const movingHalfSize = rockIsGridWall ? TILE_SIZE * 0.5 : rock.size * 0.95
    const anchorHalfSize = anchorIsGridWall ? TILE_SIZE * 0.5 : (anchorObject.size || TILE_SIZE * 0.5) * 0.95
    const snapDistance = movingHalfSize + anchorHalfSize + OBJECT_SNAP_GAP

    const candidates = [
      { x: anchorObject.x + snapDistance, y: anchorObject.y },
      { x: anchorObject.x - snapDistance, y: anchorObject.y },
      { x: anchorObject.x, y: anchorObject.y + snapDistance },
      { x: anchorObject.x, y: anchorObject.y - snapDistance },
    ]

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (const candidate of candidates) {
      if (!canPlaceRockAtPosition(candidate.x, candidate.y, rock, allRocks, allBoxes)) {
        continue
      }

      const distance = getDistance(rock.x, rock.y, candidate.x, candidate.y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }

    return best
  }

  const anchorTileX = Math.round((anchorObject.x - TILE_SIZE / 2) / TILE_SIZE)
  const anchorTileY = Math.round((anchorObject.y - TILE_SIZE / 2) / TILE_SIZE)

  const candidates = [
    { tileX: anchorTileX + 1, tileY: anchorTileY },
    { tileX: anchorTileX - 1, tileY: anchorTileY },
    { tileX: anchorTileX, tileY: anchorTileY + 1 },
    { tileX: anchorTileX, tileY: anchorTileY - 1 },
  ]

  let best = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (!isTileAvailableForRock(candidate.tileX, candidate.tileY, rock, allRocks, allBoxes)) {
      continue
    }

    const x = candidate.tileX * TILE_SIZE + TILE_SIZE / 2
    const y = candidate.tileY * TILE_SIZE + TILE_SIZE / 2
    const distance = getDistance(rock.x, rock.y, x, y)

    if (distance < bestDistance) {
      bestDistance = distance
      best = { x, y }
    }
  }

  return best
}

function canPlaceRockAtPosition(x, y, rock, allRocks, allBoxes) {
  const { terrain } = gameState
  if (!terrain || terrain.length === 0 || terrain[0].length === 0) {
    return false
  }

  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)

  if (tileY < 0 || tileY >= terrain.length || tileX < 0 || tileX >= terrain[0].length) {
    return false
  }

  if (terrain[tileY][tileX] === 0) {
    return false
  }

  return !isRockOverlappingAnyObjectAt(x, y, rock, allRocks, allBoxes)
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

    drawRockModuleOuterEdges(ctx, rock, halfBlockSize)
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

  // Speckles are generated once per rock and cached, otherwise they would be
  // re-randomized every frame and appear to boil/flicker.
  if (!rock.speckles) {
    rock.speckles = []
    for (let j = 0; j < 5; j++) {
      const detailX = (Math.random() - 0.5) * rock.size
      const detailY = (Math.random() - 0.5) * rock.size
      const detailSize = 2 + Math.random() * 5

      if (detailX * detailX + detailY * detailY < rock.size * 0.7 * (rock.size * 0.7)) {
        rock.speckles.push({ x: detailX, y: detailY, size: detailSize })
      }
    }
  }

  ctx.fillStyle = "#6c7a7a"
  for (const speckle of rock.speckles) {
    ctx.beginPath()
    ctx.arc(speckle.x, speckle.y, speckle.size, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = "#95a5a6"
  ctx.beginPath()
  ctx.arc(-rock.size * 0.3, -rock.size * 0.3, rock.size * 0.2, 0, Math.PI * 2)
  ctx.fill()
}

function drawRockModuleOuterEdges(ctx, rock, halfSize) {
  const neighbors = getWallModuleNeighborMaskForRock(rock)

  ctx.save()
  ctx.strokeStyle = "rgba(36, 44, 48, 0.58)"
  ctx.lineWidth = 1

  if (!neighbors.top) {
    ctx.beginPath()
    ctx.moveTo(-halfSize, -halfSize)
    ctx.lineTo(halfSize, -halfSize)
    ctx.stroke()
  }

  if (!neighbors.right) {
    ctx.beginPath()
    ctx.moveTo(halfSize, -halfSize)
    ctx.lineTo(halfSize, halfSize)
    ctx.stroke()
  }

  if (!neighbors.bottom) {
    ctx.beginPath()
    ctx.moveTo(-halfSize, halfSize)
    ctx.lineTo(halfSize, halfSize)
    ctx.stroke()
  }

  if (!neighbors.left) {
    ctx.beginPath()
    ctx.moveTo(-halfSize, -halfSize)
    ctx.lineTo(-halfSize, halfSize)
    ctx.stroke()
  }

  ctx.restore()
}

function getWallModuleNeighborMaskForRock(rock) {
  const { tileX, tileY } = getSnappedTileCoords(rock.x, rock.y)

  return {
    top: isWallModuleAtTile(tileX, tileY - 1, rock),
    right: isWallModuleAtTile(tileX + 1, tileY, rock),
    bottom: isWallModuleAtTile(tileX, tileY + 1, rock),
    left: isWallModuleAtTile(tileX - 1, tileY, rock),
  }
}

function isWallModuleAtTile(tileX, tileY, selfObject) {
  for (const rock of gameState.rocks || []) {
    if (!rock || rock === selfObject || !rock.isHammerShaped) {
      continue
    }

    const tile = getSnappedTileCoords(rock.x, rock.y)
    if (tile.tileX === tileX && tile.tileY === tileY) {
      return true
    }
  }

  for (const box of gameState.woodenBoxes || []) {
    if (!box || box === selfObject || box.isBeingThrown || box.isFloating || !(box.isSledgeCube || box.isSledgeSpiked)) {
      continue
    }

    const tile = getSnappedTileCoords(box.x, box.y)
    if (tile.tileX === tileX && tile.tileY === tileY) {
      return true
    }
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

      if (rock.isHammerShaped) {
        // Skip shadow for tile wall modules so blocks visually touch.
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
    // Skip shadow for tile wall modules so placement preview matches final contact.
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