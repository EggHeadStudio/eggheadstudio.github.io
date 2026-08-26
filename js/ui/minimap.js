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

  drawMinimapHoles(ctx, {
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

  drawMinimapTrees(ctx, viewport, scale)

  drawMinimapWoodenBoxes(ctx, viewport, scale)

  drawEntityCircles(ctx, gameState.rocks, viewport, scale, {
    colorForItem: (rock) => getRockMinimapColor(rock.texture),
    minRadius: 1.7,
    radiusMultiplier: 0.78,
  })

  drawMinimapBombs(ctx, viewport, scale)

  drawMinimapCars(ctx, viewport, scale)

  drawMinimapBoats(ctx, viewport, scale)

  drawMinimapEnemies(ctx, viewport, scale)

  drawEntityCircles(ctx, gameState.apples, viewport, scale, {
    fillStyle: "rgba(231, 76, 60, 0.94)",
    minRadius: 1.2,
    radiusMultiplier: 0.42,
    outlineStyle: "rgba(64, 22, 20, 0.6)",
  })

  drawEntityCircles(ctx, gameState.thrownApples, viewport, scale, {
    fillStyle: "rgba(231, 76, 60, 0.9)",
    minRadius: 1,
    radiusMultiplier: 0.36,
    outlineStyle: "rgba(64, 22, 20, 0.45)",
  })

  drawEntityCircles(ctx, gameState.shovels, viewport, scale, {
    fillStyle: "rgba(118, 153, 176, 0.95)",
    minRadius: 1.3,
    radiusMultiplier: 0.38,
    outlineStyle: "rgba(30, 44, 58, 0.62)",
  })

  drawEntityCircles(ctx, gameState.sledgehammers, viewport, scale, {
    fillStyle: "rgba(130, 140, 148, 0.95)",
    minRadius: 1.35,
    radiusMultiplier: 0.4,
    outlineStyle: "rgba(24, 28, 31, 0.62)",
  })
}

function drawMinimapHoles(ctx, viewport) {
  const { dugHoles } = gameState
  if (!dugHoles) {
    return
  }

  for (const hole of Object.values(dugHoles)) {
    if (!hole) {
      continue
    }

    const point = getMinimapTilePoint(hole.tileX, hole.tileY, viewport)
    if (!point) {
      continue
    }

    const inset = Math.max(0.7, viewport.tileSize * 0.08)
    const width = viewport.tileSize - inset * 2
    const height = viewport.tileSize - inset * 2
    const x = point.x + inset
    const y = point.y + inset

    if (hole.flooded) {
      ctx.fillStyle = getTerrainColor(0)
      ctx.fillRect(x, y, width, height)
      ctx.strokeStyle = "rgba(189, 236, 255, 0.5)"
      ctx.lineWidth = Math.max(0.7, viewport.tileSize * 0.09)
      ctx.beginPath()
      ctx.moveTo(x + width * 0.08, y + height * 0.55)
      ctx.lineTo(x + width * 0.92, y + height * 0.45)
      ctx.stroke()
    } else {
      ctx.fillStyle = "#444a50"
      ctx.fillRect(x, y, width, height)
      ctx.fillStyle = "#353b41"
      ctx.fillRect(x + inset * 0.5, y + inset * 0.5, width - inset, height - inset)
      ctx.fillStyle = "#2a2f34"
      ctx.fillRect(x + inset * 0.5, y + height * 0.63, width - inset, height * 0.28)
    }
  }
}

function drawMinimapTrees(ctx, viewport, scale) {
  if (!gameState.trees || gameState.trees.length === 0) {
    return
  }

  for (const tree of gameState.trees) {
    const point = getMinimapPoint(tree, viewport)
    if (!point) {
      continue
    }

    const canopyRadius = Math.max(1.8, tree.size * scale * 0.54)
    ctx.fillStyle = "rgba(64, 133, 68, 0.92)"
    ctx.beginPath()
    ctx.arc(point.x, point.y - canopyRadius * 0.14, canopyRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "rgba(26, 64, 32, 0.6)"
    ctx.lineWidth = Math.max(0.6, canopyRadius * 0.24)
    ctx.stroke()

    const trunkWidth = canopyRadius * 0.46
    const trunkHeight = canopyRadius * 0.44
    ctx.fillStyle = "rgba(110, 78, 50, 0.95)"
    ctx.fillRect(point.x - trunkWidth / 2, point.y + canopyRadius * 0.26, trunkWidth, trunkHeight)
  }
}

function drawMinimapWoodenBoxes(ctx, viewport, scale) {
  if (!gameState.woodenBoxes || gameState.woodenBoxes.length === 0) {
    return
  }

  for (const box of gameState.woodenBoxes) {
    const point = getMinimapPoint(box, viewport)
    if (!point) {
      continue
    }

    const halfSize = Math.max(1.8, (box.size || TILE_SIZE * 0.25) * scale * 0.52)
    const rotation = box.rotation || 0

    let fillStyle = "rgba(151, 107, 61, 0.92)"
    let strokeStyle = "rgba(47, 32, 20, 0.62)"

    if (box.isTrunk) {
      fillStyle = "rgba(118, 82, 55, 0.94)"
      strokeStyle = "rgba(56, 36, 24, 0.64)"
    } else if (box.isSledgeSpiked || box.isSledgeCube) {
      fillStyle = "rgba(125, 136, 146, 0.92)"
      strokeStyle = "rgba(38, 48, 55, 0.65)"
    }

    ctx.save()
    ctx.translate(point.x, point.y)
    ctx.rotate(rotation)
    ctx.fillStyle = fillStyle
    ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2)
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = Math.max(0.8, halfSize * 0.22)
    ctx.strokeRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2)
    ctx.restore()
  }
}

function drawMinimapBombs(ctx, viewport, scale) {
  if (!gameState.bombs || gameState.bombs.length === 0) {
    return
  }

  for (const bomb of gameState.bombs) {
    const point = getMinimapPoint(bomb, viewport)
    if (!point) {
      continue
    }

    const halfSize = Math.max(1.6, bomb.size * scale * 0.32)
    const bodyColor = bomb.countdown !== null ? "rgba(244, 122, 88, 0.96)" : bomb.color || "rgba(255, 138, 92, 0.95)"

    ctx.fillStyle = bodyColor
    ctx.fillRect(point.x - halfSize, point.y - halfSize, halfSize * 2, halfSize * 2)
    ctx.strokeStyle = "rgba(38, 18, 16, 0.58)"
    ctx.lineWidth = Math.max(0.7, halfSize * 0.28)
    ctx.strokeRect(point.x - halfSize, point.y - halfSize, halfSize * 2, halfSize * 2)

    ctx.strokeStyle = "rgba(24, 24, 24, 0.62)"
    ctx.lineWidth = Math.max(0.6, halfSize * 0.24)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y - halfSize)
    ctx.lineTo(point.x + halfSize * 0.45, point.y - halfSize * 1.35)
    ctx.stroke()
  }
}

function drawMinimapCars(ctx, viewport, scale) {
  if (!gameState.cars || gameState.cars.length === 0) {
    return
  }

  for (const car of gameState.cars) {
    const point = getMinimapPoint(car, viewport)
    if (!point) {
      continue
    }

    const halfWidth = Math.max(2.4, car.size * scale * 0.72)
    const halfHeight = Math.max(1.8, car.size * scale * 0.42)

    ctx.save()
    ctx.translate(point.x, point.y)
    ctx.rotate(car.direction || 0)

    let bodyColor = "#587e55"
    if (typeof car.health === "number") {
      if (car.health <= 1) {
        bodyColor = "#7f7468"
      } else if (car.health <= 2) {
        bodyColor = "#6f7f60"
      }
    }

    ctx.fillStyle = bodyColor
    ctx.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2)
    ctx.strokeStyle = "rgba(20, 34, 24, 0.65)"
    ctx.lineWidth = Math.max(0.8, halfHeight * 0.28)
    ctx.strokeRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2)

    ctx.fillStyle = "#3c5939"
    ctx.fillRect(-halfWidth * 0.52, -halfHeight * 0.54, halfWidth * 1.04, halfHeight * 1.08)

    ctx.fillStyle = "#2d2d2d"
    const wheelW = Math.max(0.9, halfWidth * 0.2)
    const wheelH = Math.max(0.8, halfHeight * 0.42)
    ctx.fillRect(-halfWidth - wheelW * 0.4, -halfHeight * 0.76, wheelW, wheelH)
    ctx.fillRect(-halfWidth - wheelW * 0.4, halfHeight * 0.2, wheelW, wheelH)
    ctx.fillRect(halfWidth - wheelW * 0.6, -halfHeight * 0.76, wheelW, wheelH)
    ctx.fillRect(halfWidth - wheelW * 0.6, halfHeight * 0.2, wheelW, wheelH)

    if (gameState.isInCar && gameState.drivingCar === car) {
      ctx.strokeStyle = "rgba(255, 221, 102, 0.92)"
      ctx.lineWidth = Math.max(1, halfHeight * 0.34)
      ctx.strokeRect(-halfWidth - 1.2, -halfHeight - 1.2, halfWidth * 2 + 2.4, halfHeight * 2 + 2.4)
    }

    ctx.restore()
  }
}

function drawMinimapBoats(ctx, viewport, scale) {
  if (!gameState.boats || gameState.boats.length === 0) {
    return
  }

  for (const boat of gameState.boats) {
    const point = getMinimapPoint(boat, viewport)
    if (!point) {
      continue
    }

    const halfLength = Math.max(2.6, boat.size * scale * 0.62)
    const halfWidth = Math.max(1.5, boat.size * scale * 0.31)

    ctx.save()
    ctx.translate(point.x, point.y)
    ctx.rotate(boat.direction || 0)

    ctx.fillStyle = boat.isBroken ? "#8d7d6a" : "#6f4f38"
    ctx.beginPath()
    ctx.ellipse(0, 0, halfLength, halfWidth, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "rgba(48, 33, 22, 0.6)"
    ctx.lineWidth = Math.max(0.8, halfWidth * 0.28)
    ctx.stroke()

    ctx.fillStyle = boat.isBroken ? "#cabca4" : "#a97c50"
    ctx.fillRect(-halfLength * 0.38, -halfWidth * 0.5, halfLength * 0.76, halfWidth)

    if (gameState.isInCar && gameState.drivingCar === boat) {
      ctx.strokeStyle = "rgba(255, 221, 102, 0.92)"
      ctx.lineWidth = Math.max(1, halfWidth * 0.45)
      ctx.strokeRect(-halfLength - 1.4, -halfWidth - 1.1, halfLength * 2 + 2.8, halfWidth * 2 + 2.2)
    }

    ctx.restore()
  }
}

function drawMinimapEnemies(ctx, viewport, scale) {
  if (!gameState.enemies || gameState.enemies.length === 0) {
    return
  }

  for (const enemy of gameState.enemies) {
    const point = getMinimapPoint(enemy, viewport)
    if (!point) {
      continue
    }

    const radius = Math.max(2, enemy.size * scale * 0.58 * getMinimapEnemyScale(enemy))
    ctx.fillStyle = enemy.color || "rgba(235, 86, 86, 0.95)"
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "rgba(24, 14, 14, 0.62)"
    ctx.lineWidth = Math.max(0.8, radius * 0.25)
    ctx.stroke()
  }
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

function getMinimapTilePoint(tileX, tileY, viewport) {
  if (
    tileX < viewport.minTileX ||
    tileX > viewport.maxTileX ||
    tileY < viewport.minTileY ||
    tileY > viewport.maxTileY
  ) {
    return null
  }

  return {
    x: viewport.mapCenterX + (tileX - viewport.playerTileX) * viewport.tileSize,
    y: viewport.mapCenterY + (tileY - viewport.playerTileY) * viewport.tileSize,
  }
}

function getMinimapEnemyScale(enemy) {
  if (!enemy.isFallingIntoHole || !enemy.holeFallStartedAt) {
    return 1
  }

  const duration = 420
  const minScale = 0.34
  const progress = Math.min(1, (Date.now() - enemy.holeFallStartedAt) / duration)
  const eased = progress * progress * (3 - 2 * progress)
  return 1 - (1 - minScale) * eased
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