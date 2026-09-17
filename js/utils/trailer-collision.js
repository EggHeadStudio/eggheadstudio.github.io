// Trailer collision geometry.
//
// A trailer is a long rectangle, so a circle test either lets the player walk
// through the corners or blocks a huge empty area around it. This lives in its
// own module (like explosion-shadow.js) so player.js, cars.js and the position
// utils can all test against a trailer without importing the trailer entity and
// dragging its rocks/crates/trees imports into a cycle.
import { gameState } from "../core/game-state.js"
import { TRAILER_BODY_LENGTH, TRAILER_BODY_WIDTH } from "../core/constants.js"

// Where the player's left hand grips a hand-pulled trailer, as an offset from
// the player centre. The trailer's tow eye and the drawn left hand both read
// this, so the black tip stays welded to the hand at every facing angle.
const GRIP_FORWARD_REACH = 0.18
const GRIP_SIDE_REACH = 1.2

export function getTrailerGripOffset(player) {
  const sideAngle = player.direction - Math.PI / 2

  return {
    x: Math.cos(player.direction) * player.size * GRIP_FORWARD_REACH + Math.cos(sideAngle) * player.size * GRIP_SIDE_REACH,
    y: Math.sin(player.direction) * player.size * GRIP_FORWARD_REACH + Math.sin(sideAngle) * player.size * GRIP_SIDE_REACH,
  }
}

export function getTrailerGripPoint(player) {
  const offset = getTrailerGripOffset(player)

  return {
    x: player.x + offset.x,
    y: player.y + offset.y,
  }
}

// Distance from a world point to the trailer's deck rectangle, measured in the
// trailer's own frame so the box turns with it.
export function getDistanceToTrailerBody(trailer, x, y) {
  const dx = x - trailer.x
  const dy = y - trailer.y
  const cos = Math.cos(-trailer.direction)
  const sin = Math.sin(-trailer.direction)
  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos

  const halfLength = (trailer.size * TRAILER_BODY_LENGTH) / 2
  const halfWidth = (trailer.size * TRAILER_BODY_WIDTH) / 2

  const overhangX = Math.max(Math.abs(localX) - halfLength, 0)
  const overhangY = Math.max(Math.abs(localY) - halfWidth, 0)

  return Math.hypot(overhangX, overhangY)
}

// True when a circle of the given radius at (x, y) touches any trailer deck.
// The trailer a vehicle is towing is passed as ignoreTrailer: the tow ball holds
// them together on purpose, and colliding with your own load would wedge you.
export function isTrailerBlocking(x, y, radius, options = {}) {
  const { ignoreTrailer = null } = options
  const trailers = gameState.trailers

  if (!Array.isArray(trailers)) {
    return false
  }

  for (const trailer of trailers) {
    if (!trailer || trailer === ignoreTrailer) {
      continue
    }

    if (getDistanceToTrailerBody(trailer, x, y) < radius) {
      return true
    }
  }

  return false
}

// The trailer a point is currently standing inside, if any. Used to shove
// anything a moving trailer was dragged over back out into the open.
export function getTrailerContaining(x, y, radius, options = {}) {
  const { ignoreTrailer = null } = options
  const trailers = gameState.trailers

  if (!Array.isArray(trailers)) {
    return null
  }

  for (const trailer of trailers) {
    if (!trailer || trailer === ignoreTrailer) {
      continue
    }

    if (getDistanceToTrailerBody(trailer, x, y) < radius) {
      return trailer
    }
  }

  return null
}
