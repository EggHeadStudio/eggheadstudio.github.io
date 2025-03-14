// Terrain rendering
import { gameState } from "../core/game-state.js"
import { TILE_SIZE } from "../core/constants.js"
import { getTerrainColor, adjustColorBrightness } from "../utils/color-utils.js"

// Draw terrain
export function drawTerrain() {
  const { terrain, camera, ctx } = gameState

  const startX = Math.floor(camera.x / TILE_SIZE)
  const startY = Math.floor(camera.y / TILE_SIZE)
  const endX = startX + Math.ceil(ctx.canvas.width / TILE_SIZE) + 1
  const endY = startY + Math.ceil(ctx.canvas.height / TILE_SIZE) + 1
  const time = Date.now() / 1000 // For animations

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
          // Grass details - small dots and lines
          for (let i = 0; i < 3; i++) {
            const grassX = screenX + Math.random() * TILE_SIZE
            const grassY = screenY + Math.random() * TILE_SIZE
            const grassSize = 3 + Math.random() * 2

            ctx.beginPath()
            ctx.arc(grassX, grassY, grassSize, 0, Math.PI * 2)
            ctx.fill()
          }

          // Add some grass blades
          ctx.strokeStyle = adjustColorBrightness(getTerrainColor(terrainType), -15)
          ctx.lineWidth = 1
          for (let i = 0; i < 2; i++) {
            const baseX = screenX + 5 + Math.random() * (TILE_SIZE - 10)
            const baseY = screenY + TILE_SIZE - 5
            const height = 5 + Math.random() * 8
            const bend = Math.sin(time * (0.5 + Math.random() * 0.5)) * 2

            ctx.beginPath()
            ctx.moveTo(baseX, baseY)
            ctx.quadraticCurveTo(baseX + bend, baseY - height / 2, baseX, baseY - height)
            ctx.stroke()
          }
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

          // Add some movement to trees
          const sway = Math.sin(time + x * 0.1 + y * 0.1) * 1
          ctx.fillStyle = adjustColorBrightness(getTerrainColor(terrainType), 5)
          ctx.beginPath()
          ctx.arc(centerX + sway, centerY - radius / 2 - 2, radius * 0.7, 0, Math.PI * 2)
          ctx.fill()
        } else if (terrainType === 3) {
          // TERRAIN_TYPES.DIRT
          // Dirt details - small rocks and texture
          for (let i = 0; i < 5; i++) {
            const dirtX = screenX + Math.random() * TILE_SIZE
            const dirtY = screenY + Math.random() * TILE_SIZE
            const dirtSize = 2 + Math.random() * 3

            ctx.beginPath()
            ctx.arc(dirtX, dirtY, dirtSize, 0, Math.PI * 2)
            ctx.fill()
          }

          // Add some lines for texture
          ctx.strokeStyle = adjustColorBrightness(getTerrainColor(terrainType), -5)
          ctx.lineWidth = 0.5
          for (let i = 0; i < 2; i++) {
            const startX = screenX + Math.random() * TILE_SIZE
            const startY = screenY + Math.random() * TILE_SIZE
            const length = 3 + Math.random() * 5
            const angle = Math.random() * Math.PI * 2

            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(startX + Math.cos(angle) * length, startY + Math.sin(angle) * length)
            ctx.stroke()
          }
        }
      }
    }
  }
}

