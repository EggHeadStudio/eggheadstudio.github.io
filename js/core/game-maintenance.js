// Game maintenance functions
import { gameState } from "./game-state.js"
import { generateApples } from "../entities/apples.js"
import { generateBombs } from "../entities/bombs.js"
import { generateWoodenBoxes } from "../entities/wooden-boxes.js" // Import wooden boxes generator

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

  // Generate more wooden boxes if needed
  if (gameState.woodenBoxes.length < 15) {
    generateWoodenBoxes(1) // Generate 1 box at a time
  }
}
