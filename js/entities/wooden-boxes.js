// Wooden box entity
import { gameState } from "../core/game-state.js"
import {
  WOODEN_BOX_SIZE,
  TILE_SIZE,
  WOODEN_BOX_THROW_MULTIPLIER,
  WOODEN_BOX_FLOAT_SPEED,
  WOODEN_BOX_SNAP_DISTANCE,
  MAX_WOODEN_BOXES,
  ROOF_FAR_ALPHA,
  ROOF_NEAR_ALPHA,
  ROOF_UNDER_ALPHA,
  ROOF_FADE_DISTANCE,
  ROOF_EMIT_LIGHT_RADIUS,
  ROOF_EMIT_LIGHT_ALPHA,
  ROOF_PLAYER_LIGHT_RADIUS,
  ROOF_PLAYER_LIGHT_ALPHA,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { isPlayerPositionClear, movePlayerToNearestSafePosition } from "../utils/player-position-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { applyKnockbackToEnemy } from "../entities/enemies.js"
import { isLandPosition, isSpawnPositionClear, isWaterPosition } from "../utils/spawn-utils.js"

// Roof system for wooden boxes and rocks
let roofAreas = [] // Store detected roof areas
let lastRoofDetectionAt = 0

const ROOF_DETECTION_INTERVAL_MS = 90
const ROOF_DETECTION_INTERVAL_MS_LIGHTWEIGHT = 260
const TILE_SEARCH_RADIUS = 6
const OBJECT_SNAP_GAP = 2
const NON_GRID_SNAP_TILE_GAP = 1
const NON_GRID_SNAP_SPAN = TILE_SIZE * (NON_GRID_SNAP_TILE_GAP + 1)
const MIN_PLAYER_SNAP_CLEARANCE = 8

// Generate wooden boxes
export function generateWoodenBoxes(count) {
  const { terrain, woodenBoxes, bombs, apples, enemies, rocks, player } = gameState
  const remainingCapacity = Math.max(0, MAX_WOODEN_BOXES - woodenBoxes.length)

  if (remainingCapacity <= 0) {
    return
  }

  const boxesToSpawn = Math.min(count, remainingCapacity)

  for (let i = 0; i < boxesToSpawn; i++) {
    const woodenBox = createWoodenBox(
      Math.random() * (terrain[0].length * TILE_SIZE),
      Math.random() * (terrain.length * TILE_SIZE),
    )

    // Determine if the box will be placed on land or water
    const tileX = Math.floor(woodenBox.x / TILE_SIZE)
    const tileY = Math.floor(woodenBox.y / TILE_SIZE)

    const validPosition = isSpawnPositionClear(woodenBox.x, woodenBox.y, woodenBox.size, {
      playerDistanceBuffer: 100,
    })

    if (validPosition) {
      // Set floating state if on water
      if (isWaterPosition(woodenBox.x, woodenBox.y)) {
        woodenBox.isFloating = true
        woodenBox.floatAngle = Math.random() * Math.PI * 2
      }

      woodenBoxes.push(woodenBox)
    } else {
      i-- // Try again
    }
  }
}

// Create a new wooden box
function createWoodenBox(x, y) {
  return {
    x: x,
    y: y,
    size: WOODEN_BOX_SIZE,
    hitPoints: 3, // Boxes take 3 hits to destroy
    damageState: 0, // 0 = undamaged, 1 = slightly damaged, 2 = heavily damaged
    rotation: Math.random() * Math.PI * 0.2 - Math.PI * 0.1, // Slight random rotation
    isFloating: false, // Whether the box is floating on water
    floatAngle: 0, // Direction of floating movement
    floatOffset: 0, // Visual float bobbing effect
    isBeingThrown: false,
    throwStartTime: 0,
    throwVelocityX: 0,
    throwVelocityY: 0,
    lastHitTime: 0, // For damage animation
    snappedTo: null, // Reference to another box this box is snapped to
    type: "box", // Identify this as a box for roof detection
  }
}

// Create a trunk left behind by a chopped tree. Trunks live in the wooden box
// array so they inherit all box behaviour (grab, throw, float, damage, snap).
export function createTrunk(x, y) {
  const trunk = createWoodenBox(x, y)

  trunk.isTrunk = true
  trunk.type = "trunk"
  trunk.size = WOODEN_BOX_SIZE * 0.85
  trunk.rotation = Math.random() * Math.PI * 2
  trunk.invulnerableUntil = Date.now() + 350

  if (isWaterPosition(x, y)) {
    trunk.isFloating = true
    trunk.floatAngle = Math.random() * Math.PI * 2
  }

  gameState.woodenBoxes.push(trunk)
  return trunk
}

// Try to grab a wooden box
export function tryGrabWoodenBox() {
  const { player, woodenBoxes } = gameState

  for (let i = 0; i < woodenBoxes.length; i++) {
    const box = woodenBoxes[i]
    const distance = getDistance(player.x, player.y, box.x, box.y)

    if (distance < player.size + box.size) {
      // If box was snapped to another box, unsnap it
      if (box.snappedTo) {
        box.snappedTo = null
      }

      // Sledgehammer reforges carried structures:
      // - trunks become compact solid cubes
      // - wooden boxes become metallic spiked crates
      if (gameState.hasSledgehammer && gameState.selectedTool === "sledgehammer") {
        if (box.isTrunk) {
          box.isSledgeCube = true
          box.isSledgeSpiked = false
          box.size = TILE_SIZE
          box.rotation = 0
        } else {
          box.isSledgeSpiked = true
          box.isSledgeCube = false
          box.size = TILE_SIZE
          box.rotation = 0
        }
      }

      gameState.isGrabbing = true
      gameState.grabbedWoodenBox = box
      woodenBoxes.splice(i, 1) // Remove from woodenBoxes array
      return true
    }
  }
  return false
}

// Release a grabbed wooden box
export function releaseWoodenBox() {
  const { player, grabbedWoodenBox, woodenBoxes, terrain, rocks } = gameState

  if (grabbedWoodenBox) {
    const canUseThrownMotion = Boolean(grabbedWoodenBox.isSledgeCube || grabbedWoodenBox.isSledgeSpiked)

    // If throwing, calculate throw parameters
    if (canUseThrownMotion && (gameState.keys[" "] || gameState.buttonAActive)) {
      // Space or A button
      // Calculate position in front of player based on facing direction
      const throwAngle = player.direction

      // Set the box to be thrown with enhanced throw distance
      grabbedWoodenBox.isBeingThrown = true
      grabbedWoodenBox.throwStartTime = Date.now()
      grabbedWoodenBox.throwVelocityX = Math.cos(throwAngle) * 10 * WOODEN_BOX_THROW_MULTIPLIER
      grabbedWoodenBox.throwVelocityY = Math.sin(throwAngle) * 10 * WOODEN_BOX_THROW_MULTIPLIER

      // Update box position before releasing
      const throwDistance = player.size * 2
      const newX = player.x + Math.cos(throwAngle) * throwDistance
      const newY = player.y + Math.sin(throwAngle) * throwDistance

      grabbedWoodenBox.x = newX
      grabbedWoodenBox.y = newY
    } else {
      // Non-sledge items always place directly (no throw-slide), like rocks.
      // Sledge modules also use this path when throw input is not active.
      const placeDistance = player.size + grabbedWoodenBox.size * 0.8
      const newX = player.x + Math.cos(player.direction) * placeDistance
      const newY = player.y + Math.sin(player.direction) * placeDistance

      grabbedWoodenBox.x = newX
      grabbedWoodenBox.y = newY

      // Check if box is placed on water
      const tileX = Math.floor(newX / TILE_SIZE)
      const tileY = Math.floor(newY / TILE_SIZE)

      if (
        tileX >= 0 &&
        tileX < terrain[0].length &&
        tileY >= 0 &&
        tileY < terrain.length &&
        terrain[tileY][tileX] === 0 // TERRAIN_TYPES.WATER
      ) {
        grabbedWoodenBox.isFloating = true
        grabbedWoodenBox.floatAngle = Math.random() * Math.PI * 2
      } else {
        grabbedWoodenBox.isFloating = false

        settleBoxOnLand(grabbedWoodenBox, woodenBoxes, rocks)
      }
    }

    woodenBoxes.push(grabbedWoodenBox)

    if (!isPlayerPositionClear(player.x, player.y)) {
      movePlayerToNearestSafePosition(player.x, player.y, grabbedWoodenBox.x, grabbedWoodenBox.y)
    }

    gameState.grabbedWoodenBox = null
    gameState.isGrabbing = false
    return true
  }
  return false
}

// Check if a box should snap to another box or rock
function checkForBoxSnapping(box, allBoxes, allRocks) {
  // Don't snap if the box is being thrown or is floating
  if (box.isBeingThrown || box.isFloating) return

  // Non-sledge pieces use free drop + tile settle only.
  if (!isGridWallBox(box)) {
    box.snappedTo = null
    return
  }

  let closestObject = null
  const nonGridSnapRange = NON_GRID_SNAP_SPAN + TILE_SIZE * 0.55
  let closestDistance = Math.max(WOODEN_BOX_SNAP_DISTANCE, nonGridSnapRange)
  let objectType = null

  // Find the closest box within snapping distance
  for (const otherBox of allBoxes) {
    // Skip self or boxes being thrown or floating
    if (otherBox === box || otherBox.isBeingThrown || otherBox.isFloating) continue

    const distance = getDistance(box.x, box.y, otherBox.x, otherBox.y)
    if (distance < closestDistance) {
      closestDistance = distance
      closestObject = otherBox
      objectType = "box"
    }
  }

  // Also check for nearby rocks
  for (const rock of allRocks) {
    // Skip rocks being carried
    if (rock === gameState.grabbedRock) continue

    const distance = getDistance(box.x, box.y, rock.x, rock.y)
    if (distance < closestDistance) {
      closestDistance = distance
      closestObject = rock
      objectType = "rock"
    }
  }

  // If found a box or rock to snap to
  if (closestObject) {
    const snappedPosition = findAdjacentTileSnapPositionForBox(box, closestObject, allBoxes, allRocks)
    if (!snappedPosition) {
      return
    }

    const newX = snappedPosition.x
    const newY = snappedPosition.y

    // Set the box position
    box.x = newX
    box.y = newY

    // Resolve player overlap after object has moved to its final snap position.
    nudgePlayerAwayFromSnap(newX, newY, box)

    // Store reference to snapped object
    box.snappedTo = closestObject

    // Reset rotation when snapped
    box.rotation = 0

    // Create a visual effect
    createSnapEffect(box, closestObject)
  }
}

// Modify the snapBoxToOtherBox function to reduce the gap between boxes
function snapBoxToOtherBox(box, otherObject) {
  if (!isGridWallModule(box) || !isGridWallModule(otherObject)) {
    box.snappedTo = null
    settleBoxOnLand(box, gameState.woodenBoxes, gameState.rocks)
    nudgePlayerAwayFromSnap(box.x, box.y, box)
    return
  }

  const snappedPosition = findAdjacentTileSnapPositionForBox(box, otherObject, gameState.woodenBoxes, gameState.rocks)
  if (!snappedPosition) {
    return
  }

  const newX = snappedPosition.x
  const newY = snappedPosition.y

  // Set the box position
  box.x = newX
  box.y = newY

  // Resolve player overlap after object has moved to its final snap position.
  nudgePlayerAwayFromSnap(newX, newY, box)

  // Store reference to snapped object
  box.snappedTo = otherObject

  // Reset rotation when snapped
  box.rotation = 0

  // Create a small visual effect to indicate snapping
  createSnapEffect(box, otherObject)
}

function settleBoxOnLand(box, allBoxes, allRocks) {
  if (!box || box.isFloating || box.isBeingThrown) {
    return
  }

  snapObjectToNearestTileCenter(box)
  box.rotation = 0

  if (isBoxOverlappingAnyObject(box, allBoxes, allRocks)) {
    moveBoxToNearestFreeTile(box, allBoxes, allRocks)
  }

  checkForBoxSnapping(box, allBoxes, allRocks)

  if (isBoxOverlappingAnyObject(box, allBoxes, allRocks)) {
    moveBoxToNearestFreeTile(box, allBoxes, allRocks)
  }
}

function findAdjacentTileSnapPositionForBox(box, anchorObject, allBoxes, allRocks) {
  if (!box || !anchorObject) {
    return null
  }

  if (!isGridWallModule(box) || !isGridWallModule(anchorObject)) {
    const anchorTileX = Math.round((anchorObject.x - TILE_SIZE / 2) / TILE_SIZE)
    const anchorTileY = Math.round((anchorObject.y - TILE_SIZE / 2) / TILE_SIZE)
    const anchorCenterX = anchorTileX * TILE_SIZE + TILE_SIZE / 2
    const anchorCenterY = anchorTileY * TILE_SIZE + TILE_SIZE / 2

    const deltaX = box.x - anchorCenterX
    const deltaY = box.y - anchorCenterY
    const preferHorizontal = Math.abs(deltaX) >= Math.abs(deltaY)
    const horizontalSign = deltaX >= 0 ? 1 : -1
    const verticalSign = deltaY >= 0 ? 1 : -1
    const tileStep = NON_GRID_SNAP_TILE_GAP + 1

    const candidates = preferHorizontal
      ? [
          { tileX: anchorTileX + horizontalSign * tileStep, tileY: anchorTileY },
          { tileX: anchorTileX - horizontalSign * tileStep, tileY: anchorTileY },
          { tileX: anchorTileX, tileY: anchorTileY + verticalSign * tileStep },
          { tileX: anchorTileX, tileY: anchorTileY - verticalSign * tileStep },
        ]
      : [
          { tileX: anchorTileX, tileY: anchorTileY + verticalSign * tileStep },
          { tileX: anchorTileX, tileY: anchorTileY - verticalSign * tileStep },
          { tileX: anchorTileX + horizontalSign * tileStep, tileY: anchorTileY },
          { tileX: anchorTileX - horizontalSign * tileStep, tileY: anchorTileY },
        ]

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (const candidate of candidates) {
      if (!isTileAvailableForBox(candidate.tileX, candidate.tileY, box, allBoxes, allRocks)) {
        continue
      }

      const candidateX = candidate.tileX * TILE_SIZE + TILE_SIZE / 2
      const candidateY = candidate.tileY * TILE_SIZE + TILE_SIZE / 2

      const distance = getDistance(box.x, box.y, candidateX, candidateY)
      if (distance < bestDistance) {
        bestDistance = distance
        best = { x: candidateX, y: candidateY }
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
    if (!isTileAvailableForBox(candidate.tileX, candidate.tileY, box, allBoxes, allRocks)) {
      continue
    }

    const x = candidate.tileX * TILE_SIZE + TILE_SIZE / 2
    const y = candidate.tileY * TILE_SIZE + TILE_SIZE / 2
    const distance = getDistance(box.x, box.y, x, y)

    if (distance < bestDistance) {
      bestDistance = distance
      best = { x, y }
    }
  }

  return best
}

function snapObjectToNearestTileCenter(object) {
  const { terrain } = gameState
  if (!terrain || terrain.length === 0 || terrain[0].length === 0) {
    return
  }

  const tileX = Math.round((object.x - TILE_SIZE / 2) / TILE_SIZE)
  const tileY = Math.round((object.y - TILE_SIZE / 2) / TILE_SIZE)

  object.x = tileX * TILE_SIZE + TILE_SIZE / 2
  object.y = tileY * TILE_SIZE + TILE_SIZE / 2
  clampObjectToWorld(object)
}

function clampObjectToWorld(object) {
  const { terrain } = gameState
  if (!terrain || terrain.length === 0 || terrain[0].length === 0) {
    return
  }

  const minX = object.size
  const minY = object.size
  const maxX = terrain[0].length * TILE_SIZE - object.size
  const maxY = terrain.length * TILE_SIZE - object.size

  object.x = Math.max(minX, Math.min(maxX, object.x))
  object.y = Math.max(minY, Math.min(maxY, object.y))
}

function isTileAvailableForBox(tileX, tileY, box, allBoxes, allRocks) {
  const { terrain } = gameState
  if (!terrain || tileY < 0 || tileY >= terrain.length || tileX < 0 || tileX >= terrain[0].length) {
    return false
  }

  if (terrain[tileY][tileX] === 0) {
    return false
  }

  const candidateX = tileX * TILE_SIZE + TILE_SIZE / 2
  const candidateY = tileY * TILE_SIZE + TILE_SIZE / 2

  return !isBoxOverlappingAnyObjectAt(candidateX, candidateY, box, allBoxes, allRocks)
}

function isGridWallBox(box) {
  return Boolean(box && (box.isSledgeCube || box.isSledgeSpiked))
}

function isGridWallRock(rock) {
  return Boolean(rock && rock.isHammerShaped)
}

function isGridWallModule(object) {
  return Boolean(object && (isGridWallBox(object) || isGridWallRock(object)))
}

function getBoxEffectiveSize(box) {
  if (isGridWallBox(box)) {
    return TILE_SIZE * 0.5
  }

  if (box?.isTrunk) {
    return WOODEN_BOX_SIZE * 0.95
  }

  return box.size * 0.95
}

function getRockEffectiveSize(rock) {
  return rock.isHammerShaped ? TILE_SIZE * 0.5 : rock.size * 0.95
}

function getObjectEffectiveHalfSize(object) {
  if (!object) {
    return TILE_SIZE * 0.5
  }

  if (isGridWallBox(object) || isGridWallRock(object)) {
    return TILE_SIZE * 0.5
  }

  if (object.isTrunk) {
    return WOODEN_BOX_SIZE * 0.95
  }

  return (object.size || TILE_SIZE * 0.5) * 0.95
}

function nudgePlayerAwayFromSnap(targetX, targetY, snappedObject) {
  const { player } = gameState
  if (!player) {
    return
  }

  const objectSize = snappedObject?.isTrunk ? WOODEN_BOX_SIZE : (snappedObject?.size || TILE_SIZE)
  const minDistance = player.size + objectSize * 0.7 + MIN_PLAYER_SNAP_CLEARANCE
  const distanceToPlayer = getDistance(targetX, targetY, player.x, player.y)

  if (distanceToPlayer < minDistance) {
    const pushAngle = Math.atan2(player.y - targetY, player.x - targetX)
    const pushDistance = minDistance - distanceToPlayer
    player.x += Math.cos(pushAngle) * pushDistance
    player.y += Math.sin(pushAngle) * pushDistance
  }

  if (!isPlayerPositionClear(player.x, player.y)) {
    movePlayerToNearestSafePosition(player.x, player.y, targetX, targetY)
  }
}

function canPlaceBoxAtPosition(x, y, box, allBoxes, allRocks) {
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

  return !isBoxOverlappingAnyObjectAt(x, y, box, allBoxes, allRocks)
}

function isBoxOverlappingAnyObject(box, allBoxes, allRocks) {
  return isBoxOverlappingAnyObjectAt(box.x, box.y, box, allBoxes, allRocks)
}

function isBoxOverlappingAnyObjectAt(x, y, box, allBoxes, allRocks) {
  const candidateTile = getSnappedTileCoords(x, y)
  const movingIsGridWall = isGridWallBox(box)
  const movingHalfSize = getBoxEffectiveSize(box)

  for (const otherBox of allBoxes) {
    if (!otherBox || otherBox === box || otherBox.isBeingThrown || otherBox.isFloating) {
      continue
    }

    const otherIsGridWall = isGridWallBox(otherBox)

    if (movingIsGridWall && otherIsGridWall) {
      const otherTile = getSnappedTileCoords(otherBox.x, otherBox.y)
      if (otherTile.tileX === candidateTile.tileX && otherTile.tileY === candidateTile.tileY) {
        return true
      }
      continue
    }

    const minDistance = (!movingIsGridWall || !otherIsGridWall)
      ? NON_GRID_SNAP_SPAN
      : movingHalfSize + getBoxEffectiveSize(otherBox) + OBJECT_SNAP_GAP
    if (getDistance(x, y, otherBox.x, otherBox.y) < minDistance) {
      return true
    }
  }

  for (const rock of allRocks) {
    if (!rock || rock === gameState.grabbedRock) {
      continue
    }

    const rockIsGridWall = Boolean(rock.isHammerShaped)

    if (movingIsGridWall && rockIsGridWall) {
      const rockTile = getSnappedTileCoords(rock.x, rock.y)
      if (rockTile.tileX === candidateTile.tileX && rockTile.tileY === candidateTile.tileY) {
        return true
      }
      continue
    }

    const minDistance = (!movingIsGridWall || !rockIsGridWall)
      ? NON_GRID_SNAP_SPAN
      : movingHalfSize + getRockEffectiveSize(rock) + OBJECT_SNAP_GAP
    if (getDistance(x, y, rock.x, rock.y) < minDistance) {
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

function moveBoxToNearestFreeTile(box, allBoxes, allRocks) {
  const baseTileX = Math.round((box.x - TILE_SIZE / 2) / TILE_SIZE)
  const baseTileY = Math.round((box.y - TILE_SIZE / 2) / TILE_SIZE)

  let bestCandidate = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let radius = 0; radius <= TILE_SEARCH_RADIUS; radius++) {
    for (let tileY = baseTileY - radius; tileY <= baseTileY + radius; tileY++) {
      for (let tileX = baseTileX - radius; tileX <= baseTileX + radius; tileX++) {
        if (radius > 0 && Math.max(Math.abs(tileX - baseTileX), Math.abs(tileY - baseTileY)) !== radius) {
          continue
        }

        if (!isTileAvailableForBox(tileX, tileY, box, allBoxes, allRocks)) {
          continue
        }

        const candidateX = tileX * TILE_SIZE + TILE_SIZE / 2
        const candidateY = tileY * TILE_SIZE + TILE_SIZE / 2
        const distance = getDistance(box.x, box.y, candidateX, candidateY)

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
    box.x = bestCandidate.x
    box.y = bestCandidate.y
    clampObjectToWorld(box)
  }
}

// Ensure the damageWoodenBox function is properly exported and handles the damage states
// Apply damage to a wooden box
export function damageWoodenBox(box, amount = 1) {
  // Skip if box doesn't exist
  if (!box) return false

  // Newly spawned trunks should not be destroyed by the same swing that felled
  // the tree. This keeps trunks reliably left behind after chopping.
  if (box.invulnerableUntil && Date.now() < box.invulnerableUntil) {
    return false
  }

  box.hitPoints -= amount
  box.lastHitTime = Date.now()

  // Update damage state based on hit points
  box.damageState = 3 - box.hitPoints

  // If destroyed, remove box and spawn a new one elsewhere
  if (box.hitPoints <= 0) {
    createBoxDestructionEffect(box)

    // Find and remove the box
    const boxIndex = gameState.woodenBoxes.indexOf(box)
    if (boxIndex !== -1) {
      gameState.woodenBoxes.splice(boxIndex, 1)

      // Trunks come from chopped trees, so they are not restocked like crates
      if (!box.isTrunk) {
        // Spawn a new box elsewhere (delayed to prevent instant respawning)
        setTimeout(() => {
          if (gameState.woodenBoxes) {
            // Check if game still exists
            generateWoodenBoxes(1)
          }
        }, 1000)
      }
    }
    return true // Box was destroyed
  }
  return false // Box was damaged but not destroyed
}

// Create destruction effect when a box is destroyed
function createBoxDestructionEffect(box) {
  if (!gameState.boxDestructionEffects) {
    gameState.boxDestructionEffects = []
  }

  // Create 12-15 wood splinter particles
  const particleCount = 12 + Math.floor(Math.random() * 4)
  const effect = {
    particles: [],
    createdAt: Date.now(),
  }

  // If box was being thrown, inherit some of its velocity
  const baseVelX = box.isBeingThrown ? box.throwVelocityX * 0.3 : 0
  const baseVelY = box.isBeingThrown ? box.throwVelocityY * 0.3 : 0

  for (let i = 0; i < particleCount; i++) {
    // Random angle for particle dispersion
    const angle = Math.random() * Math.PI * 2
    // Random speed between 2 and 6
    const speed = 2 + Math.random() * 4
    // Random size between 4 and 10
    const size = 4 + Math.random() * 6
    // Random lifetime between 500ms and 1500ms
    const lifetime = 500 + Math.random() * 1000
    // Random rotation
    const rotation = Math.random() * Math.PI * 2
    // Random rotation speed
    const rotationSpeed = (Math.random() - 0.5) * 0.2

    // Create particle with slightly random brown colors
    effect.particles.push({
      x: box.x,
      y: box.y,
      size: size,
      velocityX: baseVelX + Math.cos(angle) * speed,
      velocityY: baseVelY + Math.sin(angle) * speed,
      rotation: rotation,
      rotationSpeed: rotationSpeed,
      lifetime: lifetime,
      maxLifetime: lifetime,
      // Slightly different shades of brown for wood pieces
      color: `hsl(${25 + Math.random() * 15}, ${70 + Math.random() * 20}%, ${35 + Math.random() * 15}%)`,
      // Random shape (0 = rectangle, 1 = triangle)
      shape: Math.random() > 0.5 ? 0 : 1,
      // Length and width for rectangular splinters
      length: 8 + Math.random() * 10,
      width: 2 + Math.random() * 3,
    })
  }

  gameState.boxDestructionEffects.push(effect)
}

// Draw and update box destruction effects
function drawAndUpdateBoxDestructionEffects() {
  if (!gameState.boxDestructionEffects) return

  const { camera, ctx } = gameState

  for (let i = gameState.boxDestructionEffects.length - 1; i >= 0; i--) {
    const effect = gameState.boxDestructionEffects[i]
    const elapsed = Date.now() - effect.createdAt

    // Remove effect if all particles are dead
    if (effect.particles.length === 0) {
      gameState.boxDestructionEffects.splice(i, 1)
      continue
    }

    // Update and draw each particle
    for (let j = effect.particles.length - 1; j >= 0; j--) {
      const particle = effect.particles[j]

      // Update particle position
      particle.x += particle.velocityX
      particle.y += particle.velocityY

      // Apply gravity
      particle.velocityY += 0.15

      // Apply friction
      particle.velocityX *= 0.97
      particle.velocityY *= 0.97

      // Update rotation
      particle.rotation += particle.rotationSpeed

      // Decrease lifetime
      particle.lifetime -= 16 // Roughly 60fps

      // Remove dead particles
      if (particle.lifetime <= 0) {
        effect.particles.splice(j, 1)
        continue
      }

      // Calculate screen position
      const screenX = particle.x - camera.x
      const screenY = particle.y - camera.y

      // Skip if off-screen
      if (
        screenX < -particle.size * 2 ||
        screenX > ctx.canvas.width + particle.size * 2 ||
        screenY < -particle.size * 2 ||
        screenY > ctx.canvas.height + particle.size * 2
      ) {
        continue
      }

      // Calculate opacity based on lifetime
      const opacity = particle.lifetime / particle.maxLifetime

      // Draw particle
      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.rotate(particle.rotation)

      // Draw wood splinter based on shape
      ctx.fillStyle = particle.color
      ctx.globalAlpha = opacity

      if (particle.shape === 0) {
        // Rectangle
        // Draw rectangular splinter
        ctx.fillRect(-particle.length / 2, -particle.width / 2, particle.length, particle.width)
      } else {
        // Triangle
        // Draw triangular splinter
        ctx.beginPath()
        ctx.moveTo(particle.size, 0)
        ctx.lineTo(-particle.size / 2, particle.size / 2)
        ctx.lineTo(-particle.size / 2, -particle.size / 2)
        ctx.closePath()
        ctx.fill()
      }

      ctx.globalAlpha = 1
      ctx.restore()
    }
  }
}

// Check for collisions between thrown boxes and other objects
function checkThrownBoxCollisions(box) {
  const { enemies, rocks, woodenBoxes } = gameState

  // Only check collisions if the box is being thrown and has significant velocity
  if (!box.isBeingThrown || (Math.abs(box.throwVelocityX) < 2 && Math.abs(box.throwVelocityY) < 2)) {
    return
  }

  // Check collisions with enemies
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]

    // Skip if enemy is already being thrown or carried
    if (enemy.isBeingThrown || enemy === gameState.grabbedEnemy) {
      continue
    }

    // Check for collision
    const distance = getDistance(box.x, box.y, enemy.x, enemy.y)
    if (distance < box.size + enemy.size) {
      // Calculate impact force based on throw velocity
      const impactForce = Math.sqrt(box.throwVelocityX * box.throwVelocityX + box.throwVelocityY * box.throwVelocityY)

      // Apply knockback to the hit enemy
      applyKnockbackToEnemy(
        enemy,
        box.x,
        box.y,
        Math.min(impactForce * 0.8, 10), // Cap the force at 10
      )

      // Reduce the box's velocity and apply damage to it
      box.throwVelocityX *= 0.5
      box.throwVelocityY *= 0.5

      // Damage the box when it hits enemies hard enough
      if (impactForce > 5) {
        damageWoodenBox(box)
      }
    }
  }

  // Check collisions with rocks
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i]

    // Skip if rock is being carried
    if (rock === gameState.grabbedRock) {
      continue
    }

    // Check for collision
    const distance = getDistance(box.x, box.y, rock.x, rock.y)
    if (distance < box.size + rock.size * 0.8) {
      // Calculate impact force
      const impactForce = Math.sqrt(box.throwVelocityX * box.throwVelocityX + box.throwVelocityY * box.throwVelocityY)

      // If the impact is not too hard, snap the box to the rock
      if (impactForce < 8) {
        // Stop the box from being thrown
        box.isBeingThrown = false
        box.throwVelocityX = 0
        box.throwVelocityY = 0

        // Apply snapping logic
        snapBoxToOtherBox(box, rock)
      } else {
        // Bounce off the rock if impact is too hard
        const angle = Math.atan2(box.y - rock.y, box.x - rock.x)
        box.throwVelocityX = Math.cos(angle) * impactForce * 0.5
        box.throwVelocityY = Math.sin(angle) * impactForce * 0.5

        // Damage the box on hard impact
        if (impactForce > 5) {
          damageWoodenBox(box)
        }
      }

      break
    }
  }

  // Check collisions with other wooden boxes
  for (let i = 0; i < woodenBoxes.length; i++) {
    const otherBox = woodenBoxes[i]

    // Skip self, carried box, or thrown box
    if (otherBox === box || otherBox === gameState.grabbedWoodenBox || otherBox.isBeingThrown) {
      continue
    }

    // Check for collision
    const distance = getDistance(box.x, box.y, otherBox.x, otherBox.y)
    if (distance < box.size + otherBox.size * 0.8) {
      // Calculate impact force
      const impactForce = Math.sqrt(box.throwVelocityX * box.throwVelocityX + box.throwVelocityY * box.throwVelocityY)

      // If impact is hard enough, damage both boxes
      if (impactForce > 5) {
        damageWoodenBox(box)
        damageWoodenBox(otherBox)
      }

      // If the impact is not too hard, snap the box to the other box
      if (impactForce < 8) {
        // Stop the box from being thrown
        box.isBeingThrown = false
        box.throwVelocityX = 0
        box.throwVelocityY = 0

        // Apply snapping logic
        snapBoxToOtherBox(box, otherBox)
      } else {
        // Bounce off the other box if impact is too hard
        const angle = Math.atan2(box.y - otherBox.y, box.x - otherBox.x)
        box.throwVelocityX = Math.cos(angle) * impactForce * 0.5
        box.throwVelocityY = Math.sin(angle) * impactForce * 0.5
      }

      break
    }
  }
}

// Add a function to create a visual effect when objects snap together
export function createSnapEffect(object1, object2) {
  // Calculate the midpoint between the objects
  const midX = (object1.x + object2.x) / 2
  const midY = (object1.y + object2.y) / 2

  // Create a small particle effect if it doesn't exist
  if (!gameState.snapEffects) {
    gameState.snapEffects = []
  }

  // Add a new snap effect
  gameState.snapEffects.push({
    x: midX,
    y: midY,
    size: object1.size * 0.5,
    createdAt: Date.now(),
    duration: 300, // 300ms effect
  })
}

// Add a function to draw snap effects
function drawSnapEffects() {
  if (!gameState.snapEffects) return

  const { camera, ctx } = gameState

  for (let i = gameState.snapEffects.length - 1; i >= 0; i--) {
    const effect = gameState.snapEffects[i]
    const elapsed = Date.now() - effect.createdAt

    // Remove effect if it's done
    if (elapsed > effect.duration) {
      gameState.snapEffects.splice(i, 1)
      continue
    }

    // Calculate progress (0 to 1)
    const progress = elapsed / effect.duration
    const opacity = 1 - progress
    const size = effect.size * (1 + progress)

    // Draw the effect
    const screenX = effect.x - camera.x
    const screenY = effect.y - camera.y

    // Draw a circle that expands and fades
    ctx.beginPath()
    ctx.arc(screenX, screenY, size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`
    ctx.fill()

    // Draw connecting lines
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`
    ctx.lineWidth = 2 * (1 - progress)

    for (let j = 0; j < 4; j++) {
      const angle = (j / 4) * Math.PI * 2
      const innerRadius = size * 0.3
      const outerRadius = size

      ctx.beginPath()
      ctx.moveTo(screenX + Math.cos(angle) * innerRadius, screenY + Math.sin(angle) * innerRadius)
      ctx.lineTo(screenX + Math.cos(angle) * outerRadius, screenY + Math.sin(angle) * outerRadius)
      ctx.stroke()
    }
  }
}

// Draw and update wooden boxes
export function drawAndUpdateWoodenBoxes(options = {}) {
  try {
    const { drawRoofs = true } = options
    const { woodenBoxes, camera, ctx, canvas, terrain } = gameState

    for (let i = woodenBoxes.length - 1; i >= 0; i--) {
      const box = woodenBoxes[i]
      if (!box) continue // Skip if box is undefined

      // Handle thrown box physics
      if (box.isBeingThrown) {
        // Update position based on throw velocity
        box.x += box.throwVelocityX
        box.y += box.throwVelocityY

        // After updating position, check if the box has entered water
        const waterTileX = Math.floor(box.x / TILE_SIZE)
        const waterTileY = Math.floor(box.y / TILE_SIZE)

        // Check if the box is now over water
        if (waterTileX >= 0 && waterTileX < terrain[0].length && waterTileY >= 0 && waterTileY < terrain.length) {
          // If the box was not floating and is now over water
          if (!box.isFloating && terrain[waterTileY][waterTileX] === 0) {
            // Create a splash effect
            createWaterSplashEffect(box)

            // Set the box to floating mode
            setBoxFloating(box, true)

            // Reduce velocity when hitting water
            box.throwVelocityX *= 0.7
            box.throwVelocityY *= 0.7
          }
          // If the box was floating and is now over land
          else if (box.isFloating && terrain[waterTileY][waterTileX] !== 0) {
            setBoxFloating(box, false)
          }
        }

        // Check for collisions with enemies
        checkThrownBoxCollisions(box)

        // Slow down the throw over time (friction)
        box.throwVelocityX *= 0.97
        box.throwVelocityY *= 0.97

        // Check if the box has landed
        if (Math.abs(box.throwVelocityX) < 0.5 && Math.abs(box.throwVelocityY) < 0.5) {
          box.isBeingThrown = false

          // Check if box landed in water
          const tileX = Math.floor(box.x / TILE_SIZE)
          const tileY = Math.floor(box.y / TILE_SIZE)

          if (
            tileX >= 0 &&
            tileX < terrain[0].length &&
            tileY >= 0 &&
            tileY < terrain.length &&
            terrain[tileY][tileX] === 0 // TERRAIN_TYPES.WATER
          ) {
            // Box landed in water, set floating state
            setBoxFloating(box, true)
          } else {
            // Box landed on land
            setBoxFloating(box, false)
            settleBoxOnLand(box, woodenBoxes, gameState.rocks)
          }
        }

        // Check for collisions with terrain boundaries
        const tileX = Math.floor(box.x / TILE_SIZE)
        const tileY = Math.floor(box.y / TILE_SIZE)

        if (tileX < 0 || tileX >= terrain[0].length || tileY < 0 || tileY >= terrain.length) {
          // Bounce off terrain boundaries
          if (tileX < 0 || tileX >= terrain[0].length) {
            box.throwVelocityX *= -0.7
          }
          if (tileY < 0 || tileY >= terrain.length) {
            box.throwVelocityY *= -0.7
          }

          // Move box back to valid position
          box.x = Math.max(0, Math.min(terrain[0].length * TILE_SIZE - 1, box.x))
          box.y = Math.max(0, Math.min(terrain.length * TILE_SIZE - 1, box.y))

          // Damage box on hard impact with boundaries
          damageWoodenBox(box)
        }
      }

      // Handle floating on water\
      if (box.isFloating) {
        // Update float animation offset
        box.floatOffset = Math.sin(Date.now() / 500) * 3

        // Drift in the direction of float angle
        box.x += Math.cos(box.floatAngle) * WOODEN_BOX_FLOAT_SPEED
        box.y += Math.sin(box.floatAngle) * WOODEN_BOX_FLOAT_SPEED

        // Occasionally change drift direction slightly
        if (Math.random() < 0.02) {
          box.floatAngle += ((Math.random() - 0.5) * Math.PI) / 4
        }

        // Check if box has drifted to land
        const tileX = Math.floor(box.x / TILE_SIZE)
        const tileY = Math.floor(box.y / TILE_SIZE)

        if (
          tileX >= 0 &&
          tileX < terrain[0].length &&
          tileY >= 0 &&
          tileY < terrain.length &&
          terrain[tileY][tileX] !== 0 // Not water
        ) {
          box.isFloating = false

          settleBoxOnLand(box, woodenBoxes, gameState.rocks)
        }

        // Drift toward shore if nearby
        let nearestLand = null
        let nearestLandDistance = box.size * 5

        // Check 8 directions for nearby land
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue

            const checkTileX = Math.floor((box.x + dx * box.size) / TILE_SIZE)
            const checkTileY = Math.floor((box.y + dy * box.size) / TILE_SIZE)

            if (
              checkTileX >= 0 &&
              checkTileX < terrain[0].length &&
              checkTileY >= 0 &&
              checkTileY < terrain.length &&
              terrain[checkTileY][checkTileX] !== 0 // Not water
            ) {
              // Found land, calculate center of land tile
              const landX = checkTileX * TILE_SIZE + TILE_SIZE / 2
              const landY = checkTileY * TILE_SIZE + TILE_SIZE / 2
              const landDistance = getDistance(box.x, box.y, landX, landY)

              if (landDistance < nearestLandDistance) {
                nearestLandDistance = landDistance
                nearestLand = { x: landX, y: landY }
              }
            }
          }
        }

        // If land is nearby, drift toward it
        if (nearestLand) {
          const landAngle = Math.atan2(nearestLand.y - box.y, nearestLand.x - box.x)
          // Gradually adjust float angle toward land
          const angleDiff = landAngle - box.floatAngle
          // Normalize angle difference to -PI to PI
          const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff))
          box.floatAngle += normalizedDiff * 0.1
        }
      }

      const screenX = box.x - camera.x
      const screenY = box.y - camera.y - (box.isFloating ? box.floatOffset : 0)

      // Skip if box is off-screen
      if (
        screenX < -box.size ||
        screenX > canvas.width + box.size ||
        screenY < -box.size ||
        screenY > canvas.height + box.size
      ) {
        continue
      }

      // Draw shadow
      if (box.isSledgeCube || box.isSledgeSpiked) {
        // Skip shadows for tile-locked wall modules so edges meet cleanly.
      } else if (box.isTrunk && !box.isSledgeCube && !box.isSledgeSpiked) {
        createShadow(
          ctx,
          screenX,
          screenY + (box.isFloating ? box.floatOffset : 0), // Adjust shadow position when floating
          box.size * 0.82,
          "circle",
        )
      } else {
        createShadow(
          ctx,
          screenX,
          screenY + (box.isFloating ? box.floatOffset : 0), // Adjust shadow position when floating
          box.size,
          "rectangle",
          {
            width: box.size,
            height: box.size,
            radius: 4,
          },
          box.rotation,
        )
      }

      // Draw wooden box
      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.rotate(box.rotation)

      // Draw the base wooden box
      drawWoodenBox(ctx, box)

      // Draw damage overlays based on damage state
      if (box.damageState > 0) {
        drawDamageOverlay(ctx, box)
      }

      // Draw floating effect if box is on water
      if (box.isFloating) {
        drawFloatingEffect(ctx, box)
      }

      ctx.restore()

      // If box was just hit, draw impact effect
      if (Date.now() - box.lastHitTime < 300) {
        drawImpactEffect(ctx, screenX, screenY, box)
      }
    }

    // Draw box destruction effects
    drawAndUpdateBoxDestructionEffects()

    drawSnapEffects()
    drawAndUpdateSplashEffects()

    // Draw grabbed wooden box
    if (gameState.grabbedWoodenBox) {
      drawGrabbedWoodenBox(ctx, camera)
    }

    // Detect roof areas with a small throttle to avoid expensive recompute every frame.
    updateRoofAreasIfNeeded()

    // Draw entities that should appear under roofs
    drawEntitiesUnderRoof()

    // Draw roof areas on top when requested by the caller
    if (drawRoofs) {
      drawRoofAreas()
    }
  } catch (error) {
    console.error("Error in drawAndUpdateWoodenBoxes:", error)
  }
}

export function drawWoodenBoxRoofs() {
  updateRoofAreasIfNeeded()
  drawRoofAreas()
}

function updateRoofAreasIfNeeded(force = false) {
  const now = Date.now()
  const interval = gameState.lightweightMode ? ROOF_DETECTION_INTERVAL_MS_LIGHTWEIGHT : ROOF_DETECTION_INTERVAL_MS

  if (!force && now - lastRoofDetectionAt < interval) {
    return
  }

  detectRoofAreas()
  lastRoofDetectionAt = now
}

// Draw entities that should appear under the roof
function drawEntitiesUnderRoof() {
  // This function is intentionally left empty
  // The actual drawing of entities happens in their respective draw functions
  // We're just ensuring the roof is drawn after all entities
}

// Modify the detectRoofAreas function to properly handle both wooden boxes and rocks
// and prevent duplicate roof areas
function detectRoofAreas() {
  const { woodenBoxes, rocks } = gameState

  // Clear previous roof areas
  roofAreas = []

  const buildingObjects = []

  if (woodenBoxes && woodenBoxes.length > 0) {
    woodenBoxes.forEach((box) => {
      if (!box.isFloating && !box.isBeingThrown) {
        buildingObjects.push({
          ...box,
          type: "box",
        })
      }
    })
  }

  if (rocks && rocks.length > 0) {
    rocks.forEach((rock) => {
      if (rock !== gameState.grabbedRock) {
        buildingObjects.push({
          ...rock,
          type: "rock",
        })
      }
    })
  }

  if (buildingObjects.length < 3) return

  const objectGroups = findSnappedObjectGroups(buildingObjects)

  for (const group of objectGroups) {
    if (group.length < 3) continue

    const uShapes = findUShapes(group)

    for (const newRoof of uShapes) {
      let shouldAdd = true

      for (let i = roofAreas.length - 1; i >= 0; i--) {
        const existingRoof = roofAreas[i]

        if (roofsOverlap(newRoof, existingRoof)) {
          mergeRoofs(existingRoof, newRoof)
          shouldAdd = false
          break
        }
      }

      if (shouldAdd) {
        roofAreas.push(newRoof)
      }
    }
  }

  mergeAllOverlappingRoofs()
}

// Check if two roof areas overlap or touch.
function roofsOverlap(roof1, roof2) {
  const epsilon = 1
  const roof1Right = roof1.x + roof1.width
  const roof1Bottom = roof1.y + roof1.height
  const roof2Right = roof2.x + roof2.width
  const roof2Bottom = roof2.y + roof2.height

  return !(
    roof1Right < roof2.x - epsilon ||
    roof2Right < roof1.x - epsilon ||
    roof1Bottom < roof2.y - epsilon ||
    roof2Bottom < roof1.y - epsilon
  )
}

function mergeAllOverlappingRoofs() {
  let merged = true

  while (merged) {
    merged = false

    for (let i = 0; i < roofAreas.length; i++) {
      for (let j = i + 1; j < roofAreas.length; j++) {
        if (!roofsOverlap(roofAreas[i], roofAreas[j])) {
          continue
        }

        mergeRoofs(roofAreas[i], roofAreas[j])
        roofAreas.splice(j, 1)
        merged = true
        break
      }

      if (merged) {
        break
      }
    }
  }
}

// Merge two overlapping roofs
function mergeRoofs(roof1, roof2) {
  // Calculate the bounding box that contains both roofs
  const x = Math.min(roof1.x, roof2.x)
  const y = Math.min(roof1.y, roof2.y)
  const width = Math.max(roof1.x + roof1.width, roof2.x + roof2.width) - x
  const height = Math.max(roof1.y + roof1.height, roof2.y + roof2.height) - y

  // Update the first roof to be the merged roof
  roof1.x = x
  roof1.y = y
  roof1.width = width
  roof1.height = height
  roof1.isSolid = Boolean(roof1.isSolid || roof2.isSolid)

  // Keep the most recent creation time
  roof1.createdAt = Math.max(roof1.createdAt, roof2.createdAt)
}

// Find groups of connected objects (boxes and rocks)
function findSnappedObjectGroups(objects) {
  const groups = []
  const visited = new Set()

  for (const obj of objects) {
    if (visited.has(obj)) continue

    // Start a new group with this object
    const group = []
    const queue = [obj]
    visited.add(obj)

    // BFS to find all connected objects
    while (queue.length > 0) {
      const currentObj = queue.shift()
      group.push(currentObj)

      // Find all objects close to this one
      for (const otherObj of objects) {
        if (visited.has(otherObj)) continue

        const distance = getDistance(currentObj.x, currentObj.y, otherObj.x, otherObj.y)
        // Consider objects close if they're within 1.8x their combined sizes
        if (distance < (currentObj.size + otherObj.size) * 1.8) {
          queue.push(otherObj)
          visited.add(otherObj)
        }
      }
    }

    if (group.length > 0) {
      groups.push(group)
    }
  }

  return groups
}

function countRoofSides(objectGroup, minX, maxX, minY, maxY) {
  const sideThreshold = TILE_SIZE * 0.7
  let sideCount = 0

  if (objectGroup.some((obj) => Math.abs(obj.x - minX) < obj.size * 1.1 + sideThreshold)) sideCount++
  if (objectGroup.some((obj) => Math.abs(obj.x - maxX) < obj.size * 1.1 + sideThreshold)) sideCount++
  if (objectGroup.some((obj) => Math.abs(obj.y - minY) < obj.size * 1.1 + sideThreshold)) sideCount++
  if (objectGroup.some((obj) => Math.abs(obj.y - maxY) < obj.size * 1.1 + sideThreshold)) sideCount++

  return sideCount
}

// Find U-shapes in a group of objects
function findUShapes(objectGroup) {
  const uShapes = []

  for (const cornerObj of objectGroup) {
    const horizontalObjects = objectGroup.filter(
      (obj) =>
        obj !== cornerObj &&
        Math.abs(obj.y - cornerObj.y) < obj.size * 0.7 &&
        Math.abs(obj.x - cornerObj.x) > obj.size * 0.5,
    )

    const verticalObjects = objectGroup.filter(
      (obj) =>
        obj !== cornerObj &&
        Math.abs(obj.x - cornerObj.x) < obj.size * 0.7 &&
        Math.abs(obj.y - cornerObj.y) > obj.size * 0.5,
    )

    if (horizontalObjects.length > 0 && verticalObjects.length > 0) {
      const furthestHorizontal = horizontalObjects.reduce(
        (furthest, obj) => (Math.abs(obj.x - cornerObj.x) > Math.abs(furthest.x - cornerObj.x) ? obj : furthest),
        horizontalObjects[0],
      )

      const furthestVertical = verticalObjects.reduce(
        (furthest, obj) => (Math.abs(obj.y - cornerObj.y) > Math.abs(furthest.y - cornerObj.y) ? obj : furthest),
        verticalObjects[0],
      )

      const minX = Math.min(cornerObj.x, furthestHorizontal.x, furthestVertical.x) - cornerObj.size * 0.6
      const maxX = Math.max(cornerObj.x, furthestHorizontal.x, furthestVertical.x) + cornerObj.size * 0.6
      const minY = Math.min(cornerObj.y, furthestHorizontal.y, furthestVertical.y) - cornerObj.size * 0.6
      const maxY = Math.max(cornerObj.y, furthestHorizontal.y, furthestVertical.y) + cornerObj.size * 0.6
      const sideCount = countRoofSides(objectGroup, minX, maxX, minY, maxY)
      const hasSledgeWallModule = objectGroup.some((obj) => isGridWallBox(obj) || isGridWallRock(obj))

      if (sideCount < 3) {
        continue
      }

      uShapes.push({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        createdAt: Date.now(),
        type: "u-shape",
        cornerRadius: 15,
        isSolid: hasSledgeWallModule && sideCount >= 3,
      })
    }
  }

  return uShapes
}

function getRoofFadeDistance(roof, x, y) {
  if (isPointUnderRoof(x, y, roof)) {
    return 0
  }

  const closestX = Math.min(Math.max(x, roof.x), roof.x + roof.width)
  const closestY = Math.min(Math.max(y, roof.y), roof.y + roof.height)
  const dx = x - closestX
  const dy = y - closestY

  if (x >= roof.x && x <= roof.x + roof.width && y >= roof.y && y <= roof.y + roof.height) {
    return 0
  }

  return Math.hypot(dx, dy)
}

function getRoofAlpha(roof, x, y) {
  const isPlayerUnderRoof = isPointUnderRoof(x, y, roof)
  if (isPlayerUnderRoof) {
    return ROOF_UNDER_ALPHA
  }

  const distanceToRoof = getRoofFadeDistance(roof, x, y)
  const farAlpha = roof.isSolid ? ROOF_FAR_ALPHA : ROOF_FAR_ALPHA * 0.52
  const nearAlpha = roof.isSolid ? ROOF_NEAR_ALPHA : ROOF_NEAR_ALPHA * 0.8

  if (distanceToRoof >= ROOF_FADE_DISTANCE) {
    return farAlpha
  }

  const fadeT = 1 - distanceToRoof / ROOF_FADE_DISTANCE
  return farAlpha + (nearAlpha - farAlpha) * fadeT
}

function drawRoofTexture(ctx, roof, screenX, screenY, roofAlpha, isSolid) {
  const tileWidth = Math.max(18, Math.min(28, roof.width / 5))
  const tileHeight = Math.max(14, Math.min(20, roof.height / 5))

  if (isSolid) {
    ctx.strokeStyle = `rgba(98, 48, 38, ${Math.min(0.8, roofAlpha + 0.15)})`
    ctx.lineWidth = 1.1

    for (let x = screenX; x < screenX + roof.width; x += tileWidth) {
      for (let y = screenY; y < screenY + roof.height; y += tileHeight) {
        const x1 = x + 2
        const y1 = y + 2
        const w = Math.min(tileWidth - 4, roof.width - (x - screenX))
        const h = Math.min(tileHeight - 4, roof.height - (y - screenY))

        if (w <= 6 || h <= 6) continue

        ctx.beginPath()
        ctx.moveTo(x1, y1 + h * 0.2)
        ctx.quadraticCurveTo(x1 + w * 0.5, y1 + h * 0.9, x1 + w, y1 + h * 0.2)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(x1 + 3, y1 + h * 0.4)
        ctx.lineTo(x1 + w - 3, y1 + h * 0.4)
        ctx.stroke()
      }
    }
    return
  }

  // Plain roof for basic structures: keep it visually simple and brown, with no texture overlay.
  ctx.strokeStyle = `rgba(98, 69, 42, ${Math.min(0.35, roofAlpha + 0.05)})`
  ctx.lineWidth = 1
  ctx.strokeRect(screenX + 1, screenY + 1, Math.max(4, roof.width - 2), Math.max(4, roof.height - 2))
}

// Improve the drawRoofAreas function to make roofs more visually distinct with rounded corners
function drawRoofAreas() {
  const { camera, ctx, player, dayNight } = gameState

  if (gameState.lightweightMode) {
    drawRoofAreasLightweight(ctx, camera, player)
    return
  }

  for (const roof of roofAreas) {
    const screenX = roof.x - camera.x
    const screenY = roof.y - camera.y
    const cornerRadius = roof.cornerRadius || 15
    const isPlayerUnderRoof = isPointUnderRoof(player.x, player.y, roof)
    const isNightPhase = dayNight && ["night", "duskToNight", "nightToDawn"].includes(dayNight.currentPhase)
    const roofAlpha = getRoofAlpha(roof, player.x, player.y)

    if (roofAlpha <= 0.002 && !isPlayerUnderRoof) {
      continue
    }

    if (roof.isSolid && isNightPhase && roofAlpha > 0.002) {
      const glowRadius = Math.max(roof.width, roof.height) * 0.5 + ROOF_EMIT_LIGHT_RADIUS
      const glow = ctx.createRadialGradient(
        screenX + roof.width * 0.5,
        screenY + roof.height * 0.5,
        0,
        screenX + roof.width * 0.5,
        screenY + roof.height * 0.5,
        glowRadius,
      )
      glow.addColorStop(0, `rgba(255, 212, 138, ${ROOF_EMIT_LIGHT_ALPHA})`)
      glow.addColorStop(0.5, `rgba(255, 212, 138, ${ROOF_EMIT_LIGHT_ALPHA * 0.4})`)
      glow.addColorStop(1, "rgba(255, 212, 138, 0)")
      ctx.fillStyle = glow
      ctx.fillRect(screenX - glowRadius * 0.25, screenY - glowRadius * 0.25, roof.width + glowRadius * 0.5, roof.height + glowRadius * 0.5)
    }

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(screenX + cornerRadius, screenY)
    ctx.lineTo(screenX + roof.width - cornerRadius, screenY)
    ctx.arcTo(screenX + roof.width, screenY, screenX + roof.width, screenY + cornerRadius, cornerRadius)
    ctx.lineTo(screenX + roof.width, screenY + roof.height - cornerRadius)
    ctx.arcTo(
      screenX + roof.width,
      screenY + roof.height,
      screenX + roof.width - cornerRadius,
      screenY + roof.height,
      cornerRadius,
    )
    ctx.lineTo(screenX + cornerRadius, screenY + roof.height)
    ctx.arcTo(screenX, screenY + roof.height, screenX, screenY + roof.height - cornerRadius, cornerRadius)
    ctx.lineTo(screenX, screenY + cornerRadius)
    ctx.arcTo(screenX, screenY, screenX + cornerRadius, screenY, cornerRadius)
    ctx.closePath()
    ctx.clip()

    ctx.fillStyle = roof.isSolid ? `rgba(155, 92, 68, ${roofAlpha})` : `rgba(119, 82, 45, ${roofAlpha})`
    ctx.fillRect(screenX, screenY, roof.width, roof.height)
    drawRoofTexture(ctx, roof, screenX, screenY, roofAlpha, roof.isSolid)
    ctx.restore()

    ctx.strokeStyle = roof.isSolid ? "rgba(139, 69, 19, 0.35)" : "rgba(139, 69, 19, 0.18)"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(screenX + cornerRadius, screenY)
    ctx.lineTo(screenX + roof.width - cornerRadius, screenY)
    ctx.arcTo(screenX + roof.width, screenY, screenX + roof.width, screenY + cornerRadius, cornerRadius)
    ctx.lineTo(screenX + roof.width, screenY + roof.height - cornerRadius)
    ctx.arcTo(
      screenX + roof.width,
      screenY + roof.height,
      screenX + roof.width - cornerRadius,
      screenY + roof.height,
      cornerRadius,
    )
    ctx.lineTo(screenX + cornerRadius, screenY + roof.height)
    ctx.arcTo(screenX, screenY + roof.height, screenX, screenY + roof.height - cornerRadius, cornerRadius)
    ctx.lineTo(screenX, screenY + cornerRadius)
    ctx.arcTo(screenX, screenY, screenX + cornerRadius, screenY, cornerRadius)
    ctx.closePath()
    ctx.stroke()

    if (isNightPhase && roof.isSolid && roofAlpha > 0.002) {
      const glowRect = ctx.createRadialGradient(
        screenX + roof.width * 0.5,
        screenY + roof.height * 0.5,
        0,
        screenX + roof.width * 0.5,
        screenY + roof.height * 0.5,
        Math.max(roof.width, roof.height),
      )
      glowRect.addColorStop(0, "rgba(255, 224, 154, 0.24)")
      glowRect.addColorStop(1, "rgba(255, 224, 154, 0)")
      ctx.fillStyle = glowRect
      ctx.fillRect(screenX - roof.width * 0.2, screenY - roof.height * 0.2, roof.width * 1.4, roof.height * 1.4)
    }

    if (isPlayerUnderRoof) {
      drawPlayerRoofShadow(ctx, player, camera)
    }
  }
}

function drawRoofAreasLightweight(ctx, camera, player) {
  for (const roof of roofAreas) {
    const screenX = roof.x - camera.x
    const screenY = roof.y - camera.y
    const isPlayerUnderRoof = isPointUnderRoof(player.x, player.y, roof)
    const alpha = getRoofAlpha(roof, player.x, player.y)

    if (alpha <= 0.002 && !isPlayerUnderRoof) {
      continue
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(screenX, screenY, roof.width, roof.height)
    ctx.clip()
    ctx.fillStyle = roof.isSolid ? `rgba(155, 92, 68, ${alpha <= 0.002 ? 0.08 : alpha})` : `rgba(119, 82, 45, ${alpha <= 0.002 ? 0.08 : alpha})`
    ctx.fillRect(screenX, screenY, roof.width, roof.height)
    drawRoofTexture(ctx, roof, screenX, screenY, alpha <= 0.002 ? 0.08 : alpha, roof.isSolid)
    ctx.restore()

    ctx.strokeStyle = roof.isSolid ? "rgba(98, 58, 24, 0.18)" : "rgba(98, 58, 24, 0.12)"
    ctx.lineWidth = 1
    ctx.strokeRect(screenX, screenY, roof.width, roof.height)

    if (isPlayerUnderRoof) {
      drawPlayerRoofShadow(ctx, player, camera)
    }
  }
}

// Draw a shadow over the player when under a roof
function drawPlayerRoofShadow(ctx, player, camera) {
  const screenX = player.x - camera.x
  const screenY = player.y - camera.y

  const light = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, ROOF_PLAYER_LIGHT_RADIUS)
  light.addColorStop(0, `rgba(255, 233, 160, ${ROOF_PLAYER_LIGHT_ALPHA})`)
  light.addColorStop(0.5, `rgba(255, 233, 160, ${ROOF_PLAYER_LIGHT_ALPHA * 0.45})`)
  light.addColorStop(1, "rgba(255, 233, 160, 0)")

  ctx.fillStyle = light
  ctx.beginPath()
  ctx.arc(screenX, screenY, ROOF_PLAYER_LIGHT_RADIUS, 0, Math.PI * 2)
  ctx.fill()
}

// Check if a point is under any roof
function isPointUnderRoof(x, y, specificRoof = null) {
  if (specificRoof) {
    return (
      x >= specificRoof.x &&
      x <= specificRoof.x + specificRoof.width &&
      y >= specificRoof.y &&
      y <= specificRoof.y + specificRoof.height
    )
  }

  for (const roof of roofAreas) {
    if (x >= roof.x && x <= roof.x + roof.width && y >= roof.y && y <= roof.y + roof.height) {
      return true
    }
  }
  return false
}

// Improve the isUnderRoof function to be more reliable
export function isUnderRoof(x, y) {
  return isPointUnderRoof(x, y)
}

// Add a helper function to set box floating state
function setBoxFloating(box, isFloating) {
  box.isFloating = isFloating

  if (isFloating) {
    // Initialize floating properties
    box.floatAngle = Math.random() * Math.PI * 2
    box.floatOffset = 0
  } else {
    // Reset floating properties
    box.floatOffset = 0
  }
}

// Add a function to create water splash effect
function createWaterSplashEffect(box) {
  // Create splash particles if they don't exist
  if (!gameState.splashEffects) {
    gameState.splashEffects = []
  }

  // Calculate splash force based on velocity
  const splashForce = Math.sqrt(box.throwVelocityX * box.throwVelocityX + box.throwVelocityY * box.throwVelocityY)

  // Create a new splash effect
  const splash = {
    x: box.x,
    y: box.y,
    size: box.size,
    force: Math.min(splashForce, 10), // Cap the force
    createdAt: Date.now(),
    particles: [],
  }

  // Create 10-20 water droplet particles
  const particleCount = 10 + Math.floor(Math.random() * 10 * (splashForce / 10))

  for (let i = 0; i < particleCount; i++) {
    // Random angle with bias upward
    const angle = Math.random() * Math.PI * 2
    // Random speed based on splash force
    const speed = 1 + Math.random() * splash.force * 0.4
    // Random size
    const size = 2 + Math.random() * 4
    // Random lifetime
    const lifetime = 300 + Math.random() * 700

    splash.particles.push({
      x: splash.x,
      y: splash.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 2, // Initial upward boost
      size: size,
      lifetime: lifetime,
      maxLifetime: lifetime,
      gravity: 0.1 + Math.random() * 0.1,
    })
  }

  gameState.splashEffects.push(splash)
}

// Add a function to draw and update splash effects
function drawAndUpdateSplashEffects() {
  if (!gameState.splashEffects) return

  const { camera, ctx } = gameState

  for (let i = gameState.splashEffects.length - 1; i >= 0; i--) {
    const splash = gameState.splashEffects[i]
    const elapsed = Date.now() - splash.createdAt

    // Remove splash if all particles are gone
    if (splash.particles.length === 0) {
      gameState.splashEffects.splice(i, 1)
      continue
    }

    // Draw ripple effect
    const rippleProgress = Math.min(elapsed / 500, 1)
    const rippleSize = splash.size * (0.5 + rippleProgress * 2)
    const rippleOpacity = Math.max(0, 0.7 - rippleProgress * 0.7)

    const screenX = splash.x - camera.x
    const screenY = splash.y - camera.y

    ctx.beginPath()
    ctx.arc(screenX, screenY, rippleSize, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 255, 255, ${rippleOpacity})`
    ctx.lineWidth = 2 * (1 - rippleProgress)
    ctx.stroke()

    // Update and draw particles
    for (let j = splash.particles.length - 1; j >= 0; j--) {
      const particle = splash.particles[j]

      // Update position
      particle.x += particle.velocityX
      particle.y += particle.velocityY

      // Apply gravity
      particle.velocityY += particle.gravity

      // Reduce lifetime
      particle.lifetime -= 16 // Roughly 60fps

      // Remove dead particles
      if (particle.lifetime <= 0) {
        splash.particles.splice(j, 1)
        continue
      }

      // Calculate screen position
      const particleX = particle.x - camera.x
      const particleY = particle.y - camera.y

      // Skip if off-screen
      if (
        particleX < -20 ||
        particleX > ctx.canvas.width + 20 ||
        particleY < -20 ||
        particleY > ctx.canvas.height + 20
      ) {
        continue
      }

      // Calculate opacity based on lifetime
      const opacity = particle.lifetime / particle.maxLifetime

      // Draw water droplet
      ctx.beginPath()
      ctx.arc(particleX, particleY, particle.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(164, 219, 232, ${opacity * 0.8})`
      ctx.fill()

      // Add highlight
      ctx.beginPath()
      ctx.arc(particleX - particle.size * 0.3, particleY - particle.size * 0.3, particle.size * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`
      ctx.fill()
    }
  }
}

// Draw the wooden box base
export function drawWoodenBox(ctx, box) {
  if (box.isSledgeCube) {
    drawSolidBrownCube(ctx, box)
    return
  }

  if (box.isSledgeSpiked) {
    drawSpikedMetalBox(ctx, box)
    return
  }

  if (box.isTrunk) {
    drawTrunkShape(ctx, box)
    return
  }

  const halfSize = box.size / 2

  // Base box
  ctx.fillStyle = "#8B4513" // SaddleBrown - base wood color
  drawRoundedRectLocal(ctx, -halfSize, -halfSize, box.size, box.size, 4)

  // Wood grain texture
  ctx.fillStyle = "#A0522D" // Sienna - slightly lighter

  // Draw horizontal planks
  const plankHeight = box.size / 4
  for (let i = 0; i < 4; i++) {
    const y = -halfSize + i * plankHeight
    // Make each plank slightly different width
    const plankWidth = box.size * (0.95 + Math.sin(i * 5) * 0.05)
    const xOffset = (box.size - plankWidth) / 2
    drawRoundedRectLocal(ctx, -halfSize + xOffset, y, plankWidth, plankHeight - 1, 2)
  }

  // Draw vertical borders/supports
  ctx.fillStyle = "#8B4513" // SaddleBrown
  const borderWidth = box.size / 12

  // Left border
  drawRoundedRectLocal(ctx, -halfSize, -halfSize, borderWidth, box.size, 2)

  // Right border
  drawRoundedRectLocal(ctx, halfSize - borderWidth, -halfSize, borderWidth, box.size, 2)

  // Draw metal reinforcements
  ctx.fillStyle = "#A9A9A9" // DarkGray

  // Corner reinforcements
  const cornerSize = box.size / 10
  drawRoundedRectLocal(ctx, -halfSize, -halfSize, cornerSize, cornerSize, 1)
  drawRoundedRectLocal(ctx, halfSize - cornerSize, -halfSize, cornerSize, cornerSize, 1)
  drawRoundedRectLocal(ctx, -halfSize, halfSize - cornerSize, cornerSize, cornerSize, 1)
  drawRoundedRectLocal(ctx, halfSize - cornerSize, halfSize - cornerSize, cornerSize, cornerSize, 1)
}

// Draw a chopped log left behind by a felled tree
function drawTrunkShape(ctx, box) {
  const radius = box.size * 0.47

  // Dark bark ring (outer)
  ctx.fillStyle = "#5a3719"
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()

  // Inner cut wood
  ctx.fillStyle = "#c8a06a"
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.74, 0, Math.PI * 2)
  ctx.fill()

  // Growth rings
  ctx.strokeStyle = "#a8814f"
  ctx.lineWidth = 1.2
  for (const ringScale of [0.26, 0.46, 0.64]) {
    ctx.beginPath()
    ctx.arc(0, 0, radius * ringScale, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Slight off-center pith detail for organic look
  ctx.fillStyle = "#9b7242"
  ctx.beginPath()
  ctx.arc(-radius * 0.1, radius * 0.06, radius * 0.1, 0, Math.PI * 2)
  ctx.fill()
}

function drawSolidBrownCube(ctx, box) {
  const halfSize = box.size * 0.44

  // Base block
  ctx.fillStyle = "#6b4423"
  drawRoundedRectLocal(ctx, -halfSize, -halfSize, halfSize * 2, halfSize * 2, 3)

  // Top highlight face
  ctx.fillStyle = "#845330"
  drawRoundedRectLocal(ctx, -halfSize * 0.9, -halfSize * 0.9, halfSize * 1.8, halfSize * 0.62, 2)

  // Side shade for depth
  ctx.fillStyle = "#4f331a"
  drawRoundedRectLocal(ctx, halfSize * 0.15, -halfSize * 0.88, halfSize * 0.72, halfSize * 1.76, 2)

  // Wood knot accents
  ctx.fillStyle = "#3f2612"
  ctx.beginPath()
  ctx.arc(-halfSize * 0.24, -halfSize * 0.08, halfSize * 0.14, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(halfSize * 0.2, halfSize * 0.22, halfSize * 0.12, 0, Math.PI * 2)
  ctx.fill()

  drawModuleOuterEdges(ctx, box, halfSize, "rgba(41, 23, 11, 0.56)")
}

function drawSpikedMetalBox(ctx, box) {
  const halfSize = box.size * 0.48

  // Metallic body
  ctx.fillStyle = "#3f4a54"
  drawRoundedRectLocal(ctx, -halfSize, -halfSize, halfSize * 2, halfSize * 2, 3)

  // Brighter center plate
  ctx.fillStyle = "#63707b"
  drawRoundedRectLocal(ctx, -halfSize * 0.78, -halfSize * 0.78, halfSize * 1.56, halfSize * 1.56, 2)

  // Metal seams
  ctx.strokeStyle = "#2a323a"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-halfSize * 0.72, 0)
  ctx.lineTo(halfSize * 0.72, 0)
  ctx.moveTo(0, -halfSize * 0.72)
  ctx.lineTo(0, halfSize * 0.72)
  ctx.stroke()

  // Spikes around edges
  const spikeLength = box.size * 0.22
  const spikeWidth = box.size * 0.12
  const spikePositions = [
    [0, -halfSize, 0],
    [halfSize, 0, Math.PI / 2],
    [0, halfSize, Math.PI],
    [-halfSize, 0, -Math.PI / 2],
  ]

  ctx.fillStyle = "#9ca7b1"
  for (const [sx, sy, angle] of spikePositions) {
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(0, -spikeWidth / 2)
    ctx.lineTo(spikeLength, 0)
    ctx.lineTo(0, spikeWidth / 2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  drawModuleOuterEdges(ctx, box, halfSize, "rgba(22, 27, 33, 0.58)")
}

function drawModuleOuterEdges(ctx, object, halfSize, strokeStyle) {
  const neighbors = getWallModuleNeighborMask(object)

  ctx.save()
  ctx.strokeStyle = strokeStyle
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

function getWallModuleNeighborMask(object) {
  const { tileX, tileY } = getSnappedTileCoords(object.x, object.y)

  return {
    top: isWallModuleAtTile(tileX, tileY - 1, object),
    right: isWallModuleAtTile(tileX + 1, tileY, object),
    bottom: isWallModuleAtTile(tileX, tileY + 1, object),
    left: isWallModuleAtTile(tileX - 1, tileY, object),
  }
}

function isWallModuleAtTile(tileX, tileY, selfObject) {
  for (const box of gameState.woodenBoxes || []) {
    if (!box || box === selfObject || box.isBeingThrown || box.isFloating || !isGridWallBox(box)) {
      continue
    }

    const tile = getSnappedTileCoords(box.x, box.y)
    if (tile.tileX === tileX && tile.tileY === tileY) {
      return true
    }
  }

  for (const rock of gameState.rocks || []) {
    if (!rock || rock === selfObject || !isGridWallRock(rock)) {
      continue
    }

    const tile = getSnappedTileCoords(rock.x, rock.y)
    if (tile.tileX === tileX && tile.tileY === tileY) {
      return true
    }
  }

  return false
}

// Draw damage overlay based on damage state
function drawDamageOverlay(ctx, box) {
  const halfSize = box.size / 2

  if (box.damageState === 1) {
    // Slightly damaged - show small cracks
    ctx.strokeStyle = "#5D4037" // Dark brown
    ctx.lineWidth = 1.5 // Slightly thicker lines

    // Draw a few cracks
    ctx.beginPath()
    ctx.moveTo(-halfSize + box.size * 0.2, -halfSize)
    ctx.lineTo(-halfSize + box.size * 0.3, -halfSize + box.size * 0.15)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(halfSize - box.size * 0.1, -halfSize + box.size * 0.3)
    ctx.lineTo(halfSize, -halfSize + box.size * 0.2)
    ctx.stroke()

    // Add a small dent
    ctx.beginPath()
    ctx.arc(halfSize - box.size * 0.3, halfSize - box.size * 0.3, box.size * 0.1, 0, Math.PI * 2)
    ctx.fillStyle = "#6D4C41" // Slightly darker brown
    ctx.fill()

    // Add a small chip on the edge
    ctx.fillStyle = "#8B4513" // SaddleBrown
    ctx.beginPath()
    ctx.moveTo(-halfSize, -halfSize + box.size * 0.2)
    ctx.lineTo(-halfSize + box.size * 0.1, -halfSize + box.size * 0.1)
    ctx.lineTo(-halfSize + box.size * 0.1, -halfSize + box.size * 0.3)
    ctx.closePath()
    ctx.fill()
  } else if (box.damageState === 2) {
    // Heavily damaged - show more cracks and broken pieces
    ctx.strokeStyle = "#5D4037" // Dark brown
    ctx.lineWidth = 2.5 // Even thicker lines

    // Draw more pronounced cracks
    ctx.beginPath()
    ctx.moveTo(-halfSize, -halfSize + box.size * 0.3)
    ctx.lineTo(-halfSize + box.size * 0.4, -halfSize + box.size * 0.5)
    ctx.lineTo(-halfSize + box.size * 0.2, halfSize - box.size * 0.2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(halfSize, -halfSize + box.size * 0.5)
    ctx.lineTo(halfSize - box.size * 0.6, halfSize - box.size * 0.3)
    ctx.stroke()

    // Add a third crack
    ctx.beginPath()
    ctx.moveTo(-halfSize + box.size * 0.7, -halfSize)
    ctx.lineTo(-halfSize + box.size * 0.5, halfSize - box.size * 0.4)
    ctx.stroke()

    // Draw broken corner piece
    ctx.fillStyle = "#8B4513" // SaddleBrown
    ctx.beginPath()
    ctx.moveTo(halfSize, halfSize)
    ctx.lineTo(halfSize - box.size * 0.3, halfSize)
    ctx.lineTo(halfSize, halfSize - box.size * 0.3)
    ctx.fill()

    // Draw another broken piece
    ctx.fillStyle = "#A0522D" // Sienna
    ctx.beginPath()
    ctx.moveTo(-halfSize, -halfSize)
    ctx.lineTo(-halfSize + box.size * 0.2, -halfSize)
    ctx.lineTo(-halfSize + box.size * 0.1, -halfSize + box.size * 0.2)
    ctx.closePath()
    ctx.fill()

    // Add splinters
    ctx.fillStyle = "#A0522D" // Sienna
    ctx.save()
    ctx.translate(halfSize - box.size * 0.15, halfSize - box.size * 0.15)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-box.size * 0.05, -box.size * 0.15, box.size * 0.1, box.size * 0.3)
    ctx.restore()

    // Add another splinter
    ctx.save()
    ctx.translate(-halfSize + box.size * 0.25, -halfSize + box.size * 0.25)
    ctx.rotate(-Math.PI / 3)
    ctx.fillRect(-box.size * 0.04, -box.size * 0.12, box.size * 0.08, box.size * 0.24)
    ctx.restore()
  }
}

// Draw floating effect for boxes on water
function drawFloatingEffect(ctx, box) {
  const halfSize = box.size / 2

  // Draw ripple effect below the box
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"
  ctx.lineWidth = 2

  // Ripple waves
  for (let i = 1; i <= 2; i++) {
    const rippleSize = halfSize * (1.1 + i * 0.15)
    const waveOffset = Math.sin(Date.now() / 500 + i) * 2

    ctx.beginPath()
    ctx.ellipse(0, halfSize + waveOffset, rippleSize, rippleSize * 0.4, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Water drips
  if (Math.random() < 0.03) {
    // Create water drip particles if they don't exist
    if (!gameState.waterDrips) {
      gameState.waterDrips = []
    }

    // Add a new drip at random position along the bottom of the box
    const dripX = box.x + (Math.random() - 0.5) * box.size
    const dripY = box.y + halfSize

    gameState.waterDrips.push({
      x: dripX,
      y: dripY,
      velocityY: 1 + Math.random(),
      size: 2 + Math.random() * 3,
      lifetime: 500 + Math.random() * 200,
      maxLifetime: 700,
      createdAt: Date.now(),
    })
  }
}

// Draw impact effect when box is hit
function drawImpactEffect(ctx, x, y, box) {
  const timeSinceHit = Date.now() - box.lastHitTime
  const progress = timeSinceHit / 300 // 0 to 1 over 300ms

  // Draw expanding circle
  const radius = box.size * 0.5 * progress
  const opacity = 1 - progress

  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`
  ctx.fill()

  // Draw impact lines
  const lineLength = box.size * 0.3 * progress

  ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`
  ctx.lineWidth = 2

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const innerRadius = radius * 0.7
    const outerRadius = radius + lineLength

    ctx.beginPath()
    ctx.moveTo(x + Math.cos(angle) * innerRadius, y + Math.sin(angle) * innerRadius)
    ctx.lineTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius)
    ctx.stroke()
  }

  // Draw tiny wooden particles flying off
  if (timeSinceHit < 150) {
    for (let i = 0; i < 2; i++) {
      const particleAngle = Math.random() * Math.PI * 2
      const particleDistance = box.size * 0.6 * progress

      ctx.fillStyle = "#A0522D" // Sienna - wood color
      ctx.beginPath()
      ctx.arc(
        x + Math.cos(particleAngle) * particleDistance,
        y + Math.sin(particleAngle) * particleDistance,
        2,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }
}

// Draw the grabbed wooden box
function drawGrabbedWoodenBox(ctx, camera) {
  const box = gameState.grabbedWoodenBox
  const player = gameState.player

  // Calculate screen position (in front of player)
  const angle = player.direction
  const holdDistance = player.size + box.size * 0.7

  const boxX = player.x + Math.cos(angle) * holdDistance
  const boxY = player.y + Math.sin(angle) * holdDistance

  const screenX = boxX - camera.x
  const screenY = boxY - camera.y

  // Draw shadow with reduced size for held objects
  if (box.isTrunk && !box.isSledgeCube && !box.isSledgeSpiked) {
    createShadow(ctx, screenX, screenY, box.size * 0.82, "circle", null, 0, 0.95)
  } else {
    createShadow(
      ctx,
      screenX,
      screenY,
      box.size,
      "rectangle",
      {
        width: box.size,
        height: box.size,
        radius: 4,
      },
      angle,
      0.95,
    )
  }

  // Draw box
  ctx.save()
  ctx.translate(screenX, screenY)
  ctx.rotate(angle)

  // Draw the base wooden box
  drawWoodenBox(ctx, box)

  // Draw damage overlays based on damage state
  if (box.damageState > 0) {
    drawDamageOverlay(ctx, box)
  }

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

// Helper function to draw rounded rectangles
function drawRoundedRectLocal(ctx, x, y, width, height, radius) {
  if (width < 2 * radius) radius = width / 2
  if (height < 2 * radius) radius = height / 2

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
  ctx.fill()
}

// Export the roof detection functions for use in other modules
export { roofAreas }