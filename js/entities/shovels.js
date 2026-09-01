import { gameState } from "../core/game-state.js"
import {
  SHOVEL_COUNT,
  SHOVEL_SIZE,
  TILE_SIZE,
  TERRAIN_TYPES,
  SPAWN_SHOVEL_NEAR_PLAYER,
  MAX_SHOVELS,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { updateShovelIndicator } from "../ui/ui-manager.js"
import { isSpawnPositionClear } from "../utils/spawn-utils.js"
import { getRandomLoadedWorldPosition } from "../world/world-manager.js"

const DESKTOP_DIG_REACH_MULTIPLIER = 1.95
const MOBILE_DIG_REACH_MULTIPLIER = 2.35

function holeKey(tileX, tileY) {
  return `${tileX},${tileY}`
}

function parseHoleKey(key) {
  const [x, y] = key.split(",")
  return { x: Number(x), y: Number(y) }
}

function getAdjacentTiles(tileX, tileY) {
  return [
    { x: tileX + 1, y: tileY },
    { x: tileX - 1, y: tileY },
    { x: tileX, y: tileY + 1 },
    { x: tileX, y: tileY - 1 },
  ]
}

function isTileWithinTerrain(tileX, tileY) {
  const { terrain } = gameState
  return tileY >= 0 && tileY < terrain.length && tileX >= 0 && tileX < terrain[0].length
}

function isBoatWaterDigTile(tileX, tileY) {
  if (!gameState.isInCar || gameState.drivingCar?.vehicleType !== "boat") {
    return false
  }

  if (!isTileWithinTerrain(tileX, tileY)) {
    return false
  }

  return gameState.terrain[tileY][tileX] === TERRAIN_TYPES.WATER
}

function isWaterDigTile(tileX, tileY) {
  if (!isTileWithinTerrain(tileX, tileY)) {
    return false
  }

  return gameState.terrain[tileY][tileX] === TERRAIN_TYPES.WATER
}

function isHoleTraversableTerrain(tileX, tileY) {
  const { terrain } = gameState
  const terrainType = terrain[tileY][tileX]
  return terrainType !== TERRAIN_TYPES.WATER || isWaterDigTile(tileX, tileY)
}

function getTileFromWorldPosition(worldX, worldY) {
  return {
    tileX: Math.floor(worldX / TILE_SIZE),
    tileY: Math.floor(worldY / TILE_SIZE),
  }
}

function isTileWithinDigReach(tileX, tileY, reachMultiplier = DESKTOP_DIG_REACH_MULTIPLIER) {
  const tileCenterX = tileX * TILE_SIZE + TILE_SIZE / 2
  const tileCenterY = tileY * TILE_SIZE + TILE_SIZE / 2
  const boatReachBoost = gameState.isInCar && gameState.drivingCar?.vehicleType === "boat" ? 0.7 : 0
  const maxDigDistance = TILE_SIZE * (reachMultiplier + boatReachBoost)
  return getDistance(gameState.player.x, gameState.player.y, tileCenterX, tileCenterY) <= maxDigDistance
}

export function clearPendingDigTarget() {
  gameState.pendingDigTile = null
}

function isTileAdjacentToWater(tileX, tileY) {
  const { terrain } = gameState

  for (const adjacentTile of getAdjacentTiles(tileX, tileY)) {
    if (!isTileWithinTerrain(adjacentTile.x, adjacentTile.y)) {
      continue
    }

    if (terrain[adjacentTile.y][adjacentTile.x] === TERRAIN_TYPES.WATER) {
      return true
    }
  }

  return false
}

function getHoleComponent(startTileX, startTileY) {
  const { dugHoles } = gameState
  const queue = [{ x: startTileX, y: startTileY }]
  const visited = new Set()
  const component = []

  while (queue.length > 0) {
    const current = queue.shift()
    const key = holeKey(current.x, current.y)

    if (visited.has(key) || !dugHoles[key]) {
      continue
    }

    visited.add(key)
    component.push(current)

    for (const adjacentTile of getAdjacentTiles(current.x, current.y)) {
      const adjacentKey = holeKey(adjacentTile.x, adjacentTile.y)
      if (!visited.has(adjacentKey) && dugHoles[adjacentKey]) {
        queue.push(adjacentTile)
      }
    }
  }

  return component
}

function updateFloodForHoleComponent(startTileX, startTileY) {
  const { dugHoles } = gameState
  const component = getHoleComponent(startTileX, startTileY)

  if (component.length === 0) {
    return
  }

  const shouldFlood = component.some((tile) => isTileAdjacentToWater(tile.x, tile.y))

  for (const tile of component) {
    const key = holeKey(tile.x, tile.y)
    dugHoles[key].flooded = shouldFlood
  }
}

function updateFloodForAdjacentHoleComponents(tileX, tileY) {
  const processed = new Set()

  for (const adjacentTile of getAdjacentTiles(tileX, tileY)) {
    const adjacentKey = holeKey(adjacentTile.x, adjacentTile.y)
    if (processed.has(adjacentKey) || !gameState.dugHoles[adjacentKey]) {
      continue
    }

    processed.add(adjacentKey)
    updateFloodForHoleComponent(adjacentTile.x, adjacentTile.y)
  }
}

export function isHoleTile(tileX, tileY) {
  return Boolean(gameState.dugHoles[holeKey(tileX, tileY)])
}

export function getHoleAtTile(tileX, tileY) {
  return gameState.dugHoles[holeKey(tileX, tileY)] || null
}

export function isHoleFlooded(tileX, tileY) {
  return Boolean(gameState.dugHoles[holeKey(tileX, tileY)]?.flooded)
}

export function isWaterLikeTile(tileX, tileY) {
  const { terrain } = gameState

  if (!isTileWithinTerrain(tileX, tileY)) {
    return false
  }

  return terrain[tileY][tileX] === TERRAIN_TYPES.WATER || isHoleFlooded(tileX, tileY)
}

export function isWaterLikeWorldPosition(worldX, worldY) {
  const tileX = Math.floor(worldX / TILE_SIZE)
  const tileY = Math.floor(worldY / TILE_SIZE)
  return isWaterLikeTile(tileX, tileY)
}

export function isShovelActionLocked() {
  const now = Date.now()
  const activeDig = gameState.player?.shovelDig
  const animationLock = activeDig && now - activeDig.startedAt < (activeDig.duration || 1000)
  const cooldownLock = now < (gameState.shovelActionLockUntil || 0)
  return Boolean(animationLock || cooldownLock)
}

function triggerShovelDigAnimation(tileX, tileY, mode = "dig", duration = 500) {
  const now = Date.now()
  const animation = {
    tileX,
    tileY,
    mode,
    startedAt: now,
    duration,
  }

  if (!Array.isArray(gameState.digAnimations)) {
    gameState.digAnimations = []
  }

  gameState.digAnimations.push(animation)
  gameState.shovelActionLockUntil = now + duration

  if (gameState.player) {
    gameState.player.shovelDig = {
      startedAt: now,
      duration,
      tileX,
      tileY,
      mode,
    }
  }
}

export function digHoleAtTile(tileX, tileY) {
  if (!isTileWithinTerrain(tileX, tileY) || !isHoleTraversableTerrain(tileX, tileY)) {
    return false
  }

  const key = holeKey(tileX, tileY)
  const existingHole = gameState.dugHoles[key]

  if (isWaterDigTile(tileX, tileY)) {
    gameState.terrain[tileY][tileX] = TERRAIN_TYPES.DIRT
    return true
  }

  if (existingHole && existingHole.flooded) {
    delete gameState.dugHoles[key]
    gameState.terrain[tileY][tileX] = TERRAIN_TYPES.DIRT
    updateFloodForAdjacentHoleComponents(tileX, tileY)
    return true
  }

  if (existingHole) {
    return false
  }

  gameState.dugHoles[key] = {
    tileX,
    tileY,
    flooded: false,
    createdAt: Date.now(),
  }

  updateFloodForHoleComponent(tileX, tileY)
  return true
}

export function fillHoleAtTile(tileX, tileY) {
  const key = holeKey(tileX, tileY)
  const hole = gameState.dugHoles[key]

  // Only dry/black holes can be filled back in with dirt.
  if (!hole || hole.flooded || !isTileWithinTerrain(tileX, tileY)) {
    return false
  }

  delete gameState.dugHoles[key]
  gameState.terrain[tileY][tileX] = TERRAIN_TYPES.DIRT
  updateFloodForAdjacentHoleComponents(tileX, tileY)
  return true
}

function digOrFillHoleAtTile(tileX, tileY) {
  const hole = getHoleAtTile(tileX, tileY)
  const isWaterTile = isWaterDigTile(tileX, tileY)

  if (hole && hole.flooded) {
    const cleared = digHoleAtTile(tileX, tileY)
    if (cleared) {
      triggerShovelDigAnimation(tileX, tileY, "fill", 500)
    }
    return cleared
  }

  if (hole && !hole.flooded) {
    const filled = fillHoleAtTile(tileX, tileY)
    if (filled) {
      triggerShovelDigAnimation(tileX, tileY, "fill")
    }
    return filled
  }

  const dug = digHoleAtTile(tileX, tileY)
  if (dug) {
    const duration = isWaterTile ? 900 : 500
    triggerShovelDigAnimation(tileX, tileY, "dig", duration)
  }
  return dug
}

function canSelectDigTile(tileX, tileY, reachMultiplier = DESKTOP_DIG_REACH_MULTIPLIER) {
  if (!isTileWithinTerrain(tileX, tileY)) {
    return false
  }

  if (!isHoleTraversableTerrain(tileX, tileY)) {
    return false
  }

  if (!isTileWithinDigReach(tileX, tileY, reachMultiplier)) {
    return false
  }

  return true
}

function isSamePendingDigTile(tileX, tileY) {
  return gameState.pendingDigTile && gameState.pendingDigTile.tileX === tileX && gameState.pendingDigTile.tileY === tileY
}

export function queueOrDigHoleAtScreenPosition(screenX, screenY, options = {}) {
  if (isShovelActionLocked()) {
    clearPendingDigTarget()
    return { consumed: true, didDig: false, activated: false }
  }

  const isVehicleBlock = gameState.isInCar && gameState.drivingCar?.vehicleType !== "boat"
  if (!gameState.hasShovel || gameState.selectedTool !== "shovel" || isVehicleBlock) {
    clearPendingDigTarget()
    return { consumed: false, didDig: false, activated: false }
  }

  const { mobile = false } = options
  const boatReachMultiplier = gameState.isInCar && gameState.drivingCar?.vehicleType === "boat" ? 1.1 : 0
  const reachMultiplier = mobile ? MOBILE_DIG_REACH_MULTIPLIER + boatReachMultiplier : DESKTOP_DIG_REACH_MULTIPLIER + boatReachMultiplier
  const worldX = screenX + gameState.camera.x
  const worldY = screenY + gameState.camera.y
  const { tileX, tileY } = getTileFromWorldPosition(worldX, worldY)

  if (!canSelectDigTile(tileX, tileY, reachMultiplier)) {
    clearPendingDigTarget()
    return { consumed: true, didDig: false, activated: false }
  }

  if (!isSamePendingDigTile(tileX, tileY)) {
    gameState.pendingDigTile = { tileX, tileY, activatedAt: Date.now() }
    return { consumed: true, didDig: false, activated: true }
  }

  const didDig = digOrFillHoleAtTile(tileX, tileY)
  clearPendingDigTarget()
  return { consumed: true, didDig, activated: false }
}

export function tryDigHoleAtWorldPosition(worldX, worldY) {
  if (isShovelActionLocked()) {
    return false
  }

  const isVehicleBlock = gameState.isInCar && gameState.drivingCar?.vehicleType !== "boat"
  if (!gameState.hasShovel || gameState.selectedTool !== "shovel" || isVehicleBlock) {
    return false
  }

  const { tileX, tileY } = getTileFromWorldPosition(worldX, worldY)
  const tileIsWater = isWaterDigTile(tileX, tileY)
  const boatReachMultiplier = gameState.isInCar && gameState.drivingCar?.vehicleType === "boat" ? 1.1 : 0

  if (!canSelectDigTile(tileX, tileY, DESKTOP_DIG_REACH_MULTIPLIER + boatReachMultiplier) && !tileIsWater) {
    return false
  }

  return digOrFillHoleAtTile(tileX, tileY)
}

export function tryDigHoleAtScreenPosition(screenX, screenY) {
  const worldX = screenX + gameState.camera.x
  const worldY = screenY + gameState.camera.y
  return tryDigHoleAtWorldPosition(worldX, worldY)
}

export function tryDigHoleInFrontOfPlayer() {
  const digReach = TILE_SIZE * 1.1
  const worldX = gameState.player.x + Math.cos(gameState.player.direction) * digReach
  const worldY = gameState.player.y + Math.sin(gameState.player.direction) * digReach
  return tryDigHoleAtWorldPosition(worldX, worldY)
}

export function isEnemyFullyInsideHole(enemy) {
  const tileX = Math.floor(enemy.x / TILE_SIZE)
  const tileY = Math.floor(enemy.y / TILE_SIZE)

  const hole = getHoleAtTile(tileX, tileY)
  if (!hole) {
    return false
  }

  if (hole.flooded) {
    return false
  }

  let leftTiles = 0
  let rightTiles = 0
  let upTiles = 0
  let downTiles = 0

  while (isHoleTile(tileX - leftTiles - 1, tileY)) leftTiles++
  while (isHoleTile(tileX + rightTiles + 1, tileY)) rightTiles++
  while (isHoleTile(tileX, tileY - upTiles - 1)) upTiles++
  while (isHoleTile(tileX, tileY + downTiles + 1)) downTiles++

  const minX = (tileX - leftTiles) * TILE_SIZE
  const maxX = (tileX + rightTiles + 1) * TILE_SIZE
  const minY = (tileY - upTiles) * TILE_SIZE
  const maxY = (tileY + downTiles + 1) * TILE_SIZE

  const holeWidth = maxX - minX
  const holeHeight = maxY - minY
  const requiredSpan = enemy.size * 2

  if (holeWidth < requiredSpan || holeHeight < requiredSpan) {
    return false
  }

  const fitRadius = enemy.size * 0.5
  return (
    enemy.x > minX + fitRadius &&
    enemy.x < maxX - fitRadius &&
    enemy.y > minY + fitRadius &&
    enemy.y < maxY - fitRadius
  )
}

export function isHoleBlockingCarPosition(x, y, carSize) {
  if (!gameState.dugHoles || Object.keys(gameState.dugHoles).length === 0) {
    return false
  }

  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)

  for (let yOffset = -1; yOffset <= 1; yOffset++) {
    for (let xOffset = -1; xOffset <= 1; xOffset++) {
      const checkX = tileX + xOffset
      const checkY = tileY + yOffset
      const hole = getHoleAtTile(checkX, checkY)
      if (!hole) {
        continue
      }

      const holeCenterX = checkX * TILE_SIZE + TILE_SIZE / 2
      const holeCenterY = checkY * TILE_SIZE + TILE_SIZE / 2
      const blockingDistance = carSize * 0.55 + TILE_SIZE * 0.4

      if (getDistance(x, y, holeCenterX, holeCenterY) < blockingDistance) {
        return true
      }
    }
  }

  return false
}

export function createShovel(x, y) {
  return {
    x,
    y,
    size: SHOVEL_SIZE,
    rotation: (Math.random() - 0.5) * 0.6,
  }
}

export function generateShovels(count = SHOVEL_COUNT) {
  const { terrain, player, shovels } = gameState
  const remainingCapacity = Math.max(0, MAX_SHOVELS - shovels.length)

  if (remainingCapacity <= 0) {
    return
  }

  const shovelsToSpawn = Math.min(count, remainingCapacity)

  if (shovelsToSpawn > 0 && SPAWN_SHOVEL_NEAR_PLAYER) {
    const nearbyShovel = createNearbyShovel(player, shovels)
    if (nearbyShovel) {
      shovels.push(nearbyShovel)
    }
  }

  for (let i = shovels.length; i < shovelsToSpawn; i++) {
    let placed = false
    let attempts = 0

    while (!placed && attempts < 80) {
      attempts++

      const position = getRandomLoadedWorldPosition(200)
      const shovel = {
        x: position.x,
        y: position.y,
        size: SHOVEL_SIZE,
        rotation: (Math.random() - 0.5) * 0.6,
      }

      if (
        !isSpawnPositionClear(shovel.x, shovel.y, shovel.size, {
          requireLand: true,
          playerDistanceBuffer: 180,
        })
      ) {
        continue
      }

      if (shovels.some((other) => getDistance(shovel.x, shovel.y, other.x, other.y) < shovel.size * 5)) {
        continue
      }

      shovels.push(shovel)
      placed = true
    }
  }
}

function createNearbyShovel(player, existingShovels) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const angle = Math.random() * Math.PI * 2
    const distance = 110 + Math.random() * 90
    const x = player.x + Math.cos(angle) * distance
    const y = player.y + Math.sin(angle) * distance

    const shovel = {
      x,
      y,
      size: SHOVEL_SIZE,
      rotation: (Math.random() - 0.5) * 0.6,
    }

    if (
      !isSpawnPositionClear(shovel.x, shovel.y, shovel.size, {
        requireLand: true,
        playerDistanceBuffer: 0,
      })
    ) {
      continue
    }

    if (existingShovels.some((other) => getDistance(shovel.x, shovel.y, other.x, other.y) < shovel.size * 4)) {
      continue
    }

    return shovel
  }

  return null
}

export function drawAndUpdateShovels() {
  const { shovels, player, camera, ctx, canvas, hasShovel } = gameState

  if (hasShovel || !shovels || shovels.length === 0) {
    return
  }

  for (let i = 0; i < shovels.length; i++) {
    const shovel = shovels[i]
    const screenX = shovel.x - camera.x
    const screenY = shovel.y - camera.y

    if (
      screenX < -shovel.size ||
      screenX > canvas.width + shovel.size ||
      screenY < -shovel.size ||
      screenY > canvas.height + shovel.size
    ) {
      continue
    }

    createShadow(
      ctx,
      screenX,
      screenY,
      shovel.size,
      "rectangle",
      { width: shovel.size * 1.7, height: shovel.size * 0.5, radius: 3 },
      shovel.rotation,
      0.9,
    )

    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(shovel.rotation)

    ctx.fillStyle = "#7a5636"
    ctx.fillRect(-shovel.size * 0.1, -shovel.size * 0.72, shovel.size * 0.2, shovel.size * 1.3)

    ctx.fillStyle = "#9fa8ad"
    ctx.beginPath()
    ctx.moveTo(-shovel.size * 0.42, -shovel.size * 0.78)
    ctx.lineTo(shovel.size * 0.42, -shovel.size * 0.78)
    ctx.lineTo(shovel.size * 0.2, -shovel.size * 0.36)
    ctx.lineTo(-shovel.size * 0.2, -shovel.size * 0.36)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = "#c8d0d4"
    ctx.fillRect(-shovel.size * 0.12, -shovel.size * 0.7, shovel.size * 0.24, shovel.size * 0.24)

    ctx.restore()

    if (getDistance(player.x, player.y, shovel.x, shovel.y) < player.size + shovel.size) {
      collectShovel()
      return
    }
  }
}

export function collectShovel() {
  gameState.hasShovel = true
  gameState.shovels = []
  updateShovelIndicator()
}

export function getAllHoles() {
  return Object.entries(gameState.dugHoles || {}).map(([key, hole]) => ({
    ...parseHoleKey(key),
    ...hole,
  }))
}
