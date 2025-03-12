// Game constants
const TILE_SIZE = 40
const PLAYER_SIZE = 30
const OBSTACLE_SIZE = 45
const APPLE_SIZE = 15
const ENEMY_SIZE = 35
const PLAYER_SPEED = 4
const ENEMY_SPEED = 2
const APPLE_THROW_SPEED = 8
const TERRAIN_TYPES = {
  WATER: 0,
  GRASS: 1,
  FOREST: 2,
}

// Game state
let canvas, ctx
let gameLoop
let player
let terrain = []
let obstacles = []
let enemies = []
const apples = []
const thrownApples = []
const camera = { x: 0, y: 0 }
const keys = {}
const mousePosition = { x: 0, y: 0 }
let isGrabbing = false
let grabbedObstacle = null
let gameOver = false
let isMobile = false
let joystickActive = false
let joystickAngle = 0
let joystickDistance = 0
let joystickOrigin = { x: 0, y: 0 }
const joystickPosition = { x: 0, y: 0 }
let buttonAActive = false
let buttonBActive = false

// Initialize the game
function init() {
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

  // Generate initial obstacles
  generateObstacles(15)

  // Generate initial enemies
  generateEnemies(5)

  // Generate initial apples
  generateApples(10)

  // Set up event listeners
  setupEventListeners()

  // Start game loop
  gameLoop = requestAnimationFrame(update)

  // Reset game over screen
  document.getElementById("gameOver").classList.remove("active")

  setupMobileControls()
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

    // Space bar for grabbing obstacles
    if (e.key === " " && !isGrabbing && !grabbedObstacle) {
      tryGrabObstacle()
    } else if (e.key === " " && isGrabbing && grabbedObstacle) {
      releaseObstacle()
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
  document.getElementById("restartButton").addEventListener("click", init)
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
      joystickKnob.style.transform = "translate(-50%, -50%)"
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
    if (!isGrabbing && !grabbedObstacle) {
      tryGrabObstacle()
    } else if (isGrabbing && grabbedObstacle) {
      releaseObstacle()
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
    const limitedX = joystickOrigin.x + Math.cos(joystickAngle) * limitedDistance
    const limitedY = joystickOrigin.y + Math.sin(joystickAngle) * limitedDistance

    // Update knob position
    const knobX = limitedX - containerRect.left
    const knobY = limitedY - containerRect.top
    joystickKnob.style.transform = `translate(calc(${knobX}px - 50%), calc(${knobY}px - 50%))`
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
  const mapSize = 100 // Size of the terrain grid
  terrain = []

  // Use Perlin noise-like approach for terrain generation
  for (let y = 0; y < mapSize; y++) {
    terrain[y] = []
    for (let x = 0; x < mapSize; x++) {
      // Simple noise function (can be replaced with actual Perlin noise)
      const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) + Math.sin(x * 0.05 + y * 0.05) * 0.5

      if (noise < -0.3) {
        terrain[y][x] = TERRAIN_TYPES.WATER
      } else if (noise < 0.3) {
        terrain[y][x] = TERRAIN_TYPES.GRASS
      } else {
        terrain[y][x] = TERRAIN_TYPES.FOREST
      }
    }
  }
}

// Generate obstacles
function generateObstacles(count) {
  obstacles = []
  for (let i = 0; i < count; i++) {
    const obstacle = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
      size: OBSTACLE_SIZE,
      color: getRandomColor(),
    }

    // Ensure obstacle is not on water
    const tileX = Math.floor(obstacle.x / TILE_SIZE)
    const tileY = Math.floor(obstacle.y / TILE_SIZE)
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
    ) {
      obstacles.push(obstacle)
    } else {
      i-- // Try again
    }
  }
}

// Generate enemies
function generateEnemies(count) {
  enemies = []
  for (let i = 0; i < count; i++) {
    const enemy = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
      size: ENEMY_SIZE,
      speed: ENEMY_SPEED,
      direction: Math.random() * Math.PI * 2,
      color: "#e74c3c",
      directionChangeTime: 0,
    }

    // Ensure enemy is not on water
    const tileX = Math.floor(enemy.x / TILE_SIZE)
    const tileY = Math.floor(enemy.y / TILE_SIZE)
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== TERRAIN_TYPES.WATER
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
    const apple = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
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

// Try to grab an obstacle
function tryGrabObstacle() {
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i]
    const distance = getDistance(player.x, player.y, obstacle.x, obstacle.y)

    if (distance < player.size + obstacle.size) {
      isGrabbing = true
      grabbedObstacle = obstacle
      obstacles.splice(i, 1) // Remove from obstacles array
      return
    }
  }
}

// Release a grabbed obstacle
function releaseObstacle() {
  if (grabbedObstacle) {
    obstacles.push(grabbedObstacle)
    grabbedObstacle = null
    isGrabbing = false
  }
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
  if (gameOver) {
    return
  }

  if (isMobile) {
    const joystickContainer = document.querySelector(".joystick-container")
    const containerRect = joystickContainer.getBoundingClientRect()
    joystickOrigin = {
      x: containerRect.left + containerRect.width / 2,
      y: containerRect.top + containerRect.height / 2,
    }
  }

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Update player direction based on mouse position
  player.direction = Math.atan2(mousePosition.y - canvas.height / 2, mousePosition.x - canvas.width / 2)

  // Update player position based on keyboard input
  updatePlayerPosition()

  // Update camera position
  camera.x = player.x - canvas.width / 2
  camera.y = player.y - canvas.height / 2

  // Draw terrain
  drawTerrain()

  // Draw and update apples
  drawAndUpdateApples()

  // Draw and update obstacles
  drawAndUpdateObstacles()

  // Draw and update enemies
  drawAndUpdateEnemies()

  // Draw and update thrown apples
  drawAndUpdateThrownApples()

  // Draw player
  drawPlayer()

  // Check for collisions
  checkCollisions()

  // Generate more terrain, enemies, and apples as needed
  maintainGameElements()

  // Continue game loop
  gameLoop = requestAnimationFrame(update)
}

// Update player position based on keyboard input
function updatePlayerPosition() {
  let dx = 0
  let dy = 0

  if (isMobile && joystickActive) {
    // Use joystick input
    dx = Math.cos(joystickAngle) * joystickDistance
    dy = Math.sin(joystickAngle) * joystickDistance

    // Update player direction based on joystick
    if (joystickDistance > 0.1) {
      player.direction = joystickAngle
    }
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

  // Apply speed (reduced if grabbing an obstacle)
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

      // Update grabbed obstacle position if holding one
      if (grabbedObstacle) {
        const angle = Math.atan2(dy, dx)
        grabbedObstacle.x = player.x + Math.cos(angle) * (player.size + grabbedObstacle.size) * 0.8
        grabbedObstacle.y = player.y + Math.sin(angle) * (player.size + grabbedObstacle.size) * 0.8
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

// Draw and update obstacles
function drawAndUpdateObstacles() {
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i]
    const screenX = obstacle.x - camera.x
    const screenY = obstacle.y - camera.y

    // Skip if obstacle is off-screen
    if (
      screenX < -obstacle.size ||
      screenX > canvas.width + obstacle.size ||
      screenY < -obstacle.size ||
      screenY > canvas.height + obstacle.size
    ) {
      continue
    }

    // Draw obstacle (rounded rectangle)
    ctx.fillStyle = obstacle.color
    roundRect(
      ctx,
      screenX - obstacle.size / 2,
      screenY - obstacle.size / 2,
      obstacle.size,
      obstacle.size,
      obstacle.size / 4,
    )

    // Add some detail/texture
    ctx.fillStyle = adjustColorBrightness(obstacle.color, -20)
    roundRect(
      ctx,
      screenX - obstacle.size / 4,
      screenY - obstacle.size / 4,
      obstacle.size / 2,
      obstacle.size / 2,
      obstacle.size / 8,
    )
  }
}

// Draw and update enemies
function drawAndUpdateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]

    // Update enemy movement
    updateEnemyMovement(enemy)

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
    ctx.fillStyle = enemy.color
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
  }
}

// Update enemy movement
function updateEnemyMovement(enemy) {
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

  if (tileX >= 0 && tileX < terrain[0].length && tileY >= 0 && tileY < terrain.length) {
    // Only move if not going into water
    if (terrain[tileY][tileX] !== TERRAIN_TYPES.WATER) {
      enemy.x = newX
      enemy.y = newY
    } else {
      // Change direction if hitting water
      enemy.direction = (enemy.direction + Math.PI) % (Math.PI * 2)
    }
  } else {
    // Change direction if going out of bounds
    enemy.direction = (enemy.direction + Math.PI) % (Math.PI * 2)
  }

  // Check for collisions with obstacles
  for (const obstacle of obstacles) {
    const distance = getDistance(enemy.x, enemy.y, obstacle.x, obstacle.y)
    if (distance < enemy.size + obstacle.size) {
      // Bounce off obstacle
      enemy.direction = (enemy.direction + Math.PI) % (Math.PI * 2)
      break
    }
  }
}

// Draw and update thrown apples
function drawAndUpdateThrownApples() {
  for (let i = 0; i < thrownApples.length; i++) {
    const apple = thrownApples[i]

    // Update apple position
    apple.x += apple.velocityX
    apple.y += apple.velocityY

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

        // Generate a new enemy elsewhere
        setTimeout(() => {
          generateEnemies(1)
        }, 3000)

        break
      }
    }

    // Check for collisions with obstacles
    for (let j = 0; j < obstacles.length; j++) {
      const obstacle = obstacles[j]
      const distance = getDistance(apple.x, apple.y, obstacle.x, obstacle.y)

      if (distance < apple.size + obstacle.size) {
        // Remove apple
        thrownApples.splice(i, 1)
        i--
        break
      }
    }
  }
}

// Draw player
function drawPlayer() {
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

  // Draw grabbed obstacle if holding one
  if (grabbedObstacle) {
    const obstacleScreenX = grabbedObstacle.x - camera.x
    const obstacleScreenY = grabbedObstacle.y - camera.y

    ctx.fillStyle = grabbedObstacle.color
    roundRect(
      ctx,
      obstacleScreenX - grabbedObstacle.size / 2,
      obstacleScreenY - grabbedObstacle.size / 2,
      grabbedObstacle.size,
      grabbedObstacle.size,
      grabbedObstacle.size / 4,
    )

    // Add some detail/texture
    ctx.fillStyle = adjustColorBrightness(grabbedObstacle.color, -20)
    roundRect(
      ctx,
      obstacleScreenX - grabbedObstacle.size / 4,
      obstacleScreenY - grabbedObstacle.size / 4,
      grabbedObstacle.size / 2,
      grabbedObstacle.size / 2,
      grabbedObstacle.size / 8,
    )

    // Draw connection line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(obstacleScreenX, obstacleScreenY)
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
          cancelAnimationFrame(gameLoop)
        }
      }
    }
  }
}

// Maintain game elements (generate more as needed)
function maintainGameElements() {
  // Generate more apples if needed
  if (apples.length < 10) {
    generateApples(1)
  }

  // Generate more enemies if needed
  if (enemies.length < 5) {
    generateEnemies(1)
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
