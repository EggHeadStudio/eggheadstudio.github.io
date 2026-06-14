// Collision detection system
import { gameState } from "./game-state.js"
import { getDistance } from "../utils/math-utils.js"
import { damageCar } from "../entities/cars.js"
import { damageBoat } from "../entities/boats.js"
import { damageEnemy } from "../entities/enemies.js"
import { damagePlayer } from "../entities/player.js"
import { triggerGameOver } from "./game.js"

// Check for collisions
export function checkCollisions() {
  const { player, enemies, grabbedEnemy, isInCar, drivingCar } = gameState

  // Check for collisions with enemies
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]

    // Skip collision check if this is the enemy being carried
    if (grabbedEnemy === enemy) continue

    const distance = getDistance(player.x, player.y, enemy.x, enemy.y)

    // If player is in a car, handle collision differently
    if (isInCar && drivingCar) {
      // Car collision with enemy
      if (distance < drivingCar.size + enemy.size) {
        // Damage the car instead of the player
        if (drivingCar.vehicleType === "boat") {
          if (drivingCar.isBroken) {
            const angle = Math.atan2(enemy.y - drivingCar.y, enemy.x - drivingCar.x)
            const raftDistance = drivingCar.size * 0.28
            enemy.x = drivingCar.x + Math.cos(angle) * raftDistance
            enemy.y = drivingCar.y + Math.sin(angle) * raftDistance
            enemy.floatOffset = 0
            enemy.isSwimming = false

            const didDamage = damagePlayer(1)

            if (didDamage && player.health <= 0) {
              triggerGameOver()
            }
          } else {
            damageBoat(drivingCar)
          }
        } else {
          damageCar(drivingCar)
        }
      }
    } else {
      // Normal player collision with enemy
      if (distance < player.size + enemy.size) {
        const didDamage = damagePlayer(1)

        if (didDamage && player.health <= 0) {
          triggerGameOver()
        }
      }
    }
  }
}

// Handle enemy-player collisions
export function handleEnemyCollisions() {
  const { player, enemies, isInCar, drivingCar } = gameState

  for (const enemy of enemies) {
    // Skip dead enemies
    if (enemy.health <= 0) continue

    const distance = getDistance(player.x, player.y, enemy.x, enemy.y)
    
    // If collision with player or car
    if (distance < player.size + enemy.size) {
      // Check if player is in a car
      if (isInCar && drivingCar) {
        // Damage the car instead of the player
        if (drivingCar.vehicleType === "boat") {
          if (drivingCar.isBroken) {
            const angle = Math.atan2(enemy.y - drivingCar.y, enemy.x - drivingCar.x)
            const raftDistance = drivingCar.size * 0.28
            enemy.x = drivingCar.x + Math.cos(angle) * raftDistance
            enemy.y = drivingCar.y + Math.sin(angle) * raftDistance
            enemy.floatOffset = 0
            enemy.isSwimming = false

            const didDamage = damagePlayer(1)

            if (didDamage && player.health <= 0) {
              triggerGameOver()
            }
          } else {
            damageBoat(drivingCar)

            // Knockback enemy
            const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x)
            enemy.x += Math.cos(angle) * 20
            enemy.y += Math.sin(angle) * 20

            // Damage enemy from boat collision only while the hull still exists
            damageEnemy(enemy, 1)
          }
        } else {
          damageCar(drivingCar)

          // Knockback enemy
          const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x)
          enemy.x += Math.cos(angle) * 20
          enemy.y += Math.sin(angle) * 20

          // Damage enemy from car collision
          damageEnemy(enemy, 1)
        }
      } else {
        const didDamage = damagePlayer(1)

        if (didDamage && player.health <= 0) {
          triggerGameOver()
        }
      }
    }
  }
}