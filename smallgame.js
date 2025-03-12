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

// Initialize the game
function init() {
  // Reset all game state
  gameOver = false
  isGrabbing = false
  grabbedBomb = null
  bombs = []
  enemies = []
  apples = []
  thrownApples = []
  explosions = []
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
  window.addEventListener("resize", resizeCanvas)

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
  generateBombs(15)

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
  // Keyboard events
  window.addEventListener("keydown", (e) => {
    keys[e.key] = true

    // Space bar for grabbing bombs
    if (e.key === " " && !isGrabbing && !grabbedBomb) {
      tryGrabBomb()
    } else if (e.key === " " && isGrabbing && grabbedBomb) {
      releaseBomb()
    }
  })

  window.addEventListener("keyup", (e) => {
    keys[e.key] = false
  })

  // Mouse events
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect()
    mousePosition.x = e.clientX - rect.left
    mousePosition.y = e.clientY - rect.top
  })

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      // Left mouse button
      throwApple()
    }
  })

  // Restart button
  document.getElementById("restartButton").addEventListener("click", restartGame)
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
}

function setupMobileControls() {
  if (!detectMobile()) return

  isMobile = true
  document.querySelector(".mobile-controls").style.display = "block"

  // Check orientation
  checkOrientation()
  window.addEventListener("resize", checkOrientation)

  // Dismiss warning button
  document.getElementById("dismissWarning").addEventListener("click", () => {
    document.querySelector(".portrait-warning").style.display = "none"
  })

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

  // Joystick touch events
  joystickContainer.addEventListener("touchstart", (e) => {
    e.preventDefault()
    joystickActive = true
    updateJoystickPosition(e.touches[0])
  })

  document.addEventListener("touchmove", (e) => {
    if (joystickActive) {
      e.preventDefault()
      updateJoystickPosition(e.touches[0])
    }
  })

  document.addEventListener("touchend", (e) => {
    if (joystickActive) {
      joystickActive = false
      joystickKnob.style.transform = "translate(0, 0)"
      joystickAngle = 0
      joystickDistance = 0
    }
  })

  // Button A (grab/release) touch events
  buttonA.addEventListener("touchstart", (e) => {
    e.preventDefault()
    buttonAActive = true
    buttonA.classList.add("button-active")

    // Trigger grab/release action
    if (!isGrabbing && !grabbedBomb) {
      tryGrabBomb()
    } else if (isGrabbing && grabbedBomb) {
      releaseBomb()
    }
  })

  buttonA.addEventListener("touchend", (e) => {
    buttonAActive = false
    buttonA.classList.remove("button-active")
  })

  // Button B (throw apple) touch events
  buttonB.addEventListener("touchstart", (e) => {
    e.preventDefault()
    buttonBActive = true
    buttonB.classList.add("button-active")

    // Throw apple
    throwApple()
  })

  buttonB.addEventListener("touchend", (e) => {
    buttonBActive = false
    buttonB.classList.remove("button-active")
  })

  // Update joystick position and calculate angle/distance
  function updateJoystickPosition(touch) {
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

    // Update knob position - fix the centering by using transform translate
    joystickKnob.style.transform = `translate(calc(${limitedX}px), calc(${limitedY}px))`

    // Reset the joystick knob position when inactive
    if (!joystickActive) {
      joystickKnob.style.transform = "translate(0, 0)"
    }
  }
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
      return
    }
  }
}

// Release a grabbed bomb
function releaseBomb() {
  if (grabbedBomb) {
    // Start countdown when released
    grabbedBomb.countdown = Date.now() + 3000 // 3 seconds
    bombs.push(grabbedBomb)
    grabbedBomb = null
    isGrabbing = false
  }
}

// Create explosion
function createExplosion(x, y, radius) {
  // Create explosion object
  const explosion = {
    x: x,
    y: y,
    radius: radius,
    maxRadius: radius,
    currentRadius: 0,
    particles: [],
    startTime: Date.now(),
    duration: 1000, // 1 second explosion animation
    color: "#ff9500",
  }

  // Create explosion particles
  const particleCount = 30
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 3
    const size = 5 + Math.random() * 10
    const life = 500 + Math.random() * 500

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
  modifyTerrainInRadius(x, y, radius)

  // Check for enemies in explosion radius
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i]
    const distance = getDistance(x, y, enemy.x, enemy.y)

    if (distance < radius) {
      enemies.splice(i, 1)
    }
  }

  // Check if player is in explosion radius
  const distanceToPlayer = getDistance(x, y, player.x, player.y)
  if (distanceToPlayer < radius) {
    player.health = 0
    updateHealthDisplay()
    gameOver = true
    document.getElementById("gameOver").classList.add("active")
    // Don't cancel the game loop here, let it continue to render the game over screen
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

    player.apples--
    updateAppleCounter()
  }
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

  // Apply speed (reduced if grabbing a bomb)
  const currentSpeed = isGrabbing ? player.speed / 2 : player.speed
  dx *= currentSpeed
  dy *= currentSpeed

  // Check if new position would be on water
  const newX = player.x + dx
  const newY = player.y + dy
  const tileX = Math.floor(newX / TILE_SIZE)
  const tileY = Math.floor(newY / TILE_SIZE)

  if (tileX >= 0 && tileX < terrain[0].length && tileY >= 0 && tileY < terrain.length) {
    // Only move if not going into water
    if (terrain[tileY][tileX] !== TERRAIN_TYPES.WATER) {
      player.x = newX
      player.y = newY

      // Update grabbed bomb position if holding one
      if (grabbedBomb) {
        const angle = Math.atan2(dy, dx)
        grabbedBomb.x = player.x + Math.cos(angle) * (player.size + grabbedBomb.size) * 0.8
        grabbedBomb.y = player.y + Math.sin(angle) * (player.size + grabbedBomb.size) * 0.8
      }
    }
  }
}

// Draw terrain
function drawTerrain() {
  const startX = Math.floor(camera.x / TILE_SIZE)
  const startY = Math.floor(camera.y / TILE_SIZE)
  const endX = startX + Math.ceil(canvas.width / TILE_SIZE) + 1
  const endY = startY + Math.ceil(canvas.height / TILE_SIZE) + 1

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (y >= 0 && y < terrain.length && x >= 0 && x < terrain[0].length) {
        const terrainType = terrain[y][x]
        const screenX = x * TILE_SIZE - camera.x
        const screenY = y * TILE_SIZE - camera.y

        // Draw terrain tile
        ctx.fillStyle = getTerrainColor(terrainType)
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

        // Add some texture/detail to terrain
        ctx.fillStyle = adjustColorBrightness(getTerrainColor(terrainType), -10)

        if (terrainType === TERRAIN_TYPES.WATER) {
          // Water ripples
          const time = Date.now() / 1000
          const waveOffset = Math.sin(time + x * 0.3 + y * 0.2) * 3

          ctx.beginPath()
          ctx.moveTo(screenX, screenY + TILE_SIZE / 2 + waveOffset)
          ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE / 2 - waveOffset)
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
          ctx.lineWidth = 2
          ctx.stroke()
        } else if (terrainType === TERRAIN_TYPES.GRASS) {
          // Grass details
          for (let i = 0; i < 3; i++) {
            const grassX = screenX + Math.random() * TILE_SIZE
            const grassY = screenY + Math.random() * TILE_SIZE
            const grassSize = 3 + Math.random() * 2

            ctx.beginPath()
            ctx.arc(grassX, grassY, grassSize, 0, Math.PI * 2)
            ctx.fill()
          }
        } else if (terrainType === TERRAIN_TYPES.FOREST) {
          // Forest details
          const centerX = screenX + TILE_SIZE / 2
          const centerY = screenY + TILE_SIZE / 2
          const radius = TILE_SIZE / 4

          ctx.beginPath()
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
          ctx.fill()

          // Tree trunk
          ctx.fillStyle = "#795548"
          ctx.fillRect(centerX - 2, centerY, 4, TILE_SIZE / 4)
        } else if (terrainType === TERRAIN_TYPES.DIRT) {
          // Dirt details
          for (let i = 0; i < 5; i++) {
            const dirtX = screenX + Math.random() * TILE_SIZE
            const dirtY = screenY + Math.random() * TILE_SIZE
            const dirtSize = 2 + Math.random() * 3

            ctx.beginPath()
            ctx.arc(dirtX, dirtY, dirtSize, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }
  }
}

// Draw and update apples
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

// Draw and update bombs
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

// Draw and update enemies
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

// Update enemy movement
function updateEnemyMovement(enemy, canSeePlayer) {
  if (canSeePlayer) {
    // Chase player
    enemy.isChasing = true
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x)
    enemy.direction = angleToPlayer

    // Move toward player with increased speed
    const dx = Math.cos(angleToPlayer) * ENEMY_CHASE_SPEED
    const dy = Math.sin(angleToPlayer) * ENEMY_CHASE_SPEED

    // Check if new position would be on water
    const newX = enemy.x + dx
    const newY = enemy.y + dy
    const tileX = Math.floor(newX / TILE_SIZE)
    const tileY = Math.floor(newY / TILE_SIZE)

    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
    ) {
      enemy.x = newX
      enemy.y = newY
    } else {
      // Try to move around obstacle
      const alternateAngle1 = angleToPlayer + Math.PI / 4
      const alternateAngle2 = angleToPlayer - Math.PI / 4

      const alt1X = enemy.x + Math.cos(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1Y = enemy.y + Math.sin(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1TileX = Math.floor(alt1X / TILE_SIZE)
      const alt1TileY = Math.floor(alt1Y / TILE_SIZE)

      if (
        alt1TileX >= 0 &&
        alt1TileX < terrain[0].length &&
        alt1TileY >= 0 &&
        alt1TileY < terrain.length &&
        terrain[alt1TileY][alt1TileX] !== TERRAIN_TYPES.WATER
      ) {
        enemy.x = alt1X
        enemy.y = alt1Y
      } else {
        const alt2X = enemy.x + Math.cos(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2Y = enemy.y + Math.sin(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2TileX = Math.floor(alt2X / TILE_SIZE)
        const alt2TileY = Math.floor(alt2Y / TILE_SIZE)

        if (
          alt2TileX >= 0 &&
          alt2TileX < terrain[0].length &&
          alt2TileY >= 0 &&
          alt2TileY < terrain.length &&
          terrain[alt2TileY][alt2TileX] !== TERRAIN_TYPES.WATER
        ) {
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

    // Check if new position would be on water
    const newX = enemy.x + dx
    const newY = enemy.y + dy
    const tileX = Math.floor(newX / TILE_SIZE)
    const tileY = Math.floor(newY / TILE_SIZE)

    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
    ) {
      enemy.x = newX
      enemy.y = newY
    } else {
      // Change direction if hitting water
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

// Draw and update thrown apples
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

// Draw and update explosions
function drawAndUpdateExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const explosion = explosions[i]
    const elapsedTime = Date.now() - explosion.startTime
    const progress = Math.min(elapsedTime / explosion.duration, 1)

    // Update explosion radius
    explosion.currentRadius = explosion.maxRadius * progress

    // Draw explosion
    const screenX = explosion.x - camera.x
    const screenY = explosion.y - camera.y

    // Skip if explosion is off-screen
    if (
      screenX < -explosion.maxRadius ||
      screenX > canvas.width + explosion.maxRadius ||
      screenY < -explosion.maxRadius ||
      screenY > canvas.height + explosion.maxRadius
    ) {
      if (progress >= 1) {
        explosions.splice(i, 1)
      }
      continue
    }

    // Draw explosion glow
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, explosion.currentRadius)

    gradient.addColorStop(0, "rgba(255, 255, 255, " + 0.8 * (1 - progress) + ")")
    gradient.addColorStop(0.4, "rgba(255, 149, 0, " + 0.6 * (1 - progress) + ")")
    gradient.addColorStop(0.7, "rgba(255, 59, 48, " + 0.4 * (1 - progress) + ")")
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)")

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(screenX, screenY, explosion.currentRadius, 0, Math.PI * 2)
    ctx.fill()

    // Update and draw particles
    for (let j = 0; j < explosion.particles.length; j++) {
      const particle = explosion.particles[j]

      // Update particle position
      particle.x += particle.vx
      particle.y += particle.vy

      // Update particle life
      particle.life -= 16 // Approximately 60 fps

      if (particle.life <= 0) {
        explosion.particles.splice(j, 1)
        j--
        continue
      }

      // Draw particle
      const particleScreenX = particle.x - camera.x
      const particleScreenY = particle.y - camera.y

      const alpha = particle.life / particle.maxLife
      const size = particle.size * alpha

      ctx.fillStyle =
        particle.color +
        Math.floor(alpha * 255)
          .toString(16)
          .padStart(2, "0")
      ctx.beginPath()
      ctx.arc(particleScreenX, particleScreenY, size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Remove explosion if animation is complete
    if (progress >= 1 && explosion.particles.length === 0) {
      explosions.splice(i, 1)
    }
  }
}

// Draw player
function drawPlayer() {
  if (gameOver) return // Don't draw player if game is over

  const screenX = canvas.width / 2
  const screenY = canvas.height / 2

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
  }

  // Flash player if recently hit
  if (Date.now() - player.lastHit < 500) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)"
    ctx.beginPath()
    ctx.arc(screenX, screenY, player.size * 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

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
  if (bombs.length < 10) {
    generateBombs(1)
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

// Initialize the game when the page loads
window.addEventListener("load", init)
