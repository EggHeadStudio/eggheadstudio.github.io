import { gameState } from "./game-state.js"
import {
  PAUSED_GAME_SESSION_DATA_KEY,
  PAUSED_GAME_SESSION_META_KEY,
  MOBILE_VIEWPORT_SCALE,
  WORLD_MAP_SIZE,
} from "./constants.js"
import {
  ensureWorldChunksAroundWorldPosition,
  initializeWorldTerrain,
  saveWorldState,
} from "../world/world-manager.js"
import { setupEventListeners } from "../input/input-handler.js"
import { detectMobile, setupMobileControls } from "../input/mobile-controls.js"

export function hasPausedGameSession() {
  if (typeof window === "undefined" || !window.localStorage) {
    return false
  }

  try {
    return Boolean(
      window.localStorage.getItem(PAUSED_GAME_SESSION_META_KEY) &&
      window.localStorage.getItem(PAUSED_GAME_SESSION_DATA_KEY),
    )
  } catch {
    return false
  }
}

export function loadPausedGameSessionMeta() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null
  }

  try {
    const rawMetaValue = window.localStorage.getItem(PAUSED_GAME_SESSION_META_KEY)
    const rawDataValue = window.localStorage.getItem(PAUSED_GAME_SESSION_DATA_KEY)
    if (!rawMetaValue || !rawDataValue) {
      return null
    }

    const parsed = JSON.parse(rawMetaValue)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export function savePausedGameSession() {
  if (typeof window === "undefined" || !window.localStorage) {
    return false
  }

  if (!gameState.isStarted || !gameState.isPaused || gameState.gameOver) {
    return false
  }

  try {
    saveWorldState()
  } catch {
    // A failed world save must not stop the run snapshot from being written.
  }

  // localStorage is only a few MB, and chunkEntities grows with every chunk the
  // player has visited. If the full snapshot does not fit we drop the stashed
  // far-away chunk contents (those chunks simply repopulate when revisited)
  // rather than losing the ability to resume at all.
  const attempts = [
    () => createPausedGameSnapshot(),
    () => ({ ...createPausedGameSnapshot(), worldStreaming: null }),
  ]

  for (const buildSnapshot of attempts) {
    try {
      const snapshot = buildSnapshot()
      const serializedSnapshot = JSON.stringify(snapshot, createSessionReplacer())
      const serializedMeta = JSON.stringify(createPausedGameSnapshotMeta(snapshot))

      // Write the payload first: if it is rejected, the meta key is never
      // written and the pair stays consistent.
      window.localStorage.setItem(PAUSED_GAME_SESSION_DATA_KEY, serializedSnapshot)
      window.localStorage.setItem(PAUSED_GAME_SESSION_META_KEY, serializedMeta)
      return true
    } catch {
      clearPausedGameSession()
    }
  }

  return false
}

export function clearPausedGameSession() {
  if (typeof window === "undefined" || !window.localStorage) {
    return
  }

  try {
    window.localStorage.removeItem(PAUSED_GAME_SESSION_META_KEY)
    window.localStorage.removeItem(PAUSED_GAME_SESSION_DATA_KEY)
  } catch {
    // Ignore storage access issues.
  }
}

export function restorePausedGameSessionRuntime() {
  if (typeof window === "undefined" || !window.localStorage) {
    return false
  }

  try {
    const rawValue = window.localStorage.getItem(PAUSED_GAME_SESSION_DATA_KEY)
    if (!rawValue) {
      return false
    }

    const snapshot = JSON.parse(rawValue, sessionReviver)
    if (!snapshot || snapshot.version !== 1) {
      return false
    }

    const startupConfig = snapshot.startupConfig || {}
    const mapSize = startupConfig.mapSize || WORLD_MAP_SIZE

    // Rebuild terrain from the deterministic generator plus the persisted tile
    // edits, then re-apply only the streaming bookkeeping from the snapshot.
    initializeWorldTerrain(mapSize)
    restoreWorldStreamingState(snapshot.worldStreaming)

    gameState.canvas = document.getElementById("gameCanvas")
    gameState.ctx = gameState.canvas?.getContext("2d") || null
    gameState.isMobile = Boolean(detectMobile())
    gameState.lightweightMode = Boolean(startupConfig.lightweightMode)

    if (gameState.canvas) {
      resizeCanvasForRestoredSession()
    }

    if (!window.hasResizeListener) {
      window.addEventListener("resize", resizeCanvasForRestoredSession)
      window.hasResizeListener = true
    }

    setupEventListeners()
    setupMobileControls()

    Object.assign(gameState, {
      isStarted: true,
      isPaused: true,
      gameOver: Boolean(snapshot.gameOver),
      pendingGameOver: Boolean(snapshot.pendingGameOver),
      gameOverTimeoutId: null,
      pauseStartedAt: snapshot.pauseStartedAt || Date.now(),
      menuMode: snapshot.menuMode || "pause",
      startTime: snapshot.startTime || Date.now(),
      elapsedTime: snapshot.elapsedTime || 0,
      timerInterval: null,
      lastEnemySpawnTime: snapshot.lastEnemySpawnTime || Date.now(),
      killCount: snapshot.killCount || 0,
      startupConfig,
      dayNight: snapshot.dayNight ? { ...snapshot.dayNight, overlayCanvas: null } : gameState.dayNight,
      keys: {},
      mousePosition: snapshot.mousePosition || { x: 0, y: 0 },
      isMobile: Boolean(detectMobile()),
      lightweightMode: Boolean(startupConfig.lightweightMode),
      joystickActive: false,
      joystickAngle: 0,
      joystickDistance: 0,
      buttonAActive: false,
      buttonBActive: false,
      camera: snapshot.camera || { x: 0, y: 0 },
      discoveredMap: snapshot.discoveredMap || new Map(),
      claimedSections: snapshot.claimedSections || new Map(),
      selectorModalOpen: Boolean(snapshot.selectorModalOpen),
      selectorModalType: snapshot.selectorModalType || null,
      player: snapshot.player || null,
      bombs: snapshot.bombs || [],
      grenades: snapshot.grenades || [],
      thrownGrenades: snapshot.thrownGrenades || [],
      grenadePins: [],
      grenadeCharge: null,
      enemies: snapshot.enemies || [],
      apples: snapshot.apples || [],
      sledgehammers: snapshot.sledgehammers || [],
      shovels: snapshot.shovels || [],
      saws: snapshot.saws || [],
      thrownApples: snapshot.thrownApples || [],
      explosions: snapshot.explosions || [],
      deathEffects: snapshot.deathEffects || [],
      rocks: snapshot.rocks || [],
      trees: snapshot.trees || [],
      sandPiles: snapshot.sandPiles || [],
      woodenBoxes: snapshot.woodenBoxes || [],
      boxDestructionEffects: snapshot.boxDestructionEffects || [],
      waterDrips: snapshot.waterDrips || [],
      cars: snapshot.cars || [],
      boats: snapshot.boats || [],
      trailers: snapshot.trailers || [],
      isGrabbing: Boolean(snapshot.isGrabbing),
      grabbedBomb: snapshot.grabbedBomb || null,
      grabbedRock: snapshot.grabbedRock || null,
      grabbedEnemy: snapshot.grabbedEnemy || null,
      grabbedSandPile: snapshot.grabbedSandPile || null,
      grabbedWoodenBox: snapshot.grabbedWoodenBox || null,
      hasSledgehammer: Boolean(snapshot.hasSledgehammer),
      hasShovel: Boolean(snapshot.hasShovel),
      hasSaw: Boolean(snapshot.hasSaw),
      selectedWeapon: snapshot.selectedWeapon || "wrist",
      selectedTool: snapshot.selectedTool || "none",
      dugHoles: snapshot.dugHoles || {},
      pendingDigTile: snapshot.pendingDigTile || null,
      digAnimations: snapshot.digAnimations || [],
      shovelActionLockUntil: snapshot.shovelActionLockUntil || 0,
      isInCar: Boolean(snapshot.isInCar),
      drivingCar: snapshot.drivingCar || null,
    })

    if (gameState.player) {
      ensureWorldChunksAroundWorldPosition(gameState.player.x, gameState.player.y)
    }

    relinkRestoredEntities()

    return true
  } catch {
    clearPausedGameSession()
    return false
  }
}

// A hitched trailer points straight at a live car. Saving that reference would
// write a second, detached copy of the car, so the link is stored as an index
// into the cars array and rebuilt by relinkRestoredEntities().
function createTrailersSnapshot() {
  const cars = gameState.cars || []

  return (gameState.trailers || []).map((trailer) => ({
    ...trailer,
    hitchedTo: null,
    hitchedCarIndex: trailer.hitchedTo ? cars.indexOf(trailer.hitchedTo) : -1,
  }))
}

function createPausedGameSnapshot() {
  const dayNight = gameState.dayNight ? { ...gameState.dayNight } : null

  if (dayNight) {
    dayNight.overlayCanvas = null
  }

  return {
    version: 1,
    savedAt: Date.now(),
    isStarted: gameState.isStarted,
    isPaused: gameState.isPaused,
    gameOver: gameState.gameOver,
    pendingGameOver: gameState.pendingGameOver,
    pauseStartedAt: gameState.pauseStartedAt,
    // A stored run always comes back through the pause menu, so the transient
    // selector-modal pause is normalised away here.
    menuMode: "pause",
    selectorModalOpen: false,
    selectorModalType: null,
    startTime: gameState.startTime,
    elapsedTime: gameState.elapsedTime,
    lastEnemySpawnTime: gameState.lastEnemySpawnTime,
    killCount: gameState.killCount,
    startupConfig: gameState.startupConfig,
    dayNight,
    camera: gameState.camera,
    mousePosition: gameState.mousePosition,
    discoveredMap: gameState.discoveredMap,
    claimedSections: gameState.claimedSections,
    player: gameState.player,
    bombs: gameState.bombs,
    grenades: gameState.grenades,
    thrownGrenades: gameState.thrownGrenades,
    enemies: gameState.enemies,
    apples: gameState.apples,
    sledgehammers: gameState.sledgehammers,
    shovels: gameState.shovels,
    saws: gameState.saws,
    thrownApples: gameState.thrownApples,
    explosions: gameState.explosions,
    deathEffects: gameState.deathEffects,
    rocks: gameState.rocks,
    trees: gameState.trees,
    sandPiles: gameState.sandPiles,
    woodenBoxes: gameState.woodenBoxes,
    boxDestructionEffects: gameState.boxDestructionEffects,
    waterDrips: gameState.waterDrips,
    cars: gameState.cars,
    boats: gameState.boats,
    trailers: createTrailersSnapshot(),
    isGrabbing: gameState.isGrabbing,
    grabbedBomb: gameState.grabbedBomb,
    grabbedRock: gameState.grabbedRock,
    grabbedEnemy: gameState.grabbedEnemy,
    grabbedSandPile: gameState.grabbedSandPile,
    grabbedWoodenBox: gameState.grabbedWoodenBox,
    hasSledgehammer: gameState.hasSledgehammer,
    hasShovel: gameState.hasShovel,
    hasSaw: gameState.hasSaw,
    selectedWeapon: gameState.selectedWeapon,
    selectedTool: gameState.selectedTool,
    dugHoles: gameState.dugHoles,
    pendingDigTile: gameState.pendingDigTile,
    digAnimations: gameState.digAnimations,
    shovelActionLockUntil: gameState.shovelActionLockUntil,
    isInCar: gameState.isInCar,
    drivingCar: gameState.drivingCar,
    worldStreaming: createWorldStreamingSnapshot(),
  }
}

// Only the streaming bookkeeping is stored. Terrain itself is regenerated from
// the world seed and the separate world save, which keeps this snapshot small
// enough to fit in localStorage.
function createWorldStreamingSnapshot() {
  const worldMap = gameState.worldMap

  if (!worldMap) {
    return null
  }

  return {
    populatedChunks: worldMap.populatedChunks,
    treeChunks: worldMap.treeChunks,
    chunkEntities: worldMap.chunkEntities,
  }
}

function restoreWorldStreamingState(worldStreaming) {
  const worldMap = gameState.worldMap

  if (!worldMap || !worldStreaming) {
    return
  }

  if (worldStreaming.populatedChunks instanceof Set) {
    worldMap.populatedChunks = worldStreaming.populatedChunks
  }

  if (worldStreaming.treeChunks instanceof Set) {
    worldMap.treeChunks = worldStreaming.treeChunks
  }

  if (worldStreaming.chunkEntities instanceof Map) {
    worldMap.chunkEntities = worldStreaming.chunkEntities
  }
}

// Restores the object links that the cycle guard had to drop while saving.
function relinkRestoredEntities() {
  for (const boat of gameState.boats || []) {
    if (!Array.isArray(boat?.towedBoxes)) {
      continue
    }

    boat.towedBoxes.forEach((box, index) => {
      if (!box) {
        return
      }

      box.isTowedByBoat = boat
      box.towedIndex = index
    })
  }

  for (const trailer of gameState.trailers || []) {
    if (!trailer) {
      continue
    }

    const carIndex = trailer.hitchedCarIndex
    trailer.hitchedTo = carIndex >= 0 ? (gameState.cars || [])[carIndex] || null : null
    delete trailer.hitchedCarIndex
  }
}

function createPausedGameSnapshotMeta(snapshot) {
  return {
    version: snapshot.version,
    savedAt: snapshot.savedAt,
    pauseStartedAt: snapshot.pauseStartedAt,
    menuMode: snapshot.menuMode,
    startupConfig: snapshot.startupConfig,
  }
}

function resizeCanvasForRestoredSession() {
  if (!gameState.canvas) {
    return
  }

  const container = gameState.canvas.parentElement
  if (!container) {
    return
  }

  const viewportScale = gameState.isMobile ? MOBILE_VIEWPORT_SCALE : gameState.lightweightMode ? 0.85 : 1

  gameState.canvas.style.width = `${container.clientWidth}px`
  gameState.canvas.style.height = `${container.clientHeight}px`
  gameState.canvas.width = Math.floor(container.clientWidth * viewportScale)
  gameState.canvas.height = Math.floor(container.clientHeight * viewportScale)
}

// Entities reference each other in cycles (a boat lists its towed boxes and
// every box points back at the boat), which makes a plain JSON.stringify throw.
// A fresh ancestor stack per call drops only the looping back-reference; the
// links that matter are rebuilt by relinkRestoredEntities() on restore.
function createSessionReplacer() {
  const ancestors = []

  return function sessionReplacerWithCycleGuard(key, value) {
    if (typeof value === "object" && value !== null) {
      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
        ancestors.pop()
      }

      if (ancestors.includes(value)) {
        return undefined
      }

      ancestors.push(value)
    }

    return sessionReplacer(key, value)
  }
}

function sessionReplacer(key, value) {
  if (value instanceof Map) {
    return { __type: "Map", value: [...value.entries()] }
  }

  if (value instanceof Set) {
    return { __type: "Set", value: [...value.values()] }
  }

  if (value instanceof Uint8Array) {
    return { __type: "Uint8Array", value: [...value] }
  }

  return value
}

function sessionReviver(key, value) {
  if (!value || typeof value !== "object" || !value.__type) {
    return value
  }

  if (value.__type === "Map") {
    return new Map(value.value)
  }

  if (value.__type === "Set") {
    return new Set(value.value)
  }

  if (value.__type === "Uint8Array") {
    return new Uint8Array(value.value)
  }

  return value
}