// Character factory for creating different character types
import { PLAYER_SIZE, PLAYER_SPEED } from "../core/constants.js"

// Character types with their default properties
const CHARACTER_TYPES = {
  default: {
    size: PLAYER_SIZE * 1.1,
    speed: 3,
    health: 5,
    color: "#f8cc8e",
    strength: 5.0,
    handColor: "#f8cc8e",
    footColor: "#444444",
    backpackColor: "#8B4513",
    backpackPocketColor: "#A0522D",
    hairStyle: "none",
    hairColor: "#2d2d2d",
    noseColor: "#b5966a",
    noseSizeScale: 0.15,
  },

  rasse: {
    size: PLAYER_SIZE * 0.8,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#f8cc8e",
    strength: 1.0,
    handColor: "#f8cc8e",
    footColor: "#444444",
    backpackColor: "#8B4513",
    backpackPocketColor: "#A0522D",
    hairStyle: "mohawk",
    hairColor: "#997831",
    noseColor: "#b5966a",
    noseSizeScale: 0.2,
  },

  iida: {
    size: PLAYER_SIZE * 0.8,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#f8cc8e",
    strength: 1.0,
    handColor: "#f8cc8e",
    footColor: "#444444",
    backpackColor: "#8B4513",
    backpackPocketColor: "#A0522D",
    hairStyle: "long",
    hairColor: "#b07910",
    noseColor: "#b5966a",
    noseSizeScale: 0.2,
    hasGlasses: true,
    glassesColor: "#2b2b2b",
  },

  andrus: {
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 4,
    color: "#cfa974",
    strength: 2.0,
    handColor: "#cfa974",
    footColor: "#444444",
    backpackColor: "#4a5f3c",
    backpackPocketColor: "#708d5d",
    backpackWidthScale: 1.18,
    backpackHeightScale: 1.08,
    hairStyle: "short",
    hairColor: "#795936",
    noseColor: "#967b56",
    noseSizeScale: 0.2,
    hairSideScale: 1.16,
    hairTopScale: 1.02,
    hairBackScale: 1.04,
  },

  lidia: {
    size: PLAYER_SIZE * 0.9,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#dfcaad",
    strength: 1.0,
    handColor: "#dfcaad",
    footColor: "#444444",
    backpackColor: "#8a4f7f",
    backpackPocketColor: "#b06ca4",
    backpackWidthScale: 0.95,
    backpackHeightScale: 1.0,
    hairStyle: "long",
    hairColor: "#df86de",
    noseColor: "#b19065",
    noseSizeScale: 0.15,
    hasLashes: true,
  },

  elli: {
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#cfa974",
    strength: 1.0,
    handColor: "#cfa974",
    footColor: "#a21f69",
    backpackColor: "#2f4256",
    backpackPocketColor: "#4f6a85",
    backpackWidthScale: 1.02,
    backpackHeightScale: 1.12,
    hairStyle: "ultraLong",
    hairColor: "#8c654f",
    noseColor: "#8f734f",
    noseSizeScale: 0.2,
    hasLashes: true,
    hasGlasses: true,
    glassesColor: "#ffffff",
  },

  niko: {
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#ad8c53",
    strength: 1.0,
    handColor: "#7e6450",
    footColor: "#444444",
    backpackColor: "#d7a204",
    backpackPocketColor: "#f9c13f",
    backpackWidthScale: 0.96,
    backpackHeightScale: 0.95,
    hairStyle: "curly",
    hairColor: "#2b2b2b",
    noseColor: "#9e6f4b",
    noseSizeScale: 0.2,
    hasBeard: true,
    beardColor: "#554535",
  },

  mara: {
    size: PLAYER_SIZE * 1.1,
    speed: 3,
    health: 7,
    color: "#d2b68e",
    strength: 2.0,
    handColor: "#9a7a57",
    footColor: "#564868",
    backpackColor: "#5a3b72",
    backpackPocketColor: "#7a59a2",
    backpackWidthScale: 0.9,
    backpackHeightScale: 1.02,
    hairStyle: "bun",
    hairColor: "#594d47",
    noseColor: "#67533e",
    noseSizeScale: 0.2,
    hasLashes: true,
    hasGlasses: true,
    glassesColor: "#c01d1d",
    hasBeard: true,
    beardColor: "#a18577",
  },

  taro: {
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#95793c",
    strength: 1.0,
    handColor: "#ffffff",
    footColor: "#444444",
    backpackColor: "#4e4e34",
    backpackPocketColor: "#767652",
    backpackWidthScale: 1.08,
    backpackHeightScale: 1.2,
    hairStyle: "short",
    hairColor: "#5c3d28",
    noseColor: "#4a3a23",
    noseSizeScale: 0.3,
    hasSunglasses: true,
    glassesColor: "#151515",
  },
}

const SELECTABLE_CHARACTER_TYPES = ["default", "rasse", "iida", "andrus", "lidia", "elli", "niko", "mara", "taro"]

const CHARACTER_DISPLAY_LABELS = {
  default: "Bold",
  rasse: "Rasse",
  iida: "Iida",
  andrus: "Andrus",
  lidia: "Lidia",
  elli: "Elli",
  niko: "Niko",
  mara: "Mara",
  taro: "Taro",
}

export const CHARACTER_CUSTOMIZATION_RULES = {
  health: { min: 2, max: 10 },
  speed: { min: 3, max: 7 },
  strength: { min: 1, max: 5 },
}

function clamp(value, min, max, fallback) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsedValue))
}

function isValidColor(value) {
  if (typeof value !== "string") {
    return false
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return false
  }

  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return true
  }

  return CSS.supports("color", trimmedValue)
}

export function normalizeCharacterCustomization(customization = {}, type = "default", preferredStatKey = null) {
  const baseCharacter = CHARACTER_TYPES[type] || CHARACTER_TYPES.default

  const clampedStats = {
    color: isValidColor(customization.color) ? customization.color.trim() : baseCharacter.color,
    health: clamp(
      customization.health,
      CHARACTER_CUSTOMIZATION_RULES.health.min,
      CHARACTER_CUSTOMIZATION_RULES.health.max,
      baseCharacter.health,
    ),
    speed: clamp(
      customization.speed,
      CHARACTER_CUSTOMIZATION_RULES.speed.min,
      CHARACTER_CUSTOMIZATION_RULES.speed.max,
      baseCharacter.speed,
    ),
    strength: clamp(
      customization.strength,
      CHARACTER_CUSTOMIZATION_RULES.strength.min,
      CHARACTER_CUSTOMIZATION_RULES.strength.max,
      baseCharacter.strength,
    ),
  }

  return clampedStats
}

export function getCharacterCustomizationDefaults(type = "default") {
  const baseCharacter = CHARACTER_TYPES[type] || CHARACTER_TYPES.default

  return normalizeCharacterCustomization(
    {
      color: baseCharacter.color,
      health: baseCharacter.health,
      speed: baseCharacter.speed,
      strength: baseCharacter.strength,
    },
    type,
  )
}

/**
 * Creates a character with the specified type and custom properties
 * @param {string} type - The character type (default, strong, scout)
 * @param {object} customProps - Custom properties to override defaults
 * @returns {object} The character object with all properties
 */
export function createCharacter(type = "default", customProps = {}) {
  // Get the base character type or default if not found
  const baseCharacter = CHARACTER_TYPES[type] || CHARACTER_TYPES.default
  const normalizedCustomization = normalizeCharacterCustomization(customProps, type)
  const resolvedHealth = normalizedCustomization.health

  // Merge base properties with custom properties
  return {
    ...baseCharacter,
    ...customProps,
    ...normalizedCustomization,
    health: resolvedHealth,
    maxHealth: customProps.maxHealth ?? resolvedHealth,
    healChargeMs: 0,
    lastHealUpdateAt: 0,
    // Always include animation properties
    isMoving: false,
    animationTime: 0,
    throwingApple: null,
    shovelDig: null,
    // Character type for reference
    characterType: type,
  }
}

/**
 * Gets all available character types
 * @returns {string[]} Array of character type names
 */
export function getAvailableCharacterTypes() {
  return Object.keys(CHARACTER_TYPES)
}

export function getSelectableCharacterTypes() {
  return SELECTABLE_CHARACTER_TYPES.slice()
}

export function getCharacterTypeLabel(type) {
  return CHARACTER_DISPLAY_LABELS[type] || CHARACTER_DISPLAY_LABELS.default
}

/**
 * Gets the properties of a specific character type
 * @param {string} type - The character type
 * @returns {object} The character type properties
 */
export function getCharacterTypeProperties(type) {
  return CHARACTER_TYPES[type] || CHARACTER_TYPES.default
}