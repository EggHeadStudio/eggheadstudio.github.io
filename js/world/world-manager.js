// Chunked world storage.
//
// Terrain stays a plain array of Uint8Array rows so `terrain[y][x]` remains a
// direct typed-array read everywhere in the game. Chunks only decide WHICH
// tiles have been generated yet, which keeps startup and streaming cheap while
// the world still behaves like one enormous, always-identical map.
import { gameState } from "../core/game-state.js"
import {
  TERRAIN_TYPES,
  TILE_SIZE,
  WORLD_CHUNK_PRELOAD_RADIUS,
  WORLD_CHUNK_SIZE_TILES,
  WORLD_MAP_SIZE,
  WORLD_SAVE_KEY,
  WORLD_SEED,
  WORLD_ELEVATION_SCALE,
  WORLD_ELEVATION_OCTAVES,
  WORLD_WATER_LEVEL,
  WORLD_SHORE_BAND,
  WORLD_RIVER_SCALE,
  WORLD_RIVER_WIDTH,
  WORLD_RIVER_MAX_ELEVATION,
  WORLD_MOISTURE_SCALE,
  WORLD_FOREST_LEVEL,
  WORLD_GRAVEL_SCALE,
  WORLD_GRAVEL_LEVEL,
} from "../core/constants.js"

let saveTimerId = null

function createWorldMap(mapSize) {
  return {
    mapSize,
    chunkSize: WORLD_CHUNK_SIZE_TILES,
    chunkCount: Math.ceil(mapSize / WORLD_CHUNK_SIZE_TILES),
    seed: WORLD_SEED,
    generatedChunks: new Set(),
    treeChunks: new Set(),
    pendingChunkKeys: new Set(),
    // Chunks that have already had their rocks, crates, vehicles etc. placed.
    populatedChunks: new Set(),
    // Entities belonging to chunks the player has walked away from. They are
    // stored exactly as they were so returning finds the world unchanged.
    chunkEntities: new Map(),
    baselines: new Map(),
    savedChunks: {},
  }
}

export function getWorldMap() {
  if (!gameState.worldMap) {
    gameState.worldMap = createWorldMap(gameState.startupConfig?.mapSize || WORLD_MAP_SIZE)
  }

  return gameState.worldMap
}

function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`
}

export function getChunkKeyForWorldPosition(worldX, worldY) {
  const worldMap = getWorldMap()
  const chunkX = Math.floor(worldX / TILE_SIZE / worldMap.chunkSize)
  const chunkY = Math.floor(worldY / TILE_SIZE / worldMap.chunkSize)
  return chunkKey(chunkX, chunkY)
}

// Keys of every chunk within `radius` chunks of a world position.
export function getChunkKeysAroundWorldPosition(worldX, worldY, radius) {
  const worldMap = getWorldMap()
  const centerX = Math.floor(worldX / TILE_SIZE / worldMap.chunkSize)
  const centerY = Math.floor(worldY / TILE_SIZE / worldMap.chunkSize)
  const keys = []

  for (let offsetY = -radius; offsetY <= radius; offsetY++) {
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      const chunkX = centerX + offsetX
      const chunkY = centerY + offsetY

      if (chunkX < 0 || chunkY < 0 || chunkX >= worldMap.chunkCount || chunkY >= worldMap.chunkCount) {
        continue
      }

      keys.push(chunkKey(chunkX, chunkY))
    }
  }

  return keys
}

// Fast integer hash. No trig, so sampling several noise fields per tile stays
// cheap enough to generate chunks while the player is running.
function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// Smoothly interpolated value noise: neighbouring tiles get similar values, so
// thresholding it produces coherent regions rather than scattered tiles.
function valueNoise(x, y, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)

  const n00 = hash2(xi, yi, seed)
  const n10 = hash2(xi + 1, yi, seed)
  const n01 = hash2(xi, yi + 1, seed)
  const n11 = hash2(xi + 1, yi + 1, seed)

  const top = n00 + (n10 - n00) * u
  const bottom = n01 + (n11 - n01) * u
  return top + (bottom - top) * v
}

// Fractal noise: a few octaves of value noise stacked so coastlines get detail
// without breaking up the large shapes.
function fractalNoise(x, y, seed, octaves) {
  let amplitude = 1
  let frequency = 1
  let total = 0
  let normalization = 0

  for (let octave = 0; octave < octaves; octave++) {
    total += valueNoise(x * frequency, y * frequency, seed + octave * 7919) * amplitude
    normalization += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return total / normalization
}

export function getWorldElevation(tileX, tileY) {
  const seed = getWorldMap().seed
  return fractalNoise(
    tileX / WORLD_ELEVATION_SCALE,
    tileY / WORLD_ELEVATION_SCALE,
    seed,
    WORLD_ELEVATION_OCTAVES,
  )
}

function isRiverTile(tileX, tileY, elevation, seed) {
  if (WORLD_RIVER_WIDTH <= 0 || elevation > WORLD_WATER_LEVEL + WORLD_RIVER_MAX_ELEVATION) {
    return false
  }

  // Ridged noise: the value peaks along thin winding lines, which is exactly
  // the shape of a river running through the landscape.
  const river = fractalNoise(tileX / WORLD_RIVER_SCALE, tileY / WORLD_RIVER_SCALE, seed + 1013, 2)
  return 1 - Math.abs(river * 2 - 1) > 1 - WORLD_RIVER_WIDTH
}

function getProceduralTerrainType(tileX, tileY) {
  const worldMap = getWorldMap()

  if (tileX < 0 || tileY < 0 || tileX >= worldMap.mapSize || tileY >= worldMap.mapSize) {
    return TERRAIN_TYPES.WATER
  }

  const seed = worldMap.seed
  const elevation = fractalNoise(
    tileX / WORLD_ELEVATION_SCALE,
    tileY / WORLD_ELEVATION_SCALE,
    seed,
    WORLD_ELEVATION_OCTAVES,
  )

  if (elevation < WORLD_WATER_LEVEL || isRiverTile(tileX, tileY, elevation, seed)) {
    return TERRAIN_TYPES.WATER
  }

  // Land just above the water line becomes the shore of whatever lake or sea
  // it borders.
  if (elevation < WORLD_WATER_LEVEL + WORLD_SHORE_BAND) {
    return TERRAIN_TYPES.SAND
  }

  const gravel = fractalNoise(tileX / WORLD_GRAVEL_SCALE, tileY / WORLD_GRAVEL_SCALE, seed + 3301, 2)
  if (gravel > WORLD_GRAVEL_LEVEL) {
    return TERRAIN_TYPES.GRAVEL
  }

  const moisture = fractalNoise(tileX / WORLD_MOISTURE_SCALE, tileY / WORLD_MOISTURE_SCALE, seed + 7717, 3)
  if (moisture > WORLD_FOREST_LEVEL) {
    return TERRAIN_TYPES.FOREST
  }

  return TERRAIN_TYPES.GRASS
}

function allocateTerrainRows(mapSize) {
  const terrain = new Array(mapSize)

  for (let y = 0; y < mapSize; y++) {
    terrain[y] = new Uint8Array(mapSize)
  }

  return terrain
}

function generateChunk(chunkX, chunkY) {
  const worldMap = getWorldMap()

  if (chunkX < 0 || chunkY < 0 || chunkX >= worldMap.chunkCount || chunkY >= worldMap.chunkCount) {
    return false
  }

  const key = chunkKey(chunkX, chunkY)

  if (worldMap.generatedChunks.has(key)) {
    return false
  }

  const terrain = gameState.terrain
  const size = worldMap.chunkSize
  const startTileX = chunkX * size
  const startTileY = chunkY * size
  const endTileX = Math.min(startTileX + size, worldMap.mapSize)
  const endTileY = Math.min(startTileY + size, worldMap.mapSize)

  // The noise fields are already smooth, so tiles can be written straight out
  // with no neighbour smoothing pass.
  for (let tileY = startTileY; tileY < endTileY; tileY++) {
    const row = terrain[tileY]

    for (let tileX = startTileX; tileX < endTileX; tileX++) {
      row[tileX] = getProceduralTerrainType(tileX, tileY)
    }
  }

  // Re-apply anything the player changed here in an earlier visit/session.
  const savedChunk = worldMap.savedChunks?.[key]
  if (savedChunk?.tiles) {
    for (const entry of savedChunk.tiles) {
      const tileX = entry[0]
      const tileY = entry[1]

      if (tileX >= 0 && tileY >= 0 && tileX < worldMap.mapSize && tileY < worldMap.mapSize) {
        terrain[tileY][tileX] = entry[2]
      }
    }
  }

  // Baseline snapshot lets us detect player edits later without hooking every
  // gameplay write site.
  const baseline = new Uint8Array(size * size)
  for (let tileY = startTileY; tileY < endTileY; tileY++) {
    for (let tileX = startTileX; tileX < endTileX; tileX++) {
      baseline[(tileY - startTileY) * size + (tileX - startTileX)] = terrain[tileY][tileX]
    }
  }

  worldMap.baselines.set(key, baseline)
  worldMap.generatedChunks.add(key)
  worldMap.pendingChunkKeys.add(key)
  return true
}

function collectChunkEdits(key) {
  const worldMap = getWorldMap()
  const baseline = worldMap.baselines.get(key)

  if (!baseline) {
    return null
  }

  const bounds = getChunkTileBounds(key)
  const size = worldMap.chunkSize
  const terrain = gameState.terrain
  const edits = []

  for (let tileY = bounds.startTileY; tileY < bounds.endTileY; tileY++) {
    for (let tileX = bounds.startTileX; tileX < bounds.endTileX; tileX++) {
      const current = terrain[tileY][tileX]

      if (current !== baseline[(tileY - bounds.startTileY) * size + (tileX - bounds.startTileX)]) {
        edits.push([tileX, tileY, current])
      }
    }
  }

  return edits.length > 0 ? edits : null
}

function loadWorldSave() {
  if (typeof window === "undefined" || !window.localStorage) {
    return
  }

  try {
    const rawValue = window.localStorage.getItem(WORLD_SAVE_KEY)
    if (!rawValue) {
      return
    }

    const parsed = JSON.parse(rawValue)
    const worldMap = getWorldMap()

    if (parsed?.seed !== worldMap.seed || parsed?.mapSize !== worldMap.mapSize) {
      return
    }

    worldMap.savedChunks = parsed.chunks && typeof parsed.chunks === "object" ? parsed.chunks : {}

    if (parsed.dugHoles && typeof parsed.dugHoles === "object") {
      gameState.dugHoles = parsed.dugHoles
    }

    if (parsed.choppedTreeTiles && typeof parsed.choppedTreeTiles === "object") {
      gameState.choppedTreeTiles = parsed.choppedTreeTiles
    }
  } catch {
    // A corrupt save must never block play; fall back to a fresh world.
  }
}

export function saveWorldState() {
  if (typeof window === "undefined" || !window.localStorage) {
    return
  }

  const worldMap = getWorldMap()
  const chunks = { ...(worldMap.savedChunks || {}) }

  for (const key of worldMap.generatedChunks) {
    const edits = collectChunkEdits(key)

    if (edits) {
      chunks[key] = { tiles: edits }
    } else {
      delete chunks[key]
    }
  }

  try {
    window.localStorage.setItem(
      WORLD_SAVE_KEY,
      JSON.stringify({
        version: 1,
        seed: worldMap.seed,
        mapSize: worldMap.mapSize,
        chunks,
        dugHoles: gameState.dugHoles || {},
        choppedTreeTiles: gameState.choppedTreeTiles || {},
      }),
    )

    worldMap.savedChunks = chunks
  } catch {
    // Storage quota problems must not break gameplay.
  }
}

export function scheduleWorldSave() {
  if (typeof window === "undefined") {
    return
  }

  if (saveTimerId) {
    window.clearTimeout(saveTimerId)
  }

  saveTimerId = window.setTimeout(() => {
    saveTimerId = null
    saveWorldState()
  }, 2000)
}

export function initializeWorldTerrain(mapSize = WORLD_MAP_SIZE) {
  gameState.worldMap = createWorldMap(mapSize)
  gameState.terrain = allocateTerrainRows(mapSize)
  loadWorldSave()

  if (typeof window !== "undefined" && !window.hasWorldSaveListener) {
    window.addEventListener("beforeunload", saveWorldState)
    window.hasWorldSaveListener = true
  }
}

export function ensureWorldChunksAroundWorldPosition(worldX, worldY, radius = WORLD_CHUNK_PRELOAD_RADIUS) {
  const worldMap = getWorldMap()
  const chunkX = Math.floor(worldX / TILE_SIZE / worldMap.chunkSize)
  const chunkY = Math.floor(worldY / TILE_SIZE / worldMap.chunkSize)
  let generatedCount = 0

  for (let offsetY = -radius; offsetY <= radius; offsetY++) {
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      if (generateChunk(chunkX + offsetX, chunkY + offsetY)) {
        generatedCount++
      }
    }
  }

  if (generatedCount > 0) {
    scheduleWorldSave()
  }

  return generatedCount
}

export function drainPendingChunkKeys() {
  const worldMap = getWorldMap()
  const keys = [...worldMap.pendingChunkKeys]
  worldMap.pendingChunkKeys.clear()
  return keys
}

export function shouldGenerateTreesForChunk(key) {
  return !getWorldMap().treeChunks.has(key)
}

export function registerChunkTreeGeneration(key) {
  getWorldMap().treeChunks.add(key)
}

export function getChunkTileBounds(key) {
  const worldMap = getWorldMap()
  const [chunkX, chunkY] = key.split(",").map(Number)
  const startTileX = chunkX * worldMap.chunkSize
  const startTileY = chunkY * worldMap.chunkSize

  return {
    startTileX,
    startTileY,
    endTileX: Math.min(startTileX + worldMap.chunkSize, worldMap.mapSize),
    endTileY: Math.min(startTileY + worldMap.chunkSize, worldMap.mapSize),
  }
}

export function getWorldPixelSize() {
  const worldMap = getWorldMap()
  return worldMap.mapSize * TILE_SIZE
}

// Entities spawn inside the streamed area around the player, so the world
// always feels populated no matter how far the player travels.
export function getRandomLoadedWorldPosition(minDistance = 0, maxDistance = 0) {
  const worldMap = getWorldMap()
  const player = gameState.player
  const loadedSpan = worldMap.chunkSize * WORLD_CHUNK_PRELOAD_RADIUS * TILE_SIZE
  const worldLimit = worldMap.mapSize * TILE_SIZE - 1
  const originX = player ? player.x : worldLimit / 2
  const originY = player ? player.y : worldLimit / 2
  const outerRadius = maxDistance > 0 ? Math.min(maxDistance, loadedSpan) : loadedSpan
  const angle = Math.random() * Math.PI * 2
  const distance = minDistance + Math.random() * Math.max(1, outerRadius - minDistance)

  return {
    x: Math.max(0, Math.min(worldLimit, originX + Math.cos(angle) * distance)),
    y: Math.max(0, Math.min(worldLimit, originY + Math.sin(angle) * distance)),
  }
}
