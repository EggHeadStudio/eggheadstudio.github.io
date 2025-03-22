// Main game loop
import { gameState } from "./game-state.js"
import { updatePlayerPosition } from "../entities/player.js"
import { spawnEnemies, drawAndUpdateEnemies } from "../entities/enemies.js"
import { checkCollisions } from "./collision-detection.js"
import { drawTerrain } from "../terrain/terrain-renderer.js"
import { drawAndUpdateRocks } from "../entities/rocks.js"
import { drawAndUpdateWoodenBoxes } from "../entities/wooden-boxes.js" // Import wooden boxes update
import { drawAndUpdateApples, drawAndUpdateThrownApples } from "../entities/apples.js"
import { drawAndUpdateBombs } from "../entities/bombs.js"
import { drawAndUpdateExplosions } from "../entities/explosions.js"
import { drawPlayer } from "../entities/player.js"
import { maintainGameElements } from "./game-maintenance.js"

// Main game update loop
export function update() {
  const { canvas, ctx, gameOver } = gameState

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

    // Update camera position
    gameState.camera.x = gameState.player.x - canvas.width / 2
    gameState.camera.y = gameState.player.y - canvas.height / 2

    // Spawn new enemies
    spawnEnemies()

    // Generate more apples as needed
    maintainGameElements()

    // Check for collisions
    checkCollisions()
  }

  // Draw terrain
  drawTerrain()

  // Draw and update rocks
  drawAndUpdateRocks()

  // Draw and update wooden boxes (this now handles roof detection and drawing)
  drawAndUpdateWoodenBoxes()

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

  // Continue game loop
  gameState.gameLoop = requestAnimationFrame(update)
}
