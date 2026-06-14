// UI management
import { gameState } from "../core/game-state.js"

function getGameContainer() {
  return document.querySelector(".game-container")
}

export function setHudVisibility(isVisible) {
  const container = getGameContainer()
  if (!container) return

  container.classList.toggle("hud-hidden", !isVisible)
}

export function resetHud() {
  document.getElementById("appleCount").textContent = "0"
  document.getElementById("timer").textContent = "00:00"
  document.getElementById("killCount").textContent = "0"
  updateSledgehammerIndicator()
}

// Update apple counter in UI
export function updateAppleCounter() {
  document.getElementById("appleCount").textContent = gameState.player.apples.toString()
}

export function updateSledgehammerIndicator() {
  const indicator = document.getElementById("sledgehammerIndicator")
  if (!indicator) return

  indicator.classList.toggle("active", Boolean(gameState.hasSledgehammer))
}

// Update health display in UI
export function updateHealthDisplay() {
  // This function now does nothing since we removed the health display
  // We keep it to maintain compatibility with any code that might still call it
}

// Update timer
export function updateTimer() {
  if (!gameState.gameOver && !gameState.isPaused) {
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