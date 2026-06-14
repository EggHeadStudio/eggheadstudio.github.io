import { gameState } from "../core/game-state.js"
import { SLEDGEHAMMER_COUNT, SLEDGEHAMMER_SIZE, TILE_SIZE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { updateSledgehammerIndicator } from "../ui/ui-manager.js"

export function generateSledgehammers(count = SLEDGEHAMMER_COUNT) {
  const { terrain, player, sledgehammers, rocks, woodenBoxes, bombs, cars } = gameState

  for (let i = 0; i < count; i++) {
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
        tileX < 0 ||
        tileX >= terrain[0].length ||
        tileY < 0 ||
        tileY >= terrain.length ||
        terrain[tileY][tileX] === 0 ||
        getDistance(hammer.x, hammer.y, player.x, player.y) < player.size + hammer.size + 180
      ) {
        continue
      }

      if (sledgehammers.some((other) => getDistance(hammer.x, hammer.y, other.x, other.y) < hammer.size * 5)) {
        continue
      }

      if (rocks.some((rock) => getDistance(hammer.x, hammer.y, rock.x, rock.y) < hammer.size + rock.size)) {
        continue
      }

      if (woodenBoxes.some((box) => getDistance(hammer.x, hammer.y, box.x, box.y) < hammer.size + box.size)) {
        continue
      }

      if (bombs.some((bomb) => getDistance(hammer.x, hammer.y, bomb.x, bomb.y) < hammer.size + bomb.size)) {
        continue
      }

      if (cars.some((car) => getDistance(hammer.x, hammer.y, car.x, car.y) < hammer.size + car.size)) {
        continue
      }

      sledgehammers.push(hammer)
      placed = true
    }
  }
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