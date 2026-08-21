// Character factory for creating different character types
import { PLAYER_SIZE, PLAYER_SPEED } from "../core/constants.js"

// Character types with their default properties
const CHARACTER_TYPES = {
  default: {
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#3498db",
    strength: 1.0,
    handColor: "#AAAAAA",
    footColor: "#444444",
    backpackColor: "#8B4513",
    backpackPocketColor: "#A0522D",
    hairStyle: "none",
    hairColor: "#2d2d2d",
  },

  rasse: {
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#3498db",
    strength: 1.0,
    handColor: "#AAAAAA",
    footColor: "#444444",
    backpackColor: "#8B4513",
    backpackPocketColor: "#A0522D",
    hairStyle: "mohawk",
    hairColor: "#c58c12",
  },

  iida: {
    size: PLAYER_SIZE,
    speed: PLAYER_SPEED,
    health: 3,
    color: "#3498db",
    strength: 1.0,
    handColor: "#AAAAAA",
    footColor: "#444444",
    backpackColor: "#8B4513",
    backpackPocketColor: "#A0522D",
    hairStyle: "long",
    hairColor: "#b07910",
    hasGlasses: true,
    glassesColor: "#2b2b2b",
  },
}

const SELECTABLE_CHARACTER_TYPES = ["default", "rasse", "iida"]

const CHARACTER_DISPLAY_LABELS = {
  default: "Bold",
  rasse: "Rasse",
  iida: "Iida",
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

export function normalizeCharacterCustomization(customization = {}, type = "default") {
  const baseCharacter = CHARACTER_TYPES[type] || CHARACTER_TYPES.default

  return {
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
    throwingApple: null, // Add throwing apple animation state
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