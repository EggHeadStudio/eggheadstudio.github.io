// Player entity
import { gameState } from "../core/game-state.js"
import { TILE_SIZE, PLAYER_HEAL_DELAY_MS, PLAYER_HEAL_UNDER_ROOF_MULTIPLIER } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { applyKnockbackToEnemy, damageEnemy } from "../entities/enemies.js"
import { damageWoodenBox, isUnderRoof } from "../entities/wooden-boxes.js"
import { damageTree, isTreeBlocking } from "../entities/trees.js"
import { createDeathEffect, DEATH_EFFECT_DURATION } from "./death-effects.js"

// Animation constants
const HAND_SIZE = 11
const FOOT_SIZE = 15
const ANIMATION_SPEED = 0.05
const IDLE_ANIMATION_SPEED = 0.03
const IDLE_ANIMATION_RANGE = 2
const LIMB_MOVEMENT_RANGE = 12

// Add a new animation constant for throwing
const THROW_ANIMATION_DURATION = 200 // milliseconds
// Add melee attack range
const MELEE_ATTACK_RANGE = 60 // Distance from player center for melee attack

export const PLAYER_DEATH_MENU_DELAY = DEATH_EFFECT_DURATION

export function beginPlayerDeathSequence() {
  const { player } = gameState

  if (!player || player.isDying) {
    return false
  }

  player.health = 0
  player.isDying = true
  player.deathStartedAt = Date.now()

  createDeathEffect({
    x: player.x,
    y: player.y,
    size: player.size * 1.15,
  })

  gameState.isGrabbing = false
  gameState.grabbedBomb = null
  gameState.grabbedRock = null
  gameState.grabbedEnemy = null
  gameState.grabbedWoodenBox = null
  gameState.isInCar = false
  gameState.drivingCar = null

  return true
}

export function damagePlayer(amount = 1, options = {}) {
  const { player, gameOver } = gameState

  if (!player || gameOver || player.isDying) {
    return false
  }

  const { ignoreCooldown = false, cooldownMs = 1000 } = options
  const currentTime = Date.now()

  if (!ignoreCooldown && currentTime - player.lastHit <= cooldownMs) {
    return false
  }

  player.health = Math.max(0, player.health - amount)
  player.lastHit = currentTime
  player.healChargeMs = 0
  player.lastHealUpdateAt = currentTime
  return true
}

export function updatePlayerHealing() {
  const { player, gameOver } = gameState

  if (!player || gameOver || player.health <= 0) {
    return
  }

  const maxHealth = player.maxHealth ?? player.health
  if (player.health >= maxHealth) {
    player.healChargeMs = 0
    player.lastHealUpdateAt = Date.now()
    return
  }

  const currentTime = Date.now()
  if (!player.lastHealUpdateAt) {
    player.lastHealUpdateAt = currentTime
    return
  }

  const elapsed = currentTime - player.lastHealUpdateAt
  const healMultiplier = isUnderRoof(player.x, player.y) ? PLAYER_HEAL_UNDER_ROOF_MULTIPLIER : 1

  player.healChargeMs = (player.healChargeMs || 0) + elapsed * healMultiplier
  player.lastHealUpdateAt = currentTime

  while (player.healChargeMs >= PLAYER_HEAL_DELAY_MS && player.health < maxHealth) {
    player.healChargeMs -= PLAYER_HEAL_DELAY_MS
    player.health += 1
  }

  if (player.health >= maxHealth) {
    player.health = maxHealth
    player.healChargeMs = 0
  }
}

// Update player position based on keyboard input
export function updatePlayerPosition() {
  const {
    player,
    keys,
    isGrabbing,
    grabbedBomb,
    grabbedRock,
    grabbedEnemy,
    grabbedWoodenBox,
    terrain,
    rocks,
    woodenBoxes,
    isMobile,
    joystickActive,
    joystickAngle,
    joystickDistance,
  } = gameState

  if (!player || player.isDying) {
    return
  }

  let dx = 0
  let dy = 0

  if (isMobile && joystickActive) {
    // Mobile controls - use joystick input
    dx = Math.cos(joystickAngle) * joystickDistance
    dy = Math.sin(joystickAngle) * joystickDistance
  } else {
    // Desktop controls - only move forward in the direction of the mouse
    // Check if forward movement keys are pressed
    const isMovingForward = keys["ArrowUp"] || keys["w"]

    if (isMovingForward) {
      // Move in the direction the player is facing (mouse direction)
      dx = Math.cos(player.direction)
      dy = Math.sin(player.direction)
    }
  }

  // Apply speed (reduced if grabbing a bomb, rock, or enemy)
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

  // Check collision with wooden boxes
  if (canMove && woodenBoxes) {
    for (const box of woodenBoxes) {
      // Skip if this is the box being carried
      if (box === grabbedWoodenBox) continue

      if (getDistance(newX, newY, box.x, box.y) < player.size + box.size * 0.8) {
        canMove = false
        break
      }
    }
  }

  // Standing trees block movement (collision is on the trunk, not the canopy)
  if (canMove && isTreeBlocking(newX, newY, player.size)) {
    canMove = false
  }

  // Move if possible
  if (canMove) {
    player.x = newX
    player.y = newY

    // Update grabbed object position if holding one
    if (grabbedBomb) {
      // Position the bomb in front of the player in the direction of movement
      const angle = player.direction
      grabbedBomb.x = player.x + Math.cos(angle) * (player.size + grabbedBomb.size) * 0.8
      grabbedBomb.y = player.y + Math.sin(angle) * (player.size + grabbedBomb.size) * 0.8
    } else if (grabbedRock) {
      // Position the rock in front of the player in the direction of movement
      const angle = player.direction
      grabbedRock.x = player.x + Math.cos(angle) * (player.size + grabbedRock.size) * 0.8
      grabbedRock.y = player.y + Math.sin(angle) * (player.size + grabbedRock.size) * 0.8
    } else if (grabbedEnemy) {
      // Position the enemy in front of the player in the direction of movement
      const angle = player.direction
      grabbedEnemy.x = player.x + Math.cos(angle) * (player.size + grabbedEnemy.size) * 0.8
      grabbedEnemy.y = player.y + Math.sin(angle) * (player.size + grabbedEnemy.size) * 0.8
    } else if (grabbedWoodenBox) {
      // Position the wooden box in front of the player in the direction of movement
      const angle = player.direction
      grabbedWoodenBox.x = player.x + Math.cos(angle) * (player.size + grabbedWoodenBox.size) * 0.8
      grabbedWoodenBox.y = player.y + Math.sin(angle) * (player.size + grabbedWoodenBox.size) * 0.8
    }
  }

  // Check for melee attack collision with enemies
  checkMeleeAttack()
}

// Check if player's melee attack hits any enemies
function checkMeleeAttack() {
  const { player, enemies, woodenBoxes } = gameState

  // Only check during the active part of the throw animation
  if (!player.throwingApple) return

  // Calculate how far into the throw animation we are (0 to 1)
  const throwProgress = (Date.now() - player.throwingApple) / THROW_ANIMATION_DURATION

  // Only check during the forward swing part of the animation (second half)
  if (throwProgress < 0.5 || throwProgress > 0.9) return

  // Calculate the position of the right hand during the attack
  // This matches the hand position calculation in drawHands()
  let rightHandAngle, rightHandDistance
  const handDistance = player.size * 1.2

  // Moving forward (throw)
  const throwForwardProgress = (throwProgress - 0.5) * 2 // 0 to 1 during second half
  rightHandAngle = player.direction + Math.PI / 4 - (Math.PI / 2) * throwForwardProgress
  rightHandDistance = handDistance * (0.7 + throwForwardProgress * 0.6)

  const rightHandX = player.x + Math.cos(rightHandAngle) * rightHandDistance
  const rightHandY = player.y + Math.sin(rightHandAngle) * rightHandDistance

  // Check for collision with enemies
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]

    // Skip if this is the grabbed enemy
    if (gameState.grabbedEnemy === enemy) continue

    // Check distance between hand and enemy
    const distance = getDistance(rightHandX, rightHandY, enemy.x, enemy.y)

    if (distance < HAND_SIZE + enemy.size) {
      const meleeDamage = Math.max(1, Math.round(player.strength || 1))
      const didDamage = damageEnemy(enemy, meleeDamage)

      if (!didDamage) {
        return
      }

      // Apply strong knockback to the enemy (similar to throwing)
      applyKnockbackToEnemy(
        enemy,
        player.x,
        player.y,
        8, // Strong knockback force
      )

      // Add a small "hit" effect
      if (!gameState.hitEffects) {
        gameState.hitEffects = []
      }

      gameState.hitEffects.push({
        x: enemy.x,
        y: enemy.y,
        size: enemy.size * 1.5,
        createdAt: Date.now(),
        duration: 200,
      })

      // Only hit one enemy per swing
      return
    }
  }

  // Check for collision with wooden boxes
  if (woodenBoxes) {
    for (let i = 0; i < woodenBoxes.length; i++) {
      const box = woodenBoxes[i]

      // Skip if this is the grabbed box
      if (gameState.grabbedWoodenBox === box) continue

      // Check distance between hand and box
      const distance = getDistance(rightHandX, rightHandY, box.x, box.y)

      if (distance < HAND_SIZE + box.size * 0.8) {
        // Damage the box
        damageWoodenBox(box)

        // Add a small "hit" effect
        if (!gameState.hitEffects) {
          gameState.hitEffects = []
        }

        gameState.hitEffects.push({
          x: box.x,
          y: box.y,
          size: box.size * 1.2,
          createdAt: Date.now(),
          duration: 200,
        })

        // Only hit one box per swing
        return
      }
    }
  }

  // Check for collision with trees
  if (gameState.trees) {
    for (const tree of gameState.trees) {
      const distance = getDistance(rightHandX, rightHandY, tree.x, tree.y)

      if (distance < HAND_SIZE + tree.size * 0.6) {
        damageTree(tree, 1)

        if (!gameState.hitEffects) {
          gameState.hitEffects = []
        }

        gameState.hitEffects.push({
          x: tree.x,
          y: tree.y,
          size: tree.size * 1.1,
          createdAt: Date.now(),
          duration: 200,
        })

        // Only hit one tree per swing
        return
      }
    }
  }
}

// Draw player
export function drawPlayer() {
  const { player, canvas, ctx, gameOver, camera, timerInterval, isGrabbing, grabbedBomb, grabbedRock, grabbedEnemy, grabbedWoodenBox, isInCar, drivingCar } =
    gameState

  if (gameOver) {
    clearInterval(timerInterval) // Stop the timer when the game is over
    return // Don't draw player if game is over
  }

  if (player.isDying) {
    if (gameState.hitEffects) {
      drawHitEffects(ctx, camera)
    }
    return
  }

  // Calculate screen position
  const screenX = player.x - camera.x
  const screenY = player.y - camera.y

  // Don't draw if off-screen
  if (
    screenX + player.size < 0 ||
    screenX - player.size > canvas.width ||
    screenY + player.size < 0 ||
    screenY - player.size > canvas.height
  ) {
    return
  }

  // Draw player shadow
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = "#000"
  ctx.beginPath()
  
  // If player is in car, draw a smaller shadow inside the car
  if (isInCar && drivingCar) {
    ctx.ellipse(screenX + 3, screenY + 3, player.size * 0.6, player.size * 0.4, 0, 0, Math.PI * 2)
  } else {
    ctx.ellipse(screenX + 3, screenY + 3, player.size, player.size * 0.6, 0, 0, Math.PI * 2)
  }
  
  ctx.fill()
  ctx.restore()

  // Draw hit effects if any
  if (gameState.hitEffects) {
    drawHitEffects(ctx, camera)
  }

  // Draw player base
  ctx.save()
  ctx.translate(screenX, screenY)
  
  // If player is in car, draw the player smaller and more centered
  const scaleFactor = isInCar && drivingCar ? 0.8 : 1;
  if (isInCar && drivingCar) {
    ctx.scale(scaleFactor, scaleFactor);
  }
  
  // Draw feet
  drawFeet(ctx, 0, 0, player)

  // Body
  ctx.fillStyle = player.color
  ctx.beginPath()
  ctx.arc(0, 0, player.size * 0.9, 0, Math.PI * 2)
  ctx.fill()

  drawHair(ctx, 0, 0, player)

  // Backpack
  drawBackpack(ctx, 0, 0, player)

  // Face
  drawPlayerFace(ctx, 0, 0, player)

  // Hands
  drawHands(ctx, 0, 0, player)

  ctx.restore()

  // Draw grabbed objects
  if (isGrabbing) {
    drawGrabbedObjects(ctx, screenX, screenY, player, camera, grabbedBomb, grabbedRock, grabbedEnemy, grabbedWoodenBox)
  }

  // Draw health indicator (only if not in a car)
  if (!isInCar) {
    const heartSize = 15
    const startX = screenX - (player.health * heartSize) / 2
    const startY = screenY - player.size - 20

    // Health hearts
    for (let i = 0; i < player.health; i++) {
      ctx.fillStyle = "#e74c3c"
      ctx.beginPath()
      const heartX = startX + i * heartSize
      // Draw a heart shape
      ctx.moveTo(heartX, startY)
      ctx.bezierCurveTo(heartX - 5, startY - 5, heartX - 10, startY, heartX - 5, startY + 5)
      ctx.lineTo(heartX, startY + 10)
      ctx.lineTo(heartX + 5, startY + 5)
      ctx.bezierCurveTo(heartX + 10, startY, heartX + 5, startY - 5, heartX, startY)
      ctx.fill()
    }
  }

  // Flash player if recently hit
  if (Date.now() - player.lastHit < 500) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)"
    ctx.beginPath()
    ctx.arc(screenX, screenY, player.size * 1.2, 0, Math.PI * 2)
    ctx.fill()
  }

}

// Draw a character using the exact same rendering pipeline as the in-game player
export function drawCharacterPreview(ctx, character, options = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    direction = -Math.PI / 2,
    isMoving = true,
    animationTime = 0,
  } = options

  const previewCharacter = {
    ...character,
    direction,
    isMoving,
    animationTime,
    throwingApple: null,
  }

  const previousState = {
    isGrabbing: gameState.isGrabbing,
    isInCar: gameState.isInCar,
    drivingCar: gameState.drivingCar,
    joystickActive: gameState.joystickActive,
    joystickDistance: gameState.joystickDistance,
    keys: gameState.keys,
  }

  gameState.isGrabbing = false
  gameState.isInCar = false
  gameState.drivingCar = null
  gameState.joystickActive = isMoving
  gameState.joystickDistance = isMoving ? 1 : 0
  gameState.keys = isMoving ? { w: true } : {}

  try {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)

    drawFeet(ctx, 0, 0, previewCharacter)

    ctx.fillStyle = previewCharacter.color
    ctx.beginPath()
    ctx.arc(0, 0, previewCharacter.size * 0.9, 0, Math.PI * 2)
    ctx.fill()

    drawHair(ctx, 0, 0, previewCharacter)

    drawBackpack(ctx, 0, 0, previewCharacter)
    drawPlayerFace(ctx, 0, 0, previewCharacter)
    drawHands(ctx, 0, 0, previewCharacter)

    ctx.restore()
  } finally {
    Object.assign(gameState, previousState)
  }
}

function drawHair(ctx, x, y, player) {
  const hairStyle = player.hairStyle || "none"
  const hairColor = player.hairColor || "#6b4f2a"

  if (hairStyle === "mohawk") {
    drawMohawkHair(ctx, x, y, player, hairColor)
    return
  }

  if (hairStyle === "long") {
    drawLongHair(ctx, x, y, player, hairColor)
    return
  }

  if (hairStyle === "ultraLong") {
    drawUltraLongHair(ctx, x, y, player, hairColor)
    return
  }

  if (hairStyle === "short") {
    drawShortHair(ctx, x, y, player, hairColor)
    return
  }

  if (hairStyle === "bob") {
    drawBobHair(ctx, x, y, player, hairColor)
    return
  }

  if (hairStyle === "curly") {
    drawCurlyHair(ctx, x, y, player, hairColor)
    return
  }

  if (hairStyle === "bun") {
    drawBunHair(ctx, x, y, player, hairColor)
  }
}

function drawMohawkHair(ctx, x, y, player, hairColor) {
  const dirX = Math.cos(player.direction)
  const dirY = Math.sin(player.direction)
  const backReach = player.size * 0.8
  const frontReach = player.size * 0.18
  const lineThickness = player.size * 0.52

  const backX = x - dirX * backReach
  const backY = y - dirY * backReach
  const frontX = x + dirX * frontReach
  const frontY = y + dirY * frontReach

  ctx.save()
  ctx.strokeStyle = hairColor
  ctx.lineWidth = lineThickness
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(backX, backY)
  ctx.lineTo(frontX, frontY)
  ctx.stroke()

  ctx.strokeStyle = "rgba(255, 226, 151, 0.25)"
  ctx.lineWidth = lineThickness * 0.32
  ctx.beginPath()
  ctx.moveTo(backX, backY)
  ctx.lineTo(frontX, frontY)
  ctx.stroke()
  ctx.restore()
}

function drawLongHair(ctx, x, y, player, hairColor) {
  const isMoving = player.isMoving
  const swayTime = player.animationTime * 0.9
  const sway = Math.sin(swayTime) * (isMoving ? player.size * 0.2 : player.size * 0.09)
  const travelBoost = isMoving ? player.size * 0.42 : player.size * 0.18

  const dirX = Math.cos(player.direction)
  const dirY = Math.sin(player.direction)
  const rightX = -dirY
  const rightY = dirX

  const sideSpread = player.size * 0.78
  const anchorBack = player.size * 0.14
  const leftAnchorX = x + rightX * sideSpread - dirX * anchorBack
  const leftAnchorY = y + rightY * sideSpread - dirY * anchorBack
  const rightAnchorX = x - rightX * sideSpread - dirX * anchorBack
  const rightAnchorY = y - rightY * sideSpread - dirY * anchorBack

  const tipDistance = player.size * 1.7 + travelBoost
  const tipX = x - dirX * tipDistance + rightX * sway
  const tipY = y - dirY * tipDistance + rightY * sway

  const leftControlX = leftAnchorX + rightX * player.size * 0.42 - dirX * player.size * 1.08 + rightX * sway * 0.3
  const leftControlY = leftAnchorY + rightY * player.size * 0.42 - dirY * player.size * 1.08 + rightY * sway * 0.3
  const rightControlX = rightAnchorX - rightX * player.size * 0.42 - dirX * player.size * 1.08 + rightX * sway * 0.3
  const rightControlY = rightAnchorY - rightY * player.size * 0.42 - dirY * player.size * 1.08 + rightY * sway * 0.3

  ctx.save()
  ctx.fillStyle = hairColor
  ctx.beginPath()
  ctx.moveTo(leftAnchorX, leftAnchorY)
  ctx.quadraticCurveTo(leftControlX, leftControlY, tipX, tipY)
  ctx.quadraticCurveTo(rightControlX, rightControlY, rightAnchorX, rightAnchorY)
  ctx.quadraticCurveTo(x, y - player.size * 0.3, leftAnchorX, leftAnchorY)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = "rgba(255, 226, 168, 0.22)"
  ctx.lineWidth = Math.max(1.5, player.size * 0.08)
  ctx.beginPath()
  ctx.moveTo(x - dirX * player.size * 0.22 + rightX * player.size * 0.25, y - dirY * player.size * 0.22 + rightY * player.size * 0.25)
  ctx.quadraticCurveTo(
    x - dirX * player.size * 0.95 + rightX * sway * 0.4,
    y - dirY * player.size * 0.95 + rightY * sway * 0.4,
    tipX,
    tipY,
  )
  ctx.stroke()
  ctx.restore()
}

function drawUltraLongHair(ctx, x, y, player, hairColor) {
  const isMoving = player.isMoving
  const swayTime = player.animationTime * 1.0
  const sway = Math.sin(swayTime) * (isMoving ? player.size * 0.26 : player.size * 0.12)
  const travelBoost = isMoving ? player.size * 0.58 : player.size * 0.24

  const dirX = Math.cos(player.direction)
  const dirY = Math.sin(player.direction)
  const rightX = -dirY
  const rightY = dirX

  const sideSpread = player.size * 0.84
  const anchorBack = player.size * 0.12
  const leftAnchorX = x + rightX * sideSpread - dirX * anchorBack
  const leftAnchorY = y + rightY * sideSpread - dirY * anchorBack
  const rightAnchorX = x - rightX * sideSpread - dirX * anchorBack
  const rightAnchorY = y - rightY * sideSpread - dirY * anchorBack

  const tipDistance = player.size * 2.25 + travelBoost
  const tipX = x - dirX * tipDistance + rightX * sway
  const tipY = y - dirY * tipDistance + rightY * sway

  const leftControlX = leftAnchorX + rightX * player.size * 0.52 - dirX * player.size * 1.36 + rightX * sway * 0.34
  const leftControlY = leftAnchorY + rightY * player.size * 0.52 - dirY * player.size * 1.36 + rightY * sway * 0.34
  const rightControlX = rightAnchorX - rightX * player.size * 0.52 - dirX * player.size * 1.36 + rightX * sway * 0.34
  const rightControlY = rightAnchorY - rightY * player.size * 0.52 - dirY * player.size * 1.36 + rightY * sway * 0.34

  ctx.save()
  ctx.fillStyle = hairColor
  ctx.beginPath()
  ctx.moveTo(leftAnchorX, leftAnchorY)
  ctx.quadraticCurveTo(leftControlX, leftControlY, tipX, tipY)
  ctx.quadraticCurveTo(rightControlX, rightControlY, rightAnchorX, rightAnchorY)
  ctx.quadraticCurveTo(x, y - player.size * 0.36, leftAnchorX, leftAnchorY)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = "rgba(255, 226, 168, 0.18)"
  ctx.lineWidth = Math.max(1.5, player.size * 0.08)
  ctx.beginPath()
  ctx.moveTo(x - dirX * player.size * 0.24 + rightX * player.size * 0.28, y - dirY * player.size * 0.24 + rightY * player.size * 0.28)
  ctx.quadraticCurveTo(
    x - dirX * player.size * 1.25 + rightX * sway * 0.38,
    y - dirY * player.size * 1.25 + rightY * sway * 0.38,
    tipX,
    tipY,
  )
  ctx.stroke()
  ctx.restore()
}

function drawRearHeadCap(ctx, x, y, player, hairColor, options = {}) {
  const sideScale = options.sideScale ?? 0.8
  const topScale = options.topScale ?? 1
  const frontScale = options.frontScale ?? 0.15
  const backScale = options.backScale ?? 0.95

  const side = player.size * sideScale
  const front = player.size * frontScale
  const back = player.size * backScale

  ctx.save()
  ctx.fillStyle = hairColor
  ctx.translate(x, y)
  ctx.rotate(player.direction)

  // A back-skewed cap so hair stays behind the face direction.
  ctx.beginPath()
  ctx.moveTo(front, -side * 0.76)
  ctx.quadraticCurveTo(player.size * 0.04, -side * topScale, -back, -side * 0.72)
  ctx.quadraticCurveTo(-back - player.size * 0.18, 0, -back, side * 0.72)
  ctx.quadraticCurveTo(player.size * 0.04, side * topScale, front, side * 0.76)
  ctx.quadraticCurveTo(-player.size * 0.1, 0, front, -side * 0.76)
  ctx.closePath()
  ctx.fill()

  if (options.highlightAlpha) {
    ctx.fillStyle = `rgba(255, 255, 255, ${options.highlightAlpha})`
    ctx.beginPath()
    ctx.ellipse(-player.size * 0.28, -side * 0.54, player.size * 0.24, player.size * 0.14, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawShortHair(ctx, x, y, player, hairColor) {
  const sideScale = Number.isFinite(player.hairSideScale) ? player.hairSideScale : 0.72
  const topScale = Number.isFinite(player.hairTopScale) ? player.hairTopScale : 0.94
  const backScale = Number.isFinite(player.hairBackScale) ? player.hairBackScale : 0.88

  drawRearHeadCap(ctx, x, y, player, hairColor, {
    sideScale,
    topScale,
    frontScale: 0.08,
    backScale,
    highlightAlpha: 0.14,
  })
}

function drawBobHair(ctx, x, y, player, hairColor) {
  const dirX = Math.cos(player.direction)
  const dirY = Math.sin(player.direction)
  const rightX = -dirY
  const rightY = dirX

  drawRearHeadCap(ctx, x, y, player, hairColor, {
    sideScale: 0.86,
    topScale: 1.02,
    frontScale: 0.14,
    backScale: 0.92,
    highlightAlpha: 0.1,
  })

  // Side locks hanging slightly behind jawline
  ctx.save()
  ctx.fillStyle = hairColor

  const leftLockX = x + rightX * player.size * 0.78 - dirX * player.size * 0.36
  const leftLockY = y + rightY * player.size * 0.78 - dirY * player.size * 0.36
  const rightLockX = x - rightX * player.size * 0.78 - dirX * player.size * 0.36
  const rightLockY = y - rightY * player.size * 0.78 - dirY * player.size * 0.36

  for (const [lockX, lockY] of [
    [leftLockX, leftLockY],
    [rightLockX, rightLockY],
  ]) {
    ctx.beginPath()
    ctx.ellipse(lockX, lockY, player.size * 0.2, player.size * 0.34, player.direction + Math.PI / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawCurlyHair(ctx, x, y, player, hairColor) {
  drawRearHeadCap(ctx, x, y, player, hairColor, {
    sideScale: 0.74,
    topScale: 0.96,
    frontScale: 0.1,
    backScale: 0.9,
  })

  const curlCount = 9
  const radius = player.size * 0.19
  const dirX = Math.cos(player.direction)
  const dirY = Math.sin(player.direction)
  const rightX = -dirY
  const rightY = dirX

  ctx.save()
  ctx.fillStyle = hairColor
  for (let i = 0; i < curlCount; i++) {
    const t = i / (curlCount - 1)
    const yOffset = (t - 0.5) * player.size * 1.25
    const backOffset = player.size * (0.44 + (i % 2) * 0.1)
    const jitter = ((i % 3) - 1) * player.size * 0.05
    const curlX = x - dirX * backOffset + rightX * yOffset + rightX * jitter
    const curlY = y - dirY * backOffset + rightY * yOffset + rightY * jitter
    ctx.beginPath()
    ctx.arc(curlX, curlY, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawBunHair(ctx, x, y, player, hairColor) {
  drawRearHeadCap(ctx, x, y, player, hairColor, {
    sideScale: 0.73,
    topScale: 0.92,
    frontScale: 0.15,
    backScale: 0.86,
    highlightAlpha: 0.08,
  })

  const backX = x - Math.cos(player.direction) * player.size * 0.95
  const backY = y - Math.sin(player.direction) * player.size * 0.95

  ctx.save()
  ctx.fillStyle = hairColor
  ctx.beginPath()
  ctx.arc(backX, backY, player.size * 0.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
  ctx.beginPath()
  ctx.arc(backX - player.size * 0.08, backY - player.size * 0.08, player.size * 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Draw hit effects
function drawHitEffects(ctx, camera) {
  if (!gameState.hitEffects) return

  for (let i = gameState.hitEffects.length - 1; i >= 0; i--) {
    const effect = gameState.hitEffects[i]
    const elapsed = Date.now() - effect.createdAt

    // Remove expired effects
    if (elapsed > effect.duration) {
      gameState.hitEffects.splice(i, 1)
      continue
    }

    // Calculate screen position
    const screenX = effect.x - camera.x
    const screenY = effect.y - camera.y

    // Calculate opacity based on lifetime
    const opacity = 1 - elapsed / effect.duration

    // Draw hit effect (expanding circle)
    const size = effect.size * (0.5 + 0.5 * (elapsed / effect.duration))

    ctx.beginPath()
    ctx.arc(screenX, screenY, size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`
    ctx.fill()

    // Draw impact lines
    const lineCount = 8
    const lineLength = size * 0.5

    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`
    ctx.lineWidth = 2

    for (let j = 0; j < lineCount; j++) {
      const angle = (j / lineCount) * Math.PI * 2
      const innerRadius = size * 0.7
      const outerRadius = size + lineLength

      ctx.beginPath()
      ctx.moveTo(screenX + Math.cos(angle) * innerRadius, screenY + Math.sin(angle) * innerRadius)
      ctx.lineTo(screenX + Math.cos(angle) * outerRadius, screenY + Math.sin(angle) * outerRadius)
      ctx.stroke()
    }
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

  if (player.hasLashes) {
    drawEyelashes(ctx, x, y, player)
  }

  if (player.hasBeard) {
    drawBeard(ctx, x, y, player)
  }

  // Nose is drawn after beard so it always appears on top.
  drawNoseIndicator(ctx, x, y, player)

  if (player.hasGlasses || player.hasSunglasses) {
    drawGlasses(ctx, x, y, player)
  }
}

function drawNoseIndicator(ctx, x, y, player) {
  const dirX = Math.cos(player.direction)
  const dirY = Math.sin(player.direction)
  const noseSizeScale = Number.isFinite(player.noseSizeScale) ? player.noseSizeScale : 0.2
  const startOffset = player.size * 0.27
  const indicatorLength = player.size * noseSizeScale
  const startX = x + dirX * startOffset
  const startY = y + dirY * startOffset
  const tipX = startX + dirX * indicatorLength
  const tipY = startY + dirY * indicatorLength

  ctx.save()
  ctx.strokeStyle = player.noseColor || "#7a838a"
  ctx.lineWidth = Math.max(4, player.size * 0.16)
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  // Explicit round tip so the nose end reads as soft/rounded.
  ctx.fillStyle = player.noseColor || "#7a838a"
  ctx.beginPath()
  ctx.arc(tipX, tipY, Math.max(2, player.size * noseSizeScale), 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawBeard(ctx, x, y, player) {
  const beardColor = player.beardColor || "#2b2018"

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(player.direction)

  // Hair-like front cap: follows the front half of the head and extends slightly out.
  const side = player.size * 0.76
  const innerSide = player.size * 0.5
  const front = player.size * 0.44
  const sway = Math.sin(player.animationTime * 0.9) * (player.isMoving ? player.size * 0.08 : 0)
  const tip = player.size * 1.28

  ctx.fillStyle = beardColor
  const innerTip = player.size * 0.58

  const beardPath = new Path2D()
  beardPath.moveTo(front, -side)
  beardPath.quadraticCurveTo(tip, -side * 0.62 + sway, tip, sway)
  beardPath.quadraticCurveTo(tip, side * 0.62 + sway, front, side)

  // Inner carve keeps it as a curved band, not a face blob.
  beardPath.lineTo(front * 0.9, innerSide)
  beardPath.quadraticCurveTo(innerTip, innerSide * 0.5, innerTip, 0)
  beardPath.quadraticCurveTo(innerTip, -innerSide * 0.5, front * 0.9, -innerSide)
  beardPath.closePath()
  ctx.fill(beardPath)

  // Beard fibers: subtle curved streaks like the hair highlights.
  ctx.save()
  ctx.clip(beardPath)
  ctx.strokeStyle = "rgba(255, 228, 190, 0.08)"
  ctx.lineWidth = Math.max(1, player.size * 0.05)
  ctx.lineCap = "round"

  for (let i = -1; i <= 1; i++) {
    const yOffset = (i / 2) * side * 0.96 + sway * 0.8
    ctx.beginPath()
    ctx.moveTo(front + player.size * 0.05, yOffset)
    ctx.quadraticCurveTo(
      tip - player.size * 0.2,
      yOffset + i * side * 0.07,
      tip - player.size * 0.03,
      yOffset + i * side * 0.03,
    )
    ctx.stroke()
  }
  ctx.restore()

  ctx.restore()
}

function drawEyelashes(ctx, x, y, player) {
  const eyeOffset = player.size / 3
  const eyeSize = player.size / 5

  const leftEyeX = x + eyeOffset * Math.cos(player.direction - Math.PI / 4)
  const leftEyeY = y + eyeOffset * Math.sin(player.direction - Math.PI / 4)
  const rightEyeX = x + eyeOffset * Math.cos(player.direction + Math.PI / 4)
  const rightEyeY = y + eyeOffset * Math.sin(player.direction + Math.PI / 4)

  const lashLength = eyeSize * 0.75
  const lashSpread = eyeSize * 0.44

  ctx.save()
  ctx.strokeStyle = "#2f241d"
  ctx.lineWidth = Math.max(1, player.size * 0.055)
  ctx.lineCap = "round"

  for (const [eyeX, eyeY] of [
    [leftEyeX, leftEyeY],
    [rightEyeX, rightEyeY],
  ]) {
    const radialAngle = Math.atan2(eyeY - y, eyeX - x)
    const radialX = Math.cos(radialAngle)
    const radialY = Math.sin(radialAngle)
    const tangentX = -Math.sin(radialAngle)
    const tangentY = Math.cos(radialAngle)

    for (const offset of [-1, 0, 1]) {
      const startX = eyeX + tangentX * lashSpread * offset * 0.55 + radialX * eyeSize * 0.18
      const startY = eyeY + tangentY * lashSpread * offset * 0.55 + radialY * eyeSize * 0.18
      const endX = startX + radialX * lashLength + tangentX * offset * eyeSize * 0.08
      const endY = startY + radialY * lashLength + tangentY * offset * eyeSize * 0.08

      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
    }
  }

  ctx.restore()
}

// Draw a pair of glasses over the player's eyes
function drawGlasses(ctx, x, y, player) {
  const eyeOffset = player.size / 3
  const lensRadius = (player.size / 5) * 1.35
  const leftAngle = player.direction - Math.PI / 4
  const rightAngle = player.direction + Math.PI / 4
  const leftX = x + eyeOffset * Math.cos(leftAngle)
  const leftY = y + eyeOffset * Math.sin(leftAngle)
  const rightX = x + eyeOffset * Math.cos(rightAngle)
  const rightY = y + eyeOffset * Math.sin(rightAngle)

  // Temples hinge outward and wrap around the sides of the head to the ears,
  // which sit roughly 90 degrees off the facing direction.
  const earAngleOffset = Math.PI / 2 + 0.12
  const earRadius = player.size * 0.82
  const hingeRadius = player.size * 0.62
  const hingeAngleOffset = Math.PI / 2.6

  const leftEarAngle = player.direction - earAngleOffset
  const rightEarAngle = player.direction + earAngleOffset
  const leftHingeAngle = player.direction - hingeAngleOffset
  const rightHingeAngle = player.direction + hingeAngleOffset

  ctx.save()
  const lensTint = player.hasSunglasses ? "rgba(32, 32, 32, 0.82)" : "rgba(186, 224, 247, 0.3)"

  ctx.strokeStyle = player.glassesColor || "#2b2b2b"
  ctx.lineWidth = player.hasSunglasses ? Math.max(2.2, player.size * 0.09) : Math.max(1.5, player.size * 0.07)
  ctx.lineCap = "round"

  const leftTempleStartX = leftX + Math.cos(leftAngle) * lensRadius * 0.95
  const leftTempleStartY = leftY + Math.sin(leftAngle) * lensRadius * 0.95
  const rightTempleStartX = rightX + Math.cos(rightAngle) * lensRadius * 0.95
  const rightTempleStartY = rightY + Math.sin(rightAngle) * lensRadius * 0.95

  ctx.beginPath()

  // Left temple arm
  ctx.moveTo(leftTempleStartX, leftTempleStartY)
  ctx.quadraticCurveTo(
    x + hingeRadius * Math.cos(leftHingeAngle),
    y + hingeRadius * Math.sin(leftHingeAngle),
    x + earRadius * Math.cos(leftEarAngle),
    y + earRadius * Math.sin(leftEarAngle),
  )

  // Right temple arm
  ctx.moveTo(rightTempleStartX, rightTempleStartY)
  ctx.quadraticCurveTo(
    x + hingeRadius * Math.cos(rightHingeAngle),
    y + hingeRadius * Math.sin(rightHingeAngle),
    x + earRadius * Math.cos(rightEarAngle),
    y + earRadius * Math.sin(rightEarAngle),
  )
  ctx.stroke()

  // Lenses drawn on top so the frame reads clearly
  ctx.fillStyle = lensTint
  for (const lens of [
    [leftX, leftY],
    [rightX, rightY],
  ]) {
    ctx.beginPath()
    ctx.arc(lens[0], lens[1], lensRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  ctx.restore()
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
  ctx.fillStyle = player.backpackColor || "#8B4513"
  ctx.beginPath()

  // Draw a rounded rectangle for the backpack
  const backpackWidth = player.size * 0.9 * (player.backpackWidthScale || 1)
  const backpackHeight = player.size * 1.6 * (player.backpackHeightScale || 1)
  const backpackCornerRadius = Math.max(2, 4 * (player.backpackRoundness || 1))

  ctx.save()
  ctx.translate(backpackX, backpackY)
  ctx.rotate(backpackAngle)
  ctx.globalAlpha = player.hairStyle === "long" || player.hairStyle === "ultraLong" ? 0.34 : 0.88

  // Draw main backpack body
  roundRect(ctx, -backpackWidth / 2, -backpackHeight / 2, backpackWidth, backpackHeight, backpackCornerRadius)

  // Draw backpack pocket
  ctx.fillStyle = player.backpackPocketColor || "#A0522D"
  roundRect(
    ctx,
    -backpackWidth / 2 + 2,
    -backpackHeight / 2 + 2,
    Math.max(6, backpackWidth - 15),
    backpackHeight - 4,
    Math.max(1.5, backpackCornerRadius * 0.5),
  )

  ctx.restore()
}

// Draw the player's hands
function drawHands(ctx, x, y, player) {
  try {
    const { keys, isGrabbing, isInCar, drivingCar, isMobile, joystickActive, joystickDistance } = gameState;
    
    // Calculate animation offset based on movement or idle state
    let handOffset;
    let handDistance;

    // Check if player is throwing an apple
    if (player.throwingApple && Date.now() - player.throwingApple < THROW_ANIMATION_DURATION) {
      // Calculate throw animation progress (0 to 1)
      const throwProgress = (Date.now() - player.throwingApple) / THROW_ANIMATION_DURATION

      // Normal hand animation for left hand
      if (player.isMoving) {
        handOffset = Math.sin(player.animationTime) * LIMB_MOVEMENT_RANGE
      } else {
        handOffset = Math.sin(player.animationTime) * IDLE_ANIMATION_RANGE
      }

      // Base distance from center
      handDistance = player.size * 1.2

      // Left hand - normal position (perpendicular to movement direction)
      const leftHandAngle = player.direction - Math.PI / 2
      const leftHandX = x + Math.cos(leftHandAngle) * handDistance + Math.cos(player.direction) * -handOffset
      const leftHandY = y + Math.sin(leftHandAngle) * handDistance + Math.sin(player.direction) * -handOffset

      // Draw left hand
      ctx.fillStyle = player.handColor || "#AAAAAA"
      ctx.beginPath()
      ctx.arc(leftHandX, leftHandY, HAND_SIZE, 0, Math.PI * 2)
      ctx.fill()

      // Right hand - throwing animation
      // First half of animation: hand moves back
      // Second half of animation: hand swings forward
      let rightHandAngle, rightHandDistance

      if (throwProgress < 0.5) {
        // Moving back (wind up)
        const windupProgress = throwProgress * 2 // 0 to 1 during first half
        rightHandAngle = player.direction + Math.PI / 2 + (Math.PI / 4) * windupProgress
        rightHandDistance = handDistance * (1 - windupProgress * 0.3)
      } else {
        // Moving forward (throw)
        const throwForwardProgress = (throwProgress - 0.5) * 2 // 0 to 1 during second half
        rightHandAngle = player.direction + Math.PI / 4 - (Math.PI / 2) * throwForwardProgress
        rightHandDistance = handDistance * (0.7 + throwForwardProgress * 0.6)
      }

      const rightHandX = x + Math.cos(rightHandAngle) * rightHandDistance
      const rightHandY = y + Math.sin(rightHandAngle) * rightHandDistance

      // Draw right hand
      ctx.fillStyle = player.handColor || "#AAAAAA"
      ctx.beginPath()
      ctx.arc(rightHandX, rightHandY, HAND_SIZE, 0, Math.PI * 2)
      ctx.fill()

      // Draw a trail effect for the melee attack during the forward swing
      // Always show the trail effect regardless of apple count to make melee attack more visible
      if (throwProgress >= 0.5 && throwProgress <= 0.9) {
        const trailOpacity = 0.6 * (1 - (throwProgress - 0.5) * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${trailOpacity})`

        // Draw a trail arc following the hand movement
        ctx.beginPath()
        const trailAngle = player.direction + Math.PI / 4
        const arcStartAngle = trailAngle - Math.PI / 3
        const arcEndAngle = trailAngle + Math.PI / 3
        ctx.arc(x, y, rightHandDistance, arcStartAngle, arcEndAngle)
        ctx.lineWidth = HAND_SIZE * 2
        ctx.strokeStyle = `rgba(255, 255, 255, ${trailOpacity})`
        ctx.stroke()
      }

      // Reset throwing state if animation is complete
      if (throwProgress >= 1) {
        player.throwingApple = null
      }
    }
    // Check if player is driving a car
    else if (isInCar && drivingCar) {
      // When driving, position hands forward as if holding a steering wheel
      handDistance = player.size * 1.2;
      
      // Calculate steering wheel rotation based on direction change
      const steeringAngle = Math.sin(gameState.carDirectionChange || 0) * 0.3; // Max 30-degree rotation
      
      // Left hand position (left side of wheel)
      const leftHandAngle = player.direction - Math.PI/6 + steeringAngle;
      const leftHandX = x + Math.cos(leftHandAngle) * handDistance;
      const leftHandY = y + Math.sin(leftHandAngle) * handDistance;
      
      // Right hand position (right side of wheel)
      const rightHandAngle = player.direction + Math.PI/6 + steeringAngle;
      const rightHandX = x + Math.cos(rightHandAngle) * handDistance;
      const rightHandY = y + Math.sin(rightHandAngle) * handDistance;
      
      // Draw hands (light gray)
      ctx.fillStyle = player.handColor || "#AAAAAA";
      
      // Left hand
      ctx.beginPath();
      ctx.arc(leftHandX, leftHandY, HAND_SIZE, 0, Math.PI * 2);
      ctx.fill();
      
      // Right hand
      ctx.beginPath();
      ctx.arc(rightHandX, rightHandY, HAND_SIZE, 0, Math.PI * 2);
      ctx.fill();
    }
    // Check if player is carrying something
    else if (isGrabbing) {
      // When carrying, position hands forward in the direction player is facing
      handOffset = 0 // No animation when carrying
      handDistance = player.size * 1.5 // Extended forward position

      // Calculate positions for hands (both in front, slightly apart)
      const handAngle1 = player.direction + Math.PI / 8 // Right hand, slightly to the right
      const handAngle2 = player.direction - Math.PI / 8 // Left hand, slightly to the left

      // Calculate hand positions with fixed forward position
      const rightHandX = x + Math.cos(handAngle1) * handDistance
      const rightHandY = y + Math.sin(handAngle1) * handDistance

      const leftHandX = x + Math.cos(handAngle2) * handDistance
      const leftHandY = y + Math.sin(handAngle2) * handDistance

      // Draw hands (light gray)
      ctx.fillStyle = player.handColor || "#AAAAAA"

      // Right hand
      ctx.beginPath()
      ctx.arc(rightHandX, rightHandY, HAND_SIZE, 0, Math.PI * 2)
      ctx.fill()

      // Left hand
      ctx.beginPath()
      ctx.arc(leftHandX, leftHandY, HAND_SIZE, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Normal hand animation when not carrying
      const isMovingForward = player.isMoving && 
        (isMobile ? joystickActive && joystickDistance > 0.1 : (keys["ArrowUp"] || keys["w"]));
      
      if (isMovingForward) {
        // Walking/running animation only when moving forward
        handOffset = Math.sin(player.animationTime) * LIMB_MOVEMENT_RANGE;
      } else {
        // Idle animation - subtle breathing movement
        handOffset = Math.sin(player.animationTime * 0.5) * IDLE_ANIMATION_RANGE;
      }

      // Base distance from center
      handDistance = player.size * 1.2;

      // Calculate positions for hands (perpendicular to movement direction)
      const handAngle1 = player.direction + Math.PI / 2; // Right hand
      const handAngle2 = player.direction - Math.PI / 2; // Left hand

      // Calculate hand positions with animation
      // When idle, make hands move slightly outward and inward (breathing effect)
      const breathingFactor = isMovingForward ? 0 : Math.sin(player.animationTime * 0.5) * 3;
      
      const rightHandX = x + Math.cos(handAngle1) * (handDistance + breathingFactor) + 
                         (isMovingForward ? Math.cos(player.direction) * handOffset : 0);
      const rightHandY = y + Math.sin(handAngle1) * (handDistance + breathingFactor) + 
                         (isMovingForward ? Math.sin(player.direction) * handOffset : 0);

      const leftHandX = x + Math.cos(handAngle2) * (handDistance + breathingFactor) + 
                        (isMovingForward ? Math.cos(player.direction) * -handOffset : 0);
      const leftHandY = y + Math.sin(handAngle2) * (handDistance + breathingFactor) + 
                        (isMovingForward ? Math.sin(player.direction) * -handOffset : 0);

      // Draw hands (light gray)
      ctx.fillStyle = player.handColor || "#AAAAAA";

      // Right hand
      ctx.beginPath();
      ctx.arc(rightHandX, rightHandY, HAND_SIZE, 0, Math.PI * 2);
      ctx.fill();

      // Left hand
      ctx.beginPath();
      ctx.arc(leftHandX, leftHandY, HAND_SIZE, 0, Math.PI * 2);
      ctx.fill();
    }
  } catch (error) {
    console.error("Error in drawHands:", error);
  }
}

// Draw the player's feet
function drawFeet(ctx, x, y, player) {
  const { keys, isInCar, drivingCar, isMobile, joystickActive, joystickDistance } = gameState;
  
  // Only animate feet when moving forward and not in a car
  const isMovingForward = player.isMoving && 
    (isMobile ? joystickActive && joystickDistance > 0.1 : (keys["ArrowUp"] || keys["w"]));
  const footOffset = (isMovingForward && !isInCar) 
    ? Math.sin(player.animationTime) * LIMB_MOVEMENT_RANGE 
    : 0;

  // Calculate positions for feet (slightly behind the player)
  const footAngle1 = player.direction + Math.PI + Math.PI / 2; // Right foot
  const footAngle2 = player.direction + Math.PI - Math.PI / 2; // Left foot

  // Base distance from center
  const footDistance = player.size * 0.7;

  // Calculate foot positions with animation
  const rightFootX = x + Math.cos(footAngle1) * footDistance + Math.cos(player.direction) * footOffset;
  const rightFootY = y + Math.sin(footAngle1) * footDistance + Math.sin(player.direction) * footOffset;

  const leftFootX = x + Math.cos(footAngle2) * footDistance + Math.cos(player.direction) * -footOffset;
  const leftFootY = y + Math.sin(footAngle2) * footDistance + Math.sin(player.direction) * -footOffset;

  // Draw feet (dark gray)
  ctx.fillStyle = "#444444";

  // Right foot
  ctx.beginPath();
  ctx.arc(rightFootX, rightFootY, FOOT_SIZE, 0, Math.PI * 2);
  ctx.fill();

  // Left foot
  ctx.beginPath();
  ctx.arc(leftFootX, leftFootY, FOOT_SIZE, 0, Math.PI * 2);
  ctx.fill();
}

// Draw grabbed objects (bombs or rocks)
function drawGrabbedObjects(ctx, screenX, screenY, player, camera, grabbedBomb, grabbedRock, grabbedEnemy, grabbedWoodenBox) {
  try {
    if (grabbedBomb) {
      const bombScreenX = grabbedBomb.x - camera.x
      const bombScreenY = grabbedBomb.y - camera.y

      // Draw bomb shadow using shape-specific shadow for rounded rectangle
      // Use smaller shadow scale when object is being carried
      createShadow(
        ctx,
        bombScreenX,
        bombScreenY,
        grabbedBomb.size,
        "rectangle",
        {
          width: grabbedBomb.size,
          height: grabbedBomb.size,
          radius: grabbedBomb.size / 4,
        },
        0,
        0.95,
      )

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

      if (grabbedRock.isHammerShaped) {
        const rockBlockSize = grabbedRock.size * 0.88
        createShadow(
          ctx,
          rockScreenX,
          rockScreenY,
          rockBlockSize,
          "rectangle",
          { width: rockBlockSize, height: rockBlockSize, radius: 4 },
          0,
          0.95,
        )
      } else if (grabbedRock.texture === 0) {
        // Rounded rock shadow
        createShadow(ctx, rockScreenX, rockScreenY, grabbedRock.size, "circle", null, 0, 0.95)
      } else if (grabbedRock.texture === 1) {
        // Angular rock shadow
        createShadow(ctx, rockScreenX, rockScreenY, grabbedRock.size, "polygon", null, grabbedRock.rotation, 0.95)
      } else {
        // Oval rock shadow
        createShadow(ctx, rockScreenX, rockScreenY, grabbedRock.size, "oval", null, grabbedRock.rotation, 0.95)
      }

      // Draw rock
      ctx.save()
      ctx.translate(rockScreenX, rockScreenY)
      ctx.rotate(grabbedRock.rotation)

      // Base rock shape
      ctx.fillStyle = "#7f8c8d" // Base rock color
      ctx.beginPath()

      if (grabbedRock.isHammerShaped) {
        const rockBlockSize = grabbedRock.size * 0.88
        const halfBlockSize = rockBlockSize / 2

        ctx.fillRect(-halfBlockSize, -halfBlockSize, rockBlockSize, rockBlockSize)
        ctx.fillStyle = "#6b7778"
        ctx.fillRect(-rockBlockSize * 0.34, -rockBlockSize * 0.34, rockBlockSize * 0.68, rockBlockSize * 0.16)
        ctx.fillRect(-rockBlockSize * 0.34, -rockBlockSize * 0.06, rockBlockSize * 0.68, rockBlockSize * 0.16)
        ctx.fillStyle = "#9aa8a8"
        ctx.fillRect(-rockBlockSize * 0.4, -rockBlockSize * 0.4, rockBlockSize * 0.26, rockBlockSize * 0.14)
      } else if (grabbedRock.texture === 0) {
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
      if (!grabbedRock.isHammerShaped) {
        ctx.fill()

        // Reuse the rock's cached speckles so a carried rock keeps the same
        // markings instead of flickering every frame.
        if (!grabbedRock.speckles) {
          grabbedRock.speckles = []
          for (let j = 0; j < 5; j++) {
            const detailX = (Math.random() - 0.5) * grabbedRock.size
            const detailY = (Math.random() - 0.5) * grabbedRock.size
            const detailSize = 2 + Math.random() * 5

            if (detailX * detailX + detailY * detailY < grabbedRock.size * 0.7 * (grabbedRock.size * 0.7)) {
              grabbedRock.speckles.push({ x: detailX, y: detailY, size: detailSize })
            }
          }
        }

        ctx.fillStyle = "#6c7a7a"
        for (const speckle of grabbedRock.speckles) {
          ctx.beginPath()
          ctx.arc(speckle.x, speckle.y, speckle.size, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.fillStyle = "#95a5a6"
        ctx.beginPath()
        ctx.arc(-grabbedRock.size * 0.3, -grabbedRock.size * 0.3, grabbedRock.size * 0.2, 0, Math.PI * 2)
        ctx.fill()
      }

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
    } else if (grabbedWoodenBox) {
      // The wooden box drawing is handled in wooden-boxes.js
      // We don't need to duplicate the rendering code here
    } else if (grabbedEnemy) {
      // Draw grabbed enemy
      const enemyScreenX = grabbedEnemy.x - camera.x
      const enemyScreenY = grabbedEnemy.y - camera.y

      // Draw enemy shadow with reduced size
      createShadow(ctx, enemyScreenX, enemyScreenY, grabbedEnemy.size, "circle", null, 0, 0.95)

      // Draw enemy (circle with details)
      ctx.fillStyle = grabbedEnemy.isChasing ? "#ff3b30" : grabbedEnemy.color
      ctx.beginPath()
      ctx.arc(enemyScreenX, enemyScreenY, grabbedEnemy.size, 0, Math.PI * 2)
      ctx.fill()

      // Draw enemy eyes
      const eyeOffset = grabbedEnemy.size / 3
      const eyeSize = grabbedEnemy.size / 5

      // Left eye
      ctx.fillStyle = "white"
      ctx.beginPath()
      ctx.arc(
        enemyScreenX - eyeOffset * Math.cos(grabbedEnemy.direction),
        enemyScreenY - eyeOffset * Math.sin(grabbedEnemy.direction),
        eyeSize,
        0,
        Math.PI * 2,
      )
      ctx.fill()

      // Right eye
      ctx.beginPath()
      ctx.arc(
        enemyScreenX + eyeOffset * Math.sin(grabbedEnemy.direction),
        enemyScreenY - eyeOffset * Math.cos(grabbedEnemy.direction),
        eyeSize,
        0,
        Math.PI * 2,
      )
      ctx.fill()

      // Eye pupils
      ctx.fillStyle = "black"
      ctx.beginPath()
      ctx.arc(
        enemyScreenX - eyeOffset * Math.cos(grabbedEnemy.direction) + (eyeSize / 3) * Math.cos(grabbedEnemy.direction),
        enemyScreenY - eyeOffset * Math.sin(grabbedEnemy.direction) + (eyeSize / 3) * Math.sin(grabbedEnemy.direction),
        eyeSize / 2,
        0,
        Math.PI * 2,
      )
      ctx.fill()

      ctx.beginPath()
      ctx.arc(
        enemyScreenX + eyeOffset * Math.sin(grabbedEnemy.direction) + (eyeSize / 3) * Math.cos(grabbedEnemy.direction),
        enemyScreenY - eyeOffset * Math.cos(grabbedEnemy.direction) + (eyeSize / 3) * Math.sin(grabbedEnemy.direction),
        eyeSize / 2,
        0,
        Math.PI * 2,
      )
      ctx.fill()

      // Draw connection line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(enemyScreenX, enemyScreenY)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw a "dizzy" effect to show the enemy is being carried
      const time = Date.now() / 200
      const dizzySize = 3 + Math.sin(time) * 1

      ctx.fillStyle = "yellow"
      for (let i = 0; i < 3; i++) {
        const angle = time + (i * Math.PI * 2) / 3
        const orbitRadius = grabbedEnemy.size * 0.8
        const starX = enemyScreenX + Math.cos(angle) * orbitRadius
        const starY = enemyScreenY + Math.sin(angle) * orbitRadius - grabbedEnemy.size / 2

        // Draw a small star
        ctx.beginPath()
        ctx.arc(starX, starY, dizzySize, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } catch (error) {
    console.error("Error in drawGrabbedObjects:", error)
  }
}

// Import roundRect after using it to avoid circular dependency
import { roundRect } from "../utils/rendering-utils.js"