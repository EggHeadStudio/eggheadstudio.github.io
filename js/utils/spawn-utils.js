import { gameState } from "../core/game-state.js"
import { TILE_SIZE, TERRAIN_TYPES } from "../core/constants.js"
import { getDistance } from "./math-utils.js"

function isFloodedHoleTile(tileX, tileY) {
  return Boolean(gameState.dugHoles?.[`${tileX},${tileY}`]?.flooded)
}

export function isWaterPosition(x, y) {
  const { terrain } = gameState
  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)

  return (
    tileX >= 0 &&
    tileX < terrain[0].length &&
    tileY >= 0 &&
    tileY < terrain.length &&
    (terrain[tileY][tileX] === TERRAIN_TYPES.WATER || isFloodedHoleTile(tileX, tileY))
  )
}

export function isLandPosition(x, y) {
  const { terrain } = gameState
  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)

  return (
    tileX >= 0 &&
    tileX < terrain[0].length &&
    tileY >= 0 &&
    tileY < terrain.length &&
    terrain[tileY][tileX] !== TERRAIN_TYPES.WATER &&
    !isFloodedHoleTile(tileX, tileY)
  )
}

export function isSpawnPositionClear(x, y, size, options = {}) {
  const {
    requireLand = false,
    requireWater = false,
    playerDistanceBuffer = 0,
    includePlayer = true,
    includeApples = true,
    includeBombs = true,
    includeRocks = true,
    includeTrees = true,
    includeWoodenBoxes = true,
    includeEnemies = true,
    includeCars = true,
    includeBoats = true,
    includeSledgehammers = true,
    ignoreFloatingBoxes = false,
  } = options

  if (requireLand && !isLandPosition(x, y)) {
    return false
  }

  if (requireWater && !isWaterPosition(x, y)) {
    return false
  }

  if (includePlayer && gameState.player && playerDistanceBuffer > 0) {
    if (getDistance(x, y, gameState.player.x, gameState.player.y) < size + gameState.player.size + playerDistanceBuffer) {
      return false
    }
  }

  if (includeApples) {
    for (const apple of gameState.apples) {
      if (getDistance(x, y, apple.x, apple.y) < size + apple.size) {
        return false
      }
    }
  }

  if (includeBombs) {
    for (const bomb of gameState.bombs) {
      if (getDistance(x, y, bomb.x, bomb.y) < size + bomb.size) {
        return false
      }
    }
  }

  if (includeRocks) {
    for (const rock of gameState.rocks) {
      if (getDistance(x, y, rock.x, rock.y) < size + rock.size) {
        return false
      }
    }
  }

  if (includeTrees && gameState.trees) {
    for (const tree of gameState.trees) {
      if (getDistance(x, y, tree.x, tree.y) < size + tree.size * 0.6) {
        return false
      }
    }
  }

  if (includeWoodenBoxes) {
    for (const box of gameState.woodenBoxes) {
      if (ignoreFloatingBoxes && box.isFloating) {
        continue
      }

      if (getDistance(x, y, box.x, box.y) < size + box.size) {
        return false
      }
    }
  }

  if (includeEnemies) {
    for (const enemy of gameState.enemies) {
      if (getDistance(x, y, enemy.x, enemy.y) < size + enemy.size) {
        return false
      }
    }
  }

  if (includeCars) {
    for (const car of gameState.cars) {
      if (getDistance(x, y, car.x, car.y) < size + car.size) {
        return false
      }
    }
  }

  if (includeBoats) {
    for (const boat of gameState.boats) {
      if (getDistance(x, y, boat.x, boat.y) < size + boat.size) {
        return false
      }
    }
  }

  if (includeSledgehammers) {
    for (const sledgehammer of gameState.sledgehammers) {
      if (getDistance(x, y, sledgehammer.x, sledgehammer.y) < size + sledgehammer.size) {
        return false
      }
    }
  }

  return true
}