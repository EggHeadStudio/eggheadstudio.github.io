// Core game functionality
import { PLAYER_SIZE, PLAYER_SPEED, ROCK_COUNT } from "./constants.js"
import { setupEventListeners } from "../input/input-handler.js"
import { setupMobileControls } from "../input/mobile-controls.js"
import { generateTerrain } from "../terrain/terrain-generator.js"
import { generateBombs } from "../entities/bombs.js"
import { generateRocks } from "../entities/rocks.js"
import { generateEnemies } from "../entities/enemies.js"
import { generateApples } from "../entities/apples.js"
import { updateTimer } from "../ui/ui-manager.js"
import { update } from "./game-loop.js"
import { gameState } from "./game-state.js"
import { createCharacter } from "../entities/character-factory.js"

// Function to detect if the device is mobile
function detectMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// Initialize the game
export function init() {
  // Reset all game state
  gameState.gameOver = false
  gameState.isGrabbing = false
  gameState.grabbedBomb = null
  gameState.grabbedRock = null
  gameState.grabbedEnemy = null // Ensure this is reset on game restart
  gameState.bombs = []
  gameState.enemies = []
  gameState.apples = []
  gameState.thrownApples = []
  gameState.explosions = []
  gameState.rocks = []
  gameState.keys = {}
  gameState.mousePosition = { x: 0, y: 0 }
  gameState.joystickActive = false
  gameState.joystickAngle = 0
  gameState.joystickDistance = 0

  // Check if device is mobile
  gameState.isMobile = detectMobile()

  // Set camera zoom based on device type
  gameState.camera = {
    x: 0,
    y: 0,
    zoom: gameState.isMobile ? 0.7 : 1.0, // Zoom out on mobile devices
  }

  // Cancel any existing game loop
  if (gameState.gameLoop) {
    cancelAnimationFrame(gameState.gameLoop)
    gameState.gameLoop = null
  }

  gameState.canvas = document.getElementById("gameCanvas")
  gameState.ctx = gameState.canvas.getContext("2d")

  // Set canvas size to match container
  resizeCanvas()

  // Only add resize listener once
  if (!window.hasResizeListener) {
    window.addEventListener("resize", resizeCanvas)
    window.hasResizeListener = true
  }

  // Initialize player using character factory
  gameState.player = createCharacter("default", {
    x: gameState.canvas.width / 2,
    y: gameState.canvas.height / 2,
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 3,
    apples: 0,
    lastHit: 0,
    direction: 0, // Angle in radians
    color: "#3498db",
    isMoving: false,
    animationTime: 0,
    strength: 1.0, // Default strength for picking up objects
  })

  // Generate initial terrain
  generateTerrain()

  // Generate initial bombs
  generateBombs(25)

  // Generate initial rocks
  generateRocks(ROCK_COUNT)

  // Generate initial enemies
  generateEnemies(10)

  // Generate initial apples
  generateApples(40)

  // Set up event listeners
  setupEventListeners()

  // Reset game over screen
  document.getElementById("gameOver").classList.remove("active")

  setupMobileControls()

  // Initialize last enemy spawn time
  gameState.lastEnemySpawnTime = Date.now()

  // Initialize timer
  gameState.startTime = Date.now()
  gameState.elapsedTime = 0
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval)
  }
  gameState.timerInterval = setInterval(updateTimer, 1000)

  // Start game loop
  gameState.gameLoop = requestAnimationFrame(update)
}

// Resize canvas to fit container
export function resizeCanvas() {
  const container = gameState.canvas.parentElement
  gameState.canvas.width = container.clientWidth
  gameState.canvas.height = container.clientHeight
}
