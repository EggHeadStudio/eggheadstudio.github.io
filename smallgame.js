// Game constants
const TILE_SIZE = 40
const PLAYER_SIZE = 30
const BOMB_SIZE = 45
const APPLE_SIZE = 15
const ENEMY_SIZE = 35
const PLAYER_SPEED = 4
const ENEMY_SPEED = 2
const ENEMY_CHASE_SPEED = 3
const APPLE_THROW_SPEED = 8
const TERRAIN_TYPES = {
  WATER: 0,
  GRASS: 1,
  FOREST: 2,
  DIRT: 3,
}

// Add rock constants after the existing game constants
const ROCK_SIZE = 50 // Slightly larger than bombs
const ROCK_COUNT = 100 // Initial number of rocks

// Game state
let canvas, ctx
let gameLoop
let player
let terrain = []
let bombs = []
let enemies = []
let apples = []
let thrownApples = []
let explosions = []
const camera = { x: 0, y: 0 }
let keys = {}
let mousePosition = { x: 0, y: 0 }
let isGrabbing = false
let grabbedBomb = null
// Add grabbedRock to the game state variables after grabbedBomb
let grabbedRock = null
// Add rocks array to the game state variables
let rocks = []
let gameOver = false
let isMobile = false
let joystickActive = false
let joystickAngle = 0
let joystickDistance = 0
let joystickOrigin = { x: 0, y: 0 }
const joystickPosition = { x: 0, y: 0 }
let buttonAActive = false
let buttonBActive = false
let lastEnemySpawnTime = 0
let startTime = 0
let elapsedTime = 0
let timerInterval = null
let keyboardListenersSet = false
let mouseListenersSet = false
let restartButtonListenerSet = false

// Modify the init function to reset rocks and grabbedRock
function init() {
  // Reset all game state
  gameOver = false
  isGrabbing = false
  grabbedBomb = null
  grabbedRock = null
  bombs = []
  enemies = []
  apples = []
  thrownApples = []
  explosions = []
  rocks = []
  keys = {}
  mousePosition = { x: 0, y: 0 }
  joystickActive = false
  joystickAngle = 0
  joystickDistance = 0

  // Cancel any existing game loop
  if (gameLoop) {
    cancelAnimationFrame(gameLoop)
    gameLoop = null
  }

  canvas = document.getElementById("gameCanvas")
  ctx = canvas.getContext("2d")

  // Set canvas size to match container
  resizeCanvas()

  // Only add resize listener once
  if (!window.hasResizeListener) {
    window.addEventListener("resize", resizeCanvas)
    window.hasResizeListener = true
  }

  // Initialize player
  player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 3,
    apples: 0,
    lastHit: 0,
    direction: 0, // Angle in radians
    color: "#3498db",
  }

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
  lastEnemySpawnTime = Date.now()

  // Initialize timer
  startTime = Date.now()
  elapsedTime = 0
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  timerInterval = setInterval(updateTimer, 1000)

  // Start game loop
  gameLoop = requestAnimationFrame(update)
}

// Resize canvas to fit container
function resizeCanvas() {
  const container = canvas.parentElement
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
}

// Set up event listeners for keyboard and mouse
function setupEventListeners() {
  // Remove existing keyboard listeners to prevent duplicates
  if (keyboardListenersSet) {
    window.removeEventListener("keydown", handleKeyDown)
    window.removeEventListener("keyup", handleKeyUp)
  }

  // Keyboard events
  window.addEventListener("keydown", handleKeyDown)
  window.addEventListener("keyup", handleKeyUp)
  keyboardListenersSet = true

  // Remove existing mouse listeners to prevent duplicates
  if (mouseListenersSet) {
    canvas.removeEventListener("mousemove", handleMouseMove)
    canvas.removeEventListener("mousedown", handleMouseDown)
  }

  // Mouse events
  canvas.addEventListener("mousemove", handleMouseMove)
  canvas.addEventListener("mousedown", handleMouseDown)
  mouseListenersSet = true

  // Restart button
  const restartButton = document.getElementById("restartButton")
  if (restartButtonListenerSet) {
    restartButton.removeEventListener("click", restartGame)
  }
  restartButton.addEventListener("click", restartGame)
  restartButtonListenerSet = true
}

// Handle keyboard input
function handleKeyDown(e) {
  keys[e.key] = true

  // Space bar for grabbing/releasing bombs or rocks, or detonating bombs
  if (e.key === " ") {
    if (isGrabbing) {
      // If holding something, release it
      if (grabbedBomb) {
        releaseBomb()
      } else if (grabbedRock) {
        releaseRock()
      }
    } else {
      // If not holding anything, try to detonate a bomb with countdown
      if (!detonateAnyBombWithCountdown()) {
        // If no bomb to detonate, try to grab a bomb
        if (!tryGrabBomb()) {
          // If no bomb to grab, try to grab a rock
          tryGrabRock()
        }
      }
    }
    // Prevent space from scrolling the page
    e.preventDefault()
  }
}

// Handle keyboard key release
function handleKeyUp(e) {
  keys[e.key] = false
}

// Handle mouse movement
function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect()
  mousePosition.x = e.clientX - rect.left
  mousePosition.y = e.clientY - rect.top
}

// Handle mouse clicks
function handleMouseDown(e) {
  if (e.button === 0) {
    // Left mouse button
    throwApple()
  }
}

// Restart the game
function restartGame() {
  // Make sure to cancel the current game loop
  if (gameLoop) {
    cancelAnimationFrame(gameLoop)
    gameLoop = null
  }

  // Reset game state and start a new game
  init()

  // Reset timer
  startTime = Date.now()
  elapsedTime = 0
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  timerInterval = setInterval(updateTimer, 1000)
}

function setupMobileControls() {
  if (!detectMobile()) return

  isMobile = true
  document.querySelector(".mobile-controls").style.display = "block"

  // Check orientation
  checkOrientation()

  // Only add orientation listener once
  if (!window.hasOrientationListener) {
    window.addEventListener("resize", checkOrientation)
    window.hasOrientationListener = true
  }

  // Dismiss warning button - only set once
  if (!window.hasDismissWarningListener) {
    document.getElementById("dismissWarning").addEventListener("click", () => {
      document.querySelector(".portrait-warning").style.display = "none"
    })
    window.hasDismissWarningListener = true
  }

  const joystickContainer = document.querySelector(".joystick-container")
  const joystickKnob = document.querySelector(".joystick-knob")
  const buttonA = document.querySelector(".button-a")
  const buttonB = document.querySelector(".button-b")

  // Get joystick container position
  const joystickRect = joystickContainer.getBoundingClientRect()
  joystickOrigin = {
    x: joystickRect.left + joystickRect.width / 2,
    y: joystickRect.top + joystickRect.height / 2,
  }

  // Remove existing touch listeners to prevent duplicates
  joystickContainer.removeEventListener("touchstart", handleJoystickStart)
  document.removeEventListener("touchmove", handleJoystickMove)
  document.removeEventListener("touchend", handleJoystickEnd)
  buttonA.removeEventListener("touchstart", handleButtonAStart)
  buttonA.removeEventListener("touchend", handleButtonAEnd)
  buttonB.removeEventListener("touchstart", handleButtonBStart)
  buttonB.removeEventListener("touchend", handleButtonBEnd)

  // Joystick touch events
  joystickContainer.addEventListener("touchstart", handleJoystickStart)
  document.addEventListener("touchmove", handleJoystickMove)
  document.addEventListener("touchend", handleJoystickEnd)

  // Button A (grab/release) touch events
  buttonA.addEventListener("touchstart", handleButtonAStart)
  buttonA.addEventListener("touchend", handleButtonAEnd)

  // Button B (throw apple or detonate bomb) touch events
  buttonB.addEventListener("touchstart", handleButtonBStart)
  buttonB.addEventListener("touchend", handleButtonBEnd)
}

// Joystick handlers
function handleJoystickStart(e) {
  e.preventDefault()
  joystickActive = true
  updateJoystickPosition(e.touches[0])
}

function handleJoystickMove(e) {
  if (joystickActive) {
    e.preventDefault()
    updateJoystickPosition(e.touches[0])
  }
}

// Fix the handleJoystickEnd function to only reset joystick when all touches are gone
function handleJoystickEnd(e) {
  // Only reset joystick if all touches are gone or if the specific touch for the joystick is gone
  let joystickTouchFound = false

  // Check if any of the remaining touches are for the joystick
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i]
    const joystickContainer = document.querySelector(".joystick-container")
    const rect = joystickContainer.getBoundingClientRect()

    // Check if this touch is within the joystick container
    if (
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom
    ) {
      joystickTouchFound = true
      break
    }
  }

  // Only deactivate joystick if no joystick touches remain
  if (!joystickTouchFound) {
    joystickActive = false
    const joystickKnob = document.querySelector(".joystick-knob")
    joystickKnob.style.transform = "translate(-50%, -50%)"
    joystickAngle = 0
    joystickDistance = 0
  }
}

// Button A handlers
function handleButtonAStart(e) {
  // Only stop propagation, don't prevent default to allow joystick to work simultaneously
  e.stopPropagation()

  buttonAActive = true
  e.target.classList.add("button-active")

  // Trigger grab/release action
  if (isGrabbing) {
    // If holding something, release it
    if (grabbedBomb) {
      releaseBomb()
    } else if (grabbedRock) {
      releaseRock()
    }
  } else {
    // If not holding anything, try to grab a bomb
    if (!tryGrabBomb()) {
      // If no bomb to grab, try to grab a rock
      tryGrabRock()
    }
  }
}

// Button B handlers
function handleButtonBStart(e) {
  // Only stop propagation, don't prevent default to allow joystick to work simultaneously
  e.stopPropagation()

  buttonBActive = true
  e.target.classList.add("button-active")

  // First try to detonate any bomb with countdown
  if (!detonateAnyBombWithCountdown()) {
    // If no bomb to detonate, throw an apple
    throwApple()
  }
}

function handleButtonBEnd(e) {
  buttonBActive = false
  e.target.classList.remove("button-active")
}

// Update joystick position and calculate angle/distance
function updateJoystickPosition(touch) {
  const joystickContainer = document.querySelector(".joystick-container")
  const joystickKnob = document.querySelector(".joystick-knob")
  const containerRect = joystickContainer.getBoundingClientRect()

  joystickOrigin = {
    x: containerRect.left + containerRect.width / 2,
    y: containerRect.top + containerRect.height / 2,
  }

  const touchX = touch.clientX
  const touchY = touch.clientY

  // Calculate distance from center
  const deltaX = touchX - joystickOrigin.x
  const deltaY = touchY - joystickOrigin.y
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  // Limit distance to joystick radius
  const maxDistance = containerRect.width / 2
  const limitedDistance = Math.min(distance, maxDistance)

  // Calculate angle
  joystickAngle = Math.atan2(deltaY, deltaX)
  joystickDistance = limitedDistance / maxDistance // Normalize to 0-1

  // Calculate limited position
  const limitedX = Math.cos(joystickAngle) * limitedDistance
  const limitedY = Math.sin(joystickAngle) * limitedDistance

  // Update knob position with proper centering
  // First translate to center, then apply the offset
  joystickKnob.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`
}

function checkOrientation() {
  if (window.innerHeight > window.innerWidth) {
    // Portrait mode is correct
    document.querySelector(".portrait-warning").style.display = "none"
  } else {
    // Landscape mode - show warning
    document.querySelector(".portrait-warning").style.display = "flex"
  }
}

function detectMobile() {
  return (
    navigator.userAgent.match(/Android/i) ||
    navigator.userAgent.match(/webOS/i) ||
    navigator.userAgent.match(/iPhone/i) ||
    navigator.userAgent.match(/iPad/i) ||
    navigator.userAgent.match(/iPod/i) ||
    navigator.userAgent.match(/BlackBerry/i) ||
    navigator.userAgent.match(/Windows Phone/i)
  )
}

// Generate procedural terrain
function generateTerrain() {
  const mapSize = 200 // Much larger map size
  terrain = []

  // First pass: Generate basic terrain with improved water distribution
  for (let y = 0; y < mapSize; y++) {
    terrain[y] = []
    for (let x = 0; x < mapSize; x++) {
      // Use a different noise approach for more consistent water bodies
      const nx = x / mapSize - 0.5
      const ny = y / mapSize - 0.5

      // Create larger coherent patterns
      const noise1 = Math.sin(nx * 6) * Math.cos(ny * 6)
      const noise2 = Math.sin((nx + ny) * 8) * 0.3
      const noise3 = Math.cos((nx - ny) * 7) * 0.2
      const noise = noise1 + noise2 + noise3

      // Assign terrain types with thresholds that create fewer, more coherent water bodies
      if (noise < -0.6) {
        terrain[y][x] = TERRAIN_TYPES.WATER
      } else if (noise < 0.2) {
        terrain[y][x] = TERRAIN_TYPES.GRASS
      } else {
        terrain[y][x] = TERRAIN_TYPES.FOREST
      }
    }
  }

  // Second pass: Clean up water bodies to make them more consistent
  for (let y = 1; y < mapSize - 1; y++) {
    for (let x = 1; x < mapSize - 1; x++) {
      // If this is water, check surroundings
      if (terrain[y][x] === TERRAIN_TYPES.WATER) {
        // Count water neighbors (8-way)
        let waterNeighbors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            if (terrain[y + dy][x + dx] === TERRAIN_TYPES.WATER) {
              waterNeighbors++
            }
          }
        }

        // If isolated water or nearly isolated, convert to land
        if (waterNeighbors <= 2) {
          terrain[y][x] = TERRAIN_TYPES.GRASS
        }
      }
      // If this is land, but surrounded by water, consider making it water
      else if (terrain[y][x] !== TERRAIN_TYPES.WATER) {
        let waterNeighbors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            if (terrain[y + dy][x + dx] === TERRAIN_TYPES.WATER) {
              waterNeighbors++
            }
          }
        }

        // If mostly surrounded by water, convert to water
        if (waterNeighbors >= 6) {
          terrain[y][x] = TERRAIN_TYPES.WATER
        }
      }
    }
  }

  // Place player in a safe starting position
  let safeStart = false
  while (!safeStart) {
    const startX = Math.floor(mapSize / 2) + Math.floor(Math.random() * 20) - 10
    const startY = Math.floor(mapSize / 2) + Math.floor(Math.random() * 20) - 10

    if (terrain[startY][startX] !== TERRAIN_TYPES.WATER) {
      player.x = startX * TILE_SIZE + TILE_SIZE / 2
      player.y = startY * TILE_SIZE + TILE_SIZE / 2
      safeStart = true
    }
  }
}

// Generate bombs
function generateBombs(count) {
  for (let i = 0; i < count; i++) {
    const bomb = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
      size: BOMB_SIZE,
      color: getRandomColor(),
      countdown: null,
      exploding: false,
    }

    // Ensure bomb is not on water
    const tileX = Math.floor(bomb.x / TILE_SIZE)
    const tileY = Math.floor(bomb.y / TILE_SIZE)
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
    ) {
      bombs.push(bomb)
    } else {
      i-- // Try again
    }
  }
}

// Add this new function for generating rocks
function generateRocks(count) {
  for (let i = 0; i < count; i++) {
    const rock = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
      size: ROCK_SIZE,
      texture: Math.floor(Math.random() * 3), // 0, 1, or 2 for different rock textures
      rotation: Math.random() * Math.PI * 2, // Random rotation for variety
    }

    // Ensure rock is not on water and not overlapping with other objects
    const tileX = Math.floor(rock.x / TILE_SIZE)
    const tileY = Math.floor(rock.y / TILE_SIZE)

    let validPosition = false
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
    ) {
      // Check for overlap with other rocks
      validPosition = true
      for (const otherRock of rocks) {
        if (getDistance(rock.x, rock.y, otherRock.x, otherRock.y) < rock.size + otherRock.size) {
          validPosition = false
          break
        }
      }

      // Check for overlap with bombs
      if (validPosition) {
        for (const bomb of bombs) {
          if (getDistance(rock.x, rock.y, bomb.x, bomb.y) < rock.size + bomb.size) {
            validPosition = false
            break
          }
        }
      }

      // Check for overlap with apples
      if (validPosition) {
        for (const apple of apples) {
          if (getDistance(rock.x, rock.y, apple.x, apple.y) < rock.size + apple.size * 2) {
            validPosition = false
            break
          }
        }
      }

      // Check for overlap with enemies
      if (validPosition) {
        for (const enemy of enemies) {
          if (getDistance(rock.x, rock.y, enemy.x, enemy.y) < rock.size + enemy.size * 2) {
            validPosition = false
            break
          }
        }
      }

      // Check if too close to player
      if (validPosition) {
        if (getDistance(rock.x, rock.y, player.x, player.y) < rock.size + player.size + 100) {
          validPosition = false
        }
      }
    } else {
      validPosition = false
    }

    if (validPosition) {
      rocks.push(rock)
    } else {
      i-- // Try again
    }
  }
}

// Generate enemies
function generateEnemies(count) {
  for (let i = 0; i < count; i++) {
    const enemy = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
      size: ENEMY_SIZE,
      speed: ENEMY_SPEED,
      direction: Math.random() * Math.PI * 2,
      color: "#e74c3c",
      directionChangeTime: 0,
      isChasing: false,
    }

    // Ensure enemy is not on water and not too close to player
    const tileX = Math.floor(enemy.x / TILE_SIZE)
    const tileY = Math.floor(enemy.y / TILE_SIZE)
    const distanceToPlayer = getDistance(player.x, player.y, enemy.x, enemy.y)

    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER &&
      distanceToPlayer > 300
    ) {
      enemies.push(enemy)
    } else {
      i-- // Try again
    }
  }
}

// Generate apples
function generateApples(count) {
  for (let i = 0; i < count; i++) {
    // Generate apples closer to the player's position
    const maxDistance = 1500 // Maximum distance from player
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * maxDistance

    const apple = {
      x: player.x + Math.cos(angle) * distance,
      y: player.y + Math.sin(angle) * distance,
      size: APPLE_SIZE,
      color: "#e74c3c",
    }

    // Ensure apple is not on water
    const tileX = Math.floor(apple.x / TILE_SIZE)
    const tileY = Math.floor(apple.y / TILE_SIZE)
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
    ) {
      apples.push(apple)
    } else {
      i-- // Try again
    }
  }
}

// Try to grab a bomb
function tryGrabBomb() {
  for (let i = 0; i < bombs.length; i++) {
    const bomb = bombs[i]

    // Skip bombs that are counting down
    if (bomb.countdown !== null) continue

    const distance = getDistance(player.x, player.y, bomb.x, bomb.y)

    if (distance < player.size + bomb.size) {
      isGrabbing = true
      grabbedBomb = bomb
      bombs.splice(i, 1) // Remove from bombs array
      return true
    }
  }
  return false
}

// Add a function to try grabbing a rock
function tryGrabRock() {
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i]
    const distance = getDistance(player.x, player.y, rock.x, rock.y)

    if (distance < player.size + rock.size) {
      isGrabbing = true
      grabbedRock = rock
      rocks.splice(i, 1) // Remove from rocks array
      return true
    }
  }
  return false
}

// Detonate any bomb that has a countdown
function detonateAnyBombWithCountdown() {
  for (let i = 0; i < bombs.length; i++) {
    const bomb = bombs[i]

    // Only consider bombs that are counting down
    if (bomb.countdown !== null) {
      // Detonate the bomb immediately
      const explosionRadius = 100 + Math.random() * 50
      createExplosion(bomb.x, bomb.y, explosionRadius)
      bombs.splice(i, 1)
      return true
    }
  }
  return false
}

// Release a grabbed bomb
function releaseBomb() {
  if (grabbedBomb) {
    // Start countdown when released
    grabbedBomb.countdown = Date.now() + 3000 // 3 seconds
    bombs.push(grabbedBomb)
    grabbedBomb = null
    isGrabbing = false
    return true
  }
  return false
}

// Add a function to release a grabbed rock
function releaseRock() {
  if (grabbedRock) {
    // Calculate position in front of player based on facing direction
    const throwDistance = player.size * 3.5 // Half a player size away
    const newX = player.x + Math.cos(player.direction) * throwDistance
    const newY = player.y + Math.sin(player.direction) * throwDistance

    // Update rock position before releasing
    grabbedRock.x = newX
    grabbedRock.y = newY

    rocks.push(grabbedRock)
    grabbedRock = null
    isGrabbing = false
    return true
  }
  return false
}

// Create explosion
function createExplosion(x, y, radius) {
  // Create explosion object with larger radius
  const explosionRadius = radius * 2 + Math.random() * 100 // Much larger and more random radius

  const explosion = {
    x: x,
    y: y,
    radius: explosionRadius,
    maxRadius: explosionRadius,
    currentRadius: 0,
    particles: [],
    startTime: Date.now(),
    duration: 1000, // 1 second explosion animation
    color: "#ff9500",
  }

  // Create explosion particles
  const particleCount = 50 // More particles for bigger explosion
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 5 // Faster particles
    const size = 5 + Math.random() * 15 // Larger particles
    const life = 500 + Math.random() * 800 // Longer life

    explosion.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: size,
      life: life,
      maxLife: life,
      color: getExplosionParticleColor(),
    })
  }

  explosions.push(explosion)

  // Modify terrain in explosion radius
  modifyTerrainInRadius(x, y, explosionRadius)

  // Check for enemies in explosion radius
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i]
    const distance = getDistance(x, y, enemy.x, enemy.y)

    if (distance < explosionRadius) {
      enemies.splice(i, 1)
    }
  }

  // Check if player is in explosion radius
  const distanceToPlayer = getDistance(x, y, player.x, player.y)
  if (distanceToPlayer < explosionRadius) {
    player.health = 0
    updateHealthDisplay()
    gameOver = true
    document.getElementById("gameOver").classList.add("active")
  }
}

// Modify terrain in explosion radius
function modifyTerrainInRadius(centerX, centerY, radius) {
  const tileRadius = Math.ceil(radius / TILE_SIZE)
  const centerTileX = Math.floor(centerX / TILE_SIZE)
  const centerTileY = Math.floor(centerY / TILE_SIZE)

  for (let y = centerTileY - tileRadius; y <= centerTileY + tileRadius; y++) {
    for (let x = centerTileX - tileRadius; x <= centerTileX + tileRadius; x++) {
      if (x >= 0 && x < terrain[0].length && y >= 0 && y < terrain.length) {
        // Check if point is within circular radius
        const tileX = x * TILE_SIZE + TILE_SIZE / 2
        const tileY = y * TILE_SIZE + TILE_SIZE / 2
        const distance = getDistance(centerX, centerY, tileX, tileY)

        if (distance <= radius) {
          // Convert terrain to dirt
          terrain[y][x] = TERRAIN_TYPES.DIRT
        }
      }
    }
  }
}

// Get random explosion particle color
function getExplosionParticleColor() {
  const colors = [
    "#ff9500", // Orange
    "#ff5e3a", // Red-orange
    "#ffcc00", // Yellow
    "#ff3b30", // Red
    "#ffffff", // White
  ]

  return colors[Math.floor(Math.random() * colors.length)]
}

// Throw an apple
function throwApple() {
  if (player.apples > 0) {
    let angle

    if (isMobile) {
      // Use player's current direction on mobile
      angle = player.direction
    } else {
      // Use mouse position on desktop
      angle = Math.atan2(mousePosition.y - canvas.height / 2, mousePosition.x - canvas.width / 2)
    }

    thrownApples.push({
      x: player.x,
      y: player.y,
      size: APPLE_SIZE,
      color: "#e74c3c",
      velocityX: Math.cos(angle) * APPLE_THROW_SPEED,
      velocityY: Math.sin(angle) * APPLE_THROW_SPEED,
    })

    // Ensure we only decrement the apple count once
    player.apples--
    updateAppleCounter()
    return true
  }
  return false
}

// Update apple counter in UI
function updateAppleCounter() {
  document.getElementById("appleCount").textContent = player.apples
}

// Update health display in UI
function updateHealthDisplay() {
  const hearts = document.querySelectorAll(".heart")
  for (let i = 0; i < hearts.length; i++) {
    if (i < player.health) {
      hearts[i].style.opacity = "1"
    } else {
      hearts[i].style.opacity = "0.3"
    }
  }
}

// Main game update loop
function update() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!gameOver) {
    if (isMobile) {
      const joystickContainer = document.querySelector(".joystick-container")
      const containerRect = joystickContainer.getBoundingClientRect()
      joystickOrigin = {
        x: containerRect.left + containerRect.width / 2,
        y: containerRect.top + containerRect.height / 2,
      }
    }

    // Update player direction based on mouse position
    if (isMobile && joystickActive && joystickDistance > 0.1) {
      player.direction = joystickAngle
    } else {
      player.direction = Math.atan2(mousePosition.y - canvas.height / 2, mousePosition.x - canvas.width / 2)
    }

    // Update player position based on keyboard input
    updatePlayerPosition()

    // Update camera position
    camera.x = player.x - canvas.width / 2
    camera.y = player.y - canvas.height / 2

    // Spawn new enemies
    spawnEnemies()

    // Generate more apples as needed
    maintainGameElements()

    // Check for collisions
    checkCollisions()
  }

  // Draw terrain
  drawTerrain()

  // Draw and update rocks
  drawAndUpdateRocks()

  // Draw and update apples
  drawAndUpdateApples()

  // Draw and update bombs
  drawAndUpdateBombs()

  // Draw and update enemies
  drawAndUpdateEnemies()

  // Draw and update thrown apples
  drawAndUpdateThrownApples()

  // Draw and update explosions
  drawAndUpdateExplosions()

  // Draw player
  drawPlayer()

  // Continue game loop
  gameLoop = requestAnimationFrame(update)
}

// Spawn new enemies more frequently
function spawnEnemies() {
  const currentTime = Date.now()

  if (currentTime - lastEnemySpawnTime > 2000) {
    // 2 seconds instead of 5
    generateEnemies(3) // Spawn 3 enemies at once instead of 1
    lastEnemySpawnTime = currentTime
  }
}

// Update player position based on keyboard input
function updatePlayerPosition() {
  let dx = 0
  let dy = 0

  if (isMobile && joystickActive) {
    // Use joystick input
    dx = Math.cos(joystickAngle) * joystickDistance
    dy = Math.sin(joystickAngle) * joystickDistance
  } else {
    // Use keyboard input
    if (keys["ArrowUp"] || keys["w"]) dy -= 1
    if (keys["ArrowDown"] || keys["s"]) dy += 1
    if (keys["ArrowLeft"] || keys["a"]) dx -= 1
    if (keys["ArrowRight"] || keys["d"]) dx += 1

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy)
      dx /= length
      dy /= length
    }
  }

  // Apply speed (reduced if grabbing a bomb or rock)
  const currentSpeed = isGrabbing ? player.speed / 2 : player.speed
  dx *= currentSpeed
  dy *= currentSpeed

  // Check if new position would be on water or collide with a rock
  const newX = player.x + dx
  const newY = player.y + dy
  const tileX = Math.floor(newX / TILE_SIZE)
  const tileY = Math.floor(newY / TILE_SIZE)

  let canMove = true

  // Check terrain
  if (tileX >= 0 && tileX < terrain[0].length && tileY >= 0 && tileY < terrain.length) {
    if (terrain[tileY][tileX] === TERRAIN_TYPES.WATER) {
      canMove = false
    }
  } else {
    canMove = false
  }

  // Check collision with rocks
  if (canMove) {
    for (const rock of rocks) {
      if (getDistance(newX, newY, rock.x, rock.y) < player.size + rock.size * 0.8) {
        canMove = false
        break
      }
    }
  }

  // Move if possible
  if (canMove) {
    player.x = newX
    player.y = newY

    // Update grabbed object position if holding one
    if (grabbedBomb) {
      const angle = Math.atan2(dy, dx)
      grabbedBomb.x = player.x + Math.cos(angle) * (player.size + grabbedBomb.size) * 0.8
      grabbedBomb.y = player.y + Math.sin(angle) * (player.size + grabbedBomb.size) * 0.8
    } else if (grabbedRock) {
      const angle = Math.atan2(dy, dx)
      grabbedRock.x = player.x + Math.cos(angle) * (player.size + grabbedRock.size) * 0.8
      grabbedRock.y = player.y + Math.sin(angle) * (player.size + grabbedRock.size) * 0.8
    }
  }
}

// Add a function to draw rocks
function drawAndUpdateRocks() {
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i]
    const screenX = rock.x - camera.x
    const screenY = rock.y - camera.y

    // Skip if rock is off-screen
    if (
      screenX < -rock.size ||
      screenX > canvas.width + rock.size ||
      screenY < -rock.size ||
      screenY > canvas.height + rock.size
    ) {
      continue
    }

    // Draw shadow using shape-specific shadow
    if (rock.texture === 0) {
      // Rounded rock shadow
      createShadow(ctx, screenX, screenY, rock.size, "circle")
    } else if (rock.texture === 1) {
      // Angular rock shadow
      createShadow(ctx, screenX, screenY, rock.size, "polygon", null, rock.rotation)
    } else {
      // Oval rock shadow
      createShadow(ctx, screenX, screenY, rock.size, "oval", null, rock.rotation)
    }

    // Draw rock
    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(rock.rotation)

    // Base rock shape
    ctx.fillStyle = "#7f8c8d" // Base rock color
    ctx.beginPath()

    // Different rock shapes based on texture
    if (rock.texture === 0) {
      // Rounded rock
      ctx.arc(0, 0, rock.size * 0.8, 0, Math.PI * 2)
    } else if (rock.texture === 1) {
      // Angular rock
      ctx.beginPath()
      for (let j = 0; j < 7; j++) {
        const angle = (j * Math.PI * 2) / 7
        const radius = rock.size * (0.7 + Math.sin(j * 5) * 0.1)
        if (j === 0) {
          ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        } else {
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        }
      }
      ctx.closePath()
    } else {
      // Oval rock
      ctx.ellipse(0, 0, rock.size * 0.85, rock.size * 0.65, 0, 0, Math.PI * 2)
    }
    ctx.fill()

    // Add texture details
    ctx.fillStyle = "#6c7a7a" // Darker color for details
    for (let j = 0; j < 5; j++) {
      const detailX = (Math.random() - 0.5) * rock.size
      const detailY = (Math.random() - 0.5) * rock.size
      const detailSize = 2 + Math.random() * 5

      // Only draw details inside the rock
      if (detailX * detailX + detailY * detailY < rock.size * 0.7 * (rock.size * 0.7)) {
        ctx.beginPath()
        ctx.arc(detailX, detailY, detailSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Add highlights
    ctx.fillStyle = "#95a5a6" // Lighter color for highlights
    ctx.beginPath()
    ctx.arc(-rock.size * 0.3, -rock.size * 0.3, rock.size * 0.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

// Standardize shadow proportions for all objects
// Modify the createShadow function to match shape of the object it's shadowing
function createShadow(ctx, x, y, objectSize, shape = "circle", rect = null, rotation = 0) {
  // Save context for transformations
  ctx.save()

  // Apply rotation if needed
  if (rotation !== 0) {
    ctx.translate(x, y)
    ctx.rotate(rotation)
    x = 0
    y = 0
  }

  if (shape === "circle") {
    // Circular shadow with gradient
    const shadowGradient = ctx.createRadialGradient(x, y, objectSize * 0.5, x, y, objectSize * 1.2)
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.5)")
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)")

    ctx.fillStyle = shadowGradient
    ctx.beginPath()
    ctx.arc(x, y, objectSize * 1.2, 0, Math.PI * 2)
    ctx.fill()
  } else if (shape === "rectangle") {
    // Rounded rectangle shadow with gradient
    const width = rect.width
    const height = rect.height
    const radius = rect.radius

    // Create gradient for rectangle shadow
    const shadowGradient = ctx.createRadialGradient(x, y, objectSize * 0.5, x, y, Math.max(width, height) * 0.7)
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.5)")
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)")

    ctx.fillStyle = shadowGradient

    // Draw rounded rectangle shadow
    ctx.beginPath()
    ctx.moveTo(x - width / 2 + radius, y - height / 2)
    ctx.lineTo(x + width / 2 - radius, y - height / 2)
    ctx.quadraticCurveTo(x + width / 2, y - height / 2, x + width / 2, y - height / 2 + radius)
    ctx.lineTo(x + width / 2, y + height / 2 - radius)
    ctx.quadraticCurveTo(x + width / 2, y + height / 2, x + width / 2 - radius, y + height / 2)
    ctx.lineTo(x - width / 2 + radius, y + height / 2)
    ctx.quadraticCurveTo(x - width / 2, y + height / 2, x - width / 2, y + height / 2 - radius)
    ctx.lineTo(x - width / 2, y - height / 2 + radius)
    ctx.quadraticCurveTo(x - width / 2, y - height / 2, x - width / 2 + radius, y - height / 2)
    ctx.closePath()
    ctx.fill()
  } else if (shape === "polygon") {
    // Polygon shadow for angular rocks
    const shadowGradient = ctx.createRadialGradient(x, y, objectSize * 0.5, x, y, objectSize * 1.2)
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.5)")
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)")

    ctx.fillStyle = shadowGradient

    // Draw polygon shadow
    ctx.beginPath()
    // Use the same vertices as in drawAndUpdateRocks for angular rocks
    for (let j = 0; j < 7; j++) {
      const angle = (j * Math.PI * 2) / 7
      const radius = objectSize * (0.7 + Math.sin(j * 5) * 0.1) * 1.2 // Slightly larger shadow
      if (j === 0) {
        ctx.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
      } else {
        ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
      }
    }
    ctx.closePath()
    ctx.fill()
  } else if (shape === "oval") {
    // Oval shadow for oval rocks
    const shadowGradient = ctx.createRadialGradient(x, y, objectSize * 0.5, x, y, objectSize * 1.2)
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.5)")
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)")

    ctx.fillStyle = shadowGradient

    // Draw oval shadow
    ctx.beginPath()
    ctx.ellipse(x, y, objectSize * 0.85 * 1.2, objectSize * 0.65 * 1.2, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Restore context
  ctx.restore()
}

// Modify the drawPlayer function to add a shadow
function drawPlayer() {
  if (gameOver) {
    clearInterval(timerInterval) // Stop the timer when the game is over
    return // Don't draw player if game is over
  }

  const screenX = canvas.width / 2
  const screenY = canvas.height / 2

  // Draw shadow using standardized function
  createShadow(ctx, screenX, screenY, player.size, "circle")

  // Draw player body (circle)
  ctx.fillStyle = player.color
  ctx.beginPath()
  ctx.arc(screenX, screenY, player.size, 0, Math.PI * 2)
  ctx.fill()

  // Draw direction indicator
  const indicatorLength = player.size * 0.8
  ctx.strokeStyle = "white"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(screenX, screenY)
  ctx.lineTo(
    screenX + Math.cos(player.direction) * indicatorLength,
    screenY + Math.sin(player.direction) * indicatorLength,
  )
  ctx.stroke()

  // Draw player details
  const eyeOffset = player.size / 3
  const eyeSize = player.size / 5

  // Eyes
  ctx.fillStyle = "white"
  ctx.beginPath()
  ctx.arc(
    screenX + eyeOffset * Math.cos(player.direction - Math.PI / 4),
    screenY + eyeOffset * Math.sin(player.direction - Math.PI / 4),
    eyeSize,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.beginPath()
  ctx.arc(
    screenX + eyeOffset * Math.cos(player.direction + Math.PI / 4),
    screenY + eyeOffset * Math.sin(player.direction + Math.PI / 4),
    eyeSize,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  // Pupils
  ctx.fillStyle = "black"
  ctx.beginPath()
  ctx.arc(
    screenX + eyeOffset * Math.cos(player.direction - Math.PI / 4) + (eyeSize / 3) * Math.cos(player.direction),
    screenY + eyeOffset * Math.sin(player.direction - Math.PI / 4) + (eyeSize / 3) * Math.sin(player.direction),
    eyeSize / 2,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.beginPath()
  ctx.arc(
    screenX + eyeOffset * Math.cos(player.direction + Math.PI / 4) + (eyeSize / 3) * Math.cos(player.direction),
    screenY + eyeOffset * Math.sin(player.direction + Math.PI / 4) + (eyeSize / 3) * Math.sin(player.direction),
    eyeSize / 2,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  // Draw grabbed bomb if holding one
  if (grabbedBomb) {
    const bombScreenX = grabbedBomb.x - camera.x
    const bombScreenY = grabbedBomb.y - camera.y

    // Draw bomb shadow using shape-specific shadow for rounded rectangle
    createShadow(ctx, bombScreenX, bombScreenY, grabbedBomb.size, "rectangle", {
      width: grabbedBomb.size,
      height: grabbedBomb.size,
      radius: grabbedBomb.size / 4,
    })

    ctx.fillStyle = grabbedBomb.color
    roundRect(
      ctx,
      bombScreenX - grabbedBomb.size / 2,
      bombScreenY - grabbedBomb.size / 2,
      grabbedBomb.size,
      grabbedBomb.size,
      grabbedBomb.size / 4,
    )

    // Draw bomb fuse
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(bombScreenX, bombScreenY - grabbedBomb.size / 2)

    // Make fuse wiggle
    const time = Date.now() / 200
    const fuseHeight = grabbedBomb.size / 2
    const wiggle = Math.sin(time) * 5

    ctx.bezierCurveTo(
      bombScreenX + wiggle,
      bombScreenY - grabbedBomb.size / 2 - fuseHeight / 3,
      bombScreenX - wiggle,
      bombScreenY - grabbedBomb.size / 2 - (fuseHeight * 2) / 3,
      bombScreenX,
      bombScreenY - grabbedBomb.size / 2 - fuseHeight,
    )
    ctx.stroke()

    // Draw connection line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(bombScreenX, bombScreenY)
    ctx.stroke()
    ctx.setLineDash([])
  } else if (grabbedRock) {
    // Draw grabbed rock
    const rockScreenX = grabbedRock.x - camera.x
    const rockScreenY = grabbedRock.y - camera.y

    // Draw rock shadow using shape-specific shadow
    if (grabbedRock.texture === 0) {
      // Rounded rock shadow
      createShadow(ctx, rockScreenX, rockScreenY, grabbedRock.size, "circle")
    } else if (grabbedRock.texture === 1) {
      // Angular rock shadow
      createShadow(ctx, rockScreenX, rockScreenY, grabbedRock.size, "polygon", null, grabbedRock.rotation)
    } else {
      // Oval rock shadow
      createShadow(ctx, rockScreenX, rockScreenY, grabbedRock.size, "oval", null, grabbedRock.rotation)
    }

    // Draw rock
    ctx.save()
    ctx.translate(rockScreenX, rockScreenY)
    ctx.rotate(grabbedRock.rotation)

    // Base rock shape
    ctx.fillStyle = "#7f8c8d" // Base rock color
    ctx.beginPath()

    // Different rock shapes based on texture
    if (grabbedRock.texture === 0) {
      // Rounded rock
      ctx.arc(0, 0, grabbedRock.size * 0.8, 0, Math.PI * 2)
    } else if (grabbedRock.texture === 1) {
      // Angular rock
      ctx.beginPath()
      for (let j = 0; j < 7; j++) {
        const angle = (j * Math.PI * 2) / 7
        const radius = grabbedRock.size * (0.7 + Math.sin(j * 5) * 0.1)
        if (j === 0) {
          ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        } else {
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        }
      }
      ctx.closePath()
    } else {
      // Oval rock
      ctx.ellipse(0, 0, grabbedRock.size * 0.85, grabbedRock.size * 0.65, 0, 0, Math.PI * 2)
    }
    ctx.fill()

    // Add texture details
    ctx.fillStyle = "#6c7a7a" // Darker color for details
    for (let j = 0; j < 5; j++) {
      const detailX = (Math.random() - 0.5) * grabbedRock.size
      const detailY = (Math.random() - 0.5) * grabbedRock.size
      const detailSize = 2 + Math.random() * 5

      // Only draw details inside the rock
      if (detailX * detailX + detailY * detailY < grabbedRock.size * 0.7 * (grabbedRock.size * 0.7)) {
        ctx.beginPath()
        ctx.arc(detailX, detailY, detailSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Add highlights
    ctx.fillStyle = "#95a5a6" // Lighter color for highlights
    ctx.beginPath()
    ctx.arc(-grabbedRock.size * 0.3, -grabbedRock.size * 0.3, grabbedRock.size * 0.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()

    // Draw connection line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(rockScreenX, rockScreenY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Flash player if recently hit
  if (Date.now() - player.lastHit < 500) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)"
    ctx.beginPath()
    ctx.arc(screenX, screenY, player.size * 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Modify the drawAndUpdateApples function to add shadows
function drawAndUpdateApples() {
  for (let i = 0; i < apples.length; i++) {
    const apple = apples[i]
    const screenX = apple.x - camera.x
    const screenY = apple.y - camera.y

    // Skip if apple is off-screen
    if (
      screenX < -apple.size ||
      screenX > canvas.width + apple.size ||
      screenY < -apple.size ||
      screenY > canvas.height + apple.size
    ) {
      continue
    }

    // Draw apple shadow using standardized function
    createShadow(ctx, screenX, screenY, apple.size, "circle")

    // Draw apple
    ctx.fillStyle = apple.color
    ctx.beginPath()
    ctx.arc(screenX, screenY, apple.size, 0, Math.PI * 2)
    ctx.fill()

    // Draw stem
    ctx.fillStyle = "#27ae60"
    ctx.fillRect(screenX - 1, screenY - apple.size, 2, apple.size / 2)

    // Check if player collects apple
    const distance = getDistance(player.x, player.y, apple.x, apple.y)
    if (distance < player.size + apple.size) {
      player.apples++
      apples.splice(i, 1)
      i--
      updateAppleCounter()
    }
  }
}

// Modify the drawAndUpdateBombs function to add shadows
function drawAndUpdateBombs() {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i]
    const screenX = bomb.x - camera.x
    const screenY = bomb.y - camera.y

    // Skip if bomb is off-screen
    if (
      screenX < -bomb.size ||
      screenX > canvas.width + bomb.size ||
      screenY < -bomb.size ||
      screenY > canvas.height + bomb.size
    ) {
      // If bomb is counting down but off-screen, still check for explosion
      if (bomb.countdown !== null && Date.now() >= bomb.countdown) {
        const explosionRadius = 100 + Math.random() * 50 // Random radius between 100-150
        createExplosion(bomb.x, bomb.y, explosionRadius)
        bombs.splice(i, 1)
      }
      continue
    }

    // Draw shadow using shape-specific shadow for rounded rectangle
    createShadow(ctx, screenX, screenY, bomb.size, "rectangle", {
      width: bomb.size,
      height: bomb.size,
      radius: bomb.size / 4,
    })

    // Check if bomb should explode
    if (bomb.countdown !== null && Date.now() >= bomb.countdown) {
      const explosionRadius = 100 + Math.random() * 50 // Random radius between 100-150
      createExplosion(bomb.x, bomb.y, explosionRadius)
      bombs.splice(i, 1)
      continue
    }

    // Draw bomb (rounded rectangle with fuse)
    ctx.fillStyle = bomb.color
    roundRect(ctx, screenX - bomb.size / 2, screenY - bomb.size / 2, bomb.size, bomb.size, bomb.size / 4)

    // Draw bomb fuse
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(screenX, screenY - bomb.size / 2)

    // Make fuse wiggle
    const time = Date.now() / 200
    const fuseHeight = bomb.size / 2
    const wiggle = Math.sin(time) * 5

    ctx.bezierCurveTo(
      screenX + wiggle,
      screenY - bomb.size / 2 - fuseHeight / 3,
      screenX - wiggle,
      screenY - bomb.size / 2 - (fuseHeight * 2) / 3,
      screenX,
      screenY - bomb.size / 2 - fuseHeight,
    )
    ctx.stroke()

    // Draw spark on fuse if counting down
    if (bomb.countdown !== null) {
      const countdownProgress = 1 - (bomb.countdown - Date.now()) / 3000
      const sparkY = screenY - bomb.size / 2 - fuseHeight * countdownProgress

      // Draw spark
      ctx.fillStyle = "#ffcc00"
      ctx.beginPath()
      ctx.arc(screenX, sparkY, 4, 0, Math.PI * 2)
      ctx.fill()

      // Draw countdown text
      const secondsLeft = Math.ceil((bomb.countdown - Date.now()) / 1000)
      ctx.fillStyle = "white"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(secondsLeft.toString(), screenX, screenY)

      // Draw pulsing circle around bomb
      const pulseSize = Math.sin(Date.now() / 100) * 5 + 10
      ctx.strokeStyle = "rgba(255, 0, 0, 0.7)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(screenX, screenY, bomb.size / 2 + pulseSize, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

// Modify the drawAndUpdateEnemies function to add shadows
function drawAndUpdateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]

    // Check if enemy can see player
    const distanceToPlayer = getDistance(player.x, player.y, enemy.x, enemy.y)
    const canSeePlayer = distanceToPlayer < 300 // Detection radius

    // Update enemy movement
    if (!gameOver) {
      updateEnemyMovement(enemy, canSeePlayer)
    }

    const screenX = enemy.x - camera.x
    const screenY = enemy.y - camera.y

    // Skip if enemy is off-screen
    if (
      screenX < -enemy.size ||
      screenX > canvas.width + enemy.size ||
      screenY < -enemy.size ||
      screenY > canvas.height + enemy.size
    ) {
      continue
    }

    // Draw shadow using standardized function
    createShadow(ctx, screenX, screenY, enemy.size)

    // Draw enemy (circle with details)
    ctx.fillStyle = enemy.isChasing ? "#ff3b30" : enemy.color
    ctx.beginPath()
    ctx.arc(screenX, screenY, enemy.size, 0, Math.PI * 2)
    ctx.fill()

    // Draw enemy eyes
    const eyeOffset = enemy.size / 3
    const eyeSize = enemy.size / 5

    // Left eye
    ctx.fillStyle = "white"
    ctx.beginPath()
    ctx.arc(
      screenX - eyeOffset * Math.cos(enemy.direction),
      screenY - eyeOffset * Math.sin(enemy.direction),
      eyeSize,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    // Right eye
    ctx.beginPath()
    ctx.arc(
      screenX + eyeOffset * Math.sin(enemy.direction),
      screenY - eyeOffset * Math.cos(enemy.direction),
      eyeSize,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    // Eye pupils
    ctx.fillStyle = "black"
    ctx.beginPath()
    ctx.arc(
      screenX - eyeOffset * Math.cos(enemy.direction) + (eyeSize / 3) * Math.cos(enemy.direction),
      screenY - eyeOffset * Math.sin(enemy.direction) + (eyeSize / 3) * Math.sin(enemy.direction),
      eyeSize / 2,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    ctx.beginPath()
    ctx.arc(
      screenX + eyeOffset * Math.sin(enemy.direction) + (eyeSize / 3) * Math.cos(enemy.direction),
      screenY - eyeOffset * Math.cos(enemy.direction) + (eyeSize / 3) * Math.sin(enemy.direction),
      eyeSize / 2,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    // Draw alert indicator if chasing
    if (enemy.isChasing) {
      const alertSize = Math.sin(Date.now() / 100) * 3 + 10
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
      ctx.beginPath()
      ctx.arc(screenX, screenY - enemy.size - 10, alertSize, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// Modify the drawAndUpdateThrownApples function to add shadows
function drawAndUpdateThrownApples() {
  for (let i = 0; i < thrownApples.length; i++) {
    const apple = thrownApples[i]

    // Update apple position if game is not over
    if (!gameOver) {
      apple.x += apple.velocityX
      apple.y += apple.velocityY
    }

    const screenX = apple.x - camera.x
    const screenY = apple.y - camera.y

    // Skip if apple is off-screen
    if (
      screenX < -apple.size ||
      screenX > canvas.width + apple.size ||
      screenY < -apple.size ||
      screenY > canvas.height + apple.size
    ) {
      thrownApples.splice(i, 1)
      i--
      continue
    }

    // Draw apple shadow using standardized function
    createShadow(ctx, screenX, screenY, apple.size, "circle")

    // Draw apple
    ctx.fillStyle = apple.color
    ctx.beginPath()
    ctx.arc(screenX, screenY, apple.size, 0, Math.PI * 2)
    ctx.fill()

    // Check for collisions with enemies
    for (let j = 0; j < enemies.length; j++) {
      const enemy = enemies[j]
      const distance = getDistance(apple.x, apple.y, enemy.x, enemy.y)

      if (distance < apple.size + enemy.size) {
        // Remove enemy and apple
        enemies.splice(j, 1)
        thrownApples.splice(i, 1)
        i--
        break
      }
    }

    // Check for collisions with bombs
    for (let j = 0; j < bombs.length; j++) {
      const bomb = bombs[j]
      const distance = getDistance(apple.x, apple.y, bomb.x, bomb.y)

      if (distance < apple.size + bomb.size) {
        // Remove apple
        thrownApples.splice(i, 1)
        i--
        break
      }
    }
  }
}

// Modify the updateEnemyMovement function to handle rocks
function updateEnemyMovement(enemy, canSeePlayer) {
  if (canSeePlayer) {
    // Chase player
    enemy.isChasing = true
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x)
    enemy.direction = angleToPlayer

    // Move toward player with increased speed
    const dx = Math.cos(angleToPlayer) * ENEMY_CHASE_SPEED
    const dy = Math.sin(angleToPlayer) * ENEMY_CHASE_SPEED

    // Check if new position would be on water or collide with a rock
    const newX = enemy.x + dx
    const newY = enemy.y + dy
    const tileX = Math.floor(newX / TILE_SIZE)
    const tileY = Math.floor(newY / TILE_SIZE)

    let canMove = true
    let collidedWithRock = false
    let rockCollisionAngle = 0

    // Check terrain
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
    ) {
      // Check collision with rocks
      for (const rock of rocks) {
        const distance = getDistance(newX, newY, rock.x, rock.y)
        if (distance < enemy.size + rock.size * 0.8) {
          canMove = false
          collidedWithRock = true
          rockCollisionAngle = Math.atan2(enemy.y - rock.y, enemy.x - rock.x)
          break
        }
      }
    } else {
      canMove = false
    }

    if (canMove) {
      enemy.x = newX
      enemy.y = newY
    } else if (collidedWithRock) {
      // Bump away from rock
      const bumpDistance = 2
      enemy.x += Math.cos(rockCollisionAngle) * bumpDistance
      enemy.y += Math.sin(rockCollisionAngle) * bumpDistance

      // Try to move around obstacle
      const alternateAngle1 = angleToPlayer + Math.PI / 4
      const alternateAngle2 = angleToPlayer - Math.PI / 4

      const alt1X = enemy.x + Math.cos(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1Y = enemy.y + Math.sin(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1TileX = Math.floor(alt1X / TILE_SIZE)
      const alt1TileY = Math.floor(alt1Y / TILE_SIZE)

      let canMoveAlt1 = true

      if (
        alt1TileX >= 0 &&
        alt1TileX < terrain[0].length &&
        alt1TileY >= 0 &&
        alt1TileY < terrain.length &&
        terrain[alt1TileY][alt1TileX] !== TERRAIN_TYPES.WATER
      ) {
        // Check collision with rocks
        for (const rock of rocks) {
          if (getDistance(alt1X, alt1Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
            canMoveAlt1 = false
            break
          }
        }
      } else {
        canMoveAlt1 = false
      }

      if (canMoveAlt1) {
        enemy.x = alt1X
        enemy.y = alt1Y
      } else {
        const alt2X = enemy.x + Math.cos(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2Y = enemy.y + Math.sin(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2TileX = Math.floor(alt2X / TILE_SIZE)
        const alt2TileY = Math.floor(alt2Y / TILE_SIZE)

        let canMoveAlt2 = true

        if (
          alt2TileX >= 0 &&
          alt2TileX < terrain[0].length &&
          alt2TileY >= 0 &&
          alt2TileY < terrain.length &&
          terrain[alt2TileY][alt2TileX] !== TERRAIN_TYPES.WATER
        ) {
          // Check collision with rocks
          for (const rock of rocks) {
            if (getDistance(alt2X, alt2Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
              canMoveAlt2 = false
              break
            }
          }
        } else {
          canMoveAlt2 = false
        }

        if (canMoveAlt2) {
          enemy.x = alt2X
          enemy.y = alt2Y
        }
      }
    } else {
      // Try to move around obstacle
      const alternateAngle1 = angleToPlayer + Math.PI / 4
      const alternateAngle2 = angleToPlayer - Math.PI / 4

      const alt1X = enemy.x + Math.cos(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1Y = enemy.y + Math.sin(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1TileX = Math.floor(alt1X / TILE_SIZE)
      const alt1TileY = Math.floor(alt1Y / TILE_SIZE)

      let canMoveAlt1 = true

      if (
        alt1TileX >= 0 &&
        alt1TileX < terrain[0].length &&
        alt1TileY >= 0 &&
        alt1TileY < terrain.length &&
        terrain[alt1TileY][alt1TileX] !== TERRAIN_TYPES.WATER
      ) {
        // Check collision with rocks
        for (const rock of rocks) {
          if (getDistance(alt1X, alt1Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
            canMoveAlt1 = false
            break
          }
        }
      } else {
        canMoveAlt1 = false
      }

      if (canMoveAlt1) {
        enemy.x = alt1X
        enemy.y = alt1Y
      } else {
        const alt2X = enemy.x + Math.cos(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2Y = enemy.y + Math.sin(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2TileX = Math.floor(alt2X / TILE_SIZE)
        const alt2TileY = Math.floor(alt2Y / TILE_SIZE)

        let canMoveAlt2 = true

        if (
          alt2TileX >= 0 &&
          alt2TileX < terrain[0].length &&
          alt2TileY >= 0 &&
          alt2TileY < terrain.length &&
          terrain[alt2TileY][alt2TileX] !== TERRAIN_TYPES.WATER
        ) {
          // Check collision with rocks
          for (const rock of rocks) {
            if (getDistance(alt2X, alt2Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
              canMoveAlt2 = false
              break
            }
          }
        } else {
          canMoveAlt2 = false
        }

        if (canMoveAlt2) {
          enemy.x = alt2X
          enemy.y = alt2Y
        }
      }
    }
  } else {
    // Wander randomly
    enemy.isChasing = false

    // Occasionally change direction
    if (Date.now() > enemy.directionChangeTime) {
      enemy.direction = Math.random() * Math.PI * 2
      enemy.directionChangeTime = Date.now() + Math.random() * 3000 + 2000
    }

    // Move enemy
    const dx = Math.cos(enemy.direction) * enemy.speed
    const dy = Math.sin(enemy.direction) * enemy.speed

    // Check if new position would be on water or collide with a rock
    const newX = enemy.x + dx
    const newY = enemy.y + dy
    const tileX = Math.floor(newX / TILE_SIZE)
    const tileY = Math.floor(newY / TILE_SIZE)

    let canMove = true
    let collidedWithRock = false
    let rockCollisionAngle = 0

    // Check terrain
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
    ) {
      // Check collision with rocks
      for (const rock of rocks) {
        const distance = getDistance(newX, newY, rock.x, rock.y)
        if (distance < enemy.size + rock.size * 0.8) {
          canMove = false
          collidedWithRock = true
          rockCollisionAngle = Math.atan2(enemy.y - rock.y, enemy.x - rock.x)
          break
        }
      }
    } else {
      canMove = false
    }

    if (canMove) {
      enemy.x = newX
      enemy.y = newY
    } else if (collidedWithRock) {
      // Bump away from rock
      const bumpDistance = 2
      enemy.x += Math.cos(rockCollisionAngle) * bumpDistance
      enemy.y += Math.sin(rockCollisionAngle) * bumpDistance

      // Change direction if hitting obstacle
      enemy.direction = (enemy.direction + Math.PI + ((Math.random() * Math.PI) / 2 - Math.PI / 4)) % (Math.PI * 2)
    } else {
      // Change direction if hitting obstacle
      enemy.direction = (enemy.direction + Math.PI) % (Math.PI * 2)
    }
  }

  // Check for collisions with bombs
  for (const bomb of bombs) {
    const distance = getDistance(enemy.x, enemy.y, bomb.x, bomb.y)
    if (distance < enemy.size + bomb.size) {
      // Bounce off bomb
      enemy.direction = (enemy.direction + Math.PI) % (Math.PI * 2)
      break
    }
  }
}

// Modify the drawPlayer function to handle grabbed rocks

// Check for collisions
function checkCollisions() {
  // Check for collisions with enemies
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]
    const distance = getDistance(player.x, player.y, enemy.x, enemy.y)

    if (distance < player.size + enemy.size) {
      // Only take damage if not recently hit
      if (Date.now() - player.lastHit > 1000) {
        player.health--
        player.lastHit = Date.now()
        updateHealthDisplay()

        // Check if player is dead
        if (player.health <= 0) {
          gameOver = true
          document.getElementById("gameOver").classList.add("active")
        }
      }
    }
  }
}

// Maintain game elements (generate more as needed)
function maintainGameElements() {
  // Generate more apples if needed
  if (apples.length < 20) {
    generateApples(5) // Generate 5 apples at once instead of 1
  }

  // Generate more bombs if needed
  if (bombs.length < 20) {
    generateBombs(2)
  }
}

// Helper function to get distance between two points
function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

// Helper function to get terrain color
function getTerrainColor(terrainType) {
  switch (terrainType) {
    case TERRAIN_TYPES.WATER:
      return "#3498db"
    case TERRAIN_TYPES.GRASS:
      return "#2ecc71"
    case TERRAIN_TYPES.FOREST:
      return "#27ae60"
    case TERRAIN_TYPES.DIRT:
      return "#a67c52"
    default:
      return "#ecf0f1"
  }
}

// Helper function to get random color
function getRandomColor() {
  const colors = ["#e74c3c", "#9b59b6", "#3498db", "#2ecc71", "#f1c40f", "#e67e22", "#1abc9c", "#34495e"]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Helper function to adjust color brightness
function adjustColorBrightness(hex, percent) {
  // Convert hex to RGB
  let r = Number.parseInt(hex.substring(1, 3), 16)
  let g = Number.parseInt(hex.substring(3, 5), 16)
  let b = Number.parseInt(hex.substring(5, 7), 16)

  // Adjust brightness
  r = Math.max(0, Math.min(255, r + percent))
  g = Math.max(0, Math.min(255, g + percent))
  b = Math.max(0, Math.min(255, b + percent))

  // Convert back to hex
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// Helper function to draw rounded rectangle
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.fill()
}

// Update timer
function updateTimer() {
  if (!gameOver) {
    elapsedTime = Math.floor((Date.now() - startTime) / 1000)
    const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, "0")
    const seconds = String(elapsedTime % 60).padStart(2, "0")
    document.getElementById("timer").textContent = `${minutes}:${seconds}`
  }
}

// Initialize the game when the page loads
window.addEventListener("load", init)

// Update the drawTerrain function to restore textures and animations
function drawTerrain() {
  const startX = Math.floor(camera.x / TILE_SIZE)
  const startY = Math.floor(camera.y / TILE_SIZE)
  const endX = startX + Math.ceil(canvas.width / TILE_SIZE) + 1
  const endY = startY + Math.ceil(canvas.height / TILE_SIZE) + 1
  const time = Date.now() / 1000 // For animations

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (y >= 0 && y < terrain.length && x >= 0 && x < terrain[0].length) {
        const terrainType = terrain[y][x]
        const screenX = x * TILE_SIZE - camera.x
        const screenY = y * TILE_SIZE - camera.y

        // Draw terrain tile
        ctx.fillStyle = getTerrainColor(terrainType)
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

        // Add texture/detail to terrain
        ctx.fillStyle = adjustColorBrightness(getTerrainColor(terrainType), -10)

        if (terrainType === TERRAIN_TYPES.WATER) {
          // Water ripples animation
          const waveOffset = Math.sin(time + x * 0.3 + y * 0.2) * 3

          ctx.beginPath()
          ctx.moveTo(screenX, screenY + TILE_SIZE / 2 + waveOffset)
          ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE / 2 - waveOffset)
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
          ctx.lineWidth = 2
          ctx.stroke()

          // Second wave for more texture
          const waveOffset2 = Math.sin(time * 1.5 + x * 0.4 + y * 0.3) * 2
          ctx.beginPath()
          ctx.moveTo(screenX, screenY + TILE_SIZE / 3 + waveOffset2)
          ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE / 3 - waveOffset2)
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
          ctx.lineWidth = 1
          ctx.stroke()
        } else if (terrainType === TERRAIN_TYPES.GRASS) {
          // Grass details - small dots and lines
          for (let i = 0; i < 3; i++) {
            const grassX = screenX + Math.random() * TILE_SIZE
            const grassY = screenY + Math.random() * TILE_SIZE
            const grassSize = 3 + Math.random() * 2

            ctx.beginPath()
            ctx.arc(grassX, grassY, grassSize, 0, Math.PI * 2)
            ctx.fill()
          }

          // Add some grass blades
          ctx.strokeStyle = adjustColorBrightness(getTerrainColor(terrainType), -15)
          ctx.lineWidth = 1
          for (let i = 0; i < 2; i++) {
            const baseX = screenX + 5 + Math.random() * (TILE_SIZE - 10)
            const baseY = screenY + TILE_SIZE - 5
            const height = 5 + Math.random() * 8
            const bend = Math.sin(time * (0.5 + Math.random() * 0.5)) * 2

            ctx.beginPath()
            ctx.moveTo(baseX, baseY)
            ctx.quadraticCurveTo(baseX + bend, baseY - height / 2, baseX, baseY - height)
            ctx.stroke()
          }
        } else if (terrainType === TERRAIN_TYPES.FOREST) {
          // Forest details - tree-like shapes
          const centerX = screenX + TILE_SIZE / 2
          const centerY = screenY + TILE_SIZE / 2
          const radius = TILE_SIZE / 4

          // Tree top (circle)
          ctx.beginPath()
          ctx.arc(centerX, centerY - radius / 2, radius, 0, Math.PI * 2)
          ctx.fill()

          // Tree trunk
          ctx.fillStyle = "#795548"
          ctx.fillRect(centerX - 2, centerY, 4, TILE_SIZE / 4)

          // Add some movement to trees
          const sway = Math.sin(time + x * 0.1 + y * 0.1) * 1
          ctx.fillStyle = adjustColorBrightness(getTerrainColor(terrainType), 5)
          ctx.beginPath()
          ctx.arc(centerX + sway, centerY - radius / 2 - 2, radius * 0.7, 0, Math.PI * 2)
          ctx.fill()
        } else if (terrainType === TERRAIN_TYPES.DIRT) {
          // Dirt details - small rocks and texture
          for (let i = 0; i < 5; i++) {
            const dirtX = screenX + Math.random() * TILE_SIZE
            const dirtY = screenY + Math.random() * TILE_SIZE
            const dirtSize = 2 + Math.random() * 3

            ctx.beginPath()
            ctx.arc(dirtX, dirtY, dirtSize, 0, Math.PI * 2)
            ctx.fill()
          }

          // Add some lines for texture
          ctx.strokeStyle = adjustColorBrightness(getTerrainColor(terrainType), -5)
          ctx.lineWidth = 0.5
          for (let i = 0; i < 2; i++) {
            const startX = screenX + Math.random() * TILE_SIZE
            const startY = screenY + Math.random() * TILE_SIZE
            const length = 3 + Math.random() * 5
            const angle = Math.random() * Math.PI * 2

            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(startX + Math.cos(angle) * length, startY + Math.sin(angle) * length)
            ctx.stroke()
          }
        }
      }
    }
  }
}

function drawAndUpdateExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const explosion = explosions[i]
    const timeSinceStart = Date.now() - explosion.startTime

    // Update explosion radius
    if (timeSinceStart < explosion.duration) {
      explosion.currentRadius = (timeSinceStart / explosion.duration) * explosion.maxRadius
    } else {
      explosions.splice(i, 1)
      continue
    }

    // Draw explosion particles
    for (let j = 0; j < explosion.particles.length; j++) {
      const particle = explosion.particles[j]

      // Update particle position
      particle.x += particle.vx
      particle.y += particle.vy
      particle.life -= 16 // Reduce life based on frame rate

      // Skip if particle is dead
      if (particle.life <= 0) {
        explosion.particles.splice(j, 1)
        j--
        continue
      }

      const screenX = particle.x - camera.x
      const screenY = particle.y - camera.y

      // Skip if particle is off-screen
      if (
        screenX < -particle.size ||
        screenX > canvas.width + particle.size ||
        screenY < -particle.size ||
        screenY > canvas.height + particle.size
      ) {
        continue
      }

      // Draw particle
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const handleButtonAEnd = (e) => {
  buttonAActive = false
  e.target.classList.remove("button-active")
}
