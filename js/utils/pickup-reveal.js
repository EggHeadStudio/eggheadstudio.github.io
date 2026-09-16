// Pop-out reveal for items that appear out of a broken crate.
//
// Without this a drop is collected on the same frame it spawns, because the
// player is already standing next to the crate they just smashed. The reveal
// makes the item hop into view at a small scale and blocks pickup until the
// animation has played, so it is obvious what the crate contained.
import { CRATE_DROP_REVEAL_MS } from "../core/constants.js"

// Stamp an item so it plays the reveal before it can be collected.
export function startPickupReveal(item) {
  const now = Date.now()

  item.revealedAt = now
  item.pickupAt = now + CRATE_DROP_REVEAL_MS

  return item
}

export function isPickupReady(item) {
  return !item?.pickupAt || Date.now() >= item.pickupAt
}

// Scale and vertical lift for the pop. The item springs out slightly past full
// size and hops off the ground, then settles.
export function getPickupRevealTransform(item) {
  if (!item?.revealedAt || isPickupReady(item)) {
    return { scale: 1, lift: 0, progress: 1 }
  }

  const progress = Math.min(Math.max((Date.now() - item.revealedAt) / CRATE_DROP_REVEAL_MS, 0), 1)

  // Reaches full size in the first 40% of the reveal, springing a little past
  // it on the way so the item visibly pops rather than just fading in.
  const grow = Math.min(progress / 0.4, 1)
  const overshoot = 1.70158
  const spring = 1 + (overshoot + 1) * (grow - 1) ** 3 + overshoot * (grow - 1) ** 2
  const scale = 0.3 + spring * 0.7

  // A single hop that lands well before the item becomes collectable.
  const lift = Math.sin(Math.min(progress / 0.7, 1) * Math.PI) * 18

  return { scale, lift, progress }
}
