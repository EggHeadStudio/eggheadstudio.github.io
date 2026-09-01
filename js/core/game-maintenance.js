// Game maintenance utilities
import { gameState } from "./game-state.js"
import { generateApples } from "../entities/apples.js"
import { generateBombs } from "../entities/bombs.js"
import { generateWoodenBoxes } from "../entities/wooden-boxes.js" // Import wooden boxes generator
import { generateTrees } from "../entities/trees.js"
import { clearAllEnemies, generateEnemies, getInitialEnemySpawnPlan } from "../entities/enemies.js"
import { ensureWorldChunksAroundWorldPosition } from "../world/world-manager.js"
import { streamWorldEntities } from "../world/world-population.js"
import {
  APPLE_RESPAWN_THRESHOLD,
  APPLE_RESPAWN_BATCH,
  BOMB_RESPAWN_THRESHOLD,
  BOMB_RESPAWN_BATCH,
  INITIAL_APPLE_COUNT,
  INITIAL_BOMB_COUNT,
  WOODEN_BOX_RESPAWN_THRESHOLD,
  WOODEN_BOX_RESPAWN_BATCH,
} from "./constants.js"

// Maintain game elements (generate more as needed)
export function maintainGameElements() {
  const { player } = gameState

  if (player) {
    ensureWorldChunksAroundWorldPosition(player.x, player.y)
  }

  generateTrees()

  // Stock the chunks the player just walked into and store away the ones left
  // behind. Only does real work when the player crosses a chunk border.
  streamWorldEntities()

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

export function refreshWorldForNewDay(startPhase = "dusk") {
  clearAllEnemies({ spawnCleanupEffects: true })
  generateTrees()

  // Make sure the area around the player is stocked, then refill the things
  // that get used up. Everything else stays exactly as the player left it.
  streamWorldEntities({ force: true })
  generateApples(INITIAL_APPLE_COUNT, { spawnNearPlayer: false })
  generateBombs(INITIAL_BOMB_COUNT)

  generateEnemies(getInitialEnemySpawnPlan(startPhase))
  gameState.lastEnemySpawnTime = Date.now()
}