// Main game loop
import { gameState } from "./game-state.js"
import { updatePlayerPosition } from "../entities/player.js"
import { spawnEnemies, drawAndUpdateEnemies } from "../entities/enemies.js"
import { checkCollisions } from "./collision-detection.js"
import { drawTerrain } from "../terrain/terrain-renderer.js"
import { drawAndUpdateRocks } from "../entities/rocks.js"
import { drawAndUpdateApples, drawAndUpdateThrownApples } from "../entities/apples.js"
import { drawAndUpdateBombs } from "../entities/bombs.js"
import { drawAndUpdateExplosions } from "../entities/explosions.js"
import { drawPlayer } from "../entities/player.js"
import { maintainGameElements } from "./game-maintenance.js"

// Main game update loop
export function update() {
  const { canvas, ctx, gameOver, camera } = gameState

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!gameOver) {
    if (gameState.isMobile) {
      const joystickContainer = document.querySelector(".joystick-container")
      const containerRect = joystickContainer.getBoundingClientRect()
      gameState.joystickOrigin = {
        x: containerRect.left + containerRect.width / 2,
        y: containerRect.top + containerRect.height / 2,
      }
    }

    // Update player direction based on mouse position
    if (gameState.isMobile && gameState.joystickActive && gameState.joystickDistance > 0.1) {
      gameState.player.direction = gameState.joystickAngle
    } else {
      gameState.player.direction = Math.atan2(
        gameState.mousePosition.y - canvas.height / 2,
        gameState.mousePosition.x - canvas.width / 2,
      )
    }

    // Update player position based on keyboard input
    updatePlayerPosition()

    // Update camera position with zoom factor
    // Divide by zoom to adjust camera position based on zoom level
    camera.x = gameState.player.x - canvas.width / 2 / camera.zoom
    camera.y = gameState.player.y - canvas.height / 2 / camera.zoom

    // Spawn new enemies
    spawnEnemies()

    // Generate more apples as needed
    maintainGameElements()

    // Check for collisions
    checkCollisions()
  }

  // Apply zoom transformation
  ctx.save()
  ctx.scale(camera.zoom, camera.zoom)

  // Adjust camera position for zoom
  const zoomedCameraX = camera.x
  const zoomedCameraY = camera.y

  // Temporarily update camera position for rendering
  camera.x = zoomedCameraX
  camera.y = zoomedCameraY

  // Draw terrain
  drawTerrain()

  // Draw and update rocks
  drawAndUpdateRocks()

  // Draw and update apples
  drawAndUpdateApples()

  // Draw and update bombs
  drawAndUpdateBombs()

  // Draw and update enemies
  drawAndUpdateEnemies()

  // Draw and update thrown apples
  drawAndUpdateThrownApples()

  // Draw and update explosions
  drawAndUpdateExplosions()

  // Draw player
  drawPlayer()

  // Restore canvas context
  ctx.restore()

  // Continue game loop
  gameState.gameLoop = requestAnimationFrame(update)
}
