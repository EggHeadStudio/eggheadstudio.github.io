// Game constants
export const TILE_SIZE = 40
export const WORLD_SIZE_MULTIPLIER = 1
export const WORLD_MAP_SIZE = 240 * WORLD_SIZE_MULTIPLIER
export const MINIMAP_VISIBLE_TILES_MOBILE = 21 * 2
export const MINIMAP_VISIBLE_TILES_DESKTOP = 33 * 2
export const MOBILE_VIEWPORT_SCALE = 1.18
export const PLAYER_SIZE = 30
export const PLAYER_HEAL_DELAY_MS = 60000
export const PLAYER_HEAL_UNDER_ROOF_MULTIPLIER = 2
export const BOMB_SIZE = 45
export const APPLE_SIZE = 15
export const SLEDGEHAMMER_SIZE = 22
export const ENEMY_SIZE = 35
export const PLAYER_SPEED = 4
export const ENEMY_SPEED = 2
export const ENEMY_CHASE_SPEED = 3
export const ENEMY_SWIM_SPEED = 2
export const ENEMY_SPAWN_INTERVAL = 2000
export const ENEMY_SPAWN_BATCH = 3
export const APPLE_THROW_SPEED = 8
export const ROCK_SIZE = 50 // Slightly larger than bombs
export const ROCK_COUNT = 100 // Initial number of rocks
export const WOODEN_BOX_SIZE = 45 // Size of wooden boxes
export const WOODEN_BOX_COUNT = 100 // Initial number of wooden boxes
export const WOODEN_BOX_THROW_MULTIPLIER = 0.3 // Reduced from 2 to 0.3 (4x reduction)
export const WOODEN_BOX_FLOAT_SPEED = 0.5 // How fast boxes float in water
export const WOODEN_BOX_SNAP_DISTANCE = 60 // Distance for boxes to snap to each other
export const CAR_SIZE = 50 // Size of cars
export const BOAT_SIZE = 80 // Size of boats
export const CAR_SPEED = 8 // 2x the normal player speed (vehicles)
export const CAR_INTERACTION_RANGE = 80 // Distance for player to interact with cars
export const CAR_COUNT = 5 // Maximum number of cars in the game
export const BOAT_COUNT = 5
export const SLEDGEHAMMER_COUNT = 5
export const INITIAL_BOMB_COUNT = 25
export const INITIAL_ENEMY_COUNT = 10
export const INITIAL_APPLE_COUNT = 40
export const APPLE_RESPAWN_THRESHOLD = 20
export const APPLE_RESPAWN_BATCH = 5
export const BOMB_RESPAWN_THRESHOLD = 20
export const BOMB_RESPAWN_BATCH = 2
export const WOODEN_BOX_RESPAWN_THRESHOLD = 15
export const WOODEN_BOX_RESPAWN_BATCH = 1
export const CAR_MAX_HEALTH = 3 // Maximum health of cars
export const CAR_MAX_SPEED = 8 // Maximum speed for cars
export const CAR_ACCELERATION = 0.25 // How quickly the car speeds up
export const CAR_DECELERATION = 0.2 // How quickly the car slows down
export const CAR_DRIFT_FACTOR = 0.85 // How much the car drifts (lower = more drift)

export const TERRAIN_TYPES = {
  WATER: 0,
  GRASS: 1,
  FOREST: 2,
  DIRT: 3,
}