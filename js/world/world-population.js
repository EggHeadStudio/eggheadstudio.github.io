// World population.
//
// Every chunk fills itself with its own rocks, crates, apples, bombs, vehicles
// and tools the first time the player comes near it, so the world is equally
// alive no matter how far it is explored. Chunks the player walks away from are
// not deleted: their entities are stored, exactly as they were left, and handed
// straight back when the player returns.
import { gameState } from "../core/game-state.js"
import {
  TERRAIN_TYPES,
  TILE_SIZE,
  MAX_APPLES,
  MAX_BOATS,
  MAX_BOMBS,
  MAX_CARS,
  MAX_ROCKS,
  MAX_SAWS,
  MAX_SHOVELS,
  MAX_SLEDGEHAMMERS,
  MAX_WOODEN_BOXES,
  ROCK_SIZE,
  ROCK_RUBBLE_MIN_PER_PATCH,
  ROCK_RUBBLE_MAX_PER_PATCH,
  ROCK_RUBBLE_RADIUS,
  WORLD_ENTITY_CHUNK_RADIUS,
  WORLD_ENTITY_RELEASE_RADIUS,
  CHUNK_ROCK_MIN,
  CHUNK_ROCK_MAX,
  CHUNK_GRAVEL_ROCK_BONUS,
  CHUNK_RUBBLE_CHANCE,
  CHUNK_BOX_MIN,
  CHUNK_BOX_MAX,
  CHUNK_FLOATING_BOX_MAX,
  CHUNK_APPLE_MIN,
  CHUNK_APPLE_MAX,
  CHUNK_BOMB_CHANCE,
  CHUNK_CAR_CHANCE,
  CHUNK_BOAT_CHANCE,
  CHUNK_BOAT_MIN_WATER_TILES,
  CHUNK_TOOL_CHANCE,
} from "../core/constants.js"
import {
  getWorldMap,
  getChunkTileBounds,
  getChunkKeyForWorldPosition,
  getChunkKeysAroundWorldPosition,
} from "./world-manager.js"
import { isSpawnPositionClear, isWaterPosition } from "../utils/spawn-utils.js"
import { getDistance } from "../utils/math-utils.js"
import { createRock } from "../entities/rocks.js"
import { createWoodenBox } from "../entities/wooden-boxes.js"
import { createApple } from "../entities/apples.js"
import { createBomb } from "../entities/bombs.js"
import { createCar, canPlaceCarAt } from "../entities/cars.js"
import { createBoat } from "../entities/boats.js"
import { createSledgehammer } from "../entities/sledgehammers.js"
import { createShovel } from "../entities/shovels.js"
import { createSaw } from "../entities/saws.js"

// Everything in these lists moves in and out of the world with its chunk.
const STREAMED_COLLECTIONS = [
  "rocks",
  "woodenBoxes",
  "apples",
  "bombs",
  "trees",
  "cars",
  "boats",
  "sledgehammers",
  "shovels",
  "saws",
]

const PLACEMENT_ATTEMPTS = 12

let lastPlayerChunkKey = null

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickTile(tiles) {
  return tiles[Math.floor(Math.random() * tiles.length)]
}

// A random point inside a tile, kept away from the very edge.
function tilePoint(tile) {
  return {
    x: tile[0] * TILE_SIZE + TILE_SIZE * (0.25 + Math.random() * 0.5),
    y: tile[1] * TILE_SIZE + TILE_SIZE * (0.25 + Math.random() * 0.5),
  }
}

// Try a handful of tiles until `place` accepts one.
function tryPlace(tiles, place) {
  if (!tiles || tiles.length === 0) {
    return false
  }

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
    const point = tilePoint(pickTile(tiles))

    if (place(point.x, point.y)) {
      return true
    }
  }

  return false
}

// Sort a chunk's tiles into the groups the spawners care about.
function collectChunkTiles(key) {
  const terrain = gameState.terrain
  const bounds = getChunkTileBounds(key)

  if (!terrain || !bounds) {
    return null
  }

  const land = []
  const water = []
  const gravel = []
  const openWater = []

  for (let tileY = bounds.startTileY; tileY < bounds.endTileY; tileY++) {
    const row = terrain[tileY]

    if (!row) {
      continue
    }

    for (let tileX = bounds.startTileX; tileX < bounds.endTileX; tileX++) {
      const terrainType = row[tileX]

      if (terrainType === TERRAIN_TYPES.WATER) {
        water.push([tileX, tileY])

        // Open water is far enough from any shore for a boat to sit in.
        if (isOpenWaterTile(terrain, tileX, tileY)) {
          openWater.push([tileX, tileY])
        }

        continue
      }

      land.push([tileX, tileY])

      if (terrainType === TERRAIN_TYPES.GRAVEL) {
        gravel.push([tileX, tileY])
      }
    }
  }

  return { land, water, gravel, openWater }
}

function isOpenWaterTile(terrain, tileX, tileY) {
  for (let offsetY = -2; offsetY <= 2; offsetY++) {
    const row = terrain[tileY + offsetY]

    if (!row) {
      return false
    }

    for (let offsetX = -2; offsetX <= 2; offsetX++) {
      if (row[tileX + offsetX] !== TERRAIN_TYPES.WATER) {
        return false
      }
    }
  }

  return true
}

function spawnRocks(tiles) {
  const { gravel, land } = tiles
  // Bonus rocks only where the chunk is genuinely stony country.
  const isGravelField = gravel.length > land.length * 0.15
  const rockCount = randomInt(CHUNK_ROCK_MIN, CHUNK_ROCK_MAX) + (isGravelField ? CHUNK_GRAVEL_ROCK_BONUS : 0)

  for (let i = 0; i < rockCount; i++) {
    if (gameState.rocks.length >= MAX_ROCKS) {
      return
    }

    // Rocks gather where the ground is already stony.
    const preferred = gravel.length > 0 && Math.random() < 0.75 ? gravel : land

    tryPlace(preferred, (x, y) => {
      if (!isSpawnPositionClear(x, y, ROCK_SIZE, { requireLand: true, playerDistanceBuffer: 100 })) {
        return false
      }

      gameState.rocks.push(createRock(x, y))
      return true
    })
  }
}

function spawnRockRubble(tiles) {
  const { gravel, land } = tiles

  if (Math.random() > CHUNK_RUBBLE_CHANCE) {
    return
  }

  const anchorTiles = gravel.length > 0 ? gravel : land

  if (anchorTiles.length === 0) {
    return
  }

  const anchor = tilePoint(pickTile(anchorTiles))
  const pieceCount = randomInt(ROCK_RUBBLE_MIN_PER_PATCH, ROCK_RUBBLE_MAX_PER_PATCH)

  for (let i = 0; i < pieceCount; i++) {
    if (gameState.rocks.length >= MAX_ROCKS) {
      return
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * ROCK_RUBBLE_RADIUS
      const x = anchor.x + Math.cos(angle) * distance
      const y = anchor.y + Math.sin(angle) * distance
      const size = ROCK_SIZE * (0.35 + Math.random() * 0.55)

      if (
        !isSpawnPositionClear(x, y, size, {
          requireLand: true,
          playerDistanceBuffer: 120,
          includeRocks: false,
          includeTrees: false,
        })
      ) {
        continue
      }

      gameState.rocks.push(createRock(x, y, size))
      break
    }
  }
}

function spawnWoodenBoxes(tiles) {
  const { land, water } = tiles
  const boxCount = randomInt(CHUNK_BOX_MIN, CHUNK_BOX_MAX)

  for (let i = 0; i < boxCount; i++) {
    if (gameState.woodenBoxes.length >= MAX_WOODEN_BOXES) {
      return
    }

    tryPlace(land, (x, y) => placeWoodenBox(x, y))
  }

  // Crates adrift on the water, so every lake and sea has something to salvage.
  if (water.length < 20) {
    return
  }

  const floatingCount = randomInt(0, CHUNK_FLOATING_BOX_MAX)

  for (let i = 0; i < floatingCount; i++) {
    if (gameState.woodenBoxes.length >= MAX_WOODEN_BOXES) {
      return
    }

    tryPlace(water, (x, y) => placeWoodenBox(x, y))
  }
}

function placeWoodenBox(x, y) {
  const box = createWoodenBox(x, y)

  if (!isSpawnPositionClear(x, y, box.size, { playerDistanceBuffer: 100 })) {
    return false
  }

  if (isWaterPosition(x, y)) {
    box.isFloating = true
    box.floatAngle = Math.random() * Math.PI * 2
  }

  gameState.woodenBoxes.push(box)
  return true
}

function spawnApples(tiles) {
  const appleCount = randomInt(CHUNK_APPLE_MIN, CHUNK_APPLE_MAX)

  for (let i = 0; i < appleCount; i++) {
    if (gameState.apples.length >= MAX_APPLES) {
      return
    }

    tryPlace(tiles.land, (x, y) => {
      const apple = createApple(x, y)

      if (!isSpawnPositionClear(x, y, apple.size, { requireLand: true, playerDistanceBuffer: 90 })) {
        return false
      }

      gameState.apples.push(apple)
      return true
    })
  }
}

function spawnBombs(tiles) {
  if (Math.random() > CHUNK_BOMB_CHANCE || gameState.bombs.length >= MAX_BOMBS) {
    return
  }

  tryPlace(tiles.land, (x, y) => {
    const bomb = createBomb(x, y)

    if (!isSpawnPositionClear(x, y, bomb.size, { requireLand: true, playerDistanceBuffer: 120 })) {
      return false
    }

    gameState.bombs.push(bomb)
    return true
  })
}

function spawnCar(tiles) {
  if (Math.random() > CHUNK_CAR_CHANCE) {
    return
  }

  if (!gameState.cars) {
    gameState.cars = []
  }

  if (gameState.cars.length >= MAX_CARS) {
    return
  }

  tryPlace(tiles.land, (x, y) => {
    if (!canPlaceCarAt(x, y, 500)) {
      return false
    }

    gameState.cars.push(createCar(x, y))
    return true
  })
}

function spawnBoat(tiles) {
  const { water, openWater } = tiles

  // Only real lakes and seas are worth a boat.
  if (water.length < CHUNK_BOAT_MIN_WATER_TILES || Math.random() > CHUNK_BOAT_CHANCE) {
    return
  }

  if (!gameState.boats) {
    gameState.boats = []
  }

  if (gameState.boats.length >= MAX_BOATS) {
    return
  }

  tryPlace(openWater.length > 0 ? openWater : water, (x, y) => {
    const boat = createBoat(x, y)

    if (
      !isSpawnPositionClear(x, y, boat.size, {
        requireWater: true,
        playerDistanceBuffer: 260,
        includeBombs: false,
        includeApples: false,
        includeRocks: false,
        includeEnemies: false,
      })
    ) {
      return false
    }

    if (gameState.boats.some((other) => getDistance(x, y, other.x, other.y) < boat.size * 4.5)) {
      return false
    }

    gameState.boats.push(boat)
    return true
  })
}

// Sledgehammers, shovels and saws stay rare, but they can turn up anywhere in
// the world instead of only near the start.
function spawnTools(tiles) {
  const tools = [
    { name: "sledgehammers", limit: MAX_SLEDGEHAMMERS, create: createSledgehammer },
    { name: "shovels", limit: MAX_SHOVELS, create: createShovel },
    { name: "saws", limit: MAX_SAWS, create: createSaw },
  ]

  for (const tool of tools) {
    const collection = gameState[tool.name]

    if (!collection || collection.length >= tool.limit || Math.random() > CHUNK_TOOL_CHANCE) {
      continue
    }

    tryPlace(tiles.land, (x, y) => {
      const item = tool.create(x, y)

      if (!isSpawnPositionClear(x, y, item.size, { requireLand: true, playerDistanceBuffer: 180 })) {
        return false
      }

      collection.push(item)
      return true
    })
  }
}

// Fill one chunk with content. Runs once per chunk for the lifetime of a world.
function populateChunk(key) {
  const worldMap = getWorldMap()

  if (worldMap.populatedChunks.has(key)) {
    return false
  }

  // If the world is momentarily full the chunk is left untouched rather than
  // marked as done, so it still gets its content once space frees up.
  if (
    gameState.rocks.length >= MAX_ROCKS ||
    gameState.woodenBoxes.length >= MAX_WOODEN_BOXES ||
    gameState.apples.length >= MAX_APPLES
  ) {
    return false
  }

  const tiles = collectChunkTiles(key)

  if (!tiles) {
    return false
  }

  worldMap.populatedChunks.add(key)

  spawnRocks(tiles)
  spawnRockRubble(tiles)
  spawnWoodenBoxes(tiles)
  spawnApples(tiles)
  spawnBombs(tiles)
  spawnCar(tiles)
  spawnBoat(tiles)
  spawnTools(tiles)

  return true
}

function getEntityChunkDistance(entity, playerChunkX, playerChunkY, chunkSize) {
  const chunkX = Math.floor(entity.x / TILE_SIZE / chunkSize)
  const chunkY = Math.floor(entity.y / TILE_SIZE / chunkSize)
  return Math.max(Math.abs(chunkX - playerChunkX), Math.abs(chunkY - playerChunkY))
}

function getEntityChunkKey(entity, chunkSize) {
  const chunkX = Math.floor(entity.x / TILE_SIZE / chunkSize)
  const chunkY = Math.floor(entity.y / TILE_SIZE / chunkSize)
  return `${chunkX},${chunkY}`
}

// Move far away entities into storage. The objects themselves are kept, so a
// half-broken crate or a chopped forest comes back exactly as it was left.
function offloadDistantEntities(playerChunkX, playerChunkY) {
  const worldMap = getWorldMap()
  const chunkSize = worldMap.chunkSize

  for (const collectionName of STREAMED_COLLECTIONS) {
    const collection = gameState[collectionName]

    if (!collection || collection.length === 0) {
      continue
    }

    let stored = 0
    const kept = []

    for (const entity of collection) {
      if (getEntityChunkDistance(entity, playerChunkX, playerChunkY, chunkSize) <= WORLD_ENTITY_RELEASE_RADIUS) {
        kept.push(entity)
        continue
      }

      const key = getEntityChunkKey(entity, chunkSize)
      let bucket = worldMap.chunkEntities.get(key)

      if (!bucket) {
        bucket = {}
        worldMap.chunkEntities.set(key, bucket)
      }

      if (!bucket[collectionName]) {
        bucket[collectionName] = []
      }

      bucket[collectionName].push(entity)
      stored++
    }

    if (stored > 0) {
      gameState[collectionName] = kept
    }
  }
}

function restoreChunkEntities(key) {
  const worldMap = getWorldMap()
  const bucket = worldMap.chunkEntities.get(key)

  if (!bucket) {
    return
  }

  worldMap.chunkEntities.delete(key)

  for (const collectionName of STREAMED_COLLECTIONS) {
    const stored = bucket[collectionName]

    if (!stored || stored.length === 0) {
      continue
    }

    if (!gameState[collectionName]) {
      gameState[collectionName] = []
    }

    for (const entity of stored) {
      gameState[collectionName].push(entity)
    }
  }
}

// Keep the world around the player stocked. Only runs when the player crosses
// into a new chunk, so it costs nothing on a normal frame.
export function streamWorldEntities(options = {}) {
  const { force = false } = options
  const player = gameState.player

  if (!player || !gameState.terrain) {
    return
  }

  const playerChunkKey = getChunkKeyForWorldPosition(player.x, player.y)

  if (!force && playerChunkKey === lastPlayerChunkKey) {
    return
  }

  lastPlayerChunkKey = playerChunkKey

  const worldMap = getWorldMap()
  const playerChunkX = Math.floor(player.x / TILE_SIZE / worldMap.chunkSize)
  const playerChunkY = Math.floor(player.y / TILE_SIZE / worldMap.chunkSize)

  offloadDistantEntities(playerChunkX, playerChunkY)

  // Restore before populating so returning content counts towards the limits.
  const nearbyKeys = getChunkKeysAroundWorldPosition(player.x, player.y, WORLD_ENTITY_CHUNK_RADIUS)

  for (const key of nearbyKeys) {
    restoreChunkEntities(key)
  }

  for (const key of nearbyKeys) {
    populateChunk(key)
  }
}

// Used once at startup, before the player has moved anywhere.
export function populateWorldAroundPlayer() {
  lastPlayerChunkKey = null
  streamWorldEntities({ force: true })
}
