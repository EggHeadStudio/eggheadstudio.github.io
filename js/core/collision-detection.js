// Collision detection system
import { gameState } from "./game-state.js"
import { getDistance } from "../utils/math-utils.js"
import { updateHealthDisplay } from "../ui/ui-manager.js"

// Check for collisions
export function checkCollisions() {
  const { player, enemies } = gameState

  // Check for collisions with enemies
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i]
    const distance = getDistance(player.x, player.y, enemy.x, enemy.y)

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

