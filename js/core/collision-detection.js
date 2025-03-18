// Collision detection system
import { gameState } from "./game-state.js"
import { getDistance } from "../utils/math-utils.js"
import { updateHealthDisplay } from "../ui/ui-manager.js"

// Check for collisions
export function checkCollisions() {
  const { player, enemies, grabbedEnemy } = gameState

  // Check for collisions with enemies
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]

    // Skip collision check if this is the enemy being carried
    if (grabbedEnemy === enemy) continue

    const distance = getDistance(player.x, player.y, enemy.x, enemy.y)

    // Only check for damage if the enemy is actually touching the player
    // This allows grabbing from a distance without taking damage
    if (distance < player.size + enemy.size) {
      // Only take damage if not recently hit
      if (Date.now() - player.lastHit > 1000) {
        player.health--
        player.lastHit = Date.now()
        updateHealthDisplay()

        // Check if player is dead
        if (player.health <= 0) {
          gameState.gameOver = true
          document.getElementById("gameOver").classList.add("active")
        }
      }
    }
  }
}
