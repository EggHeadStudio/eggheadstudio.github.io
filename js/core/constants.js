// Game constants
export const TILE_SIZE = 40
export const WORLD_SIZE_MULTIPLIER = 8
export const WORLD_MAP_SIZE = 240 * WORLD_SIZE_MULTIPLIER
// Entities now stream in around the player, so content density is tuned for the
// active area instead of the total world size.
export const WORLD_CONTENT_MULTIPLIER = 1
export const WORLD_CHUNK_SIZE_TILES = 32
export const WORLD_CHUNK_PRELOAD_RADIUS = 2
export const WORLD_CHUNK_KEEP_RADIUS = 3
// Upper bound on placement retries for any world spawn loop.
export const SPAWN_ATTEMPT_LIMIT = 40
export const WORLD_SAVE_KEY = "small-game-world-state-v1"
export const WORLD_SEED = 1337

// --- World shape -----------------------------------------------------------
// The world is built from smooth fractal noise fields, so lakes, seas and
// forests come out as large natural regions instead of scattered tiles.
// All levels are 0..1 thresholds; scales are in tiles (bigger = bigger regions).
export const WORLD_ELEVATION_SCALE = 190 // Size of continents, seas and lakes
export const WORLD_ELEVATION_OCTAVES = 4 // Detail added to coastlines
export const WORLD_WATER_LEVEL = 0.4 // Below this is water. Raise for more sea.
export const WORLD_SHORE_BAND = 0.05 // Sand ring around every water mass
export const WORLD_RIVER_SCALE = 420 // Length/width of river systems
export const WORLD_RIVER_WIDTH = 0.02 // Set to 0 to remove rivers entirely
export const WORLD_RIVER_MAX_ELEVATION = 0.24 // Rivers stop before high ground
export const WORLD_MOISTURE_SCALE = 140 // Size of forest regions
export const WORLD_FOREST_LEVEL = 0.52 // Above this moisture is forest
export const WORLD_GRAVEL_SCALE = 110 // Size of gravel fields
export const WORLD_GRAVEL_LEVEL = 0.63 // Above this is gravel (rock country)

// --- Per-chunk content density ---------------------------------------------
// A chunk is WORLD_CHUNK_SIZE_TILES squared, so these numbers control how
// crowded the world feels no matter how far the player travels.
export const WORLD_ENTITY_CHUNK_RADIUS = 2 // Chunks kept populated around the player
export const WORLD_ENTITY_RELEASE_RADIUS = 3 // Chunks beyond this are stored away
export const CHUNK_ROCK_MIN = 2
export const CHUNK_ROCK_MAX = 4
export const CHUNK_GRAVEL_ROCK_BONUS = 3 // Extra rocks in gravel country
export const CHUNK_RUBBLE_CHANCE = 0.16 // Chance of a rock rubble pile per chunk
export const CHUNK_BOX_MIN = 1
export const CHUNK_BOX_MAX = 3
export const CHUNK_FLOATING_BOX_MAX = 2 // Crates drifting on open water
export const CHUNK_APPLE_MIN = 1
export const CHUNK_APPLE_MAX = 3
export const CHUNK_BOMB_CHANCE = 0.7
export const CHUNK_CAR_CHANCE = 0.16
export const CHUNK_BOAT_CHANCE = 0.55
export const CHUNK_BOAT_MIN_WATER_TILES = 70 // Only real lakes/seas get boats
export const CHUNK_TOOL_CHANCE = 0.07 // Chance per chunk for each rare tool
export const MINIMAP_VISIBLE_TILES_MOBILE = 26 * 2
export const MINIMAP_VISIBLE_TILES_DESKTOP = 40 * 2
export const MAP_SECTION_TILE_SIZE = 120
export const MAP_SECTION_REVEAL_THRESHOLD = 1
export const SHOW_START_TIME_OPTIONS = false
export const SHOW_CHARACTER_CUSTOMIZATION = true
export const MOBILE_VIEWPORT_SCALE = 1.18
export const PLAYER_SIZE = 30
export const PLAYER_HEAL_DELAY_MS = 20000
export const PLAYER_HEAL_UNDER_ROOF_MULTIPLIER = 2
export const CARRY_SPEED_MULTIPLIER_BY_STRENGTH = {
  1: 0.30,
  2: 0.45,
  3: 0.58,
  4: 0.75,
  5: 1,
}
export const CARRY_SPEED_MULTIPLIER_BY_OBJECT_AND_STRENGTH = {
  rock: {
    1: 0.18,
    2: 0.30,
    3: 0.42,
    4: 0.60,
    5: 0.96,
  },
  enemy: {
    1: 0.25,
    2: 0.38,
    3: 0.50,
    4: 0.70,
    5: 1,
  },
}
export const ROCK_WATER_GRAVEL_RADIUS_TILES = 1
export const SPAWN_ROOF_BUFFER_TILES = 1
export const CAR_FUEL_MIN = 50
export const CAR_FUEL_MAX = 100
export const BOAT_FUEL_MIN = 50
export const BOAT_FUEL_MAX = 100
export const CAR_FUEL_DRAIN_FORWARD = 0.008
export const BOAT_FUEL_DRAIN_FORWARD = 0.006
// Roof visibility: how solid the roof looks from far away, close up, and while standing beneath it.
export const ROOF_FAR_ALPHA = 0.9
export const ROOF_NEAR_ALPHA = 0.4
export const ROOF_UNDER_ALPHA = 0.08
export const ROOF_FADE_DISTANCE = TILE_SIZE * 3
// Roof ambient glow: soft wall light around a shelter and brighter local light while the player is under it.
export const ROOF_EMIT_LIGHT_RADIUS = TILE_SIZE
export const ROOF_EMIT_LIGHT_ALPHA = 0.22
export const ROOF_PLAYER_LIGHT_RADIUS = TILE_SIZE * 2.5
export const ROOF_PLAYER_LIGHT_ALPHA = 0.18
export const BOMB_SIZE = 45
export const APPLE_SIZE = 15
export const SLEDGEHAMMER_SIZE = 22
export const SHOVEL_SIZE = 22
export const SAW_SIZE = 22
export const ENEMY_SIZE = 35
export const PLAYER_SPEED = 4
export const ENEMY_SPEED = 2
export const ENEMY_CHASE_SPEED = 3
export const ENEMY_SWIM_SPEED = 2
// Enemy pacing knobs. Lower the counts or raise the interval here to make the
// game calmer.
export const ENEMY_SPAWN_INTERVAL = 3500
export const ENEMY_RED_COLOR = "#e74c3c"
export const ENEMY_RED_SIZE = ENEMY_SIZE
export const ENEMY_RED_HEALTH = 5
export const ENEMY_RED_SPEED = ENEMY_SPEED
export const ENEMY_RED_CHASE_SPEED = ENEMY_CHASE_SPEED
export const ENEMY_RED_SWIM_SPEED = ENEMY_SWIM_SPEED
export const ENEMY_YELLOW_COLOR = "#f1c40f"
export const ENEMY_YELLOW_SIZE = 28
export const ENEMY_YELLOW_HEALTH = 4
export const ENEMY_YELLOW_SPEED = 2.35
export const ENEMY_YELLOW_CHASE_SPEED = 3.25
export const ENEMY_YELLOW_SWIM_SPEED = 2.2
export const ENEMY_BLACK_COLOR = "#111111"
export const ENEMY_BLACK_SIZE = ENEMY_SIZE * 2
export const ENEMY_BLACK_HEALTH = 12
export const ENEMY_BLACK_SPEED = 1.45
export const ENEMY_BLACK_CHASE_SPEED = 2.2
export const ENEMY_BLACK_SWIM_SPEED = 1.5
export const INITIAL_RED_ENEMY_COUNT = 3
export const INITIAL_YELLOW_ENEMY_COUNT = 1
export const INITIAL_BLACK_ENEMY_COUNT = 1
export const ENEMY_SPAWN_BATCH_RED = 1
export const ENEMY_SPAWN_BATCH_YELLOW = 1
export const ENEMY_SPAWN_BATCH_BLACK = 0
export const ENEMY_SPAWN_BATCH = ENEMY_SPAWN_BATCH_RED + ENEMY_SPAWN_BATCH_YELLOW

export const ENEMY_PHASE_SPAWN_CONFIG = {
  dawn: {
    initial: { red: 0, yellow: 0, black: 0 },
    ambient: { red: 0, yellow: 0, black: 0 },
    interval: 60000,
  },
  day: {
    initial: { red: 0, yellow: 0, black: 0 },
    ambient: { red: 0, yellow: 0, black: 0 },
    interval: 60000,
  },
  dusk: {
    initial: { red: 1, yellow: 0, black: 0 },
    ambient: { red: 1, yellow: 0, black: 0 },
    interval: 9000,
  },
  night: {
    initial: { red: 2, yellow: 1, black: 1 },
    ambient: { red: 2, yellow: 1, black: 1 },
    interval: 3000,
  },
}

export const APPLE_THROW_SPEED = 8
export const ROCK_SIZE = 50 // Slightly larger than bombs
export const ROCK_COUNT = Math.round(120 * WORLD_CONTENT_MULTIPLIER) // Initial number of rocks
export const MAX_ROCKS = Math.round(340 * WORLD_CONTENT_MULTIPLIER) // Hard cap for rocks loaded around the player
export const ROCK_RUBBLE_PATCH_COUNT = 6 // Number of rock piles scattered across the map
export const ROCK_RUBBLE_MIN_PER_PATCH = 15 // Minimum rocks in each rubble patch
export const ROCK_RUBBLE_MAX_PER_PATCH = 30 // Maximum rocks in each rubble patch
export const ROCK_RUBBLE_RADIUS = 40 // Radius of each rubble patch
export const WOODEN_BOX_SIZE = 45 // Size of wooden boxes
export const WOODEN_BOX_COUNT = Math.round(120 * WORLD_CONTENT_MULTIPLIER) // Initial number of wooden boxes
export const MAX_WOODEN_BOXES = Math.round(180 * WORLD_CONTENT_MULTIPLIER) // Hard cap for crates and trunks in the world
export const WOODEN_BOX_THROW_MULTIPLIER = 0.3 // Reduced from 2 to 0.3 (4x reduction)
export const WOODEN_BOX_FLOAT_SPEED = 0.5 // How fast boxes float in water
export const WOODEN_BOX_SNAP_DISTANCE = 60 // Distance for boxes to snap to each other
export const TREE_SIZE = 44 // Canopy radius of a tree
export const TREE_HIT_POINTS = 3 // Hits needed to chop a tree down
export const TREE_MIN_SPACING = 95 // Keeps forests walkable between trunks
export const TREE_TILE_FILL_CHANCE = 0.55 // Chance a forest tile gets a tree
export const TREE_MAX_ACTIVE = 2600 // Upper bound for trees kept alive while exploring
export const TREE_MAX_APPLES = 3 // Max apples growing on a single tree
export const TREE_APPLE_VALUE = 1 // Apples dropped from trees are worth 1
export const CAR_SIZE = 70 // Size of cars
export const BOAT_SIZE = 80 // Size of boats
export const CAR_SPEED = 8 // 2x the normal player speed (vehicles)
export const CAR_INTERACTION_RANGE = 80 // Distance for player to interact with cars
export const VEHICLE_PLAYER_COLLISION_RADIUS_MULTIPLIER = 0.34
export const VEHICLE_APPLE_COLLISION_RADIUS_MULTIPLIER = 0.4
export const VEHICLE_APPLE_DAMAGE = 1
export const VEHICLE_WRECK_DESPAWN_DELAY_MS = 60000
export const CAR_COUNT = Math.round(5 * WORLD_CONTENT_MULTIPLIER) // Cars spawned per fresh world
export const MAX_CARS = Math.round(10 * WORLD_CONTENT_MULTIPLIER) // Cars loaded around the player at once
export const BOAT_COUNT = Math.round(5 * WORLD_CONTENT_MULTIPLIER)
export const MAX_BOATS = Math.round(10 * WORLD_CONTENT_MULTIPLIER) // Boats loaded around the player at once
export const BOAT_TOW_CAP = 6
export const BOAT_TOW_SLOWDOWN_MULTIPLIER = 0.82
export const BOAT_TOW_SMOKE_ALPHA = 0.4
export const SLEDGEHAMMER_COUNT = Math.round(5 * WORLD_CONTENT_MULTIPLIER)
export const MAX_SLEDGEHAMMERS = SLEDGEHAMMER_COUNT
export const SHOVEL_COUNT = Math.round(5 * WORLD_CONTENT_MULTIPLIER)
export const MAX_SHOVELS = SHOVEL_COUNT
export const SAW_COUNT = Math.round(5 * WORLD_CONTENT_MULTIPLIER)
export const MAX_SAWS = SAW_COUNT
export const SPAWN_SLEDGEHAMMER_NEAR_PLAYER = true
export const SPAWN_SHOVEL_NEAR_PLAYER = true
export const SPAWN_SAW_NEAR_PLAYER = true
export const INITIAL_BOMB_COUNT = Math.round(25 * WORLD_CONTENT_MULTIPLIER)
export const MAX_BOMBS = Math.round(35 * WORLD_CONTENT_MULTIPLIER) // Hard cap for bombs in the world
export const INITIAL_ENEMY_COUNT = INITIAL_RED_ENEMY_COUNT + INITIAL_YELLOW_ENEMY_COUNT
export const INITIAL_APPLE_COUNT = Math.round(40 * WORLD_CONTENT_MULTIPLIER)
export const MAX_APPLES = Math.round(80 * WORLD_CONTENT_MULTIPLIER) // Hard cap for apple pickups in the world
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

// --- Car handling (single-track "bicycle" model) -----------------------------
// DRIFT_FACTOR scales REAR tyre grip only. 1 = rear sticks (almost no drift),
// low values = tail lets go early and stays out longer (lots of drift).
export const CAR_DRIFT_FACTOR = 0.55 // How much the car drifts (lower = more drift)
export const CAR_MAX_STEER_ANGLE = 0.62 // Max front wheel angle in radians (~35 deg)
export const CAR_STEER_SPEED = 0.16 // How fast the wheels reach the requested angle
export const CAR_FRONT_GRIP = 0.34 // Max lateral force the front tyres can make
export const CAR_REAR_GRIP = 0.2 // Max lateral force the rear tyres can make (before DRIFT_FACTOR)
export const CAR_FRONT_CORNERING_STIFFNESS = 3.2 // Front force built per radian of slip
export const CAR_REAR_CORNERING_STIFFNESS = 2.4 // Rear force built per radian of slip
export const CAR_YAW_INERTIA = 230 // Resistance to spinning: higher = lazier, slower slides
export const CAR_YAW_DAMPING = 0.2 // Bleeds off rotation so a slide settles instead of spinning
export const CAR_STEER_SENSITIVITY_FALLOFF = 0.5 // How much the usable steering range shrinks at speed
export const CAR_LATERAL_DRAG = 0.03 // Scrubbing tyres bleed sideways speed
export const CAR_POWER_OVERSTEER = 0.55 // How much throttle steals from rear grip (friction circle)

// --- Boat handling -----------------------------------------------------------
// Boats steer from a rudder at the STERN and have very little sideways grip,
// so they naturally slide wide through turns (leeway) and take time to settle.
export const BOAT_MAX_SPEED = 7.36 // Maximum speed for boats
export const BOAT_ACCELERATION = 0.22 // How quickly the boat speeds up
export const BOAT_DECELERATION = 0.18 // How quickly the boat slows down
export const BOAT_DRIFT_FACTOR = 0.45 // How much the boat drifts (lower = more drift)
export const BOAT_MAX_RUDDER_ANGLE = 0.7 // Max rudder deflection in radians
export const BOAT_STEER_SPEED = 0.1 // How fast the rudder swings over
export const BOAT_HULL_GRIP = 0.16 // Sideways bite of the hull/keel at the bow
export const BOAT_RUDDER_GRIP = 0.14 // Max sideways force the rudder can make
export const BOAT_HULL_STIFFNESS = 0.85 // Bow force built per radian of slip
export const BOAT_RUDDER_STIFFNESS = 1.2 // Rudder force built per radian of slip
export const BOAT_YAW_INERTIA = 260 // Boats swing lazily and keep swinging
export const BOAT_YAW_DAMPING = 0.16 // Hull resistance to spinning
export const BOAT_STEER_SENSITIVITY_FALLOFF = 0.35 // Rudder authority lost at speed
export const BOAT_LATERAL_DRAG = 0.045 // Water slowly kills sideways travel
export const BOAT_POWER_OVERSTEER = 0.3 // Throttle-induced stern slide

export const TERRAIN_TYPES = {
  WATER: 0,
  GRASS: 1,
  FOREST: 2,
  DIRT: 3,
  SAND: 4,
  GRAVEL: 5,
}