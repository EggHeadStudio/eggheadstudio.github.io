import { WORLD_MAP_SIZE } from "./constants.js"

// Central game state object
export const gameState = {
  // Canvas and rendering context
  canvas: null,
  ctx: null,
  gameLoop: null,

  // Game status
  isStarted: false,
  isPaused: false,
  gameOver: false,
  pendingGameOver: false,
  gameOverTimeoutId: null,
  pauseStartedAt: 0,
  menuMode: "start",
  startTime: 0,
  elapsedTime: 0,
  timerInterval: null,
  lastEnemySpawnTime: 0,
  killCount: 0, // Add kill count to track killed enemies

  // Startup configuration
  startupConfig: {
    characterType: "default",
    characterAttributes: {
      color: "#3498db",
      health: 3,
      speed: 4,
      strength: 1,
    },
    startPhase: "day",
    mapSize: WORLD_MAP_SIZE,
  },

  // Environment systems
  dayNight: {
    cycleStartTime: 0,
    startPhase: "day",
    currentPhase: "day",
    phaseProgress: 0,
    displayLabel: "Day",
    lighting: null,
  },

  // Input state
  keys: {},
  mousePosition: { x: 0, y: 0 },
  isMobile: false,

  // Mobile controls
  joystickActive: false,
  joystickAngle: 0,
  joystickDistance: 0,
  joystickOrigin: { x: 0, y: 0 },
  buttonAActive: false,
  buttonBActive: false,

  // Camera
  camera: { x: 0, y: 0 },

  // Game entities
  player: null,
  terrain: [],
  bombs: [],
  enemies: [],
  apples: [],
  sledgehammers: [],
  shovels: [],
  thrownApples: [],
  explosions: [],
  deathEffects: [],
  rocks: [],
  trees: [],
  woodenBoxes: [], // Added wooden boxes array
  boxDestructionEffects: [], // Added effects for box destruction
  waterDrips: [], // Water drip effects for floating boxes
  cars: [], // Added cars array
  boats: [],

  // Interaction state
  isGrabbing: false,
  grabbedBomb: null,
  grabbedRock: null,
  grabbedEnemy: null,
  grabbedWoodenBox: null, // Added for wooden box grabbing
  hasSledgehammer: false,
  hasShovel: false,
  selectedWeapon: "wrist",
  selectedTool: "none",
  dugHoles: {},
  pendingDigTile: null,
  
  // Car state
  isInCar: false,
  drivingCar: null,
}