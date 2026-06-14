// Game maintenance utilities
import { gameState } from "./game-state.js"
import { generateApples } from "../entities/apples.js"
import { generateBombs } from "../entities/bombs.js"
import { generateWoodenBoxes } from "../entities/wooden-boxes.js" // Import wooden boxes generator
import { generateRocks } from "../entities/rocks.js"
import { generateCars } from "../entities/cars.js"
import { generateBoats } from "../entities/boats.js"
import { generateSledgehammers } from "../entities/sledgehammers.js"
import { clearAllEnemies, generateEnemies, getInitialEnemySpawnPlan } from "../entities/enemies.js"
import {
  APPLE_RESPAWN_THRESHOLD,
  APPLE_RESPAWN_BATCH,
  BOMB_RESPAWN_THRESHOLD,
  BOMB_RESPAWN_BATCH,
  INITIAL_BOMB_COUNT,
  INITIAL_APPLE_COUNT,
  ROCK_COUNT,
  WOODEN_BOX_RESPAWN_THRESHOLD,
  WOODEN_BOX_RESPAWN_BATCH,
  WOODEN_BOX_COUNT,
  CAR_COUNT,
  BOAT_COUNT,
  SLEDGEHAMMER_COUNT,
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

export function refreshWorldForNewDay() {
  clearAllEnemies({ spawnCleanupEffects: true })
  generateRocks(ROCK_COUNT)
  generateWoodenBoxes(WOODEN_BOX_COUNT)
  generateBombs(INITIAL_BOMB_COUNT)
  generateCars(CAR_COUNT - 1, true, { ignoreLimit: true })
  generateBoats(BOAT_COUNT, { ignoreLimit: true })
  generateApples(INITIAL_APPLE_COUNT, { spawnNearPlayer: false })
  generateSledgehammers(SLEDGEHAMMER_COUNT)
  generateEnemies(getInitialEnemySpawnPlan("day"))
  gameState.lastEnemySpawnTime = Date.now()
}