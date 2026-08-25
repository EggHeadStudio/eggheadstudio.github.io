// Terrain rendering
import { gameState } from "../core/game-state.js"
import { TILE_SIZE } from "../core/constants.js"
import { getTerrainColor, adjustColorBrightness } from "../utils/color-utils.js"
import { isHoleTile, isHoleFlooded } from "../entities/shovels.js"

// Deterministic pseudo-random value for a tile detail.
// Using a hash instead of Math.random() keeps every blade, tuft and pebble
// anchored to the same spot each frame instead of flickering around.
function tileNoise(x, y, index) {
  const value = Math.sin(x * 127.1 + y * 311.7 + index * 74.7) * 43758.5453
  return value - Math.floor(value)
}

// Draw terrain
export function drawTerrain() {
  const { terrain, camera, ctx } = gameState

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

        // Draw terrain tile
        ctx.fillStyle = getTerrainColor(terrainType)
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

        // Add texture/detail to terrain
        ctx.fillStyle = adjustColorBrightness(getTerrainColor(terrainType), -10)
        ctx.save()

        if (terrainType === 0) {
          // TERRAIN_TYPES.WATER
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
        } else if (terrainType === 1) {
          // TERRAIN_TYPES.GRASS
          // Grass is drawn purely as blades that lean side to side in the wind.
          ctx.strokeStyle = adjustColorBrightness(getTerrainColor(terrainType), -18)
          ctx.lineWidth = 1.5
          ctx.lineCap = "round"

          for (let i = 0; i < 9; i++) {
            const baseX = screenX + 3 + tileNoise(x, y, i + 30) * (TILE_SIZE - 6)
            const baseY = screenY + TILE_SIZE - 2 - tileNoise(x, y, i + 35) * (TILE_SIZE - 6)
            const height = 9 + tileNoise(x, y, i + 40) * 7

            // Phase shifts with world position so the wind visibly rolls
            // across the field rather than every blade moving in lockstep.
            const bladePhase = windPhase + x * 0.32 + y * 0.16 + tileNoise(x, y, i + 50) * 1.4
            const bend = Math.sin(bladePhase) * gustStrength * 10

            ctx.beginPath()
            ctx.moveTo(baseX, baseY)
            ctx.quadraticCurveTo(baseX + bend * 0.35, baseY - height * 0.55, baseX + bend, baseY - height)
            ctx.stroke()
          }

          ctx.lineCap = "butt"
        } else if (terrainType === 2) {
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
          ctx.fillStyle = adjustColorBrightness(getTerrainColor(terrainType), 5)
          ctx.beginPath()
          ctx.arc(centerX + sway, centerY - radius / 2 - 2, radius * 0.7, 0, Math.PI * 2)
          ctx.fill()
        } else if (terrainType === 3) {
          // TERRAIN_TYPES.DIRT
          // Cracked ground - static jagged fissures, never animated.
          ctx.strokeStyle = adjustColorBrightness(getTerrainColor(terrainType), -22)
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
        }

        ctx.restore()
      }
    }
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
}

function drawHoleTile(ctx, screenX, screenY, flooded, tileX, tileY, time) {
  if (flooded) {
    // Flooded holes look exactly like water tiles.
    ctx.fillStyle = getTerrainColor(0)
    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

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
}