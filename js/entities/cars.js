// Car entity
import { gameState } from "../core/game-state.js"
import { getDistance } from "../utils/math-utils.js"
import {
  TILE_SIZE,
  TERRAIN_TYPES,
  CAR_SIZE as CAR_SIZE_CONST,
  CAR_INTERACTION_RANGE as CAR_INTERACTION_RANGE_CONST,
  CAR_MAX_HEALTH as CAR_MAX_HEALTH_CONST,
  CAR_MAX_SPEED as CAR_MAX_SPEED_CONST,
  CAR_ACCELERATION as CAR_ACCELERATION_CONST,
  CAR_DECELERATION as CAR_DECELERATION_CONST,
  CAR_COUNT,
  MAX_CARS,
  CAR_FUEL_MIN,
  CAR_FUEL_MAX,
  CAR_FUEL_DRAIN_FORWARD,
  CAR_DRIFT_FACTOR,
  CAR_MAX_STEER_ANGLE,
  CAR_STEER_SPEED,
  CAR_FRONT_GRIP,
  CAR_REAR_GRIP,
  CAR_FRONT_CORNERING_STIFFNESS,
  CAR_REAR_CORNERING_STIFFNESS,
  CAR_YAW_INERTIA,
  CAR_YAW_DAMPING,
  CAR_STEER_SENSITIVITY_FALLOFF,
  CAR_LATERAL_DRAG,
  CAR_POWER_OVERSTEER,
  VEHICLE_WRECK_DESPAWN_DELAY_MS,
} from "../core/constants.js"
import {
  createVehicleMotion,
  stepVehicleMotion,
  getMotionVelocity,
  dampMotionAfterImpact,
  resetVehicleMotion,
} from "./vehicle-physics.js"
import { findNearestSafePlayerPosition } from "../utils/player-position-utils.js"
import { isSpawnPositionClear } from "../utils/spawn-utils.js"
import { getRandomLoadedWorldPosition } from "../world/world-manager.js"
import { isHoleBlockingCarPosition } from "./shovels.js"
import { isTreeBlocking } from "./trees.js"

// Car constants
export const CAR_SIZE = CAR_SIZE_CONST
export const CAR_MAX_SPEED = CAR_MAX_SPEED_CONST
export const CAR_ACCELERATION = CAR_ACCELERATION_CONST
export const CAR_DECELERATION = CAR_DECELERATION_CONST
export const CAR_INTERACTION_RANGE = CAR_INTERACTION_RANGE_CONST
export const CAR_MAX_HEALTH = CAR_MAX_HEALTH_CONST

// Ground the cars can drive on. Sand and gravel behave like grass.
const DRIVABLE_TERRAIN = [TERRAIN_TYPES.GRASS, TERRAIN_TYPES.DIRT, TERRAIN_TYPES.SAND, TERRAIN_TYPES.GRAVEL]

// Create a single car.
export function createCar(x, y) {
  const fuelCapacity = Math.max(CAR_FUEL_MIN, CAR_FUEL_MAX);
  return {
    x,
    y,
    size: CAR_SIZE,
    health: CAR_MAX_HEALTH,
    lastHit: 0,
    direction: Math.random() * Math.PI * 2, // Random direction
    wheelRotation: 0,
    animationTime: 0,
    dustParticles: [],
    velocity: { x: 0, y: 0 },
    motion: null,
    forwardSpeed: 0,
    lateralSpeed: 0,
    currentSpeed: 0,
    fuelCapacity,
    fuel: getRandomFuelAmount(CAR_FUEL_MIN, CAR_FUEL_MAX),
    isBroken: false,
    wreckCleanupAt: null,
  }
}

// Public position check used by the chunk populator.
export function canPlaceCarAt(x, y, minDistanceToOtherCars = 300) {
  const { terrain, rocks, woodenBoxes, bombs } = gameState
  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)

  return isValidCarPosition(x, y, tileX, tileY, terrain, rocks, woodenBoxes, bombs, gameState.cars || [], minDistanceToOtherCars)
}

// Generate initial cars
export function generateCars(count, spawnNearPlayer = false, options = {}) {
  const { terrain, player, rocks, woodenBoxes, bombs } = gameState
  const { ignoreLimit = false } = options
  
  // Initialize cars array if it doesn't exist
  if (!gameState.cars) {
    gameState.cars = []
  }

  // If we already have the maximum number of cars, don't spawn more
  if (!ignoreLimit && gameState.cars.length >= MAX_CARS) {
    return;
  }

  // Calculate how many cars to actually spawn based on the limit
  const carsToSpawn = ignoreLimit ? count : Math.min(count, MAX_CARS - gameState.cars.length);
  let remainingToSpawn = carsToSpawn;
  
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
      gameState.cars.push(createCar(x, y));

      // The nearby car counts towards the requested total
      remainingToSpawn = carsToSpawn - 1;
    }
  }
  
  // Generate remaining cars
  for (let i = 0; i < remainingToSpawn; i++) {
    // Find a valid position for the car on grass or dirt
    let validPosition = false;
    let x, y, tileX, tileY;
    let attempts = 0;
    
    while (!validPosition && attempts < 50) {
      attempts++;
      
      // Random position inside the streamed area around the player
      const position = getRandomLoadedWorldPosition(300);
      x = position.x;
      y = position.y;
      
      tileX = Math.floor(x / TILE_SIZE);
      tileY = Math.floor(y / TILE_SIZE);
      
      // Ensure cars are well-spaced (at least 500 pixels apart)
      if (isValidCarPosition(x, y, tileX, tileY, terrain, rocks, woodenBoxes, bombs, gameState.cars, 500)) {
        validPosition = true;
      }
    }
    
    if (validPosition) {
      // Create a new car
      gameState.cars.push(createCar(x, y));
    }
  }
}

// Helper function to check if a position is valid for a car
function isValidCarPosition(x, y, tileX, tileY, terrain, rocks, woodenBoxes, bombs, cars, minDistanceToOtherCars = 300) {
  // Check if off map
  if (tileX < 0 || tileX >= terrain[0].length || tileY < 0 || tileY >= terrain.length) {
    return false;
  }
  
  // Check terrain (cars drive on any solid ground, never on water)
  if (!DRIVABLE_TERRAIN.includes(terrain[tileY][tileX])) {
    return false;
  }

  if (!isSpawnPositionClear(x, y, CAR_SIZE, {
    requireLand: true,
    playerDistanceBuffer: 180,
    includeCars: false,
    includeBoats: false,
  })) {
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
  
  let throttleInput = 0;

  if (isMobile) {
    if (gameState.buttonBActive) {
      throttleInput = -0.7;
    } else if (joystickActive) {
      throttleInput = joystickDistance > 0.1 ? Math.min(1, joystickDistance) : 0;
    }
  } else {
    const movingForward = keys["ArrowUp"] || keys["w"];
    const movingBackward = keys["ArrowDown"] || keys["s"];

    if (movingForward) {
      throttleInput = 1;
    } else if (movingBackward) {
      throttleInput = -0.7;
    }
  }

  if (throttleInput !== 0 && (car.fuel ?? 0) <= 0) {
    throttleInput = 0;
  }

  if (throttleInput > 0 && (car.fuel ?? 0) > 0) {
    const mobileDrainScale = isMobile && joystickActive ? Math.max(0.25, joystickDistance) : 1;
    car.fuel = Math.max(0, car.fuel - CAR_FUEL_DRAIN_FORWARD * mobileDrainScale);
  }

  const motion = getCarMotion(car);

  // While nearly stopped, keep the car nose aligned with player facing so
  // forward or reverse can instantly steer out of stuck situations.
  const standstillSpeed = Math.hypot(motion.longitudinalSpeed, motion.lateralSpeed);
  if (standstillSpeed < 0.22) {
    motion.heading = player.direction;
    motion.yawRate = 0;
    car.direction = motion.heading;
  }

  const directionDifference = normalizeAngle(player.direction - motion.heading);

  // The aim direction is a STEERING request, not the car's heading. Pointing
  // away from where the car is sliding is exactly how opposite lock works.
  const steerInput = Math.max(-1, Math.min(1, directionDifference / CAR_MAX_STEER_ANGLE));

  // Assist only near standstill so drift handling at speed stays unchanged.
  const isLowSpeed = Math.hypot(motion.longitudinalSpeed, motion.lateralSpeed) < 1.1;
  if (throttleInput !== 0 && isLowSpeed) {
    motion.heading = normalizeAngle(motion.heading + directionDifference * 0.4);
    motion.yawRate *= 0.35;
    car.direction = motion.heading;
  }

  stepVehicleMotion(
    motion,
    { throttle: throttleInput, steer: steerInput },
    {
      maxSpeed: CAR_MAX_SPEED,
      acceleration: CAR_ACCELERATION,
      braking: CAR_DECELERATION,
      maxSteerAngle: CAR_MAX_STEER_ANGLE,
      steerSpeed: CAR_STEER_SPEED,
      frontAxle: car.size * 0.35,
      rearAxle: car.size * 0.35,
      yawInertia: CAR_YAW_INERTIA,
      frontGrip: CAR_FRONT_GRIP,
      rearGrip: CAR_REAR_GRIP,
      frontStiffness: CAR_FRONT_CORNERING_STIFFNESS,
      rearStiffness: CAR_REAR_CORNERING_STIFFNESS,
      driftFactor: CAR_DRIFT_FACTOR,
      powerOversteer: CAR_POWER_OVERSTEER,
      lateralDrag: CAR_LATERAL_DRAG,
      yawDamping: CAR_YAW_DAMPING,
      steerSpeedSensitivity: CAR_STEER_SENSITIVITY_FALLOFF,
    }
  );

  car.direction = motion.heading;
  if (throttleInput !== 0 && car.currentSpeed < 1.2) {
    const lowSpeedAssistDiff = normalizeAngle(player.direction - car.direction);
    motion.heading = normalizeAngle(motion.heading + lowSpeedAssistDiff * 0.3);
    motion.yawRate *= 0.5;
    car.direction = motion.heading;
  }
  car.forwardSpeed = motion.longitudinalSpeed;
  car.lateralSpeed = motion.lateralSpeed;
  car.currentSpeed = Math.hypot(motion.longitudinalSpeed, motion.lateralSpeed);
  car.slipAngle = motion.slipAngle;
  car.isDrifting = motion.isSliding;

  // Steering wheel visual: report the real steering position, scaled so full
  // lock still shows as a full turn of the wheel.
  gameState.carDirectionChange = (motion.steerAngle / CAR_MAX_STEER_ANGLE) * (Math.PI / 2);

  if (car.currentSpeed > 0.1) {
    car.wheelAnimationTime = (car.wheelAnimationTime || 0) + 0.1 * car.currentSpeed;
    if (car.wheelAnimationTime > 1) car.wheelAnimationTime -= 1;
  }

  const velocity = getMotionVelocity(motion);
  car.velocity.x = velocity.x;
  car.velocity.y = velocity.y;

  // Tyres smoke most when the car is sliding, not merely when it is turning.
  const turningAmount = Math.min(1, Math.abs(motion.slipAngle) / 0.5);

  // Animation state
  if (car.currentSpeed > 0.5) {
    // Car is moving, update wheel rotation and animation
    car.isMoving = true;
    car.wheelRotation += 0.2 * car.currentSpeed; // Rotate wheels based on speed
    
    // Generate dust particles when car is moving (more when drifting)
    const particleChance = 0.28 + (turningAmount * car.currentSpeed / CAR_MAX_SPEED) * 0.55;
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
    // Collision occurred, scrub speed but keep the car's rotation state coherent
    const motionState = getCarMotion(car);
    dampMotionAfterImpact(motionState, 0.45);
    car.currentSpeed = Math.hypot(motionState.longitudinalSpeed, motionState.lateralSpeed);
    car.forwardSpeed = motionState.longitudinalSpeed;
    car.lateralSpeed = motionState.lateralSpeed;
    const impactVelocity = getMotionVelocity(motionState);
    car.velocity.x = impactVelocity.x;
    car.velocity.y = impactVelocity.y;
  }
}

// Cars created before the physics rework (or restored from a save) have no
// motion state yet, so build it lazily from whatever they currently have.
function getCarMotion(car) {
  if (!car.motion) {
    car.motion = createVehicleMotion(car.direction || 0);
    car.motion.longitudinalSpeed = Number.isFinite(car.forwardSpeed) ? car.forwardSpeed : car.currentSpeed || 0;
    car.motion.lateralSpeed = Number.isFinite(car.lateralSpeed) ? car.lateralSpeed : 0;
  }

  return car.motion;
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

  if (isHoleBlockingCarPosition(x, y, car.size)) {
    return false;
  }

  // Trees block cars by trunk collision so vehicles cannot pass through forests.
  if (isTreeBlocking(x, y, car.size * 0.22)) {
    return false;
  }
  
  // Check collision with rocks
  for (const rock of rocks) {
    if (getDistance(x, y, rock.x, rock.y) < car.size + rock.size * 0.2) {
      return false;
    }
  }
  
  // Check collision with wooden boxes
  if (woodenBoxes) {
    for (const box of woodenBoxes) {
      if (getDistance(x, y, box.x, box.y) < car.size + box.size * 0.2) {
        return false;
      }
    }
  }
  
  // Check collision with other cars
  if (cars) {
    for (const otherCar of cars) {
      // Skip the car being driven
      if (otherCar === car) continue;
      
      if (getDistance(x, y, otherCar.x, otherCar.y) < car.size + otherCar.size * 0.4) {
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

  const exitDistance = car.size + gameState.player.size + 12;
  const safeExitPosition = findNearestSafePlayerPosition(car.x, car.y, {
    baseDistance: exitDistance,
    maxDistance: exitDistance + 180,
    preferredAngles: [
      car.direction + Math.PI / 2,
      car.direction - Math.PI / 2,
      car.direction + Math.PI,
      car.direction,
    ],
  })

  if (!safeExitPosition) {
    return false;
  }

  gameState.player.x = safeExitPosition.x;
  gameState.player.y = safeExitPosition.y;
  
  // Reset car-related state
  gameState.isInCar = false;
  gameState.drivingCar = null;

  if (car.isBroken) {
    markCarWreckForCleanup(car)
  }

  return true;
}

// Damage car
export function damageCar(car, options = {}) {
  if (!car || car.health <= 0) {
    return false
  }

  const { amount = 1, ignoreCooldown = false } = options

  // Only apply damage if not recently hit
  if (!ignoreCooldown && Date.now() - car.lastHit < 1000) return false;
  
  car.health = Math.max(0, car.health - Math.max(1, Math.round(amount)));
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

  return true
}

// Destroy car
export function destroyCar(car) {
  if (!car || car.isBroken) {
    return
  }

  car.health = 0
  car.isBroken = true
  car.currentSpeed = 0
  car.velocity.x = 0
  car.velocity.y = 0
  resetVehicleMotion(car.motion)

  if (!(gameState.isInCar && gameState.drivingCar === car)) {
    markCarWreckForCleanup(car)
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
}

function markCarWreckForCleanup(car) {
  car.wreckCleanupAt = Date.now() + VEHICLE_WRECK_DESPAWN_DELAY_MS
}

function removeExpiredCarWrecks() {
  const { cars, isInCar, drivingCar } = gameState
  if (!Array.isArray(cars) || cars.length === 0) {
    return
  }

  const now = Date.now()
  for (let i = cars.length - 1; i >= 0; i--) {
    const car = cars[i]
    if (!car?.isBroken || !car.wreckCleanupAt) {
      continue
    }

    if (isInCar && drivingCar === car) {
      continue
    }

    if (now >= car.wreckCleanupAt) {
      cars.splice(i, 1)
    }
  }
}

// Draw and update cars
export function drawAndUpdateCars() {
  const { ctx, cars, camera, isInCar, drivingCar, player } = gameState;
  
  if (!cars) return;

  removeExpiredCarWrecks()
  
  for (const car of cars) {
    // Skip update for cars that are not being driven
    if (isInCar && drivingCar === car) {
      if (car.isBroken) {
        car.currentSpeed = 0
        car.velocity.x = 0
        car.velocity.y = 0
        resetVehicleMotion(car.motion)
        player.x = car.x
        player.y = car.y
      } else {
        // Update position for the car being driven
        updateCarPosition(car);
      }
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
    if (car.isBroken) {
      drawDamagedCarBody(ctx, 0, 0, car.size, '#4e5a4d', 2);
    } else if (car.health === CAR_MAX_HEALTH) {
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

    if (isInCar && drivingCar === car) {
      drawVehicleFuelBar(ctx, screenX, screenY, car.size, car.fuel, car.fuelCapacity);
    }
    
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

function getRandomFuelAmount(minFuel, maxFuel) {
  const safeMin = Math.max(0, Math.min(minFuel, maxFuel));
  const safeMax = Math.max(safeMin, Math.max(minFuel, maxFuel));
  return safeMin + Math.random() * (safeMax - safeMin);
}

function drawVehicleFuelBar(ctx, screenX, screenY, size, fuel, fuelCapacity) {
  const capacity = Math.max(1, fuelCapacity || 1);
  const normalizedFuel = Math.max(0, Math.min(1, (fuel || 0) / capacity));
  const barWidth = size * 1.4;
  const barHeight = 8;
  const barX = screenX - barWidth * 0.5;
  const barY = screenY - size - 20;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

  ctx.fillStyle = "rgba(36, 36, 36, 0.9)";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = normalizedFuel > 0.25 ? "#69c36a" : "#e29b3b";
  if (normalizedFuel <= 0.1) {
    ctx.fillStyle = "#db4c3f";
  }

  ctx.fillRect(barX, barY, barWidth * normalizedFuel, barHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  ctx.restore();
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