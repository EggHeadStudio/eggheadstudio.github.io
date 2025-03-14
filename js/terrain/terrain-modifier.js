// Terrain modification
import { gameState } from "../core/game-state.js"
import { TILE_SIZE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"

// Modify terrain in explosion radius
export function modifyTerrainInRadius(centerX, centerY, radius) {
  const { terrain } = gameState

  const tileRadius = Math.ceil(radius / TILE_SIZE)
  const centerTileX = Math.floor(centerX / TILE_SIZE)
  const centerTileY = Math.floor(centerY / TILE_SIZE)

  for (let y = centerTileY - tileRadius; y <= centerTileY + tileRadius; y++) {
    for (let x = centerTileX - tileRadius; x <= centerTileX + tileRadius; x++) {
      if (x >= 0 && x < terrain[0].length && y >= 0 && y < terrain.length) {
        // Check if point is within circular radius
        const tileX = x * TILE_SIZE + TILE_SIZE / 2
        const tileY = y * TILE_SIZE + TILE_SIZE / 2
        const distance = getDistance(centerX, centerY, tileX, tileY)

        if (distance <= radius) {
          // Convert terrain to dirt
          terrain[y][x] = 3 // TERRAIN_TYPES.DIRT
        }
      }
    }
  }
}

