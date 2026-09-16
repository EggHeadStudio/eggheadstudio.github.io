// Bomb entity
import { gameState } from "../core/game-state.js"
import { BOMB_SIZE, BOMB_FLOAT_SPEED } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow, roundRect } from "../utils/rendering-utils.js"
import { isPlayerPositionClear, movePlayerToNearestSafePosition } from "../utils/player-position-utils.js"
import { isWaterPosition } from "../utils/spawn-utils.js"
import { createExplosion } from "./explosions.js"
import { createRockWaterSplashEffect } from "./rocks.js"
import { getRandomColor } from "../utils/color-utils.js"
import { isExplosionPathBlocked } from "../utils/explosion-shadow.js"
import { getPickupRevealTransform, isPickupReady } from "../utils/pickup-reveal.js"
import { updateBombCounter } from "../ui/ui-manager.js"

// Create a single bomb pickup. Bombs are only ever found inside wooden crates,
// so this is called from the crate drop logic rather than a world spawner.
export function createBomb(x, y) {
  return {
    x,
    y,
    size: BOMB_SIZE,
    color: getRandomColor(),
    countdown: null,
    exploding: false,
  }
}

// Try to grab a bomb
export function tryGrabBomb() {
  const { player, bombs } = gameState

  for (let i = 0; i < bombs.length; i++) {
    const bomb = bombs[i]

    // Skip bombs that are counting down
    if (bomb.countdown !== null) continue

    // A bomb still popping out of a crate cannot be snatched yet.
    if (!isPickupReady(bomb)) continue

    const distance = getDistance(player.x, player.y, bomb.x, bomb.y)

    if (distance < player.size + bomb.size) {
      gameState.isGrabbing = true
      gameState.grabbedBomb = bomb
      bombs.splice(i, 1) // Remove from bombs array
      return true
    }
  }
  return false
}

// Detonate any bomb that has a countdown
export function detonateAnyBombWithCountdown() {
  const { bombs } = gameState

  for (let i = 0; i < bombs.length; i++) {
    const bomb = bombs[i]

    // Only consider bombs that are counting down
    if (bomb.countdown !== null) {
      // Remove the bomb first so the chain reaction inside createExplosion
      // cannot see it again.
      bombs.splice(i, 1)

      // createExplosion runs the chain reaction itself, with the rock
      // shadowing applied.
      createExplosion(bomb.x, bomb.y, 100 + Math.random() * 50)

      return true
    }
  }
  return false
}

// Check for chain reaction with other bombs
export function checkBombChainReaction(explosionX, explosionY, explosionRadius, blockers = []) {
  const { bombs } = gameState

  // Create a copy of the bombs array to safely modify the original during iteration
  const bombsToCheck = [...bombs]

  // Track bombs that will be detonated in the chain reaction
  const bombsToDetonate = []

  // Check each bomb to see if it's in the explosion radius
  for (let i = 0; i < bombsToCheck.length; i++) {
    const bomb = bombsToCheck[i]

    // Skip the bomb if it's already counting down
    if (bomb.countdown !== null) continue

    // Calculate distance from explosion center to this bomb
    const distance = getDistance(explosionX, explosionY, bomb.x, bomb.y)

    // If bomb is within explosion radius, add it to detonation list
    if (distance < explosionRadius + bomb.size) {
      // A bomb sheltered behind a rock is not set off by the blast.
      if (isExplosionPathBlocked(explosionX, explosionY, bomb.x, bomb.y, blockers)) {
        continue
      }

      // Find the index in the original bombs array
      const bombIndex = bombs.indexOf(bomb)
      if (bombIndex !== -1) {
        bombsToDetonate.push({
          bomb: bomb,
          index: bombIndex,
          // Add a small random delay for more natural chain reaction
          delay: Math.random() * 200 + 50,
        })
      }
    }
  }

  // Detonate each affected bomb with a slight delay. The delay is stored as a
  // countdown timestamp so the game loop owns it: chained blasts then freeze
  // with a paused game and survive a save/restore, unlike a raw setTimeout.
  bombsToDetonate.forEach((bombData) => {
    if (bombs.indexOf(bombData.bomb) === -1) {
      return
    }

    bombData.bomb.countdown = Date.now() + bombData.delay
  })
}

// Release a grabbed bomb
export function releaseBomb() {
  const { player, grabbedBomb, bombs } = gameState

  if (grabbedBomb) {
    // Start countdown when released
    grabbedBomb.countdown = Date.now() + 3000 // 3 seconds
    bombs.push(grabbedBomb)

    if (!isPlayerPositionClear(player.x, player.y)) {
      movePlayerToNearestSafePosition(player.x, player.y, grabbedBomb.x, grabbedBomb.y)
    }

    gameState.grabbedBomb = null
    gameState.isGrabbing = false
    return true
  }
  return false
}

export function placeSelectedBomb() {
  const { player, bombs } = gameState

  if (!player || gameState.isInCar || gameState.isGrabbing) {
    return false
  }

  if (gameState.selectedWeapon !== "bomb" || (player.bombs ?? 0) <= 0) {
    return false
  }

  const placeDistance = player.size + BOMB_SIZE * 1.35
  const bomb = {
    x: player.x + Math.cos(player.direction) * placeDistance,
    y: player.y + Math.sin(player.direction) * placeDistance,
    size: BOMB_SIZE,
    color: getRandomColor(),
    countdown: Date.now() + 3000,
    exploding: false,
  }

  bombs.push(bomb)
  player.bombs = Math.max(0, (player.bombs ?? 0) - 1)
  updateBombCounter()

  if (!isPlayerPositionClear(player.x, player.y)) {
    movePlayerToNearestSafePosition(player.x, player.y, bomb.x, bomb.y)
  }

  return true
}

// A bomb that ends up in water bobs and drifts along like a wooden crate
// instead of resting on the surface, right up until its countdown runs out.
function updateBombFloating(bomb) {
  const inWater = isWaterPosition(bomb.x, bomb.y)

  if (!bomb.isFloating) {
    if (inWater) {
      bomb.isFloating = true
      bomb.floatAngle = Math.random() * Math.PI * 2
      bomb.floatOffset = 0
      createRockWaterSplashEffect(bomb.x, bomb.y, bomb.size * 2)
    }
    return
  }

  // Drifted back ashore, so it settles where it beached.
  if (!inWater) {
    bomb.isFloating = false
    bomb.floatOffset = 0
    return
  }

  bomb.floatOffset = Math.sin(Date.now() / 500) * 3
  bomb.x += Math.cos(bomb.floatAngle) * BOMB_FLOAT_SPEED
  bomb.y += Math.sin(bomb.floatAngle) * BOMB_FLOAT_SPEED

  // Wander a little so a drifting bomb does not track a dead straight line.
  if (Math.random() < 0.02) {
    bomb.floatAngle += ((Math.random() - 0.5) * Math.PI) / 4
  }
}

// Modify the drawAndUpdateBombs function to use normal shadow scale
export function drawAndUpdateBombs() {
  try {
    const { bombs, camera, ctx, player } = gameState

    for (let i = bombs.length - 1; i >= 0; i--) {
      const bomb = bombs[i]
      if (!bomb) continue // Skip if bomb is undefined

      if (
        bomb.countdown === null &&
        isPickupReady(bomb) &&
        player &&
        getDistance(player.x, player.y, bomb.x, bomb.y) < player.size + bomb.size
      ) {
        player.bombs = (player.bombs ?? 0) + 1
        bombs.splice(i, 1)
        updateBombCounter()
        continue
      }

      updateBombFloating(bomb)

      const screenX = bomb.x - camera.x
      const screenY = bomb.y - camera.y

      // Skip if bomb is off-screen
      if (
        screenX < -bomb.size ||
        screenX > ctx.canvas.width + bomb.size ||
        screenY < -bomb.size ||
        screenY > ctx.canvas.height + bomb.size
      ) {
        // If bomb is counting down but off-screen, still check for explosion
        if (bomb.countdown !== null && Date.now() >= bomb.countdown) {
          const bombX = bomb.x
          const bombY = bomb.y

          bombs.splice(i, 1)
          createExplosion(bombX, bombY, 100 + Math.random() * 50)
        }
        continue
      }

      // A bomb freshly revealed by a broken crate hops into view at a reduced
      // size, so the body is drawn scaled and lifted while the shadow stays
      // put on the ground.
      const reveal = getPickupRevealTransform(bomb)
      const drawSize = bomb.size * reveal.scale
      // A floating bomb bobs on the swell while its shadow stays put below.
      const drawY = screenY - reveal.lift - (bomb.isFloating ? bomb.floatOffset : 0)

      // Draw shadow using shape-specific shadow for rounded rectangle
      // Increase shadow size for better visibility
      // Use normal shadow scale (1.0) for bombs on the ground
      createShadow(
        ctx,
        screenX,
        screenY,
        bomb.size * 1.2,
        "rectangle",
        {
          width: bomb.size,
          height: bomb.size,
          radius: bomb.size / 4,
        },
        0,
        1.0,
      )

      // Check if bomb should explode
      if (bomb.countdown !== null && Date.now() >= bomb.countdown) {
        const bombX = bomb.x
        const bombY = bomb.y

        bombs.splice(i, 1)
        createExplosion(bombX, bombY, 100 + Math.random() * 50)

        continue
      }

      // Draw bomb (rounded rectangle with fuse)
      ctx.fillStyle = bomb.color
      roundRect(ctx, screenX - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize, drawSize / 4)

      // Draw bomb fuse
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(screenX, drawY - drawSize / 2)

      // Make fuse wiggle
      const time = Date.now() / 200
      const fuseHeight = drawSize / 2
      const wiggle = Math.sin(time) * 5

      ctx.bezierCurveTo(
        screenX + wiggle,
        drawY - drawSize / 2 - fuseHeight / 3,
        screenX - wiggle,
        drawY - drawSize / 2 - (fuseHeight * 2) / 3,
        screenX,
        drawY - drawSize / 2 - fuseHeight,
      )
      ctx.stroke()

      // Draw spark on fuse if counting down
      if (bomb.countdown !== null) {
        const countdownProgress = 1 - (bomb.countdown - Date.now()) / 3000
        const sparkY = drawY - drawSize / 2 - fuseHeight * countdownProgress

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
        ctx.fillText(secondsLeft.toString(), screenX, drawY)

        // Draw pulsing circle around bomb
        const pulseSize = Math.sin(Date.now() / 100) * 5 + 10
        ctx.strokeStyle = "rgba(255, 0, 0, 0.7)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(screenX, drawY, drawSize / 2 + pulseSize, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  } catch (error) {
    console.error("Error in drawAndUpdateBombs:", error)
  }
}