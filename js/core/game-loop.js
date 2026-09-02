// Main game loop
import { gameState } from "./game-state.js"
import { updatePlayerHealing, updatePlayerPosition } from "../entities/player.js"
import { spawnEnemies, drawAndUpdateEnemies, drawBrokenRaftEnemies } from "../entities/enemies.js"
import { checkCollisions } from "./collision-detection.js"
import { drawTerrain } from "../terrain/terrain-renderer.js"
import { drawAndUpdateRocks } from "../entities/rocks.js"
import { drawAndUpdateTrees, drawTreeCanopyOverlay } from "../entities/trees.js"
import { drawAndUpdateWoodenBoxes, drawWoodenBoxRoofs } from "../entities/wooden-boxes.js" // Import wooden boxes update
import { drawAndUpdateCars } from "../entities/cars.js" // Import cars update
import { drawAndUpdateBoats } from "../entities/boats.js"
import { drawAndUpdateApples, drawAndUpdateThrownApples } from "../entities/apples.js"
import { drawAndUpdateSledgehammers } from "../entities/sledgehammers.js"
import { drawAndUpdateShovels } from "../entities/shovels.js"
import { drawAndUpdateSaws } from "../entities/saws.js"
import { drawAndUpdateBombs } from "../entities/bombs.js"
import { drawAndUpdateDeathEffects } from "../entities/death-effects.js"
import { drawAndUpdateExplosions } from "../entities/explosions.js"
import { drawPlayer } from "../entities/player.js"
import { drawDayNightOverlay, updateDayNightCycle } from "./day-night-cycle.js"
import { maintainGameElements } from "./game-maintenance.js"
import { drawMinimap, revealNearbyWorld } from "../ui/minimap.js"
import { syncMobileVehicleButtons } from "../input/mobile-controls.js"

// Main game update loop
export function update() {
  const { canvas, ctx, gameOver } = gameState
  const isPlayerDying = Boolean(gameState.player?.isDying)

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
    if (!isPlayerDying) {
      if (gameState.isMobile && gameState.joystickActive && gameState.joystickDistance > 0.1) {
        gameState.player.direction = gameState.joystickAngle
      } else {
        gameState.player.direction = Math.atan2(
          gameState.mousePosition.y - canvas.height / 2,
          gameState.mousePosition.x - canvas.width / 2,
        )
      }
    }

    // Update player position based on keyboard input (only if not in a car)
    if (!gameState.isInCar && !isPlayerDying) {
      updatePlayerPosition()
    }

    syncMobileVehicleButtons()

    // Update camera position
    gameState.camera.x = gameState.player.x - canvas.width / 2
    gameState.camera.y = gameState.player.y - canvas.height / 2

    revealNearbyWorld()

    // Spawn new enemies
    if (!isPlayerDying) {
      spawnEnemies()
    }

    // Generate more apples as needed
    if (!isPlayerDying) {
      maintainGameElements()
    }

    // Check for collisions
    if (!isPlayerDying) {
      checkCollisions()
    }

    // Regenerate health over time, faster when sheltered under a roof
    if (!isPlayerDying) {
      updatePlayerHealing()
    }

    // Update lighting state after camera and player state settle for the frame
    updateDayNightCycle()
  }

  // Draw terrain
  drawTerrain()

  // Draw blood pools and splatter before other world entities layer on top
  drawAndUpdateDeathEffects()

  // Draw and update rocks
  drawAndUpdateRocks()

  // Draw trees above ground props so canopies layer correctly
  drawAndUpdateTrees()

  // Draw and update apples
  drawAndUpdateApples()

  // Draw and update sledgehammers
  drawAndUpdateSledgehammers()

  // Draw and update shovels
  drawAndUpdateShovels()

  // Draw and update saws
  drawAndUpdateSaws()

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

  // Canopies render late so cars and other entities appear under tree leaves.
  drawTreeCanopyOverlay()

  // Draw roof overlays last so roofed structures still cover entities
  drawWoodenBoxRoofs()

  // Draw world-space post effects and lightweight overlays last
  drawDayNightOverlay()
  drawMinimap()

  // Continue game loop
  gameState.gameLoop = requestAnimationFrame(update)
}