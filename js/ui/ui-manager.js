// UI management
import { gameState } from "../core/game-state.js"

let hudSelectorsBound = false

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
  bindHudSelectors()
  updateSledgehammerIndicator()
  updateWeaponSelectionUi()
}

// Update apple counter in UI
export function updateAppleCounter() {
  const apples = gameState.player?.apples ?? 0
  document.getElementById("appleCount").textContent = apples.toString()

  if (apples <= 0 && gameState.selectedWeapon === "apple") {
    gameState.selectedWeapon = "wrist"
  }

  updateWeaponSelectionUi()
}

export function updateSledgehammerIndicator() {
  const indicator = document.getElementById("sledgehammerIndicator")
  if (!indicator) return

  const hasSledgehammer = Boolean(gameState.hasSledgehammer)

  if (!hasSledgehammer && gameState.selectedTool === "sledgehammer") {
    gameState.selectedTool = "none"
  }

  indicator.classList.toggle("active", hasSledgehammer)
  indicator.classList.toggle("has-tool", hasSledgehammer)
  updateWeaponSelectionUi()
}

function getAppleWeaponButton() {
  return document.getElementById("appleWeaponButton") || document.querySelector(".apple-icon")
}

function bindHudSelectors() {
  if (hudSelectorsBound) return

  const appleButton = getAppleWeaponButton()
  const hammerButton = document.getElementById("sledgehammerIndicator")

  if (appleButton) {
    appleButton.setAttribute("role", "button")
    appleButton.setAttribute("tabindex", "0")
    appleButton.setAttribute("aria-label", "Select apples")

    appleButton.addEventListener("click", () => {
      toggleAppleWeaponSelection()
    })

    appleButton.addEventListener("touchstart", (event) => {
      event.preventDefault()
      toggleAppleWeaponSelection()
    })
  }

  if (hammerButton) {
    hammerButton.setAttribute("role", "button")
    hammerButton.setAttribute("tabindex", "0")
    hammerButton.setAttribute("aria-label", "Select sledgehammer")

    hammerButton.addEventListener("click", () => {
      toggleSledgehammerToolSelection()
    })

    hammerButton.addEventListener("touchstart", (event) => {
      event.preventDefault()
      toggleSledgehammerToolSelection()
    })
  }

  hudSelectorsBound = true
}

export function toggleAppleWeaponSelection() {
  const apples = gameState.player?.apples ?? 0

  if (gameState.selectedWeapon === "apple") {
    gameState.selectedWeapon = "wrist"
  } else if (apples > 0) {
    gameState.selectedWeapon = "apple"
  } else {
    gameState.selectedWeapon = "wrist"
  }

  updateWeaponSelectionUi()
}

export function toggleSledgehammerToolSelection() {
  if (!gameState.hasSledgehammer) {
    gameState.selectedTool = "none"
  } else if (gameState.selectedTool === "sledgehammer") {
    gameState.selectedTool = "none"
  } else {
    gameState.selectedTool = "sledgehammer"
  }

  updateWeaponSelectionUi()
}

export function updateWeaponSelectionUi() {
  const appleButton = getAppleWeaponButton()
  const hammerButton = document.getElementById("sledgehammerIndicator")
  const apples = gameState.player?.apples ?? 0
  const appleSelected = gameState.selectedWeapon === "apple" && apples > 0
  const hammerSelected = gameState.selectedTool === "sledgehammer" && Boolean(gameState.hasSledgehammer)

  if (appleButton) {
    appleButton.classList.toggle("selected", appleSelected)
    appleButton.classList.toggle("disabled", apples <= 0)
  }

  if (hammerButton) {
    hammerButton.classList.toggle("selected", hammerSelected)
    hammerButton.classList.toggle("disabled", !gameState.hasSledgehammer)
    hammerButton.classList.toggle("has-tool", Boolean(gameState.hasSledgehammer))
  }
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