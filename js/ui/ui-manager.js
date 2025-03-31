// UI management
import { gameState } from "../core/game-state.js"

// Update apple counter in UI
export function updateAppleCounter() {
  document.getElementById("appleCount").textContent = gameState.player.apples.toString()
}

// Update health display in UI
export function updateHealthDisplay() {
  // This function now does nothing since we removed the health display
  // We keep it to maintain compatibility with any code that might still call it
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

// Update kill counter
export function updateKillCounter() {
  document.getElementById("killCount").textContent = gameState.killCount.toString()
}

// Increment kill count
export function incrementKillCount() {
  gameState.killCount++
  updateKillCounter()
}
