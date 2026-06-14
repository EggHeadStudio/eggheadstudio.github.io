import { TILE_SIZE, MINIMAP_VISIBLE_TILES_MOBILE, MINIMAP_VISIBLE_TILES_DESKTOP } from "../core/constants.js"
import { gameState } from "../core/game-state.js"
import { getTerrainColor } from "../utils/color-utils.js"

export function drawMinimap() {
  if (!gameState.isStarted || !gameState.player) {
    return
  }

  const refs = getMinimapContext()
  if (!refs) {
    return
  }

  const { canvas, ctx } = refs
  const visibleTiles = gameState.isMobile ? MINIMAP_VISIBLE_TILES_MOBILE : MINIMAP_VISIBLE_TILES_DESKTOP
  const worldHalfSpan = Math.floor(visibleTiles / 2)
  const playerTileX = gameState.player.x / TILE_SIZE
  const playerTileY = gameState.player.y / TILE_SIZE
  const tileSize = canvas.width / visibleTiles
  const mapCenterX = canvas.width / 2
  const mapCenterY = canvas.height / 2
  const minTileX = Math.floor(playerTileX) - worldHalfSpan - 1
  const maxTileX = Math.floor(playerTileX) + worldHalfSpan + 1
  const minTileY = Math.floor(playerTileY) - worldHalfSpan - 1
  const maxTileY = Math.floor(playerTileY) + worldHalfSpan + 1

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "rgba(6, 12, 18, 0.74)"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let y = minTileY; y <= maxTileY; y++) {
    for (let x = minTileX; x <= maxTileX; x++) {
      const screenX = mapCenterX + (x - playerTileX) * tileSize
      const screenY = mapCenterY + (y - playerTileY) * tileSize

      if (y < 0 || y >= gameState.terrain.length || x < 0 || x >= gameState.terrain[0].length) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.06)"
      } else {
        ctx.fillStyle = getTerrainColor(gameState.terrain[y][x])
      }

      ctx.fillRect(screenX, screenY, tileSize + 1, tileSize + 1)
    }
  }

  drawMinimapEntities(ctx, {
    tileSize,
    mapCenterX,
    mapCenterY,
    playerTileX,
    playerTileY,
    minTileX,
    maxTileX,
    minTileY,
    maxTileY,
  })

  ctx.save()
  ctx.translate(mapCenterX, mapCenterY)
  ctx.rotate(gameState.player.direction)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"
  ctx.lineWidth = Math.max(2, tileSize * 0.15)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(tileSize * 1.2, 0)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.arc(mapCenterX, mapCenterY, Math.max(3, tileSize * 0.32), 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
  ctx.lineWidth = Math.max(1, tileSize * 0.04)
  ctx.strokeRect(0, 0, canvas.width, canvas.height)
}

function drawMinimapEntities(ctx, viewport) {
  const scale = viewport.tileSize / TILE_SIZE

  drawEntityRects(ctx, gameState.woodenBoxes, viewport, scale, {
    fillStyle: "rgba(151, 107, 61, 0.92)",
    minSize: 2,
    sizeMultiplier: 1.15,
  })

  drawEntityCircles(ctx, gameState.rocks, viewport, scale, {
    colorForItem: (rock) => getRockMinimapColor(rock.texture),
    minRadius: 1.8,
    radiusMultiplier: 0.78,
  })

  drawEntityCircles(ctx, gameState.bombs, viewport, scale, {
    colorForItem: (bomb) => bomb.color || "rgba(255, 138, 92, 0.92)",
    minRadius: 1.8,
    radiusMultiplier: 0.62,
  })

  drawEntityRects(ctx, gameState.cars, viewport, scale, {
    fillStyle: "rgba(92, 203, 225, 0.92)",
    minSize: 2.4,
    sizeMultiplier: 1.05,
  })

  drawEntityRects(ctx, gameState.boats, viewport, scale, {
    fillStyle: "rgba(214, 243, 248, 0.92)",
    minSize: 2.2,
    sizeMultiplier: 1,
    outlineStyle: "rgba(41, 81, 92, 0.72)",
  })

  drawEntityCircles(ctx, gameState.enemies, viewport, scale, {
    fillStyle: "rgba(235, 86, 86, 0.95)",
    minRadius: 2,
    radiusMultiplier: 0.58,
  })

  drawEntityCircles(ctx, gameState.apples, viewport, scale, {
    fillStyle: "rgba(143, 228, 108, 0.92)",
    minRadius: 1.2,
    radiusMultiplier: 0.42,
  })
}

function drawEntityCircles(ctx, items, viewport, scale, options) {
  if (!items || items.length === 0) {
    return
  }

  for (const item of items) {
    const point = getMinimapPoint(item, viewport)
    if (!point) {
      continue
    }

    const radius = Math.max(options.minRadius, (item.size || TILE_SIZE * 0.25) * scale * options.radiusMultiplier)
    ctx.fillStyle = options.colorForItem ? options.colorForItem(item) : options.fillStyle
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = options.outlineStyle || "rgba(12, 18, 22, 0.55)"
    ctx.lineWidth = Math.max(0.8, radius * 0.28)
    ctx.stroke()
  }
}

function drawEntityRects(ctx, items, viewport, scale, options) {
  if (!items || items.length === 0) {
    return
  }

  ctx.fillStyle = options.fillStyle

  for (const item of items) {
    const point = getMinimapPoint(item, viewport)
    if (!point) {
      continue
    }

    const halfSize = Math.max(options.minSize, (item.size || TILE_SIZE * 0.25) * scale * options.sizeMultiplier * 0.5)
    ctx.fillRect(point.x - halfSize, point.y - halfSize, halfSize * 2, halfSize * 2)
    ctx.strokeStyle = options.outlineStyle || "rgba(12, 18, 22, 0.58)"
    ctx.lineWidth = Math.max(0.8, halfSize * 0.22)
    ctx.strokeRect(point.x - halfSize, point.y - halfSize, halfSize * 2, halfSize * 2)
  }
}

function getMinimapPoint(item, viewport) {
  if (!item || typeof item.x !== "number" || typeof item.y !== "number") {
    return null
  }

  const tileX = item.x / TILE_SIZE
  const tileY = item.y / TILE_SIZE

  if (tileX < viewport.minTileX || tileX > viewport.maxTileX || tileY < viewport.minTileY || tileY > viewport.maxTileY) {
    return null
  }

  return {
    x: viewport.mapCenterX + (tileX - viewport.playerTileX) * viewport.tileSize,
    y: viewport.mapCenterY + (tileY - viewport.playerTileY) * viewport.tileSize,
  }
}

function getRockMinimapColor(texture = 0) {
  switch (texture) {
    case 1:
      return "rgba(154, 160, 170, 0.9)"
    case 2:
      return "rgba(132, 140, 150, 0.9)"
    default:
      return "rgba(180, 186, 196, 0.9)"
  }
}

function getMinimapContext() {
  const canvas = document.getElementById("minimapCanvas")
  if (!canvas) {
    return null
  }

  const ctx = canvas.getContext("2d")
  const devicePixelRatio = window.devicePixelRatio || 1
  const desiredWidth = Math.floor(canvas.clientWidth * devicePixelRatio)
  const desiredHeight = Math.floor(canvas.clientHeight * devicePixelRatio)

  if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
    canvas.width = desiredWidth
    canvas.height = desiredHeight
  }

  return { canvas, ctx }
}