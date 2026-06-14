// Main game loop
import { gameState } from "./game-state.js"
import { updatePlayerHealing, updatePlayerPosition } from "../entities/player.js"
import { spawnEnemies, drawAndUpdateEnemies, drawBrokenRaftEnemies } from "../entities/enemies.js"
import { checkCollisions } from "./collision-detection.js"
import { drawTerrain } from "../terrain/terrain-renderer.js"
import { drawAndUpdateRocks } from "../entities/rocks.js"
import { drawAndUpdateWoodenBoxes, drawWoodenBoxRoofs } from "../entities/wooden-boxes.js" // Import wooden boxes update
import { drawAndUpdateCars } from "../entities/cars.js" // Import cars update
import { drawAndUpdateBoats } from "../entities/boats.js"
import { drawAndUpdateApples, drawAndUpdateThrownApples } from "../entities/apples.js"
import { drawAndUpdateSledgehammers } from "../entities/sledgehammers.js"
import { drawAndUpdateBombs } from "../entities/bombs.js"
import { drawAndUpdateExplosions } from "../entities/explosions.js"
import { drawPlayer } from "../entities/player.js"
import { drawDayNightOverlay, updateDayNightCycle } from "./day-night-cycle.js"
import { maintainGameElements } from "./game-maintenance.js"
import { drawMinimap } from "../ui/minimap.js"

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

    // Update player position based on keyboard input (only if not in a car)
    if (!gameState.isInCar) {
      updatePlayerPosition()
    }

    // Update camera position
    gameState.camera.x = gameState.player.x - canvas.width / 2
    gameState.camera.y = gameState.player.y - canvas.height / 2

    // Spawn new enemies
    spawnEnemies()

    // Generate more apples as needed
    maintainGameElements()

    // Check for collisions
    checkCollisions()

    // Regenerate health over time, faster when sheltered under a roof
    updatePlayerHealing()

    // Update lighting state after camera and player state settle for the frame
    updateDayNightCycle()
  }

  // Draw terrain
  drawTerrain()

  // Draw and update rocks
  drawAndUpdateRocks()

  // Draw and update apples
  drawAndUpdateApples()

  // Draw and update sledgehammers
  drawAndUpdateSledgehammers()

  // Draw and update bombs
  drawAndUpdateBombs()

  // Draw and update wooden boxes before vehicles so boats and player render on top
  drawAndUpdateWoodenBoxes({ drawRoofs: false })

  // Draw and update enemies
  drawAndUpdateEnemies()

  // Draw and update thrown apples
  drawAndUpdateThrownApples()

  // Draw and update explosions
  drawAndUpdateExplosions()

  // Draw and update cars (draw before player if player is in a car)
  if (gameState.isInCar) {
    drawAndUpdateCars()
    drawAndUpdateBoats()
    drawBrokenRaftEnemies()
    drawPlayer()
  } else {
    // Draw player
    drawPlayer()
    // Draw and update cars (draw after player if player is not in a car)
    drawAndUpdateCars()
    drawAndUpdateBoats()
    drawBrokenRaftEnemies()
  }

  // Draw roof overlays last so roofed structures still cover entities
  drawWoodenBoxRoofs()

  // Draw world-space post effects and lightweight overlays last
  drawDayNightOverlay()
  drawMinimap()

  // Continue game loop
  gameState.gameLoop = requestAnimationFrame(update)
}