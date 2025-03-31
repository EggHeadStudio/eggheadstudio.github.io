// Collision detection system
import { gameState } from "./game-state.js"
import { getDistance } from "../utils/math-utils.js"
import { damageCar } from "../entities/cars.js"

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
        damageCar(drivingCar)
      }
    } else {
      // Normal player collision with enemy
      if (distance < player.size + enemy.size) {
        // Only take damage if not recently hit
        if (Date.now() - player.lastHit > 1000) {
          player.health--
          player.lastHit = Date.now()

          // Check if player is dead
          if (player.health <= 0) {
            gameState.gameOver = true
            document.getElementById("gameOver").classList.add("active")
          }
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
        damageCar(drivingCar)
        
        // Knockback enemy
        const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x)
        enemy.x += Math.cos(angle) * 20
        enemy.y += Math.sin(angle) * 20
        
        // Damage enemy from car collision
        enemy.health -= 1
        enemy.lastHit = Date.now()
      } else {
        // Only take damage if not recently hit
        if (Date.now() - player.lastHit > 1000) {
          player.health--
          player.lastHit = Date.now()
          
          // Game over if health reaches 0
          if (player.health <= 0) {
            gameState.gameOver = true
          }
        }
      }
    }
  }
}
