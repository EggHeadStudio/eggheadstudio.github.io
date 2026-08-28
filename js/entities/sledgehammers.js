import { gameState } from "../core/game-state.js"
import {
  SLEDGEHAMMER_COUNT,
  SLEDGEHAMMER_SIZE,
  TILE_SIZE,
  SPAWN_SLEDGEHAMMER_NEAR_PLAYER,
  MAX_SLEDGEHAMMERS,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { updateSledgehammerIndicator } from "../ui/ui-manager.js"
import { isSpawnPositionClear } from "../utils/spawn-utils.js"

export function generateSledgehammers(count = SLEDGEHAMMER_COUNT) {
  const { terrain, player, sledgehammers, rocks, woodenBoxes, bombs, cars } = gameState
  const remainingCapacity = Math.max(0, MAX_SLEDGEHAMMERS - sledgehammers.length)

  if (remainingCapacity <= 0) {
    return
  }

  const hammersToSpawn = Math.min(count, remainingCapacity)

  if (hammersToSpawn > 0 && SPAWN_SLEDGEHAMMER_NEAR_PLAYER) {
    const nearbyHammer = createNearbySledgehammer(player, sledgehammers)
    if (nearbyHammer) {
      sledgehammers.push(nearbyHammer)
    }
  }

  for (let i = sledgehammers.length; i < hammersToSpawn; i++) {
    let placed = false
    let attempts = 0

    while (!placed && attempts < 80) {
      attempts++

      const hammer = {
        x: Math.random() * (terrain[0].length * TILE_SIZE),
        y: Math.random() * (terrain.length * TILE_SIZE),
        size: SLEDGEHAMMER_SIZE,
        rotation: (Math.random() - 0.5) * 0.5,
      }

      const tileX = Math.floor(hammer.x / TILE_SIZE)
      const tileY = Math.floor(hammer.y / TILE_SIZE)

      if (
        !isSpawnPositionClear(hammer.x, hammer.y, hammer.size, {
          requireLand: true,
          playerDistanceBuffer: 180,
        })
      ) {
        continue
      }

      if (sledgehammers.some((other) => getDistance(hammer.x, hammer.y, other.x, other.y) < hammer.size * 5)) {
        continue
      }

      sledgehammers.push(hammer)
      placed = true
    }
  }
}

function createNearbySledgehammer(player, existingHammers) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const angle = Math.random() * Math.PI * 2
    const distance = 110 + Math.random() * 90
    const x = player.x + Math.cos(angle) * distance
    const y = player.y + Math.sin(angle) * distance

    const hammer = {
      x,
      y,
      size: SLEDGEHAMMER_SIZE,
      rotation: (Math.random() - 0.5) * 0.5,
    }

    if (
      !isSpawnPositionClear(hammer.x, hammer.y, hammer.size, {
        requireLand: true,
        playerDistanceBuffer: 0,
      })
    ) {
      continue
    }

    if (existingHammers.some((other) => getDistance(hammer.x, hammer.y, other.x, other.y) < hammer.size * 4)) {
      continue
    }

    return hammer
  }

  return null
}

export function drawAndUpdateSledgehammers() {
  const { sledgehammers, player, camera, ctx, canvas, hasSledgehammer } = gameState

  if (hasSledgehammer || !sledgehammers || sledgehammers.length === 0) {
    return
  }

  for (let i = 0; i < sledgehammers.length; i++) {
    const hammer = sledgehammers[i]
    const screenX = hammer.x - camera.x
    const screenY = hammer.y - camera.y

    if (
      screenX < -hammer.size ||
      screenX > canvas.width + hammer.size ||
      screenY < -hammer.size ||
      screenY > canvas.height + hammer.size
    ) {
      continue
    }

    createShadow(
      ctx,
      screenX,
      screenY,
      hammer.size,
      "rectangle",
      { width: hammer.size * 1.6, height: hammer.size * 0.5, radius: 3 },
      hammer.rotation,
      0.9,
    )

    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(hammer.rotation)

    ctx.fillStyle = "#66513a"
    ctx.fillRect(-hammer.size * 0.12, -hammer.size * 0.7, hammer.size * 0.24, hammer.size * 1.2)

    ctx.fillStyle = "#9fa8ad"
    ctx.fillRect(-hammer.size * 0.58, -hammer.size * 0.8, hammer.size * 1.16, hammer.size * 0.32)
    ctx.fillStyle = "#c8d0d4"
    ctx.fillRect(-hammer.size * 0.18, -hammer.size * 0.78, hammer.size * 0.36, hammer.size * 0.28)

    ctx.restore()

    if (getDistance(player.x, player.y, hammer.x, hammer.y) < player.size + hammer.size) {
      collectSledgehammer()
      return
    }
  }
}

export function collectSledgehammer() {
  gameState.hasSledgehammer = true
  gameState.sledgehammers = []
  updateSledgehammerIndicator()
}