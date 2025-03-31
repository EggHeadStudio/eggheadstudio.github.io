// Car entity
import { gameState } from "../core/game-state.js"
import { getDistance } from "../utils/math-utils.js"
import { TILE_SIZE, TERRAIN_TYPES, CAR_COUNT } from "../core/constants.js"

// Car constants
export const CAR_SIZE = 65
export const CAR_MAX_SPEED = 8 // Maximum car speed
export const CAR_ACCELERATION = 0.25 // How quickly the car speeds up
export const CAR_DECELERATION = 0.2 // How quickly the car slows down
export const CAR_DRIFT_FACTOR = 0.85 // How much the car drifts (lower = more drift)
export const CAR_INTERACTION_RANGE = 80
export const CAR_MAX_HEALTH = 3

// Generate initial cars
export function generateCars(count, spawnNearPlayer = false) {
  const { canvas, terrain, player, rocks, woodenBoxes, bombs } = gameState
  
  // Initialize cars array if it doesn't exist
  if (!gameState.cars) {
    gameState.cars = []
  }

  // If we already have the maximum number of cars, don't spawn more
  if (gameState.cars.length >= CAR_COUNT) {
    return;
  }

  // Calculate how many cars to actually spawn based on the limit
  const carsToSpawn = Math.min(count, CAR_COUNT - gameState.cars.length);
  
  // Handle spawning a car near the player if requested
  if (spawnNearPlayer && player && carsToSpawn > 0) {
    let validPosition = false;
    let x, y, tileX, tileY;
    let attempts = 0;
    
    // Find a position near player
    while (!validPosition && attempts < 50) {
      attempts++;
      
      // Random angle around player
      const angle = Math.random() * Math.PI * 2;
      // Distance from player (200-400 pixels)
      const distance = 200 + Math.random() * 200;
      
      x = player.x + Math.cos(angle) * distance;
      y = player.y + Math.sin(angle) * distance;
      
      tileX = Math.floor(x / TILE_SIZE);
      tileY = Math.floor(y / TILE_SIZE);
      
      // Check if position is valid
      if (isValidCarPosition(x, y, tileX, tileY, terrain, rocks, woodenBoxes, bombs, gameState.cars)) {
        validPosition = true;
      }
    }
    
    if (validPosition) {
      // Create a car near player
      gameState.cars.push({
        x,
        y,
        size: CAR_SIZE,
        health: CAR_MAX_HEALTH,
        lastHit: 0,
        direction: Math.random() * Math.PI * 2, // Random direction
        wheelRotation: 0,
        animationTime: 0,
        dustParticles: [],
        velocity: {x: 0, y: 0},  // Add velocity property
        currentSpeed: 0          // Current scalar speed
      });
      
      // Reduce the count for remaining cars to spawn
      count = carsToSpawn - 1;
    }
  }
  
  // Generate remaining cars
  for (let i = 0; i < carsToSpawn; i++) {
    // Find a valid position for the car on grass or dirt
    let validPosition = false;
    let x, y, tileX, tileY;
    let attempts = 0;
    
    while (!validPosition && attempts < 50) {
      attempts++;
      
      // Random position within a larger world area
      x = Math.random() * canvas.width * 4;
      y = Math.random() * canvas.height * 4;
      
      tileX = Math.floor(x / TILE_SIZE);
      tileY = Math.floor(y / TILE_SIZE);
      
      // Ensure cars are well-spaced (at least 500 pixels apart)
      if (isValidCarPosition(x, y, tileX, tileY, terrain, rocks, woodenBoxes, bombs, gameState.cars, 500)) {
        validPosition = true;
      }
    }
    
    if (validPosition) {
      // Create a new car
      gameState.cars.push({
        x,
        y,
        size: CAR_SIZE,
        health: CAR_MAX_HEALTH,
        lastHit: 0,
        direction: Math.random() * Math.PI * 2, // Random direction
        wheelRotation: 0,
        animationTime: 0,
        dustParticles: [],
        velocity: {x: 0, y: 0},  // Add velocity property
        currentSpeed: 0          // Current scalar speed
      });
    }
  }
}

// Helper function to check if a position is valid for a car
function isValidCarPosition(x, y, tileX, tileY, terrain, rocks, woodenBoxes, bombs, cars, minDistanceToOtherCars = 300) {
  // Check if off map
  if (tileX < 0 || tileX >= terrain[0].length || tileY < 0 || tileY >= terrain.length) {
    return false;
  }
  
  // Check terrain (must be on grass or dirt)
  if (terrain[tileY][tileX] !== TERRAIN_TYPES.GRASS && terrain[tileY][tileX] !== TERRAIN_TYPES.DIRT) {
    return false;
  }
  
  // Check distance to other cars
  for (const car of cars) {
    if (getDistance(x, y, car.x, car.y) < minDistanceToOtherCars) {
      return false;
    }
  }
  
  // Check collision with rocks
  for (const rock of rocks) {
    if (getDistance(x, y, rock.x, rock.y) < CAR_SIZE + rock.size) {
      return false;
    }
  }
  
  // Check collision with wooden boxes
  if (woodenBoxes) {
    for (const box of woodenBoxes) {
      if (getDistance(x, y, box.x, box.y) < CAR_SIZE + box.size) {
        return false;
      }
    }
  }
  
  // Check collision with bombs
  if (bombs) {
    for (const bomb of bombs) {
      if (getDistance(x, y, bomb.x, bomb.y) < CAR_SIZE + bomb.size) {
        return false;
      }
    }
  }
  
  return true;
}

// Update car position when player is driving
export function updateCarPosition(car) {
  const { player, keys, terrain, rocks, woodenBoxes, isMobile, joystickActive, joystickAngle, joystickDistance } = gameState
  
  // Store previous direction and position to calculate drift
  const previousDirection = car.direction;
  const previousX = car.x;
  const previousY = car.y;

  // Calculate the input direction
  let inputX = 0;
  let inputY = 0;
  let isAccelerating = false;

  if (isMobile && joystickActive) {
    // Mobile controls - use joystick input
    inputX = Math.cos(joystickAngle) * joystickDistance;
    inputY = Math.sin(joystickAngle) * joystickDistance;
    isAccelerating = joystickDistance > 0.1; // Accelerate if joystick is moved
  } else {
    // Desktop controls - only move forward in the direction of the mouse
    const isMovingForward = keys["ArrowUp"] || keys["w"];
    const isMovingBackward = keys["ArrowDown"] || keys["s"];

    if (isMovingForward || isMovingBackward) {
      // Move in the direction the player is facing (mouse direction)
      const directionMultiplier = isMovingForward ? 1 : -0.7; // Slower in reverse
      inputX = Math.cos(player.direction) * directionMultiplier;
      inputY = Math.sin(player.direction) * directionMultiplier;
      isAccelerating = true;
    }
  }

  // Update car direction to match player direction (with some smoothing)
  const directionDifference = normalizeAngle(player.direction - car.direction);
  const turnSpeed = Math.min(0.1 + (car.currentSpeed / CAR_MAX_SPEED) * 0.1, 0.2); // Faster turning at higher speeds, capped
  car.direction += directionDifference * turnSpeed;
  
  // Calculate direction change for steering wheel animation
  gameState.carDirectionChange = directionDifference;

  // Update car speed with acceleration/deceleration
  if (isAccelerating) {
    // Accelerate
    car.currentSpeed = Math.min(car.currentSpeed + CAR_ACCELERATION, CAR_MAX_SPEED);
  } else {
    // Decelerate
    car.currentSpeed = Math.max(car.currentSpeed - CAR_DECELERATION, 0);
  }
  
  // Update wheel animation time when car is moving
  if (car.currentSpeed > 0.1) {
    // Simple animation timing based on speed
    car.wheelAnimationTime = (car.wheelAnimationTime || 0) + 0.1 * car.currentSpeed;
    if (car.wheelAnimationTime > 1) car.wheelAnimationTime -= 1; // Loop between 0-1
  }

  // Calculate forward movement vector based on car's direction
  const forwardX = Math.cos(car.direction);
  const forwardY = Math.sin(car.direction);
  
  // Calculate perpendicular vector for drift (sideways movement)
  const sideX = Math.cos(car.direction + Math.PI/2);
  const sideY = Math.sin(car.direction + Math.PI/2);
  
  // Calculate how much the car is turning for drift calculation
  const turningAmount = Math.abs(directionDifference) * 2;
  
  // Current velocity with some conservation (drift)
  if (car.velocity) {
    // Keep some of the previous velocity (drift effect)
    const driftInfluence = Math.min(turningAmount, 0.5); // Maximum 50% drift influence
    
    // Direction of drift (determined by turning)
    const driftDirection = directionDifference > 0 ? 1 : -1;
    
    // Forward component
    car.velocity.x = forwardX * car.currentSpeed;
    car.velocity.y = forwardY * car.currentSpeed;
    
    // Add sideways component when turning (drift effect)
    if (car.currentSpeed > 1 && Math.abs(directionDifference) > 0.02) {
      car.velocity.x += sideX * driftDirection * driftInfluence * car.currentSpeed * (1 - CAR_DRIFT_FACTOR);
      car.velocity.y += sideY * driftDirection * driftInfluence * car.currentSpeed * (1 - CAR_DRIFT_FACTOR);
    }
  } else {
    // Initialize velocity if it doesn't exist
    car.velocity = {
      x: forwardX * car.currentSpeed,
      y: forwardY * car.currentSpeed
    };
  }

  // Animation state
  if (car.currentSpeed > 0.5) {
    // Car is moving, update wheel rotation and animation
    car.isMoving = true;
    car.wheelRotation += 0.2 * car.currentSpeed; // Rotate wheels based on speed
    
    // Generate dust particles when car is moving (more when drifting)
    const particleChance = 0.3 + (turningAmount * car.currentSpeed / CAR_MAX_SPEED) * 0.5;
    if (Math.random() < particleChance) {
      const angle = car.direction + Math.PI + (Math.random() - 0.5); // Behind the car with some variation
      const distanceFromCar = car.size * 0.7;
      const offsetX = Math.cos(angle) * distanceFromCar;
      const offsetY = Math.sin(angle) * distanceFromCar;
      
      car.dustParticles.push({
        x: car.x + offsetX,
        y: car.y + offsetY,
        size: 5 + Math.random() * 8,
        alpha: 0.7,
        life: 1.0, // Full life
        speed: {
          // Add some velocity in the direction of car movement
          x: Math.random() * 1 - 0.5 - car.velocity.x * 0.1,
          y: Math.random() * 1 - 0.5 - car.velocity.y * 0.1
        }
      });
    }
  } else {
    car.isMoving = false;
  }
  
  // Update dust particles
  for (let i = car.dustParticles.length - 1; i >= 0; i--) {
    const particle = car.dustParticles[i];
    particle.x += particle.speed.x;
    particle.y += particle.speed.y;
    particle.alpha -= 0.02;
    particle.life -= 0.03;
    particle.size -= 0.1;
    
    // Remove dead particles
    if (particle.life <= 0 || particle.size <= 0) {
      car.dustParticles.splice(i, 1);
    }
  }
  
  // Check if new position would be on water or collide with objects
  const newX = car.x + car.velocity.x;
  const newY = car.y + car.velocity.y;
  const tileX = Math.floor(newX / TILE_SIZE);
  const tileY = Math.floor(newY / TILE_SIZE);

  // Move car if possible
  if (isValidPositionForMovingCar(newX, newY, tileX, tileY, car)) {
    car.x = newX;
    car.y = newY;
    
    // Move player with car
    player.x = car.x;
    player.y = car.y;
  } else {
    // Collision occurred, reduce speed
    car.currentSpeed *= 0.5;
    car.velocity.x *= 0.5;
    car.velocity.y *= 0.5;
  }
}

// Helper function to check if a position is valid for a moving car
function isValidPositionForMovingCar(x, y, tileX, tileY, car) {
  const { terrain, rocks, woodenBoxes, bombs, cars } = gameState;
  
  // Check if off map
  if (tileX < 0 || tileX >= terrain[0].length || tileY < 0 || tileY >= terrain.length) {
    return false;
  }
  
  // Check terrain (must not be water)
  if (terrain[tileY][tileX] === TERRAIN_TYPES.WATER) {
    return false;
  }
  
  // Check collision with rocks
  for (const rock of rocks) {
    if (getDistance(x, y, rock.x, rock.y) < car.size + rock.size * 0.8) {
      return false;
    }
  }
  
  // Check collision with wooden boxes
  if (woodenBoxes) {
    for (const box of woodenBoxes) {
      if (getDistance(x, y, box.x, box.y) < car.size + box.size * 0.8) {
        return false;
      }
    }
  }
  
  // Check collision with other cars
  if (cars) {
    for (const otherCar of cars) {
      // Skip the car being driven
      if (otherCar === car) continue;
      
      if (getDistance(x, y, otherCar.x, otherCar.y) < car.size + otherCar.size * 0.8) {
        return false;
      }
    }
  }
  
  return true;
}

// Helper function to normalize an angle difference to between -PI and PI
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// Check for player-car interactions
export function checkCarInteraction() {
  const { player, cars, isInCar, drivingCar, keys } = gameState
  
  // If player is not in a car, check if they can enter one
  if (!isInCar) {
    for (const car of cars) {
      const distance = getDistance(player.x, player.y, car.x, car.y)
      
      if (distance < CAR_INTERACTION_RANGE && car.health > 0) {
        // Player is close enough to interact with the car
        return car; // Return the car that can be interacted with
      }
    }
  }
  
  return null; // No car in range
}

// Enter car
export function enterCar(car) {
  if (!car || gameState.isInCar) return;
  
  gameState.isInCar = true;
  gameState.drivingCar = car;
  
  // Update player position to car position
  gameState.player.x = car.x;
  gameState.player.y = car.y;
}

// Exit car
export function exitCar() {
  if (!gameState.isInCar || !gameState.drivingCar) return;
  
  const car = gameState.drivingCar;
  
  // Position player next to the car in the direction it's facing
  const exitAngle = car.direction + Math.PI / 2; // 90 degrees to the right of car direction
  const exitDistance = car.size + gameState.player.size / 2;
  
  gameState.player.x = car.x + Math.cos(exitAngle) * exitDistance;
  gameState.player.y = car.y + Math.sin(exitAngle) * exitDistance;
  
  // Reset car-related state
  gameState.isInCar = false;
  gameState.drivingCar = null;
}

// Damage car
export function damageCar(car) {
  // Only apply damage if not recently hit
  if (Date.now() - car.lastHit < 1000) return;
  
  car.health--;
  car.lastHit = Date.now();
  
  // Create hit effect
  if (!gameState.hitEffects) {
    gameState.hitEffects = [];
  }
  
  gameState.hitEffects.push({
    x: car.x,
    y: car.y,
    size: car.size * 1.2,
    createdAt: Date.now(),
    duration: 200,
  });
  
  // Check if car is destroyed
  if (car.health <= 0) {
    destroyCar(car);
  }
}

// Destroy car
export function destroyCar(car) {
  // If player is in this car, eject them
  if (gameState.isInCar && gameState.drivingCar === car) {
    exitCar();
  }
  
  // Create explosion effect (smaller than bombs)
  if (!gameState.explosions) {
    gameState.explosions = [];
  }
  
  gameState.explosions.push({
    x: car.x,
    y: car.y,
    size: car.size * 2,
    maxSize: car.size * 3,
    alpha: 1,
    createdAt: Date.now(),
  });
  
  // Remove car from the game
  const carIndex = gameState.cars.indexOf(car);
  if (carIndex !== -1) {
    gameState.cars.splice(carIndex, 1);
    
    // Spawn a new car in a random location after a short delay
    setTimeout(() => {
      generateCars(1, false);
    }, 3000); // Wait 3 seconds before spawning a new car
  }
}

// Draw and update cars
export function drawAndUpdateCars() {
  const { ctx, cars, camera, isInCar, drivingCar, player } = gameState;
  
  if (!cars) return;
  
  for (const car of cars) {
    // Skip update for cars that are not being driven
    if (isInCar && drivingCar === car) {
      // Update position for the car being driven
      updateCarPosition(car);
    } else if (car.isMoving || car.currentSpeed > 0) {
      // For non-driven cars that are moving, just update animation
      car.wheelAnimationTime = (car.wheelAnimationTime || 0) + 0.05;
      if (car.wheelAnimationTime > 1) car.wheelAnimationTime -= 1;
    }
    
    // Calculate screen position
    const screenX = car.x - camera.x;
    const screenY = car.y - camera.y;
    
    // Only draw if on screen
    if (
      screenX + car.size < 0 ||
      screenX - car.size > ctx.canvas.width ||
      screenY + car.size < 0 ||
      screenY - car.size > ctx.canvas.height
    ) {
      continue;
    }
    
    // Draw dust particles behind the car
    for (const particle of car.dustParticles) {
      ctx.save();
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = '#b39b7d'; // Dust color
      ctx.beginPath();
      ctx.arc(
        particle.x - camera.x,
        particle.y - camera.y,
        particle.size,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
    
    // Draw car shadow - more square-shaped with feathered edges
    ctx.save();
    const shadowWidth = car.size * 1.3;
    const shadowHeight = car.size * 0.8;
    
    // Create a gradient for feathered shadow effect
    const shadowGradient = ctx.createRadialGradient(
      screenX + 5, screenY + 5, 0,
      screenX + 5, screenY + 5, shadowWidth
    );
    shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.15)');   // More translucent
    shadowGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)'); // Fade out
    shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');      // Fully transparent
    
    ctx.translate(screenX + 5, screenY + 5);
    ctx.rotate(car.direction);
    
    // Draw a rounded rect for shadow
    ctx.fillStyle = shadowGradient;
    ctx.beginPath();
    ctx.roundRect(-shadowWidth/2, -shadowHeight/2, shadowWidth, shadowHeight, 8);
    ctx.fill();
    
    ctx.restore();
    
    // Draw car body based on health
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(car.direction);
    
    // Store current car being drawn so the wheel animation can use it
    ctx._currentDrawingCar = car;

    // Draw car body
    if (car.health === CAR_MAX_HEALTH) {
      // Undamaged car
      drawCarBody(ctx, 0, 0, car.size, '#587e55');
    } else if (car.health === 2) {
      // Slightly damaged car
      drawDamagedCarBody(ctx, 0, 0, car.size, '#587e55', 1);
    } else if (car.health === 1) {
      // Heavily damaged car
      drawDamagedCarBody(ctx, 0, 0, car.size, '#587e55', 2);
    }
    
    // Draw wheels as blocks with 90 degree orientation
    const wheelWidth = car.size * 0.25;
    const wheelHeight = car.size * 0.35;
    const wheelOffsetX = car.size * 0.5;
    const wheelOffsetY = car.size * 0.4;
    
    // Draw wheels as rounded rectangles to look like blocks from above
    drawBlockWheel(ctx, -wheelOffsetX, -wheelOffsetY, wheelWidth, wheelHeight, Math.PI/2);
    drawBlockWheel(ctx, -wheelOffsetX, wheelOffsetY, wheelWidth, wheelHeight, Math.PI/2);
    drawBlockWheel(ctx, wheelOffsetX, -wheelOffsetY, wheelWidth, wheelHeight, Math.PI/2);
    drawBlockWheel(ctx, wheelOffsetX, wheelOffsetY, wheelWidth, wheelHeight, Math.PI/2);
    
    // Clear the reference to avoid affecting other drawings
    ctx._currentDrawingCar = null;

    ctx.restore();
    
    // If player is near this car and not in a car, draw interaction prompt
    if (!isInCar && car.health > 0) {
      const distance = getDistance(player.x, player.y, car.x, car.y);
      
      if (distance < CAR_INTERACTION_RANGE) {
        // Draw interaction prompt
        ctx.save();
        ctx.font = '16px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText('Press SPACE to enter', screenX, screenY - car.size - 10);
        ctx.restore();
      }
    }
  }
}

// Helper function to draw car body
function drawCarBody(ctx, x, y, size, color) {
  const width = size * 1.5;
  const height = size * 0.9;
  
  // Car body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, 10);
  ctx.fill();
  
  // Car roof (slightly smaller)
  ctx.fillStyle = '#3c5939';
  const roofWidth = width * 0.7;
  const roofHeight = height * 0.6;
  ctx.beginPath();
  ctx.roundRect(x - roofWidth / 2, y - roofHeight / 2, roofWidth, roofHeight, 6);
  ctx.fill();
  
  // Windshield
  ctx.fillStyle = '#96b4c1';
  ctx.beginPath();
  ctx.arc(x - width * 0.1, y, roofHeight * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// Helper function to draw damaged car body
function drawDamagedCarBody(ctx, x, y, size, color, damageLevel) {
  const width = size * 1.5;
  const height = size * 0.9;
  
  // Car body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, 10);
  ctx.fill();
  
  // Car roof (slightly smaller)
  ctx.fillStyle = '#3c5939';
  const roofWidth = width * 0.7;
  const roofHeight = height * 0.6;
  ctx.beginPath();
  ctx.roundRect(x - roofWidth / 2, y - roofHeight / 2, roofWidth, roofHeight, 6);
  ctx.fill();
  
  // Windshield
  ctx.fillStyle = '#96b4c1';
  ctx.beginPath();
  ctx.arc(x - width * 0.1, y, roofHeight * 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Damage scratches and dents
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  
  // Different damage patterns based on damage level
  if (damageLevel >= 1) {
    // First damage level: Some scratches and dents
    ctx.beginPath();
    ctx.moveTo(x - width * 0.3, y - height * 0.4);
    ctx.lineTo(x - width * 0.1, y - height * 0.2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(x + width * 0.2, y + height * 0.2, size * 0.1, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  if (damageLevel >= 2) {
    // Second damage level: More damage and smoke
    ctx.beginPath();
    ctx.moveTo(x + width * 0.3, y - height * 0.3);
    ctx.lineTo(x + width * 0.1, y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x - width * 0.4, y + height * 0.3);
    ctx.lineTo(x - width * 0.2, y + height * 0.1);
    ctx.stroke();
    
    // Draw smoke effect
    for (let i = 0; i < 3; i++) {
      const smokeX = x + width * 0.4;
      const smokeY = y - height * 0.1;
      const smokeSize = (Math.sin(Date.now() / 200 + i) + 1) * 5 + 3;
      
      ctx.globalAlpha = 0.6 - i * 0.15;
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.arc(smokeX, smokeY - i * 8, smokeSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// New helper function to draw block-like wheels as seen from above
function drawBlockWheel(ctx, x, y, width, height, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation); // Keep the original rotation
  
  // Wheel base (dark color)
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.roundRect(-width/2, -height/2, width, height, 3);
  ctx.fill();
  
  // Get the current car being drawn
  const car = ctx._currentDrawingCar || { wheelAnimationTime: 0 };
  
  // Determine which pattern to show based on animation time
  const showAlternatePattern = car.wheelAnimationTime && car.wheelAnimationTime > 0.5;
  
  // Wheel tread pattern (lighter color)
  ctx.fillStyle = '#555';
  
  // Draw tread pattern based on animation state
  if (showAlternatePattern) {
    // Alternate pattern: Two tread lines
    const treadHeight = height / 5;
    
    // Top tread
    ctx.beginPath();
    ctx.roundRect(-width/2 + 2, -height/2 + 4, width - 4, treadHeight, 1);
    ctx.fill();
    
    // Bottom tread
    ctx.beginPath();
    ctx.roundRect(-width/2 + 2, height/2 - treadHeight - 4, width - 4, treadHeight, 1);
    ctx.fill();
  } else {
    // Regular pattern: Three evenly spaced tread lines
    const treadCount = 3;
    const treadHeight = height / (treadCount * 2 - 1);
    
    for (let i = 0; i < treadCount; i++) {
      ctx.beginPath();
      const yPos = -height/2 + i * treadHeight * 2;
      ctx.roundRect(-width/2 + 2, yPos, width - 4, treadHeight, 1);
      ctx.fill();
    }
  }
  
  ctx.restore();
} 
