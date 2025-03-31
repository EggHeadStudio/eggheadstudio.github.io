// Game maintenance utilities
import { gameState } from "./game-state.js"
import { generateApples } from "../entities/apples.js"
import { generateEnemies } from "../entities/enemies.js"
import { generateBombs } from "../entities/bombs.js"
import { generateCars } from "../entities/cars.js"  // Import cars generator
import { generateWoodenBoxes } from "../entities/wooden-boxes.js" // Import wooden boxes generator
import { CAR_COUNT } from "./constants.js"  // Import CAR_COUNT constant

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
  
  // Note: we don't need to generate more cars here as they're spawned 
  // automatically when one is destroyed in the destroyCar function
}
