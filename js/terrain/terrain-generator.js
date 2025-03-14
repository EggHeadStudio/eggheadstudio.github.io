// Terrain generation
import { gameState } from "../core/game-state.js"
import { TILE_SIZE } from "../core/constants.js"

// Generate procedural terrain
export function generateTerrain() {
  const { terrain } = gameState

  const mapSize = 200 // Much larger map size
  gameState.terrain = []

  // First pass: Generate basic terrain with improved water distribution
  for (let y = 0; y < mapSize; y++) {
    gameState.terrain[y] = []
    for (let x = 0; x < mapSize; x++) {
      // Use a different noise approach for more consistent water bodies
      const nx = x / mapSize - 0.5
      const ny = y / mapSize - 0.5

      // Create larger coherent patterns
      const noise1 = Math.sin(nx * 6) * Math.cos(ny * 6)
      const noise2 = Math.sin((nx + ny) * 8) * 0.3
      const noise3 = Math.cos((nx - ny) * 7) * 0.2
      const noise = noise1 + noise2 + noise3

      // Assign terrain types with thresholds that create fewer, more coherent water bodies
      if (noise < -0.6) {
        gameState.terrain[y][x] = 0 // TERRAIN_TYPES.WATER
      } else if (noise < 0.2) {
        gameState.terrain[y][x] = 1 // TERRAIN_TYPES.GRASS
      } else {
        gameState.terrain[y][x] = 2 // TERRAIN_TYPES.FOREST
      }
    }
  }

  // Second pass: Clean up water bodies to make them more consistent
  for (let y = 1; y < mapSize - 1; y++) {
    for (let x = 1; x < mapSize - 1; x++) {
      // If this is water, check surroundings
      if (gameState.terrain[y][x] === 0) {
        // TERRAIN_TYPES.WATER
        // Count water neighbors (8-way)
        let waterNeighbors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            if (gameState.terrain[y + dy][x + dx] === 0) {
              // TERRAIN_TYPES.WATER
              waterNeighbors++
            }
          }
        }

        // If isolated water or nearly isolated, convert to land
        if (waterNeighbors <= 2) {
          gameState.terrain[y][x] = 1 // TERRAIN_TYPES.GRASS
        }
      }
      // If this is land, but surrounded by water, consider making it water
      else if (gameState.terrain[y][x] !== 0) {
        // TERRAIN_TYPES.WATER
        let waterNeighbors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            if (gameState.terrain[y + dy][x + dx] === 0) {
              // TERRAIN_TYPES.WATER
              waterNeighbors++
            }
          }
        }

        // If mostly surrounded by water, convert to water
        if (waterNeighbors >= 6) {
          gameState.terrain[y][x] = 0 // TERRAIN_TYPES.WATER
        }
      }
    }
  }

  // Place player in a safe starting position
  let safeStart = false
  while (!safeStart) {
    const startX = Math.floor(mapSize / 2) + Math.floor(Math.random() * 20) - 10
    const startY = Math.floor(mapSize / 2) + Math.floor(Math.random() * 20) - 10

    if (gameState.terrain[startY][startX] !== 0) {
      // TERRAIN_TYPES.WATER
      gameState.player.x = startX * TILE_SIZE + TILE_SIZE / 2
      gameState.player.y = startY * TILE_SIZE + TILE_SIZE / 2
      safeStart = true
    }
  }
}

