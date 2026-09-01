// Terrain generation
import { gameState } from "../core/game-state.js"
import { TILE_SIZE, WORLD_MAP_SIZE } from "../core/constants.js"
import { ensureWorldChunksAroundWorldPosition, initializeWorldTerrain } from "../world/world-manager.js"

// Generate procedural terrain
export function generateTerrain(mapSize = WORLD_MAP_SIZE) {
  initializeWorldTerrain(mapSize)

  // Place the player in a safe starting position near the middle of the world.
  const startCenterX = Math.floor(mapSize / 2)
  const startCenterY = Math.floor(mapSize / 2)

  ensureWorldChunksAroundWorldPosition(startCenterX * TILE_SIZE, startCenterY * TILE_SIZE)

  let startX = startCenterX
  let startY = startCenterY

  // Search outward through the generated chunks instead of retrying forever.
  outer: for (let radius = 0; radius < 40; radius++) {
    for (let offsetY = -radius; offsetY <= radius; offsetY++) {
      for (let offsetX = -radius; offsetX <= radius; offsetX++) {
        const tileX = startCenterX + offsetX
        const tileY = startCenterY + offsetY

        if (tileX < 0 || tileY < 0 || tileX >= mapSize || tileY >= mapSize) {
          continue
        }

        if (gameState.terrain[tileY][tileX] !== 0) {
          startX = tileX
          startY = tileY
          break outer
        }
      }
    }
  }

  gameState.player.x = startX * TILE_SIZE + TILE_SIZE / 2
  gameState.player.y = startY * TILE_SIZE + TILE_SIZE / 2

  ensureWorldChunksAroundWorldPosition(gameState.player.x, gameState.player.y)
}