// Rendering utility functions

// Helper function to draw rounded rectangle
export function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.fill()
}

// Standardize shadow proportions for all objects
// Modify the createShadow function to match shape of the object it's shadowing
// Modify the createShadow function to ensure all shadow types have soft edges
// Modify the createShadow function to support shadow scale
export function createShadow(ctx, x, y, objectSize, shape = "circle", rect = null, rotation = 0, shadowScale = 1.0) {
  try {
    // Validate inputs to prevent errors
    if (!ctx || typeof x !== "number" || typeof y !== "number" || typeof objectSize !== "number") {
      console.error("Invalid parameters to createShadow:", { ctx, x, y, objectSize })
      return
    }

    // Ensure shadowScale is a valid number
    shadowScale = typeof shadowScale === "number" && !isNaN(shadowScale) ? shadowScale : 1.0

    // Save context for transformations
    ctx.save()

    // Apply rotation if needed
    if (rotation !== 0) {
      ctx.translate(x, y)
      ctx.rotate(rotation)
      x = 0
      y = 0
    }

    // Apply shadow scale to adjust shadow size
    const scaledSize = objectSize * shadowScale

    // Create a consistent shadow gradient for all shapes
    const shadowGradient = ctx.createRadialGradient(
      x,
      y,
      scaledSize * 0.4, // Slightly larger inner radius for more subtle gradient
      x,
      y,
      scaledSize * 1.3, // Slightly smaller outer radius for more subtle spread
    )
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.45)") // Slightly reduced opacity
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)")

    ctx.fillStyle = shadowGradient

    if (shape === "circle") {
      // Circular shadow
      ctx.beginPath()
      ctx.arc(x, y, scaledSize * 1.2, 0, Math.PI * 2)
      ctx.fill()
    } else if (shape === "rectangle" && rect) {
      // Rounded rectangle shadow with gradient
      const width = rect.width * 1.3 * shadowScale // Make shadow slightly larger
      const height = rect.height * 1.3 * shadowScale
      const radius = rect.radius || 0

      // Draw rounded rectangle shadow
      ctx.beginPath()
      ctx.moveTo(x - width / 2 + radius, y - height / 2)
      ctx.lineTo(x + width / 2 - radius, y - height / 2)
      ctx.quadraticCurveTo(x + width / 2, y - height / 2, x + width / 2, y - height / 2 + radius)
      ctx.lineTo(x + width / 2, y + height / 2 - radius)
      ctx.quadraticCurveTo(x + width / 2, y + height / 2, x + width / 2 - radius, y + height / 2)
      ctx.lineTo(x - width / 2 + radius, y + height / 2)
      ctx.quadraticCurveTo(x - width / 2, y + height / 2, x - width / 2, y + height / 2 - radius)
      ctx.lineTo(x - width / 2, y - height / 2 + radius)
      ctx.quadraticCurveTo(x - width / 2, y - height / 2, x - width / 2 + radius, y - height / 2)
      ctx.closePath()
      ctx.fill()
    } else if (shape === "polygon") {
      // Polygon shadow for angular rocks
      ctx.beginPath()
      // Use the same vertices as in drawAndUpdateRocks for angular rocks
      for (let j = 0; j < 7; j++) {
        const angle = (j * Math.PI * 2) / 7
        const radius = scaledSize * (0.7 + Math.sin(j * 5) * 0.1) * 1.4 // Larger shadow
        if (j === 0) {
          ctx.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
        } else {
          ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
        }
      }
      ctx.closePath()
      ctx.fill()
    } else if (shape === "oval") {
      // Oval shadow for oval rocks
      ctx.beginPath()
      ctx.ellipse(x, y, scaledSize * 0.85 * 1.4, scaledSize * 0.65 * 1.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Restore context
    ctx.restore()
  } catch (error) {
    console.error("Error in createShadow:", error)
    // Restore context in case of error
    try {
      ctx.restore()
    } catch (e) {
      // Ignore errors in error handler
    }
  }
}
