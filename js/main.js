// Main entry point for the game
import { createDefaultGameConfig } from "./core/game.js"
import "./core/polyfills.js"
import { initializeStartMenu, showStartMenu } from "./ui/start-menu.js"

// Initialize the game when the page loads
window.addEventListener("load", () => {
	initializeStartMenu(createDefaultGameConfig())
	showStartMenu()
})