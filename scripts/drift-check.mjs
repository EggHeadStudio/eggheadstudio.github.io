// Headless check: does the car actually drift, and does DRIFT_FACTOR change it?
import { createVehicleMotion, stepVehicleMotion, getMotionVelocity } from "../js/entities/vehicle-physics.js"
import {
  CAR_MAX_SPEED,
  CAR_ACCELERATION,
  CAR_DECELERATION,
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
  CAR_SIZE,
  BOAT_MAX_SPEED,
  BOAT_ACCELERATION,
  BOAT_DECELERATION,
  BOAT_MAX_RUDDER_ANGLE,
  BOAT_STEER_SPEED,
  BOAT_HULL_GRIP,
  BOAT_RUDDER_GRIP,
  BOAT_HULL_STIFFNESS,
  BOAT_RUDDER_STIFFNESS,
  BOAT_YAW_INERTIA,
  BOAT_YAW_DAMPING,
  BOAT_STEER_SENSITIVITY_FALLOFF,
  BOAT_LATERAL_DRAG,
  BOAT_POWER_OVERSTEER,
  BOAT_SIZE,
} from "../js/core/constants.js"

const deg = (r) => (r * 180) / Math.PI

function carParams(driftFactor) {
  return {
    maxSpeed: CAR_MAX_SPEED,
    acceleration: CAR_ACCELERATION,
    braking: CAR_DECELERATION,
    maxSteerAngle: CAR_MAX_STEER_ANGLE,
    steerSpeed: CAR_STEER_SPEED,
    frontAxle: CAR_SIZE * 0.35,
    rearAxle: CAR_SIZE * 0.35,
    yawInertia: CAR_YAW_INERTIA,
    frontGrip: CAR_FRONT_GRIP,
    rearGrip: CAR_REAR_GRIP,
    frontStiffness: CAR_FRONT_CORNERING_STIFFNESS,
    rearStiffness: CAR_REAR_CORNERING_STIFFNESS,
    driftFactor,
    powerOversteer: CAR_POWER_OVERSTEER,
    lateralDrag: CAR_LATERAL_DRAG,
    yawDamping: CAR_YAW_DAMPING,
    steerSpeedSensitivity: CAR_STEER_SENSITIVITY_FALLOFF,
  }
}

function boatParams(driftFactor) {
  return {
    maxSpeed: BOAT_MAX_SPEED,
    acceleration: BOAT_ACCELERATION,
    braking: BOAT_DECELERATION,
    maxSteerAngle: BOAT_MAX_RUDDER_ANGLE,
    steerSpeed: BOAT_STEER_SPEED,
    frontAxle: BOAT_SIZE * 0.4,
    rearAxle: BOAT_SIZE * 0.4,
    yawInertia: BOAT_YAW_INERTIA,
    frontGrip: BOAT_HULL_GRIP,
    rearGrip: BOAT_RUDDER_GRIP,
    frontStiffness: BOAT_HULL_STIFFNESS,
    rearStiffness: BOAT_RUDDER_STIFFNESS,
    driftFactor,
    powerOversteer: BOAT_POWER_OVERSTEER,
    lateralDrag: BOAT_LATERAL_DRAG,
    yawDamping: BOAT_YAW_DAMPING,
    steerSpeedSensitivity: BOAT_STEER_SENSITIVITY_FALLOFF,
    rearSteering: true,
    steerNeedsFlow: true,
    driftAffectsFront: true,
  }
}

function norm(a) {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

// Reproduces the real in-game control law: the player aims somewhere, and the
// steering request is the difference between the aim and the car's heading.
// That means once the tail steps out and the car rotates past the aim, the input
// flips sign on its own - automatic counter-steer, exactly like a real driver.
function steerToward(aim, motion, maxSteerAngle) {
  return Math.max(-1, Math.min(1, norm(aim - motion.heading) / maxSteerAngle))
}

// Straight-line launch, a corner taken by sweeping the aim, then straighten out.
function run(params, label) {
  const motion = createVehicleMotion(0)
  let topSpeed = 0
  let peakSlip = 0
  let framesSliding = 0
  let sustained = []

  for (let i = 0; i < 90; i++) {
    stepVehicleMotion(motion, { throttle: 1, steer: 0 }, params)
    topSpeed = Math.max(topSpeed, Math.hypot(motion.longitudinalSpeed, motion.lateralSpeed))
  }
  const straightSlip = Math.abs(deg(motion.slipAngle))

  // Corner: the player sweeps the aim around at a steady rate.
  let aim = motion.heading
  for (let i = 0; i < 120; i++) {
    aim = norm(aim + 0.035)
    stepVehicleMotion(motion, { throttle: 1, steer: steerToward(aim, motion, params.maxSteerAngle) }, params)
    const s = Math.abs(deg(motion.slipAngle))
    peakSlip = Math.max(peakSlip, s)
    if (motion.isSliding) framesSliding++
    if (i > 40) sustained.push(s)
  }
  const avgSlip = sustained.reduce((a, b) => a + b, 0) / sustained.length

  // Straighten up and see how long the slide takes to settle.
  const exitAim = motion.heading
  let recover = -1
  let spun = false
  for (let i = 0; i < 240; i++) {
    stepVehicleMotion(motion, { throttle: 1, steer: steerToward(exitAim, motion, params.maxSteerAngle) }, params)
    if (recover < 0 && Math.abs(deg(motion.slipAngle)) < 2) recover = i
    if (Math.abs(deg(motion.slipAngle)) > 88) spun = true
  }

  console.log(
    `${label}  top=${topSpeed.toFixed(2)}  straight=${straightSlip.toFixed(1)}d  ` +
      `sustainedSlip=${avgSlip.toFixed(1)}d  peak=${peakSlip.toFixed(1)}d  ` +
      `sliding=${framesSliding}/120  settle=${recover < 0 ? ">240" : recover}f${spun ? "  SPUN" : ""}`
  )
  return { avgSlip, peakSlip, topSpeed, framesSliding, recover }
}

console.log("=== CAR: DRIFT_FACTOR sweep (peakSlip should rise as factor falls) ===")
for (const f of [1.0, 0.85, 0.7, 0.55, 0.4, 0.25]) {
  run(carParams(f), `drift=${f.toFixed(2)}`)
}

console.log("\n=== BOAT: DRIFT_FACTOR sweep ===")
for (const f of [1.0, 0.8, 0.6, 0.45, 0.3]) {
  run(boatParams(f), `drift=${f.toFixed(2)}`)
}

// Countersteer check: once sliding, does opposite lock actually pull it back?
console.log("\n=== CAR: hard flick (player yanks the aim 90 degrees) ===")
for (const f of [0.85, 0.55, 0.3]) {
  const params = carParams(f)
  const motion = createVehicleMotion(0)
  for (let i = 0; i < 90; i++) stepVehicleMotion(motion, { throttle: 1, steer: 0 }, params)

  const aim = norm(motion.heading + Math.PI / 2)
  let peak = 0
  let settle = -1
  for (let i = 0; i < 300; i++) {
    stepVehicleMotion(motion, { throttle: 1, steer: steerToward(aim, motion, params.maxSteerAngle) }, params)
    peak = Math.max(peak, Math.abs(deg(motion.slipAngle)))
    if (settle < 0 && i > 20 && Math.abs(deg(motion.slipAngle)) < 2) settle = i
  }
  console.log(
    `  drift=${f.toFixed(2)}  peakSlip=${peak.toFixed(1)}deg  settles after ${settle < 0 ? ">300" : settle} frames ` +
      `(${settle < 0 ? "never" : (settle / 60).toFixed(2) + "s"})`
  )
}

// Sideways travel: is the car physically moving in a different direction than it points?
console.log("\n=== CAR: heading vs travel direction while cornering ===")
{
  const params = carParams(0.55)
  const motion = createVehicleMotion(0)
  for (let i = 0; i < 90; i++) stepVehicleMotion(motion, { throttle: 1, steer: 0 }, params)
  let aim = motion.heading
  for (let i = 0; i < 60; i++) {
    aim = norm(aim + 0.05)
    stepVehicleMotion(motion, { throttle: 1, steer: steerToward(aim, motion, params.maxSteerAngle) }, params)
  }
  const v = getMotionVelocity(motion)
  const travel = Math.atan2(v.y, v.x)
  let diff = travel - motion.heading
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  console.log(`  heading=${deg(motion.heading).toFixed(1)}deg  travel=${deg(travel).toFixed(1)}deg  divergence=${deg(diff).toFixed(1)}deg`)
  console.log(`  lateral speed=${motion.lateralSpeed.toFixed(2)} px/frame (this is the sideways motion)`)
}
