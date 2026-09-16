// Trailer entity
//
// A trailer is a passive flatbed on four wheels. It has no engine of its own:
// the player reverses a car onto the tow eye at the front of the trailer, and
// from then on the trailer trails the car like a train wagon. It carries
// sledgehammered wall modules, trunks and crates, which are loaded by dropping
// them onto the bed and unloaded by grabbing them back off on foot.
//
// Trailers deliberately never block anything. Instead of a solid collision they
// use a soft separation pass, so neither the trailer nor anything it touches can
// end up wedged.
import { gameState } from "../core/game-state.js"
import {
  TILE_SIZE,
  TERRAIN_TYPES,
  TRAILER_SIZE,
  TRAILER_BODY_LENGTH,
  TRAILER_BODY_WIDTH,
  TRAILER_CARGO_CAPACITY,
  TRAILER_CARGO_STACK_LIFT,
  TRAILER_INTERACTION_RANGE,
  TRAILER_HITCH_RANGE,
  TRAILER_TONGUE_REACH,
  TRAILER_DETACH_BOUNCE_SPEED,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { isTreeBlocking } from "./trees.js"
import { drawWoodenBox } from "./wooden-boxes.js"
import { drawRockShape } from "./rocks.js"
import { getDistanceToTrailerBody } from "../utils/trailer-collision.js"

const BED_COLOR = "#6b5b45"
const BED_PLANK_COLOR = "#7d6a51"
const FRAME_COLOR = "#3f3a33"
const RAIL_COLOR = "#544c40"

// How fast a loose trailer bleeds off a shove, and the speed below which it is
// treated as parked.
const BOUNCE_FRICTION = 0.88
const BOUNCE_REST_SPEED = 0.08

// Cargo keeps its real size, so only a few items fit flat on the deck. The rest
// pile up in layers on top, which is what a loaded trailer actually looks like.
const CARGO_COLUMNS = 2
const CARGO_ROWS = 2
const CARGO_PER_LAYER = CARGO_COLUMNS * CARGO_ROWS

export function createTrailer(x, y) {
  return {
    x,
    y,
    size: TRAILER_SIZE,
    vehicleType: "trailer",
    direction: Math.random() * Math.PI * 2,
    hitchedTo: null,
    cargo: [],
    wheelRotation: 0,
    bounceVelocityX: 0,
    bounceVelocityY: 0,
  }
}

// Drops a few starter trailers on clear land around the player.
export function generateTrailers(count, options = {}) {
  const { player } = gameState
  const { minDistance = 220, maxDistance = 520 } = options

  if (!player) {
    return
  }

  if (!Array.isArray(gameState.trailers)) {
    gameState.trailers = []
  }

  for (let spawned = 0; spawned < count; spawned++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const distance = minDistance + Math.random() * (maxDistance - minDistance)
      const x = player.x + Math.cos(angle) * distance
      const y = player.y + Math.sin(angle) * distance

      if (isWaterTile(x, y) || isTreeBlocking(x, y, TRAILER_SIZE * 0.35)) {
        continue
      }

      const tooClose = [...(gameState.rocks || []), ...(gameState.woodenBoxes || []), ...gameState.trailers].some(
        (other) => getDistance(x, y, other.x, other.y) < TRAILER_SIZE * 0.8,
      )

      if (tooClose) {
        continue
      }

      gameState.trailers.push(createTrailer(x, y))
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

// The tow eye on the nose of the trailer, which is what a reversing car has to
// touch to hitch up.
export function getTrailerHitchPoint(trailer) {
  const reach = trailer.size * TRAILER_TONGUE_REACH

  return {
    x: trailer.x + Math.cos(trailer.direction) * reach,
    y: trailer.y + Math.sin(trailer.direction) * reach,
  }
}

// The tow ball on the back of the car.
function getCarTowBall(car) {
  const reach = car.size * 0.55

  return {
    x: car.x - Math.cos(car.direction) * reach,
    y: car.y - Math.sin(car.direction) * reach,
  }
}

function isWaterTile(x, y) {
  const { terrain } = gameState
  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)

  if (!terrain || tileY < 0 || tileY >= terrain.length || tileX < 0 || tileX >= terrain[0].length) {
    return true
  }

  return terrain[tileY][tileX] === TERRAIN_TYPES.WATER
}

// ---------------------------------------------------------------------------
// Hitching
// ---------------------------------------------------------------------------

export function getTrailerFor(car) {
  if (!car || !Array.isArray(gameState.trailers)) {
    return null
  }

  return gameState.trailers.find((trailer) => trailer.hitchedTo === car) || null
}

// Called from the car update while the player is reversing. The car has to be
// backing up, so nosing forwards into a trailer never hitches it by accident.
export function tryHitchTrailerToCar(car) {
  if (!car || car.isBroken || !Array.isArray(gameState.trailers)) {
    return null
  }

  // Already pulling one; a car only has the one tow ball.
  if (getTrailerFor(car)) {
    return null
  }

  const towBall = getCarTowBall(car)

  for (const trailer of gameState.trailers) {
    if (trailer.hitchedTo) {
      continue
    }

    const eye = getTrailerHitchPoint(trailer)

    if (getDistance(towBall.x, towBall.y, eye.x, eye.y) > TRAILER_HITCH_RANGE) {
      continue
    }

    hitchTrailer(trailer, car)
    return trailer
  }

  return null
}

function hitchTrailer(trailer, car) {
  trailer.hitchedTo = car
  trailer.bounceVelocityX = 0
  trailer.bounceVelocityY = 0

  // Snap straight in line behind the car so the first frame of towing does not
  // whip the trailer around.
  trailer.direction = car.direction
  const towBall = getCarTowBall(car)
  const reach = trailer.size * TRAILER_TONGUE_REACH
  trailer.x = towBall.x - Math.cos(car.direction) * reach
  trailer.y = towBall.y - Math.sin(car.direction) * reach
}

// Drop the trailer and shove it clear so it cannot sit inside the car.
export function unhitchTrailer(trailer) {
  if (!trailer || !trailer.hitchedTo) {
    return false
  }

  const car = trailer.hitchedTo
  trailer.hitchedTo = null

  const away = Math.atan2(trailer.y - car.y, trailer.x - car.x)
  trailer.bounceVelocityX = Math.cos(away) * TRAILER_DETACH_BOUNCE_SPEED
  trailer.bounceVelocityY = Math.sin(away) * TRAILER_DETACH_BOUNCE_SPEED

  return true
}

// ---------------------------------------------------------------------------
// Cargo
// ---------------------------------------------------------------------------

// Sledge modules, glass cubes, trunks and plain crates all ride on the bed.
// Loose rocks do not, but a sledgehammered rock module does.
function isTrailerCargoBox(box) {
  return Boolean(box) && !box.isBeingThrown && !box.isFloating && !box.isTowedByBoat
}

function isTrailerCargoRock(rock) {
  return Boolean(rock?.isHammerShaped)
}

export function getTrailerCargoCount(trailer) {
  return Array.isArray(trailer?.cargo) ? trailer.cargo.length : 0
}

// Anything resting on the bed gets loaded.
function absorbNearbyCargo(trailer) {
  const { player } = gameState

  if (gameState.isInCar || !player || trailer.cargo.length >= TRAILER_CARGO_CAPACITY) {
    return
  }

  // Loading is a deliberate on-foot action, so a trailer only sweeps its bed
  // while the player is standing at it.
  if (getDistance(player.x, player.y, trailer.x, trailer.y) > TRAILER_INTERACTION_RANGE * 2) {
    return
  }

  const { woodenBoxes, rocks } = gameState
  // The deck is a long rectangle, so loading uses the same shape plus a small
  // lip. A circle around the centre would miss the ends of the bed entirely.
  const bedLip = 16

  if (Array.isArray(woodenBoxes)) {
    for (let i = woodenBoxes.length - 1; i >= 0; i--) {
      if (trailer.cargo.length >= TRAILER_CARGO_CAPACITY) {
        return
      }

      const box = woodenBoxes[i]
      if (!isTrailerCargoBox(box) || getDistanceToTrailerBody(trailer, box.x, box.y) > bedLip) {
        continue
      }

      woodenBoxes.splice(i, 1)
      trailer.cargo.push({ kind: "box", item: box })
    }
  }

  if (Array.isArray(rocks)) {
    for (let i = rocks.length - 1; i >= 0; i--) {
      if (trailer.cargo.length >= TRAILER_CARGO_CAPACITY) {
        return
      }

      const rock = rocks[i]
      if (!isTrailerCargoRock(rock) || getDistanceToTrailerBody(trailer, rock.x, rock.y) > bedLip) {
        continue
      }

      rocks.splice(i, 1)
      trailer.cargo.push({ kind: "rock", item: rock })
    }
  }
}

// Lift the last loaded item straight into the player's hands, the same way
// grabbing it off the ground would.
export function tryTakeFromTrailer() {
  const { player, trailers } = gameState

  if (!player || gameState.isInCar || gameState.isGrabbing || !Array.isArray(trailers)) {
    return false
  }

  for (const trailer of trailers) {
    if (getTrailerCargoCount(trailer) === 0) {
      continue
    }

    if (getDistance(player.x, player.y, trailer.x, trailer.y) > TRAILER_INTERACTION_RANGE) {
      continue
    }

    const entry = trailer.cargo.pop()
    const item = entry.item
    item.x = player.x
    item.y = player.y

    gameState.isGrabbing = true

    if (entry.kind === "rock") {
      gameState.grabbedRock = item
    } else {
      item.snappedTo = null
      gameState.grabbedWoodenBox = item
    }

    return true
  }

  return false
}

// An empty trailer next to the player can be dropped off its car.
export function tryUnhitchNearbyTrailer() {
  const { player, trailers } = gameState

  if (!player || gameState.isInCar || !Array.isArray(trailers)) {
    return false
  }

  for (const trailer of trailers) {
    if (!trailer.hitchedTo || getTrailerCargoCount(trailer) > 0) {
      continue
    }

    if (getDistance(player.x, player.y, trailer.x, trailer.y) > TRAILER_INTERACTION_RANGE) {
      continue
    }

    return unhitchTrailer(trailer)
  }

  return false
}

// Single entry point for the space bar / A button while on foot.
export function tryTrailerInteraction() {
  return tryTakeFromTrailer() || tryUnhitchNearbyTrailer()
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

// Wagon behaviour: the nose stays pinned to the car's tow ball and the bed
// swings in behind it, which is what makes reversing fold the trailer up the
// way a real one does.
function followTowCar(trailer) {
  const car = trailer.hitchedTo

  // The car went away (wrecked and cleaned up), so the trailer is on its own.
  if (!Array.isArray(gameState.cars) || !gameState.cars.includes(car)) {
    trailer.hitchedTo = null
    return
  }

  const towBall = getCarTowBall(car)
  const reach = trailer.size * TRAILER_TONGUE_REACH

  // Angle from the ball back to where the bed currently sits.
  const trailAngle = Math.atan2(trailer.y - towBall.y, trailer.x - towBall.x)

  trailer.direction = trailAngle + Math.PI
  trailer.x = towBall.x + Math.cos(trailAngle) * reach
  trailer.y = towBall.y + Math.sin(trailAngle) * reach

  trailer.wheelRotation += (car.currentSpeed || 0) * 0.2
}

// A loose trailer only moves when something shoved it.
function applyBounce(trailer) {
  const speed = Math.hypot(trailer.bounceVelocityX, trailer.bounceVelocityY)

  if (speed < BOUNCE_REST_SPEED) {
    trailer.bounceVelocityX = 0
    trailer.bounceVelocityY = 0
    return
  }

  const nextX = trailer.x + trailer.bounceVelocityX
  const nextY = trailer.y + trailer.bounceVelocityY

  // Never let a shove push a trailer into the sea.
  if (isWaterTile(nextX, nextY)) {
    trailer.bounceVelocityX = 0
    trailer.bounceVelocityY = 0
    return
  }

  trailer.x = nextX
  trailer.y = nextY
  trailer.wheelRotation += speed * 0.2
  trailer.bounceVelocityX *= BOUNCE_FRICTION
  trailer.bounceVelocityY *= BOUNCE_FRICTION
}

// Soft separation instead of hard collision. A loose trailer that ends up
// overlapping scenery slides itself out a little each frame, so nothing can get
// permanently wedged against it.
function separateFromObstacles(trailer) {
  const clearance = trailer.size * 0.42
  let pushX = 0
  let pushY = 0

  const consider = (otherX, otherY, otherRadius) => {
    const dx = trailer.x - otherX
    const dy = trailer.y - otherY
    const distance = Math.hypot(dx, dy)
    const minimum = clearance + otherRadius

    if (distance >= minimum) {
      return
    }

    // Exactly concentric: pick an arbitrary direction rather than dividing by 0.
    if (distance < 0.001) {
      pushX += minimum
      return
    }

    const overlap = minimum - distance
    pushX += (dx / distance) * overlap
    pushY += (dy / distance) * overlap
  }

  for (const rock of gameState.rocks || []) {
    consider(rock.x, rock.y, rock.size * 0.5)
  }

  for (const box of gameState.woodenBoxes || []) {
    if (box.isBeingThrown || box.isFloating) continue
    consider(box.x, box.y, box.size * 0.5)
  }

  for (const other of gameState.trailers || []) {
    if (other === trailer) continue
    consider(other.x, other.y, other.size * 0.42)
  }

  for (const car of gameState.cars || []) {
    // The car doing the towing is supposed to sit right on the tow eye. The
    // clearance is deliberately smaller than the car's own trailer collision
    // radius, so the two rules never fight each other and jitter.
    if (car === trailer.hitchedTo) continue
    consider(car.x, car.y, car.size * 0.3)
  }

  if (pushX === 0 && pushY === 0) {
    return
  }

  // Cap the correction so a deep overlap eases apart instead of teleporting.
  const pushLength = Math.hypot(pushX, pushY)
  const step = Math.min(pushLength, 2.5)
  const nextX = trailer.x + (pushX / pushLength) * step
  const nextY = trailer.y + (pushY / pushLength) * step

  if (isWaterTile(nextX, nextY) || isTreeBlocking(nextX, nextY, trailer.size * 0.3)) {
    return
  }

  trailer.x = nextX
  trailer.y = nextY
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawTrailerBody(ctx, trailer) {
  const length = trailer.size * TRAILER_BODY_LENGTH
  const width = trailer.size * TRAILER_BODY_WIDTH
  const halfLength = length / 2
  const halfWidth = width / 2

  // Drawbar and tow eye poking out of the nose.
  ctx.strokeStyle = FRAME_COLOR
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(halfLength - 4, 0)
  ctx.lineTo(trailer.size * TRAILER_TONGUE_REACH, 0)
  ctx.stroke()

  ctx.fillStyle = "#2f2b26"
  ctx.beginPath()
  ctx.arc(trailer.size * TRAILER_TONGUE_REACH, 0, 5, 0, Math.PI * 2)
  ctx.fill()

  // Flatbed floor.
  ctx.fillStyle = BED_COLOR
  ctx.beginPath()
  ctx.roundRect(-halfLength, -halfWidth, length, width, 6)
  ctx.fill()

  // Planking so it reads as an empty deck from above.
  ctx.fillStyle = BED_PLANK_COLOR
  const plankCount = 6
  const plankGap = length / plankCount
  for (let i = 1; i < plankCount; i++) {
    ctx.fillRect(-halfLength + i * plankGap - 1, -halfWidth + 4, 2, width - 8)
  }

  // Low side rails.
  ctx.strokeStyle = RAIL_COLOR
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(-halfLength, -halfWidth, length, width, 6)
  ctx.stroke()
}

function drawTrailerWheels(ctx, trailer) {
  const wheelWidth = trailer.size * 0.1
  const wheelLength = trailer.size * 0.22
  const offsetX = trailer.size * 0.24
  const offsetY = trailer.size * 0.42

  ctx.fillStyle = "#2b2b2b"

  for (const sideY of [-offsetY, offsetY]) {
    for (const axleX of [-offsetX, offsetX]) {
      ctx.beginPath()
      ctx.roundRect(axleX - wheelLength / 2, sideY - wheelWidth / 2, wheelLength, wheelWidth, 3)
      ctx.fill()
    }
  }
}

// Cargo sits in a 2x2 footprint on the deck and stacks upwards from there, at
// its real world size so a loaded trailer looks properly piled up.
function drawTrailerCargo(ctx, trailer) {
  const count = getTrailerCargoCount(trailer)
  if (count === 0) {
    return
  }

  const length = trailer.size * TRAILER_BODY_LENGTH
  const width = trailer.size * TRAILER_BODY_WIDTH
  const rowSpacing = (length - 14) / CARGO_ROWS
  const columnSpacing = (width - 10) / CARGO_COLUMNS

  // A screen-space lift has to be expressed in the trailer's rotated frame, so
  // the pile always leans towards the top of the screen however it is parked.
  const liftDirectionX = -Math.sin(trailer.direction)
  const liftDirectionY = -Math.cos(trailer.direction)

  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / CARGO_PER_LAYER)
    const slot = i % CARGO_PER_LAYER
    const row = Math.floor(slot / CARGO_COLUMNS)
    const column = slot % CARGO_COLUMNS

    const baseX = length / 2 - 7 - (row + 0.5) * rowSpacing
    const baseY = -width / 2 + 5 + (column + 0.5) * columnSpacing
    const lift = TRAILER_CARGO_STACK_LIFT * layer

    const entry = trailer.cargo[i]
    const item = entry.item

    ctx.save()
    ctx.translate(baseX + liftDirectionX * lift, baseY + liftDirectionY * lift)

    // Stacked items read as closer to the camera, and a drop shadow separates
    // each layer from the one it is resting on.
    if (layer > 0) {
      ctx.scale(1 + layer * 0.03, 1 + layer * 0.03)
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)"
      ctx.beginPath()
      ctx.ellipse(0, item.size * 0.34, item.size * 0.46, item.size * 0.24, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Items are laid square to the bed rather than at the angle they happened
    // to be lying at when they were picked up.
    if (entry.kind === "rock") {
      drawRockShape(ctx, item)
    } else {
      drawWoodenBox(ctx, item)
    }

    ctx.restore()
  }
}

// Matches the vehicle fuel bar footprint so every gauge reads at the same scale.
function drawTrailerLoadBar(ctx, trailer, screenX, screenY) {
  const count = getTrailerCargoCount(trailer)
  const barWidth = trailer.size * 1.4
  const barHeight = 8
  const barX = screenX - barWidth * 0.5
  const barY = screenY - trailer.size - 20
  const filled = Math.min(1, count / TRAILER_CARGO_CAPACITY)

  ctx.save()
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2)

  ctx.fillStyle = "rgba(36, 36, 36, 0.9)"
  ctx.fillRect(barX, barY, barWidth, barHeight)

  ctx.fillStyle = filled >= 1 ? "#e29b3b" : "#8fa9c8"
  ctx.fillRect(barX, barY, barWidth * filled, barHeight)

  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
  ctx.lineWidth = 1
  ctx.strokeRect(barX, barY, barWidth, barHeight)

  // Slot ticks, so a glance tells you how many items fit in the gap.
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)"
  for (let i = 1; i < TRAILER_CARGO_CAPACITY; i++) {
    ctx.fillRect(barX + (barWidth * i) / TRAILER_CARGO_CAPACITY, barY, 1, barHeight)
  }

  ctx.restore()
}

function drawHitchLine(ctx, trailer, camera) {
  const car = trailer.hitchedTo
  const towBall = { x: car.x - Math.cos(car.direction) * car.size * 0.55, y: car.y - Math.sin(car.direction) * car.size * 0.55 }
  const eye = getTrailerHitchPoint(trailer)

  ctx.save()
  ctx.strokeStyle = "rgba(60, 55, 48, 0.9)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(towBall.x - camera.x, towBall.y - camera.y)
  ctx.lineTo(eye.x - camera.x, eye.y - camera.y)
  ctx.stroke()
  ctx.restore()
}

export function drawAndUpdateTrailers() {
  const { trailers, ctx, camera, player, canvas } = gameState

  if (!Array.isArray(trailers) || trailers.length === 0) {
    return
  }

  for (const trailer of trailers) {
    if (!trailer) continue

    if (trailer.hitchedTo) {
      followTowCar(trailer)
    } else {
      applyBounce(trailer)
      separateFromObstacles(trailer)
    }

    // Works parked or hitched, but only while the player is on foot, so driving
    // over a crate never scoops it up by surprise.
    absorbNearbyCargo(trailer)

    const screenX = trailer.x - camera.x
    const screenY = trailer.y - camera.y

    if (
      screenX + trailer.size < 0 ||
      screenX - trailer.size > canvas.width ||
      screenY + trailer.size < 0 ||
      screenY - trailer.size > canvas.height
    ) {
      continue
    }

    if (trailer.hitchedTo) {
      drawHitchLine(ctx, trailer, camera)
    }

    // Soft shadow under the deck.
    ctx.save()
    ctx.translate(screenX + 4, screenY + 4)
    ctx.rotate(trailer.direction)
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)"
    ctx.beginPath()
    ctx.roundRect(
      (-trailer.size * TRAILER_BODY_LENGTH) / 2,
      (-trailer.size * TRAILER_BODY_WIDTH) / 2,
      trailer.size * TRAILER_BODY_LENGTH,
      trailer.size * TRAILER_BODY_WIDTH,
      8,
    )
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(trailer.direction)
    drawTrailerWheels(ctx, trailer)
    drawTrailerBody(ctx, trailer)
    drawTrailerCargo(ctx, trailer)
    ctx.restore()

    if (trailer.hitchedTo || getTrailerCargoCount(trailer) > 0) {
      drawTrailerLoadBar(ctx, trailer, screenX, screenY)
    }

    if (!player || gameState.isInCar) {
      continue
    }

    if (getDistance(player.x, player.y, trailer.x, trailer.y) > TRAILER_INTERACTION_RANGE) {
      continue
    }

    const cargoCount = getTrailerCargoCount(trailer)
    let prompt = null

    if (cargoCount > 0) {
      prompt = `Press SPACE to take (${cargoCount}/${TRAILER_CARGO_CAPACITY})`
    } else if (trailer.hitchedTo) {
      prompt = "Press SPACE to disconnect the trailer"
    }

    if (!prompt) {
      continue
    }

    ctx.save()
    ctx.font = "16px Arial"
    ctx.fillStyle = "#fff"
    ctx.textAlign = "center"
    ctx.shadowColor = "#000"
    ctx.shadowBlur = 4
    ctx.fillText(prompt, screenX, screenY - trailer.size - 30)
    ctx.restore()
  }
}
