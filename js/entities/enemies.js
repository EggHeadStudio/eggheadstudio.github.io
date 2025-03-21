// Enemy entity
import { gameState } from "../core/game-state.js"
import { ENEMY_SIZE, ENEMY_SPEED, ENEMY_CHASE_SPEED, TILE_SIZE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"
import { damageWoodenBox } from "../entities/wooden-boxes.js"
import { isUnderRoof } from "../entities/wooden-boxes.js"

// Generate enemies
export function generateEnemies(count) {
  const { terrain, enemies, player } = gameState

  for (let i = 0; i < count; i++) {
    const enemy = {
      x: Math.random() * (terrain[0].length * TILE_SIZE),
      y: Math.random() * (terrain.length * TILE_SIZE),
      size: ENEMY_SIZE,
      speed: ENEMY_SPEED,
      direction: Math.random() * Math.PI * 2,
      color: "#e74c3c",
      directionChangeTime: 0,
      isChasing: false,
      isBeingThrown: false,
      throwStartTime: 0,
      throwVelocityX: 0,
      throwVelocityY: 0,
      // Add properties for collision animation
      isKnockedBack: false,
      knockbackTime: 0,
      knockbackVelocityX: 0,
      knockbackVelocityY: 0,
      knockbackDuration: 300, // 300ms knockback duration
    }

    // Ensure enemy is not on water and not too close to player
    const tileX = Math.floor(enemy.x / TILE_SIZE)
    const tileY = Math.floor(enemy.y / TILE_SIZE)
    const distanceToPlayer = getDistance(player.x, player.y, enemy.x, enemy.y)

    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== 0 && // TERRAIN_TYPES.WATER
      distanceToPlayer > 300
    ) {
      enemies.push(enemy)
    } else {
      i-- // Try again
    }
  }
}

// Try to grab an enemy
export function tryGrabEnemy() {
  const { player, enemies } = gameState

  // Define a larger grab distance (1.5x the normal collision distance)
  const grabDistance = (player.size + ENEMY_SIZE) * 1.5

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]
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

  if (currentTime - gameState.lastEnemySpawnTime > 2000) {
    // 2 seconds instead of 5
    generateEnemies(3) // Spawn 3 enemies at once instead of 1
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

  // If this is the grabbed enemy, don't update its movement
  if (gameState.grabbedEnemy === enemy) return

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
        terrain[tileY][tileX] === 0 // TERRAIN_TYPES.WATER
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
        terrain[tileY][tileX] === 0 // TERRAIN_TYPES.WATER
      ) {
        // Enemy landed in water, remove it
        const enemyIndex = gameState.enemies.indexOf(enemy)
        if (enemyIndex !== -1) {
          gameState.enemies.splice(enemyIndex, 1)
        }
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
      tileY >= terrain.length ||
      terrain[tileY][tileX] === 0 // TERRAIN_TYPES.WATER
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

    return
  }

  if (canSeePlayer) {
    // Chase player
    enemy.isChasing = true
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x)
    enemy.direction = angleToPlayer

    // Move toward player with increased speed
    const dx = Math.cos(angleToPlayer) * ENEMY_CHASE_SPEED
    const dy = Math.sin(angleToPlayer) * ENEMY_CHASE_SPEED

    // Check if new position would be on water or collide with a rock
    const newX = enemy.x + dx
    const newY = enemy.y + dy
    const tileX = Math.floor(newX / TILE_SIZE)
    const tileY = Math.floor(newY / TILE_SIZE)

    let canMove = true
    let collidedWithRock = false
    let collidedWithBox = false
    let rockCollisionAngle = 0
    let boxCollisionAngle = 0

    // Check terrain
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== 0 // TERRAIN_TYPES.WATER
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
            canMove = false
            collidedWithBox = true
            boxCollisionAngle = Math.atan2(enemy.y - box.y, enemy.x - box.x)
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

      // Try to move around obstacle
      const alternateAngle1 = angleToPlayer + Math.PI / 4
      const alternateAngle2 = angleToPlayer - Math.PI / 4

      const alt1X = enemy.x + Math.cos(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1Y = enemy.y + Math.sin(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1TileX = Math.floor(alt1X / TILE_SIZE)
      const alt1TileY = Math.floor(alt1Y / TILE_SIZE)

      let canMoveAlt1 = true

      if (
        alt1TileX >= 0 &&
        alt1TileX < terrain[0].length &&
        alt1TileY >= 0 &&
        alt1TileY < terrain.length &&
        terrain[alt1TileY][alt1TileX] !== 0 // TERRAIN_TYPES.WATER
      ) {
        // Check collision with rocks
        for (const rock of rocks) {
          if (getDistance(alt1X, alt1Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
            canMoveAlt1 = false
            break
          }
        }

        // Check collision with wooden boxes
        if (canMoveAlt1 && woodenBoxes) {
          for (const box of woodenBoxes) {
            // Skip if box is being carried or thrown
            if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

            if (getDistance(alt1X, alt1Y, box.x, box.y) < enemy.size + box.size * 0.8) {
              canMoveAlt1 = false
              break
            }
          }
        }
      } else {
        canMoveAlt1 = false
      }

      if (canMoveAlt1) {
        enemy.x = alt1X
        enemy.y = alt1Y
      } else {
        const alt2X = enemy.x + Math.cos(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2Y = enemy.y + Math.sin(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2TileX = Math.floor(alt2X / TILE_SIZE)
        const alt2TileY = Math.floor(alt2Y / TILE_SIZE)

        let canMoveAlt2 = true

        if (
          alt2TileX >= 0 &&
          alt2TileX < terrain[0].length &&
          alt2TileY >= 0 &&
          alt2TileY < terrain.length &&
          terrain[alt2TileY][alt2TileX] !== 0 // TERRAIN_TYPES.WATER
        ) {
          // Check collision with rocks
          for (const rock of rocks) {
            if (getDistance(alt2X, alt2Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
              canMoveAlt2 = false
              break
            }
          }

          // Check collision with wooden boxes
          if (canMoveAlt2 && woodenBoxes) {
            for (const box of woodenBoxes) {
              // Skip if box is being carried or thrown
              if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

              if (getDistance(alt2X, alt2Y, box.x, box.y) < enemy.size + box.size * 0.8) {
                canMoveAlt2 = false
                break
              }
            }
          }
        } else {
          canMoveAlt2 = false
        }

        if (canMoveAlt2) {
          enemy.x = alt2X
          enemy.y = alt2Y
        }
      }
    } else if (collidedWithBox) {
      // Bump away from box
      const bumpDistance = 2
      enemy.x += Math.cos(boxCollisionAngle) * bumpDistance
      enemy.y += Math.sin(boxCollisionAngle) * bumpDistance

      // Try to move around obstacle (same logic as for rocks)
      const alternateAngle1 = angleToPlayer + Math.PI / 4
      const alternateAngle2 = angleToPlayer - Math.PI / 4

      const alt1X = enemy.x + Math.cos(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1Y = enemy.y + Math.sin(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1TileX = Math.floor(alt1X / TILE_SIZE)
      const alt1TileY = Math.floor(alt1Y / TILE_SIZE)

      let canMoveAlt1 = true

      if (
        alt1TileX >= 0 &&
        alt1TileX < terrain[0].length &&
        alt1TileY >= 0 &&
        alt1TileY < terrain.length &&
        terrain[alt1TileY][alt1TileX] !== 0 // TERRAIN_TYPES.WATER
      ) {
        // Check collision with rocks and boxes
        for (const rock of rocks) {
          if (getDistance(alt1X, alt1Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
            canMoveAlt1 = false
            break
          }
        }

        if (canMoveAlt1 && woodenBoxes) {
          for (const box of woodenBoxes) {
            // Skip if box is being carried or thrown
            if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

            if (getDistance(alt1X, alt1Y, box.x, box.y) < enemy.size + box.size * 0.8) {
              canMoveAlt1 = false
              break
            }
          }
        }
      } else {
        canMoveAlt1 = false
      }

      if (canMoveAlt1) {
        enemy.x = alt1X
        enemy.y = alt1Y
      } else {
        const alt2X = enemy.x + Math.cos(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2Y = enemy.y + Math.sin(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2TileX = Math.floor(alt2X / TILE_SIZE)
        const alt2TileY = Math.floor(alt2Y / TILE_SIZE)

        let canMoveAlt2 = true

        if (
          alt2TileX >= 0 &&
          alt2TileX < terrain[0].length &&
          alt2TileY >= 0 &&
          alt2TileY < terrain.length &&
          terrain[alt2TileY][alt2TileX] !== 0 // TERRAIN_TYPES.WATER
        ) {
          // Check collision with rocks and boxes
          for (const rock of rocks) {
            if (getDistance(alt2X, alt2Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
              canMoveAlt2 = false
              break
            }
          }

          if (canMoveAlt2 && woodenBoxes) {
            for (const box of woodenBoxes) {
              // Skip if box is being carried or thrown
              if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

              if (getDistance(alt2X, alt2Y, box.x, box.y) < enemy.size + box.size * 0.8) {
                canMoveAlt2 = false
                break
              }
            }
          }
        } else {
          canMoveAlt2 = false
        }

        if (canMoveAlt2) {
          enemy.x = alt2X
          enemy.y = alt2Y
        }
      }
    } else {
      // Try to move around obstacle
      const alternateAngle1 = angleToPlayer + Math.PI / 4
      const alternateAngle2 = angleToPlayer - Math.PI / 4

      const alt1X = enemy.x + Math.cos(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1Y = enemy.y + Math.sin(alternateAngle1) * ENEMY_CHASE_SPEED
      const alt1TileX = Math.floor(alt1X / TILE_SIZE)
      const alt1TileY = Math.floor(alt1Y / TILE_SIZE)

      let canMoveAlt1 = true

      if (
        alt1TileX >= 0 &&
        alt1TileX < terrain[0].length &&
        alt1TileY >= 0 &&
        alt1TileY < terrain.length &&
        terrain[alt1TileY][alt1TileX] !== 0 // TERRAIN_TYPES.WATER
      ) {
        // Check collision with rocks
        for (const rock of rocks) {
          if (getDistance(alt1X, alt1Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
            canMoveAlt1 = false
            break
          }
        }

        // Check collision with wooden boxes
        if (canMoveAlt1 && woodenBoxes) {
          for (const box of woodenBoxes) {
            // Skip if box is being carried or thrown
            if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

            if (getDistance(alt1X, alt1Y, box.x, box.y) < enemy.size + box.size * 0.8) {
              canMoveAlt1 = false
              break
            }
          }
        }
      } else {
        canMoveAlt1 = false
      }

      if (canMoveAlt1) {
        enemy.x = alt1X
        enemy.y = alt1Y
      } else {
        const alt2X = enemy.x + Math.cos(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2Y = enemy.y + Math.sin(alternateAngle2) * ENEMY_CHASE_SPEED
        const alt2TileX = Math.floor(alt2X / TILE_SIZE)
        const alt2TileY = Math.floor(alt2Y / TILE_SIZE)

        let canMoveAlt2 = true

        if (
          alt2TileX >= 0 &&
          alt2TileX < terrain[0].length &&
          alt2TileY >= 0 &&
          alt2TileY < terrain.length &&
          terrain[alt2TileY][alt2TileX] !== 0 // TERRAIN_TYPES.WATER
        ) {
          // Check collision with rocks
          for (const rock of rocks) {
            if (getDistance(alt2X, alt2Y, rock.x, rock.y) < enemy.size + rock.size * 0.8) {
              canMoveAlt2 = false
              break
            }
          }

          // Check collision with wooden boxes
          if (canMoveAlt2 && woodenBoxes) {
            for (const box of woodenBoxes) {
              // Skip if box is being carried or thrown
              if (box === gameState.grabbedWoodenBox || box.isBeingThrown) continue

              if (getDistance(alt2X, alt2Y, box.x, box.y) < enemy.size + box.size * 0.8) {
                canMoveAlt2 = false
                break
              }
            }
          }
        } else {
          canMoveAlt2 = false
        }

        if (canMoveAlt2) {
          enemy.x = alt2X
          enemy.y = alt2Y
        }
      }
    }
  } else {
    // Wander randomly
    enemy.isChasing = false

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
    let rockCollisionAngle = 0
    let boxCollisionAngle = 0

    // Check terrain
    if (
      tileX >= 0 &&
      tileX < terrain[0].length &&
      tileY >= 0 &&
      tileY < terrain.length &&
      terrain[tileY][tileX] !== 0 // TERRAIN_TYPES.WATER
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
            canMove = false
            collidedWithBox = true
            boxCollisionAngle = Math.atan2(enemy.y - box.y, enemy.x - box.x)
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
}

// Draw and update enemies
export function drawAndUpdateEnemies() {
  const { enemies, camera, ctx, canvas, player, gameOver } = gameState

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
      updateEnemyMovement(enemy, canSeePlayer)
    }

    const screenX = enemy.x - camera.x
    const screenY = enemy.y - camera.y

    // Skip if enemy is off-screen
    if (
      screenX < -enemy.size ||
      screenX > canvas.width + enemy.size ||
      screenY < -enemy.size ||
      screenY > canvas.height + enemy.size
    ) {
      continue
    }

    // Draw shadow using standardized function
    createShadow(ctx, screenX, screenY, enemy.size)

    // Draw enemy (circle with details)
    ctx.fillStyle = enemy.isChasing ? "#ff3b30" : enemy.color
    ctx.beginPath()
    ctx.arc(screenX, screenY, enemy.size, 0, Math.PI * 2)
    ctx.fill()

    // Draw enemy eyes
    const eyeOffset = enemy.size / 3
    const eyeSize = enemy.size / 5

    // Left eye
    ctx.fillStyle = "white"
    ctx.beginPath()
    ctx.arc(
      screenX - eyeOffset * Math.cos(enemy.direction),
      screenY - eyeOffset * Math.sin(enemy.direction),
      eyeSize,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    // Right eye
    ctx.beginPath()
    ctx.arc(
      screenX + eyeOffset * Math.sin(enemy.direction),
      screenY - eyeOffset * Math.cos(enemy.direction),
      eyeSize,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    // Eye pupils
    ctx.fillStyle = "black"
    ctx.beginPath()
    ctx.arc(
      screenX - eyeOffset * Math.cos(enemy.direction) + (eyeSize / 3) * Math.cos(enemy.direction),
      screenY - eyeOffset * Math.sin(enemy.direction) + (eyeSize / 3) * Math.sin(enemy.direction),
      eyeSize / 2,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    ctx.beginPath()
    ctx.arc(
      screenX + eyeOffset * Math.sin(enemy.direction) + (eyeSize / 3) * Math.cos(enemy.direction),
      screenY - eyeOffset * Math.cos(enemy.direction) + (eyeSize / 3) * Math.sin(enemy.direction),
      eyeSize / 2,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    // Draw alert indicator if chasing
    if (enemy.isChasing) {
      const alertSize = Math.sin(Date.now() / 100) * 3 + 10
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
      ctx.beginPath()
      ctx.arc(screenX, screenY - enemy.size - 10, alertSize, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw dizzy effect if enemy is being thrown
    if (enemy.isBeingThrown) {
      const time = Date.now() / 200
      const dizzySize = 3 + Math.sin(time) * 1

      ctx.fillStyle = "yellow"
      for (let i = 0; i < 3; i++) {
        const angle = time + (i * Math.PI * 2) / 3
        const orbitRadius = enemy.size * 0.8
        const starX = screenX + Math.cos(angle) * orbitRadius
        const starY = screenY + Math.sin(angle) * orbitRadius - enemy.size / 2

        // Draw a small star
        ctx.beginPath()
        ctx.arc(starX, starY, dizzySize, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw knockback effect
    if (enemy.isKnockedBack) {
      // Show a small impact effect
      const knockbackProgress = (Date.now() - enemy.knockbackTime) / enemy.knockbackDuration
      const impactSize = (1 - knockbackProgress) * 15

      ctx.fillStyle = "rgba(255, 255, 255, " + 0.7 * (1 - knockbackProgress) + ")"
      ctx.beginPath()
      ctx.arc(screenX, screenY, enemy.size + impactSize, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
