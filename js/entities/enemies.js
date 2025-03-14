// Enemy entity
import { gameState } from "../core/game-state.js"
import { ENEMY_SIZE, ENEMY_SPEED, ENEMY_CHASE_SPEED, TILE_SIZE } from "../core/constants.js"
import { getDistance } from "../utils/math-utils.js"
import { createShadow } from "../utils/rendering-utils.js"

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

// Spawn new enemies more frequently
export function spawnEnemies() {
  const currentTime = Date.now()

  if (currentTime - gameState.lastEnemySpawnTime > 2000) {
    // 2 seconds instead of 5
    generateEnemies(3) // Spawn 3 enemies at once instead of 1
    gameState.lastEnemySpawnTime = currentTime
  }
}

// Update enemy movement
export function updateEnemyMovement(enemy, canSeePlayer) {
  const { player, terrain, rocks, bombs } = gameState

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
    let rockCollisionAngle = 0

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
    let rockCollisionAngle = 0

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

    // Check if enemy can see player
    const distanceToPlayer = getDistance(player.x, player.y, enemy.x, enemy.y)
    const canSeePlayer = distanceToPlayer < 300 // Detection radius

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
  }
}

