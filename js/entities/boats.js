import { gameState } from "../core/game-state.js"
import {
  TILE_SIZE,
  TERRAIN_TYPES,
  CAR_INTERACTION_RANGE,
  WOODEN_BOX_FLOAT_SPEED,
  BOAT_SIZE,
  CAR_MAX_HEALTH,
  CAR_MAX_SPEED,
  CAR_ACCELERATION,
  CAR_DECELERATION,
  CAR_DRIFT_FACTOR,
  BOAT_COUNT,
  MAX_BOATS,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { findNearestSafePlayerPosition } from "../utils/player-position-utils.js"
import { triggerGameOver } from "../core/game.js"
import { isSpawnPositionClear, isWaterPosition } from "../utils/spawn-utils.js"

const BOAT_FLOAT_BOB = 2.5
const BOAT_WAKE_LIFETIME = 420

export function generateBoats(count, options = {}) {
  const { terrain, player } = gameState
  const { ignoreLimit = false } = options

  if (!gameState.boats) {
    gameState.boats = []
  }

  const boatsToSpawn = ignoreLimit ? count : Math.min(count, MAX_BOATS - gameState.boats.length)

  for (let i = 0; i < boatsToSpawn; i++) {
    let placed = false
    let attempts = 0

    while (!placed && attempts < 120) {
      attempts++

      const x = Math.random() * (terrain[0].length * TILE_SIZE)
      const y = Math.random() * (terrain.length * TILE_SIZE)
      const tileX = Math.floor(x / TILE_SIZE)
      const tileY = Math.floor(y / TILE_SIZE)

      if (
        !isSpawnPositionClear(x, y, BOAT_SIZE, {
          requireWater: true,
          playerDistanceBuffer: 260,
          includeBombs: false,
          includeApples: false,
          includeRocks: false,
          includeEnemies: false,
        })
      ) {
        continue
      }

      if (gameState.boats.some((boat) => getDistance(x, y, boat.x, boat.y) < BOAT_SIZE * 4.5)) {
        continue
      }

      gameState.boats.push(createBoat(x, y))
      placed = true
    }
  }
}

function createBoat(x, y) {
  return {
    x,
    y,
    size: BOAT_SIZE,
    vehicleType: "boat",
    health: CAR_MAX_HEALTH,
    lastHit: 0,
    direction: Math.random() * Math.PI * 2,
    velocity: { x: 0, y: 0 },
    currentSpeed: 0,
    floatAngle: Math.random() * Math.PI * 2,
    floatOffset: 0,
    bowWaves: [],
    foamTrail: [],
    isBroken: false,
  }
}

function getBoatCollisionRadius(boat) {
  return boat.size * 0.62
}

function isInsideWorldWater(x, y) {
  return isWaterPosition(x, y)
}

function canBoxMoveTo(box, x, y, pushingBoat) {
  if (!isInsideWorldWater(x, y)) {
    return false
  }

  for (const otherBoat of gameState.boats) {
    if (otherBoat === pushingBoat) {
      continue
    }

    const distance = getDistance(x, y, otherBoat.x, otherBoat.y)
    if (distance < box.size + getBoatCollisionRadius(otherBoat) * 0.95) {
      return false
    }
  }

  for (const otherBox of gameState.woodenBoxes) {
    if (otherBox === box || !otherBox.isFloating || otherBox.isBeingThrown) {
      continue
    }

    const distance = getDistance(x, y, otherBox.x, otherBox.y)
    if (distance < box.size + otherBox.size * 0.9) {
      return false
    }
  }

  return true
}

function pushFloatingBox(box, boat, directionX, directionY, forceScale = 1) {
  const pushDistance = Math.max(boat.currentSpeed * 1.35, WOODEN_BOX_FLOAT_SPEED * 3.2) * forceScale
  const targetX = box.x + directionX * pushDistance
  const targetY = box.y + directionY * pushDistance

  if (!canBoxMoveTo(box, targetX, targetY, boat)) {
    return false
  }

  box.x = targetX
  box.y = targetY
  box.floatAngle = Math.atan2(directionY, directionX)
  box.floatOffset = 0
  return true
}

function canBoatOccupyPosition(boat, x, y, ignoredBoat = null) {
  if (!isInsideWorldWater(x, y)) {
    return false
  }

  for (const otherBoat of gameState.boats) {
    if (otherBoat === boat || otherBoat === ignoredBoat) {
      continue
    }

    const distance = getDistance(x, y, otherBoat.x, otherBoat.y)
    if (distance < getBoatCollisionRadius(boat) + getBoatCollisionRadius(otherBoat)) {
      return false
    }
  }

  for (const box of gameState.woodenBoxes) {
    if (!box.isFloating || box.isBeingThrown) {
      continue
    }

    const distance = getDistance(x, y, box.x, box.y)
    if (distance < getBoatCollisionRadius(boat) + box.size * 0.95) {
      return false
    }
  }

  return true
}

function bumpBoat(targetBoat, sourceBoat, directionX, directionY) {
  const bumpDistance = Math.max(sourceBoat.currentSpeed * 0.8, WOODEN_BOX_FLOAT_SPEED * 2.2)
  const targetX = targetBoat.x + directionX * bumpDistance
  const targetY = targetBoat.y + directionY * bumpDistance

  if (!canBoatOccupyPosition(targetBoat, targetX, targetY, sourceBoat)) {
    return false
  }

  targetBoat.x = targetX
  targetBoat.y = targetY
  targetBoat.floatAngle = Math.atan2(directionY, directionX)
  targetBoat.currentSpeed = Math.max(targetBoat.currentSpeed * 0.35, bumpDistance * 0.18)
  targetBoat.velocity.x = directionX * targetBoat.currentSpeed
  targetBoat.velocity.y = directionY * targetBoat.currentSpeed
  return true
}

function resolveBoatMovement(boat, newX, newY, movementAngle, options = {}) {
  const { pushBoxes = false, pushForceScale = 1, bumpBoats = false, damageOnBoatCollision = false } = options

  if (!isInsideWorldWater(newX, newY)) {
    return { moved: false, turningAmount: 0 }
  }

  const nextRadius = getBoatCollisionRadius(boat)
  const directionX = Math.cos(movementAngle)
  const directionY = Math.sin(movementAngle)

  for (const otherBoat of gameState.boats) {
    if (otherBoat === boat) {
      continue
    }

    const distance = getDistance(newX, newY, otherBoat.x, otherBoat.y)
    if (distance < nextRadius + getBoatCollisionRadius(otherBoat)) {
      if (bumpBoats) {
        bumpBoat(otherBoat, boat, directionX, directionY)
      }

      if (damageOnBoatCollision) {
        damageBoat(boat)
      }

      return { moved: false, turningAmount: 0 }
    }
  }

  for (const box of gameState.woodenBoxes) {
    if (!box.isFloating || box.isBeingThrown) {
      continue
    }

    const distance = getDistance(newX, newY, box.x, box.y)
    if (distance >= nextRadius + box.size * 0.95) {
      continue
    }

    if (!pushBoxes || !pushFloatingBox(box, boat, directionX, directionY, pushForceScale)) {
      return { moved: false, turningAmount: 0 }
    }
  }

  boat.x = newX
  boat.y = newY
  return { moved: true }
}

export function checkBoatInteraction() {
  if (gameState.isInCar) {
    return null
  }

  for (const boat of gameState.boats) {
    if (getDistance(gameState.player.x, gameState.player.y, boat.x, boat.y) < CAR_INTERACTION_RANGE) {
      return boat
    }
  }

  return null
}

export function enterBoat(boat) {
  if (!boat || gameState.isInCar) {
    return false
  }

  gameState.isInCar = true
  gameState.drivingCar = boat
  gameState.player.x = boat.x
  gameState.player.y = boat.y
  return true
}

export function exitBoat() {
  if (!gameState.isInCar || !gameState.drivingCar || gameState.drivingCar.vehicleType !== "boat") {
    return false
  }

  const boat = gameState.drivingCar
  const safeExitPosition = findNearestSafePlayerPosition(boat.x, boat.y, {
    baseDistance: boat.size * 0.8,
    maxDistance: boat.size + 220,
    preferredAngles: [
      boat.direction + Math.PI / 2,
      boat.direction - Math.PI / 2,
      boat.direction + Math.PI,
      boat.direction,
    ],
  })

  gameState.isInCar = false
  gameState.drivingCar = null

  if (!safeExitPosition) {
    gameState.player.health = 0
    triggerGameOver()
    return true
  }

  gameState.player.x = safeExitPosition.x
  gameState.player.y = safeExitPosition.y
  return true
}

export function damageBoat(boat) {
  if (!boat || boat.isBroken) {
    return
  }

  if (Date.now() - boat.lastHit < 1000) {
    return
  }

  boat.health--
  boat.lastHit = Date.now()

  if (!gameState.hitEffects) {
    gameState.hitEffects = []
  }

  gameState.hitEffects.push({
    x: boat.x,
    y: boat.y,
    size: boat.size * 1.15,
    createdAt: Date.now(),
    duration: 220,
  })

  if (boat.health <= 0) {
    destroyBoat(boat)
  }
}

export function destroyBoat(boat) {
  if (!boat || boat.isBroken) {
    return
  }

  boat.health = 0
  boat.isBroken = true
  boat.currentSpeed = 0
  boat.velocity.x = 0
  boat.velocity.y = 0
  boat.floatAngle = boat.direction + Math.PI * 0.5
}

export function drawAndUpdateBoats() {
  const { ctx, camera, boats, isInCar, drivingCar, player } = gameState

  for (const boat of boats) {
    if (isInCar && drivingCar === boat) {
      if (boat.isBroken) {
        updateBoatDrift(boat)
        player.x = boat.x
        player.y = boat.y
      } else {
        updateBoatPosition(boat)
      }
    } else {
      updateBoatDrift(boat)
    }

    updateBoatParticles(boat)

    const screenX = boat.x - camera.x
    const screenY = boat.y - camera.y - boat.floatOffset

    if (
      screenX + boat.size < 0 ||
      screenX - boat.size > ctx.canvas.width ||
      screenY + boat.size < 0 ||
      screenY - boat.size > ctx.canvas.height
    ) {
      continue
    }

    drawBoatEffects(ctx, boat, camera)

    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(boat.direction)

    drawBoatShadow(ctx, boat)
    drawBoatHull(ctx, boat)

    ctx.restore()

    if (!isInCar && getDistance(player.x, player.y, boat.x, boat.y) < CAR_INTERACTION_RANGE) {
      drawBoatPrompt(ctx, screenX, screenY)
    }
  }
}

function updateBoatPosition(boat) {
  const { player, keys, isMobile, joystickActive, joystickAngle, joystickDistance } = gameState

  let isAccelerating = false
  let directionMultiplier = 0

  if (isMobile && joystickActive) {
    player.direction = joystickAngle
    isAccelerating = joystickDistance > 0.1
    directionMultiplier = joystickDistance
  } else {
    const movingForward = keys["ArrowUp"] || keys["w"]
    const movingBackward = keys["ArrowDown"] || keys["s"]

    if (movingForward || movingBackward) {
      isAccelerating = true
      directionMultiplier = movingForward ? 1 : -0.55
    }
  }

  const directionDifference = normalizeAngle(player.direction - boat.direction)
  const turnSpeed = Math.min(0.1 + (boat.currentSpeed / CAR_MAX_SPEED) * 0.12, 0.22)
  boat.direction += directionDifference * turnSpeed

  if (isAccelerating) {
    boat.currentSpeed = Math.min(boat.currentSpeed + CAR_ACCELERATION, CAR_MAX_SPEED * 0.92)
  } else {
    boat.currentSpeed = Math.max(boat.currentSpeed - CAR_DECELERATION * 0.8, 0)
  }

  const forwardX = Math.cos(boat.direction) * directionMultiplier
  const forwardY = Math.sin(boat.direction) * directionMultiplier
  const sideX = Math.cos(boat.direction + Math.PI / 2)
  const sideY = Math.sin(boat.direction + Math.PI / 2)
  const turningAmount = Math.abs(directionDifference) * 1.6

  boat.velocity.x = forwardX * boat.currentSpeed
  boat.velocity.y = forwardY * boat.currentSpeed

  if (boat.currentSpeed > 1 && Math.abs(directionDifference) > 0.02) {
    const driftDirection = directionDifference > 0 ? 1 : -1
    boat.velocity.x += sideX * driftDirection * turningAmount * boat.currentSpeed * (1 - CAR_DRIFT_FACTOR)
    boat.velocity.y += sideY * driftDirection * turningAmount * boat.currentSpeed * (1 - CAR_DRIFT_FACTOR)
  }

  const newX = boat.x + boat.velocity.x
  const newY = boat.y + boat.velocity.y
  const movementAngle = Math.atan2(boat.velocity.y || Math.sin(boat.direction), boat.velocity.x || Math.cos(boat.direction))
  const movementResult = resolveBoatMovement(boat, newX, newY, movementAngle, {
    pushBoxes: true,
    bumpBoats: true,
    damageOnBoatCollision: true,
  })

  if (movementResult.moved) {
    gameState.player.x = boat.x
    gameState.player.y = boat.y
    spawnBoatWake(boat, turningAmount)
  } else {
    boat.currentSpeed *= 0.35
    boat.velocity.x *= 0.2
    boat.velocity.y *= 0.2
  }
}

function updateBoatDrift(boat) {
  const tileX = Math.floor(boat.x / TILE_SIZE)
  const tileY = Math.floor(boat.y / TILE_SIZE)

  if (!isWaterTile(tileX, tileY)) {
    boat.floatOffset = Math.sin(Date.now() / 420) * 1.2
    return
  }

  boat.floatOffset = Math.sin(Date.now() / 420) * BOAT_FLOAT_BOB

  const nearestLand = findNearestLandTile(boat.x, boat.y, 6)
  if (nearestLand) {
    const landDistance = getDistance(boat.x, boat.y, nearestLand.x, nearestLand.y)
    const landAngle = Math.atan2(nearestLand.y - boat.y, nearestLand.x - boat.x)

    if (landDistance < TILE_SIZE * 1.35) {
      boat.currentSpeed = 0
      boat.velocity.x = 0
      boat.velocity.y = 0
      return
    }

    const angleDiff = normalizeAngle(landAngle - boat.floatAngle)
    boat.floatAngle += angleDiff * 0.08
  } else if (Math.random() < 0.02) {
    boat.floatAngle += ((Math.random() - 0.5) * Math.PI) / 5
  }

  boat.x += Math.cos(boat.floatAngle) * WOODEN_BOX_FLOAT_SPEED * 0.9
  boat.y += Math.sin(boat.floatAngle) * WOODEN_BOX_FLOAT_SPEED * 0.9

  const driftX = boat.x
  const driftY = boat.y
  boat.x -= Math.cos(boat.floatAngle) * WOODEN_BOX_FLOAT_SPEED * 0.9
  boat.y -= Math.sin(boat.floatAngle) * WOODEN_BOX_FLOAT_SPEED * 0.9

  const driftResult = resolveBoatMovement(boat, driftX, driftY, boat.floatAngle, {
    pushBoxes: !boat.isBroken,
    pushForceScale: 0.7,
  })

  if (!driftResult.moved) {
    boat.currentSpeed = 0
    boat.velocity.x = 0
    boat.velocity.y = 0
  }

  if (boat.isBroken) {
    spawnBoatWake(boat, 0.12)
  } else if (Math.random() < 0.04) {
    spawnBowWave(boat)
  }
}

function updateBoatParticles(boat) {
  for (let i = boat.foamTrail.length - 1; i >= 0; i--) {
    const foam = boat.foamTrail[i]
    foam.x += foam.vx
    foam.y += foam.vy
    foam.alpha -= 0.03
    foam.size *= 0.985

    if (foam.alpha <= 0.02 || foam.size <= 0.5) {
      boat.foamTrail.splice(i, 1)
    }
  }

  for (let i = boat.bowWaves.length - 1; i >= 0; i--) {
    const wave = boat.bowWaves[i]
    const elapsed = Date.now() - wave.createdAt

    if (elapsed >= BOAT_WAKE_LIFETIME) {
      boat.bowWaves.splice(i, 1)
      continue
    }

    wave.progress = elapsed / BOAT_WAKE_LIFETIME
  }
}

function drawBoatEffects(ctx, boat, camera) {
  for (const foam of boat.foamTrail) {
    ctx.save()
    ctx.globalAlpha = foam.alpha
    ctx.fillStyle = "rgba(245, 248, 252, 0.95)"
    ctx.beginPath()
    ctx.arc(foam.x - camera.x, foam.y - camera.y, foam.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"
  for (const wave of boat.bowWaves) {
    const radius = wave.size * (0.6 + wave.progress * 1.6)
    ctx.globalAlpha = 1 - wave.progress
    ctx.lineWidth = Math.max(1, 2 * (1 - wave.progress))
    ctx.beginPath()
    ctx.ellipse(wave.x - camera.x, wave.y - camera.y, radius, radius * 0.38, wave.rotation, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBoatShadow(ctx, boat) {
  ctx.save()
  ctx.fillStyle = "rgba(0, 0, 0, 0.17)"
  ctx.beginPath()
  ctx.ellipse(5, 6, boat.size * 0.72, boat.size * 0.34, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBoatHull(ctx, boat) {
  const hullLength = boat.size * 1.28
  const hullWidth = boat.size * 0.62

  ctx.fillStyle = boat.isBroken ? "#8d7d6a" : "#6f4f38"
  ctx.beginPath()
  ctx.moveTo(hullLength * 0.52, 0)
  ctx.quadraticCurveTo(hullLength * 0.18, -hullWidth * 0.88, -hullLength * 0.48, -hullWidth * 0.44)
  ctx.lineTo(-hullLength * 0.56, 0)
  ctx.lineTo(-hullLength * 0.48, hullWidth * 0.44)
  ctx.quadraticCurveTo(hullLength * 0.18, hullWidth * 0.88, hullLength * 0.52, 0)
  ctx.closePath()
  ctx.fill()

  if (boat.isBroken) {
    ctx.fillStyle = "#cabca4"
    ctx.fillRect(-boat.size * 0.48, -boat.size * 0.22, boat.size * 0.96, boat.size * 0.44)
    ctx.strokeStyle = "rgba(76, 58, 41, 0.6)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-boat.size * 0.42, -boat.size * 0.05)
    ctx.lineTo(boat.size * 0.24, boat.size * 0.1)
    ctx.moveTo(-boat.size * 0.18, boat.size * 0.16)
    ctx.lineTo(boat.size * 0.36, -boat.size * 0.12)
    ctx.stroke()
    return
  }

  ctx.fillStyle = "#a97c50"
  ctx.fillRect(-boat.size * 0.32, -boat.size * 0.24, boat.size * 0.54, boat.size * 0.48)

  ctx.fillStyle = "#d7c7ad"
  ctx.fillRect(-boat.size * 0.16, -boat.size * 0.19, boat.size * 0.32, boat.size * 0.38)

  ctx.strokeStyle = "rgba(250, 250, 250, 0.26)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-boat.size * 0.34, -boat.size * 0.28)
  ctx.lineTo(boat.size * 0.34, -boat.size * 0.06)
  ctx.moveTo(-boat.size * 0.34, boat.size * 0.28)
  ctx.lineTo(boat.size * 0.34, boat.size * 0.06)
  ctx.stroke()
}

function drawBoatPrompt(ctx, screenX, screenY) {
  ctx.save()
  ctx.font = "14px Arial"
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)"
  ctx.fillText("Space / A", screenX, screenY - 48)
  ctx.restore()
}

function spawnBoatWake(boat, turningAmount) {
  const sternAngle = boat.direction + Math.PI
  const sternDistance = boat.size * 0.68
  const spread = boat.size * 0.18

  if (Math.random() < 0.55) {
    boat.foamTrail.push({
      x: boat.x + Math.cos(sternAngle) * sternDistance + (Math.random() - 0.5) * spread,
      y: boat.y + Math.sin(sternAngle) * sternDistance + (Math.random() - 0.5) * spread,
      vx: -boat.velocity.x * 0.08 + (Math.random() - 0.5) * 0.35,
      vy: -boat.velocity.y * 0.08 + (Math.random() - 0.5) * 0.35,
      size: 3 + Math.random() * 3 + turningAmount * 2,
      alpha: 0.72,
    })
  }

  if (Math.random() < 0.3 + turningAmount * 0.2) {
    spawnBowWave(boat)
  }
}

function spawnBowWave(boat) {
  const bowAngle = boat.direction
  boat.bowWaves.push({
    x: boat.x + Math.cos(bowAngle) * boat.size * 0.7,
    y: boat.y + Math.sin(bowAngle) * boat.size * 0.7,
    size: boat.size * 0.22,
    rotation: bowAngle,
    createdAt: Date.now(),
    progress: 0,
  })
}

function findNearestLandTile(originX, originY, scanRadius) {
  const { terrain } = gameState
  const tileX = Math.floor(originX / TILE_SIZE)
  const tileY = Math.floor(originY / TILE_SIZE)

  let closestLand = null
  let closestDistance = Infinity

  for (let y = tileY - scanRadius; y <= tileY + scanRadius; y++) {
    for (let x = tileX - scanRadius; x <= tileX + scanRadius; x++) {
      if (x < 0 || y < 0 || y >= terrain.length || x >= terrain[0].length) {
        continue
      }

      if (terrain[y][x] === TERRAIN_TYPES.WATER) {
        continue
      }

      const worldX = x * TILE_SIZE + TILE_SIZE / 2
      const worldY = y * TILE_SIZE + TILE_SIZE / 2
      const distance = getDistance(originX, originY, worldX, worldY)

      if (distance < closestDistance) {
        closestDistance = distance
        closestLand = { x: worldX, y: worldY }
      }
    }
  }

  return closestLand
}

function isWaterTile(tileX, tileY) {
  const { terrain } = gameState
  return tileX >= 0 && tileY >= 0 && tileY < terrain.length && tileX < terrain[0].length && terrain[tileY][tileX] === TERRAIN_TYPES.WATER
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}