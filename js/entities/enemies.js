// Enemy entity
import { gameState } from "../core/game-state.js"
import { getRandomLoadedWorldPosition } from "../world/world-manager.js"
import {
  TILE_SIZE,
  SPAWN_ATTEMPT_LIMIT,
  ENEMY_SPAWN_INTERVAL,
  ENEMY_PHASE_SPAWN_CONFIG,
  ENEMY_TYPE_DEFINITIONS,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { damageWoodenBox } from "../entities/wooden-boxes.js"
import { isUnderRoof } from "../entities/wooden-boxes.js"
// Import the incrementKillCount function
import { incrementKillCount } from "../ui/ui-manager.js"
import { isSpawnPositionClear } from "../utils/spawn-utils.js"
import { createDeathEffect } from "./death-effects.js"
import { isEnemyFullyInsideHole } from "./shovels.js"
import { isWaterLikeTile } from "./shovels.js"
import { createCharacter } from "./character-factory.js"

const ENEMY_HIT_INVULNERABILITY = 180
const ENEMY_FLOAT_SPEED = 0.42
const ENEMY_FLOAT_BOB = 2.2
const ENEMY_WAKE_LIFETIME = 320
const ENEMY_CLEANUP_EFFECT_DURATION = 900
const ENEMY_HOLE_FALL_DURATION = 420
const ENEMY_HOLE_FALL_MIN_SCALE = 0.34
const ENEMY_HOLE_FALL_SPLATTER_SCALE = 0.5
const ENEMY_WALK_ANIMATION_SPEED = 0.042
const ENEMY_IDLE_ANIMATION_SPEED = 0.018
const ENEMY_LIMB_SWING = 8
const ENEMY_ATTACK_SWING_DURATION = 230
const ENEMY_ATTACK_RECOVERY_DURATION = 140

const ENEMY_TYPE_KEYS = Object.keys(ENEMY_TYPE_DEFINITIONS)

function buildSpawnPlan(counts = {}) {
  const spawnPlan = {}

  for (const type of ENEMY_TYPE_KEYS) {
    spawnPlan[type] = Math.max(0, Number(counts[type]) || 0)
  }

  return spawnPlan
}

function getPhaseSpawnConfig(phase = gameState.dayNight?.currentPhase) {
  const normalizedPhase = phase || "dusk"
  return ENEMY_PHASE_SPAWN_CONFIG[normalizedPhase] || ENEMY_PHASE_SPAWN_CONFIG.dusk
}

export function getInitialEnemySpawnPlan(phase = gameState.dayNight?.currentPhase) {
  const phaseConfig = getPhaseSpawnConfig(phase)
  return buildSpawnPlan(phaseConfig.initial || {})
}

function getAmbientEnemySpawnPlan(phase = gameState.dayNight?.currentPhase) {
  const phaseConfig = getPhaseSpawnConfig(phase)
  return buildSpawnPlan(phaseConfig.ambient || {})
}

function createEnemy(type, x, y) {
  const config = ENEMY_TYPE_DEFINITIONS[type]
  if (!config) {
    return null
  }

  const appearance = config.appearance || {}
  const baseCharacter = createCharacter(appearance.characterType || "default", {
    ...(appearance.customization || {}),
    color: config.color,
    size: config.size,
    health: config.health,
    maxHealth: config.health,
    speed: config.speed,
  })

  return {
    ...baseCharacter,
    x,
    y,
    type,
    size: config.size,
    speed: config.speed,
    chaseSpeed: config.chaseSpeed,
    swimSpeed: config.swimSpeed,
    direction: Math.random() * Math.PI * 2,
    color: config.color,
    health: config.health,
    maxHealth: config.health,
    lastHit: 0,
    directionChangeTime: 0,
    isChasing: false,
    isBeingThrown: false,
    throwStartTime: 0,
    throwVelocityX: 0,
    throwVelocityY: 0,
    isKnockedBack: false,
    knockbackTime: 0,
    knockbackVelocityX: 0,
    knockbackVelocityY: 0,
    knockbackDuration: 300,
    bruiseMarks: createEnemyBruiseMarks(),
    floatAngle: Math.random() * Math.PI * 2,
    floatOffset: 0,
    foamTrail: [],
    bowWaves: [],
    isSwimming: false,
    isFallingIntoHole: false,
    holeFallStartedAt: 0,
    isMoving: false,
    animationTime: 0,
    blinkCycleOffset: Math.random() * 2200,
    lastAttackAt: 0,
  }
}

function updateEnemyAnimationState(enemy, distanceMoved) {
  const movementAmount = Number(distanceMoved) || 0
  enemy.isMoving = movementAmount > 0.08

  if (enemy.isMoving) {
    enemy.animationTime += ENEMY_WALK_ANIMATION_SPEED * Math.max(1, movementAmount * 0.34)
    return
  }

  enemy.animationTime += ENEMY_IDLE_ANIMATION_SPEED
}

function spawnEnemyCleanupEffects(enemiesToClear) {
  if (!enemiesToClear || enemiesToClear.length === 0) {
    return
  }

  if (!gameState.enemyCleanupEffects) {
    gameState.enemyCleanupEffects = []
  }

  const now = Date.now()
  for (const enemy of enemiesToClear) {
    gameState.enemyCleanupEffects.push({
      x: enemy.x,
      y: enemy.y,
      size: enemy.size,
      color: enemy.color,
      createdAt: now,
      duration: ENEMY_CLEANUP_EFFECT_DURATION,
      driftX: (Math.random() - 0.5) * 0.7,
      driftY: -0.35 - Math.random() * 0.45,
    })
  }
}

function drawEnemyCleanupEffects(ctx, camera) {
  if (!gameState.enemyCleanupEffects || gameState.enemyCleanupEffects.length === 0) {
    return
  }

  const now = Date.now()

  for (let i = gameState.enemyCleanupEffects.length - 1; i >= 0; i--) {
    const effect = gameState.enemyCleanupEffects[i]
    const elapsed = now - effect.createdAt

    if (elapsed >= effect.duration) {
      gameState.enemyCleanupEffects.splice(i, 1)
      continue
    }

    const progress = elapsed / effect.duration
    const fade = 1 - progress
    const screenX = effect.x - camera.x + effect.driftX * elapsed * 0.05
    const screenY = effect.y - camera.y + effect.driftY * elapsed * 0.05
    const radius = effect.size * (0.72 + progress * 0.9)

    ctx.save()
    ctx.globalAlpha = fade * 0.45
    ctx.fillStyle = effect.color
    ctx.beginPath()
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = fade * 0.65
    ctx.strokeStyle = "rgba(255, 244, 210, 0.95)"
    ctx.lineWidth = Math.max(1, 3 * fade)
    ctx.beginPath()
    ctx.arc(screenX, screenY, radius * (1.08 + progress * 0.3), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

export function spawnImmediateNightBlackEnemies() {
  const nightConfig = getPhaseSpawnConfig("night")
  const currentBlackCount = gameState.enemies.filter((enemy) => enemy.type === "black").length
  const missingBlackCount = Math.max(0, nightConfig.initial.black - currentBlackCount)

  if (missingBlackCount > 0) {
    generateEnemies({ black: missingBlackCount })
  }
}

function findBrokenRaftForEnemy(enemy) {
  const { boats } = gameState

  if (!boats) {
    return null
  }

  for (const boat of boats) {
    if (!boat.isBroken) {
      continue
    }

    const raftRadius = boat.size * 0.6
    if (getDistance(enemy.x, enemy.y, boat.x, boat.y) <= raftRadius) {
      return boat
    }
  }

  return null
}

function getEnemyScreenPosition(enemy, camera) {
  const raft = findBrokenRaftForEnemy(enemy)
  const raftLift = raft ? raft.size * 0.18 : 0

  return {
    screenX: enemy.x - camera.x,
    screenY: enemy.y - camera.y - enemy.floatOffset - raftLift,
    raft,
  }
}

function drawEnemy(ctx, enemy, camera) {
  const { canvas } = gameState
  const renderScale = getEnemyRenderScale(enemy)
  const renderSize = enemy.size * renderScale
  const { screenX, screenY, raft } = getEnemyScreenPosition(enemy, camera)

  if (
    screenX < -renderSize ||
    screenX > canvas.width + renderSize ||
    screenY < -renderSize ||
    screenY > canvas.height + renderSize
  ) {
    return
  }

  if (!raft && !enemy.isFallingIntoHole) {
    drawEnemyWaterEffects(ctx, enemy, camera)
    createShadow(ctx, screenX, screenY, renderSize)
  } else if (!raft && enemy.isFallingIntoHole) {
    ctx.save()
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)"
    ctx.beginPath()
    ctx.ellipse(screenX, screenY + renderSize * 0.72, renderSize, renderSize * 0.34, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  } else {
    ctx.save()
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)"
    ctx.beginPath()
    ctx.ellipse(screenX, screenY + renderSize * 0.72, renderSize * 0.68, renderSize * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  drawEnemyFeet(ctx, enemy, screenX, screenY, renderSize)

  ctx.fillStyle = enemy.color
  ctx.beginPath()
  ctx.arc(screenX, screenY, renderSize * (enemy.isSwimming ? 0.9 : 0.95), 0, Math.PI * 2)
  ctx.fill()

  if (enemy.hairStyle && enemy.hairStyle !== "none") {
    const hairRadius = renderSize * 0.65
    const hairX = screenX + Math.cos(enemy.direction + Math.PI) * renderSize * 0.08
    const hairY = screenY + Math.sin(enemy.direction + Math.PI) * renderSize * 0.08

    ctx.fillStyle = enemy.hairColor || "#3b2f26"
    ctx.beginPath()
    ctx.arc(hairX, hairY, hairRadius, enemy.direction + Math.PI * 0.55, enemy.direction - Math.PI * 0.55, true)
    ctx.lineTo(hairX, hairY)
    ctx.closePath()
    ctx.fill()
  }

  if (!raft && (enemy.isSwimming || enemy.floatOffset !== 0)) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(screenX, screenY + renderSize * 0.3, renderSize * 0.85, renderSize * 0.28, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  drawEnemyBruises(ctx, enemy, screenX, screenY, renderScale)
  drawEnemyFace(ctx, enemy, screenX, screenY, renderSize)
  drawEnemyHands(ctx, enemy, screenX, screenY, renderSize)

  if (enemy.isChasing) {
    const alertSize = Math.sin(Date.now() / 100) * 3 + 10
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
    ctx.beginPath()
    ctx.arc(screenX, screenY - renderSize - 10, alertSize, 0, Math.PI * 2)
    ctx.fill()
  }

  if (enemy.isBeingThrown) {
    const time = Date.now() / 200
    const dizzySize = 3 + Math.sin(time) * 1

    ctx.fillStyle = "yellow"
    for (let i = 0; i < 3; i++) {
      const angle = time + (i * Math.PI * 2) / 3
      const orbitRadius = renderSize * 0.8
      const starX = screenX + Math.cos(angle) * orbitRadius
      const starY = screenY + Math.sin(angle) * orbitRadius - renderSize / 2

      ctx.beginPath()
      ctx.arc(starX, starY, dizzySize, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (enemy.isKnockedBack) {
    const knockbackProgress = (Date.now() - enemy.knockbackTime) / enemy.knockbackDuration
    const impactSize = (1 - knockbackProgress) * 15

    ctx.fillStyle = "rgba(255, 255, 255, " + 0.7 * (1 - knockbackProgress) + ")"
    ctx.beginPath()
    ctx.arc(screenX, screenY, renderSize + impactSize, 0, Math.PI * 2)
    ctx.fill()
  }
}

function getEnemyBlinkOpenness(enemy) {
  const cycle = 1900 + (enemy.blinkCycleOffset || 0) % 900
  const phase = (Date.now() + (enemy.blinkCycleOffset || 0)) % cycle

  if (phase < cycle - 150) {
    return 1
  }

  const closeProgress = (phase - (cycle - 150)) / 150
  return Math.max(0.08, Math.abs(Math.cos(closeProgress * Math.PI)))
}

function getEnemyEyeAnchorPoints(screenX, screenY, enemy, renderSize) {
  const dirX = Math.cos(enemy.direction)
  const dirY = Math.sin(enemy.direction)
  const tangentX = -dirY
  const tangentY = dirX
  const eyeForward = renderSize * 0.18
  const eyeSpacing = renderSize * 0.34

  return [
    {
      x: screenX + dirX * eyeForward - tangentX * eyeSpacing,
      y: screenY + dirY * eyeForward - tangentY * eyeSpacing,
    },
    {
      x: screenX + dirX * eyeForward + tangentX * eyeSpacing,
      y: screenY + dirY * eyeForward + tangentY * eyeSpacing,
    },
  ]
}

function drawEnemyFace(ctx, enemy, screenX, screenY, renderSize) {
  const eyes = getEnemyEyeAnchorPoints(screenX, screenY, enemy, renderSize)
  const eyeSize = renderSize * 0.2
  const openness = getEnemyBlinkOpenness(enemy)
  const dirX = Math.cos(enemy.direction)
  const dirY = Math.sin(enemy.direction)

  for (const eye of eyes) {
    ctx.fillStyle = "white"
    ctx.beginPath()
    ctx.ellipse(eye.x, eye.y, eyeSize, eyeSize * Math.max(0.08, openness), 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "black"
    ctx.beginPath()
    ctx.ellipse(
      eye.x + dirX * eyeSize * 0.32,
      eye.y + dirY * eyeSize * 0.32,
      eyeSize * 0.46,
      eyeSize * 0.46 * Math.max(0.3, openness),
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    if (openness < 0.98) {
      const lidColor = enemy.eyelidColor || enemy.color
      const lidHeight = eyeSize * 1.55 * (1 - openness)
      ctx.fillStyle = lidColor

      ctx.beginPath()
      ctx.ellipse(eye.x, eye.y - eyeSize + lidHeight * 0.5, eyeSize * 1.7, lidHeight * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.ellipse(eye.x, eye.y + eyeSize - lidHeight * 0.5, eyeSize * 1.7, lidHeight * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const mouthCenterX = screenX + dirX * renderSize * 0.35
  const mouthCenterY = screenY + dirY * renderSize * 0.35
  const tangentX = -dirY
  const tangentY = dirX
  const mouthHalf = renderSize * 0.12

  ctx.strokeStyle = enemy.mouthColor || "#5e3f2c"
  ctx.lineWidth = Math.max(1.2, renderSize * 0.08)
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(mouthCenterX - tangentX * mouthHalf, mouthCenterY - tangentY * mouthHalf)
  ctx.lineTo(mouthCenterX + tangentX * mouthHalf, mouthCenterY + tangentY * mouthHalf)
  ctx.stroke()
}

function getEnemyAttackPose(enemy) {
  if (!enemy.lastAttackAt) {
    return { attacking: false, thrust: 0 }
  }

  const elapsed = Date.now() - enemy.lastAttackAt
  const attackDuration = ENEMY_ATTACK_SWING_DURATION + ENEMY_ATTACK_RECOVERY_DURATION

  if (elapsed < 0 || elapsed > attackDuration) {
    return { attacking: false, thrust: 0 }
  }

  if (elapsed <= ENEMY_ATTACK_SWING_DURATION) {
    return { attacking: true, thrust: elapsed / ENEMY_ATTACK_SWING_DURATION }
  }

  const recoverElapsed = elapsed - ENEMY_ATTACK_SWING_DURATION
  return {
    attacking: true,
    thrust: 1 - recoverElapsed / ENEMY_ATTACK_RECOVERY_DURATION,
  }
}

function drawEnemyHands(ctx, enemy, screenX, screenY, renderSize) {
  const handSize = Math.max(6, renderSize * 0.22)
  const handDistance = renderSize * 0.92
  const swing = enemy.isMoving ? Math.sin(enemy.animationTime) * ENEMY_LIMB_SWING : 0
  const rightAngle = enemy.direction + Math.PI / 2
  const leftAngle = enemy.direction - Math.PI / 2
  const attackPose = getEnemyAttackPose(enemy)
  const thrust = attackPose.attacking ? attackPose.thrust * (renderSize * 0.55) : 0

  const rightHandX = screenX + Math.cos(rightAngle) * handDistance + Math.cos(enemy.direction) * swing + Math.cos(enemy.direction) * thrust
  const rightHandY = screenY + Math.sin(rightAngle) * handDistance + Math.sin(enemy.direction) * swing + Math.sin(enemy.direction) * thrust
  const leftHandX = screenX + Math.cos(leftAngle) * handDistance - Math.cos(enemy.direction) * swing
  const leftHandY = screenY + Math.sin(leftAngle) * handDistance - Math.sin(enemy.direction) * swing

  ctx.fillStyle = enemy.handColor || "#d4b189"
  ctx.beginPath()
  ctx.arc(rightHandX, rightHandY, handSize, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(leftHandX, leftHandY, handSize, 0, Math.PI * 2)
  ctx.fill()
}

function drawEnemyFeet(ctx, enemy, screenX, screenY, renderSize) {
  const footSize = Math.max(7, renderSize * 0.26)
  const footDistance = renderSize * 0.62
  const step = enemy.isMoving ? Math.sin(enemy.animationTime) * ENEMY_LIMB_SWING : 0
  const rightFootAngle = enemy.direction + Math.PI + Math.PI / 2
  const leftFootAngle = enemy.direction + Math.PI - Math.PI / 2

  const rightFootX = screenX + Math.cos(rightFootAngle) * footDistance + Math.cos(enemy.direction) * step
  const rightFootY = screenY + Math.sin(rightFootAngle) * footDistance + Math.sin(enemy.direction) * step
  const leftFootX = screenX + Math.cos(leftFootAngle) * footDistance - Math.cos(enemy.direction) * step
  const leftFootY = screenY + Math.sin(leftFootAngle) * footDistance - Math.sin(enemy.direction) * step

  ctx.fillStyle = enemy.footColor || "#444444"
  ctx.beginPath()
  ctx.arc(rightFootX, rightFootY, footSize, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(leftFootX, leftFootY, footSize, 0, Math.PI * 2)
  ctx.fill()
}

// Generate enemies
export function generateEnemies(countOrPlan) {
  const { enemies } = gameState
  const requestedPlan = typeof countOrPlan === "number" ? { red: countOrPlan } : countOrPlan
  const spawnPlan = buildSpawnPlan(requestedPlan || {})

  for (const [type, requestedCount] of Object.entries(spawnPlan)) {
    const count = Math.max(0, requestedCount || 0)

    for (let i = 0; i < count; i++) {
      let placed = false
      let attempts = 0

      while (!placed && attempts < SPAWN_ATTEMPT_LIMIT) {
        attempts++

        const position = getRandomLoadedWorldPosition(320)
        const enemy = createEnemy(type, position.x, position.y)
        if (!enemy) {
          break
        }

        if (
          isSpawnPositionClear(enemy.x, enemy.y, enemy.size, {
            requireLand: true,
            playerDistanceBuffer: 300,
          })
        ) {
          enemies.push(enemy)
          placed = true
        }
      }
    }
  }
}

export function clearAllEnemies(options = {}) {
  const { spawnCleanupEffects = false } = options

  if (spawnCleanupEffects) {
    spawnEnemyCleanupEffects(gameState.enemies)
  }

  gameState.enemies = []

  if (gameState.grabbedEnemy) {
    gameState.grabbedEnemy = null
    gameState.isGrabbing = false
  }
}

// Try to grab an enemy
export function tryGrabEnemy() {
  const { player, enemies } = gameState

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]
    const grabDistance = (player.size + enemy.size) * 1.5
    const distance = getDistance(player.x, player.y, enemy.x, enemy.y)

    // Use the larger grab distance instead of the collision distance
    if (distance < grabDistance) {
      gameState.isGrabbing = true
      gameState.grabbedEnemy = enemy
      enemies.splice(i, 1) // Remove from enemies array
      enemies.push(enemy) // Add back to the end of the array (to maintain rendering order)
      return true
    }
  }
  return false
}

// Release a grabbed enemy
export function releaseEnemy() {
  const { player, grabbedEnemy, enemies, terrain } = gameState

  if (grabbedEnemy) {
    // Calculate position in front of player based on facing direction
    const throwDistance = player.size * 4.5 // Further than rocks
    const throwAngle = player.direction

    // Set the enemy to be thrown
    grabbedEnemy.isBeingThrown = true
    grabbedEnemy.throwStartTime = Date.now()
    grabbedEnemy.throwVelocityX = Math.cos(throwAngle) * 10 // Faster than rocks
    grabbedEnemy.throwVelocityY = Math.sin(throwAngle) * 10

    // Update enemy position before releasing
    const newX = player.x + Math.cos(throwAngle) * throwDistance
    const newY = player.y + Math.sin(throwAngle) * throwDistance

    grabbedEnemy.x = newX
    grabbedEnemy.y = newY

    // Reset grabbed state
    gameState.grabbedEnemy = null
    gameState.isGrabbing = false

    return true
  }
  return false
}

// Spawn new enemies more frequently
export function spawnEnemies() {
  const currentTime = Date.now()
  const currentPhase = gameState.dayNight?.currentPhase || "dusk"
  const phaseConfig = getPhaseSpawnConfig(currentPhase)
  const ambientPlan = getAmbientEnemySpawnPlan(currentPhase)
  const totalAmbientCount = Object.values(ambientPlan).reduce((sum, value) => sum + (Number(value) || 0), 0)

  if (totalAmbientCount <= 0) {
    gameState.lastEnemySpawnTime = currentTime
    return
  }

  if (currentTime - gameState.lastEnemySpawnTime > (phaseConfig.interval || ENEMY_SPAWN_INTERVAL)) {
    generateEnemies(ambientPlan)
    gameState.lastEnemySpawnTime = currentTime
  }
}

// Apply knockback to an enemy - export this function for use in player.js
export function applyKnockbackToEnemy(enemy, sourceX, sourceY, force = 5) {
  // Calculate knockback direction (away from source)
  const angle = Math.atan2(enemy.y - sourceY, enemy.x - sourceX)

  // Set knockback state
  enemy.isKnockedBack = true
  enemy.knockbackTime = Date.now()
  enemy.knockbackVelocityX = Math.cos(angle) * force
  enemy.knockbackVelocityY = Math.sin(angle) * force
}

export function damageEnemy(enemy, amount = 1, options = {}) {
  if (!enemy || enemy.health <= 0) {
    return false
  }

  const { ignoreCooldown = false, deathSizeScale = 1 } = options
  const currentTime = Date.now()

  if (!ignoreCooldown && currentTime - enemy.lastHit < ENEMY_HIT_INVULNERABILITY) {
    return false
  }

  enemy.health = Math.max(0, enemy.health - amount)
  enemy.lastHit = currentTime

  if (enemy.health <= 0) {
    createDeathEffect({
      x: enemy.x,
      y: enemy.y,
      size: enemy.size * deathSizeScale,
      sourceVelocityX: enemy.isFallingIntoHole ? 0 : enemy.isBeingThrown ? enemy.throwVelocityX : enemy.knockbackVelocityX,
      sourceVelocityY: enemy.isFallingIntoHole ? 0 : enemy.isBeingThrown ? enemy.throwVelocityY : enemy.knockbackVelocityY,
    })

    const enemyIndex = gameState.enemies.indexOf(enemy)
    if (enemyIndex !== -1) {
      gameState.enemies.splice(enemyIndex, 1)
    }

    if (gameState.grabbedEnemy === enemy) {
      gameState.grabbedEnemy = null
      gameState.isGrabbing = false
    }

    incrementKillCount()
  }

  return true
}

export function markEnemyAttack(enemy) {
  if (!enemy) {
    return
  }

  enemy.lastAttackAt = Date.now()
}

function createEnemyBruiseMarks() {
  return [
    { x: -0.36, y: -0.12, radius: 0.2, alpha: 0.36 },
    { x: 0.18, y: -0.28, radius: 0.18, alpha: 0.32 },
    { x: 0.32, y: 0.12, radius: 0.22, alpha: 0.4 },
    { x: -0.08, y: 0.28, radius: 0.19, alpha: 0.34 },
    { x: -0.28, y: 0.2, radius: 0.17, alpha: 0.3 },
  ]
}

function drawEnemyBruises(ctx, enemy, screenX, screenY, sizeScale = 1) {
  const hitCount = enemy.maxHealth - enemy.health
  if (hitCount <= 0) {
    return
  }

  const drawSize = enemy.size * sizeScale

  for (let i = 0; i < Math.min(hitCount, enemy.bruiseMarks.length); i++) {
    const bruise = enemy.bruiseMarks[i]
    ctx.fillStyle = `rgba(58, 18, 84, ${Math.min(bruise.alpha + 0.12, 0.5)})`
    ctx.beginPath()
    ctx.arc(
      screenX + drawSize * bruise.x,
      screenY + drawSize * bruise.y,
      drawSize * bruise.radius * 1.08,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    ctx.fillStyle = `rgba(96, 42, 132, ${bruise.alpha})`
    ctx.beginPath()
    ctx.arc(screenX + drawSize * bruise.x, screenY + drawSize * bruise.y, drawSize * bruise.radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = `rgba(168, 110, 210, ${bruise.alpha * 0.38})`
    ctx.beginPath()
    ctx.arc(
      screenX + drawSize * (bruise.x - 0.04),
      screenY + drawSize * (bruise.y - 0.04),
      drawSize * bruise.radius * 0.42,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
}

function isTileAdjacentToWater(tileX, tileY) {
  const { terrain } = gameState

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      const neighborX = tileX + offsetX
      const neighborY = tileY + offsetY

      if (neighborX < 0 || neighborY < 0 || neighborY >= terrain.length || neighborX >= terrain[0].length) {
        continue
      }

      if (isWaterLikeTile(neighborX, neighborY)) {
        return true
      }
    }
  }

  return false
}

function canEnemyMoveToPosition(enemy, x, y, options = {}) {
  const { allowWater = false } = options
  const { terrain, rocks, woodenBoxes } = gameState

  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)

  if (tileX < 0 || tileX >= terrain[0].length || tileY < 0 || tileY >= terrain.length) {
    return { canMove: false, collisionType: null, collisionAngle: 0 }
  }

  if (!allowWater && isWaterLikeTile(tileX, tileY)) {
    return { canMove: false, collisionType: null, collisionAngle: 0 }
  }

  if (allowWater && isWaterLikeTile(tileX, tileY)) {
    return { canMove: true, collisionType: null, collisionAngle: 0 }
  }

  for (const rock of rocks) {
    const distance = getDistance(x, y, rock.x, rock.y)
    if (distance < enemy.size + rock.size * 0.8) {
      return {
        canMove: false,
        collisionType: "rock",
        collisionAngle: Math.atan2(enemy.y - rock.y, enemy.x - rock.x),
      }
    }
  }

  if (woodenBoxes) {
    for (const box of woodenBoxes) {
      if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

      const distance = getDistance(x, y, box.x, box.y)
      if (distance < enemy.size + box.size * 0.8) {
        damageWoodenBox(box)
        return {
          canMove: false,
          collisionType: "box",
          collisionAngle: Math.atan2(enemy.y - box.y, enemy.x - box.x),
        }
      }
    }
  }

  if (gameState.trees) {
    for (const tree of gameState.trees) {
      const distance = getDistance(x, y, tree.x, tree.y)
      if (distance < enemy.size + tree.size * 0.3) {
        return {
          canMove: false,
          collisionType: "tree",
          collisionAngle: Math.atan2(enemy.y - tree.y, enemy.x - tree.x),
        }
      }
    }
  }

  return { canMove: true, collisionType: null, collisionAngle: 0 }
}

function isEnemyOnWater(enemy) {
  const { terrain } = gameState
  const tileX = Math.floor(enemy.x / TILE_SIZE)
  const tileY = Math.floor(enemy.y / TILE_SIZE)

  return (
    tileX >= 0 &&
    tileX < terrain[0].length &&
    tileY >= 0 &&
    tileY < terrain.length &&
    isWaterLikeTile(tileX, tileY)
  )
}

function findNearestLandPoint(originX, originY, scanRadius = 6) {
  const { terrain } = gameState
  const tileX = Math.floor(originX / TILE_SIZE)
  const tileY = Math.floor(originY / TILE_SIZE)

  let closestLand = null
  let closestDistance = Infinity

  for (let y = tileY - scanRadius; y <= tileY + scanRadius; y++) {
    for (let x = tileX - scanRadius; x <= tileX + scanRadius; x++) {
      if (x < 0 || y < 0 || y >= terrain.length || x >= terrain[0].length) {
        continue
      }

      if (isWaterLikeTile(x, y)) {
        continue
      }

      const worldX = x * TILE_SIZE + TILE_SIZE / 2
      const worldY = y * TILE_SIZE + TILE_SIZE / 2
      const distance = getDistance(originX, originY, worldX, worldY)

      if (distance < closestDistance) {
        closestDistance = distance
        closestLand = { x: worldX, y: worldY, distance }
      }
    }
  }

  return closestLand
}

function spawnEnemySwimEffects(enemy, intensity = 0.2) {
  enemy.foamTrail.push({
    x: enemy.x - Math.cos(enemy.direction) * enemy.size * 0.5 + (Math.random() - 0.5) * 4,
    y: enemy.y - Math.sin(enemy.direction) * enemy.size * 0.5 + (Math.random() - 0.5) * 4,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    size: 1.5 + Math.random() * 2 + intensity,
    alpha: 0.55,
  })

  if (Math.random() < 0.22 + intensity * 0.2) {
    enemy.bowWaves.push({
      x: enemy.x + Math.cos(enemy.direction) * enemy.size * 0.55,
      y: enemy.y + Math.sin(enemy.direction) * enemy.size * 0.55,
      size: enemy.size * 0.18,
      rotation: enemy.direction,
      createdAt: Date.now(),
      progress: 0,
    })
  }
}

function updateEnemyWaterEffects(enemy) {
  for (let i = enemy.foamTrail.length - 1; i >= 0; i--) {
    const foam = enemy.foamTrail[i]
    foam.x += foam.vx
    foam.y += foam.vy
    foam.alpha -= 0.035
    foam.size *= 0.985

    if (foam.alpha <= 0.03 || foam.size <= 0.4) {
      enemy.foamTrail.splice(i, 1)
    }
  }

  for (let i = enemy.bowWaves.length - 1; i >= 0; i--) {
    const wave = enemy.bowWaves[i]
    const elapsed = Date.now() - wave.createdAt

    if (elapsed >= ENEMY_WAKE_LIFETIME) {
      enemy.bowWaves.splice(i, 1)
      continue
    }

    wave.progress = elapsed / ENEMY_WAKE_LIFETIME
  }
}

function updateEnemyFloating(enemy) {
  if (!isEnemyOnWater(enemy)) {
    enemy.floatOffset = 0
    enemy.isSwimming = false
    return false
  }

  enemy.isSwimming = false
  enemy.floatOffset = Math.sin(Date.now() / 420) * ENEMY_FLOAT_BOB

  const nearestLand = findNearestLandPoint(enemy.x, enemy.y)
  if (nearestLand) {
    if (nearestLand.distance < TILE_SIZE * 1.05) {
      return true
    }

    const landAngle = Math.atan2(nearestLand.y - enemy.y, nearestLand.x - enemy.x)
    const angleDiff = normalizeAngle(landAngle - enemy.floatAngle)
    enemy.floatAngle += angleDiff * 0.08
  } else if (Math.random() < 0.02) {
    enemy.floatAngle += ((Math.random() - 0.5) * Math.PI) / 4
  }

  enemy.x += Math.cos(enemy.floatAngle) * ENEMY_FLOAT_SPEED
  enemy.y += Math.sin(enemy.floatAngle) * ENEMY_FLOAT_SPEED
  spawnEnemySwimEffects(enemy, 0.1)
  return true
}

function drawEnemyWaterEffects(ctx, enemy, camera) {
  for (const foam of enemy.foamTrail) {
    ctx.save()
    ctx.globalAlpha = foam.alpha
    ctx.fillStyle = "rgba(247, 250, 252, 0.95)"
    ctx.beginPath()
    ctx.arc(foam.x - camera.x, foam.y - camera.y, foam.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)"
  for (const wave of enemy.bowWaves) {
    const radius = wave.size * (0.65 + wave.progress * 1.45)
    ctx.globalAlpha = 1 - wave.progress
    ctx.lineWidth = Math.max(0.8, 1.6 * (1 - wave.progress))
    ctx.beginPath()
    ctx.ellipse(wave.x - camera.x, wave.y - camera.y, radius, radius * 0.36, wave.rotation, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

function getEnemyHoleFallProgress(enemy) {
  if (!enemy.isFallingIntoHole || !enemy.holeFallStartedAt) {
    return 0
  }

  const elapsed = Date.now() - enemy.holeFallStartedAt
  return Math.min(1, elapsed / ENEMY_HOLE_FALL_DURATION)
}

function getEnemyRenderScale(enemy) {
  if (!enemy.isFallingIntoHole) {
    return 1
  }

  const progress = getEnemyHoleFallProgress(enemy)
  const eased = progress * progress * (3 - 2 * progress)
  return 1 - (1 - ENEMY_HOLE_FALL_MIN_SCALE) * eased
}

function startEnemyHoleFall(enemy) {
  if (!enemy || enemy.isFallingIntoHole || enemy.health <= 0) {
    return
  }

  enemy.isFallingIntoHole = true
  enemy.holeFallStartedAt = Date.now()
  enemy.isBeingThrown = false
  enemy.isKnockedBack = false
  enemy.throwVelocityX = 0
  enemy.throwVelocityY = 0
  enemy.knockbackVelocityX = 0
  enemy.knockbackVelocityY = 0
  enemy.floatOffset = 0
  enemy.isSwimming = false
  enemy.foamTrail = []
  enemy.bowWaves = []
}

function updateEnemyHoleFall(enemy) {
  if (!enemy.isFallingIntoHole) {
    return false
  }

  if (getEnemyHoleFallProgress(enemy) < 1) {
    return false
  }

  damageEnemy(enemy, enemy.health || 1, {
    ignoreCooldown: true,
    deathSizeScale: ENEMY_HOLE_FALL_SPLATTER_SCALE,
  })

  return true
}

// Check for collisions between thrown enemy and other enemies
function checkThrownEnemyCollisions(thrownEnemy) {
  const { enemies } = gameState

  // Only check collisions if the enemy is being thrown and has significant velocity
  if (
    !thrownEnemy.isBeingThrown ||
    (Math.abs(thrownEnemy.throwVelocityX) < 2 && Math.abs(thrownEnemy.throwVelocityY) < 2)
  ) {
    return
  }

  for (let i = 0; i < enemies.length; i++) {
    const otherEnemy = enemies[i]

    // Skip if it's the same enemy or if the other enemy is already being thrown
    if (otherEnemy === thrownEnemy || otherEnemy.isBeingThrown) {
      continue
    }

    // Check for collision
    const distance = getDistance(thrownEnemy.x, thrownEnemy.y, otherEnemy.x, otherEnemy.y)
    if (distance < thrownEnemy.size + otherEnemy.size) {
      // Calculate impact force based on throw velocity
      const impactForce = Math.sqrt(
        thrownEnemy.throwVelocityX * thrownEnemy.throwVelocityX +
          thrownEnemy.throwVelocityY * thrownEnemy.throwVelocityY,
      )

      // Apply knockback to the hit enemy
      applyKnockbackToEnemy(
        otherEnemy,
        thrownEnemy.x,
        thrownEnemy.y,
        Math.min(impactForce, 8), // Cap the force at 8
      )

      // Reduce the thrown enemy's velocity
      thrownEnemy.throwVelocityX *= 0.7
      thrownEnemy.throwVelocityY *= 0.7
    }
  }

  // Check for collisions with wooden boxes
  if (gameState.woodenBoxes) {
    for (let i = 0; i < gameState.woodenBoxes.length; i++) {
      const box = gameState.woodenBoxes[i]

      // Skip if box is being carried or thrown
      if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

      // Check for collision
      const distance = getDistance(thrownEnemy.x, thrownEnemy.y, box.x, box.y)
      if (distance < thrownEnemy.size + box.size * 0.8) {
        // Calculate impact force based on throw velocity
        const impactForce = Math.sqrt(
          thrownEnemy.throwVelocityX * thrownEnemy.throwVelocityX +
            thrownEnemy.throwVelocityY * thrownEnemy.throwVelocityY,
        )

        // Damage the box if impact is hard enough
        if (impactForce > 5) {
          damageWoodenBox(box)
        }

        // Reduce the thrown enemy's velocity
        thrownEnemy.throwVelocityX *= 0.7
        thrownEnemy.throwVelocityY *= 0.7
        break
      }
    }
  }
}

// Update enemy movement
export function updateEnemyMovement(enemy, canSeePlayer) {
  const { player, terrain, rocks, bombs, enemies, woodenBoxes } = gameState
  const previousX = enemy.x
  const previousY = enemy.y

  // If this is the grabbed enemy, don't update its movement
  if (gameState.grabbedEnemy === enemy) return

  // Falling enemies are handled by the hole-fall animation state machine.
  if (enemy.isFallingIntoHole) return

  // Handle knockback state
  if (enemy.isKnockedBack) {
    const knockbackElapsed = Date.now() - enemy.knockbackTime

    if (knockbackElapsed < enemy.knockbackDuration) {
      // Apply knockback movement
      enemy.x += enemy.knockbackVelocityX
      enemy.y += enemy.knockbackVelocityY

      // Gradually reduce knockback velocity
      enemy.knockbackVelocityX *= 0.9
      enemy.knockbackVelocityY *= 0.9

      // Check terrain boundaries
      const tileX = Math.floor(enemy.x / TILE_SIZE)
      const tileY = Math.floor(enemy.y / TILE_SIZE)

      if (
        tileX < 0 ||
        tileX >= terrain[0].length ||
        tileY < 0 ||
        tileY >= terrain.length ||
        isWaterLikeTile(tileX, tileY)
      ) {
        // Bounce off terrain boundaries
        if (tileX < 0 || tileX >= terrain[0].length) {
          enemy.knockbackVelocityX *= -0.5
        }
        if (tileY < 0 || tileY >= terrain.length) {
          enemy.knockbackVelocityY *= -0.5
        }

        // Move enemy back to valid position
        enemy.x = Math.max(0, Math.min(terrain[0].length * TILE_SIZE - 1, enemy.x))
        enemy.y = Math.max(0, Math.min(terrain.length * TILE_SIZE - 1, enemy.y))
      }

      updateEnemyAnimationState(enemy, Math.hypot(enemy.x - previousX, enemy.y - previousY))
      return // Skip normal movement while being knocked back
    } else {
      // End knockback state
      enemy.isKnockedBack = false
    }
  }

  // Handle thrown enemy physics
  if (enemy.isBeingThrown) {
    // Update position based on throw velocity
    enemy.x += enemy.throwVelocityX
    enemy.y += enemy.throwVelocityY

    // Check for collisions with other enemies
    checkThrownEnemyCollisions(enemy)

    // Slow down the throw over time (friction)
    enemy.throwVelocityX *= 0.95
    enemy.throwVelocityY *= 0.95

    // Check if the enemy has landed
    if (Math.abs(enemy.throwVelocityX) < 0.5 && Math.abs(enemy.throwVelocityY) < 0.5) {
      enemy.isBeingThrown = false

      // Check if enemy landed in water
      const tileX = Math.floor(enemy.x / TILE_SIZE)
      const tileY = Math.floor(enemy.y / TILE_SIZE)

      if (
        tileX >= 0 &&
        tileX < terrain[0].length &&
        tileY >= 0 &&
        tileY < terrain.length &&
        isWaterLikeTile(tileX, tileY)
      ) {
        enemy.floatAngle = Math.random() * Math.PI * 2
        enemy.floatOffset = 0
        enemy.isSwimming = false
        updateEnemyAnimationState(enemy, Math.hypot(enemy.x - previousX, enemy.y - previousY))
        return
      }
    }

    // Check for collisions with terrain boundaries
    const tileX = Math.floor(enemy.x / TILE_SIZE)
    const tileY = Math.floor(enemy.y / TILE_SIZE)

    if (
      tileX < 0 ||
      tileX >= terrain[0].length ||
      tileY < 0 ||
      tileY >= terrain.length
    ) {
      // Bounce off terrain boundaries
      if (tileX < 0 || tileX >= terrain[0].length) {
        enemy.throwVelocityX *= -0.7
      }
      if (tileY < 0 || tileY >= terrain.length) {
        enemy.throwVelocityY *= -0.7
      }

      // Move enemy back to valid position
      enemy.x = Math.max(0, Math.min(terrain[0].length * TILE_SIZE - 1, enemy.x))
      enemy.y = Math.max(0, Math.min(terrain.length * TILE_SIZE - 1, enemy.y))
    }

    updateEnemyAnimationState(enemy, Math.hypot(enemy.x - previousX, enemy.y - previousY))
    return
  }

  if (canSeePlayer) {
    enemy.isChasing = true
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x)
    enemy.direction = angleToPlayer

    const playerTileX = Math.floor(player.x / TILE_SIZE)
    const playerTileY = Math.floor(player.y / TILE_SIZE)
    const enemyTileX = Math.floor(enemy.x / TILE_SIZE)
    const enemyTileY = Math.floor(enemy.y / TILE_SIZE)

    const isChasingBoatOnWater =
      gameState.isInCar &&
      gameState.drivingCar?.vehicleType === "boat" &&
      playerTileX >= 0 &&
      playerTileX < terrain[0].length &&
      playerTileY >= 0 &&
      playerTileY < terrain.length &&
      isWaterLikeTile(playerTileX, playerTileY)

    const shouldAllowWaterForChase =
      isChasingBoatOnWater ||
      (enemyTileX >= 0 && enemyTileY >= 0 && isWaterLikeTile(enemyTileX, enemyTileY)) ||
      (playerTileX >= 0 && playerTileY >= 0 && isWaterLikeTile(playerTileX, playerTileY)) ||
      isTileAdjacentToWater(playerTileX, playerTileY) ||
      isTileAdjacentToWater(enemyTileX, enemyTileY)

    const chaseSpeed = shouldAllowWaterForChase ? enemy.swimSpeed : enemy.chaseSpeed
    enemy.isSwimming = shouldAllowWaterForChase
    const moveEnemyAtAngle = (angle) => {
      const targetX = enemy.x + Math.cos(angle) * chaseSpeed
      const targetY = enemy.y + Math.sin(angle) * chaseSpeed
      const moveCheck = canEnemyMoveToPosition(enemy, targetX, targetY, { allowWater: shouldAllowWaterForChase })

      if (!moveCheck.canMove) {
        return moveCheck
      }

      enemy.x = targetX
      enemy.y = targetY
      if (isChasingBoatOnWater) {
        spawnEnemySwimEffects(enemy, 0.35)
      }
      return moveCheck
    }

    const moveCheck = moveEnemyAtAngle(angleToPlayer)

    if (!moveCheck.canMove) {
      if (moveCheck.collisionAngle) {
        const bumpDistance = 2
        enemy.x += Math.cos(moveCheck.collisionAngle) * bumpDistance
        enemy.y += Math.sin(moveCheck.collisionAngle) * bumpDistance
      }

      if (!moveEnemyAtAngle(angleToPlayer + Math.PI / 4).canMove) {
        moveEnemyAtAngle(angleToPlayer - Math.PI / 4)
      }
    }
  } else {
    if (updateEnemyFloating(enemy)) {
      updateEnemyAnimationState(enemy, Math.hypot(enemy.x - previousX, enemy.y - previousY))
      return
    }

    // Wander randomly
    enemy.isChasing = false
    enemy.isSwimming = false

    // Occasionally change direction
    if (Date.now() > enemy.directionChangeTime) {
      enemy.direction = Math.random() * Math.PI * 2
      enemy.directionChangeTime = Date.now() + Math.random() * 3000 + 2000
    }

    // Move enemy
    const dx = Math.cos(enemy.direction) * enemy.speed
    const dy = Math.sin(enemy.direction) * enemy.speed

    // Check if new position would be on water or collide with a rock
    const newX = enemy.x + dx
    const newY = enemy.y + dy
    const tileX = Math.floor(newX / TILE_SIZE)
    const tileY = Math.floor(newY / TILE_SIZE)

    let canMove = true
    let collidedWithRock = false
    let collidedWithBox = false
    let collidedWithTree = false
    let rockCollisionAngle = 0
    let boxCollisionAngle = 0
    let treeCollisionAngle = 0

    // Check terrain
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      !isWaterLikeTile(tileX, tileY)
    ) {
      // Check collision with rocks
      for (const rock of rocks) {
        const distance = getDistance(newX, newY, rock.x, rock.y)
        if (distance < enemy.size + rock.size * 0.8) {
          canMove = false
          collidedWithRock = true
          rockCollisionAngle = Math.atan2(enemy.y - rock.y, enemy.x - rock.x)
          break
        }
      }

      // Check collision with wooden boxes
      if (canMove && woodenBoxes) {
        for (const box of woodenBoxes) {
          // Skip if box is being carried or thrown
          if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

          const distance = getDistance(newX, newY, box.x, box.y)
          if (distance < enemy.size + box.size * 0.8) {
            damageWoodenBox(box)
            canMove = false
            collidedWithBox = true
            boxCollisionAngle = Math.atan2(enemy.y - box.y, enemy.x - box.x)
            break
          }
        }
      }

      if (canMove && gameState.trees) {
        for (const tree of gameState.trees) {
          const distance = getDistance(newX, newY, tree.x, tree.y)
          if (distance < enemy.size + tree.size * 0.3) {
            canMove = false
            collidedWithTree = true
            treeCollisionAngle = Math.atan2(enemy.y - tree.y, enemy.x - tree.x)
            break
          }
        }
      }
    } else {
      canMove = false
    }

    if (canMove) {
      enemy.x = newX
      enemy.y = newY
    } else if (collidedWithRock) {
      // Bump away from rock
      const bumpDistance = 2
      enemy.x += Math.cos(rockCollisionAngle) * bumpDistance
      enemy.y += Math.sin(rockCollisionAngle) * bumpDistance

      // Change direction if hitting obstacle
      enemy.direction = (enemy.direction + Math.PI + ((Math.random() * Math.PI) / 2 - Math.PI / 4)) % (Math.PI * 2)
    } else if (collidedWithBox) {
      // Bump away from box
      const bumpDistance = 2
      enemy.x += Math.cos(boxCollisionAngle) * bumpDistance
      enemy.y += Math.sin(boxCollisionAngle) * bumpDistance

      // Change direction if hitting obstacle
      enemy.direction = (enemy.direction + Math.PI + ((Math.random() * Math.PI) / 2 - Math.PI / 4)) % (Math.PI * 2)
    } else if (collidedWithTree) {
      // Bump away from tree trunk
      const bumpDistance = 2
      enemy.x += Math.cos(treeCollisionAngle) * bumpDistance
      enemy.y += Math.sin(treeCollisionAngle) * bumpDistance

      // Change direction if hitting obstacle
      enemy.direction = (enemy.direction + Math.PI + ((Math.random() * Math.PI) / 2 - Math.PI / 4)) % (Math.PI * 2)
    } else {
      // Change direction if hitting obstacle
      enemy.direction = (enemy.direction + Math.PI) % (Math.PI * 2)
    }
  }

  // Check for collisions with bombs
  for (const bomb of bombs) {
    const distance = getDistance(enemy.x, enemy.y, bomb.x, bomb.y)
    if (distance < enemy.size + bomb.size) {
      // Bounce off bomb
      enemy.direction = (enemy.direction + Math.PI) % (Math.PI * 2)
      break
    }
  }

  updateEnemyAnimationState(enemy, Math.hypot(enemy.x - previousX, enemy.y - previousY))
}

// Draw and update enemies
export function drawAndUpdateEnemies() {
  const { enemies, camera, ctx, canvas, player, gameOver } = gameState

  drawEnemyCleanupEffects(ctx, camera)

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]

    // Skip drawing if this is the grabbed enemy (it's drawn separately)
    if (gameState.grabbedEnemy === enemy) continue

    // Check if enemy can see player
    const distanceToPlayer = getDistance(player.x, player.y, enemy.x, enemy.y)
    const playerUnderRoof = isUnderRoof(player.x, player.y)
    const canSeePlayer = distanceToPlayer < 300 && !playerUnderRoof // Detection radius and not under roof

    // Update enemy movement
    if (!gameOver) {
      if (enemy.isFallingIntoHole) {
        updateEnemyHoleFall(enemy)
      } else {
        updateEnemyMovement(enemy, canSeePlayer)

        if (isEnemyFullyInsideHole(enemy)) {
          startEnemyHoleFall(enemy)
        }
      }
    }

    // Enemy may have been removed after falling into a hole.
    if (!gameState.enemies.includes(enemy)) {
      continue
    }

    updateEnemyWaterEffects(enemy)

    if (findBrokenRaftForEnemy(enemy)) {
      continue
    }

    drawEnemy(ctx, enemy, camera)
  }
}

export function drawBrokenRaftEnemies() {
  const { enemies, camera, ctx } = gameState

  for (const enemy of enemies) {
    if (!findBrokenRaftForEnemy(enemy)) {
      continue
    }

    drawEnemy(ctx, enemy, camera)
  }
}