// Mobile controls handling
import { gameState } from "../core/game-state.js"
import { throwApple } from "../entities/apples.js"
import { tryGrabBomb, releaseBomb, detonateAnyBombWithCountdown } from "../entities/bombs.js"
import { tryGrabRock, releaseRock } from "../entities/rocks.js"

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

  // Remove existing touch listeners to prevent duplicates
  joystickContainer.removeEventListener("touchstart", handleJoystickStart)
  document.removeEventListener("touchmove", handleJoystickMove)
  document.removeEventListener("touchend", handleJoystickEnd)
  buttonA.removeEventListener("touchstart", handleButtonAStart)
  buttonA.removeEventListener("touchend", handleButtonAEnd)
  buttonB.removeEventListener("touchstart", handleButtonBStart)
  buttonB.removeEventListener("touchend", handleButtonBEnd)

  // Joystick touch events
  joystickContainer.addEventListener("touchstart", handleJoystickStart)
  document.addEventListener("touchmove", handleJoystickMove)
  document.addEventListener("touchend", handleJoystickEnd)

  // Button A (grab/release) touch events
  buttonA.addEventListener("touchstart", handleButtonAStart)
  buttonA.addEventListener("touchend", handleButtonAEnd)

  // Button B (throw apple or detonate bomb) touch events
  buttonB.addEventListener("touchstart", handleButtonBStart)
  buttonB.addEventListener("touchend", handleButtonBEnd)
}

// Joystick handlers
export function handleJoystickStart(e) {
  e.preventDefault()
  gameState.joystickActive = true
  updateJoystickPosition(e.touches[0])
}

export function handleJoystickMove(e) {
  if (gameState.joystickActive) {
    e.preventDefault()
    updateJoystickPosition(e.touches[0])
  }
}

// Fix the handleJoystickEnd function to only reset joystick when all touches are gone
export function handleJoystickEnd(e) {
  // Only reset joystick if all touches are gone or if the specific touch for the joystick is gone
  let joystickTouchFound = false

  // Check if any of the remaining touches are for the joystick
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i]
    const joystickContainer = document.querySelector(".joystick-container")
    const rect = joystickContainer.getBoundingClientRect()

    // Check if this touch is within the joystick container
    if (
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom
    ) {
      joystickTouchFound = true
      break
    }
  }

  // Only deactivate joystick if no joystick touches remain
  if (!joystickTouchFound) {
    gameState.joystickActive = false
    const joystickKnob = document.querySelector(".joystick-knob")
    joystickKnob.style.transform = "translate(-50%, -50%)"
    gameState.joystickAngle = 0
    gameState.joystickDistance = 0
  }
}

// Button A handlers
export function handleButtonAStart(e) {
  // Only stop propagation, don't prevent default to allow joystick to work simultaneously
  e.stopPropagation()

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
      }
    } else {
      // If not holding anything, try to grab a bomb
      if (!tryGrabBomb()) {
        // If no bomb to grab, try to grab a rock
        tryGrabRock()
      }
    }
  }
}

export function handleButtonAEnd(e) {
  gameState.buttonAActive = false
  e.target.classList.remove("button-active")
}

// Button B handlers
export function handleButtonBStart(e) {
  // Only stop propagation, don't prevent default to allow joystick to work simultaneously
  e.stopPropagation()

  gameState.buttonBActive = true
  e.target.classList.add("button-active")

  // Button B is now only for throwing apples
  throwApple()
}

export function handleButtonBEnd(e) {
  gameState.buttonBActive = false
  e.target.classList.remove("button-active")
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
  // First translate to center, then apply the offset
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

