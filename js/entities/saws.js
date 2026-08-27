import { gameState } from "../core/game-state.js"
import { SAW_COUNT, SAW_SIZE, TILE_SIZE, SPAWN_SAW_NEAR_PLAYER } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { updateSawIndicator } from "../ui/ui-manager.js"
import { isSpawnPositionClear } from "../utils/spawn-utils.js"

export function generateSaws(count = SAW_COUNT) {
  const { terrain, player, saws } = gameState

  if (count > 0 && SPAWN_SAW_NEAR_PLAYER) {
    const nearbySaw = createNearbySaw(player, saws)
    if (nearbySaw) {
      saws.push(nearbySaw)
    }
  }

  for (let i = saws.length; i < count; i++) {
    let placed = false
    let attempts = 0

    while (!placed && attempts < 80) {
      attempts++

      const saw = {
        x: Math.random() * (terrain[0].length * TILE_SIZE),
        y: Math.random() * (terrain.length * TILE_SIZE),
        size: SAW_SIZE,
        rotation: (Math.random() - 0.5) * 0.5,
      }

      if (!isSpawnPositionClear(saw.x, saw.y, saw.size, { requireLand: true, playerDistanceBuffer: 180 })) {
        continue
      }

      if (saws.some((other) => getDistance(saw.x, saw.y, other.x, other.y) < saw.size * 4.5)) {
        continue
      }

      saws.push(saw)
      placed = true
    }
  }
}

function createNearbySaw(player, existingSaws) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const angle = Math.random() * Math.PI * 2
    const distance = 110 + Math.random() * 90
    const x = player.x + Math.cos(angle) * distance
    const y = player.y + Math.sin(angle) * distance

    const saw = {
      x,
      y,
      size: SAW_SIZE,
      rotation: (Math.random() - 0.5) * 0.5,
    }

    if (!isSpawnPositionClear(saw.x, saw.y, saw.size, { requireLand: true, playerDistanceBuffer: 0 })) {
      continue
    }

    if (existingSaws.some((other) => getDistance(saw.x, saw.y, other.x, other.y) < saw.size * 4)) {
      continue
    }

    return saw
  }

  return null
}

export function drawAndUpdateSaws() {
  const { saws, player, camera, ctx, canvas, hasSaw } = gameState

  if (hasSaw || !saws || saws.length === 0) {
    return
  }

  for (let i = 0; i < saws.length; i++) {
    const saw = saws[i]
    const screenX = saw.x - camera.x
    const screenY = saw.y - camera.y

    if (
      screenX < -saw.size ||
      screenX > canvas.width + saw.size ||
      screenY < -saw.size ||
      screenY > canvas.height + saw.size
    ) {
      continue
    }

    createShadow(
      ctx,
      screenX,
      screenY,
      saw.size,
      "rectangle",
      { width: saw.size * 1.7, height: saw.size * 0.5, radius: 3 },
      saw.rotation,
      0.9,
    )

    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(saw.rotation)

    // Wood handle at the rear, metal blade with teeth at the front.
    const handleLength = saw.size * 0.9
    const handleWidth = saw.size * 0.26
    const bladeLength = saw.size * 1.8
    const bladeWidth = saw.size * 0.7

    ctx.fillStyle = "#6b4423"
    ctx.fillRect(-saw.size * 0.9, -handleWidth * 0.5, handleLength, handleWidth)

    ctx.fillStyle = "#dfe6eb"
    ctx.fillRect(-saw.size * 0.18, -bladeWidth * 0.52, bladeLength, bladeWidth)

    ctx.fillStyle = "#bbc3ca"
    ctx.beginPath()
    ctx.moveTo(-saw.size * 0.18, -bladeWidth * 0.52)
    ctx.lineTo(-saw.size * 0.18 + bladeLength * 0.14, -bladeWidth * 0.7)
    ctx.lineTo(-saw.size * 0.18 + bladeLength * 0.14, bladeWidth * 0.7)
    ctx.lineTo(-saw.size * 0.18, bladeWidth * 0.52)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = "#dfe6eb"
    for (let tooth = 0; tooth < 8; tooth++) {
      const x = -saw.size * 0.18 + tooth * (bladeLength / 8)
      ctx.beginPath()
      ctx.moveTo(x, bladeWidth * 0.52)
      ctx.lineTo(x + bladeWidth * 0.2, bladeWidth * 0.82)
      ctx.lineTo(x + bladeWidth * 0.2, -bladeWidth * 0.82)
      ctx.lineTo(x, -bladeWidth * 0.52)
      ctx.closePath()
      ctx.fill()
    }

    ctx.fillStyle = "#7a5636"
    ctx.fillRect(-saw.size * 0.9, -handleWidth * 0.36, handleLength * 0.22, handleWidth * 0.72)
    ctx.fillStyle = "#9f6b3a"
    ctx.fillRect(-saw.size * 0.74, -handleWidth * 0.25, handleLength * 0.14, handleWidth * 0.5)

    ctx.restore()

    if (getDistance(player.x, player.y, saw.x, saw.y) < player.size + saw.size) {
      collectSaw()
      return
    }
  }
}

export function collectSaw() {
  gameState.hasSaw = true
  gameState.saws = []
  updateSawIndicator()
}
