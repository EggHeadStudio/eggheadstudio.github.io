// Main entry point for the game
import { init } from "./core/game.js"
import "./core/polyfills.js"

// Initialize the game when the page loads
window.addEventListener("load", init)