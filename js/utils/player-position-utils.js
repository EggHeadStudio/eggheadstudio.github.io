import { gameState } from "../core/game-state.js"
import { TILE_SIZE, TERRAIN_TYPES } from "../core/constants.js"
import { getDistance } from "./math-utils.js"

function isFloodedHoleTile(tileX, tileY) {
  return Boolean(gameState.dugHoles?.[`${tileX},${tileY}`]?.flooded)
}

const DEFAULT_SCAN_ANGLES = Array.from({ length: 16 }, (_, index) => (Math.PI * 2 * index) / 16)

export function isPlayerPositionClear(x, y, options = {}) {
  const { ignoreCar = null, ignoreBoat = null, ignoreRock = null, ignoreWoodenBox = null, ignoreBomb = null } = options
  const { player, terrain, rocks, woodenBoxes, bombs, cars, boats } = gameState

  if (!player || !terrain || terrain.length === 0) {
    return false
  }

  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)

  if (tileX < 0 || tileX >= terrain[0].length || tileY < 0 || tileY >= terrain.length) {
    return false
  }

  if (terrain[tileY][tileX] === TERRAIN_TYPES.WATER || isFloodedHoleTile(tileX, tileY)) {
    return false
  }

  for (const rock of rocks) {
    if (rock === ignoreRock) continue

    if (getDistance(x, y, rock.x, rock.y) < player.size + rock.size * 0.8) {
      return false
    }
  }

  if (gameState.trees) {
    for (const tree of gameState.trees) {
      if (getDistance(x, y, tree.x, tree.y) < player.size + tree.size * 0.3) {
        return false
      }
    }
  }

  if (woodenBoxes) {
    for (const box of woodenBoxes) {
      if (box === ignoreWoodenBox) continue

      if (getDistance(x, y, box.x, box.y) < player.size + box.size * 0.8) {
        return false
      }
    }
  }

  if (bombs) {
    for (const bomb of bombs) {
      if (bomb === ignoreBomb) continue

      if (getDistance(x, y, bomb.x, bomb.y) < player.size + bomb.size * 0.8) {
        return false
      }
    }
  }

  if (cars) {
    for (const car of cars) {
      if (car === ignoreCar) continue

      if (getDistance(x, y, car.x, car.y) < player.size + car.size * 0.45) {
        return false
      }
    }
  }

  if (boats) {
    for (const boat of boats) {
      if (boat === ignoreBoat) continue

      if (getDistance(x, y, boat.x, boat.y) < player.size + boat.size * 0.45) {
        return false
      }
    }
  }

  return true
}

export function findNearestSafePlayerPosition(originX, originY, options = {}) {
  const { player } = gameState
  if (!player) {
    return null
  }

  if (isPlayerPositionClear(originX, originY, options)) {
    return { x: originX, y: originY }
  }

  const {
    preferredAngles = [],
    baseDistance = Math.max(8, player.size * 0.35),
    stepDistance = Math.max(12, player.size * 0.7),
    maxDistance = Math.max(160, player.size * 9),
  } = options

  const angles = [...preferredAngles, ...DEFAULT_SCAN_ANGLES]

  for (let radius = baseDistance; radius <= maxDistance; radius += stepDistance) {
    for (const angle of angles) {
      const candidateX = originX + Math.cos(angle) * radius
      const candidateY = originY + Math.sin(angle) * radius

      if (isPlayerPositionClear(candidateX, candidateY, options)) {
        return { x: candidateX, y: candidateY }
      }
    }
  }

  return null
}

export function movePlayerToNearestSafePosition(originX, originY, obstacleX = originX, obstacleY = originY, options = {}) {
  const { player } = gameState
  if (!player) {
    return false
  }

  const awayAngle = Math.atan2(originY - obstacleY, originX - obstacleX)
  const preferredAngles = [
    awayAngle,
    awayAngle + Math.PI / 6,
    awayAngle - Math.PI / 6,
    awayAngle + Math.PI / 2,
    awayAngle - Math.PI / 2,
    awayAngle + Math.PI,
  ]

  const safePosition = findNearestSafePlayerPosition(originX, originY, {
    ...options,
    preferredAngles: [...preferredAngles, ...(options.preferredAngles || [])],
  })

  if (!safePosition) {
    return false
  }

  player.x = safePosition.x
  player.y = safePosition.y
  return true
}