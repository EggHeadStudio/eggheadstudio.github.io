import { gameState } from "../core/game-state.js"
import {
  TILE_SIZE,
  TERRAIN_TYPES,
  CAR_INTERACTION_RANGE,
  WOODEN_BOX_FLOAT_SPEED,
  BOAT_SIZE,
  CAR_MAX_HEALTH,
  BOAT_MAX_SPEED,
  BOAT_ACCELERATION,
  BOAT_DECELERATION,
  BOAT_DRIFT_FACTOR,
  BOAT_MAX_RUDDER_ANGLE,
  BOAT_STEER_SPEED,
  BOAT_HULL_GRIP,
  BOAT_RUDDER_GRIP,
  BOAT_HULL_STIFFNESS,
  BOAT_RUDDER_STIFFNESS,
  BOAT_YAW_INERTIA,
  BOAT_YAW_DAMPING,
  BOAT_STEER_SENSITIVITY_FALLOFF,
  BOAT_LATERAL_DRAG,
  BOAT_POWER_OVERSTEER,
  BOAT_COUNT,
  MAX_BOATS,
  BOAT_TOW_CAP,
  BOAT_TOW_SLOWDOWN_MULTIPLIER,
  BOAT_TOW_SMOKE_ALPHA,
  BOAT_FUEL_MIN,
  BOAT_FUEL_MAX,
  BOAT_FUEL_DRAIN_FORWARD,
  VEHICLE_WRECK_DESPAWN_DELAY_MS,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import {
  createVehicleMotion,
  stepVehicleMotion,
  getMotionVelocity,
  dampMotionAfterImpact,
  resetVehicleMotion,
} from "./vehicle-physics.js"
import { findNearestSafePlayerPosition } from "../utils/player-position-utils.js"
import { triggerGameOver } from "../core/game.js"
import { drawWoodenBox } from "./wooden-boxes.js"
import { isSpawnPositionClear, isWaterPosition } from "../utils/spawn-utils.js"
import { getRandomLoadedWorldPosition } from "../world/world-manager.js"

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

      const position = getRandomLoadedWorldPosition(280)
      const x = position.x
      const y = position.y
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

export function createBoat(x, y) {
  const fuelCapacity = Math.max(BOAT_FUEL_MIN, BOAT_FUEL_MAX)

  return {
    x,
    y,
    size: BOAT_SIZE,
    vehicleType: "boat",
    health: CAR_MAX_HEALTH,
    lastHit: 0,
    direction: Math.random() * Math.PI * 2,
    velocity: { x: 0, y: 0 },
    motion: null,
    forwardSpeed: 0,
    lateralSpeed: 0,
    currentSpeed: 0,
    floatAngle: Math.random() * Math.PI * 2,
    floatOffset: 0,
    bowWaves: [],
    foamTrail: [],
    towedBoxes: [],
    isBroken: false,
    wreckCleanupAt: null,
    fuelCapacity,
    fuel: getRandomFuelAmount(BOAT_FUEL_MIN, BOAT_FUEL_MAX),
  }
}

function isBoatAtLand(boat) {
  const tileX = Math.floor(boat.x / TILE_SIZE)
  const tileY = Math.floor(boat.y / TILE_SIZE)
  return tileX >= 0 && tileY >= 0 && tileY < gameState.terrain.length && tileX < gameState.terrain[0].length && gameState.terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
}

function getTowSlotOffset(index, count) {
  const spread = Math.min(20, 6 + count * 2.5)
  const offsetSide = (index - (count - 1) / 2) * spread
  return { x: -Math.cos(Math.PI / 2 + 0.3) * offsetSide, y: Math.sin(Math.PI / 2 + 0.3) * offsetSide }
}

function isTowEligibleBox(box) {
  if (!box || box.isBeingThrown || box.isTowedByBoat) {
    return false
  }

  if (box.isFloating) {
    return true
  }

  const { terrain } = gameState
  const tileX = Math.floor(box.x / TILE_SIZE)
  const tileY = Math.floor(box.y / TILE_SIZE)

  if (tileX < 0 || tileY < 0 || tileY >= terrain.length || tileX >= terrain[0].length) {
    return false
  }

  if (terrain[tileY][tileX] === TERRAIN_TYPES.WATER) {
    return false
  }

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const neighborX = tileX + dx
      const neighborY = tileY + dy
      if (neighborX < 0 || neighborY < 0 || neighborY >= terrain.length || neighborX >= terrain[0].length) {
        continue
      }
      if (terrain[neighborY][neighborX] === TERRAIN_TYPES.WATER) {
        return true
      }
    }
  }

  return false
}

function updateBoatTow(boat) {
  if (!boat || boat.isBroken) {
    return
  }

  const { woodenBoxes } = gameState
  const maxBoxes = BOAT_TOW_CAP

  for (let i = woodenBoxes.length - 1; i >= 0; i--) {
    const box = woodenBoxes[i]
    if (!isTowEligibleBox(box)) {
      continue
    }

    const distance = getDistance(boat.x, boat.y, box.x, box.y)
    const towRange = boat.size * 1.25 + box.size * 1.45
    if (boat.towedBoxes.length < maxBoxes && distance < towRange) {
      box.isTowedByBoat = boat
      box.towedIndex = boat.towedBoxes.length
      boat.towedBoxes.push(box)
      woodenBoxes.splice(i, 1)
    }
  }

  const fullLoad = boat.towedBoxes.length >= maxBoxes
  if (fullLoad) {
    const slowdown = BOAT_TOW_SLOWDOWN_MULTIPLIER
    boat.currentSpeed *= slowdown
    if (boat.currentSpeed < 0.5) {
      boat.currentSpeed = 0.5
    }
  }

  for (let i = 0; i < boat.towedBoxes.length; i++) {
    const box = boat.towedBoxes[i]
    if (!box) continue

    const aheadAngle = boat.direction + Math.PI
    const slotOffset = getTowSlotOffset(i, boat.towedBoxes.length)
    const targetX = boat.x + Math.cos(aheadAngle) * (boat.size * 0.8 + 18 + i * 16) + Math.cos(boat.direction + Math.PI / 2) * slotOffset.x
    const targetY = boat.y + Math.sin(aheadAngle) * (boat.size * 0.8 + 18 + i * 16) + Math.sin(boat.direction + Math.PI / 2) * slotOffset.y

    const moveStrength = boat.towedBoxes.length >= maxBoxes ? 0.18 : 0.32
    box.x += (targetX - box.x) * moveStrength
    box.y += (targetY - box.y) * moveStrength
    box.isFloating = true
    box.floatAngle = boat.direction + Math.PI
    box.floatOffset = 0
  }
}

function dropTowedBoxes(boat) {
  if (!boat || !Array.isArray(boat.towedBoxes) || boat.towedBoxes.length === 0) {
    return
  }

  const { terrain } = gameState
  const centerX = boat.x
  const centerY = boat.y
  const dropped = []

  for (let i = 0; i < boat.towedBoxes.length; i++) {
    const box = boat.towedBoxes[i]
    if (!box) continue

    let placed = false
    const searchSteps = 18
    let landCandidate = null
    let waterCandidate = null
    let nearestLandForWater = null

    for (let step = 0; step < searchSteps; step++) {
      const angle = (Math.PI * 2 * step) / searchSteps + (Math.random() * Math.PI) / 7
      const dist = 35 + step * 12 + Math.random() * 16
      const candidateX = centerX + Math.cos(angle) * dist
      const candidateY = centerY + Math.sin(angle) * dist
      const tileX = Math.floor(candidateX / TILE_SIZE)
      const tileY = Math.floor(candidateY / TILE_SIZE)

      if (tileX < 0 || tileY < 0 || tileY >= terrain.length || tileX >= terrain[0].length) {
        continue
      }

      const tileType = terrain[tileY][tileX]
      const isClear = !gameState.woodenBoxes.some((otherBox) => {
        if (!otherBox || otherBox === box || otherBox.isBeingThrown || otherBox.isTowedByBoat) return false
        return getDistance(candidateX, candidateY, otherBox.x, otherBox.y) < box.size + otherBox.size * 1.1
      })

      if (tileType !== TERRAIN_TYPES.WATER && isClear) {
        landCandidate = { x: candidateX, y: candidateY }
        break
      }

      if (tileType === TERRAIN_TYPES.WATER && isClear) {
        waterCandidate = { x: candidateX, y: candidateY }
        nearestLandForWater = findNearestLandTile(candidateX, candidateY, 6)
      }
    }

    if (landCandidate) {
      box.x = landCandidate.x
      box.y = landCandidate.y
      box.isFloating = false
      box.floatAngle = 0
      box.floatOffset = 0
      box.isTowedByBoat = null
      box.towedIndex = null
      box.rotation = 0
      gameState.woodenBoxes.push(box)
      placed = true
    } else if (waterCandidate) {
      box.x = waterCandidate.x
      box.y = waterCandidate.y
      box.isFloating = true
      box.floatAngle = nearestLandForWater ? Math.atan2(nearestLandForWater.y - box.y, nearestLandForWater.x - box.x) : (Math.random() * Math.PI * 2)
      box.floatOffset = 0
      box.isTowedByBoat = null
      box.towedIndex = null
      box.rotation = 0
      gameState.woodenBoxes.push(box)
      placed = true
    }

    if (!placed) {
      box.x = centerX + (Math.random() - 0.5) * 40
      box.y = centerY + (Math.random() - 0.5) * 40
      box.isFloating = true
      box.floatAngle = Math.random() * Math.PI * 2
      box.floatOffset = 0
      box.isTowedByBoat = null
      box.towedIndex = null
      box.rotation = 0
      gameState.woodenBoxes.push(box)
    }

    dropped.push(box)
  }

  boat.towedBoxes = []
  return dropped
}

function drawBoatTowedBoxes(ctx, boat, camera) {
  if (!Array.isArray(boat.towedBoxes) || boat.towedBoxes.length === 0) {
    return
  }

  const towStartX = boat.x + Math.cos(boat.direction + Math.PI) * (boat.size * 0.8)
  const towStartY = boat.y + Math.sin(boat.direction + Math.PI) * (boat.size * 0.8)

  ctx.save()
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)"
  ctx.lineWidth = 1.5

  for (const box of boat.towedBoxes) {
    const lineEndX = box.x - camera.x
    const lineEndY = box.y - camera.y
    const lineStartX = towStartX - camera.x + Math.cos(boat.direction + Math.PI / 2) * (box.towedIndex || 0) * 6
    const lineStartY = towStartY - camera.y + Math.sin(boat.direction + Math.PI / 2) * (box.towedIndex || 0) * 6

    ctx.beginPath()
    ctx.moveTo(lineStartX, lineStartY)
    ctx.lineTo(lineEndX, lineEndY)
    ctx.stroke()

    const screenX = box.x - camera.x
    const screenY = box.y - camera.y

    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(box.rotation || 0)
    drawWoodenBox(ctx, box)
    ctx.restore()
  }

  ctx.restore()
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
    if (otherBox === box || !otherBox.isFloating || otherBox.isBeingThrown || otherBox.isTowedByBoat) {
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
    if (!box.isFloating || box.isBeingThrown || box.isTowedByBoat) {
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
    if (!box.isFloating || box.isBeingThrown || box.isTowedByBoat) {
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

  dropTowedBoxes(boat)

  gameState.isInCar = false
  gameState.drivingCar = null

  if (!safeExitPosition) {
    gameState.player.health = 0
    triggerGameOver()
    return true
  }

  gameState.player.x = safeExitPosition.x
  gameState.player.y = safeExitPosition.y

  if (boat.isBroken) {
    markBoatWreckForCleanup(boat)
  }

  return true
}

export function damageBoat(boat, options = {}) {
  if (!boat || boat.isBroken) {
    return false
  }

  const { amount = 1, ignoreCooldown = false } = options

  if (!ignoreCooldown && Date.now() - boat.lastHit < 1000) {
    return false
  }

  boat.health = Math.max(0, boat.health - Math.max(1, Math.round(amount)))
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

  return true
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
  resetVehicleMotion(boat.motion)
  boat.floatAngle = boat.direction + Math.PI * 0.5

  if (!(gameState.isInCar && gameState.drivingCar === boat)) {
    markBoatWreckForCleanup(boat)
  }
}

function markBoatWreckForCleanup(boat) {
  boat.wreckCleanupAt = Date.now() + VEHICLE_WRECK_DESPAWN_DELAY_MS
}

function removeExpiredBoatWrecks() {
  const { boats, isInCar, drivingCar } = gameState
  if (!Array.isArray(boats) || boats.length === 0) {
    return
  }

  const now = Date.now()
  for (let i = boats.length - 1; i >= 0; i--) {
    const boat = boats[i]
    if (!boat?.isBroken || !boat.wreckCleanupAt) {
      continue
    }

    if (isInCar && drivingCar === boat) {
      continue
    }

    if (now >= boat.wreckCleanupAt) {
      boats.splice(i, 1)
    }
  }
}

export function drawAndUpdateBoats() {
  const { ctx, camera, boats, isInCar, drivingCar, player } = gameState

  removeExpiredBoatWrecks()

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
    drawBoatTowedBoxes(ctx, boat, camera)

    if (isInCar && drivingCar === boat) {
      drawVehicleFuelBar(ctx, screenX, screenY, boat.size, boat.fuel, boat.fuelCapacity)
    }

    if (!isInCar && getDistance(player.x, player.y, boat.x, boat.y) < CAR_INTERACTION_RANGE) {
      drawBoatPrompt(ctx, screenX, screenY)
    }
  }
}

function updateBoatPosition(boat) {
  const { player, keys, isMobile, joystickActive, joystickAngle, joystickDistance } = gameState

  let throttleInput = 0

  if (isMobile) {
    if (joystickActive) {
      player.direction = joystickAngle
    }

    if (gameState.buttonBActive) {
      throttleInput = -0.55
    } else if (joystickActive) {
      throttleInput = joystickDistance > 0.1 ? Math.min(1, joystickDistance) : 0
    }
  } else {
    const movingForward = keys["ArrowUp"] || keys["w"]
    const movingBackward = keys["ArrowDown"] || keys["s"]

    if (movingForward) {
      throttleInput = 1
    } else if (movingBackward) {
      throttleInput = -0.55
    }
  }

  if (throttleInput !== 0 && (boat.fuel ?? 0) <= 0) {
    throttleInput = 0
  }

  if (throttleInput > 0 && (boat.fuel ?? 0) > 0) {
    boat.fuel = Math.max(0, boat.fuel - BOAT_FUEL_DRAIN_FORWARD * Math.max(0.25, Math.abs(throttleInput)))
  }

  const motion = getBoatMotion(boat)

  // While nearly stopped, keep bow aligned with player facing so forward or
  // reverse can instantly steer out of stuck situations.
  const standstillSpeed = Math.hypot(motion.longitudinalSpeed, motion.lateralSpeed)
  if (standstillSpeed < 0.2) {
    motion.heading = player.direction
    motion.yawRate = 0
    boat.direction = motion.heading
  }

  const directionDifference = normalizeAngle(player.direction - motion.heading)

  // Aim direction is a rudder request. The hull keeps carrying its old momentum,
  // so the boat slides wide through the turn before the heading catches up.
  const steerInput = Math.max(-1, Math.min(1, directionDifference / BOAT_MAX_RUDDER_ANGLE))

  // Same low-speed assist as cars: only for unsticking, not normal drifting.
  const isLowSpeed = Math.hypot(motion.longitudinalSpeed, motion.lateralSpeed) < 1
  if (throttleInput !== 0 && isLowSpeed) {
    motion.heading = normalizeAngle(motion.heading + directionDifference * 0.28)
    motion.yawRate *= 0.45
    boat.direction = motion.heading
  }

  stepVehicleMotion(
    motion,
    { throttle: throttleInput, steer: steerInput },
    {
      maxSpeed: BOAT_MAX_SPEED,
      acceleration: BOAT_ACCELERATION,
      braking: BOAT_DECELERATION,
      maxSteerAngle: BOAT_MAX_RUDDER_ANGLE,
      steerSpeed: BOAT_STEER_SPEED,
      frontAxle: boat.size * 0.4,
      rearAxle: boat.size * 0.4,
      yawInertia: BOAT_YAW_INERTIA,
      frontGrip: BOAT_HULL_GRIP,
      rearGrip: BOAT_RUDDER_GRIP,
      frontStiffness: BOAT_HULL_STIFFNESS,
      rearStiffness: BOAT_RUDDER_STIFFNESS,
      driftFactor: BOAT_DRIFT_FACTOR,
      powerOversteer: BOAT_POWER_OVERSTEER,
      lateralDrag: BOAT_LATERAL_DRAG,
      yawDamping: BOAT_YAW_DAMPING,
      steerSpeedSensitivity: BOAT_STEER_SENSITIVITY_FALLOFF,
      rearSteering: true,
      steerNeedsFlow: true,
      driftAffectsFront: true,
    }
  )

  boat.direction = motion.heading
  if (throttleInput !== 0 && boat.currentSpeed < 1.05) {
    const lowSpeedAssistDiff = normalizeAngle(player.direction - boat.direction)
    motion.heading = normalizeAngle(motion.heading + lowSpeedAssistDiff * 0.22)
    motion.yawRate *= 0.55
    boat.direction = motion.heading
  }
  boat.forwardSpeed = motion.longitudinalSpeed
  boat.lateralSpeed = motion.lateralSpeed
  boat.currentSpeed = Math.hypot(motion.longitudinalSpeed, motion.lateralSpeed)
  boat.slipAngle = motion.slipAngle
  boat.isDrifting = motion.isSliding

  const turningAmount = Math.min(1.7, Math.abs(motion.slipAngle) * 2.4)

  const velocity = getMotionVelocity(motion)
  boat.velocity.x = velocity.x
  boat.velocity.y = velocity.y

  const newX = boat.x + boat.velocity.x
  const newY = boat.y + boat.velocity.y
  const movementAngle = Math.atan2(boat.velocity.y || Math.sin(boat.direction), boat.velocity.x || Math.cos(boat.direction))
  const movementResult = resolveBoatMovement(boat, newX, newY, movementAngle, {
    pushBoxes: true,
    bumpBoats: true,
    damageOnBoatCollision: true,
  })

  if (movementResult.moved) {
    updateBoatTow(boat)
    gameState.player.x = boat.x
    gameState.player.y = boat.y
    spawnBoatWake(boat, turningAmount)
  } else {
    const motionState = getBoatMotion(boat)
    dampMotionAfterImpact(motionState, 0.3)
    boat.currentSpeed = Math.hypot(motionState.longitudinalSpeed, motionState.lateralSpeed)
    boat.forwardSpeed = motionState.longitudinalSpeed
    boat.lateralSpeed = motionState.lateralSpeed
    const impactVelocity = getMotionVelocity(motionState)
    boat.velocity.x = impactVelocity.x
    boat.velocity.y = impactVelocity.y
  }
}

// Boats restored from a save (or created before the physics rework) need their
// motion state seeded once.
function getBoatMotion(boat) {
  if (!boat.motion) {
    boat.motion = createVehicleMotion(boat.direction || 0)
    boat.motion.longitudinalSpeed = Number.isFinite(boat.forwardSpeed) ? boat.forwardSpeed : boat.currentSpeed || 0
    boat.motion.lateralSpeed = Number.isFinite(boat.lateralSpeed) ? boat.lateralSpeed : 0
  }

  return boat.motion
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
      resetVehicleMotion(boat.motion)
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

  updateBoatTow(boat)

  if (!driftResult.moved) {
    boat.currentSpeed = 0
    boat.velocity.x = 0
    boat.velocity.y = 0
    resetVehicleMotion(boat.motion)
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
    ctx.fillStyle = foam.color || "rgba(245, 248, 252, 0.95)"
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
    const fullLoad = boat.towedBoxes.length >= BOAT_TOW_CAP
    boat.foamTrail.push({
      x: boat.x + Math.cos(sternAngle) * sternDistance + (Math.random() - 0.5) * spread,
      y: boat.y + Math.sin(sternAngle) * sternDistance + (Math.random() - 0.5) * spread,
      vx: -boat.velocity.x * 0.08 + (Math.random() - 0.5) * 0.35,
      vy: -boat.velocity.y * 0.08 + (Math.random() - 0.5) * 0.35,
      size: 3 + Math.random() * 3 + turningAmount * 2,
      alpha: fullLoad ? BOAT_TOW_SMOKE_ALPHA : 0.72,
      color: fullLoad ? "rgba(60, 52, 46, 0.9)" : "rgba(245, 248, 252, 0.95)",
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

function getRandomFuelAmount(minFuel, maxFuel) {
  const safeMin = Math.max(0, Math.min(minFuel, maxFuel))
  const safeMax = Math.max(safeMin, Math.max(minFuel, maxFuel))
  return safeMin + Math.random() * (safeMax - safeMin)
}

function drawVehicleFuelBar(ctx, screenX, screenY, size, fuel, fuelCapacity) {
  const capacity = Math.max(1, fuelCapacity || 1)
  const normalizedFuel = Math.max(0, Math.min(1, (fuel || 0) / capacity))
  const barWidth = size * 1.2
  const barHeight = 8
  const barX = screenX - barWidth * 0.5
  const barY = screenY - size * 0.85

  ctx.save()
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2)

  ctx.fillStyle = "rgba(33, 33, 33, 0.9)"
  ctx.fillRect(barX, barY, barWidth, barHeight)

  ctx.fillStyle = normalizedFuel > 0.25 ? "#69c36a" : "#e29b3b"
  if (normalizedFuel <= 0.1) {
    ctx.fillStyle = "#db4c3f"
  }

  ctx.fillRect(barX, barY, barWidth * normalizedFuel, barHeight)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
  ctx.lineWidth = 1
  ctx.strokeRect(barX, barY, barWidth, barHeight)
  ctx.restore()
}