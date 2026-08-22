// Core game functionality
import {
  PLAYER_SIZE,
  PLAYER_SPEED,
  ROCK_COUNT,
  WOODEN_BOX_COUNT,
  CAR_COUNT,
  BOAT_COUNT,
  WORLD_MAP_SIZE,
  MOBILE_VIEWPORT_SCALE,
  INITIAL_BOMB_COUNT,
  INITIAL_APPLE_COUNT,
} from "./constants.js"
import { setupEventListeners } from "../input/input-handler.js"
import { detectMobile, setupMobileControls } from "../input/mobile-controls.js"
import { generateTerrain } from "../terrain/terrain-generator.js"
import { generateBombs } from "../entities/bombs.js"
import { generateRocks } from "../entities/rocks.js"
import { generateTrees } from "../entities/trees.js"
import { generateEnemies, getInitialEnemySpawnPlan } from "../entities/enemies.js"
import { generateApples } from "../entities/apples.js"
import { generateSledgehammers } from "../entities/sledgehammers.js"
import { generateWoodenBoxes } from "../entities/wooden-boxes.js" // Import wooden boxes generator
import { generateCars } from "../entities/cars.js" // Import cars generator
import { generateBoats } from "../entities/boats.js"
import { updateTimer } from "../ui/ui-manager.js"
import { update } from "./game-loop.js"
import { gameState } from "./game-state.js"
import { createCharacter, normalizeCharacterCustomization } from "../entities/character-factory.js"
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
  return {
    characterType: "default",
    characterAttributes: normalizeCharacterCustomization(),
    startPhase: "day",
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
  gameState.menuMode = "play"
  gameState.isGrabbing = false
  gameState.grabbedBomb = null
  gameState.grabbedRock = null
  gameState.grabbedEnemy = null
  gameState.grabbedWoodenBox = null // Reset grabbed wooden box
  gameState.hasSledgehammer = false
  gameState.isInCar = false // Reset car state
  gameState.drivingCar = null // Reset driving car
  gameState.bombs = []
  gameState.enemies = []
  gameState.apples = []
  gameState.sledgehammers = []
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
    lastHit: 0,
    direction: 0, // Angle in radians
    isMoving: false,
    animationTime: 0,
  })

  // Generate initial terrain
  generateTerrain(normalizedConfig.mapSize)

  // Grow trees across the forest tiles before other props claim the space
  generateTrees()

  // Generate initial wooden boxes
  generateWoodenBoxes(WOODEN_BOX_COUNT)

  // Generate initial bombs
  generateBombs(INITIAL_BOMB_COUNT)

  // Generate initial rocks
  generateRocks(ROCK_COUNT)

  // Generate initial enemies
  generateEnemies(getInitialEnemySpawnPlan(normalizedConfig.startPhase))

  // Generate initial apples
  generateApples(INITIAL_APPLE_COUNT, { spawnNearPlayer: false })

  // Generate sledgehammers
  generateSledgehammers()
  
  // Generate initial cars - one near player, the rest randomly distributed
  generateCars(CAR_COUNT - 1, true); // First parameter is number of cars to place randomly, second parameter true = spawn one near player

  // Generate boats in water
  generateBoats(BOAT_COUNT)

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
  const viewportScale = gameState.isMobile ? MOBILE_VIEWPORT_SCALE : 1

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