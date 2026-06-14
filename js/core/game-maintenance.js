// Game maintenance utilities
import { gameState } from "./game-state.js"
import { generateApples } from "../entities/apples.js"
import { generateBombs } from "../entities/bombs.js"
import { generateWoodenBoxes } from "../entities/wooden-boxes.js" // Import wooden boxes generator
import {
  APPLE_RESPAWN_THRESHOLD,
  APPLE_RESPAWN_BATCH,
  BOMB_RESPAWN_THRESHOLD,
  BOMB_RESPAWN_BATCH,
  WOODEN_BOX_RESPAWN_THRESHOLD,
  WOODEN_BOX_RESPAWN_BATCH,
} from "./constants.js"

// Maintain game elements (generate more as needed)
export function maintainGameElements() {
  // Generate more apples if needed
  if (gameState.apples.length < APPLE_RESPAWN_THRESHOLD) {
    generateApples(APPLE_RESPAWN_BATCH)
  }

  // Generate more bombs if needed
  if (gameState.bombs.length < BOMB_RESPAWN_THRESHOLD) {
    generateBombs(BOMB_RESPAWN_BATCH)
  }

  // Generate more wooden boxes if needed
  if (gameState.woodenBoxes.length < WOODEN_BOX_RESPAWN_THRESHOLD) {
    generateWoodenBoxes(WOODEN_BOX_RESPAWN_BATCH)
  }
  
  // Note: we don't need to generate more cars here as they're spawned 
  // automatically when one is destroyed in the destroyCar function
}