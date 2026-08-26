// Tree entity - grows apples, blocks movement, and can be chopped into a trunk
import { gameState } from "../core/game-state.js"
import {
  TILE_SIZE,
  TERRAIN_TYPES,
  TREE_SIZE,
  TREE_HIT_POINTS,
  TREE_MIN_SPACING,
  TREE_TILE_FILL_CHANCE,
  TREE_MAX_APPLES,
  TREE_APPLE_VALUE,
  APPLE_SIZE,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { isSpawnPositionClear } from "../utils/spawn-utils.js"
import { movePlayerToNearestSafePosition } from "../utils/player-position-utils.js"
import { createTrunk } from "./wooden-boxes.js"

// Collision is based on the trunk, not the canopy, so forests stay walkable.
const TRUNK_COLLISION_FACTOR = 0.3

// Generate trees across the forest tiles of the map
export function generateTrees() {
  const { terrain, trees } = gameState

  if (!terrain || terrain.length === 0 || !trees) {
    return
  }

  for (let tileY = 0; tileY < terrain.length; tileY++) {
    for (let tileX = 0; tileX < terrain[0].length; tileX++) {
      if (terrain[tileY][tileX] !== TERRAIN_TYPES.FOREST) {
        continue
      }

      if (Math.random() > TREE_TILE_FILL_CHANCE) {
        continue
      }

      // Jitter inside the tile so the forest does not look like a grid
      const x = tileX * TILE_SIZE + TILE_SIZE * (0.2 + Math.random() * 0.6)
      const y = tileY * TILE_SIZE + TILE_SIZE * (0.2 + Math.random() * 0.6)

      if (canPlaceTreeAt(x, y)) {
        trees.push(createTree(x, y))
      }
    }
  }
}

// Trees must keep enough distance from each other for the player to pass between
function canPlaceTreeAt(x, y) {
  const { trees, player } = gameState

  for (const tree of trees) {
    if (getDistance(x, y, tree.x, tree.y) < TREE_MIN_SPACING) {
      return false
    }
  }

  if (player && getDistance(x, y, player.x, player.y) < 160) {
    return false
  }

  return isSpawnPositionClear(x, y, TREE_SIZE * TRUNK_COLLISION_FACTOR, {
    requireLand: true,
    includeTrees: false,
  })
}

// Create a tree with a fixed canopy shape and apples growing on it
function createTree(x, y) {
  const canopy = []
  const blobCount = 3 + Math.floor(Math.random() * 3)

  for (let i = 0; i < blobCount; i++) {
    const angle = (i / blobCount) * Math.PI * 2 + Math.random() * 0.6
    const distance = TREE_SIZE * (0.18 + Math.random() * 0.28)

    canopy.push({
      offsetX: Math.cos(angle) * distance,
      offsetY: Math.sin(angle) * distance,
      radius: TREE_SIZE * (0.5 + Math.random() * 0.22),
      shade: Math.floor(Math.random() * 3),
    })
  }

  // A central blob keeps the canopy from looking like a ring
  canopy.push({ offsetX: 0, offsetY: 0, radius: TREE_SIZE * 0.62, shade: 1 })

  const apples = []
  const appleCount = Math.floor(Math.random() * (TREE_MAX_APPLES + 1))

  for (let i = 0; i < appleCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const distance = TREE_SIZE * (0.15 + Math.random() * 0.5)

    apples.push({
      offsetX: Math.cos(angle) * distance,
      offsetY: Math.sin(angle) * distance,
    })
  }

  return {
    x,
    y,
    size: TREE_SIZE,
    hitPoints: TREE_HIT_POINTS,
    damageState: 0,
    canopy,
    apples,
    trunkRotation: (Math.random() - 0.5) * 0.25,
    swayOffset: Math.random() * Math.PI * 2,
    lastHitTime: 0,
    type: "tree",
  }
}

// Returns true when a circle at (x, y) would overlap a tree trunk
export function isTreeBlocking(x, y, radius) {
  const { trees } = gameState

  if (!trees) {
    return false
  }

  for (const tree of trees) {
    if (getDistance(x, y, tree.x, tree.y) < radius + tree.size * TRUNK_COLLISION_FACTOR) {
      return true
    }
  }

  return false
}

// Apply damage to a tree; chops it down once it runs out of hit points
export function damageTree(tree, amount = 1) {
  if (!tree) return false

  tree.hitPoints -= amount
  tree.lastHitTime = Date.now()
  tree.damageState = TREE_HIT_POINTS - tree.hitPoints

  if (tree.hitPoints <= 0) {
    chopDownTree(tree)
    return true
  }

  return false
}

// Remove the tree, drop its apples, leave behind a trunk
function chopDownTree(tree) {
  const index = gameState.trees.indexOf(tree)
  if (index === -1) {
    return
  }

  gameState.trees.splice(index, 1)

  createTreeDestructionEffect(tree)

  // Apples that were growing on the tree fall where they hung and stay
  // on the ground to be picked up.
  for (const apple of tree.apples) {
    gameState.apples.push({
      x: tree.x + apple.offsetX,
      y: tree.y + apple.offsetY,
      size: APPLE_SIZE,
      color: "#e74c3c",
      value: TREE_APPLE_VALUE,
    })
  }

  // The chopped tree leaves a trunk behind, which behaves like a wooden box
  const trunk = createTrunk(tree.x, tree.y)
  resolveTreeCollapseOverlaps(trunk)
}

function resolveTreeCollapseOverlaps(trunk) {
  const { player, enemies } = gameState

  if (player) {
    const requiredPlayerDistance = player.size + trunk.size * 0.8 + 2
    const playerDistance = getDistance(player.x, player.y, trunk.x, trunk.y)

    if (playerDistance < requiredPlayerDistance) {
      movePlayerToNearestSafePosition(player.x, player.y, trunk.x, trunk.y)
    }
  }

  if (!enemies) {
    return
  }

  // Nudge enemies out if a trunk appears under them, so nobody gets trapped.
  for (const enemy of enemies) {
    const requiredEnemyDistance = enemy.size + trunk.size * 0.8 + 2
    const enemyDistance = getDistance(enemy.x, enemy.y, trunk.x, trunk.y)

    if (enemyDistance >= requiredEnemyDistance) {
      continue
    }

    const angle =
      enemyDistance > 0.001 ? Math.atan2(enemy.y - trunk.y, enemy.x - trunk.x) : Math.random() * Math.PI * 2
    enemy.x = trunk.x + Math.cos(angle) * requiredEnemyDistance
    enemy.y = trunk.y + Math.sin(angle) * requiredEnemyDistance
  }
}

// Leaf and wood chip burst when a tree is chopped down
function createTreeDestructionEffect(tree) {
  if (!gameState.treeDestructionEffects) {
    gameState.treeDestructionEffects = []
  }

  const particleCount = 14 + Math.floor(Math.random() * 6)
  const effect = {
    particles: [],
    createdAt: Date.now(),
  }

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1.5 + Math.random() * 3.5
    const lifetime = 600 + Math.random() * 900
    const isLeaf = Math.random() > 0.35

    effect.particles.push({
      x: tree.x,
      y: tree.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      size: isLeaf ? 4 + Math.random() * 5 : 3 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.25,
      lifetime,
      maxLifetime: lifetime,
      isLeaf,
      color: isLeaf
        ? `hsl(${95 + Math.random() * 35}, ${45 + Math.random() * 25}%, ${28 + Math.random() * 18}%)`
        : `hsl(${25 + Math.random() * 15}, ${55 + Math.random() * 20}%, ${30 + Math.random() * 15}%)`,
    })
  }

  gameState.treeDestructionEffects.push(effect)
}

// Draw tree bases (shadow + trunk) and destruction effects.
export function drawAndUpdateTrees() {
  const { trees, camera, ctx, canvas } = gameState

  if (!trees) return

  if (gameState.lightweightMode) {
    return
  }

  const time = Date.now() / 1000

  for (const tree of trees) {
    const screenX = tree.x - camera.x
    const screenY = tree.y - camera.y
    const margin = tree.size * 2

    if (
      screenX < -margin ||
      screenX > canvas.width + margin ||
      screenY < -margin ||
      screenY > canvas.height + margin
    ) {
      continue
    }

    // Trees lean with the same slow breeze used by the terrain grass
    const sway = Math.sin(time * 1.25 + tree.swayOffset) * 2

    createShadow(ctx, screenX, screenY, tree.size * 0.75, "circle")

    drawTrunk(ctx, screenX, screenY, tree)

    if (Date.now() - tree.lastHitTime < 250) {
      drawTreeHitEffect(ctx, screenX, screenY, tree)
    }
  }

  drawAndUpdateTreeDestructionEffects()
}

// Draw tree canopies as an overlay so entities (such as cars) can pass under leaves.
export function drawTreeCanopyOverlay() {
  const { trees, camera, ctx, canvas } = gameState

  if (!trees) return

  const isLightweight = gameState.lightweightMode
  const time = isLightweight ? 0 : Date.now() / 1000

  for (const tree of trees) {
    const screenX = tree.x - camera.x
    const screenY = tree.y - camera.y
    const margin = tree.size * 2

    if (
      screenX < -margin ||
      screenX > canvas.width + margin ||
      screenY < -margin ||
      screenY > canvas.height + margin
    ) {
      continue
    }

    const sway = isLightweight ? 0 : Math.sin(time * 1.25 + tree.swayOffset) * 2
    drawCanopy(ctx, screenX + sway, screenY - tree.size * 0.1, tree)
    drawTreeApples(ctx, screenX + sway, screenY - tree.size * 0.1, tree)
  }
}

function drawTrunk(ctx, screenX, screenY, tree) {
  const trunkWidth = tree.size * 0.28
  const trunkHeight = tree.size * 0.85

  ctx.save()
  ctx.translate(screenX, screenY)
  ctx.rotate(tree.trunkRotation)

  ctx.fillStyle = "#6b4423"
  ctx.fillRect(-trunkWidth / 2, -trunkHeight * 0.35, trunkWidth, trunkHeight)

  // Bark highlight
  ctx.fillStyle = "#7d5230"
  ctx.fillRect(-trunkWidth / 2, -trunkHeight * 0.35, trunkWidth * 0.35, trunkHeight)

  // Chop marks appear as the tree takes damage
  if (tree.damageState > 0) {
    ctx.strokeStyle = "#3f2713"
    ctx.lineWidth = 2
    ctx.lineCap = "round"

    for (let i = 0; i < tree.damageState; i++) {
      const notchY = -trunkHeight * 0.15 + i * trunkWidth * 0.55
      ctx.beginPath()
      ctx.moveTo(-trunkWidth / 2, notchY)
      ctx.lineTo(trunkWidth * 0.15, notchY + trunkWidth * 0.3)
      ctx.stroke()
    }

    ctx.lineCap = "butt"
  }

  ctx.restore()
}

function drawCanopy(ctx, screenX, screenY, tree) {
  const shades = ["#1e7a3c", "#249448", "#2fae57"]
  // Darker canopy as the tree gets damaged, so it reads as dying
  const damageFade = tree.damageState * 0.12
  const isLightweight = gameState.lightweightMode

  for (const blob of tree.canopy) {
    // Slight canopy shadow to separate leaves from entities below.
    if (!isLightweight) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.14)"
      ctx.globalAlpha = 1 - damageFade
      ctx.beginPath()
      ctx.arc(screenX + blob.offsetX + 1.6, screenY + blob.offsetY + 2.2, blob.radius * 0.98, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = shades[blob.shade] || shades[1]
    ctx.globalAlpha = 1 - damageFade
    ctx.beginPath()
    ctx.arc(screenX + blob.offsetX, screenY + blob.offsetY, blob.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 1
}

function drawTreeApples(ctx, screenX, screenY, tree) {
  const isLightweight = gameState.lightweightMode

  for (const apple of tree.apples) {
    const appleX = screenX + apple.offsetX
    const appleY = screenY + apple.offsetY

    ctx.fillStyle = "#e74c3c"
    ctx.beginPath()
    ctx.arc(appleX, appleY, APPLE_SIZE * 0.55, 0, Math.PI * 2)
    ctx.fill()

    if (!isLightweight) {
      // Small highlight so apples pop against the canopy
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)"
      ctx.beginPath()
      ctx.arc(appleX - APPLE_SIZE * 0.18, appleY - APPLE_SIZE * 0.18, APPLE_SIZE * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawTreeHitEffect(ctx, screenX, screenY, tree) {
  const progress = (Date.now() - tree.lastHitTime) / 250

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - progress)})`
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(screenX, screenY, tree.size * (0.6 + progress * 0.4), 0, Math.PI * 2)
  ctx.stroke()
}

function drawAndUpdateTreeDestructionEffects() {
  if (!gameState.treeDestructionEffects) return

  const { camera, ctx } = gameState

  for (let i = gameState.treeDestructionEffects.length - 1; i >= 0; i--) {
    const effect = gameState.treeDestructionEffects[i]

    for (let j = effect.particles.length - 1; j >= 0; j--) {
      const particle = effect.particles[j]

      particle.x += particle.velocityX
      particle.y += particle.velocityY
      particle.velocityX *= 0.94
      particle.velocityY *= 0.94
      particle.rotation += particle.rotationSpeed
      particle.lifetime -= 16

      if (particle.lifetime <= 0) {
        effect.particles.splice(j, 1)
        continue
      }

      const alpha = particle.lifetime / particle.maxLifetime
      const screenX = particle.x - camera.x
      const screenY = particle.y - camera.y

      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.rotate(particle.rotation)
      ctx.globalAlpha = alpha
      ctx.fillStyle = particle.color

      if (particle.isLeaf) {
        ctx.beginPath()
        ctx.ellipse(0, 0, particle.size, particle.size * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2)
      }

      ctx.restore()
    }

    ctx.globalAlpha = 1

    if (effect.particles.length === 0) {
      gameState.treeDestructionEffects.splice(i, 1)
    }
  }
}
