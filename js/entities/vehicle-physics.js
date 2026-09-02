// Shared drift-capable vehicle dynamics (single-track / "bicycle" model).
//
// Why real vehicles drift:
//  - A tyre only makes a sideways force once it is ALREADY sliding sideways a
//    little. That angle between where the tyre points and where it actually
//    travels is the slip angle.
//  - Cornering force grows with slip angle, but only up to the friction limit.
//    Past that the tyre is saturated and that end of the car just slides.
//  - If the REAR saturates before the front, the car oversteers: the tail swings
//    out, the heading rotates away from the direction of travel, and the car
//    keeps travelling roughly where its momentum was already pointing.
//  - Throttle steals rear grip (friction circle), which is why power induces
//    oversteer, and why lifting/steering back (opposite lock) recovers it.
//
// The whole point is that HEADING and DIRECTION OF TRAVEL are separate state.
// Slaving heading to the aim direction (what the old code did) makes drift
// mathematically impossible, no matter how much sideways velocity is added.

const EPSILON = 1e-4

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
}

export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

export function createVehicleMotion(heading = 0) {
  return {
    heading,
    yawRate: 0,
    steerAngle: 0,
    longitudinalSpeed: 0,
    lateralSpeed: 0,
    slipAngle: 0,
    frontSlip: 0,
    rearSlip: 0,
    isSliding: false,
  }
}

// Advances one frame. `input.steer` and `input.throttle` are both -1..1.
// Returns the motion object (mutated in place).
export function stepVehicleMotion(motion, input, params) {
  const {
    maxSpeed,
    acceleration,
    braking,
    maxSteerAngle,
    steerSpeed,
    frontAxle,
    rearAxle,
    yawInertia,
    frontGrip,
    rearGrip,
    frontStiffness,
    rearStiffness,
    driftFactor,
    powerOversteer = 1,
    lateralDrag = 0,
    yawDamping = 0,
    rearSteering = false,
    steerNeedsFlow = false,
    driftAffectsFront = false,
    steerSpeedSensitivity = 0.45,
    lowSpeedBlend = 1.5,
  } = params

  const wheelbase = Math.max(frontAxle + rearAxle, EPSILON)
  const throttle = clamp(input.throttle || 0, -1, 1)

  const vLong = motion.longitudinalSpeed
  const vLat = motion.lateralSpeed
  const yawRate = motion.yawRate
  const speed = Math.hypot(vLong, vLat)

  // You cannot use full lock at speed - there simply is not enough grip to make
  // the turn it asks for, so the useful steering range shrinks as you go faster.
  const speedRatio = Math.min(1, speed / Math.max(maxSpeed, EPSILON))
  const usableSteer = maxSteerAngle * (1 - steerSpeedSensitivity * speedRatio)

  // Steering has actuator lag - you cannot snap to full lock instantly.
  const steerTarget = clamp(input.steer || 0, -1, 1) * usableSteer
  motion.steerAngle += (steerTarget - motion.steerAngle) * steerSpeed

  // Slip angles blow up at a true standstill, so keep a small floor on the
  // reference speed - but keep it small, or big slides read as smaller than they
  // are and the tyres never push back hard enough to catch the car.
  const speedRef = Math.max(Math.abs(vLong), 0.6)

  // Reversing flips which way the steered axle bites.
  const steerSign = vLong < 0 ? -1 : 1
  const steer = motion.steerAngle * steerSign

  // A rudder only works with water flowing past it; a tyre always bites.
  const flowScale = steerNeedsFlow ? Math.min(1, Math.abs(vLong) / Math.max(maxSpeed * 0.35, EPSILON)) : 1

  // DRIFT_FACTOR is deliberately wired to the axle that lets go: less grip means
  // it breaks away sooner and stays out longer = more drift. On a car that is the
  // rear tyres. A boat has no rear tyres to lose - its slide is the whole hull
  // sliding sideways (leeway), so there the factor scales the hull as well.
  const rearGripLimit = Math.max(rearGrip * driftFactor, EPSILON)
  const rearStiffnessScaled = rearStiffness * driftFactor
  const frontGripLimit = driftAffectsFront ? Math.max(frontGrip * driftFactor, EPSILON) : frontGrip
  const frontStiffnessScaled = driftAffectsFront ? frontStiffness * driftFactor : frontStiffness
  const lateralDragScaled = driftAffectsFront ? lateralDrag * driftFactor : lateralDrag

  const frontSlipBase = Math.atan2(vLat + yawRate * frontAxle, speedRef)
  const rearSlipBase = Math.atan2(vLat - yawRate * rearAxle, speedRef)

  // Front-steered (car): steer subtracts from front slip.
  // Rear-steered (boat rudder): steer adds angle of attack at the stern.
  const frontSlip = rearSteering ? frontSlipBase : frontSlipBase - steer
  const rearSlip = rearSteering ? rearSlipBase + steer : rearSlipBase

  // Longitudinal force: drive/brake minus drag that settles out at maxSpeed.
  const driveForce = throttle >= 0 ? acceleration * throttle : braking * throttle
  const dragForce = -(acceleration / Math.max(maxSpeed, EPSILON)) * vLong
  const coastForce = throttle === 0 ? -Math.sign(vLong) * Math.min(braking, Math.abs(vLong)) : 0

  // Friction circle: force sent through the driven axle is grip it can no longer
  // spend sideways. This is what makes throttle break the rear loose. It is
  // measured against the vehicle's baseline grip so that DRIFT_FACTOR scales the
  // slide smoothly instead of falling off a cliff.
  const gripUsed = clamp((Math.abs(driveForce) * powerOversteer) / Math.max(rearGrip, EPSILON), 0, 0.95)
  const rearGripAvailable = rearGripLimit * Math.sqrt(Math.max(0, 1 - gripUsed * gripUsed))

  const frontForce = clamp(-frontStiffnessScaled * frontSlip, -frontGripLimit, frontGripLimit)
  const rearForce = clamp(-rearStiffnessScaled * flowScale * rearSlip, -rearGripAvailable, rearGripAvailable)

  const steerCos = Math.cos(motion.steerAngle)
  const steerSin = Math.sin(motion.steerAngle)

  // Body-frame accelerations (unit mass). The yawRate cross terms are what carry
  // momentum sideways while the body rotates - the visible "travelling sideways".
  const accelLong = driveForce + dragForce + coastForce - (rearSteering ? 0 : frontForce * steerSin) + yawRate * vLat
  const accelLat =
    (rearSteering ? frontForce : frontForce * steerCos) +
    (rearSteering ? rearForce * steerCos : rearForce) -
    yawRate * vLong -
    lateralDragScaled * vLat

  const yawMoment = rearSteering
    ? frontAxle * frontForce - rearAxle * rearForce * steerCos
    : frontAxle * frontForce * steerCos - rearAxle * rearForce
  const yawAccel = yawMoment / Math.max(yawInertia, EPSILON) - yawDamping * yawRate

  let nextLong = vLong + accelLong
  let nextLat = vLat + accelLat
  let nextYaw = yawRate + yawAccel

  // Below walking pace the dynamic model is noisy, so fade toward the kinematic
  // "wheels just point where they point" solution instead.
  if (speed < lowSpeedBlend) {
    const blend = 1 - speed / Math.max(lowSpeedBlend, EPSILON)
    const kinematicYaw = (vLong * Math.tan(motion.steerAngle)) / wheelbase
    nextYaw += (kinematicYaw - nextYaw) * blend
    nextLat *= 1 - 0.6 * blend
  }

  const speedCap = maxSpeed * 1.2
  nextLong = clamp(nextLong, -speedCap, speedCap)
  nextLat = clamp(nextLat, -speedCap, speedCap)

  if (Math.abs(nextLong) < 0.015) nextLong = 0
  if (Math.abs(nextLat) < 0.015) nextLat = 0
  if (Math.abs(nextYaw) < 0.0004) nextYaw = 0

  motion.longitudinalSpeed = nextLong
  motion.lateralSpeed = nextLat
  motion.yawRate = nextYaw
  motion.heading = normalizeAngle(motion.heading + nextYaw)
  motion.frontSlip = frontSlip
  motion.rearSlip = rearSlip
  motion.slipAngle = Math.abs(nextLong) < 0.2 && Math.abs(nextLat) < 0.2 ? 0 : Math.atan2(nextLat, Math.abs(nextLong))
  // Sliding = the body itself is travelling noticeably sideways. (Rudder angle
  // of attack is not a slide, so it must not be used here.)
  motion.isSliding = Math.abs(motion.slipAngle) > 0.14 && Math.hypot(nextLong, nextLat) > 1.2

  return motion
}

// World-space velocity for the current motion state.
export function getMotionVelocity(motion) {
  const forwardX = Math.cos(motion.heading)
  const forwardY = Math.sin(motion.heading)
  const sideX = Math.cos(motion.heading + Math.PI / 2)
  const sideY = Math.sin(motion.heading + Math.PI / 2)

  return {
    x: forwardX * motion.longitudinalSpeed + sideX * motion.lateralSpeed,
    y: forwardY * motion.longitudinalSpeed + sideY * motion.lateralSpeed,
  }
}

// Scrub speed off after a collision without losing the drift state entirely.
export function dampMotionAfterImpact(motion, scale = 0.45) {
  motion.longitudinalSpeed *= scale
  motion.lateralSpeed *= scale
  motion.yawRate *= scale
}

// Bring a vehicle to a genuine standstill (wrecked, parked, beached) so it does
// not resume a half-finished slide the next time it is driven.
export function resetVehicleMotion(motion) {
  if (!motion) return
  motion.yawRate = 0
  motion.steerAngle = 0
  motion.longitudinalSpeed = 0
  motion.lateralSpeed = 0
  motion.slipAngle = 0
  motion.frontSlip = 0
  motion.rearSlip = 0
  motion.isSliding = false
}
