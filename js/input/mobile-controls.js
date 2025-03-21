// Mobile controls handling
import { gameState } from "../core/game-state.js"
import { throwApple } from "../entities/apples.js"
import { tryGrabBomb, releaseBomb, detonateAnyBombWithCountdown } from "../entities/bombs.js"
import { tryGrabRock, releaseRock } from "../entities/rocks.js"
import { tryGrabWoodenBox, releaseWoodenBox } from "../entities/wooden-boxes.js" // Import wooden box functions
import { tryGrabEnemy, releaseEnemy } from "../entities/enemies.js"

export function setupMobileControls() {
  if (!detectMobile()) return

  gameState.isMobile = true
  document.querySelector(".mobile-controls").style.display = "block"

  // Check orientation
  checkOrientation()

  // Only add orientation listener once
  if (!window.hasOrientationListener) {
    window.addEventListener("resize", checkOrientation)
    window.hasOrientationListener = true
  }

  // Dismiss warning button - only set once
  if (!window.hasDismissWarningListener) {
    document.getElementById("dismissWarning").addEventListener("click", () => {
      document.querySelector(".portrait-warning").style.display = "none"
    })
    window.hasDismissWarningListener = true
  }

  const joystickContainer = document.querySelector(".joystick-container")
  const joystickKnob = document.querySelector(".joystick-knob")
  const buttonA = document.querySelector(".button-a")
  const buttonB = document.querySelector(".button-b")

  // Get joystick container position
  const joystickRect = joystickContainer.getBoundingClientRect()
  gameState.joystickOrigin = {
    x: joystickRect.left + joystickRect.width / 2,
    y: joystickRect.top + joystickRect.height / 2,
  }

  // Initialize touch tracking
  if (!gameState.touchTracker) {
    gameState.touchTracker = {
      joystickTouchId: null,
      buttonATouchId: null,
      buttonBTouchId: null,
    }
  }

  // Remove existing touch listeners to prevent duplicates
  joystickContainer.removeEventListener("touchstart", handleJoystickStart)
  document.removeEventListener("touchmove", handleJoystickMove)
  document.removeEventListener("touchend", handleJoystickEnd)
  document.removeEventListener("touchcancel", handleJoystickEnd)
  buttonA.removeEventListener("touchstart", handleButtonAStart)
  buttonA.removeEventListener("touchend", handleButtonAEnd)
  buttonA.removeEventListener("touchcancel", handleButtonAEnd)
  buttonB.removeEventListener("touchstart", handleButtonBStart)
  buttonB.removeEventListener("touchend", handleButtonBEnd)
  buttonB.removeEventListener("touchcancel", handleButtonBEnd)

  // Joystick touch events
  joystickContainer.addEventListener("touchstart", handleJoystickStart)
  document.addEventListener("touchmove", handleJoystickMove)
  document.addEventListener("touchend", handleJoystickEnd)
  document.addEventListener("touchcancel", handleJoystickEnd)

  // Button A (grab/release) touch events
  buttonA.addEventListener("touchstart", handleButtonAStart)
  buttonA.addEventListener("touchend", handleButtonAEnd)
  buttonA.addEventListener("touchcancel", handleButtonAEnd)

  // Button B (throw apple or detonate bomb) touch events
  buttonB.addEventListener("touchstart", handleButtonBStart)
  buttonB.addEventListener("touchend", handleButtonBEnd)
  buttonB.addEventListener("touchcancel", handleButtonBEnd)
}

// In the handleButtonAStart function, include wooden box interactions
export function handleButtonAStart(e) {
  e.preventDefault()
  e.stopPropagation()

  // Store the touch identifier for button A
  const touch = e.changedTouches[0]
  gameState.touchTracker.buttonATouchId = touch.identifier

  gameState.buttonAActive = true
  e.target.classList.add("button-active")

  // First try to detonate any bomb with countdown
  if (!detonateAnyBombWithCountdown()) {
    // If no bomb to detonate, then try grab/release actions
    if (gameState.isGrabbing) {
      // If holding something, release it
      if (gameState.grabbedBomb) {
        releaseBomb()
      } else if (gameState.grabbedRock) {
        releaseRock()
      } else if (gameState.grabbedWoodenBox) {
        releaseWoodenBox()
      } else if (gameState.grabbedEnemy) {
        releaseEnemy()
      }
    } else {
      // If not holding anything, try to grab a bomb
      if (!tryGrabBomb()) {
        // If no bomb to grab, try to grab a wooden box
        if (!tryGrabWoodenBox()) {
          // If no wooden box to grab, try to grab a rock
          if (!tryGrabRock()) {
            // If no rock to grab, try to grab an enemy
            tryGrabEnemy()
          }
        }
      }
    }
  }
}

// Other existing mobile control functions remain unchanged
export function handleButtonAEnd(e) {
  // Check if this is the button A touch ending
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]

    if (touch.identifier === gameState.touchTracker.buttonATouchId) {
      gameState.buttonAActive = false
      e.target.classList.remove("button-active")
      gameState.touchTracker.buttonATouchId = null
      return
    }
  }
}

// Button B handlers
export function handleButtonBStart(e) {
  e.preventDefault()
  e.stopPropagation()

  // Store the touch identifier for button B
  const touch = e.changedTouches[0]
  gameState.touchTracker.buttonBTouchId = touch.identifier

  gameState.buttonBActive = true
  e.target.classList.add("button-active")

  // Button B is now only for throwing apples
  throwApple()
}

export function handleButtonBEnd(e) {
  // Check if this is the button B touch ending
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]

    if (touch.identifier === gameState.touchTracker.buttonBTouchId) {
      gameState.buttonBActive = false
      e.target.classList.remove("button-active")
      gameState.touchTracker.buttonBTouchId = null
      return
    }
  }
}

// Update joystick position and calculate angle/distance
export function updateJoystickPosition(touch) {
  const joystickContainer = document.querySelector(".joystick-container")
  const joystickKnob = document.querySelector(".joystick-knob")
  const containerRect = joystickContainer.getBoundingClientRect()

  gameState.joystickOrigin = {
    x: containerRect.left + containerRect.width / 2,
    y: containerRect.top + containerRect.height / 2,
  }

  const touchX = touch.clientX
  const touchY = touch.clientY

  // Calculate distance from center
  const deltaX = touchX - gameState.joystickOrigin.x
  const deltaY = touchY - gameState.joystickOrigin.y
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  // Limit distance to joystick radius
  const maxDistance = containerRect.width / 2
  const limitedDistance = Math.min(distance, maxDistance)

  // Calculate angle
  gameState.joystickAngle = Math.atan2(deltaY, deltaX)
  gameState.joystickDistance = limitedDistance / maxDistance // Normalize to 0-1

  // Calculate limited position
  const limitedX = Math.cos(gameState.joystickAngle) * limitedDistance
  const limitedY = Math.sin(gameState.joystickAngle) * limitedDistance

  // Update knob position with proper centering
  joystickKnob.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`
}

export function checkOrientation() {
  if (window.innerHeight > window.innerWidth) {
    // Portrait mode is correct
    document.querySelector(".portrait-warning").style.display = "none"
  } else {
    // Landscape mode - show warning
    document.querySelector(".portrait-warning").style.display = "flex"
  }
}

export function detectMobile() {
  return (
    navigator.userAgent.match(/Android/i) ||
    navigator.userAgent.match(/webOS/i) ||
    navigator.userAgent.match(/iPhone/i) ||
    navigator.userAgent.match(/iPad/i) ||
    navigator.userAgent.match(/iPod/i) ||
    navigator.userAgent.match(/BlackBerry/i) ||
    navigator.userAgent.match(/Windows Phone/i)
  )
}

// Joystick handlers
export function handleJoystickStart(e) {
  e.preventDefault()

  // Store the touch identifier for this joystick interaction
  const touch = e.changedTouches[0]
  gameState.touchTracker.joystickTouchId = touch.identifier

  // Activate joystick
  gameState.joystickActive = true

  // Update joystick position
  updateJoystickPosition(touch)
}

export function handleJoystickMove(e) {
  // If joystick is not active, ignore move events
  if (!gameState.joystickActive) return

  // Find the touch that matches our stored joystick touch ID
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]

    // Only process the touch that started the joystick
    if (touch.identifier === gameState.touchTracker.joystickTouchId) {
      e.preventDefault()
      updateJoystickPosition(touch)
      return // Exit after processing the joystick touch
    }
  }
}

export function handleJoystickEnd(e) {
  // Check if the joystick touch has ended
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]

    // Only process if this is the joystick touch
    if (touch.identifier === gameState.touchTracker.joystickTouchId) {
      // Reset joystick
      gameState.joystickActive = false
      gameState.touchTracker.joystickTouchId = null

      const joystickKnob = document.querySelector(".joystick-knob")
      joystickKnob.style.transform = "translate(-50%, -50%)"
      gameState.joystickAngle = 0
      gameState.joystickDistance = 0
      return // Exit after processing the joystick touch
    }
  }
}
