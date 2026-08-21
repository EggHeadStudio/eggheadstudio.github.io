import { createDefaultGameConfig, init, pauseCurrentGame, resumeCurrentGame } from "../core/game.js"
import { gameState } from "../core/game-state.js"
import {
  CHARACTER_CUSTOMIZATION_RULES,
  getCharacterTypeProperties,
  getSelectableCharacterTypes,
  normalizeCharacterCustomization,
} from "../entities/character-factory.js"
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
  const mergedConfig = {
    ...createDefaultGameConfig(),
    ...config,
  }

  gameState.startupConfig = {
    ...mergedConfig,
    characterAttributes: normalizeCharacterCustomization(mergedConfig.characterAttributes, mergedConfig.characterType),
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
      gameState.startupConfig.characterAttributes = normalizeCharacterCustomization(
        gameState.startupConfig.characterAttributes,
        characterType,
      )
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
  const baseProperties = getCharacterTypeProperties(characterType)
  const customProperties = normalizeCharacterCustomization(gameState.startupConfig.characterAttributes, characterType)
  const properties = {
    ...baseProperties,
    ...customProperties,
  }

  gameState.startupConfig.characterAttributes = customProperties

  preview.innerHTML = `
    <div class="character-preview-figure">
      <div class="character-preview-avatar" style="background:${properties.color}"></div>
      <div>
        <strong>${formatLabel(characterType)}</strong>
        <p>Customize your character before starting. Values outside the allowed ranges are automatically corrected.</p>
      </div>
    </div>
    <div class="character-customization-controls">
      <label class="customization-field color-field">
        <span>Color</span>
        <div class="color-control-group">
          <input id="characterColorPicker" type="color" value="${toColorPickerValue(properties.color)}" aria-label="Character color picker">
          <input id="characterColorInput" type="text" value="${escapeHtml(properties.color)}" placeholder="Any CSS color (name, hex, rgb)">
        </div>
      </label>

      <label class="customization-field">
        <span>Health (${CHARACTER_CUSTOMIZATION_RULES.health.min}-${CHARACTER_CUSTOMIZATION_RULES.health.max})</span>
        <div class="stat-control-group">
          <input id="characterHealthRange" type="range" min="${CHARACTER_CUSTOMIZATION_RULES.health.min}" max="${CHARACTER_CUSTOMIZATION_RULES.health.max}" step="1" value="${properties.health}">
          <input id="characterHealthNumber" type="number" min="${CHARACTER_CUSTOMIZATION_RULES.health.min}" max="${CHARACTER_CUSTOMIZATION_RULES.health.max}" step="1" value="${properties.health}">
        </div>
      </label>

      <label class="customization-field">
        <span>Speed (${CHARACTER_CUSTOMIZATION_RULES.speed.min}-${CHARACTER_CUSTOMIZATION_RULES.speed.max})</span>
        <div class="stat-control-group">
          <input id="characterSpeedRange" type="range" min="${CHARACTER_CUSTOMIZATION_RULES.speed.min}" max="${CHARACTER_CUSTOMIZATION_RULES.speed.max}" step="1" value="${properties.speed}">
          <input id="characterSpeedNumber" type="number" min="${CHARACTER_CUSTOMIZATION_RULES.speed.min}" max="${CHARACTER_CUSTOMIZATION_RULES.speed.max}" step="1" value="${properties.speed}">
        </div>
      </label>

      <label class="customization-field">
        <span>Strength (${CHARACTER_CUSTOMIZATION_RULES.strength.min}-${CHARACTER_CUSTOMIZATION_RULES.strength.max})</span>
        <div class="stat-control-group">
          <input id="characterStrengthRange" type="range" min="${CHARACTER_CUSTOMIZATION_RULES.strength.min}" max="${CHARACTER_CUSTOMIZATION_RULES.strength.max}" step="1" value="${properties.strength}">
          <input id="characterStrengthNumber" type="number" min="${CHARACTER_CUSTOMIZATION_RULES.strength.min}" max="${CHARACTER_CUSTOMIZATION_RULES.strength.max}" step="1" value="${properties.strength}">
        </div>
      </label>
    </div>
    <div class="character-preview-stats">
      <div>
        <strong>Health</strong>
        <span id="characterHealthValue">${properties.health}</span>
      </div>
      <div>
        <strong>Speed</strong>
        <span id="characterSpeedValue">${properties.speed.toFixed(1)}</span>
      </div>
      <div>
        <strong>Strength</strong>
        <span id="characterStrengthValue">${properties.strength.toFixed(1)}</span>
      </div>
    </div>
  `

  setupCharacterCustomizationControls(characterType)
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

function setupCharacterCustomizationControls(characterType) {
  const colorPicker = document.getElementById("characterColorPicker")
  const colorInput = document.getElementById("characterColorInput")

  bindStatControl("health", "characterHealthRange", "characterHealthNumber", "characterHealthValue", characterType)
  bindStatControl("speed", "characterSpeedRange", "characterSpeedNumber", "characterSpeedValue", characterType)
  bindStatControl("strength", "characterStrengthRange", "characterStrengthNumber", "characterStrengthValue", characterType)

  if (!colorPicker || !colorInput) {
    return
  }

  colorPicker.addEventListener("input", () => {
    updateCharacterAttributes({ color: colorPicker.value }, characterType)
    colorInput.value = gameState.startupConfig.characterAttributes.color
    updateCharacterPreviewVisuals()
  })

  const commitColorInput = () => {
    updateCharacterAttributes({ color: colorInput.value }, characterType)
    colorInput.value = gameState.startupConfig.characterAttributes.color
    colorPicker.value = toColorPickerValue(gameState.startupConfig.characterAttributes.color)
    updateCharacterPreviewVisuals()
  }

  colorInput.addEventListener("change", commitColorInput)
  colorInput.addEventListener("blur", commitColorInput)
}

function bindStatControl(key, rangeId, numberId, valueId, characterType) {
  const rangeInput = document.getElementById(rangeId)
  const numberInput = document.getElementById(numberId)
  const valueOutput = document.getElementById(valueId)

  if (!rangeInput || !numberInput || !valueOutput) {
    return
  }

  const updateStat = (nextValue) => {
    updateCharacterAttributes({ [key]: nextValue }, characterType)
    const resolvedValue = gameState.startupConfig.characterAttributes[key]
    rangeInput.value = String(resolvedValue)
    numberInput.value = String(resolvedValue)
    valueOutput.textContent = key === "health" ? String(Math.round(resolvedValue)) : resolvedValue.toFixed(1)
  }

  rangeInput.addEventListener("input", () => {
    updateStat(rangeInput.value)
  })

  numberInput.addEventListener("change", () => {
    updateStat(numberInput.value)
  })

  numberInput.addEventListener("blur", () => {
    updateStat(numberInput.value)
  })
}

function updateCharacterAttributes(partialAttributes, characterType) {
  const mergedAttributes = {
    ...gameState.startupConfig.characterAttributes,
    ...partialAttributes,
  }

  gameState.startupConfig.characterAttributes = normalizeCharacterCustomization(mergedAttributes, characterType)
}

function updateCharacterPreviewVisuals() {
  const avatar = document.querySelector(".character-preview-avatar")
  const attributes = gameState.startupConfig.characterAttributes

  if (!avatar || !attributes) {
    return
  }

  avatar.style.background = attributes.color
}

function toColorPickerValue(colorValue) {
  const hexMatch = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(colorValue || "")

  if (hexMatch) {
    return normalizeHexColor(colorValue)
  }

  return "#3498db"
}

function normalizeHexColor(value) {
  if (!value || value.length !== 4) {
    return value
  }

  const r = value[1]
  const g = value[2]
  const b = value[3]
  return `#${r}${r}${g}${g}${b}${b}`
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}