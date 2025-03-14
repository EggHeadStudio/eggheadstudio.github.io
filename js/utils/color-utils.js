// Color utility functions

// Helper function to get terrain color
export function getTerrainColor(terrainType) {
  switch (terrainType) {
    case 0: // TERRAIN_TYPES.WATER
      return "#3498db"
    case 1: // TERRAIN_TYPES.GRASS
      return "#2ecc71"
    case 2: // TERRAIN_TYPES.FOREST
      return "#27ae60"
    case 3: // TERRAIN_TYPES.DIRT
      return "#a67c52"
    default:
      return "#ecf0f1"
  }
}

// Helper function to get random color
export function getRandomColor() {
  const colors = ["#e74c3c", "#9b59b6", "#3498db", "#2ecc71", "#f1c40f", "#e67e22", "#1abc9c", "#34495e"]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Get random explosion particle color
export function getExplosionParticleColor() {
  const colors = [
    "#ff9500", // Orange
    "#ff5e3a", // Red-orange
    "#ffcc00", // Yellow
    "#ff3b30", // Red
    "#ffffff", // White
  ]

  return colors[Math.floor(Math.random() * colors.length)]
}

// Helper function to adjust color brightness
export function adjustColorBrightness(hex, percent) {
  // Convert hex to RGB
  let r = Number.parseInt(hex.substring(1, 3), 16)
  let g = Number.parseInt(hex.substring(3, 5), 16)
  let b = Number.parseInt(hex.substring(5, 7), 16)

  // Adjust brightness
  r = Math.max(0, Math.min(255, r + percent))
  g = Math.max(0, Math.min(255, g + percent))
  b = Math.max(0, Math.min(255, b + percent))

  // Convert back to hex
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

