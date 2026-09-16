// Terrain rendering
import { gameState } from "../core/game-state.js"
import { TILE_SIZE, TERRAIN_TYPES } from "../core/constants.js"
import { getTerrainColor, adjustColorBrightness } from "../utils/color-utils.js"
import { isHoleTile, isHoleFlooded } from "../entities/shovels.js"

// Deterministic pseudo-random value for a tile detail.
// Using a hash instead of Math.random() keeps every blade, tuft and pebble
// anchored to the same spot each frame instead of flickering around.
function tileNoise(x, y, index) {
  const value = Math.sin(x * 127.1 + y * 311.7 + index * 74.7) * 43758.5453
  return value - Math.floor(value)
}

// getTerrainColor + adjustColorBrightness parse and rebuild a hex string every
// call. Gravel alone asked for one per pebble per tile, so the results are
// memoised here - there are only a handful of distinct shades in the whole game.
const shadeCache = new Map()

function terrainShade(terrainType, percent) {
  const key = terrainType * 1000 + percent
  let color = shadeCache.get(key)

  if (color === undefined) {
    color = adjustColorBrightness(getTerrainColor(terrainType), percent)
    shadeCache.set(key, color)
  }

  return color
}

// Ground types whose detail never animates can be drawn once into an offscreen
// atlas and then blitted, instead of replaying their paths every single frame.
// Water, grass and forest are excluded because they move with the wind/waves.
const CACHED_DETAIL_TERRAIN = { 3: true, 4: true, 5: true }
const TILE_SPRITE_VARIANTS = 48
const tileAtlases = new Map()
const TERRAIN_BLEND_PRIORITY = {
  0: 0,
  4: 1,
  3: 2,
  1: 3,
  2: 4,
  5: 5,
  // Roads sit low so the surrounding ground blends inwards over the tarmac,
  // instead of the road bleeding outwards and losing its built shape.
  6: 0.5,
}

function getTileVariant(tileX, tileY) {
  const variant = (tileNoise(tileX, tileY, 900) * TILE_SPRITE_VARIANTS) | 0
  return variant < TILE_SPRITE_VARIANTS ? variant : TILE_SPRITE_VARIANTS - 1
}

function buildTileAtlas(terrainType, isLightweight) {
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null
  const atlasCtx = canvas && canvas.getContext ? canvas.getContext("2d") : null

  if (!atlasCtx) {
    return null
  }

  canvas.width = TILE_SIZE * TILE_SPRITE_VARIANTS
  canvas.height = TILE_SIZE

  for (let variant = 0; variant < TILE_SPRITE_VARIANTS; variant++) {
    const offsetX = variant * TILE_SIZE

    atlasCtx.fillStyle = getTerrainColor(terrainType)
    atlasCtx.fillRect(offsetX, 0, TILE_SIZE, TILE_SIZE)
    atlasCtx.fillStyle = terrainShade(terrainType, -10)

    // Feed the detail generator spread-out fake tile coordinates so each
    // variant gets its own pebble/grain/crack layout.
    drawStaticTileDetail(atlasCtx, terrainType, variant * 17 + 3, variant * 29 + 11, offsetX, 0, isLightweight)
  }

  return canvas
}

function getTileAtlas(terrainType, isLightweight) {
  const key = `${terrainType}:${isLightweight ? 1 : 0}`

  if (!tileAtlases.has(key)) {
    tileAtlases.set(key, buildTileAtlas(terrainType, isLightweight))
  }

  return tileAtlases.get(key)
}

function getDigAnimationForTile(tileX, tileY) {
  const animations = gameState.digAnimations || []
  return animations.find((animation) => animation.tileX === tileX && animation.tileY === tileY) || null
}

function getDigAnimationAlpha(animation) {
  const elapsed = Date.now() - animation.startedAt
  const progress = Math.min(1, elapsed / (animation.duration || 500))
  const reveal = 1 - progress

  if (animation.mode === "fill") {
    return 0.22 + reveal * 0.78
  }

  return 0.12 + progress * 0.88
}

function getTerrainTypeAt(tileX, tileY) {
  const { terrain } = gameState

  if (!terrain || tileY < 0 || tileY >= terrain.length || tileX < 0 || tileX >= terrain[0].length) {
    return null
  }

  return terrain[tileY][tileX]
}

function shouldBlendTerrainIntoTile(sourceTerrainType, targetTerrainType) {
  if (sourceTerrainType == null || targetTerrainType == null || sourceTerrainType === targetTerrainType) {
    return false
  }

  return (TERRAIN_BLEND_PRIORITY[sourceTerrainType] || 0) > (TERRAIN_BLEND_PRIORITY[targetTerrainType] || 0)
}

function getLowPolyDepth(tileX, tileY, index, minDepth, maxDepth) {
  return minDepth + tileNoise(tileX, tileY, index) * (maxDepth - minDepth)
}

function drawLowPolyEdgeTransition(ctx, tileX, tileY, screenX, screenY, sourceTerrainType, edge) {
  const seed = edge.charCodeAt(0)
  const topDepth = getLowPolyDepth(tileX, tileY, seed, TILE_SIZE * 0.22, TILE_SIZE * 0.46)
  const middleDepth = getLowPolyDepth(tileX, tileY, seed + 1, TILE_SIZE * 0.28, TILE_SIZE * 0.62)
  const bottomDepth = getLowPolyDepth(tileX, tileY, seed + 2, TILE_SIZE * 0.22, TILE_SIZE * 0.46)
  const middleOffset = getLowPolyDepth(tileX, tileY, seed + 3, TILE_SIZE * 0.28, TILE_SIZE * 0.72)
  const accentTopDepth = Math.max(TILE_SIZE * 0.14, topDepth - TILE_SIZE * 0.08)
  const accentMiddleDepth = Math.max(TILE_SIZE * 0.2, middleDepth - TILE_SIZE * 0.1)
  const accentBottomDepth = Math.max(TILE_SIZE * 0.14, bottomDepth - TILE_SIZE * 0.08)
  const accentMiddleOffset = Math.max(TILE_SIZE * 0.18, middleOffset - TILE_SIZE * 0.08)
  const fillColor = getTerrainColor(sourceTerrainType)
  const facetColor = terrainShade(sourceTerrainType, sourceTerrainType === 0 ? 8 : -7)

  ctx.save()
  ctx.fillStyle = fillColor
  ctx.beginPath()

  if (edge === "left") {
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + topDepth, screenY)
    ctx.lineTo(screenX + middleDepth, screenY + middleOffset)
    ctx.lineTo(screenX + bottomDepth, screenY + TILE_SIZE)
    ctx.lineTo(screenX, screenY + TILE_SIZE)
  } else if (edge === "right") {
    ctx.moveTo(screenX + TILE_SIZE - topDepth, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE)
    ctx.lineTo(screenX + TILE_SIZE - middleDepth, screenY + middleOffset)
    ctx.lineTo(screenX + TILE_SIZE - bottomDepth, screenY + TILE_SIZE)
  } else if (edge === "top") {
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY + topDepth)
    ctx.lineTo(screenX + middleOffset, screenY + middleDepth)
    ctx.lineTo(screenX, screenY + bottomDepth)
  } else {
    ctx.moveTo(screenX, screenY + TILE_SIZE - topDepth)
    ctx.lineTo(screenX + middleOffset, screenY + TILE_SIZE - middleDepth)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE - bottomDepth)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE)
    ctx.lineTo(screenX, screenY + TILE_SIZE)
  }

  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = facetColor
  ctx.globalAlpha = sourceTerrainType === 0 ? 0.22 : 0.3
  ctx.beginPath()

  if (edge === "left") {
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + accentTopDepth, screenY)
    ctx.lineTo(screenX + accentMiddleDepth, screenY + accentMiddleOffset)
    ctx.lineTo(screenX + accentBottomDepth, screenY + TILE_SIZE)
    ctx.lineTo(screenX, screenY + TILE_SIZE)
  } else if (edge === "right") {
    ctx.moveTo(screenX + TILE_SIZE - accentTopDepth, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE)
    ctx.lineTo(screenX + TILE_SIZE - accentBottomDepth, screenY + TILE_SIZE)
    ctx.lineTo(screenX + TILE_SIZE - accentMiddleDepth, screenY + accentMiddleOffset)
  } else if (edge === "top") {
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY + accentTopDepth)
    ctx.lineTo(screenX + accentMiddleOffset, screenY + accentMiddleDepth)
    ctx.lineTo(screenX, screenY + accentBottomDepth)
  } else {
    ctx.moveTo(screenX, screenY + TILE_SIZE - accentTopDepth)
    ctx.lineTo(screenX + accentMiddleOffset, screenY + TILE_SIZE - accentMiddleDepth)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE - accentBottomDepth)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE)
    ctx.lineTo(screenX, screenY + TILE_SIZE)
  }

  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawLowPolyCornerTransition(ctx, tileX, tileY, screenX, screenY, sourceTerrainType, corner) {
  const horizontalDepth = getLowPolyDepth(tileX, tileY, 700 + corner.charCodeAt(0), TILE_SIZE * 0.24, TILE_SIZE * 0.56)
  const verticalDepth = getLowPolyDepth(tileX, tileY, 710 + corner.charCodeAt(1), TILE_SIZE * 0.24, TILE_SIZE * 0.56)
  const diagonalDepth = getLowPolyDepth(tileX, tileY, 720 + corner.charCodeAt(0) + corner.charCodeAt(1), TILE_SIZE * 0.16, TILE_SIZE * 0.42)
  const fillColor = getTerrainColor(sourceTerrainType)
  const facetColor = terrainShade(sourceTerrainType, sourceTerrainType === 0 ? 10 : -9)

  ctx.save()
  ctx.fillStyle = fillColor
  ctx.beginPath()

  if (corner === "tl") {
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + horizontalDepth, screenY)
    ctx.lineTo(screenX + diagonalDepth, screenY + diagonalDepth)
    ctx.lineTo(screenX, screenY + verticalDepth)
  } else if (corner === "tr") {
    ctx.moveTo(screenX + TILE_SIZE, screenY)
    ctx.lineTo(screenX + TILE_SIZE - horizontalDepth, screenY)
    ctx.lineTo(screenX + TILE_SIZE - diagonalDepth, screenY + diagonalDepth)
    ctx.lineTo(screenX + TILE_SIZE, screenY + verticalDepth)
  } else if (corner === "bl") {
    ctx.moveTo(screenX, screenY + TILE_SIZE)
    ctx.lineTo(screenX + horizontalDepth, screenY + TILE_SIZE)
    ctx.lineTo(screenX + diagonalDepth, screenY + TILE_SIZE - diagonalDepth)
    ctx.lineTo(screenX, screenY + TILE_SIZE - verticalDepth)
  } else {
    ctx.moveTo(screenX + TILE_SIZE, screenY + TILE_SIZE)
    ctx.lineTo(screenX + TILE_SIZE - horizontalDepth, screenY + TILE_SIZE)
    ctx.lineTo(screenX + TILE_SIZE - diagonalDepth, screenY + TILE_SIZE - diagonalDepth)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE - verticalDepth)
  }

  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = facetColor
  ctx.globalAlpha = sourceTerrainType === 0 ? 0.2 : 0.28
  ctx.beginPath()

  if (corner === "tl") {
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + horizontalDepth * 0.7, screenY)
    ctx.lineTo(screenX + diagonalDepth * 0.68, screenY + diagonalDepth * 0.68)
    ctx.lineTo(screenX, screenY + verticalDepth * 0.7)
  } else if (corner === "tr") {
    ctx.moveTo(screenX + TILE_SIZE, screenY)
    ctx.lineTo(screenX + TILE_SIZE - horizontalDepth * 0.7, screenY)
    ctx.lineTo(screenX + TILE_SIZE - diagonalDepth * 0.68, screenY + diagonalDepth * 0.68)
    ctx.lineTo(screenX + TILE_SIZE, screenY + verticalDepth * 0.7)
  } else if (corner === "bl") {
    ctx.moveTo(screenX, screenY + TILE_SIZE)
    ctx.lineTo(screenX + horizontalDepth * 0.7, screenY + TILE_SIZE)
    ctx.lineTo(screenX + diagonalDepth * 0.68, screenY + TILE_SIZE - diagonalDepth * 0.68)
    ctx.lineTo(screenX, screenY + TILE_SIZE - verticalDepth * 0.7)
  } else {
    ctx.moveTo(screenX + TILE_SIZE, screenY + TILE_SIZE)
    ctx.lineTo(screenX + TILE_SIZE - horizontalDepth * 0.7, screenY + TILE_SIZE)
    ctx.lineTo(screenX + TILE_SIZE - diagonalDepth * 0.68, screenY + TILE_SIZE - diagonalDepth * 0.68)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE - verticalDepth * 0.7)
  }

  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawTerrainTransitions(ctx, startX, startY, endX, endY) {
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const terrainType = getTerrainTypeAt(x, y)

      if (terrainType == null || isHoleTile(x, y)) {
        continue
      }

      const screenX = x * TILE_SIZE - gameState.camera.x
      const screenY = y * TILE_SIZE - gameState.camera.y
      const left = getTerrainTypeAt(x - 1, y)
      const right = getTerrainTypeAt(x + 1, y)
      const top = getTerrainTypeAt(x, y - 1)
      const bottom = getTerrainTypeAt(x, y + 1)
      const topLeft = getTerrainTypeAt(x - 1, y - 1)
      const topRight = getTerrainTypeAt(x + 1, y - 1)
      const bottomLeft = getTerrainTypeAt(x - 1, y + 1)
      const bottomRight = getTerrainTypeAt(x + 1, y + 1)

      if (shouldBlendTerrainIntoTile(left, terrainType)) {
        drawLowPolyEdgeTransition(ctx, x, y, screenX, screenY, left, "left")
      }

      if (shouldBlendTerrainIntoTile(right, terrainType)) {
        drawLowPolyEdgeTransition(ctx, x, y, screenX, screenY, right, "right")
      }

      if (shouldBlendTerrainIntoTile(top, terrainType)) {
        drawLowPolyEdgeTransition(ctx, x, y, screenX, screenY, top, "top")
      }

      if (shouldBlendTerrainIntoTile(bottom, terrainType)) {
        drawLowPolyEdgeTransition(ctx, x, y, screenX, screenY, bottom, "bottom")
      }

      if (shouldBlendTerrainIntoTile(topLeft, terrainType)) {
        drawLowPolyCornerTransition(ctx, x, y, screenX, screenY, topLeft, "tl")
      }

      if (shouldBlendTerrainIntoTile(topRight, terrainType)) {
        drawLowPolyCornerTransition(ctx, x, y, screenX, screenY, topRight, "tr")
      }

      if (shouldBlendTerrainIntoTile(bottomLeft, terrainType)) {
        drawLowPolyCornerTransition(ctx, x, y, screenX, screenY, bottomLeft, "bl")
      }

      if (shouldBlendTerrainIntoTile(bottomRight, terrainType)) {
        drawLowPolyCornerTransition(ctx, x, y, screenX, screenY, bottomRight, "br")
      }
    }
  }
}

function isRoadTile(tileX, tileY) {
  return getTerrainTypeAt(tileX, tileY) === TERRAIN_TYPES.ROAD
}

function drawRoadCornerFacet(ctx, tileX, tileY, screenX, screenY, corner) {
  const outerDepth = getLowPolyDepth(tileX, tileY, 840 + corner.charCodeAt(0), TILE_SIZE * 0.3, TILE_SIZE * 0.48)
  const innerDepth = getLowPolyDepth(tileX, tileY, 860 + corner.charCodeAt(1), TILE_SIZE * 0.14, TILE_SIZE * 0.26)
  const blendAlpha = 0.2 + tileNoise(tileX, tileY, 880 + corner.charCodeAt(0) + corner.charCodeAt(1)) * 0.1

  ctx.save()
  ctx.fillStyle = terrainShade(TERRAIN_TYPES.ROAD, 10)
  ctx.globalAlpha = blendAlpha
  ctx.beginPath()

  if (corner === "tl") {
    ctx.moveTo(screenX, screenY + outerDepth)
    ctx.lineTo(screenX, screenY)
    ctx.lineTo(screenX + outerDepth, screenY)
    ctx.lineTo(screenX + innerDepth, screenY + innerDepth)
  } else if (corner === "tr") {
    ctx.moveTo(screenX + TILE_SIZE - outerDepth, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY)
    ctx.lineTo(screenX + TILE_SIZE, screenY + outerDepth)
    ctx.lineTo(screenX + TILE_SIZE - innerDepth, screenY + innerDepth)
  } else if (corner === "bl") {
    ctx.moveTo(screenX, screenY + TILE_SIZE - outerDepth)
    ctx.lineTo(screenX + innerDepth, screenY + TILE_SIZE - innerDepth)
    ctx.lineTo(screenX + outerDepth, screenY + TILE_SIZE)
    ctx.lineTo(screenX, screenY + TILE_SIZE)
  } else {
    ctx.moveTo(screenX + TILE_SIZE - innerDepth, screenY + TILE_SIZE - innerDepth)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE - outerDepth)
    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE)
    ctx.lineTo(screenX + TILE_SIZE - outerDepth, screenY + TILE_SIZE)
  }

  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawRoadTile(ctx, tileX, tileY, screenX, screenY, isLightweight) {
  const left = isRoadTile(tileX - 1, tileY)
  const right = isRoadTile(tileX + 1, tileY)
  const top = isRoadTile(tileX, tileY - 1)
  const bottom = isRoadTile(tileX, tileY + 1)
  const asphaltColor = getTerrainColor(TERRAIN_TYPES.ROAD)
  const edgeShade = terrainShade(TERRAIN_TYPES.ROAD, -28)
  const centerShade = terrainShade(TERRAIN_TYPES.ROAD, 6)
  const shoulder = 2

  ctx.fillStyle = asphaltColor
  ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

  ctx.fillStyle = edgeShade
  if (!top) {
    ctx.fillRect(screenX, screenY, TILE_SIZE, shoulder)
  }
  if (!bottom) {
    ctx.fillRect(screenX, screenY + TILE_SIZE - shoulder, TILE_SIZE, shoulder)
  }
  if (!left) {
    ctx.fillRect(screenX, screenY, shoulder, TILE_SIZE)
  }
  if (!right) {
    ctx.fillRect(screenX + TILE_SIZE - shoulder, screenY, shoulder, TILE_SIZE)
  }

  ctx.fillStyle = centerShade
  if ((left || right) && !top && !bottom) {
    ctx.fillRect(screenX, screenY + TILE_SIZE * 0.48, TILE_SIZE, 1.5)
  } else if ((top || bottom) && !left && !right) {
    ctx.fillRect(screenX + TILE_SIZE * 0.48, screenY, 1.5, TILE_SIZE)
  }

  if (!isLightweight) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(screenX + 4, screenY + TILE_SIZE * 0.28)
    ctx.lineTo(screenX + TILE_SIZE - 4, screenY + TILE_SIZE * 0.28)
    ctx.moveTo(screenX + 4, screenY + TILE_SIZE * 0.72)
    ctx.lineTo(screenX + TILE_SIZE - 4, screenY + TILE_SIZE * 0.72)
    ctx.stroke()
  }

  if (left && top && !right && !bottom) {
    drawRoadCornerFacet(ctx, tileX, tileY, screenX, screenY, "tl")
  }

  if (right && top && !left && !bottom) {
    drawRoadCornerFacet(ctx, tileX, tileY, screenX, screenY, "tr")
  }

  if (left && bottom && !right && !top) {
    drawRoadCornerFacet(ctx, tileX, tileY, screenX, screenY, "bl")
  }

  if (right && bottom && !left && !top) {
    drawRoadCornerFacet(ctx, tileX, tileY, screenX, screenY, "br")
  }
}

// Draw terrain
export function drawTerrain() {
  const { terrain, camera, ctx } = gameState
  const isLightweight = gameState.lightweightMode

  const startX = Math.floor(camera.x / TILE_SIZE)
  const startY = Math.floor(camera.y / TILE_SIZE)
  const endX = startX + Math.ceil(ctx.canvas.width / TILE_SIZE) + 1
  const endY = startY + Math.ceil(ctx.canvas.height / TILE_SIZE) + 1
  const time = Date.now() / 1000 // For animations

  // Slow travelling wind field shared by grass and trees so the whole world
  // breathes together instead of each tile jittering on its own.
  // ~5s per sway cycle: fluid and clearly visible without being frantic.
  const windPhase = time * 1.25
  const gustStrength = 0.75 + 0.25 * Math.sin(time * 0.35)

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (y >= 0 && y < terrain.length && x >= 0 && x < terrain[0].length) {
        const terrainType = terrain[y][x]
        const screenX = x * TILE_SIZE - camera.x
        const screenY = y * TILE_SIZE - camera.y
        const tileAnimation = getDigAnimationForTile(x, y)
        const tileAlpha = tileAnimation ? getDigAnimationAlpha(tileAnimation) : 1

        // Dirt, sand and gravel come straight from the pre-rendered atlas: one
        // blit instead of dozens of path fills per tile. Rounding the
        // destination keeps neighbouring variants from bleeding into each other
        // and still lines up perfectly, because tiles are exactly TILE_SIZE apart.
        if (CACHED_DETAIL_TERRAIN[terrainType]) {
          const atlas = getTileAtlas(terrainType, isLightweight)

          if (atlas) {
            const variant = getTileVariant(x, y)

            if (tileAlpha !== 1) {
              ctx.globalAlpha = tileAlpha
            }

            ctx.drawImage(
              atlas,
              variant * TILE_SIZE,
              0,
              TILE_SIZE,
              TILE_SIZE,
              Math.round(screenX),
              Math.round(screenY),
              TILE_SIZE,
              TILE_SIZE,
            )

            if (tileAlpha !== 1) {
              ctx.globalAlpha = 1
            }

            continue
          }
        }

        ctx.save()
        ctx.globalAlpha = tileAlpha

        // Draw terrain tile
        ctx.fillStyle = getTerrainColor(terrainType)
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

        // Add texture/detail to terrain
        ctx.fillStyle = terrainShade(terrainType, -10)

        if (terrainType === TERRAIN_TYPES.WATER) {
          // TERRAIN_TYPES.WATER
          if (!isLightweight) {
            // Water ripples animation
            const waveOffset = Math.sin(time + x * 0.3 + y * 0.2) * 3

            ctx.beginPath()
            ctx.moveTo(screenX, screenY + TILE_SIZE / 2 + waveOffset)
            ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE / 2 - waveOffset)
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
            ctx.lineWidth = 2
            ctx.stroke()

            // Second wave for more texture
            const waveOffset2 = Math.sin(time * 1.5 + x * 0.4 + y * 0.3) * 2
            ctx.beginPath()
            ctx.moveTo(screenX, screenY + TILE_SIZE / 3 + waveOffset2)
            ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE / 3 - waveOffset2)
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
            ctx.lineWidth = 1
            ctx.stroke()
          }
        } else if (terrainType === TERRAIN_TYPES.GRASS) {
          // TERRAIN_TYPES.GRASS
          // Grass is drawn purely as blades that lean side to side in the wind.
          ctx.strokeStyle = terrainShade(terrainType, -18)
          ctx.lineWidth = isLightweight ? 1 : 1.5
          ctx.lineCap = "round"

          const bladeCount = isLightweight ? 4 : 9
          for (let i = 0; i < bladeCount; i++) {
            const baseX = screenX + 3 + tileNoise(x, y, i + 30) * (TILE_SIZE - 6)
            const baseY = screenY + TILE_SIZE - 2 - tileNoise(x, y, i + 35) * (TILE_SIZE - 6)
            const height = 9 + tileNoise(x, y, i + 40) * 7

            // Phase shifts with world position so the wind visibly rolls
            // across the field rather than every blade moving in lockstep.
            const bladePhase = windPhase + x * 0.32 + y * 0.16 + tileNoise(x, y, i + 50) * 1.4
            const bend = isLightweight ? 0 : Math.sin(bladePhase) * gustStrength * 10

            ctx.beginPath()
            ctx.moveTo(baseX, baseY)
            ctx.quadraticCurveTo(baseX + bend * 0.35, baseY - height * 0.55, baseX + bend, baseY - height)
            ctx.stroke()
          }

          ctx.lineCap = "butt"
        } else if (terrainType === TERRAIN_TYPES.FOREST) {
          // TERRAIN_TYPES.FOREST
          // Forest details - tree-like shapes
          const centerX = screenX + TILE_SIZE / 2
          const centerY = screenY + TILE_SIZE / 2
          const radius = TILE_SIZE / 4

          // Tree top (circle)
          ctx.beginPath()
          ctx.arc(centerX, centerY - radius / 2, radius, 0, Math.PI * 2)
          ctx.fill()

          // Tree trunk
          ctx.fillStyle = "#795548"
          ctx.fillRect(centerX - 2, centerY, 4, TILE_SIZE / 4)

          // Tree canopy drifts with the same slow breeze as the grass
          const sway = Math.sin(windPhase + x * 0.32 + y * 0.16) * gustStrength * 1.6
          ctx.fillStyle = terrainShade(terrainType, 5)
          ctx.beginPath()
          ctx.arc(centerX + sway, centerY - radius / 2 - 2, radius * 0.7, 0, Math.PI * 2)
          ctx.fill()
        } else if (terrainType === TERRAIN_TYPES.ROAD) {
          drawRoadTile(ctx, x, y, screenX, screenY, isLightweight)
        } else {
          // Dirt, sand and gravel only reach this fallback when the sprite
          // atlas could not be created; normally they are blitted above.
          drawStaticTileDetail(ctx, terrainType, x, y, screenX, screenY, isLightweight)
        }

        ctx.restore()
      }
    }
  }

  drawTerrainTransitions(ctx, startX, startY, endX, endY)

  if (Array.isArray(gameState.digAnimations)) {
    gameState.digAnimations = gameState.digAnimations.filter((animation) => Date.now() - animation.startedAt < (animation.duration || 1000))
  }

  // Second pass: holes are painted after every terrain tile, so grass detail
  // from neighbouring tiles can never stick out over a dug hole. This replaces
  // a per-tile clip() which was far too expensive to run on mobile GPUs.
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (y >= 0 && y < terrain.length && x >= 0 && x < terrain[0].length && isHoleTile(x, y)) {
        drawHoleTile(ctx, x * TILE_SIZE - camera.x, y * TILE_SIZE - camera.y, isHoleFlooded(x, y), x, y, time)
      }
    }
  }

  drawPendingDigOverlay(ctx, time)
}

// Detail for the ground types that never animate. Called once per atlas variant
// at startup, or per tile as a fallback if the atlas could not be created.
function drawStaticTileDetail(ctx, terrainType, x, y, screenX, screenY, isLightweight) {
  if (terrainType === TERRAIN_TYPES.DIRT) {
    // TERRAIN_TYPES.DIRT
    // Cracked ground - static jagged fissures, never animated.
    ctx.strokeStyle = terrainShade(terrainType, -22)
    ctx.lineWidth = 1
    ctx.lineCap = "round"

    for (let i = 0; i < 3; i++) {
      let crackX = screenX + 4 + tileNoise(x, y, i + 60) * (TILE_SIZE - 8)
      let crackY = screenY + 4 + tileNoise(x, y, i + 70) * (TILE_SIZE - 8)
      let angle = tileNoise(x, y, i + 80) * Math.PI * 2

      ctx.beginPath()
      ctx.moveTo(crackX, crackY)

      // Walk a few short segments, kinking the direction each step so the
      // line reads as a fracture rather than a straight scratch.
      for (let segment = 0; segment < 3; segment++) {
        const segmentLength = 3 + tileNoise(x, y, i * 10 + segment + 90) * 5
        angle += (tileNoise(x, y, i * 10 + segment + 120) - 0.5) * 1.6
        crackX += Math.cos(angle) * segmentLength
        crackY += Math.sin(angle) * segmentLength
        ctx.lineTo(crackX, crackY)
      }
      ctx.stroke()

      // Small offshoot branch, like a real crack splitting
      if (tileNoise(x, y, i + 150) > 0.45) {
        const branchAngle = angle + (tileNoise(x, y, i + 160) - 0.5) * 2.2
        const branchLength = 2 + tileNoise(x, y, i + 170) * 4
        ctx.beginPath()
        ctx.moveTo(crackX, crackY)
        ctx.lineTo(crackX + Math.cos(branchAngle) * branchLength, crackY + Math.sin(branchAngle) * branchLength)
        ctx.stroke()
      }
    }

    ctx.lineCap = "butt"
  } else if (terrainType === TERRAIN_TYPES.SAND) {
    // TERRAIN_TYPES.SAND
    // Fine grains plus a few shell-like flecks, all position hashed so
    // the beach never shimmers between frames.
    const grainCount = isLightweight ? 5 : 12
    for (let i = 0; i < grainCount; i++) {
      const grainX = screenX + 2 + tileNoise(x, y, i + 200) * (TILE_SIZE - 4)
      const grainY = screenY + 2 + tileNoise(x, y, i + 220) * (TILE_SIZE - 4)
      const shade = tileNoise(x, y, i + 240)

      ctx.fillStyle =
        shade > 0.82 ? "rgba(255, 255, 255, 0.55)" : terrainShade(terrainType, shade > 0.5 ? -16 : 10)
      ctx.fillRect(grainX, grainY, 2, 2)
    }

    if (!isLightweight) {
      // Soft ripples left behind by the water on the shore.
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)"
      ctx.lineWidth = 1
      for (let i = 0; i < 2; i++) {
        const rippleY = screenY + 8 + tileNoise(x, y, i + 260) * (TILE_SIZE - 16)
        ctx.beginPath()
        ctx.moveTo(screenX + 3, rippleY)
        ctx.quadraticCurveTo(screenX + TILE_SIZE / 2, rippleY - 3, screenX + TILE_SIZE - 3, rippleY)
        ctx.stroke()
      }
    }
  } else if (terrainType === TERRAIN_TYPES.GRAVEL) {
    // TERRAIN_TYPES.GRAVEL
    // Loose grey stones of varying size scattered over the tile.
    const stoneCount = isLightweight ? 6 : 14
    for (let i = 0; i < stoneCount; i++) {
      const stoneX = screenX + 3 + tileNoise(x, y, i + 300) * (TILE_SIZE - 6)
      const stoneY = screenY + 3 + tileNoise(x, y, i + 320) * (TILE_SIZE - 6)
      const stoneSize = 1.5 + tileNoise(x, y, i + 340) * 2.6
      const shade = tileNoise(x, y, i + 360)

      ctx.fillStyle = terrainShade(terrainType, shade > 0.55 ? 18 : -24)
      ctx.beginPath()
      ctx.ellipse(stoneX, stoneY, stoneSize, stoneSize * 0.78, shade * Math.PI, 0, Math.PI * 2)
      ctx.fill()

      // Tiny highlight so the stones read as rounded, not flat dots.
      if (!isLightweight && stoneSize > 2.6) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.22)"
        ctx.beginPath()
        ctx.arc(stoneX - stoneSize * 0.3, stoneY - stoneSize * 0.3, stoneSize * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function drawPendingDigOverlay(ctx, time) {
  const pendingDigTile = gameState.pendingDigTile

  if (
    !pendingDigTile ||
    !gameState.hasShovel ||
    gameState.selectedTool !== "shovel" ||
    gameState.isInCar ||
    (gameState.player?.shovelDig && Date.now() - gameState.player.shovelDig.startedAt < (gameState.player.shovelDig.duration || 1000))
  ) {
    return
  }

  const screenX = pendingDigTile.tileX * TILE_SIZE - gameState.camera.x
  const screenY = pendingDigTile.tileY * TILE_SIZE - gameState.camera.y

  if (
    screenX + TILE_SIZE < 0 ||
    screenX > gameState.canvas.width ||
    screenY + TILE_SIZE < 0 ||
    screenY > gameState.canvas.height
  ) {
    return
  }

  const pulse = 0.5 + 0.5 * Math.sin(time * 6)

  ctx.save()
  ctx.fillStyle = `rgba(255, 230, 120, ${0.18 + pulse * 0.08})`
  ctx.fillRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2)
  ctx.strokeStyle = `rgba(255, 244, 168, ${0.55 + pulse * 0.25})`
  ctx.lineWidth = 2
  ctx.strokeRect(screenX + 1.5, screenY + 1.5, TILE_SIZE - 3, TILE_SIZE - 3)
  ctx.restore()
}

function drawHoleTile(ctx, screenX, screenY, flooded, tileX, tileY, time) {
  const hole = gameState.dugHoles?.[`${tileX},${tileY}`] || null
  const revealProgress = hole ? Math.min(1, (Date.now() - (hole.createdAt || Date.now())) / 1000) : 1

  ctx.save()
  ctx.globalAlpha = revealProgress

  if (flooded) {
    // Flooded holes look exactly like water tiles.
    ctx.fillStyle = getTerrainColor(0)
    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

    if (!gameState.lightweightMode) {
      const waveOffset = Math.sin(time + tileX * 0.3 + tileY * 0.2) * 3
      ctx.beginPath()
      ctx.moveTo(screenX, screenY + TILE_SIZE / 2 + waveOffset)
      ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE / 2 - waveOffset)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
      ctx.lineWidth = 2
      ctx.stroke()

      const waveOffset2 = Math.sin(time * 1.5 + tileX * 0.4 + tileY * 0.3) * 2
      ctx.beginPath()
      ctx.moveTo(screenX, screenY + TILE_SIZE / 3 + waveOffset2)
      ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE / 3 - waveOffset2)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  // Dry holes fill the full tile in dark gray tones.
  ctx.fillStyle = "#444a50"
  ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

  ctx.fillStyle = "#353b41"
  ctx.fillRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4)

  // Front inner wall for depth, still covering full tile footprint.
  ctx.fillStyle = "#2a2f34"
  ctx.fillRect(screenX + 2, screenY + TILE_SIZE * 0.68, TILE_SIZE - 4, TILE_SIZE * 0.28)
  ctx.restore()
}