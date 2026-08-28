import { gameState } from "./game-state.js"
import { refreshWorldForNewDay } from "./game-maintenance.js"
import { clearAllEnemies, spawnImmediateNightBlackEnemies } from "../entities/enemies.js"
import { roofAreas } from "../entities/wooden-boxes.js"

const TRANSITION_DURATION = 30 * 1000

const PHASE_SEGMENTS = [
  { key: "day", label: "Day", duration: 5 * 60 * 1000 },
  { key: "dayToDusk", label: "Dusk", duration: TRANSITION_DURATION },
  { key: "dusk", label: "Dusk", duration: 60 * 1000 },
  { key: "duskToNight", label: "Night", duration: TRANSITION_DURATION },
  { key: "night", label: "Night", duration: 2 * 60 * 1000 },
  { key: "nightToDawn", label: "Dawn", duration: TRANSITION_DURATION },
  { key: "dawn", label: "Dawn", duration: 60 * 1000 },
  { key: "dawnToDay", label: "Day", duration: TRANSITION_DURATION },
]

const LIGHTING_PRESETS = {
  day: {
    overlayColor: [0, 0, 0],
    overlayAlpha: 0,
    vignetteAlpha: 0,
    haloColor: [255, 255, 255],
    haloAlpha: 0,
    lightRadius: 0,
    beamLength: 0,
    beamWidth: 0,
  },
  dusk: {
    overlayColor: [232, 188, 96],
    overlayAlpha: 0.2,
    vignetteAlpha: 0.12,
    haloColor: [255, 212, 132],
    haloAlpha: 0.12,
    lightRadius: 0,
    beamLength: 0,
    beamWidth: 0,
  },
  night: {
    overlayColor: [0, 0, 0],
    overlayAlpha: 0.94,
    vignetteAlpha: 0.56,
    haloColor: [255, 255, 255],
    haloAlpha: 0,
    lightRadius: 138,
    beamLength: 380,
    beamWidth: 54,
  },
  dawn: {
    overlayColor: [246, 205, 124],
    overlayAlpha: 0.18,
    vignetteAlpha: 0.1,
    haloColor: [255, 224, 156],
    haloAlpha: 0.1,
    lightRadius: 0,
    beamLength: 0,
    beamWidth: 0,
  },
}

const START_OFFSETS = {
  day: 0,
  dusk: PHASE_SEGMENTS[0].duration + PHASE_SEGMENTS[1].duration,
  night:
    PHASE_SEGMENTS[0].duration +
    PHASE_SEGMENTS[1].duration +
    PHASE_SEGMENTS[2].duration +
    PHASE_SEGMENTS[3].duration,
  dawn:
    PHASE_SEGMENTS[0].duration +
    PHASE_SEGMENTS[1].duration +
    PHASE_SEGMENTS[2].duration +
    PHASE_SEGMENTS[3].duration +
    PHASE_SEGMENTS[4].duration +
    PHASE_SEGMENTS[5].duration,
}

const TOTAL_CYCLE_DURATION = PHASE_SEGMENTS.reduce((total, segment) => total + segment.duration, 0)

export function initializeDayNightCycle(startPhase = "dawn") {
  const cycleStartTime = Date.now() - (START_OFFSETS[startPhase] || 0)
  gameState.dayNight = {
    cycleStartTime,
    startPhase,
    currentPhase: startPhase,
    phaseProgress: 0,
    displayLabel: formatPhaseLabel(startPhase),
    lighting: getLightingForPhase(startPhase),
  }
  updateTimeOfDayLabel(gameState.dayNight.displayLabel)
}

export function updateDayNightCycle() {
  if (!gameState.isStarted || !gameState.dayNight.cycleStartTime) {
    return
  }

  const elapsed = (Date.now() - gameState.dayNight.cycleStartTime) % TOTAL_CYCLE_DURATION
  const previousPhase = gameState.dayNight.currentPhase
  let offset = 0

  for (const segment of PHASE_SEGMENTS) {
    const segmentEnd = offset + segment.duration

    if (elapsed < segmentEnd) {
      const progress = (elapsed - offset) / segment.duration
      const lightingState = getLightingState(segment.key, progress)

      gameState.dayNight.currentPhase = segment.key
      gameState.dayNight.phaseProgress = progress
      gameState.dayNight.displayLabel = segment.label
      gameState.dayNight.lighting = lightingState

      if (previousPhase && previousPhase !== segment.key && segment.key === "duskToNight") {
        spawnImmediateNightBlackEnemies()
      }

      if (previousPhase && previousPhase !== segment.key && segment.key === "dawn") {
        clearAllEnemies({ spawnCleanupEffects: true })
        gameState.lastEnemySpawnTime = Date.now()
      }

      if (previousPhase && previousPhase !== segment.key && segment.key === "dusk") {
        refreshWorldForNewDay("dusk")
      }

      updateTimeOfDayLabel(segment.label)
      return
    }

    offset = segmentEnd
  }
}

export function drawDayNightOverlay() {
  const { canvas, ctx, player, camera, dayNight } = gameState
  if (!canvas || !ctx || !player || !dayNight.lighting) {
    return
  }

  const lighting = dayNight.lighting
  if (lighting.overlayAlpha <= 0 && lighting.vignetteAlpha <= 0) {
    return
  }

  if (gameState.lightweightMode) {
    drawLightweightOverlay(ctx, canvas, lighting)
    return
  }

  const screenX = player.x - camera.x
  const screenY = player.y - camera.y
  if (lighting.lightRadius <= 0) {
    ctx.save()
    ctx.fillStyle = `rgba(${lighting.overlayColor.join(", ")}, ${lighting.overlayAlpha})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (lighting.haloAlpha > 0) {
      const haloRadius = Math.max(canvas.width, canvas.height) * 0.9
      const halo = ctx.createRadialGradient(screenX, screenY, haloRadius * 0.12, screenX, screenY, haloRadius)
      halo.addColorStop(0, `rgba(${lighting.haloColor.join(", ")}, 0.02)`)
      halo.addColorStop(0.45, `rgba(${lighting.haloColor.join(", ")}, ${lighting.haloAlpha * 0.45})`)
      halo.addColorStop(1, `rgba(${lighting.haloColor.join(", ")}, ${lighting.haloAlpha})`)
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    if (lighting.vignetteAlpha > 0) {
      const maxRadius = Math.max(canvas.width, canvas.height) * 0.85
      const vignette = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, maxRadius)
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)")
      vignette.addColorStop(1, `rgba(0, 0, 0, ${lighting.vignetteAlpha})`)
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    ctx.restore()
    return
  }

  const overlayCanvas = getOverlayCanvas(canvas)
  const overlayCtx = overlayCanvas.getContext("2d")

  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  overlayCtx.globalCompositeOperation = "source-over"
  overlayCtx.fillStyle = `rgba(${lighting.overlayColor.join(", ")}, ${lighting.overlayAlpha})`
  overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height)

  if (lighting.vignetteAlpha > 0) {
    const maxRadius = Math.max(canvas.width, canvas.height) * 0.85
    const vignette = overlayCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, maxRadius)
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)")
    vignette.addColorStop(1, `rgba(0, 0, 0, ${lighting.vignetteAlpha})`)
    overlayCtx.fillStyle = vignette
    overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  }

  overlayCtx.globalCompositeOperation = "destination-out"

  drawShelterLightCutouts(overlayCtx, camera, player)

  const playerLight = overlayCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, lighting.lightRadius)
  playerLight.addColorStop(0, "rgba(0, 0, 0, 1)")
  playerLight.addColorStop(0.22, "rgba(0, 0, 0, 0.96)")
  playerLight.addColorStop(0.58, "rgba(0, 0, 0, 0.46)")
  playerLight.addColorStop(1, "rgba(0, 0, 0, 0)")
  overlayCtx.fillStyle = playerLight
  overlayCtx.beginPath()
  overlayCtx.arc(screenX, screenY, lighting.lightRadius, 0, Math.PI * 2)
  overlayCtx.fill()

  drawExplosionLightBursts(overlayCtx, camera)

  overlayCtx.save()
  overlayCtx.translate(screenX, screenY)
  overlayCtx.rotate(player.direction)

  const beamGradient = overlayCtx.createLinearGradient(0, 0, lighting.beamLength, 0)
  beamGradient.addColorStop(0, "rgba(0, 0, 0, 1)")
  beamGradient.addColorStop(0.14, "rgba(0, 0, 0, 0.98)")
  beamGradient.addColorStop(0.4, "rgba(0, 0, 0, 0.62)")
  beamGradient.addColorStop(1, "rgba(0, 0, 0, 0)")
  overlayCtx.fillStyle = beamGradient
  overlayCtx.beginPath()
  overlayCtx.moveTo(-4, -lighting.beamWidth * 0.42)
  overlayCtx.lineTo(lighting.beamLength * 0.12, -lighting.beamWidth * 0.55)
  overlayCtx.lineTo(lighting.beamLength * 0.4, -lighting.beamWidth * 1.35)
  overlayCtx.lineTo(lighting.beamLength, -lighting.beamWidth * 3.8)
  overlayCtx.lineTo(lighting.beamLength, lighting.beamWidth * 3.8)
  overlayCtx.lineTo(lighting.beamLength * 0.4, lighting.beamWidth * 1.35)
  overlayCtx.lineTo(lighting.beamLength * 0.12, lighting.beamWidth * 0.55)
  overlayCtx.lineTo(-4, lighting.beamWidth * 0.42)
  overlayCtx.closePath()
  overlayCtx.fill()
  overlayCtx.restore()

  ctx.drawImage(overlayCanvas, 0, 0)
}

function drawLightweightOverlay(ctx, canvas, lighting) {
  const alpha = Math.max(lighting.overlayAlpha, lighting.vignetteAlpha * 0.65)
  if (alpha <= 0) {
    return
  }

  ctx.save()
  ctx.fillStyle = `rgba(${lighting.overlayColor.join(", ")}, ${alpha})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
}

function getLightingState(segmentKey, progress) {
  switch (segmentKey) {
    case "dayToDusk":
      return interpolateLighting(LIGHTING_PRESETS.day, LIGHTING_PRESETS.dusk, progress)
    case "dusk":
      return { ...LIGHTING_PRESETS.dusk }
    case "duskToNight":
      return interpolateLighting(LIGHTING_PRESETS.dusk, LIGHTING_PRESETS.night, progress)
    case "night":
      return getNightLighting()
    case "nightToDawn":
      return interpolateLighting(getNightLighting(), LIGHTING_PRESETS.dawn, progress)
    case "dawn":
      return { ...LIGHTING_PRESETS.dawn }
    case "dawnToDay":
      return interpolateLighting(LIGHTING_PRESETS.dawn, LIGHTING_PRESETS.day, progress)
    default:
      return { ...LIGHTING_PRESETS.day }
  }
}

function getLightingForPhase(phase) {
  if (phase === "night") {
    return getNightLighting()
  }

  return { ...(LIGHTING_PRESETS[phase] || LIGHTING_PRESETS.day) }
}

function getNightLighting() {
  return {
    ...LIGHTING_PRESETS.night,
    lightRadius: gameState.isMobile ? 104 : LIGHTING_PRESETS.night.lightRadius,
    beamLength: gameState.isMobile ? 240 : LIGHTING_PRESETS.night.beamLength,
    beamWidth: gameState.isMobile ? 38 : LIGHTING_PRESETS.night.beamWidth,
  }
}

function interpolateLighting(from, to, progress) {
  const start = from === LIGHTING_PRESETS.night ? getNightLighting() : from
  const end = to === LIGHTING_PRESETS.night ? getNightLighting() : to

  return {
    overlayColor: start.overlayColor.map((value, index) => Math.round(lerp(value, end.overlayColor[index], progress))),
    overlayAlpha: lerp(start.overlayAlpha, end.overlayAlpha, progress),
    vignetteAlpha: lerp(start.vignetteAlpha, end.vignetteAlpha, progress),
    haloColor: start.haloColor.map((value, index) => Math.round(lerp(value, end.haloColor[index], progress))),
    haloAlpha: lerp(start.haloAlpha, end.haloAlpha, progress),
    lightRadius: lerp(start.lightRadius, end.lightRadius, progress),
    beamLength: lerp(start.beamLength, end.beamLength, progress),
    beamWidth: lerp(start.beamWidth, end.beamWidth, progress),
  }
}

function updateTimeOfDayLabel(label) {
  const labelElement = document.getElementById("timeOfDayLabel")
  if (labelElement) {
    labelElement.textContent = label
  }
}

function formatPhaseLabel(phase) {
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}

function lerp(start, end, progress) {
  return start + (end - start) * progress
}

function drawShelterLightCutouts(overlayCtx, camera, player) {
  if (!Array.isArray(roofAreas) || roofAreas.length === 0) {
    return
  }

  const playerUnderRoof = roofAreas.some((roof) => {
    return (
      player.x >= roof.x &&
      player.x <= roof.x + roof.width &&
      player.y >= roof.y &&
      player.y <= roof.y + roof.height
    )
  })

  for (const roof of roofAreas) {
    const centerX = roof.x + roof.width * 0.5 - camera.x
    const centerY = roof.y + roof.height * 0.5 - camera.y
    const radius = Math.max(roof.width, roof.height) * 0.8 + 40
    const roofGlow = overlayCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    roofGlow.addColorStop(0, "rgba(0, 0, 0, 1)")
    roofGlow.addColorStop(0.25, "rgba(0, 0, 0, 0.7)")
    roofGlow.addColorStop(0.6, "rgba(0, 0, 0, 0.2)")
    roofGlow.addColorStop(1, "rgba(0, 0, 0, 0)")
    overlayCtx.fillStyle = roofGlow
    overlayCtx.beginPath()
    overlayCtx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    overlayCtx.fill()
  }

  if (playerUnderRoof) {
    const playerX = player.x - camera.x
    const playerY = player.y - camera.y
    const playerGlow = overlayCtx.createRadialGradient(playerX, playerY, 0, playerX, playerY, 180)
    playerGlow.addColorStop(0, "rgba(0, 0, 0, 1)")
    playerGlow.addColorStop(0.35, "rgba(0, 0, 0, 0.75)")
    playerGlow.addColorStop(0.7, "rgba(0, 0, 0, 0.2)")
    playerGlow.addColorStop(1, "rgba(0, 0, 0, 0)")
    overlayCtx.fillStyle = playerGlow
    overlayCtx.beginPath()
    overlayCtx.arc(playerX, playerY, 180, 0, Math.PI * 2)
    overlayCtx.fill()
  }
}

function drawExplosionLightBursts(overlayCtx, camera) {
  const { explosions } = gameState
  if (!explosions || explosions.length === 0) {
    return
  }

  for (const explosion of explosions) {
    if (!explosion || !explosion.startTime || !explosion.duration) {
      continue
    }

    const elapsed = Date.now() - explosion.startTime
    const progress = Math.min(Math.max(elapsed / explosion.duration, 0), 1)
    const fade = 1 - progress

    if (fade <= 0) {
      continue
    }

    const burstRadius = Math.max(explosion.currentRadius, explosion.maxRadius * 0.2) * (0.75 + fade * 0.55)
    const burstX = explosion.x - camera.x
    const burstY = explosion.y - camera.y
    const burstGradient = overlayCtx.createRadialGradient(burstX, burstY, 0, burstX, burstY, burstRadius)

    burstGradient.addColorStop(0, "rgba(0, 0, 0, 1)")
    burstGradient.addColorStop(0.22, `rgba(0, 0, 0, ${0.96 * fade})`)
    burstGradient.addColorStop(0.58, `rgba(0, 0, 0, ${0.46 * fade})`)
    burstGradient.addColorStop(1, "rgba(0, 0, 0, 0)")

    overlayCtx.fillStyle = burstGradient
    overlayCtx.beginPath()
    overlayCtx.arc(burstX, burstY, burstRadius, 0, Math.PI * 2)
    overlayCtx.fill()
  }
}

function getOverlayCanvas(canvas) {
  const currentOverlay = gameState.dayNight.overlayCanvas

  if (!currentOverlay || currentOverlay.width !== canvas.width || currentOverlay.height !== canvas.height) {
    const overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = canvas.width
    overlayCanvas.height = canvas.height
    gameState.dayNight.overlayCanvas = overlayCanvas
  }

  return gameState.dayNight.overlayCanvas
}