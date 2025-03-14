// UI management
import { gameState } from "../core/game-state.js"

// Update apple counter in UI
export function updateAppleCounter() {
  document.getElementById("appleCount").textContent = gameState.player.apples.toString()
}

// Update health display in UI
export function updateHealthDisplay() {
  const hearts = document.querySelectorAll(".heart")
  for (let i = 0; i < hearts.length; i++) {
    if (i < gameState.player.health) {
      hearts[i].style.opacity = "1"
    } else {
      hearts[i].style.opacity = "0.3"
    }
  }
}

// Update timer
export function updateTimer() {
  if (!gameState.gameOver) {
    gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000)
    const minutes = String(Math.floor(gameState.elapsedTime / 60)).padStart(2, "0")
    const seconds = String(gameState.elapsedTime % 60).padStart(2, "0")
    document.getElementById("timer").textContent = `${minutes}:${seconds}`
  }
}

