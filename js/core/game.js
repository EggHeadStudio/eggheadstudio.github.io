// Core game functionality
import {
  PLAYER_SIZE,
  PLAYER_SPEED,
  WORLD_MAP_SIZE,
  MOBILE_VIEWPORT_SCALE,
} from "./constants.js"
import { setupEventListeners } from "../input/input-handler.js"
import { detectMobile, setupMobileControls } from "../input/mobile-controls.js"
import { generateTerrain } from "../terrain/terrain-generator.js"
import { populateWorldAroundPlayer } from "../world/world-population.js"
import { generateTrees } from "../entities/trees.js"
import { generateEnemies, getInitialEnemySpawnPlan } from "../entities/enemies.js"
import { generateSledgehammers } from "../entities/sledgehammers.js"
import { generateShovels } from "../entities/shovels.js"
import { generateSaws } from "../entities/saws.js"
import { generateCars } from "../entities/cars.js" // Import cars generator
import { updateTimer } from "../ui/ui-manager.js"
import { update } from "./game-loop.js"
import { gameState } from "./game-state.js"
import {
  createCharacter,
  isSpecialHeroOnlyMode,
  normalizeCharacterCustomization,
  resolveSpecialCharacterFromUrl,
} from "../entities/character-factory.js"
import { beginPlayerDeathSequence, PLAYER_DEATH_MENU_DELAY } from "../entities/player.js"
import { initializeDayNightCycle } from "./day-night-cycle.js"
import { resetHud, setHudVisibility, updateKillCounter } from "../ui/ui-manager.js"
import { showGameOverMenu } from "../ui/start-menu.js"

const TIMESTAMP_KEYS = new Set([
  "countdown",
  "createdAt",
  "cycleStartTime",
  "directionChangeTime",
  "knockbackTime",
  "lastEnemySpawnTime",
  "lastHit",
  "lastHitTime",
  "pauseStartedAt",
  "startTime",
  "throwingApple",
  "throwStartTime",
])

export function createDefaultGameConfig() {
  const search = typeof window !== "undefined" ? window.location.search : ""
  const hostname = typeof window !== "undefined" ? window.location.hostname : ""
  const specialCharacter = resolveSpecialCharacterFromUrl(search)
  const specialHeroOnlyMode = isSpecialHeroOnlyMode(search, hostname)

  const defaultCharacterType = specialCharacter?.characterType || "default"

  return {
    characterType: defaultCharacterType,
    characterAttributes: normalizeCharacterCustomization(
      specialCharacter?.characterAttributes || {},
      defaultCharacterType,
    ),
    specialHeroId: specialCharacter?.specialHeroId || (specialHeroOnlyMode ? defaultCharacterType : null),
    specialCharacter: specialCharacter?.specialCharacter || null,
    startPhase: "dawn",
    lightweightMode: false,
    mapSize: WORLD_MAP_SIZE,
  }
}

function normalizeGameConfig(config = {}) {
  const mergedConfig = {
    ...createDefaultGameConfig(),
    ...config,
  }

  return {
    ...mergedConfig,
    characterAttributes: normalizeCharacterCustomization(
      mergedConfig.characterAttributes,
      mergedConfig.characterType,
    ),
  }
}

// Initialize the game
export function init(config = gameState.startupConfig) {
  const normalizedConfig = normalizeGameConfig(config)

  if (gameState.gameOverTimeoutId) {
    clearTimeout(gameState.gameOverTimeoutId)
    gameState.gameOverTimeoutId = null
  }

  // Reset all game state
  gameState.isStarted = true
  gameState.isPaused = false
  gameState.gameOver = false
  gameState.pendingGameOver = false
  gameState.pauseStartedAt = 0
  gameState.mapRevealOpen = false
  gameState.discoveredMap = new Map()
  gameState.claimedSections = new Map()
  gameState.selectorModalOpen = false
  gameState.selectorModalType = null
  gameState.menuMode = "play"
  gameState.isGrabbing = false
  gameState.grabbedBomb = null
  gameState.grabbedRock = null
  gameState.grabbedEnemy = null
  gameState.grabbedWoodenBox = null // Reset grabbed wooden box
  gameState.hasSledgehammer = false
  gameState.hasShovel = false
  gameState.hasSaw = false
  gameState.selectedWeapon = "wrist"
  gameState.selectedTool = "none"
  gameState.dugHoles = {}
  gameState.pendingDigTile = null
  gameState.digAnimations = []
  gameState.shovelActionLockUntil = 0
  gameState.isInCar = false // Reset car state
  gameState.drivingCar = null // Reset driving car
  gameState.bombs = []
  gameState.enemies = []
  gameState.apples = []
  gameState.sledgehammers = []
  gameState.shovels = []
  gameState.saws = []
  gameState.thrownApples = []
  gameState.explosions = []
  gameState.deathEffects = []
  gameState.rocks = []
  gameState.trees = []
  gameState.treeDestructionEffects = []
  gameState.woodenBoxes = [] // Initialize wooden boxes array
  gameState.cars = [] // Initialize cars array
  gameState.boats = []
  gameState.enemyCleanupEffects = []
  gameState.boxDestructionEffects = [] // Initialize box destruction effects
  gameState.waterDrips = [] // Initialize water drips for floating boxes
  gameState.keys = {}
  gameState.mousePosition = { x: 0, y: 0 }
  gameState.joystickActive = false
  gameState.joystickAngle = 0
  gameState.joystickDistance = 0
  gameState.buttonAActive = false
  gameState.buttonBActive = false
  gameState.buttonCActive = false
  gameState.killCount = 0 // Reset kill count when starting a new game
  gameState.startupConfig = normalizedConfig
  gameState.dayNight = {
    cycleStartTime: Date.now(),
    startPhase: normalizedConfig.startPhase,
    currentPhase: normalizedConfig.startPhase,
    phaseProgress: 0,
    displayLabel: normalizedConfig.startPhase.charAt(0).toUpperCase() + normalizedConfig.startPhase.slice(1),
    lighting: null,
  }

  // Cancel any existing game loop
  if (gameState.gameLoop) {
    cancelAnimationFrame(gameState.gameLoop)
    gameState.gameLoop = null
  }

  gameState.canvas = document.getElementById("gameCanvas")
  gameState.ctx = gameState.canvas.getContext("2d")
  gameState.isMobile = Boolean(detectMobile())
  gameState.lightweightMode = Boolean(normalizedConfig.lightweightMode)

  const mapPage = document.getElementById("explorationMapPage")
  if (mapPage) {
    mapPage.classList.add("hidden")
  }

  // Set canvas size to match container
  resizeCanvas()

  // Only add resize listener once
  if (!window.hasResizeListener) {
    window.addEventListener("resize", resizeCanvas)
    window.hasResizeListener = true
  }

  // Initialize player using character factory
  gameState.player = createCharacter(normalizedConfig.characterType, {
    ...normalizedConfig.characterAttributes,
    x: gameState.canvas.width / 2,
    y: gameState.canvas.height / 2,
    apples: 0,
    bombs: 0,
    lastHit: 0,
    direction: 0, // Angle in radians
    isMoving: false,
    animationTime: 0,
  })

  // Generate initial terrain
  generateTerrain(normalizedConfig.mapSize)

  // Populate trees in the loaded chunks before anything else is placed, so
  // crates and rocks know where the forests are.
  generateTrees()

  // Fill the chunks around the player with rocks, crates, apples, bombs,
  // vehicles and the occasional tool. Every chunk the player walks into later
  // is stocked the same way, so the world never runs out of content.
  populateWorldAroundPlayer()

  // Generate initial enemies
  generateEnemies(getInitialEnemySpawnPlan(normalizedConfig.startPhase))

  // Place one starter tool of each kind within reach of the player
  generateSledgehammers(1)
  generateShovels(1)
  generateSaws(1)

  // One car parked near the player to get going with
  generateCars(1, true)

  // Set up event listeners
  setupEventListeners()

  setHudVisibility(true)
  resetHud()

  gameState.mousePosition = {
    x: gameState.canvas.width / 2,
    y: gameState.canvas.height / 2,
  }

  setupMobileControls()
  initializeDayNightCycle(normalizedConfig.startPhase)

  // Initialize last enemy spawn time
  gameState.lastEnemySpawnTime = Date.now()

  // Initialize timer
  gameState.startTime = Date.now()
  gameState.elapsedTime = 0
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval)
  }
  gameState.timerInterval = setInterval(updateTimer, 1000)

  // Initialize kill counter display
  updateKillCounter()

  // Start game loop
  gameState.gameLoop = requestAnimationFrame(update)
}

export function pauseCurrentGame() {
  if (!gameState.isStarted || gameState.gameOver || gameState.isPaused) {
    return false
  }

  gameState.isPaused = true
  gameState.pauseStartedAt = Date.now()
  gameState.keys = {}
  gameState.joystickActive = false
  gameState.joystickDistance = 0
  gameState.buttonAActive = false
  gameState.buttonBActive = false
  gameState.buttonCActive = false

  if (gameState.gameLoop) {
    cancelAnimationFrame(gameState.gameLoop)
    gameState.gameLoop = null
  }

  return true
}

export function resumeCurrentGame() {
  if (!gameState.isStarted || !gameState.isPaused || gameState.gameOver) {
    return false
  }

  const pausedDuration = Date.now() - gameState.pauseStartedAt
  shiftGameTimestamps(gameState, pausedDuration)
  gameState.isPaused = false
  gameState.pauseStartedAt = 0

  if (!gameState.gameLoop) {
    gameState.gameLoop = requestAnimationFrame(update)
  }

  return true
}

export function triggerGameOver() {
  if (gameState.gameOver) {
    return
  }

  if (gameState.player?.health <= 0) {
    beginPlayerDeathSequence()

    if (gameState.pendingGameOver) {
      return
    }

    gameState.pendingGameOver = true
    gameState.keys = {}
    gameState.joystickActive = false
    gameState.joystickDistance = 0
    gameState.buttonAActive = false
    gameState.buttonBActive = false
    gameState.buttonCActive = false
    gameState.gameOverTimeoutId = setTimeout(() => {
      if (!gameState.isStarted || gameState.gameOver) {
        return
      }

      finalizeGameOver()
    }, PLAYER_DEATH_MENU_DELAY)
    return
  }

  finalizeGameOver()
}

function finalizeGameOver() {
  if (gameState.gameOver) {
    return
  }

  gameState.gameOver = true
  gameState.pendingGameOver = false
  gameState.gameOverTimeoutId = null
  gameState.isPaused = true
  gameState.pauseStartedAt = 0
  gameState.menuMode = "gameover"
  gameState.keys = {}
  gameState.joystickActive = false
  gameState.joystickDistance = 0
  gameState.buttonAActive = false
  gameState.buttonBActive = false
  gameState.buttonCActive = false

  if (gameState.gameLoop) {
    cancelAnimationFrame(gameState.gameLoop)
    gameState.gameLoop = null
  }

  showGameOverMenu()
}

// Resize canvas to fit container
export function resizeCanvas() {
  if (!gameState.canvas) {
    return
  }

  const container = gameState.canvas.parentElement
  const viewportScale = gameState.isMobile ? MOBILE_VIEWPORT_SCALE : gameState.lightweightMode ? 0.85 : 1

  gameState.canvas.style.width = `${container.clientWidth}px`
  gameState.canvas.style.height = `${container.clientHeight}px`
  gameState.canvas.width = Math.floor(container.clientWidth * viewportScale)
  gameState.canvas.height = Math.floor(container.clientHeight * viewportScale)
}

function shiftGameTimestamps(value, delta, visited = new WeakSet()) {
  if (!value || delta <= 0) {
    return
  }

  if (typeof value !== "object") {
    return
  }

  if (visited.has(value)) {
    return
  }

  visited.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      shiftGameTimestamps(item, delta, visited)
    }
    return
  }

  for (const [key, currentValue] of Object.entries(value)) {
    if (TIMESTAMP_KEYS.has(key) && typeof currentValue === "number" && currentValue > 0) {
      value[key] += delta
      continue
    }

    if (currentValue && typeof currentValue === "object") {
      shiftGameTimestamps(currentValue, delta, visited)
    }
  }
}