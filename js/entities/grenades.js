// Grenade entity
//
// A grenade is a lighter, thrown bomb. The throw is charged by holding the
// fire button: hold time sets both how far and how fast it flies. While in the
// air it is drawn lifted off the ground with a separate shadow underneath, so
// the arc reads correctly from the top-down camera.
import { gameState } from "../core/game-state.js"
import {
  CAR_SIZE,
  GRENADE_SIZE,
  GRENADE_FUSE_MS,
  GRENADE_MAX_CHARGE_MS,
  GRENADE_MIN_THROW_DISTANCE,
  GRENADE_MAX_THROW_DISTANCE_SCREENS,
  GRENADE_MIN_FLIGHT_FRAMES,
  GRENADE_MAX_FLIGHT_FRAMES,
  GRENADE_MAX_ARC_HEIGHT,
  GRENADE_COLLIDE_HEIGHT,
  GRENADE_EXPLOSION_RADIUS,
  GRENADE_SINK_MIN_SCALE,
  GRENADE_SINK_MIN_ALPHA,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { isWaterPosition } from "../utils/spawn-utils.js"
import { getPickupRevealTransform, isPickupReady } from "../utils/pickup-reveal.js"
import { createExplosion } from "./explosions.js"
import { createRockWaterSplashEffect } from "./rocks.js"
import { updateGrenadeCounter } from "../ui/ui-manager.js"

const GRENADE_BODY_COLOR = "#4a6b33"
const GRENADE_BODY_HIGHLIGHT = "#6f9b4c"
const GRENADE_LEVER_COLOR = "#b9c0c4"
const PIN_LIFETIME_MS = 1400

// Create a grenade pickup. Grenades are only found inside wooden crates, so
// this is called from the crate drop logic.
export function createGrenade(x, y) {
  return {
    x,
    y,
    size: GRENADE_SIZE,
  }
}

// ---------------------------------------------------------------------------
// Charging
// ---------------------------------------------------------------------------

export function canThrowGrenade() {
  const { player } = gameState

  if (!player || gameState.gameOver || gameState.isInCar || gameState.isGrabbing) {
    return false
  }

  return gameState.selectedWeapon === "grenade" && (player.grenades ?? 0) > 0
}

export function beginGrenadeCharge() {
  if (!canThrowGrenade()) {
    return false
  }

  gameState.grenadeCharge = {
    active: true,
    startTime: Date.now(),
  }

  return true
}

// 0 while just tapped, 1 once the button has been held for the full charge time.
export function getGrenadeChargePower() {
  const charge = gameState.grenadeCharge

  if (!charge || !charge.active) {
    return 0
  }

  const held = Date.now() - charge.startTime
  return Math.min(Math.max(held / GRENADE_MAX_CHARGE_MS, 0), 1)
}

export function isChargingGrenade() {
  return Boolean(gameState.grenadeCharge?.active)
}

export function cancelGrenadeCharge() {
  gameState.grenadeCharge = null
}

// ---------------------------------------------------------------------------
// Throwing
// ---------------------------------------------------------------------------

function getAimAngle() {
  const { player, isMobile, mousePosition, canvas } = gameState

  if (isMobile || !canvas) {
    return player.direction
  }

  return Math.atan2(mousePosition.y - canvas.height / 2, mousePosition.x - canvas.width / 2)
}

// Release the charged throw. Returns true when a grenade actually left the hand.
export function releaseGrenadeThrow() {
  const power = getGrenadeChargePower()
  const wasCharging = isChargingGrenade()

  cancelGrenadeCharge()

  if (!wasCharging || !canThrowGrenade()) {
    return false
  }

  const { player, canvas } = gameState
  const angle = getAimAngle()

  // Full power lands a little past the screen edge; a tap barely drops it.
  const screenReach = (canvas?.width || 900) * GRENADE_MAX_THROW_DISTANCE_SCREENS
  const distance = GRENADE_MIN_THROW_DISTANCE + (screenReach - GRENADE_MIN_THROW_DISTANCE) * power
  const flightFrames = GRENADE_MIN_FLIGHT_FRAMES + (GRENADE_MAX_FLIGHT_FRAMES - GRENADE_MIN_FLIGHT_FRAMES) * power

  const startX = player.x + Math.cos(angle) * (player.size * 0.6)
  const startY = player.y + Math.sin(angle) * (player.size * 0.6)

  gameState.thrownGrenades.push({
    x: startX,
    y: startY,
    startX,
    startY,
    size: GRENADE_SIZE,
    angle,
    velocityX: (Math.cos(angle) * distance) / flightFrames,
    velocityY: (Math.sin(angle) * distance) / flightFrames,
    flightFrames,
    framesFlown: 0,
    // Peak of the arc. A gentle toss stays low, a full throw lobs high.
    arcHeight: GRENADE_MAX_ARC_HEIGHT * (0.25 + power * 0.75),
    height: 0,
    landed: false,
    spin: Math.random() * Math.PI * 2,
    fuseAt: Date.now() + GRENADE_FUSE_MS,
  })

  spawnGrenadePin(player.x, player.y, angle)

  player.grenades = Math.max(0, (player.grenades ?? 0) - 1)
  player.throwingApple = Date.now() // Reuse the existing throw animation
  updateGrenadeCounter()

  return true
}

// The safety pin pops off next to the player as the grenade leaves the hand.
function spawnGrenadePin(x, y, angle) {
  if (!Array.isArray(gameState.grenadePins)) {
    gameState.grenadePins = []
  }

  // Kick the pin out sideways from the throw so it does not follow the grenade.
  const sideAngle = angle + (Math.random() < 0.5 ? -1 : 1) * (Math.PI * 0.45 + Math.random() * 0.3)

  gameState.grenadePins.push({
    x,
    y,
    velocityX: Math.cos(sideAngle) * (0.9 + Math.random() * 0.8),
    velocityY: Math.sin(sideAngle) * (0.9 + Math.random() * 0.8),
    height: 12 + Math.random() * 6,
    verticalSpeed: 1.1,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.5,
    createdAt: Date.now(),
  })
}

function detonateGrenade(grenade, index) {
  gameState.thrownGrenades.splice(index, 1)
  createExplosion(grenade.x, grenade.y, GRENADE_EXPLOSION_RADIUS)
}

// A thrown grenade sails clear over scenery, so the only thing that can stop it
// mid-flight is smacking straight into an enemy at low altitude.
function findGrenadeEnemyHit(grenade) {
  if (grenade.height > GRENADE_COLLIDE_HEIGHT) {
    return false
  }

  for (const enemy of gameState.enemies) {
    if (getDistance(grenade.x, grenade.y, enemy.x, enemy.y) < grenade.size + enemy.size) {
      return true
    }
  }

  return false
}

// Once the arc runs out, coming down on top of something counts as an impact
// and the grenade goes off where it landed instead of resting there.
function didGrenadeLandOnObstacle(grenade) {
  const { rocks, woodenBoxes, cars, boats, trees } = gameState
  const reach = grenade.size

  for (const rock of rocks) {
    if (getDistance(grenade.x, grenade.y, rock.x, rock.y) < reach + rock.size * 0.8) {
      return true
    }
  }

  if (Array.isArray(woodenBoxes)) {
    for (const box of woodenBoxes) {
      if (getDistance(grenade.x, grenade.y, box.x, box.y) < reach + box.size * 0.8) {
        return true
      }
    }
  }

  if (Array.isArray(trees)) {
    for (const tree of trees) {
      if (getDistance(grenade.x, grenade.y, tree.x, tree.y) < reach + (tree.trunkSize || tree.size * 0.3)) {
        return true
      }
    }
  }

  for (const car of cars) {
    if (getDistance(grenade.x, grenade.y, car.x, car.y) < reach + car.size * 0.4) {
      return true
    }
  }

  for (const boat of boats) {
    if (getDistance(grenade.x, grenade.y, boat.x, boat.y) < reach + boat.size * 0.45) {
      return true
    }
  }

  return false
}

// Splashing down does not put the fuse out. The grenade just sinks away over
// whatever fuse time is left, so the blast still goes off on schedule.
function startGrenadeSinking(grenade) {
  grenade.sinking = true
  grenade.sinkStartedAt = Date.now()
  createRockWaterSplashEffect(grenade.x, grenade.y, grenade.size * 2.2)
}

// 0 the instant it hits the surface, 1 by the time the fuse runs out.
function getGrenadeSinkProgress(grenade) {
  if (!grenade.sinking) {
    return 0
  }

  const span = grenade.fuseAt - grenade.sinkStartedAt

  if (span <= 0) {
    return 1
  }

  return Math.min(Math.max((Date.now() - grenade.sinkStartedAt) / span, 0), 1)
}


// ---------------------------------------------------------------------------
// Drawing and updating
// ---------------------------------------------------------------------------

// Loose grenades lying in the world, waiting to be picked up.
export function drawAndUpdateGrenades() {
  const { grenades, camera, ctx, canvas, player } = gameState

  if (!Array.isArray(grenades)) {
    return
  }

  for (let i = grenades.length - 1; i >= 0; i--) {
    const grenade = grenades[i]
    if (!grenade) continue

    if (player && isPickupReady(grenade) && getDistance(player.x, player.y, grenade.x, grenade.y) < player.size + grenade.size) {
      const previousCount = player.grenades ?? 0
      player.grenades = previousCount + 1

      if (previousCount <= 0 && gameState.selectedWeapon === "wrist") {
        gameState.selectedWeapon = "grenade"
      }

      grenades.splice(i, 1)
      updateGrenadeCounter()
      continue
    }

    const screenX = grenade.x - camera.x
    const screenY = grenade.y - camera.y

    if (
      screenX < -grenade.size ||
      screenX > canvas.width + grenade.size ||
      screenY < -grenade.size ||
      screenY > canvas.height + grenade.size
    ) {
      continue
    }

    // A grenade freshly revealed by a broken crate hops into view before it can
    // be collected, so the body scales and lifts while its shadow stays down.
    const reveal = getPickupRevealTransform(grenade)

    createShadow(ctx, screenX, screenY, grenade.size, "circle")
    drawGrenadeBody(ctx, screenX, screenY - reveal.lift, grenade.size * reveal.scale, 0)
  }
}

export function drawAndUpdateThrownGrenades() {
  const { thrownGrenades, camera, ctx, canvas, gameOver } = gameState

  if (!Array.isArray(thrownGrenades)) {
    return
  }

  drawAndUpdateGrenadePins()

  for (let i = thrownGrenades.length - 1; i >= 0; i--) {
    const grenade = thrownGrenades[i]
    if (!grenade) continue

    if (!gameOver && !grenade.landed) {
      grenade.x += grenade.velocityX
      grenade.y += grenade.velocityY
      grenade.framesFlown++
      grenade.spin += 0.22

      // Parabolic arc: zero at both ends, peak in the middle of the flight.
      const progress = Math.min(grenade.framesFlown / grenade.flightFrames, 1)
      grenade.height = 4 * grenade.arcHeight * progress * (1 - progress)

      // A direct low hit on an enemy sets it off straight away; everything else
      // passes underneath.
      if (findGrenadeEnemyHit(grenade)) {
        detonateGrenade(grenade, i)
        continue
      }

      if (progress >= 1) {
        grenade.landed = true
        grenade.height = 0

        // Coming down on top of scenery counts as an impact.
        if (didGrenadeLandOnObstacle(grenade)) {
          detonateGrenade(grenade, i)
          continue
        }

        if (isWaterPosition(grenade.x, grenade.y)) {
          startGrenadeSinking(grenade)
        }
      }
    }

    // The fuse keeps burning whether or not it hit anything.
    if (Date.now() >= grenade.fuseAt) {
      detonateGrenade(grenade, i)
      continue
    }

    const screenX = grenade.x - camera.x
    const screenY = grenade.y - camera.y

    if (
      screenX < -grenade.size * 4 ||
      screenX > canvas.width + grenade.size * 4 ||
      screenY < -grenade.size * 4 ||
      screenY > canvas.height + grenade.size * 4
    ) {
      continue
    }

    // Shadow stays on the ground and spreads as the grenade climbs, which is
    // what sells the height from directly overhead. createShadow only scales
    // size, so the softening is applied with globalAlpha.
    const heightRatio = grenade.arcHeight > 0 ? grenade.height / grenade.arcHeight : 0

    // A grenade that splashed down keeps burning underwater, shrinking and
    // fading away as the fuse runs out instead of sitting on the surface.
    const sink = getGrenadeSinkProgress(grenade)

    if (!grenade.sinking) {
      ctx.save()
      ctx.globalAlpha = 1 - heightRatio * 0.4
      createShadow(ctx, screenX, screenY, grenade.size, "circle", null, 0, 1 + heightRatio * 1.15)
      ctx.restore()
    }

    ctx.save()
    if (grenade.sinking) {
      ctx.globalAlpha = 1 - (1 - GRENADE_SINK_MIN_ALPHA) * sink
    }
    const bodySize = grenade.sinking ? grenade.size * (1 - (1 - GRENADE_SINK_MIN_SCALE) * sink) : grenade.size
    drawGrenadeBody(ctx, screenX, screenY - grenade.height, bodySize, grenade.spin)
    ctx.restore()

    // Blinking warning as the fuse runs out.
    const remaining = grenade.fuseAt - Date.now()
    if (remaining < 900 && Math.floor(remaining / 130) % 2 === 0) {
      ctx.fillStyle = "rgba(255, 92, 48, 0.9)"
      ctx.beginPath()
      ctx.arc(screenX, screenY - grenade.height - grenade.size * 0.85, 3.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawAndUpdateGrenadePins() {
  const pins = gameState.grenadePins

  if (!Array.isArray(pins) || pins.length === 0) {
    return
  }

  const { camera, ctx } = gameState
  const now = Date.now()

  for (let i = pins.length - 1; i >= 0; i--) {
    const pin = pins[i]
    const age = now - pin.createdAt

    if (age > PIN_LIFETIME_MS) {
      pins.splice(i, 1)
      continue
    }

    if (pin.height > 0) {
      pin.x += pin.velocityX
      pin.y += pin.velocityY
      pin.verticalSpeed -= 0.22
      pin.height = Math.max(0, pin.height + pin.verticalSpeed)
      pin.rotation += pin.rotationSpeed
    }

    const screenX = pin.x - camera.x
    const screenY = pin.y - camera.y - pin.height
    const fade = age > PIN_LIFETIME_MS * 0.6 ? 1 - (age - PIN_LIFETIME_MS * 0.6) / (PIN_LIFETIME_MS * 0.4) : 1

    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    ctx.translate(screenX, screenY)
    ctx.rotate(pin.rotation)

    // Pull ring plus its short straight pin.
    ctx.strokeStyle = "#c9ced1"
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(3, 0)
    ctx.lineTo(7.5, 1.4)
    ctx.stroke()

    ctx.restore()
  }

  ctx.globalAlpha = 1
}

// Shared grenade art: a green orb with a metal lever down one side.
function drawGrenadeBody(ctx, x, y, size, rotation) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  const radius = size * 0.62

  ctx.fillStyle = GRENADE_BODY_COLOR
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = GRENADE_BODY_HIGHLIGHT
  ctx.beginPath()
  ctx.arc(-radius * 0.28, -radius * 0.3, radius * 0.42, 0, Math.PI * 2)
  ctx.fill()

  // Neck and the spring lever clamped over it.
  ctx.fillStyle = "#3a3f42"
  ctx.fillRect(-radius * 0.26, -radius * 1.32, radius * 0.52, radius * 0.5)

  ctx.fillStyle = GRENADE_LEVER_COLOR
  ctx.fillRect(radius * 0.16, -radius * 1.3, radius * 0.22, radius * 1.15)

  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Charge indicator
// ---------------------------------------------------------------------------

// Left-to-right power bar shown while the fire button is held.
export function drawGrenadeChargeIndicator() {
  if (!isChargingGrenade()) {
    return
  }

  const { ctx, canvas } = gameState
  if (!ctx || !canvas) {
    return
  }

  const power = getGrenadeChargePower()
  // Matches the vehicle fuel bar footprint (size * 1.4 wide, 8 tall) so every
  // gauge in the game reads at the same scale.
  const barWidth = CAR_SIZE * 1.4
  const barHeight = 8
  const x = (canvas.width - barWidth) / 2
  const y = canvas.height - barHeight - (gameState.isMobile ? 132 : 48)

  ctx.save()

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
  ctx.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2)

  ctx.fillStyle = "rgba(36, 36, 36, 0.9)"
  ctx.fillRect(x, y, barWidth, barHeight)

  // Green through to red as the throw gets stronger.
  const fill = ctx.createLinearGradient(x, y, x + barWidth, y)
  fill.addColorStop(0, "#5fd35f")
  fill.addColorStop(0.55, "#ffd166")
  fill.addColorStop(1, "#ff5c30")
  ctx.fillStyle = fill
  ctx.fillRect(x, y, barWidth * power, barHeight)

  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, barWidth, barHeight)

  ctx.restore()
}
