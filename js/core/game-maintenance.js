// Game maintenance functions
import { gameState } from "./game-state.js"
import { generateApples } from "../entities/apples.js"
import { generateBombs } from "../entities/bombs.js"

// Maintain game elements (generate more as needed)
export function maintainGameElements() {
  // Generate more apples if needed
  if (gameState.apples.length < 20) {
    generateApples(5) // Generate 5 apples at once instead of 1
  }

  // Generate more bombs if needed
  if (gameState.bombs.length < 20) {
    generateBombs(2)
  }
}

