// Line-of-sight shadowing for explosions.
//
// A blast travels outward from its centre, so anything with a rock between it
// and the centre is sheltered: it takes no damage and the crater does not
// reach it either. Rocks are the only blockers because they are the one world
// object an explosion never destroys.
import { gameState } from "../core/game-state.js"
import { TILE_SIZE } from "../core/constants.js"

function getRockBlockRadius(rock) {
  // Hammer-shaped rocks are the tile-aligned wall pieces, so they shelter a
  // full tile rather than their drawn blob radius.
  return rock.isHammerShaped ? TILE_SIZE * 0.5 : rock.size * 0.85
}

// Gather the rocks that can shadow anything for this particular blast, with
// their distance precomputed so the per-target test stays cheap.
export function collectExplosionBlockers(centerX, centerY, radius) {
  const rocks = gameState.rocks

  if (!Array.isArray(rocks) || rocks.length === 0) {
    return []
  }

  const blockers = []

  for (const rock of rocks) {
    if (!rock) {
      continue
    }

    const blockRadius = getRockBlockRadius(rock)
    const dx = rock.x - centerX
    const dy = rock.y - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)

    // A rock the blast starts inside cannot cast a shadow. Without this, a
    // bomb dropped against a boulder would shelter the entire world.
    if (distance <= blockRadius) {
      continue
    }

    if (distance > radius + blockRadius) {
      continue
    }

    blockers.push({ x: rock.x, y: rock.y, radius: blockRadius, distance })
  }

  return blockers
}

// True when a rock sits on the straight line from the blast centre to the
// target, which means the target is in that rock's shadow.
export function isExplosionPathBlocked(centerX, centerY, targetX, targetY, blockers) {
  if (!blockers || blockers.length === 0) {
    return false
  }

  const dx = targetX - centerX
  const dy = targetY - centerY
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared <= 0.0001) {
    return false
  }

  const length = Math.sqrt(lengthSquared)

  for (const blocker of blockers) {
    // Only rocks nearer than the target can shelter it; a rock behind the
    // target is irrelevant.
    if (blocker.distance >= length) {
      continue
    }

    // Project the rock onto the blast ray and measure how far off the line it
    // sits. Inside its own radius means it covers this direction.
    const projection = ((blocker.x - centerX) * dx + (blocker.y - centerY) * dy) / lengthSquared

    if (projection <= 0 || projection >= 1) {
      continue
    }

    const offsetX = blocker.x - (centerX + dx * projection)
    const offsetY = blocker.y - (centerY + dy * projection)

    if (offsetX * offsetX + offsetY * offsetY < blocker.radius * blocker.radius) {
      return true
    }
  }

  return false
}
