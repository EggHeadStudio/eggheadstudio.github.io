import {
  TILE_SIZE,
  MINIMAP_VISIBLE_TILES_MOBILE,
  MINIMAP_VISIBLE_TILES_DESKTOP,
  MAP_SECTION_TILE_SIZE,
  MAP_SECTION_REVEAL_THRESHOLD,
} from "../core/constants.js"
import { gameState } from "../core/game-state.js"
import { getTerrainColor } from "../utils/color-utils.js"

const MINIMAP_CACHE_REFRESH_MS = 80
const MINIMAP_CACHE_REFRESH_MS_LIGHTWEIGHT = 180
const CLAIMED_SECTION_COLORS = [
  "rgba(255, 209, 102, 0.18)",
  "rgba(94, 169, 255, 0.16)",
  "rgba(110, 222, 165, 0.16)",
  "rgba(255, 132, 132, 0.15)",
  "rgba(194, 153, 255, 0.16)",
]

function getSepiaTerrainColor(terrainType) {
  switch (terrainType) {
    case 0:
      return "#8b6d4c"
    case 1:
      return "#92734f"
    case 2:
      return "#7f6141"
    case 3:
      return "#9a7a54"
    case 4:
      return "#a88b62"
    case 5:
      return "#745b40"
    default:
      return "#8a6f4e"
  }
}

let minimapCacheCanvas = null
let minimapCacheCtx = null
let minimapCacheLastUpdateAt = 0
let minimapCacheWidth = 0
let minimapCacheHeight = 0

function getSectionKeyForTile(tileX, tileY) {
  return `${Math.floor(tileX / MAP_SECTION_TILE_SIZE)},${Math.floor(tileY / MAP_SECTION_TILE_SIZE)}`
}

function getMapLayout(discoveredEntries, width, height) {
  if (!discoveredEntries.length) {
    return {
      minX: 0,
      maxX: 1,
      minY: 0,
      maxY: 1,
      mapWidth: 1,
      mapHeight: 1,
      tileSize: 1,
      offsetX: 0,
      offsetY: 0,
      width,
      height,
    }
  }

  const minX = Math.min(...discoveredEntries.map((entry) => entry.x))
  const maxX = Math.max(...discoveredEntries.map((entry) => entry.x))
  const minY = Math.min(...discoveredEntries.map((entry) => entry.y))
  const maxY = Math.max(...discoveredEntries.map((entry) => entry.y))
  const mapWidth = Math.max(1, maxX - minX + 1)
  const mapHeight = Math.max(1, maxY - minY + 1)
  const padding = 12
  const tileSize = Math.min((width - padding * 2) / mapWidth, (height - padding * 2) / mapHeight)
  const offsetX = (width - mapWidth * tileSize) / 2
  const offsetY = (height - mapHeight * tileSize) / 2

  return {
    minX,
    maxX,
    minY,
    maxY,
    mapWidth,
    mapHeight,
    tileSize,
    offsetX,
    offsetY,
    width,
    height,
  }
}

function getMapSectionEntries(discoveredEntries) {
  const bySection = new Map()

  for (const entry of discoveredEntries) {
    const sectionKey = getSectionKeyForTile(entry.x, entry.y)
    const current = bySection.get(sectionKey) || {
      key: sectionKey,
      sectionX: Number(sectionKey.split(",")[0]),
      sectionY: Number(sectionKey.split(",")[1]),
      discoveredTiles: 0,
      claimed: gameState.claimedSections.get(sectionKey) || null,
      totalTiles: MAP_SECTION_TILE_SIZE * MAP_SECTION_TILE_SIZE,
    }

    current.discoveredTiles += 1
    bySection.set(sectionKey, current)
  }

  return [...bySection.values()].map((section) => ({
    ...section,
    discoveredRatio: section.discoveredTiles / section.totalTiles,
  }))
}

function drawClaimedSectionTerrain(ctx, discoveredEntries, layout) {
  if (!gameState.claimedSections.size) {
    return
  }

  const { minX, minY, tileSize, offsetX, offsetY } = layout

  for (const entry of discoveredEntries) {
    const sectionKey = getSectionKeyForTile(entry.x, entry.y)
    if (!gameState.claimedSections.has(sectionKey)) {
      continue
    }

    const px = offsetX + (entry.x - minX) * tileSize
    const py = offsetY + (entry.y - minY) * tileSize
    ctx.fillStyle = getTerrainColor(entry.terrain)
    ctx.fillRect(Math.round(px), Math.round(py), Math.ceil(tileSize + 1), Math.ceil(tileSize + 1))
  }
}

function drawMapSectionOverlays(ctx, discoveredEntries, layout) {
  const sections = getMapSectionEntries(discoveredEntries)
  if (!sections.length) {
    return
  }

  const { offsetX, offsetY, minX, minY } = layout

  for (const section of sections) {
    const sectionMinX = section.sectionX * MAP_SECTION_TILE_SIZE
    const sectionMinY = section.sectionY * MAP_SECTION_TILE_SIZE
    const rectX = offsetX + (sectionMinX - minX) * layout.tileSize
    const rectY = offsetY + (sectionMinY - minY) * layout.tileSize
    const rectWidth = MAP_SECTION_TILE_SIZE * layout.tileSize
    const rectHeight = MAP_SECTION_TILE_SIZE * layout.tileSize

    const hasAnyReveal = section.discoveredTiles > 0
    if (!hasAnyReveal) {
      continue
    }

    const isFullyRevealed = section.discoveredRatio >= MAP_SECTION_REVEAL_THRESHOLD

    ctx.save()
    ctx.setLineDash([6, 4])
    ctx.lineWidth = section.claimed ? 1.9 : 1.4
    ctx.strokeStyle = section.claimed
      ? "rgba(255, 209, 102, 0.95)"
      : isFullyRevealed
        ? "rgba(222, 196, 146, 0.92)"
        : "rgba(186, 160, 124, 0.74)"
    ctx.strokeRect(Math.round(rectX), Math.round(rectY), Math.ceil(rectWidth), Math.ceil(rectHeight))
    ctx.restore()

    if (section.claimed) {
      const labelText = section.claimed.name
      const centerX = rectX + rectWidth * 0.5
      const centerY = rectY + rectHeight * 0.5
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(-0.12)
      ctx.font = section.claimed ? "bold 17px Avenir Next, sans-serif" : "15px Avenir Next, sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = "rgba(247, 233, 204, 0.95)"
      ctx.strokeStyle = "rgba(71, 52, 31, 0.65)"
      ctx.lineWidth = 3
      ctx.strokeText(labelText, 0, 0)
      ctx.fillText(labelText, 0, 0)
      ctx.restore()
    }
  }
}

export function handleClaimableSectionClick(clickX, clickY, width, height) {
  const discoveredEntries = [...gameState.discoveredMap.values()]
  if (!discoveredEntries.length) {
    return false
  }

  const layout = getMapLayout(discoveredEntries, width, height)
  const sections = getMapSectionEntries(discoveredEntries)

  for (const section of sections) {
    if (section.discoveredRatio < MAP_SECTION_REVEAL_THRESHOLD || !Number.isFinite(section.discoveredRatio)) {
      continue
    }

    const sectionMinX = section.sectionX * MAP_SECTION_TILE_SIZE
    const sectionMinY = section.sectionY * MAP_SECTION_TILE_SIZE
    const rectX = layout.offsetX + (sectionMinX - layout.minX) * layout.tileSize
    const rectY = layout.offsetY + (sectionMinY - layout.minY) * layout.tileSize
    const rectWidth = MAP_SECTION_TILE_SIZE * layout.tileSize
    const rectHeight = MAP_SECTION_TILE_SIZE * layout.tileSize

    if (
      clickX >= rectX &&
      clickX <= rectX + rectWidth &&
      clickY >= rectY &&
      clickY <= rectY + rectHeight
    ) {
      if (gameState.claimedSections.has(section.key)) {
        return false
      }

      const proposedName = window.prompt("Name this claimed section", "Raven's Hollow")
      const resolvedName = (proposedName || "").trim()
      if (!resolvedName) {
        return false
      }

      const color = CLAIMED_SECTION_COLORS[gameState.claimedSections.size % CLAIMED_SECTION_COLORS.length]
      gameState.claimedSections.set(section.key, {
        key: section.key,
        name: resolvedName,
        color,
        sectionX: section.sectionX,
        sectionY: section.sectionY,
      })
      return true
    }
  }

  return false
}

function getTerrainAnnotationLabel(terrainType, regionSize) {
  switch (terrainType) {
    case 0:
      if (regionSize > 180) {
        return "Lake"
      }
      if (regionSize > 60) {
        return "River"
      }
      return "Water"
    case 1:
      if (regionSize > 200) {
        return "Plain"
      }
      return "Grass"
    case 2:
      return regionSize > 160 ? "Forest" : "Woodland"
    case 3:
      return regionSize > 150 ? "Dirt" : "Ground"
    case 4:
      return regionSize > 180 ? "Beach" : "Sand"
    case 5:
      return regionSize > 150 ? "Gravel" : "Rock"
    default:
      return "Land"
  }
}

function getDirectionalRegionName(terrainType, regionSize, x, y, mapBounds) {
  const baseLabel = getTerrainAnnotationLabel(terrainType, regionSize)
  const centerX = x - (mapBounds.minX + mapBounds.maxX) / 2
  const centerY = y - (mapBounds.minY + mapBounds.maxY) / 2

  let direction = "Central"
  if (centerY < -10) {
    direction = "North"
  } else if (centerY > 10) {
    direction = "South"
  }

  if (centerX < -10) {
    direction = direction === "Central" ? "West" : direction === "North" ? "Northwest" : "Southwest"
  } else if (centerX > 10) {
    direction = direction === "Central" ? "East" : direction === "North" ? "Northeast" : "Southeast"
  }

  if (direction === "Central") {
    return baseLabel
  }

  return `${direction} ${baseLabel}`
}

export function getExplorationMapAnnotations(entries) {
  if (!entries.length) {
    return []
  }

  const entryMap = new Map(entries.map((entry) => [`${entry.x},${entry.y}`, entry]))
  const visited = new Set()
  const regions = []

  for (const entry of entries) {
    const key = `${entry.x},${entry.y}`
    if (visited.has(key)) {
      continue
    }

    const queue = [entry]
    const regionTiles = []
    visited.add(key)

    while (queue.length) {
      const current = queue.shift()
      regionTiles.push(current)

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
        { x: current.x + 1, y: current.y + 1 },
        { x: current.x - 1, y: current.y - 1 },
        { x: current.x + 1, y: current.y - 1 },
        { x: current.x - 1, y: current.y + 1 },
      ]

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`
        const neighborEntry = entryMap.get(neighborKey)
        if (!neighborEntry || visited.has(neighborKey)) {
          continue
        }

        if (neighborEntry.terrain === current.terrain) {
          queue.push(neighborEntry)
          visited.add(neighborKey)
        }
      }
    }

    if (regionTiles.length < 8) {
      continue
    }

    const centerX = regionTiles.reduce((sum, tile) => sum + tile.x, 0) / regionTiles.length
    const centerY = regionTiles.reduce((sum, tile) => sum + tile.y, 0) / regionTiles.length
    const minX = Math.min(...regionTiles.map((tile) => tile.x))
    const maxX = Math.max(...regionTiles.map((tile) => tile.x))
    const minY = Math.min(...regionTiles.map((tile) => tile.y))
    const maxY = Math.max(...regionTiles.map((tile) => tile.y))
    const spreadX = maxX - minX + 1
    const spreadY = maxY - minY + 1

    regions.push({
      x: centerX,
      y: centerY,
      terrain: regionTiles[0].terrain,
      size: regionTiles.length,
      width: spreadX,
      height: spreadY,
      label: getTerrainAnnotationLabel(regionTiles[0].terrain, regionTiles.length),
    })
  }

  return regions
    .sort((a, b) => b.size - a.size)
    .filter((region, index, all) => {
      if (index >= 8) {
        return false
      }

      return !all.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.terrain === region.terrain &&
          Math.hypot(other.x - region.x, other.y - region.y) < 14,
      )
    })
}

function drawMapAnnotations(ctx, discoveredEntries, mapBounds, tileSize, offsetX, offsetY) {
  const annotations = getExplorationMapAnnotations(discoveredEntries)
  if (!annotations.length) {
    return
  }

  const { minX, minY, maxX, maxY } = mapBounds

  for (const annotation of annotations) {
    const labelX = offsetX + (annotation.x - minX) * tileSize + tileSize * 0.5
    const labelY = offsetY + (annotation.y - minY) * tileSize + tileSize * 0.5
    const text = getDirectionalRegionName(annotation.terrain, annotation.size, annotation.x, annotation.y, {
      minX,
      maxX,
      minY,
      maxY,
    })
    ctx.font = annotation.size > 80 ? "bold 12px Avenir Next, sans-serif" : "11px Avenir Next, sans-serif"
    const metrics = ctx.measureText(text)
    const labelWidth = metrics.width + 12
    const labelHeight = 16
    const backgroundX = labelX - labelWidth / 2
    const backgroundY = labelY - labelHeight / 2

    ctx.fillStyle = "rgba(4, 12, 16, 0.65)"
    ctx.fillRect(backgroundX, backgroundY, labelWidth, labelHeight)

    ctx.strokeStyle = "rgba(255,255,255,0.25)"
    ctx.strokeRect(backgroundX, backgroundY, labelWidth, labelHeight)

    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, labelX, labelY + 0.5)

    const markerSize = Math.max(3, Math.min(7, tileSize * 0.35))
    ctx.fillStyle = getSepiaTerrainColor(annotation.terrain)
    ctx.beginPath()
    ctx.moveTo(labelX, labelY - markerSize)
    ctx.lineTo(labelX + markerSize, labelY)
    ctx.lineTo(labelX, labelY + markerSize)
    ctx.lineTo(labelX - markerSize, labelY)
    ctx.closePath()
    ctx.fill()
  }
}

export function revealNearbyWorld() {
  if (!gameState.isStarted || !gameState.player || !gameState.terrain?.length) {
    return
  }

  const centerTileX = Math.floor(gameState.player.x / TILE_SIZE)
  const centerTileY = Math.floor(gameState.player.y / TILE_SIZE)
  const radius = 26

  for (let tileY = centerTileY - radius; tileY <= centerTileY + radius; tileY++) {
    if (tileY < 0 || tileY >= gameState.terrain.length) {
      continue
    }

    for (let tileX = centerTileX - radius; tileX <= centerTileX + radius; tileX++) {
      if (tileX < 0 || tileX >= gameState.terrain[0].length) {
        continue
      }

      const distance = Math.hypot(tileX - centerTileX, tileY - centerTileY)
      if (distance > radius + 2) {
        continue
      }

      const key = `${tileX},${tileY}`
      const terrainValue = gameState.terrain[tileY][tileX]
      gameState.discoveredMap.set(key, {
        x: tileX,
        y: tileY,
        terrain: terrainValue,
      })
    }
  }
}

export function drawExplorationMapToContext(ctx, width, height) {
  const discoveredEntries = [...gameState.discoveredMap.values()]
  if (!discoveredEntries.length) {
    ctx.fillStyle = "#081d22"
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = "rgba(255,255,255,0.7)"
    ctx.font = "16px Avenir Next, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("No terrain discovered yet", width / 2, height / 2)
    return
  }

  const layout = getMapLayout(discoveredEntries, width, height)
  const { minX, maxX, minY, maxY, tileSize, offsetX, offsetY } = layout

  ctx.fillStyle = "#081d22"
  ctx.fillRect(0, 0, width, height)

  for (const entry of discoveredEntries) {
    const px = offsetX + (entry.x - minX) * tileSize
    const py = offsetY + (entry.y - minY) * tileSize
    ctx.fillStyle = getSepiaTerrainColor(entry.terrain)
    ctx.fillRect(Math.round(px), Math.round(py), Math.ceil(tileSize + 1), Math.ceil(tileSize + 1))
  }

  drawClaimedSectionTerrain(ctx, discoveredEntries, layout)

  drawMapSectionOverlays(ctx, discoveredEntries, layout)

  drawMapAnnotations(
    ctx,
    discoveredEntries,
    { minX, minY, maxX, maxY },
    tileSize,
    offsetX,
    offsetY,
  )

  const playerTileX = Math.floor(gameState.player.x / TILE_SIZE)
  const playerTileY = Math.floor(gameState.player.y / TILE_SIZE)
  const playerX = offsetX + (playerTileX - minX) * tileSize + tileSize * 0.5
  const playerY = offsetY + (playerTileY - minY) * tileSize + tileSize * 0.5

  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.beginPath()
  ctx.arc(playerX, playerY, Math.max(3, tileSize * 0.34), 0, Math.PI * 2)
  ctx.fill()
}

export function renderExplorationMapCanvas() {
  const canvas = document.getElementById("explorationMapCanvas")
  if (!canvas) {
    return
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return
  }

  const width = canvas.clientWidth || 320
  const height = canvas.clientHeight || 280
  const ratio = Math.min(window.devicePixelRatio || 1, 2)

  canvas.width = Math.floor(width * ratio)
  canvas.height = Math.floor(height * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  drawExplorationMapToContext(ctx, width, height)
}

export function drawMinimap() {
  if (!gameState.isStarted || !gameState.player) {
    return
  }

  const refs = getMinimapContext()
  if (!refs) {
    return
  }

  const { canvas, ctx } = refs
  const now = Date.now()
  const refreshInterval = gameState.lightweightMode ? MINIMAP_CACHE_REFRESH_MS_LIGHTWEIGHT : MINIMAP_CACHE_REFRESH_MS
  const needsCacheRefresh =
    !minimapCacheCanvas ||
    !minimapCacheCtx ||
    canvas.width !== minimapCacheWidth ||
    canvas.height !== minimapCacheHeight ||
    now - minimapCacheLastUpdateAt >= refreshInterval

  if (needsCacheRefresh) {
    renderMinimapCache(refs)
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(minimapCacheCanvas, 0, 0)
}

function renderMinimapCache(refs) {
  const { canvas } = refs
  const ctx = ensureMinimapCacheContext(canvas)
  if (!ctx) {
    return
  }

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
  ctx.fillStyle = gameState.lightweightMode ? "rgba(18, 26, 34, 0.56)" : "rgba(6, 12, 18, 0.74)"
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

  minimapCacheLastUpdateAt = Date.now()
}

function ensureMinimapCacheContext(sourceCanvas) {
  if (!minimapCacheCanvas) {
    minimapCacheCanvas = document.createElement("canvas")
  }

  if (!minimapCacheCtx) {
    minimapCacheCtx = minimapCacheCanvas.getContext("2d")
  }

  if (!minimapCacheCtx) {
    return null
  }

  if (sourceCanvas.width !== minimapCacheWidth || sourceCanvas.height !== minimapCacheHeight) {
    minimapCacheWidth = sourceCanvas.width
    minimapCacheHeight = sourceCanvas.height
    minimapCacheCanvas.width = minimapCacheWidth
    minimapCacheCanvas.height = minimapCacheHeight
  }

  return minimapCacheCtx
}

function drawMinimapEntities(ctx, viewport) {
  const scale = viewport.tileSize / TILE_SIZE

  if (gameState.lightweightMode) {
    drawMinimapEntitiesLightweight(ctx, viewport, scale)
    return
  }

  drawMinimapTrees(ctx, viewport, scale)
  drawMinimapRocks(ctx, viewport, scale)
  drawMinimapWoodenBoxes(ctx, viewport, scale)
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

  drawMinimapExplosions(ctx, viewport, scale)
  drawMinimapDeathEffects(ctx, viewport, scale)
}

function drawMinimapEntitiesLightweight(ctx, viewport, scale) {
  drawEntityCircles(ctx, gameState.trees, viewport, scale, {
    fillStyle: "rgba(94, 178, 95, 0.9)",
    minRadius: 1.8,
    radiusMultiplier: 0.34,
    outlineStyle: "rgba(26, 64, 32, 0.3)",
  })

  drawEntityCircles(ctx, gameState.rocks, viewport, scale, {
    fillStyle: "rgba(174, 182, 188, 0.86)",
    minRadius: 1.1,
    radiusMultiplier: 0.34,
    outlineStyle: "rgba(42, 48, 54, 0.25)",
  })

  drawEntityRects(ctx, gameState.woodenBoxes, viewport, scale, {
    fillStyle: "rgba(162, 120, 80, 0.84)",
    minSize: 1.3,
    sizeMultiplier: 0.44,
    outlineStyle: "rgba(44, 30, 22, 0.24)",
  })

  drawEntityCircles(ctx, gameState.bombs, viewport, scale, {
    fillStyle: "rgba(255, 156, 108, 0.9)",
    minRadius: 1.3,
    radiusMultiplier: 0.3,
    outlineStyle: "rgba(62, 20, 16, 0.22)",
  })

  drawEntityRects(ctx, gameState.cars, viewport, scale, {
    fillStyle: "rgba(108, 148, 102, 0.9)",
    minSize: 2,
    sizeMultiplier: 0.46,
    outlineStyle: "rgba(20, 34, 24, 0.26)",
  })

  drawEntityRects(ctx, gameState.boats, viewport, scale, {
    fillStyle: "rgba(150, 118, 86, 0.88)",
    minSize: 1.8,
    sizeMultiplier: 0.42,
    outlineStyle: "rgba(48, 33, 22, 0.24)",
  })

  drawEntityCircles(ctx, gameState.enemies, viewport, scale, {
    fillStyle: "rgba(235, 86, 86, 0.92)",
    minRadius: 1.8,
    radiusMultiplier: 0.4,
    outlineStyle: "rgba(24, 14, 14, 0.28)",
  })

  drawEntityCircles(ctx, gameState.apples, viewport, scale, {
    fillStyle: "rgba(244, 96, 96, 0.9)",
    minRadius: 1,
    radiusMultiplier: 0.32,
    outlineStyle: "rgba(70, 20, 20, 0.2)",
  })

  drawEntityCircles(ctx, gameState.thrownApples, viewport, scale, {
    fillStyle: "rgba(244, 96, 96, 0.78)",
    minRadius: 0.9,
    radiusMultiplier: 0.28,
    outlineStyle: "rgba(70, 20, 20, 0.16)",
  })

  drawEntityCircles(ctx, gameState.shovels, viewport, scale, {
    fillStyle: "rgba(146, 176, 196, 0.88)",
    minRadius: 1.1,
    radiusMultiplier: 0.3,
    outlineStyle: "rgba(30, 44, 58, 0.2)",
  })

  drawEntityCircles(ctx, gameState.sledgehammers, viewport, scale, {
    fillStyle: "rgba(154, 162, 170, 0.88)",
    minRadius: 1.1,
    radiusMultiplier: 0.3,
    outlineStyle: "rgba(24, 28, 31, 0.2)",
  })

  drawEntityCircles(ctx, gameState.explosions, viewport, scale, {
    fillStyle: "rgba(255, 185, 94, 0.8)",
    minRadius: 1.4,
    radiusMultiplier: 0.14,
    outlineStyle: "rgba(255, 220, 150, 0.22)",
    colorForItem: (explosion) => {
      if (!explosion) {
        return "rgba(255, 185, 94, 0.8)"
      }

      const radiusSource = explosion.maxRadius || explosion.radius || explosion.size || TILE_SIZE * 0.5
      const intensity = Math.min(1, Math.max(0.2, radiusSource / (TILE_SIZE * 5)))
      return `rgba(255, 185, 94, ${0.55 + intensity * 0.25})`
    },
  })

  drawEntityCircles(ctx, gameState.deathEffects, viewport, scale, {
    fillStyle: "rgba(142, 28, 36, 0.72)",
    minRadius: 1.1,
    radiusMultiplier: 0.16,
    outlineStyle: "rgba(255, 180, 180, 0.12)",
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

function drawMinimapRocks(ctx, viewport, scale) {
  if (!gameState.rocks || gameState.rocks.length === 0) {
    return
  }

  drawEntityCircles(ctx, gameState.rocks, viewport, scale, {
    fillStyle: "rgba(136, 145, 150, 0.95)",
    minRadius: 1.2,
    radiusMultiplier: 0.42,
    outlineStyle: "rgba(35, 40, 44, 0.64)",
  })
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

function drawMinimapExplosions(ctx, viewport, scale) {
  if (!gameState.explosions || gameState.explosions.length === 0) {
    return
  }

  for (const explosion of gameState.explosions) {
    const point = getMinimapPoint(explosion, viewport)
    if (!point) {
      continue
    }

    const radiusSource = explosion.maxRadius || explosion.radius || explosion.size || TILE_SIZE * 0.5
    const radius = Math.max(1.8, radiusSource * scale * 0.11)

    ctx.fillStyle = "rgba(255, 161, 64, 0.9)"
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "rgba(255, 220, 150, 0.5)"
    ctx.lineWidth = Math.max(0.6, radius * 0.22)
    ctx.stroke()
  }
}

function drawMinimapDeathEffects(ctx, viewport, scale) {
  if (!gameState.deathEffects || gameState.deathEffects.length === 0) {
    return
  }

  for (const effect of gameState.deathEffects) {
    const point = getMinimapPoint(effect, viewport)
    if (!point) {
      continue
    }

    const radius = Math.max(1.4, (effect.size || TILE_SIZE * 0.25) * scale * 0.2)

    ctx.fillStyle = "rgba(122, 12, 18, 0.82)"
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "rgba(255, 180, 180, 0.18)"
    ctx.lineWidth = Math.max(0.5, radius * 0.2)
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
  const maxPixelRatio = gameState.lightweightMode ? 1.1 : 2
  const devicePixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio)
  const desiredWidth = Math.floor(canvas.clientWidth * devicePixelRatio)
  const desiredHeight = Math.floor(canvas.clientHeight * devicePixelRatio)

  if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
    canvas.width = desiredWidth
    canvas.height = desiredHeight
  }

  return { canvas, ctx }
}