// Wooden box entity
import { gameState } from "../core/game-state.js"
import {
  WOODEN_BOX_SIZE,
  TILE_SIZE,
  WOODEN_BOX_THROW_MULTIPLIER,
  WOODEN_BOX_FLOAT_SPEED,
  WOODEN_BOX_SNAP_DISTANCE,
} from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { applyKnockbackToEnemy } from "../entities/enemies.js"

// Roof system for wooden boxes and rocks
let roofAreas = [] // Store detected roof areas

// Generate wooden boxes
export function generateWoodenBoxes(count) {
  const { terrain, woodenBoxes, bombs, apples, enemies, rocks, player } = gameState

  for (let i = 0; i < count; i++) {
    const woodenBox = createWoodenBox(
      Math.random() * (terrain[0].length * TILE_SIZE),
      Math.random() * (terrain.length * TILE_SIZE),
    )

    // Determine if the box will be placed on land or water
    const tileX = Math.floor(woodenBox.x / TILE_SIZE)
    const tileY = Math.floor(woodenBox.y / TILE_SIZE)

    let validPosition = true

    // Ensure box is not on invalid terrain (outside map) and not too close to player
    if (
      tileX < 0 ||
      tileX >= terrain[0].length ||
      tileY < 0 ||
      tileY >= terrain.length ||
      getDistance(woodenBox.x, woodenBox.y, player.x, player.y) < woodenBox.size + player.size + 100
    ) {
      validPosition = false
    }

    // Check for overlap with other objects (only if not in water)
    if (validPosition && terrain[tileY][tileX] !== 0) {
      // Not water
      // Check overlap with other wooden boxes
      for (const otherBox of woodenBoxes) {
        if (getDistance(woodenBox.x, woodenBox.y, otherBox.x, otherBox.y) < woodenBox.size + otherBox.size) {
          validPosition = false
          break
        }
      }

      // Check overlap with rocks
      if (validPosition) {
        for (const rock of rocks) {
          if (getDistance(woodenBox.x, woodenBox.y, rock.x, rock.y) < woodenBox.size + rock.size) {
            validPosition = false
            break
          }
        }
      }

      // Check overlap with bombs
      if (validPosition) {
        for (const bomb of bombs) {
          if (getDistance(woodenBox.x, woodenBox.y, bomb.x, bomb.x) < woodenBox.size + bomb.size) {
            validPosition = false
            break
          }
        }
      }
    }

    if (validPosition) {
      // Set floating state if on water
      if (
        tileX >= 0 &&
        tileX < terrain[0].length &&
        tileY >= 0 &&
        tileY < terrain.length &&
        terrain[tileY][tileX] === 0
      ) {
        // TERRAIN_TYPES.WATER
        woodenBox.isFloating = true
        woodenBox.floatAngle = Math.random() * Math.PI * 2
      }

      woodenBoxes.push(woodenBox)
    } else {
      i-- // Try again
    }
  }
}

// Create a new wooden box
function createWoodenBox(x, y) {
  return {
    x: x,
    y: y,
    size: WOODEN_BOX_SIZE,
    hitPoints: 3, // Boxes take 3 hits to destroy
    damageState: 0, // 0 = undamaged, 1 = slightly damaged, 2 = heavily damaged
    rotation: Math.random() * Math.PI * 0.2 - Math.PI * 0.1, // Slight random rotation
    isFloating: false, // Whether the box is floating on water
    floatAngle: 0, // Direction of floating movement
    floatOffset: 0, // Visual float bobbing effect
    isBeingThrown: false,
    throwStartTime: 0,
    throwVelocityX: 0,
    throwVelocityY: 0,
    lastHitTime: 0, // For damage animation
    snappedTo: null, // Reference to another box this box is snapped to
    type: "box", // Identify this as a box for roof detection
  }
}

// Try to grab a wooden box
export function tryGrabWoodenBox() {
  const { player, woodenBoxes } = gameState

  for (let i = 0; i < woodenBoxes.length; i++) {
    const box = woodenBoxes[i]
    const distance = getDistance(player.x, player.y, box.x, box.y)

    if (distance < player.size + box.size) {
      // If box was snapped to another box, unsnap it
      if (box.snappedTo) {
        box.snappedTo = null
      }

      gameState.isGrabbing = true
      gameState.grabbedWoodenBox = box
      woodenBoxes.splice(i, 1) // Remove from woodenBoxes array
      return true
    }
  }
  return false
}

// Release a grabbed wooden box
export function releaseWoodenBox() {
  const { player, grabbedWoodenBox, woodenBoxes, terrain, rocks } = gameState

  if (grabbedWoodenBox) {
    // If throwing, calculate throw parameters
    if (gameState.keys[" "] || gameState.buttonAActive) {
      // Space or A button
      // Calculate position in front of player based on facing direction
      const throwAngle = player.direction

      // Set the box to be thrown with enhanced throw distance
      grabbedWoodenBox.isBeingThrown = true
      grabbedWoodenBox.throwStartTime = Date.now()
      grabbedWoodenBox.throwVelocityX = Math.cos(throwAngle) * 10 * WOODEN_BOX_THROW_MULTIPLIER
      grabbedWoodenBox.throwVelocityY = Math.sin(throwAngle) * 10 * WOODEN_BOX_THROW_MULTIPLIER

      // Update box position before releasing
      const throwDistance = player.size * 2
      const newX = player.x + Math.cos(throwAngle) * throwDistance
      const newY = player.y + Math.sin(throwAngle) * throwDistance

      grabbedWoodenBox.x = newX
      grabbedWoodenBox.y = newY
    } else {
      // If not throwing, just place it in front of the player
      const placeDistance = player.size + grabbedWoodenBox.size * 0.8
      const newX = player.x + Math.cos(player.direction) * placeDistance
      const newY = player.y + Math.sin(player.direction) * placeDistance

      grabbedWoodenBox.x = newX
      grabbedWoodenBox.y = newY

      // Check if box is placed on water
      const tileX = Math.floor(newX / TILE_SIZE)
      const tileY = Math.floor(newY / TILE_SIZE)

      if (
        tileX >= 0 &&
        tileX < terrain[0].length &&
        tileY >= 0 &&
        tileY < terrain.length &&
        terrain[tileY][tileX] === 0 // TERRAIN_TYPES.WATER
      ) {
        grabbedWoodenBox.isFloating = true
        grabbedWoodenBox.floatAngle = Math.random() * Math.PI * 2
      } else {
        grabbedWoodenBox.isFloating = false

        // Check for box snapping to other boxes or rocks
        checkForBoxSnapping(grabbedWoodenBox, woodenBoxes, rocks)
      }
    }

    woodenBoxes.push(grabbedWoodenBox)
    gameState.grabbedWoodenBox = null
    gameState.isGrabbing = false
    return true
  }
  return false
}

// Check if a box should snap to another box or rock
function checkForBoxSnapping(box, allBoxes, allRocks) {
  // Don't snap if the box is being thrown or is floating
  if (box.isBeingThrown || box.isFloating) return

  let closestObject = null
  let closestDistance = WOODEN_BOX_SNAP_DISTANCE
  let objectType = null

  // Find the closest box within snapping distance
  for (const otherBox of allBoxes) {
    // Skip self or boxes being thrown or floating
    if (otherBox === box || otherBox.isBeingThrown || otherBox.isFloating) continue

    const distance = getDistance(box.x, box.y, otherBox.x, otherBox.y)
    if (distance < closestDistance) {
      closestDistance = distance
      closestObject = otherBox
      objectType = "box"
    }
  }

  // Also check for nearby rocks
  for (const rock of allRocks) {
    // Skip rocks being carried
    if (rock === gameState.grabbedRock) continue

    const distance = getDistance(box.x, box.y, rock.x, rock.y)
    if (distance < closestDistance) {
      closestDistance = distance
      closestObject = rock
      objectType = "rock"
    }
  }

  // If found a box or rock to snap to
  if (closestObject) {
    // Calculate the angle between the objects
    const angle = Math.atan2(box.y - closestObject.y, box.x - closestObject.x)

    // Round to nearest 90 degrees for edge alignment
    const snapAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2)

    // Calculate new position based on snap angle with reduced gap
    // Use 0.95 multiplier for both objects to make them almost touch
    const snapDistance = box.size * 0.95 + closestObject.size * 0.95

    // Calculate the new position where the box would snap
    const newX = closestObject.x + Math.cos(snapAngle) * snapDistance
    const newY = closestObject.y + Math.sin(snapAngle) * snapDistance

    // Check if player would get stuck
    const { player } = gameState
    if (player) {
      const distanceToPlayer = getDistance(newX, newY, player.x, player.y)

      // If player is too close to where the box will snap
      if (distanceToPlayer < player.size + box.size * 0.7) {
        // Push player away from the snapping area
        const pushAngle = Math.atan2(player.y - newY, player.x - newX)
        const pushDistance = player.size + box.size * 0.7 - distanceToPlayer + 5 // Add 5px buffer

        // Move player away
        player.x += Math.cos(pushAngle) * pushDistance
        player.y += Math.sin(pushAngle) * pushDistance
      }
    }

    // Set the box position
    box.x = newX
    box.y = newY

    // Store reference to snapped object
    box.snappedTo = closestObject

    // Reset rotation when snapped
    box.rotation = 0

    // Create a visual effect
    createSnapEffect(box, closestObject)
  }
}

// Modify the snapBoxToOtherBox function to reduce the gap between boxes
function snapBoxToOtherBox(box, otherObject) {
  // Calculate the angle between the objects
  const angle = Math.atan2(box.y - otherObject.y, box.x - otherObject.x)

  // Round to nearest 90 degrees for edge alignment
  const snapAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2)

  // Calculate new position based on snap angle
  // Use 0.95 multiplier for both objects to make them almost touch
  const snapDistance = box.size * 0.95 + otherObject.size * 0.95

  // Calculate the new position where the box would snap
  const newX = otherObject.x + Math.cos(snapAngle) * snapDistance
  const newY = otherObject.y + Math.sin(snapAngle) * snapDistance

  // Check if player would get stuck
  const { player } = gameState
  if (player) {
    const distanceToPlayer = getDistance(newX, newY, player.x, player.y)

    // If player is too close to where the box will snap
    if (distanceToPlayer < player.size + box.size * 0.7) {
      // Push player away from the snapping area
      const pushAngle = Math.atan2(player.y - newY, player.x - newX)
      const pushDistance = player.size + box.size * 0.7 - distanceToPlayer + 5 // Add 5px buffer

      // Move player away
      player.x += Math.cos(pushAngle) * pushDistance
      player.y += Math.sin(pushAngle) * pushDistance
    }
  }

  // Set the box position
  box.x = newX
  box.y = newY

  // Store reference to snapped object
  box.snappedTo = otherObject

  // Reset rotation when snapped
  box.rotation = 0

  // Create a small visual effect to indicate snapping
  createSnapEffect(box, otherObject)
}

// Ensure the damageWoodenBox function is properly exported and handles the damage states
// Apply damage to a wooden box
export function damageWoodenBox(box, amount = 1) {
  // Skip if box doesn't exist
  if (!box) return false

  box.hitPoints -= amount
  box.lastHitTime = Date.now()

  // Update damage state based on hit points
  box.damageState = 3 - box.hitPoints

  // If destroyed, remove box and spawn a new one elsewhere
  if (box.hitPoints <= 0) {
    createBoxDestructionEffect(box)

    // Find and remove the box
    const boxIndex = gameState.woodenBoxes.indexOf(box)
    if (boxIndex !== -1) {
      gameState.woodenBoxes.splice(boxIndex, 1)

      // Spawn a new box elsewhere (delayed to prevent instant respawning)
      setTimeout(() => {
        if (gameState.woodenBoxes) {
          // Check if game still exists
          generateWoodenBoxes(1)
        }
      }, 1000)
    }
    return true // Box was destroyed
  }
  return false // Box was damaged but not destroyed
}

// Create destruction effect when a box is destroyed
function createBoxDestructionEffect(box) {
  if (!gameState.boxDestructionEffects) {
    gameState.boxDestructionEffects = []
  }

  // Create 12-15 wood splinter particles
  const particleCount = 12 + Math.floor(Math.random() * 4)
  const effect = {
    particles: [],
    createdAt: Date.now(),
  }

  // If box was being thrown, inherit some of its velocity
  const baseVelX = box.isBeingThrown ? box.throwVelocityX * 0.3 : 0
  const baseVelY = box.isBeingThrown ? box.throwVelocityY * 0.3 : 0

  for (let i = 0; i < particleCount; i++) {
    // Random angle for particle dispersion
    const angle = Math.random() * Math.PI * 2
    // Random speed between 2 and 6
    const speed = 2 + Math.random() * 4
    // Random size between 4 and 10
    const size = 4 + Math.random() * 6
    // Random lifetime between 500ms and 1500ms
    const lifetime = 500 + Math.random() * 1000
    // Random rotation
    const rotation = Math.random() * Math.PI * 2
    // Random rotation speed
    const rotationSpeed = (Math.random() - 0.5) * 0.2

    // Create particle with slightly random brown colors
    effect.particles.push({
      x: box.x,
      y: box.y,
      size: size,
      velocityX: baseVelX + Math.cos(angle) * speed,
      velocityY: baseVelY + Math.sin(angle) * speed,
      rotation: rotation,
      rotationSpeed: rotationSpeed,
      lifetime: lifetime,
      maxLifetime: lifetime,
      // Slightly different shades of brown for wood pieces
      color: `hsl(${25 + Math.random() * 15}, ${70 + Math.random() * 20}%, ${35 + Math.random() * 15}%)`,
      // Random shape (0 = rectangle, 1 = triangle)
      shape: Math.random() > 0.5 ? 0 : 1,
      // Length and width for rectangular splinters
      length: 8 + Math.random() * 10,
      width: 2 + Math.random() * 3,
    })
  }

  gameState.boxDestructionEffects.push(effect)
}

// Draw and update box destruction effects
function drawAndUpdateBoxDestructionEffects() {
  if (!gameState.boxDestructionEffects) return

  const { camera, ctx } = gameState

  for (let i = gameState.boxDestructionEffects.length - 1; i >= 0; i--) {
    const effect = gameState.boxDestructionEffects[i]
    const elapsed = Date.now() - effect.createdAt

    // Remove effect if all particles are dead
    if (effect.particles.length === 0) {
      gameState.boxDestructionEffects.splice(i, 1)
      continue
    }

    // Update and draw each particle
    for (let j = effect.particles.length - 1; j >= 0; j--) {
      const particle = effect.particles[j]

      // Update particle position
      particle.x += particle.velocityX
      particle.y += particle.velocityY

      // Apply gravity
      particle.velocityY += 0.15

      // Apply friction
      particle.velocityX *= 0.97
      particle.velocityY *= 0.97

      // Update rotation
      particle.rotation += particle.rotationSpeed

      // Decrease lifetime
      particle.lifetime -= 16 // Roughly 60fps

      // Remove dead particles
      if (particle.lifetime <= 0) {
        effect.particles.splice(j, 1)
        continue
      }

      // Calculate screen position
      const screenX = particle.x - camera.x
      const screenY = particle.y - camera.y

      // Skip if off-screen
      if (
        screenX < -particle.size * 2 ||
        screenX > ctx.canvas.width + particle.size * 2 ||
        screenY < -particle.size * 2 ||
        screenY > ctx.canvas.height + particle.size * 2
      ) {
        continue
      }

      // Calculate opacity based on lifetime
      const opacity = particle.lifetime / particle.maxLifetime

      // Draw particle
      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.rotate(particle.rotation)

      // Draw wood splinter based on shape
      ctx.fillStyle = particle.color
      ctx.globalAlpha = opacity

      if (particle.shape === 0) {
        // Rectangle
        // Draw rectangular splinter
        ctx.fillRect(-particle.length / 2, -particle.width / 2, particle.length, particle.width)
      } else {
        // Triangle
        // Draw triangular splinter
        ctx.beginPath()
        ctx.moveTo(particle.size, 0)
        ctx.lineTo(-particle.size / 2, particle.size / 2)
        ctx.lineTo(-particle.size / 2, -particle.size / 2)
        ctx.closePath()
        ctx.fill()
      }

      ctx.globalAlpha = 1
      ctx.restore()
    }
  }
}

// Check for collisions between thrown boxes and other objects
function checkThrownBoxCollisions(box) {
  const { enemies, rocks, woodenBoxes } = gameState

  // Only check collisions if the box is being thrown and has significant velocity
  if (!box.isBeingThrown || (Math.abs(box.throwVelocityX) < 2 && Math.abs(box.throwVelocityY) < 2)) {
    return
  }

  // Check collisions with enemies
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]

    // Skip if enemy is already being thrown or carried
    if (enemy.isBeingThrown || enemy === gameState.grabbedEnemy) {
      continue
    }

    // Check for collision
    const distance = getDistance(box.x, box.y, enemy.x, enemy.y)
    if (distance < box.size + enemy.size) {
      // Calculate impact force based on throw velocity
      const impactForce = Math.sqrt(box.throwVelocityX * box.throwVelocityX + box.throwVelocityY * box.throwVelocityY)

      // Apply knockback to the hit enemy
      applyKnockbackToEnemy(
        enemy,
        box.x,
        box.y,
        Math.min(impactForce * 0.8, 10), // Cap the force at 10
      )

      // Reduce the box's velocity and apply damage to it
      box.throwVelocityX *= 0.5
      box.throwVelocityY *= 0.5

      // Damage the box when it hits enemies hard enough
      if (impactForce > 5) {
        damageWoodenBox(box)
      }
    }
  }

  // Check collisions with rocks
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i]

    // Skip if rock is being carried
    if (rock === gameState.grabbedRock) {
      continue
    }

    // Check for collision
    const distance = getDistance(box.x, box.y, rock.x, rock.y)
    if (distance < box.size + rock.size * 0.8) {
      // Calculate impact force
      const impactForce = Math.sqrt(box.throwVelocityX * box.throwVelocityX + box.throwVelocityY * box.throwVelocityY)

      // If the impact is not too hard, snap the box to the rock
      if (impactForce < 8) {
        // Stop the box from being thrown
        box.isBeingThrown = false
        box.throwVelocityX = 0
        box.throwVelocityY = 0

        // Apply snapping logic
        snapBoxToOtherBox(box, rock)
      } else {
        // Bounce off the rock if impact is too hard
        const angle = Math.atan2(box.y - rock.y, box.x - rock.x)
        box.throwVelocityX = Math.cos(angle) * impactForce * 0.5
        box.throwVelocityY = Math.sin(angle) * impactForce * 0.5

        // Damage the box on hard impact
        if (impactForce > 5) {
          damageWoodenBox(box)
        }
      }

      break
    }
  }

  // Check collisions with other wooden boxes
  for (let i = 0; i < woodenBoxes.length; i++) {
    const otherBox = woodenBoxes[i]

    // Skip self, carried box, or thrown box
    if (otherBox === box || otherBox === gameState.grabbedWoodenBox || otherBox.isBeingThrown) {
      continue
    }

    // Check for collision
    const distance = getDistance(box.x, box.y, otherBox.x, otherBox.y)
    if (distance < box.size + otherBox.size * 0.8) {
      // Calculate impact force
      const impactForce = Math.sqrt(box.throwVelocityX * box.throwVelocityX + box.throwVelocityY * box.throwVelocityY)

      // If impact is hard enough, damage both boxes
      if (impactForce > 5) {
        damageWoodenBox(box)
        damageWoodenBox(otherBox)
      }

      // If the impact is not too hard, snap the box to the other box
      if (impactForce < 8) {
        // Stop the box from being thrown
        box.isBeingThrown = false
        box.throwVelocityX = 0
        box.throwVelocityY = 0

        // Apply snapping logic
        snapBoxToOtherBox(box, otherBox)
      } else {
        // Bounce off the other box if impact is too hard
        const angle = Math.atan2(box.y - otherBox.y, box.x - otherBox.x)
        box.throwVelocityX = Math.cos(angle) * impactForce * 0.5
        box.throwVelocityY = Math.sin(angle) * impactForce * 0.5
      }

      break
    }
  }
}

// Add a function to create a visual effect when objects snap together
export function createSnapEffect(object1, object2) {
  // Calculate the midpoint between the objects
  const midX = (object1.x + object2.x) / 2
  const midY = (object1.y + object2.y) / 2

  // Create a small particle effect if it doesn't exist
  if (!gameState.snapEffects) {
    gameState.snapEffects = []
  }

  // Add a new snap effect
  gameState.snapEffects.push({
    x: midX,
    y: midY,
    size: object1.size * 0.5,
    createdAt: Date.now(),
    duration: 300, // 300ms effect
  })
}

// Add a function to draw snap effects
function drawSnapEffects() {
  if (!gameState.snapEffects) return

  const { camera, ctx } = gameState

  for (let i = gameState.snapEffects.length - 1; i >= 0; i--) {
    const effect = gameState.snapEffects[i]
    const elapsed = Date.now() - effect.createdAt

    // Remove effect if it's done
    if (elapsed > effect.duration) {
      gameState.snapEffects.splice(i, 1)
      continue
    }

    // Calculate progress (0 to 1)
    const progress = elapsed / effect.duration
    const opacity = 1 - progress
    const size = effect.size * (1 + progress)

    // Draw the effect
    const screenX = effect.x - camera.x
    const screenY = effect.y - camera.y

    // Draw a circle that expands and fades
    ctx.beginPath()
    ctx.arc(screenX, screenY, size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`
    ctx.fill()

    // Draw connecting lines
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`
    ctx.lineWidth = 2 * (1 - progress)

    for (let j = 0; j < 4; j++) {
      const angle = (j / 4) * Math.PI * 2
      const innerRadius = size * 0.3
      const outerRadius = size

      ctx.beginPath()
      ctx.moveTo(screenX + Math.cos(angle) * innerRadius, screenY + Math.sin(angle) * innerRadius)
      ctx.lineTo(screenX + Math.cos(angle) * outerRadius, screenY + Math.sin(angle) * outerRadius)
      ctx.stroke()
    }
  }
}

// Draw and update wooden boxes
export function drawAndUpdateWoodenBoxes() {
  try {
    const { woodenBoxes, camera, ctx, canvas, terrain } = gameState

    for (let i = woodenBoxes.length - 1; i >= 0; i--) {
      const box = woodenBoxes[i]
      if (!box) continue // Skip if box is undefined

      // Handle thrown box physics
      if (box.isBeingThrown) {
        // Update position based on throw velocity
        box.x += box.throwVelocityX
        box.y += box.throwVelocityY

        // After updating position, check if the box has entered water
        const waterTileX = Math.floor(box.x / TILE_SIZE)
        const waterTileY = Math.floor(box.y / TILE_SIZE)

        // Check if the box is now over water
        if (waterTileX >= 0 && waterTileX < terrain[0].length && waterTileY >= 0 && waterTileY < terrain.length) {
          // If the box was not floating and is now over water
          if (!box.isFloating && terrain[waterTileY][waterTileX] === 0) {
            // Create a splash effect
            createWaterSplashEffect(box)

            // Set the box to floating mode
            setBoxFloating(box, true)

            // Reduce velocity when hitting water
            box.throwVelocityX *= 0.7
            box.throwVelocityY *= 0.7
          }
          // If the box was floating and is now over land
          else if (box.isFloating && terrain[waterTileY][waterTileX] !== 0) {
            setBoxFloating(box, false)
          }
        }

        // Check for collisions with enemies
        checkThrownBoxCollisions(box)

        // Slow down the throw over time (friction)
        box.throwVelocityX *= 0.97
        box.throwVelocityY *= 0.97

        // Check if the box has landed
        if (Math.abs(box.throwVelocityX) < 0.5 && Math.abs(box.throwVelocityY) < 0.5) {
          box.isBeingThrown = false

          // Check if box landed in water
          const tileX = Math.floor(box.x / TILE_SIZE)
          const tileY = Math.floor(box.y / TILE_SIZE)

          if (
            tileX >= 0 &&
            tileX < terrain[0].length &&
            tileY >= 0 &&
            tileY < terrain.length &&
            terrain[tileY][tileX] === 0 // TERRAIN_TYPES.WATER
          ) {
            // Box landed in water, set floating state
            setBoxFloating(box, true)
          } else {
            // Box landed on land
            setBoxFloating(box, false)

            // Check for box snapping
            checkForBoxSnapping(box, woodenBoxes, gameState.rocks)
          }
        }

        // Check for collisions with terrain boundaries
        const tileX = Math.floor(box.x / TILE_SIZE)
        const tileY = Math.floor(box.y / TILE_SIZE)

        if (tileX < 0 || tileX >= terrain[0].length || tileY < 0 || tileY >= terrain.length) {
          // Bounce off terrain boundaries
          if (tileX < 0 || tileX >= terrain[0].length) {
            box.throwVelocityX *= -0.7
          }
          if (tileY < 0 || tileY >= terrain.length) {
            box.throwVelocityY *= -0.7
          }

          // Move box back to valid position
          box.x = Math.max(0, Math.min(terrain[0].length * TILE_SIZE - 1, box.x))
          box.y = Math.max(0, Math.min(terrain.length * TILE_SIZE - 1, box.y))

          // Damage box on hard impact with boundaries
          damageWoodenBox(box)
        }
      }

      // Handle floating on water
      if (box.isFloating) {
        // Update float animation offset
        box.floatOffset = Math.sin(Date.now() / 500) * 3

        // Drift in the direction of float angle
        box.x += Math.cos(box.floatAngle) * WOODEN_BOX_FLOAT_SPEED
        box.y += Math.sin(box.floatAngle) * WOODEN_BOX_FLOAT_SPEED

        // Occasionally change drift direction slightly
        if (Math.random() < 0.02) {
          box.floatAngle += ((Math.random() - 0.5) * Math.PI) / 4
        }

        // Check if box has drifted to land
        const tileX = Math.floor(box.x / TILE_SIZE)
        const tileY = Math.floor(box.y / TILE_SIZE)

        if (
          tileX >= 0 &&
          tileX < terrain[0].length &&
          tileY >= 0 &&
          tileY < terrain.length &&
          terrain[tileY][tileX] !== 0 // Not water
        ) {
          box.isFloating = false

          // Check for box snapping
          checkForBoxSnapping(box, woodenBoxes, gameState.rocks)
        }

        // Drift toward shore if nearby
        let nearestLand = null
        let nearestLandDistance = box.size * 5

        // Check 8 directions for nearby land
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue

            const checkTileX = Math.floor((box.x + dx * box.size) / TILE_SIZE)
            const checkTileY = Math.floor((box.y + dy * box.size) / TILE_SIZE)

            if (
              checkTileX >= 0 &&
              checkTileX < terrain[0].length &&
              checkTileY >= 0 &&
              checkTileY < terrain.length &&
              terrain[checkTileY][checkTileX] !== 0 // Not water
            ) {
              // Found land, calculate center of land tile
              const landX = checkTileX * TILE_SIZE + TILE_SIZE / 2
              const landY = checkTileY * TILE_SIZE + TILE_SIZE / 2
              const landDistance = getDistance(box.x, box.y, landX, landY)

              if (landDistance < nearestLandDistance) {
                nearestLandDistance = landDistance
                nearestLand = { x: landX, y: landY }
              }
            }
          }
        }

        // If land is nearby, drift toward it
        if (nearestLand) {
          const landAngle = Math.atan2(nearestLand.y - box.y, nearestLand.x - box.x)
          // Gradually adjust float angle toward land
          const angleDiff = landAngle - box.floatAngle
          // Normalize angle difference to -PI to PI
          const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff))
          box.floatAngle += normalizedDiff * 0.1
        }
      }

      const screenX = box.x - camera.x
      const screenY = box.y - camera.y - (box.isFloating ? box.floatOffset : 0)

      // Skip if box is off-screen
      if (
        screenX < -box.size ||
        screenX > canvas.width + box.size ||
        screenY < -box.size ||
        screenY > canvas.height + box.size
      ) {
        continue
      }

      // Draw shadow
      createShadow(
        ctx,
        screenX,
        screenY + (box.isFloating ? box.floatOffset : 0), // Adjust shadow position when floating
        box.size,
        "rectangle",
        {
          width: box.size,
          height: box.size,
          radius: 4,
        },
        box.rotation,
      )

      // Draw wooden box
      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.rotate(box.rotation)

      // Draw the base wooden box
      drawWoodenBox(ctx, box)

      // Draw damage overlays based on damage state
      if (box.damageState > 0) {
        drawDamageOverlay(ctx, box)
      }

      // Draw floating effect if box is on water
      if (box.isFloating) {
        drawFloatingEffect(ctx, box)
      }

      ctx.restore()

      // If box was just hit, draw impact effect
      if (Date.now() - box.lastHitTime < 300) {
        drawImpactEffect(ctx, screenX, screenY, box)
      }
    }

    // Draw box destruction effects
    drawAndUpdateBoxDestructionEffects()

    drawSnapEffects()
    drawAndUpdateSplashEffects()

    // Draw grabbed wooden box
    if (gameState.grabbedWoodenBox) {
      drawGrabbedWoodenBox(ctx, camera)
    }

    // Detect and draw roof areas
    detectRoofAreas()
    drawRoofAreas()
  } catch (error) {
    console.error("Error in drawAndUpdateWoodenBoxes:", error)
  }
}

// Detect and create roof areas from wooden boxes and rocks
function detectRoofAreas() {
  const { woodenBoxes, rocks } = gameState

  // Clear previous roof areas
  roofAreas = []

  // Combine boxes and rocks for roof detection
  const buildingObjects = [...woodenBoxes]

  // Add rocks with type property
  rocks.forEach((rock) => {
    // Create a copy of the rock with a type property
    buildingObjects.push({
      ...rock,
      type: "rock",
    })
  })

  // Skip if there are too few objects to form a roof (need at least 3)
  if (buildingObjects.length < 3) return

  // Find all snapped object groups
  const objectGroups = findSnappedObjectGroups(buildingObjects)

  // For each group, check if they form a U-shape
  for (const group of objectGroups) {
    if (group.length < 3) continue // Need at least 3 objects

    // Find potential U-shapes
    const uShapes = findUShapes(group)

    // Add valid U-shapes as roof areas
    roofAreas.push(...uShapes)
  }
}

// Find groups of connected objects (boxes and rocks)
function findSnappedObjectGroups(objects) {
  const groups = []
  const visited = new Set()

  for (const obj of objects) {
    if (visited.has(obj)) continue

    // Start a new group with this object
    const group = []
    const queue = [obj]
    visited.add(obj)

    // BFS to find all connected objects
    while (queue.length > 0) {
      const currentObj = queue.shift()
      group.push(currentObj)

      // Find all objects snapped to this one
      for (const otherObj of objects) {
        if (visited.has(otherObj)) continue

        // Check if objects are snapped together
        const distance = getDistance(currentObj.x, currentObj.y, otherObj.x, otherObj.y)
        if (distance < currentObj.size * 2) {
          // Close enough to be snapped
          queue.push(otherObj)
          visited.add(otherObj)
        }
      }
    }

    if (group.length > 0) {
      groups.push(group)
    }
  }

  return groups
}

// Find U-shapes in a group of objects
function findUShapes(objectGroup) {
  const uShapes = []

  // Try each object as a potential corner
  for (const cornerObj of objectGroup) {
    // Find objects aligned horizontally with this corner
    const horizontalObjects = objectGroup.filter(
      (obj) => Math.abs(obj.y - cornerObj.y) < obj.size * 0.5 && Math.abs(obj.x - cornerObj.x) > obj.size * 0.5,
    )

    // Find objects aligned vertically with this corner
    const verticalObjects = objectGroup.filter(
      (obj) => Math.abs(obj.x - cornerObj.x) < obj.size * 0.5 && Math.abs(obj.y - cornerObj.y) > obj.size * 0.5,
    )

    // Need at least one object in each direction to form a U
    if (horizontalObjects.length > 0 && verticalObjects.length > 0) {
      // Find the furthest object in each direction
      const furthestHorizontal = horizontalObjects.reduce(
        (furthest, obj) => (Math.abs(obj.x - cornerObj.x) > Math.abs(furthest.x - cornerObj.x) ? obj : furthest),
        horizontalObjects[0],
      )

      const furthestVertical = verticalObjects.reduce(
        (furthest, obj) => (Math.abs(obj.y - cornerObj.y) > Math.abs(furthest.y - cornerObj.y) ? obj : furthest),
        verticalObjects[0],
      )

      // Calculate the roof area
      const minX = Math.min(cornerObj.x, furthestHorizontal.x, furthestVertical.x) - cornerObj.size / 2
      const maxX = Math.max(cornerObj.x, furthestHorizontal.x, furthestVertical.x) + cornerObj.size / 2
      const minY = Math.min(cornerObj.y, furthestHorizontal.y, furthestVertical.y) - cornerObj.size / 2
      const maxY = Math.max(cornerObj.y, furthestHorizontal.y, furthestVertical.y) + cornerObj.size / 2

      // Create a roof area
      uShapes.push({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        createdAt: Date.now(),
      })
    }
  }

  return uShapes
}

// Draw roof areas
function drawRoofAreas() {
  const { camera, ctx, player } = gameState

  for (const roof of roofAreas) {
    const screenX = roof.x - camera.x
    const screenY = roof.y - camera.y

    // Draw semi-transparent brown roof
    ctx.fillStyle = "rgba(139, 69, 19, 0.4)" // Semi-transparent brown
    ctx.fillRect(screenX, screenY, roof.width, roof.height)

    // Draw subtle grid pattern for visual interest
    ctx.strokeStyle = "rgba(139, 69, 19, 0.5)"
    ctx.lineWidth = 1

    // Horizontal lines
    for (let y = 0; y < roof.height; y += 20) {
      ctx.beginPath()
      ctx.moveTo(screenX, screenY + y)
      ctx.lineTo(screenX + roof.width, screenY + y)
      ctx.stroke()
    }

    // Vertical lines
    for (let x = 0; x < roof.width; x += 20) {
      ctx.beginPath()
      ctx.moveTo(screenX + x, screenY)
      ctx.lineTo(screenX + x, screenY + roof.height)
      ctx.stroke()
    }

    // Check if player is under this roof
    if (isPointUnderRoof(player.x, player.y, roof)) {
      // Draw shadow over player to show they're under the roof
      drawPlayerRoofShadow(ctx, player, camera)
    }
  }
}

// Draw a shadow over the player when under a roof
function drawPlayerRoofShadow(ctx, player, camera) {
  const screenX = player.x - camera.x
  const screenY = player.y - camera.y

  // Draw a semi-transparent shadow over the player
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)"
  ctx.beginPath()
  ctx.arc(screenX, screenY, player.size * 1.2, 0, Math.PI * 2)
  ctx.fill()
}

// Check if a point is under any roof
function isPointUnderRoof(x, y, specificRoof = null) {
  if (specificRoof) {
    return (
      x >= specificRoof.x &&
      x <= specificRoof.x + specificRoof.width &&
      y >= specificRoof.y &&
      y <= specificRoof.y + specificRoof.height
    )
  }

  for (const roof of roofAreas) {
    if (x >= roof.x && x <= roof.x + roof.width && y >= roof.y && y <= roof.y + roof.height) {
      return true
    }
  }
  return false
}

// Check if a point is under any roof (exported function)
export function isUnderRoof(x, y) {
  return isPointUnderRoof(x, y)
}

// Add a helper function to set box floating state
function setBoxFloating(box, isFloating) {
  box.isFloating = isFloating

  if (isFloating) {
    // Initialize floating properties
    box.floatAngle = Math.random() * Math.PI * 2
    box.floatOffset = 0
  } else {
    // Reset floating properties
    box.floatOffset = 0
  }
}

// Add a function to create water splash effect
function createWaterSplashEffect(box) {
  // Create splash particles if they don't exist
  if (!gameState.splashEffects) {
    gameState.splashEffects = []
  }

  // Calculate splash force based on velocity
  const splashForce = Math.sqrt(box.throwVelocityX * box.throwVelocityX + box.throwVelocityY * box.throwVelocityY)

  // Create a new splash effect
  const splash = {
    x: box.x,
    y: box.y,
    size: box.size,
    force: Math.min(splashForce, 10), // Cap the force
    createdAt: Date.now(),
    particles: [],
  }

  // Create 10-20 water droplet particles
  const particleCount = 10 + Math.floor(Math.random() * 10 * (splashForce / 10))

  for (let i = 0; i < particleCount; i++) {
    // Random angle with bias upward
    const angle = Math.random() * Math.PI * 2
    // Random speed based on splash force
    const speed = 1 + Math.random() * splash.force * 0.4
    // Random size
    const size = 2 + Math.random() * 4
    // Random lifetime
    const lifetime = 300 + Math.random() * 700

    splash.particles.push({
      x: splash.x,
      y: splash.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 2, // Initial upward boost
      size: size,
      lifetime: lifetime,
      maxLifetime: lifetime,
      gravity: 0.1 + Math.random() * 0.1,
    })
  }

  gameState.splashEffects.push(splash)
}

// Add a function to draw and update splash effects
function drawAndUpdateSplashEffects() {
  if (!gameState.splashEffects) return

  const { camera, ctx } = gameState

  for (let i = gameState.splashEffects.length - 1; i >= 0; i--) {
    const splash = gameState.splashEffects[i]
    const elapsed = Date.now() - splash.createdAt

    // Remove splash if all particles are gone
    if (splash.particles.length === 0) {
      gameState.splashEffects.splice(i, 1)
      continue
    }

    // Draw ripple effect
    const rippleProgress = Math.min(elapsed / 500, 1)
    const rippleSize = splash.size * (0.5 + rippleProgress * 2)
    const rippleOpacity = Math.max(0, 0.7 - rippleProgress * 0.7)

    const screenX = splash.x - camera.x
    const screenY = splash.y - camera.y

    ctx.beginPath()
    ctx.arc(screenX, screenY, rippleSize, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 255, 255, ${rippleOpacity})`
    ctx.lineWidth = 2 * (1 - rippleProgress)
    ctx.stroke()

    // Update and draw particles
    for (let j = splash.particles.length - 1; j >= 0; j--) {
      const particle = splash.particles[j]

      // Update position
      particle.x += particle.velocityX
      particle.y += particle.velocityY

      // Apply gravity
      particle.velocityY += particle.gravity

      // Reduce lifetime
      particle.lifetime -= 16 // Roughly 60fps

      // Remove dead particles
      if (particle.lifetime <= 0) {
        splash.particles.splice(j, 1)
        continue
      }

      // Calculate screen position
      const particleX = particle.x - camera.x
      const particleY = particle.y - camera.y

      // Skip if off-screen
      if (
        particleX < -20 ||
        particleX > ctx.canvas.width + 20 ||
        particleY < -20 ||
        particleY > ctx.canvas.height + 20
      ) {
        continue
      }

      // Calculate opacity based on lifetime
      const opacity = particle.lifetime / particle.maxLifetime

      // Draw water droplet
      ctx.beginPath()
      ctx.arc(particleX, particleY, particle.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(164, 219, 232, ${opacity * 0.8})`
      ctx.fill()

      // Add highlight
      ctx.beginPath()
      ctx.arc(particleX - particle.size * 0.3, particleY - particle.size * 0.3, particle.size * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`
      ctx.fill()
    }
  }
}

// Draw the wooden box base
function drawWoodenBox(ctx, box) {
  const halfSize = box.size / 2

  // Base box
  ctx.fillStyle = "#8B4513" // SaddleBrown - base wood color
  drawRoundedRectLocal(ctx, -halfSize, -halfSize, box.size, box.size, 4)

  // Wood grain texture
  ctx.fillStyle = "#A0522D" // Sienna - slightly lighter

  // Draw horizontal planks
  const plankHeight = box.size / 4
  for (let i = 0; i < 4; i++) {
    const y = -halfSize + i * plankHeight
    // Make each plank slightly different width
    const plankWidth = box.size * (0.95 + Math.sin(i * 5) * 0.05)
    const xOffset = (box.size - plankWidth) / 2
    drawRoundedRectLocal(ctx, -halfSize + xOffset, y, plankWidth, plankHeight - 1, 2)
  }

  // Draw vertical borders/supports
  ctx.fillStyle = "#8B4513" // SaddleBrown
  const borderWidth = box.size / 12

  // Left border
  drawRoundedRectLocal(ctx, -halfSize, -halfSize, borderWidth, box.size, 2)

  // Right border
  drawRoundedRectLocal(ctx, halfSize - borderWidth, -halfSize, borderWidth, box.size, 2)

  // Draw metal reinforcements
  ctx.fillStyle = "#A9A9A9" // DarkGray

  // Corner reinforcements
  const cornerSize = box.size / 10
  drawRoundedRectLocal(ctx, -halfSize, -halfSize, cornerSize, cornerSize, 1)
  drawRoundedRectLocal(ctx, halfSize - cornerSize, -halfSize, cornerSize, cornerSize, 1)
  drawRoundedRectLocal(ctx, -halfSize, halfSize - cornerSize, cornerSize, cornerSize, 1)
  drawRoundedRectLocal(ctx, halfSize - cornerSize, halfSize - cornerSize, cornerSize, cornerSize, 1)
}

// Draw damage overlay based on damage state
function drawDamageOverlay(ctx, box) {
  const halfSize = box.size / 2

  if (box.damageState === 1) {
    // Slightly damaged - show small cracks
    ctx.strokeStyle = "#5D4037" // Dark brown
    ctx.lineWidth = 1.5 // Slightly thicker lines

    // Draw a few cracks
    ctx.beginPath()
    ctx.moveTo(-halfSize + box.size * 0.2, -halfSize)
    ctx.lineTo(-halfSize + box.size * 0.3, -halfSize + box.size * 0.15)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(halfSize - box.size * 0.1, -halfSize + box.size * 0.3)
    ctx.lineTo(halfSize, -halfSize + box.size * 0.2)
    ctx.stroke()

    // Add a small dent
    ctx.beginPath()
    ctx.arc(halfSize - box.size * 0.3, halfSize - box.size * 0.3, box.size * 0.1, 0, Math.PI * 2)
    ctx.fillStyle = "#6D4C41" // Slightly darker brown
    ctx.fill()

    // Add a small chip on the edge
    ctx.fillStyle = "#8B4513" // SaddleBrown
    ctx.beginPath()
    ctx.moveTo(-halfSize, -halfSize + box.size * 0.2)
    ctx.lineTo(-halfSize + box.size * 0.1, -halfSize + box.size * 0.1)
    ctx.lineTo(-halfSize + box.size * 0.1, -halfSize + box.size * 0.3)
    ctx.closePath()
    ctx.fill()
  } else if (box.damageState === 2) {
    // Heavily damaged - show more cracks and broken pieces
    ctx.strokeStyle = "#5D4037" // Dark brown
    ctx.lineWidth = 2.5 // Even thicker lines

    // Draw more pronounced cracks
    ctx.beginPath()
    ctx.moveTo(-halfSize, -halfSize + box.size * 0.3)
    ctx.lineTo(-halfSize + box.size * 0.4, -halfSize + box.size * 0.5)
    ctx.lineTo(-halfSize + box.size * 0.2, halfSize - box.size * 0.2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(halfSize, -halfSize + box.size * 0.5)
    ctx.lineTo(halfSize - box.size * 0.6, halfSize - box.size * 0.3)
    ctx.stroke()

    // Add a third crack
    ctx.beginPath()
    ctx.moveTo(-halfSize + box.size * 0.7, -halfSize)
    ctx.lineTo(-halfSize + box.size * 0.5, halfSize - box.size * 0.4)
    ctx.stroke()

    // Draw broken corner piece
    ctx.fillStyle = "#8B4513" // SaddleBrown
    ctx.beginPath()
    ctx.moveTo(halfSize, halfSize)
    ctx.lineTo(halfSize - box.size * 0.3, halfSize)
    ctx.lineTo(halfSize, halfSize - box.size * 0.3)
    ctx.fill()

    // Draw another broken piece
    ctx.fillStyle = "#A0522D" // Sienna
    ctx.beginPath()
    ctx.moveTo(-halfSize, -halfSize)
    ctx.lineTo(-halfSize + box.size * 0.2, -halfSize)
    ctx.lineTo(-halfSize + box.size * 0.1, -halfSize + box.size * 0.2)
    ctx.closePath()
    ctx.fill()

    // Add splinters
    ctx.fillStyle = "#A0522D" // Sienna
    ctx.save()
    ctx.translate(halfSize - box.size * 0.15, halfSize - box.size * 0.15)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-box.size * 0.05, -box.size * 0.15, box.size * 0.1, box.size * 0.3)
    ctx.restore()

    // Add another splinter
    ctx.save()
    ctx.translate(-halfSize + box.size * 0.25, -halfSize + box.size * 0.25)
    ctx.rotate(-Math.PI / 3)
    ctx.fillRect(-box.size * 0.04, -box.size * 0.12, box.size * 0.08, box.size * 0.24)
    ctx.restore()
  }
}

// Draw floating effect for boxes on water
function drawFloatingEffect(ctx, box) {
  const halfSize = box.size / 2

  // Draw ripple effect below the box
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"
  ctx.lineWidth = 2

  // Ripple waves
  for (let i = 1; i <= 2; i++) {
    const rippleSize = halfSize * (1.1 + i * 0.15)
    const waveOffset = Math.sin(Date.now() / 500 + i) * 2

    ctx.beginPath()
    ctx.ellipse(0, halfSize + waveOffset, rippleSize, rippleSize * 0.4, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Water drips
  if (Math.random() < 0.03) {
    // Create water drip particles if they don't exist
    if (!gameState.waterDrips) {
      gameState.waterDrips = []
    }

    // Add a new drip at random position along the bottom of the box
    const dripX = box.x + (Math.random() - 0.5) * box.size
    const dripY = box.y + halfSize

    gameState.waterDrips.push({
      x: dripX,
      y: dripY,
      velocityY: 1 + Math.random(),
      size: 2 + Math.random() * 3,
      lifetime: 500 + Math.random() * 200,
      maxLifetime: 700,
      createdAt: Date.now(),
    })
  }
}

// Draw impact effect when box is hit
function drawImpactEffect(ctx, x, y, box) {
  const timeSinceHit = Date.now() - box.lastHitTime
  const progress = timeSinceHit / 300 // 0 to 1 over 300ms

  // Draw expanding circle
  const radius = box.size * 0.5 * progress
  const opacity = 1 - progress

  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`
  ctx.fill()

  // Draw impact lines
  const lineLength = box.size * 0.3 * progress

  ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`
  ctx.lineWidth = 2

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const innerRadius = radius * 0.7
    const outerRadius = radius + lineLength

    ctx.beginPath()
    ctx.moveTo(x + Math.cos(angle) * innerRadius, y + Math.sin(angle) * innerRadius)
    ctx.lineTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius)
    ctx.stroke()
  }

  // Draw tiny wooden particles flying off
  if (timeSinceHit < 150) {
    for (let i = 0; i < 2; i++) {
      const particleAngle = Math.random() * Math.PI * 2
      const particleDistance = box.size * 0.6 * progress

      ctx.fillStyle = "#A0522D" // Sienna - wood color
      ctx.beginPath()
      ctx.arc(
        x + Math.cos(particleAngle) * particleDistance,
        y + Math.sin(particleAngle) * particleDistance,
        2,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }
}

// Draw the grabbed wooden box
function drawGrabbedWoodenBox(ctx, camera) {
  const box = gameState.grabbedWoodenBox
  const player = gameState.player

  // Calculate screen position (in front of player)
  const angle = player.direction
  const holdDistance = player.size + box.size * 0.7

  const boxX = player.x + Math.cos(angle) * holdDistance
  const boxY = player.y + Math.sin(angle) * holdDistance

  const screenX = boxX - camera.x
  const screenY = boxY - camera.y

  // Draw shadow with reduced size for held objects
  createShadow(
    ctx,
    screenX,
    screenY,
    box.size,
    "rectangle",
    {
      width: box.size,
      height: box.size,
      radius: 4,
    },
    angle,
    0.95,
  )

  // Draw box
  ctx.save()
  ctx.translate(screenX, screenY)
  ctx.rotate(angle)

  // Draw the base wooden box
  drawWoodenBox(ctx, box)

  // Draw damage overlays based on damage state
  if (box.damageState > 0) {
    drawDamageOverlay(ctx, box)
  }

  ctx.restore()

  // Draw connection line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  ctx.moveTo(player.x - camera.x, player.y - camera.y)
  ctx.lineTo(screenX, screenY)
  ctx.stroke()
  ctx.setLineDash([])
}

// Helper function to draw rounded rectangles
function drawRoundedRectLocal(ctx, x, y, width, height, radius) {
  if (width < 2 * radius) radius = width / 2
  if (height < 2 * radius) radius = height / 2

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
  ctx.fill()
}

// Export the roof detection functions for use in other modules
export { roofAreas }
