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
  document.getElementById("weaponCount").textContent = "-"
  document.getElementById("timer").textContent = "00:00"
  document.getElementById("killCount").textContent = "0"
  bindHudSelectors()
  updateSledgehammerIndicator()
  updateShovelIndicator()
  updateSawIndicator()
  updateWeaponSelectionUi()
}

// Update apple counter in UI
export function updateAppleCounter() {
  const apples = gameState.player?.apples ?? 0

  if (apples <= 0 && gameState.selectedWeapon === "apple") {
    gameState.selectedWeapon = "wrist"
  }

  updateWeaponSelectionUi()
}

export function updateBombCounter() {
  const bombs = gameState.player?.bombs ?? 0

  if (bombs <= 0 && gameState.selectedWeapon === "bomb") {
    gameState.selectedWeapon = "wrist"
  }

  updateWeaponSelectionUi()
}

export function updateSledgehammerIndicator() {
  const hasSledgehammer = Boolean(gameState.hasSledgehammer)

  if (!hasSledgehammer && gameState.selectedTool === "sledgehammer") {
    gameState.selectedTool = "none"
  }

  updateToolSelectorUi()
  updateWeaponSelectionUi()
}

function getAvailableTools() {
  const tools = ["none"]

  if (gameState.hasSledgehammer) {
    tools.push("sledgehammer")
  }

  if (gameState.hasShovel) {
    tools.push("shovel")
  }

  if (gameState.hasSaw) {
    tools.push("saw")
  }

  return tools
}

function ensureSelectedToolIsAvailable() {
  const availableTools = getAvailableTools()
  if (!availableTools.includes(gameState.selectedTool)) {
    gameState.selectedTool = "none"
  }
}

function cycleToolSelection() {
  ensureSelectedToolIsAvailable()
  const availableTools = getAvailableTools()
  const currentIndex = Math.max(0, availableTools.indexOf(gameState.selectedTool))
  const nextIndex = (currentIndex + 1) % availableTools.length
  gameState.selectedTool = availableTools[nextIndex]

  updateToolSelectorUi()
  updateWeaponSelectionUi()
}

export function updateShovelIndicator() {
  const hasShovel = Boolean(gameState.hasShovel)

  if (!hasShovel && gameState.selectedTool === "shovel") {
    gameState.selectedTool = "none"
  }

  updateToolSelectorUi()
  updateWeaponSelectionUi()
}

export function updateSawIndicator() {
  const hasSaw = Boolean(gameState.hasSaw)

  if (!hasSaw && gameState.selectedTool === "saw") {
    gameState.selectedTool = "none"
  }

  updateToolSelectorUi()
  updateWeaponSelectionUi()
}

function updateToolSelectorUi() {
  const selector = document.getElementById("toolSelector")
  const icon = document.getElementById("toolSelectorIcon")
  if (!selector || !icon) return

  ensureSelectedToolIsAvailable()
  const hasAnyTool = gameState.hasSledgehammer || gameState.hasShovel || gameState.hasSaw

  selector.classList.toggle("active", hasAnyTool)
  selector.classList.toggle("selected", gameState.selectedTool !== "none")
  selector.classList.toggle("disabled", !hasAnyTool)

  icon.classList.remove("none", "sledgehammer", "shovel", "saw")
  icon.classList.add(gameState.selectedTool === "none" ? "none" : gameState.selectedTool)
}

function getAvailableWeapons() {
  const weapons = ["wrist"]

  if ((gameState.player?.apples ?? 0) > 0) {
    weapons.push("apple")
  }

  if ((gameState.player?.bombs ?? 0) > 0) {
    weapons.push("bomb")
  }

  return weapons
}

function ensureSelectedWeaponIsAvailable() {
  const availableWeapons = getAvailableWeapons()
  if (!availableWeapons.includes(gameState.selectedWeapon)) {
    gameState.selectedWeapon = "wrist"
  }
}

function cycleWeaponSelection() {
  ensureSelectedWeaponIsAvailable()
  const availableWeapons = getAvailableWeapons()
  const currentIndex = Math.max(0, availableWeapons.indexOf(gameState.selectedWeapon))
  const nextIndex = (currentIndex + 1) % availableWeapons.length
  gameState.selectedWeapon = availableWeapons[nextIndex]
  updateWeaponSelectionUi()
}

function updateWeaponSelectorUi() {
  const selector = document.getElementById("weaponSelector")
  const icon = document.getElementById("weaponSelectorIcon")
  const count = document.getElementById("weaponCount")

  if (!selector || !icon || !count) return

  ensureSelectedWeaponIsAvailable()
  const apples = gameState.player?.apples ?? 0
  const bombs = gameState.player?.bombs ?? 0

  selector.classList.toggle("selected", gameState.selectedWeapon !== "wrist")

  icon.classList.remove("wrist", "apple", "bomb")
  icon.classList.add(gameState.selectedWeapon)

  if (gameState.selectedWeapon === "apple") {
    count.textContent = apples.toString()
  } else if (gameState.selectedWeapon === "bomb") {
    count.textContent = bombs.toString()
  } else {
    count.textContent = "-"
  }
}

function bindHudSelectors() {
  if (hudSelectorsBound) return

  const weaponSelector = document.getElementById("weaponSelector")
  const toolSelector = document.getElementById("toolSelector")

  if (weaponSelector) {
    weaponSelector.setAttribute("role", "button")
    weaponSelector.setAttribute("tabindex", "0")
    weaponSelector.setAttribute("aria-label", "Cycle weapons")

    weaponSelector.addEventListener("click", () => {
      cycleWeaponSelection()
    })

    weaponSelector.addEventListener("touchstart", (event) => {
      event.preventDefault()
      cycleWeaponSelection()
    })
  }

  if (toolSelector) {
    toolSelector.setAttribute("role", "button")
    toolSelector.setAttribute("tabindex", "0")
    toolSelector.setAttribute("aria-label", "Cycle tools")

    toolSelector.addEventListener("click", () => {
      cycleToolSelection()
    })

    toolSelector.addEventListener("touchstart", (event) => {
      event.preventDefault()
      cycleToolSelection()
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

export function toggleBombWeaponSelection() {
  const bombs = gameState.player?.bombs ?? 0

  if (gameState.selectedWeapon === "bomb") {
    gameState.selectedWeapon = "wrist"
  } else if (bombs > 0) {
    gameState.selectedWeapon = "bomb"
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

export function toggleShovelToolSelection() {
  if (!gameState.hasShovel) {
    gameState.selectedTool = "none"
  } else if (gameState.selectedTool === "shovel") {
    gameState.selectedTool = "none"
  } else {
    gameState.selectedTool = "shovel"
  }

  updateWeaponSelectionUi()
}

export function toggleSawToolSelection() {
  if (!gameState.hasSaw) {
    gameState.selectedTool = "none"
  } else if (gameState.selectedTool === "saw") {
    gameState.selectedTool = "none"
  } else {
    gameState.selectedTool = "saw"
  }

  updateWeaponSelectionUi()
}

export function updateWeaponSelectionUi() {
  updateWeaponSelectorUi()

  updateToolSelectorUi()
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