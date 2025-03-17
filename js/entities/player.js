// Player entity
import { gameState } from "../core/game-state.js"
import { TILE_SIZE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"

// Animation constants
const HAND_SIZE = 11
const FOOT_SIZE = 15
const ANIMATION_SPEED = 0.05
const IDLE_ANIMATION_SPEED = 0.03
const IDLE_ANIMATION_RANGE = 2
const LIMB_MOVEMENT_RANGE = 12

// Update player position based on keyboard input
export function updatePlayerPosition() {
  const { player, keys, isGrabbing, grabbedBomb, grabbedRock, terrain, rocks } = gameState

  let dx = 0
  let dy = 0

  if (gameState.isMobile && gameState.joystickActive) {
    // Use joystick input
    dx = Math.cos(gameState.joystickAngle) * gameState.joystickDistance
    dy = Math.sin(gameState.joystickAngle) * gameState.joystickDistance
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

  // Update animation state
  if (dx !== 0 || dy !== 0) {
    player.isMoving = true
    player.animationTime += player.isMoving ? ANIMATION_SPEED * currentSpeed : IDLE_ANIMATION_SPEED
  } else {
    player.isMoving = false
    player.animationTime += IDLE_ANIMATION_SPEED
  }

  // Check if new position would be on water or collide with a rock
  const newX = player.x + dx
  const newY = player.y + dy
  const tileX = Math.floor(newX / TILE_SIZE)
  const tileY = Math.floor(newY / TILE_SIZE)

  let canMove = true

  // Check terrain
  if (tileX >= 0 && tileX < terrain[0].length && tileY >= 0 && tileY < terrain.length) {
    if (terrain[tileY][tileX] === 0) {
      // TERRAIN_TYPES.WATER
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

// Draw player
export function drawPlayer() {
  const { player, canvas, ctx, gameOver, camera, timerInterval, isGrabbing, grabbedBomb, grabbedRock } = gameState

  if (gameOver) {
    clearInterval(timerInterval) // Stop the timer when the game is over
    return // Don't draw player if game is over
  }

  const screenX = canvas.width / 2
  const screenY = canvas.height / 2

  // Draw shadow using standardized function
  createShadow(ctx, screenX, screenY, player.size, "circle")

  // Draw in order from bottom to top (lowest z-index to highest)

  // 1. Draw feet first (lowest z-index: -2)
  if (player.isMoving) {
    drawFeet(ctx, screenX, screenY, player)
  }

  // 2. Draw backpack (z-index: -1)
  drawBackpack(ctx, screenX, screenY, player)

  // 3. Draw player body (z-index: 0)
  ctx.fillStyle = player.color
  ctx.beginPath()
  ctx.arc(screenX, screenY, player.size, 0, Math.PI * 2)
  ctx.fill()

  // 4. Draw direction indicator (z-index: 1)
  const indicatorLength = player.size * 0.8
  ctx.strokeStyle = "gray"
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(screenX, screenY)
  ctx.lineTo(
    screenX + Math.cos(player.direction) * indicatorLength,
    screenY + Math.sin(player.direction) * indicatorLength,
  )
  ctx.stroke()

  // 5. Draw player details - eyes (z-index: 2)
  drawPlayerFace(ctx, screenX, screenY, player)

  // 6. Draw hands (highest z-index: 3)
  drawHands(ctx, screenX, screenY, player)

  // Draw grabbed objects
  drawGrabbedObjects(ctx, screenX, screenY, player, camera, grabbedBomb, grabbedRock)

  // Flash player if recently hit
  if (Date.now() - player.lastHit < 500) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)"
    ctx.beginPath()
    ctx.arc(screenX, screenY, player.size * 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Draw the player's face (eyes and pupils)
function drawPlayerFace(ctx, x, y, player) {
  const eyeOffset = player.size / 3
  const eyeSize = player.size / 5

  // Eyes
  ctx.fillStyle = "white"
  ctx.beginPath()
  ctx.arc(
    x + eyeOffset * Math.cos(player.direction - Math.PI / 4),
    y + eyeOffset * Math.sin(player.direction - Math.PI / 4),
    eyeSize,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.beginPath()
  ctx.arc(
    x + eyeOffset * Math.cos(player.direction + Math.PI / 4),
    y + eyeOffset * Math.sin(player.direction + Math.PI / 4),
    eyeSize,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  // Pupils
  ctx.fillStyle = "black"
  ctx.beginPath()
  ctx.arc(
    x + eyeOffset * Math.cos(player.direction - Math.PI / 4) + (eyeSize / 3) * Math.cos(player.direction),
    y + eyeOffset * Math.sin(player.direction - Math.PI / 4) + (eyeSize / 3) * Math.sin(player.direction),
    eyeSize / 2,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.beginPath()
  ctx.arc(
    x + eyeOffset * Math.cos(player.direction + Math.PI / 4) + (eyeSize / 3) * Math.cos(player.direction),
    y + eyeOffset * Math.sin(player.direction + Math.PI / 4) + (eyeSize / 3) * Math.sin(player.direction),
    eyeSize / 2,
    0,
    Math.PI * 2,
  )
  ctx.fill()
}

// Draw the player's backpack
function drawBackpack(ctx, x, y, player) {
  // Calculate backpack position (opposite to the direction the player is facing)
  const backpackAngle = player.direction + Math.PI
  const backpackDistance = player.size * 1.0

  // Add slight breathing animation to backpack
  const breathingOffset = Math.sin(player.animationTime * IDLE_ANIMATION_SPEED * 5) * 1.5
  const backpackX = x + Math.cos(backpackAngle) * (backpackDistance + breathingOffset)
  const backpackY = y + Math.sin(backpackAngle) * (backpackDistance + breathingOffset)

  // Draw backpack
  ctx.fillStyle = "#8B4513" // Brown color for backpack
  ctx.beginPath()

  // Draw a rounded rectangle for the backpack
  const backpackWidth = player.size * 0.9
  const backpackHeight = player.size * 1.6

  ctx.save()
  ctx.translate(backpackX, backpackY)
  ctx.rotate(backpackAngle)

  // Draw main backpack body
  roundRect(ctx, -backpackWidth / 2, -backpackHeight / 2, backpackWidth, backpackHeight, 4)

  // Draw backpack pocket
  ctx.fillStyle = "#A0522D" // Slightly lighter brown
  roundRect(ctx, -backpackWidth / 2 + 2, -backpackHeight / 2 + 2, backpackWidth - 15, backpackHeight - 4, 2)

  ctx.restore()
}

// Draw the player's hands
function drawHands(ctx, x, y, player) {
  // Calculate animation offset based on movement or idle state
  let handOffset

  if (player.isMoving) {
    // Walking/running animation
    handOffset = Math.sin(player.animationTime) * LIMB_MOVEMENT_RANGE
  } else {
    // Idle animation - subtle breathing movement
    handOffset = Math.sin(player.animationTime) * IDLE_ANIMATION_RANGE
  }

  // Calculate positions for hands (perpendicular to movement direction)
  const handAngle1 = player.direction + Math.PI / 2 // Right hand
  const handAngle2 = player.direction - Math.PI / 2 // Left hand

  // Base distance from center
  const handDistance = player.size * 1.2

  // Calculate hand positions with animation
  const rightHandX = x + Math.cos(handAngle1) * handDistance + Math.cos(player.direction) * handOffset
  const rightHandY = y + Math.sin(handAngle1) * handDistance + Math.sin(player.direction) * handOffset

  const leftHandX = x + Math.cos(handAngle2) * handDistance + Math.cos(player.direction) * -handOffset
  const leftHandY = y + Math.sin(handAngle2) * handDistance + Math.sin(player.direction) * -handOffset

  // Draw hands (light gray)
  ctx.fillStyle = "#AAAAAA"

  // Right hand
  ctx.beginPath()
  ctx.arc(rightHandX, rightHandY, HAND_SIZE, 0, Math.PI * 2)
  ctx.fill()

  // Left hand
  ctx.beginPath()
  ctx.arc(leftHandX, leftHandY, HAND_SIZE, 0, Math.PI * 2)
  ctx.fill()
}

// Draw the player's feet
function drawFeet(ctx, x, y, player) {
  // Calculate animation offset for feet
  const footOffset = Math.sin(player.animationTime) * LIMB_MOVEMENT_RANGE

  // Calculate positions for feet (slightly behind the player)
  const footAngle1 = player.direction + Math.PI + Math.PI / 2 // Right foot
  const footAngle2 = player.direction + Math.PI - Math.PI / 2 // Left foot

  // Base distance from center
  const footDistance = player.size * 0.7

  // Calculate foot positions with animation
  const rightFootX = x + Math.cos(footAngle1) * footDistance + Math.cos(player.direction) * footOffset
  const rightFootY = y + Math.sin(footAngle1) * footDistance + Math.sin(player.direction) * footOffset

  const leftFootX = x + Math.cos(footAngle2) * footDistance + Math.cos(player.direction) * -footOffset
  const leftFootY = y + Math.sin(footAngle2) * footDistance + Math.sin(player.direction) * -footOffset

  // Draw feet (dark gray)
  ctx.fillStyle = "#444444"

  // Right foot
  ctx.beginPath()
  ctx.arc(rightFootX, rightFootY, FOOT_SIZE, 0, Math.PI * 2)
  ctx.fill()

  // Left foot
  ctx.beginPath()
  ctx.arc(leftFootX, leftFootY, FOOT_SIZE, 0, Math.PI * 2)
  ctx.fill()
}

// Draw grabbed objects (bombs or rocks)
function drawGrabbedObjects(ctx, screenX, screenY, player, camera, grabbedBomb, grabbedRock) {
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
}

// Import roundRect after using it to avoid circular dependency
import { roundRect } from "../utils/rendering-utils.js"
