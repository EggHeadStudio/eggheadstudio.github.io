import { createDefaultGameConfig, init, pauseCurrentGame, resumeCurrentGame } from "../core/game.js"
import { gameState } from "../core/game-state.js"
import { getCharacterTypeProperties, getSelectableCharacterTypes } from "../entities/character-factory.js"
import { resetHud, setHudVisibility } from "./ui-manager.js"

const TIME_OPTIONS = [
  { id: "dawn", label: "Dawn", description: "Warm light, low contrast" },
  { id: "day", label: "Day", description: "Neutral daylight" },
  { id: "dusk", label: "Dusk", description: "Golden fade into shadow" },
  { id: "night", label: "Night", description: "Dark world with a small light radius" },
]

let isInitialized = false
let minimapLongPressTimer = null

const MENU_COPY = {
  start: {
    kicker: "Top-Down Survival",
    title: "Start Expedition",
    description:
      "Pick your starting loadout and time of day. The menu is structured so new characters and options can be added here later without changing the game bootstrap.",
  },
  pause: {
    kicker: "Paused",
    title: "Expedition Paused",
    description: "Resume the current run or start a fresh run with the selected character and time of day.",
  },
  gameover: {
    kicker: "Game Over",
    title: "Game Over",
    description: "You were defeated. Start a new run with the selected character and time of day.",
  },
}

export function initializeStartMenu(initialConfig = createDefaultGameConfig()) {
  if (isInitialized) {
    syncMenuFromConfig(initialConfig)
    return
  }

  gameState.startupConfig = {
    ...createDefaultGameConfig(),
    ...initialConfig,
  }

  renderCharacterOptions()
  renderTimeOptions()
  setupMinimapMenuTrigger()

  document.getElementById("resumeGameButton").addEventListener("click", () => {
    if (gameState.isStarted && gameState.isPaused && !gameState.gameOver) {
      resumeCurrentGame()
      hideStartMenu()
    }
  })

  document.getElementById("newGameButton").addEventListener("click", () => {
    init({ ...gameState.startupConfig })
    hideStartMenu()
  })

  setHudVisibility(false)
  resetHud()
  syncMenuFromConfig(gameState.startupConfig)
  isInitialized = true
}

export function showStartMenu() {
  const startMenu = document.getElementById("startMenu")
  startMenu.classList.add("active")
  renderMenuState()
  setHudVisibility(false)
}

export function hideStartMenu() {
  const startMenu = document.getElementById("startMenu")
  startMenu.classList.remove("active")

  if (gameState.isStarted && !gameState.gameOver) {
    setHudVisibility(true)
  }
}

function syncMenuFromConfig(config) {
  gameState.startupConfig = {
    ...createDefaultGameConfig(),
    ...config,
  }

  updateActiveOption("character", gameState.startupConfig.characterType)
  updateActiveOption("time", gameState.startupConfig.startPhase)
  renderCharacterPreview(gameState.startupConfig.characterType)
  renderMenuState()
}

export function showGameOverMenu() {
  gameState.menuMode = "gameover"
  syncMenuFromConfig(gameState.startupConfig)
  showStartMenu()
}

function setupMinimapMenuTrigger() {
  const minimapFrame = document.querySelector(".minimap-frame")
  if (!minimapFrame || window.minimapMenuTriggerSet) {
    return
  }

  minimapFrame.addEventListener("click", handleMinimapClick)
  minimapFrame.addEventListener("touchstart", handleMinimapTouchStart, { passive: true })
  minimapFrame.addEventListener("touchend", clearMinimapLongPress)
  minimapFrame.addEventListener("touchcancel", clearMinimapLongPress)
  minimapFrame.addEventListener("touchmove", clearMinimapLongPress)

  window.minimapMenuTriggerSet = true
}

function handleMinimapClick() {
  if (gameState.isMobile) {
    return
  }

  openPausedMenu()
}

function handleMinimapTouchStart() {
  if (!gameState.isMobile) {
    return
  }

  clearMinimapLongPress()
  minimapLongPressTimer = window.setTimeout(() => {
    minimapLongPressTimer = null
    openPausedMenu()
  }, 450)
}

function clearMinimapLongPress() {
  if (minimapLongPressTimer !== null) {
    window.clearTimeout(minimapLongPressTimer)
    minimapLongPressTimer = null
  }
}

function openPausedMenu() {
  if (!gameState.isStarted || gameState.gameOver || gameState.isPaused) {
    return
  }

  if (pauseCurrentGame()) {
    gameState.menuMode = "pause"
    syncMenuFromConfig(gameState.startupConfig)
    showStartMenu()
  }
}

function renderMenuState() {
  const startMenu = document.getElementById("startMenu")
  const menuKicker = document.querySelector(".menu-kicker")
  const menuTitle = document.getElementById("menuTitle")
  const menuDescription = document.getElementById("menuDescription")
  const resumeButton = document.getElementById("resumeGameButton")
  const newGameButton = document.getElementById("newGameButton")
  const menuState = MENU_COPY[gameState.menuMode] || MENU_COPY.start

  if (!startMenu || !menuKicker || !menuTitle || !menuDescription || !resumeButton || !newGameButton) {
    return
  }

  menuKicker.textContent = menuState.kicker
  menuTitle.textContent = menuState.title
  menuDescription.textContent = menuState.description
  resumeButton.hidden = !(gameState.isStarted && gameState.isPaused && !gameState.gameOver && gameState.menuMode === "pause")
  newGameButton.textContent = gameState.isStarted ? "Start New Game" : "Start Game"
  startMenu.classList.toggle("game-over-mode", gameState.menuMode === "gameover")
}

function renderCharacterOptions() {
  const optionsContainer = document.getElementById("characterOptions")
  optionsContainer.innerHTML = ""

  for (const characterType of getSelectableCharacterTypes()) {
    const properties = getCharacterTypeProperties(characterType)
    const button = document.createElement("button")
    button.type = "button"
    button.className = "menu-option"
    button.dataset.optionGroup = "character"
    button.dataset.optionValue = characterType
    button.innerHTML = `
      <strong>${formatLabel(characterType)}</strong>
      <span>Skin color ${properties.color}</span>
    `

    button.addEventListener("click", () => {
      gameState.startupConfig.characterType = characterType
      updateActiveOption("character", characterType)
      renderCharacterPreview(characterType)
    })

    optionsContainer.appendChild(button)
  }
}

function renderTimeOptions() {
  const optionsContainer = document.getElementById("timeOptions")
  optionsContainer.innerHTML = ""

  for (const option of TIME_OPTIONS) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "menu-option"
    button.dataset.optionGroup = "time"
    button.dataset.optionValue = option.id
    button.innerHTML = `
      <strong>${option.label}</strong>
      <span>${option.description}</span>
    `

    button.addEventListener("click", () => {
      gameState.startupConfig.startPhase = option.id
      updateActiveOption("time", option.id)
    })

    optionsContainer.appendChild(button)
  }
}

function renderCharacterPreview(characterType) {
  const preview = document.getElementById("characterPreview")
  const properties = getCharacterTypeProperties(characterType)

  preview.innerHTML = `
    <div class="character-preview-figure">
      <div class="character-preview-avatar" style="background:${properties.color}"></div>
      <div>
        <strong>${formatLabel(characterType)}</strong>
        <p>This panel is ready for more characters later. Right now it surfaces the existing default skin and its gameplay values.</p>
      </div>
    </div>
    <div class="character-preview-stats">
      <div>
        <strong>Health</strong>
        <span>${properties.health}</span>
      </div>
      <div>
        <strong>Speed</strong>
        <span>${properties.speed.toFixed(1)}</span>
      </div>
      <div>
        <strong>Strength</strong>
        <span>${properties.strength.toFixed(1)}</span>
      </div>
    </div>
  `
}

function updateActiveOption(group, value) {
  const buttons = document.querySelectorAll(`[data-option-group="${group}"]`)

  for (const button of buttons) {
    button.classList.toggle("active", button.dataset.optionValue === value)
  }
}

function formatLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}