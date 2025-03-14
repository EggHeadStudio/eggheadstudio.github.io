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

  // Interaction state
  isGrabbing: false,
  grabbedBomb: null,
  grabbedRock: null,
}

