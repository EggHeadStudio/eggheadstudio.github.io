// UI management
import { gameState } from "../core/game-state.js"
import { pauseCurrentGame, resumeCurrentGame } from "../core/game.js"

let hudSelectorsBound = false
let selectorModalBound = false

const WEAPON_OPTION_LABELS = {
  wrist: "Wrist",
  apple: "Apple",
  bomb: "Bomb",
}

const TOOL_OPTION_LABELS = {
  none: "None",
  sledgehammer: "Sledgehammer",
  shovel: "Shovel",
  saw: "Saw",
}

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
  closeSelectorModal(false)
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

function cycleToolSelection(step = 1) {
  ensureSelectedToolIsAvailable()
  const availableTools = getAvailableTools()
  if (!availableTools.length) {
    return
  }

  const currentIndex = Math.max(0, availableTools.indexOf(gameState.selectedTool))
  const nextIndex = (currentIndex + step + availableTools.length) % availableTools.length
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

function cycleWeaponSelection(step = 1) {
  ensureSelectedWeaponIsAvailable()
  const availableWeapons = getAvailableWeapons()
  if (!availableWeapons.length) {
    return
  }

  const currentIndex = Math.max(0, availableWeapons.indexOf(gameState.selectedWeapon))
  const nextIndex = (currentIndex + step + availableWeapons.length) % availableWeapons.length
  gameState.selectedWeapon = availableWeapons[nextIndex]
  updateWeaponSelectionUi()
}

function getSelectorModalElements() {
  return {
    modal: document.getElementById("selectorModal"),
    title: document.getElementById("selectorModalTitle"),
    hint: document.getElementById("selectorModalHint"),
    center: document.getElementById("selectorModalCenter"),
    previewCanvas: document.getElementById("selectorModalPreview"),
    centerLabel: document.getElementById("selectorModalCenterLabel"),
    prevButton: document.getElementById("selectorModalPrev"),
    nextButton: document.getElementById("selectorModalNext"),
  }
}

function drawModalItemPreview(ctx, type, option, width, height) {
  const centerX = width / 2
  const centerY = height / 2

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.translate(centerX, centerY)

  if (type === "weapon") {
    if (option === "apple") {
      const size = 18
      ctx.fillStyle = "#e74c3c"
      ctx.beginPath()
      ctx.arc(0, 4, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#27ae60"
      ctx.fillRect(-2, -20, 4, 11)
    } else if (option === "bomb") {
      const size = 32
      const radius = 8
      const x = -size / 2
      const y = -size / 2 + 6

      ctx.fillStyle = "#686359"
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + size - radius, y)
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius)
      ctx.lineTo(x + size, y + size - radius)
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size)
      ctx.lineTo(x + radius, y + size)
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = "#3b3b3b9d"
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = "#494949"
      ctx.fillRect(-2, -30, 4, 11)
      ctx.fillStyle = "#ffcc00"
      ctx.beginPath()
      ctx.arc(0, -31, 4, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Wrist / empty hand
      ctx.fillStyle = "#aeb6bc"
      ctx.fillRect(-9, -7, 18, 20)
      ctx.fillStyle = "#cdd4d9"
      ctx.fillRect(-7, -14, 14, 10)
    }
  } else {
    if (option === "sledgehammer") {
      const handleLength = 54
      const handleWidth = 8
      const headWidth = 64
      const headHeight = 22
      ctx.rotate(-0.32)
      ctx.fillStyle = "#66513a"
      ctx.fillRect(-handleWidth / 2, -8, handleWidth, handleLength)
      ctx.fillStyle = "#aab2b8"
      ctx.fillRect(-headWidth / 2, -20, headWidth, headHeight)
      ctx.fillStyle = "#c8d0d4"
      ctx.fillRect(-headWidth * 0.2, -18, headWidth * 0.4, headHeight * 0.65)
    } else if (option === "shovel") {
      const handleLength = 56
      const handleWidth = 7
      const bladeWidth = 52
      ctx.rotate(-0.25)
      ctx.fillStyle = "#7a5636"
      ctx.fillRect(-handleWidth / 2, -6, handleWidth, handleLength)
      ctx.fillStyle = "#aeb6bc"
      ctx.beginPath()
      ctx.moveTo(-bladeWidth * 0.45, -28)
      ctx.lineTo(bladeWidth * 0.45, -28)
      ctx.lineTo(bladeWidth * 0.2, 0)
      ctx.lineTo(-bladeWidth * 0.2, 0)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = "#cdd4d9"
      ctx.fillRect(-bladeWidth * 0.16, -21, bladeWidth * 0.32, 10)
    } else if (option === "saw") {
      const handleLength = 46
      const handleWidth = 7
      const bladeLength = 80
      const bladeWidth = 14
      ctx.rotate(-0.1)
      ctx.fillStyle = "#6b4423"
      ctx.fillRect(-handleLength * 0.62, -handleWidth * 0.5, handleLength, handleWidth)
      ctx.fillStyle = "#dfe6eb"
      ctx.fillRect(-handleWidth * 0.16, -bladeWidth * 0.5, bladeLength, bladeWidth)
      ctx.fillStyle = "#bbc3ca"
      ctx.beginPath()
      ctx.moveTo(-handleWidth * 0.16, -bladeWidth * 0.5)
      ctx.lineTo(-handleWidth * 0.16 + bladeLength * 0.12, -bladeWidth * 0.7)
      ctx.lineTo(-handleWidth * 0.16 + bladeLength * 0.12, bladeWidth * 0.7)
      ctx.lineTo(-handleWidth * 0.16, bladeWidth * 0.5)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillStyle = "#8d9398"
      ctx.fillRect(-10, -10, 20, 20)
    }
  }

  ctx.restore()
}

function getModalOptionsByType(type) {
  return type === "tool" ? getAvailableTools() : getAvailableWeapons()
}

function updateSelectorModalUi() {
  if (!gameState.selectorModalOpen) {
    return
  }

  const { modal, title, hint, previewCanvas, centerLabel } = getSelectorModalElements()
  if (!modal || !title || !hint || !previewCanvas || !centerLabel) {
    return
  }

  const type = gameState.selectorModalType === "tool" ? "tool" : "weapon"
  const options = getModalOptionsByType(type)
  if (!options.length) {
    return
  }

  if (type === "tool") {
    ensureSelectedToolIsAvailable()
  } else {
    ensureSelectedWeaponIsAvailable()
  }

  const selected = type === "tool" ? gameState.selectedTool : gameState.selectedWeapon
  const activeOption = options.includes(selected) ? selected : options[0]
  if (type === "tool") {
    gameState.selectedTool = activeOption
  } else {
    gameState.selectedWeapon = activeOption
  }

  modal.classList.remove("hidden")
  modal.setAttribute("aria-hidden", "false")
  title.textContent = type === "tool" ? "Select Tool" : "Select Weapon"
  hint.textContent = "Use arrows to browse, then tap center to resume"

  const ctx = previewCanvas.getContext("2d")
  if (ctx) {
    drawModalItemPreview(ctx, type, activeOption, previewCanvas.width, previewCanvas.height)
  }

  centerLabel.textContent = type === "tool" ? TOOL_OPTION_LABELS[activeOption] || activeOption : WEAPON_OPTION_LABELS[activeOption] || activeOption
}

function closeSelectorModal(shouldResume = true) {
  const { modal } = getSelectorModalElements()
  if (modal) {
    modal.classList.add("hidden")
    modal.setAttribute("aria-hidden", "true")
  }

  const wasOpen = gameState.selectorModalOpen
  gameState.selectorModalOpen = false
  gameState.selectorModalType = null

  if (shouldResume && wasOpen) {
    resumeCurrentGame()
  }
}

function openSelectorModal(type) {
  if (!gameState.isStarted || gameState.gameOver) {
    return
  }

  if (gameState.selectorModalOpen) {
    gameState.selectorModalType = type
    updateSelectorModalUi()
    return
  }

  if (!pauseCurrentGame()) {
    return
  }

  gameState.selectorModalOpen = true
  gameState.selectorModalType = type
  updateSelectorModalUi()
}

function stepSelectorModal(step) {
  if (!gameState.selectorModalOpen) {
    return
  }

  if (gameState.selectorModalType === "tool") {
    cycleToolSelection(step)
  } else {
    cycleWeaponSelection(step)
  }

  updateSelectorModalUi()
}

function bindSelectorModalControls() {
  if (selectorModalBound) {
    return
  }

  const { prevButton, nextButton, center } = getSelectorModalElements()
  if (!prevButton || !nextButton || !center) {
    return
  }

  prevButton.addEventListener("click", () => stepSelectorModal(-1))
  nextButton.addEventListener("click", () => stepSelectorModal(1))
  center.addEventListener("click", () => closeSelectorModal(true))

  selectorModalBound = true
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
    weaponSelector.setAttribute("aria-label", "Open weapon selector")

    weaponSelector.addEventListener("click", () => {
      openSelectorModal("weapon")
    })

    weaponSelector.addEventListener("touchstart", (event) => {
      event.preventDefault()
      openSelectorModal("weapon")
    })
  }

  if (toolSelector) {
    toolSelector.setAttribute("role", "button")
    toolSelector.setAttribute("tabindex", "0")
    toolSelector.setAttribute("aria-label", "Open tool selector")

    toolSelector.addEventListener("click", () => {
      openSelectorModal("tool")
    })

    toolSelector.addEventListener("touchstart", (event) => {
      event.preventDefault()
      openSelectorModal("tool")
    })
  }

  bindSelectorModalControls()

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
  updateSelectorModalUi()
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