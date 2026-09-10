import { gameState } from "../core/game-state.js"
import {
  TILE_SIZE,
  TERRAIN_TYPES,
  MAX_SAND_PILES,
  SAND_PILE_SIZE,
  SAND_PILE_RESPAWN_BATCH,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { isSpawnPositionClear } from "../utils/spawn-utils.js"
import { getRandomLoadedWorldPosition } from "../world/world-manager.js"
import { createWoodenBox, releaseWoodenBox } from "./wooden-boxes.js"

export function createSandPile(x, y) {
  return {
    x,
    y,
    size: SAND_PILE_SIZE,
    rotation: (Math.random() - 0.5) * 0.35,
    sparkleSeed: Math.random() * Math.PI * 2,
    type: "sandPile",
  }
}

export function generateSandPiles(count = SAND_PILE_RESPAWN_BATCH) {
  const { sandPiles = [] } = gameState
  const remainingCapacity = Math.max(0, MAX_SAND_PILES - sandPiles.length)
  const toSpawn = Math.min(count, remainingCapacity)

  for (let i = 0; i < toSpawn; i++) {
    let placed = false
    let attempts = 0

    while (!placed && attempts < 50) {
      attempts++
      const position = getRandomLoadedWorldPosition(120)
      const tileX = Math.floor(position.x / TILE_SIZE)
      const tileY = Math.floor(position.y / TILE_SIZE)
      if (!isSandTile(tileX, tileY)) {
        continue
      }

      const pile = createSandPile(position.x, position.y)
      if (!isSpawnPositionClear(pile.x, pile.y, pile.size, { requireLand: true, playerDistanceBuffer: 90 })) {
        continue
      }

      gameState.sandPiles.push(pile)
      placed = true
    }
  }
}

export function tryGrabSandPile() {
  const { player, sandPiles = [] } = gameState

  for (let i = 0; i < sandPiles.length; i++) {
    const pile = sandPiles[i]
    if (getDistance(player.x, player.y, pile.x, pile.y) >= player.size + pile.size) {
      continue
    }

    sandPiles.splice(i, 1)
    gameState.isGrabbing = true

    if (gameState.hasSledgehammer && gameState.selectedTool === "sledgehammer") {
      gameState.grabbedWoodenBox = createGlassCubeFromSandPile(pile)
      gameState.grabbedSandPile = null
    } else {
      gameState.grabbedSandPile = pile
      gameState.grabbedWoodenBox = null
    }

    return true
  }

  return false
}

export function releaseSandPile() {
  const { player, grabbedSandPile } = gameState
  if (!grabbedSandPile) {
    return false
  }

  const centerX = player.x + Math.cos(player.direction) * TILE_SIZE
  const centerY = player.y + Math.sin(player.direction) * TILE_SIZE
  applySandPatch(centerX, centerY)
  gameState.grabbedSandPile = null
  gameState.isGrabbing = false
  return true
}

export function drawAndUpdateSandPiles() {
  const { sandPiles = [], ctx, camera, canvas } = gameState

  for (const pile of sandPiles) {
    const screenX = pile.x - camera.x
    const screenY = pile.y - camera.y

    if (
      screenX < -pile.size ||
      screenX > canvas.width + pile.size ||
      screenY < -pile.size ||
      screenY > canvas.height + pile.size
    ) {
      continue
    }

    createShadow(ctx, screenX, screenY + 2, pile.size * 0.7, "circle")
    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(pile.rotation || 0)
    drawSandPile(ctx, pile)
    ctx.restore()
  }

  if (gameState.grabbedSandPile) {
    drawGrabbedSandPile(ctx, camera)
  }
}

function createGlassCubeFromSandPile(pile) {
  const cube = createWoodenBox(pile.x, pile.y)
  cube.isGlassCube = true
  cube.isSledgeCube = false
  cube.isSledgeSpiked = false
  cube.size = TILE_SIZE
  cube.rotation = 0
  cube.lightDirection = gameState.player?.direction || 0
  cube.glassGlowSeed = pile.sparkleSeed || Math.random() * Math.PI * 2
  return cube
}

function applySandPatch(worldX, worldY) {
  const centerTileX = Math.floor(worldX / TILE_SIZE)
  const centerTileY = Math.floor(worldY / TILE_SIZE)
  const { terrain, dugHoles } = gameState

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tileX = centerTileX + dx
      const tileY = centerTileY + dy
      if (!isTileWithinTerrain(tileX, tileY)) {
        continue
      }

      terrain[tileY][tileX] = TERRAIN_TYPES.SAND
      if (dugHoles?.[`${tileX},${tileY}`]) {
        delete dugHoles[`${tileX},${tileY}`]
      }
    }
  }
}

function isSandTile(tileX, tileY) {
  if (!isTileWithinTerrain(tileX, tileY)) {
    return false
  }

  return gameState.terrain[tileY][tileX] === TERRAIN_TYPES.SAND
}

function isTileWithinTerrain(tileX, tileY) {
  const { terrain } = gameState
  return terrain && tileY >= 0 && tileY < terrain.length && tileX >= 0 && tileX < terrain[0].length
}

function drawSandPile(ctx, pile) {
  const radiusX = pile.size * 0.62
  const radiusY = pile.size * 0.42
  const crestHeight = pile.size * 0.36

  ctx.fillStyle = "#d7bd84"
  ctx.beginPath()
  ctx.ellipse(0, radiusY * 0.25, radiusX, radiusY, 0, 0, Math.PI * 2)
  ctx.fill()

  const mound = new Path2D()
  mound.moveTo(-radiusX * 0.9, radiusY * 0.2)
  mound.quadraticCurveTo(-radiusX * 0.48, -crestHeight * 0.28, 0, -crestHeight)
  mound.quadraticCurveTo(radiusX * 0.58, -crestHeight * 0.18, radiusX * 0.92, radiusY * 0.24)
  mound.quadraticCurveTo(radiusX * 0.28, radiusY * 0.8, -radiusX * 0.8, radiusY * 0.4)
  mound.closePath()

  ctx.fillStyle = "#e4ca90"
  ctx.fill(mound)

  ctx.strokeStyle = "rgba(173, 132, 72, 0.55)"
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(-radiusX * 0.44, -crestHeight * 0.1)
  ctx.quadraticCurveTo(0, crestHeight * 0.15, radiusX * 0.46, -crestHeight * 0.06)
  ctx.stroke()

  ctx.fillStyle = "rgba(248, 239, 210, 0.42)"
  for (let i = 0; i < 5; i++) {
    const angle = pile.sparkleSeed + i * 1.7
    const px = Math.cos(angle) * radiusX * 0.36
    const py = -crestHeight * 0.2 + Math.sin(angle * 1.9) * radiusY * 0.22
    ctx.fillRect(px, py, 2, 2)
  }
}

function drawGrabbedSandPile(ctx, camera) {
  const { player, grabbedSandPile } = gameState
  const holdDistance = player.size * 1.15
  const screenX = player.x - camera.x + Math.cos(player.direction) * holdDistance
  const screenY = player.y - camera.y + Math.sin(player.direction) * holdDistance

  ctx.save()
  ctx.translate(screenX, screenY)
  ctx.rotate(grabbedSandPile.rotation || 0)
  drawSandPile(ctx, grabbedSandPile)
  ctx.restore()
}

export function releaseGrabbedGlassCubeThroughBoxSystem() {
  if (!gameState.grabbedWoodenBox?.isGlassCube) {
    return false
  }

  return releaseWoodenBox()
}
