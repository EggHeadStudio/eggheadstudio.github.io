// Input handling (keyboard and mouse)
import { gameState } from "../core/game-state.js"
import { throwApple } from "../entities/apples.js"
import { tryGrabBomb, releaseBomb, detonateAnyBombWithCountdown, placeSelectedBomb } from "../entities/bombs.js"
import { tryGrabRock, releaseRock } from "../entities/rocks.js"
import { tryGrabWoodenBox, releaseWoodenBox } from "../entities/wooden-boxes.js" // Import wooden box functions
import { tryGrabEnemy, releaseEnemy } from "../entities/enemies.js"
import { checkCarInteraction, enterCar, exitCar } from "../entities/cars.js" // Import car interaction functions
import { checkBoatInteraction, enterBoat, exitBoat } from "../entities/boats.js"
import { queueOrDigHoleAtScreenPosition, isShovelActionLocked } from "../entities/shovels.js"
import { tryUseSawOnTreeAtScreenPosition } from "../entities/trees.js"

// Set up event listeners for keyboard and mouse
export function setupEventListeners() {
  // Remove existing keyboard listeners to prevent duplicates
  if (window.keyboardListenersSet) {
    window.removeEventListener("keydown", handleKeyDown)
    window.removeEventListener("keyup", handleKeyUp)
  }

  // Keyboard events
  window.addEventListener("keydown", handleKeyDown)
  window.addEventListener("keyup", handleKeyUp)
  window.keyboardListenersSet = true

  // Remove existing mouse listeners to prevent duplicates
  if (window.mouseListenersSet) {
    gameState.canvas.removeEventListener("mousemove", handleMouseMove)
    gameState.canvas.removeEventListener("mousedown", handleMouseDown)
  }

  // Mouse events
  gameState.canvas.addEventListener("mousemove", handleMouseMove)
  gameState.canvas.addEventListener("mousedown", handleMouseDown)
  window.mouseListenersSet = true

}

function getCanvasPointerPosition(clientX, clientY) {
  const rect = gameState.canvas.getBoundingClientRect()

  // Map from CSS/display coordinates to internal canvas coordinates.
  const scaleX = rect.width > 0 ? gameState.canvas.width / rect.width : 1
  const scaleY = rect.height > 0 ? gameState.canvas.height / rect.height : 1

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}

// Handle keyboard input
export function handleKeyDown(e) {
  if (gameState.isPaused) {
    return
  }

  gameState.keys[e.key] = true

  // Space bar for car interaction, grabbing/releasing bombs, rocks, wooden boxes, or enemies, or detonating bombs
  if (e.key === " ") {
    // First check if the player is in a car
    if (gameState.isInCar) {
      if (gameState.drivingCar?.vehicleType === "boat") {
        exitBoat()
      } else {
        exitCar()
      }
    } else {
      // Check if player is near a car to enter
      const nearCar = checkCarInteraction()
      if (nearCar) {
        // Enter the car
        enterCar(nearCar)
      } else {
        const nearBoat = checkBoatInteraction()
        if (nearBoat) {
          enterBoat(nearBoat)
          e.preventDefault()
          return
        } else if (!gameState.isGrabbing && placeSelectedBomb()) {
          e.preventDefault()
          return
        } else if (gameState.isGrabbing) {
          // If holding something, release it
          if (gameState.grabbedBomb) {
            releaseBomb()
          } else if (gameState.grabbedRock) {
            releaseRock()
          } else if (gameState.grabbedWoodenBox) {
            releaseWoodenBox()
          } else if (gameState.grabbedEnemy) {
            releaseEnemy()
          }
        } else {
          // If not holding anything, try to detonate a bomb with countdown
          if (!detonateAnyBombWithCountdown()) {
            // If no bomb to detonate, try to grab a bomb
            if (!tryGrabBomb()) {
              // If no bomb to grab, try to grab a wooden box
              if (!tryGrabWoodenBox()) {
                // If no wooden box to grab, try to grab a rock
                if (!tryGrabRock()) {
                  // If no rock to grab, try to grab an enemy
                  tryGrabEnemy()
                }
              }
            }
          }
        }
      }
    }
    // Prevent space from scrolling the page
    e.preventDefault()
  }
}

// Handle keyboard key release
export function handleKeyUp(e) {
  if (gameState.isPaused) {
    return
  }

  gameState.keys[e.key] = false
}

// Handle mouse movement
export function handleMouseMove(e) {
  if (gameState.isPaused) {
    return
  }

  const pointer = getCanvasPointerPosition(e.clientX, e.clientY)
  gameState.mousePosition.x = pointer.x
  gameState.mousePosition.y = pointer.y
}

// Handle mouse clicks
export function handleMouseDown(e) {
  if (gameState.isPaused) {
    return
  }

  if (e.button === 0) {
    const pointer = getCanvasPointerPosition(e.clientX, e.clientY)
    const pointerX = pointer.x
    const pointerY = pointer.y
    gameState.mousePosition.x = pointerX
    gameState.mousePosition.y = pointerY

    const canUseShovelFromBoat = gameState.isInCar && gameState.drivingCar?.vehicleType === "boat" && gameState.selectedTool === "shovel"

    // Left mouse button - only throw apple if not in a car, unless we are digging from a boat.
    if (!gameState.isInCar || canUseShovelFromBoat) {
      if (gameState.selectedTool === "shovel") {
        if (isShovelActionLocked()) {
          return
        }

        const shovelResult = queueOrDigHoleAtScreenPosition(pointerX, pointerY, { mobile: false })
        if (shovelResult.consumed && (shovelResult.activated || shovelResult.didDig)) {
          return
        }
      }

      if (gameState.selectedTool === "saw") {
        if (tryUseSawOnTreeAtScreenPosition(pointerX, pointerY)) {
          return
        }
      }

      if (!canUseShovelFromBoat) {
        throwApple()
      }
    }
  }
}

import { init } from "../core/game.js"

export function restartGame() {
  // Make sure to cancel the current game loop
  if (gameState.gameLoop) {
    cancelAnimationFrame(gameState.gameLoop)
    gameState.gameLoop = null
  }

  // Reset game state and start a new game
  init()

  // Ensure we reset grabbed objects
  gameState.grabbedEnemy = null
  gameState.grabbedWoodenBox = null
  gameState.isInCar = false
  gameState.drivingCar = null
}