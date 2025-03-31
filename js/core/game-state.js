// Central game state object
export const gameState = {
  // Canvas and rendering context
  canvas: null,
  ctx: null,
  gameLoop: null,

  // Game status
  gameOver: false,
  startTime: 0,
  elapsedTime: 0,
  timerInterval: null,
  lastEnemySpawnTime: 0,
  killCount: 0, // Add kill count to track killed enemies

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
  thrownApples: [],
  explosions: [],
  rocks: [],
  woodenBoxes: [], // Added wooden boxes array
  boxDestructionEffects: [], // Added effects for box destruction
  waterDrips: [], // Water drip effects for floating boxes
  cars: [], // Added cars array

  // Interaction state
  isGrabbing: false,
  grabbedBomb: null,
  grabbedRock: null,
  grabbedEnemy: null,
  grabbedWoodenBox: null, // Added for wooden box grabbing
  
  // Car state
  isInCar: false,
  drivingCar: null,
}
