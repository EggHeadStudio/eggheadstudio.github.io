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
  },

  // Example of another character type
  strong: {
    size: PLAYER_SIZE * 1.2,
    speed: PLAYER_SPEED * 0.8,
    health: 4,
    color: "#e74c3c",
    strength: 1.5,
    handColor: "#BBBBBB",
    footColor: "#333333",
    backpackColor: "#654321",
    backpackPocketColor: "#8B4513",
  },

  // Example of a fast character
  scout: {
    size: PLAYER_SIZE * 0.9,
    speed: PLAYER_SPEED * 1.3,
    health: 2,
    color: "#2ecc71",
    strength: 0.7,
    handColor: "#CCCCCC",
    footColor: "#555555",
    backpackColor: "#556B2F",
    backpackPocketColor: "#6B8E23",
  },
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

  // Merge base properties with custom properties
  return {
    ...baseCharacter,
    ...customProps,
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

/**
 * Gets the properties of a specific character type
 * @param {string} type - The character type
 * @returns {object} The character type properties
 */
export function getCharacterTypeProperties(type) {
  return CHARACTER_TYPES[type] || CHARACTER_TYPES.default
}
