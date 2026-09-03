import { createDefaultGameConfig, init, pauseCurrentGame, resumeCurrentGame } from "../core/game.js"
import { gameState } from "../core/game-state.js"
import {
  CHARACTER_CUSTOMIZATION_RULES,
  getCharacterCustomizationDefaults,
  getCharacterTypeLabel,
  getCharacterTypeProperties,
  getSelectableCharacterTypes,
  getSpecialCharacterConfig,
  isSpecialHeroOnlyMode,
  normalizeCharacterCustomization,
} from "../entities/character-factory.js"
import { drawCharacterPreview } from "../entities/player.js"
import { SHOW_START_TIME_OPTIONS, SHOW_CHARACTER_CUSTOMIZATION } from "../core/constants.js"
import { resetHud, setHudVisibility } from "./ui-manager.js"
import { handleClaimableSectionClick, renderExplorationMapCanvas } from "./minimap.js"

const PREVIEW_CANVAS_SIZE = 104
const PREVIEW_SCALE = 0.6

const TIME_OPTIONS = [
  { id: "dawn", label: "Dawn", description: "Warm light, low contrast" },
  { id: "day", label: "Day", description: "Neutral daylight" },
  { id: "dusk", label: "Dusk", description: "Golden fade into shadow" },
  { id: "night", label: "Night", description: "Dark world with a small light radius" },
]

let isInitialized = false
let previewAnimationFrame = null
let previewAnimationTime = 0

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
  setupPerformanceOptions()
  setupMinimapMenuTrigger()

  document.getElementById("resumeGameButton").addEventListener("click", () => {
    if (gameState.isStarted && gameState.isPaused && !gameState.gameOver) {
      gameState.mapRevealOpen = false
      resumeCurrentGame()
      hideStartMenu()
    }
  })

  document.getElementById("toggleMapButton").addEventListener("click", () => {
    if (!gameState.isStarted || gameState.gameOver) {
      return
    }

    gameState.mapRevealOpen = !gameState.mapRevealOpen
    const mapPage = document.getElementById("explorationMapPage")
    if (mapPage) {
      mapPage.classList.toggle("hidden", !gameState.mapRevealOpen)
    }
    renderMenuState()

    if (gameState.mapRevealOpen) {
      renderExplorationMapCanvas()
    }
  })

  document.getElementById("closeMapButton").addEventListener("click", () => {
    gameState.mapRevealOpen = false
    const mapPage = document.getElementById("explorationMapPage")
    if (mapPage) {
      mapPage.classList.add("hidden")
    }
    renderMenuState()
  })

  const explorationMapCanvas = document.getElementById("explorationMapCanvas")
  if (explorationMapCanvas && !explorationMapCanvas.dataset.claimHandlerBound) {
    explorationMapCanvas.addEventListener("click", (event) => {
      if (!gameState.isStarted || !gameState.isPaused || !gameState.mapRevealOpen) {
        return
      }

      const discoveredEntries = [...gameState.discoveredMap.values()]
      if (!discoveredEntries.length) {
        return
      }

      const clickX = (event.clientX - explorationMapCanvas.getBoundingClientRect().left) / explorationMapCanvas.clientWidth * explorationMapCanvas.clientWidth
      const clickY = (event.clientY - explorationMapCanvas.getBoundingClientRect().top) / explorationMapCanvas.clientHeight * explorationMapCanvas.clientHeight
      const claimed = handleClaimableSectionClick(clickX, clickY, explorationMapCanvas.clientWidth, explorationMapCanvas.clientHeight)
      if (claimed) {
        renderExplorationMapCanvas()
      }
    })
    explorationMapCanvas.dataset.claimHandlerBound = "true"
  }

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
  stopCharacterPreviewAnimation()

  if (gameState.isStarted && !gameState.gameOver) {
    setHudVisibility(true)
  }
}

function syncMenuFromConfig(config) {
  const mergedConfig = {
    ...createDefaultGameConfig(),
    ...config,
  }

  const defaultAttributesForType = getCharacterCustomizationDefaults(mergedConfig.characterType)
  const mergedAttributes = mergedConfig.characterAttributes
    ? { ...defaultAttributesForType, ...mergedConfig.characterAttributes }
    : defaultAttributesForType

  gameState.startupConfig = {
    ...mergedConfig,
    characterAttributes: normalizeCharacterCustomization(mergedAttributes, mergedConfig.characterType),
  }

  updateActiveOption("character", gameState.startupConfig.characterType)
  if (SHOW_START_TIME_OPTIONS) {
    updateActiveOption("time", gameState.startupConfig.startPhase)
  }
  syncPerformanceOptions()
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
  minimapFrame.addEventListener("touchend", handleMinimapTouchEnd, { passive: false })

  window.minimapMenuTriggerSet = true
}

function handleMinimapClick() {
  if (gameState.isMobile) {
    return
  }

  openPausedMenu()
}

function handleMinimapTouchEnd(event) {
  if (!gameState.isMobile) {
    return
  }

  event.preventDefault()
  openPausedMenu()
}

function openPausedMenu() {
  if (!gameState.isStarted || gameState.gameOver || gameState.isPaused) {
    return
  }

  if (pauseCurrentGame()) {
    gameState.mapRevealOpen = false
    gameState.menuMode = "pause"
    syncMenuFromConfig(gameState.startupConfig)
    showStartMenu()
  }
}

function buildAccessContext() {
  const hostname = (typeof window !== "undefined" ? window.location.hostname : "").toLowerCase()
  const specialConfig = getSpecialCharacterConfig(gameState.startupConfig.specialHeroId)
  const specialMode = isSpecialHeroOnlyMode(
    typeof window !== "undefined" ? window.location.search : "",
    hostname,
  )

  if (specialConfig) {
    return {
      mode: "special",
      kicker: "EggHead Studio",
      title: `${specialConfig.label} • Special Edition`,
      description: `This route is bound to ${specialConfig.label}. Open the card below to begin with this hero.`,
      specialMode,
    }
  }

  return {
    mode: "default",
    kicker: MENU_COPY.start.kicker,
    title: MENU_COPY.start.title,
    description: MENU_COPY.start.description,
    specialMode,
  }
}

function renderMenuState() {
  const startMenu = document.getElementById("startMenu")
  const menuCopy = document.querySelector(".menu-copy")
  const menuGrid = document.querySelector(".menu-grid")
  const menuActions = document.querySelector(".menu-actions")
  const menuKicker = document.querySelector(".menu-kicker")
  const menuTitle = document.getElementById("menuTitle")
  const menuDescription = document.getElementById("menuDescription")
  const resumeButton = document.getElementById("resumeGameButton")
  const newGameButton = document.getElementById("newGameButton")
  const toggleMapButton = document.getElementById("toggleMapButton")
  const mapPage = document.getElementById("explorationMapPage")
  const startTimeSection = document.getElementById("startTimeSection")
  const menuState = MENU_COPY[gameState.menuMode] || MENU_COPY.start
  const accessContext = buildAccessContext()

  if (!startMenu || !menuKicker || !menuTitle || !menuDescription || !resumeButton || !newGameButton || !toggleMapButton || !mapPage) {
    return
  }

  menuKicker.textContent = accessContext.kicker || menuState.kicker
  menuTitle.textContent = accessContext.title || menuState.title
  menuDescription.textContent = accessContext.description || menuState.description
  resumeButton.hidden = !(gameState.isStarted && gameState.isPaused && !gameState.gameOver && gameState.menuMode === "pause")
  toggleMapButton.hidden = !(gameState.isStarted && gameState.isPaused && !gameState.gameOver && gameState.menuMode === "pause")
  newGameButton.textContent = gameState.isStarted ? "Start New Game" : "Start Game"
  mapPage.classList.toggle("hidden", !(gameState.isStarted && gameState.isPaused && gameState.mapRevealOpen))
  const showMapOnly = gameState.isStarted && gameState.isPaused && gameState.mapRevealOpen
  if (menuCopy) menuCopy.hidden = showMapOnly
  if (menuGrid) menuGrid.hidden = showMapOnly
  if (menuActions) menuActions.hidden = showMapOnly
  if (startTimeSection) {
    startTimeSection.hidden = !SHOW_START_TIME_OPTIONS
  }
  startMenu.classList.toggle("game-over-mode", gameState.menuMode === "gameover")

  if (gameState.isStarted && gameState.isPaused && gameState.mapRevealOpen) {
    renderExplorationMapCanvas()
  }
}

function renderCharacterOptions() {
  const optionsContainer = document.getElementById("characterOptions")
  optionsContainer.innerHTML = ""

  const specialHeroId = gameState.startupConfig.specialHeroId
  const availableCharacterTypes = specialHeroId
    ? [getCharacterTypeProperties(specialHeroId)?.characterType || specialHeroId]
    : getSelectableCharacterTypes()

  for (const characterType of availableCharacterTypes) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "menu-option"
    button.dataset.optionGroup = "character"
    button.dataset.optionValue = characterType
    button.innerHTML = `
      <strong>${getCharacterTypeLabel(characterType)}</strong>
      <span>${getCharacterStyleDescription(characterType)}</span>
    `

    button.addEventListener("click", () => {
      if (specialHeroId) {
        gameState.startupConfig.characterType = characterType
        gameState.startupConfig.characterAttributes = getCharacterCustomizationDefaults(characterType)
        updateActiveOption("character", characterType)
        renderCharacterPreview(characterType)
        return
      }

      gameState.startupConfig.characterType = characterType
      gameState.startupConfig.characterAttributes = getCharacterCustomizationDefaults(characterType)
      updateActiveOption("character", characterType)
      renderCharacterPreview(characterType)
    })

    optionsContainer.appendChild(button)
  }
}

function renderTimeOptions() {
  const optionsContainer = document.getElementById("timeOptions")
  if (!optionsContainer) {
    return
  }

  optionsContainer.innerHTML = ""

  if (!SHOW_START_TIME_OPTIONS) {
    return
  }

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

function setupPerformanceOptions() {
  const lightweightModeToggle = document.getElementById("lightweightModeToggle")
  if (!lightweightModeToggle) {
    return
  }

  lightweightModeToggle.addEventListener("change", () => {
    gameState.startupConfig.lightweightMode = lightweightModeToggle.checked
  })
}

function syncPerformanceOptions() {
  const lightweightModeToggle = document.getElementById("lightweightModeToggle")
  if (!lightweightModeToggle) {
    return
  }

  lightweightModeToggle.checked = Boolean(gameState.startupConfig.lightweightMode)
}

function renderCharacterPreview(characterType) {
  const preview = document.getElementById("characterPreview")
  const baseProperties = getCharacterTypeProperties(characterType)
  const customProperties = normalizeCharacterCustomization(gameState.startupConfig.characterAttributes, characterType)
  const properties = {
    ...baseProperties,
    ...customProperties,
  }
  const specialConfig = getSpecialCharacterConfig(gameState.startupConfig.specialHeroId || characterType)
  const isSpecialHeroMode = Boolean(gameState.startupConfig.specialHeroId)
  const customizationDescription = "Customize your character before starting. Values outside the allowed ranges are automatically corrected."
  const descriptionText = SHOW_CHARACTER_CUSTOMIZATION
    ? specialConfig && specialConfig.characterType === characterType
      ? specialConfig.description
      : customizationDescription
    : specialConfig && specialConfig.characterType === characterType
      ? specialConfig.description
      : getCharacterStyleDescription(characterType)
  const heroBanner = specialConfig && specialConfig.characterType === characterType
    ? `
      <div class="special-character-banner">
        <span class="special-character-badge">Special Edition</span>
        <strong>${specialConfig.title}</strong>
        <small>${specialConfig.rarity} • ${specialConfig.perk}</small>
      </div>
    `
    : ""

  gameState.startupConfig.characterAttributes = customProperties

  preview.innerHTML = `
    <div class="special-hero-card">
      <div class="special-hero-card-header">
        <div class="special-hero-portrait-wrap">
          <canvas id="characterPreviewCanvas" class="character-preview-avatar" role="img" aria-label="${getCharacterTypeLabel(characterType)} preview"></canvas>
        </div>
        <div class="special-hero-card-copy">
          <span class="special-hero-eyebrow">${specialConfig ? specialConfig.rarity : "Hero"}</span>
          <h3>${specialConfig ? specialConfig.label : getCharacterTypeLabel(characterType)}</h3>
          ${heroBanner}
        </div>
      </div>

      <div class="special-hero-description">
        <p>${descriptionText}</p>
      </div>

      ${isSpecialHeroMode || !SHOW_CHARACTER_CUSTOMIZATION ? "" : `
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
      `}

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
    </div>
  `

  if (!isSpecialHeroMode && SHOW_CHARACTER_CUSTOMIZATION) {
    setupCharacterCustomizationControls(characterType)
  }
  startCharacterPreviewAnimation(characterType)
}

function startCharacterPreviewAnimation(characterType) {
  stopCharacterPreviewAnimation()

  const canvas = document.getElementById("characterPreviewCanvas")
  if (!canvas) {
    return
  }

  const ctx = canvas.getContext("2d")
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = PREVIEW_CANVAS_SIZE * pixelRatio
  canvas.height = PREVIEW_CANVAS_SIZE * pixelRatio

  const renderFrame = () => {
    const baseProperties = getCharacterTypeProperties(characterType)
    const character = {
      ...baseProperties,
      ...gameState.startupConfig.characterAttributes,
      characterType,
    }

    previewAnimationTime += 0.05

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.clearRect(0, 0, PREVIEW_CANVAS_SIZE, PREVIEW_CANVAS_SIZE)

    drawCharacterPreview(ctx, character, {
      x: PREVIEW_CANVAS_SIZE / 2,
      y: PREVIEW_CANVAS_SIZE / 2,
      scale: PREVIEW_SCALE,
      direction: -Math.PI / 2,
      isMoving: true,
      animationTime: previewAnimationTime,
    })

    previewAnimationFrame = window.requestAnimationFrame(renderFrame)
  }

  renderFrame()
}

function stopCharacterPreviewAnimation() {
  if (previewAnimationFrame !== null) {
    window.cancelAnimationFrame(previewAnimationFrame)
    previewAnimationFrame = null
  }
}

function getCharacterStyleDescription(characterType) {
  if (characterType === "rasse") {
    return "Always two steps ahead of trouble"
  }

  if (characterType === "iida") {
    return "Quietly maps chaos before it starts"
  }

  if (characterType === "andrus") {
    return "Holds the line when panic hits"
  }

  if (characterType === "lidia") {
    return "Turns impossible routes into easy wins"
  }

  if (characterType === "elli") {
    return "Calm under pressure, ruthless with timing"
  }

  if (characterType === "niko") {
    return "Finds shortcuts nobody else can spot"
  }

  if (characterType === "mara") {
    return "Reads every fight before it happens"
  }

  if (characterType === "taro") {
    return "Fast decisions, cleaner exits, zero drama"
  }

  return "Built for survival, never for spotlight"
}

function updateActiveOption(group, value) {
  const buttons = document.querySelectorAll(`[data-option-group="${group}"]`)

  for (const button of buttons) {
    button.classList.toggle("active", button.dataset.optionValue === value)
  }
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
  })

  const commitColorInput = () => {
    updateCharacterAttributes({ color: colorInput.value }, characterType)
    colorInput.value = gameState.startupConfig.characterAttributes.color
    colorPicker.value = toColorPickerValue(gameState.startupConfig.characterAttributes.color)
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
    updateCharacterAttributes({ [key]: nextValue }, characterType, key)
    syncCharacterStatControls()
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

function updateCharacterAttributes(partialAttributes, characterType, preferredStatKey = null) {
  const mergedAttributes = {
    ...gameState.startupConfig.characterAttributes,
    ...partialAttributes,
  }

  gameState.startupConfig.characterAttributes = normalizeCharacterCustomization(
    mergedAttributes,
    characterType,
    preferredStatKey || Object.keys(partialAttributes)[0] || null,
  )
}

function syncCharacterStatControls() {
  const stats = gameState.startupConfig.characterAttributes
  const statBindings = [
    { key: "health", rangeId: "characterHealthRange", numberId: "characterHealthNumber", valueId: "characterHealthValue" },
    { key: "speed", rangeId: "characterSpeedRange", numberId: "characterSpeedNumber", valueId: "characterSpeedValue" },
    { key: "strength", rangeId: "characterStrengthRange", numberId: "characterStrengthNumber", valueId: "characterStrengthValue" },
  ]

  for (const binding of statBindings) {
    const rangeInput = document.getElementById(binding.rangeId)
    const numberInput = document.getElementById(binding.numberId)
    const valueOutput = document.getElementById(binding.valueId)
    const value = stats[binding.key]

    if (rangeInput) {
      rangeInput.value = String(value)
    }

    if (numberInput) {
      numberInput.value = String(value)
    }

    if (valueOutput) {
      valueOutput.textContent = binding.key === "health" ? String(Math.round(value)) : value.toFixed(1)
    }
  }
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