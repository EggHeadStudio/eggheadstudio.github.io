// Input handling (keyboard and mouse)
import { gameState } from "../core/game-state.js"
import { throwApple } from "../entities/apples.js"
import { tryGrabBomb, releaseBomb, detonateAnyBombWithCountdown } from "../entities/bombs.js"
import { tryGrabRock, releaseRock } from "../entities/rocks.js"

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

  // Restart button
  const restartButton = document.getElementById("restartButton")
  if (window.restartButtonListenerSet) {
    restartButton.removeEventListener("click", restartGame)
  }
  restartButton.addEventListener("click", restartGame)
  window.restartButtonListenerSet = true
}

// Handle keyboard input
export function handleKeyDown(e) {
  gameState.keys[e.key] = true

  // Space bar for grabbing/releasing bombs or rocks, or detonating bombs
  if (e.key === " ") {
    if (gameState.isGrabbing) {
      // If holding something, release it
      if (gameState.grabbedBomb) {
        releaseBomb()
      } else if (gameState.grabbedRock) {
        releaseRock()
      } else if (gameState.grabbedEnemy) {
        releaseEnemy()
      }
    } else {
      // If not holding anything, try to detonate a bomb with countdown
      if (!detonateAnyBombWithCountdown()) {
        // If no bomb to detonate, try to grab a bomb
        if (!tryGrabBomb()) {
          // If no bomb to grab, try to grab a rock
          if (!tryGrabRock()) {
            // If no rock to grab, try to grab an enemy
            tryGrabEnemy()
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
  gameState.keys[e.key] = false
}

// Handle mouse movement
export function handleMouseMove(e) {
  const rect = gameState.canvas.getBoundingClientRect()
  gameState.mousePosition.x = e.clientX - rect.left
  gameState.mousePosition.y = e.clientY - rect.top
}

// Handle mouse clicks
export function handleMouseDown(e) {
  if (e.button === 0) {
    // Left mouse button
    throwApple()
  }
}

// Restart the game
import { init } from "../core/game.js"

export function restartGame() {
  // Make sure to cancel the current game loop
  if (gameState.gameLoop) {
    cancelAnimationFrame(gameState.gameLoop)
    gameState.gameLoop = null
  }

  // Reset game state and start a new game
  init()

  // Reset timer
  gameState.startTime = Date.now()
  gameState.elapsedTime = 0
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval)
  }
  gameState.timerInterval = setInterval(updateTimer, 1000)

  // Ensure we reset grabbedEnemy
  gameState.grabbedEnemy = null
}

// Import updateTimer after declaring restartGame to avoid circular dependency
import { updateTimer } from "../ui/ui-manager.js"

// Import the new enemy functions
import { tryGrabEnemy, releaseEnemy } from "../entities/enemies.js"
