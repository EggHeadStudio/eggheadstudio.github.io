// Polyfills and browser compatibility shims.
//
// Loaded from main.js before anything else runs so the rest of the game can use
// modern canvas APIs without worrying about older mobile browsers.

// CanvasRenderingContext2D.roundRect only shipped in Safari 16.4 (March 2023).
// The car rendering code calls it every frame, so on an older iPhone/iPad the
// game throws "ctx.roundRect is not a function", the animation frame chain dies
// and the game freezes on mobile while desktop browsers work fine.
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, width, height, radii = 0) {
    // Normalise the radii argument to [topLeft, topRight, bottomRight, bottomLeft].
    const list = Array.isArray(radii) ? radii : [radii]
    const toNumber = (value) => {
      const numeric = typeof value === "number" ? value : Number(value)
      return Number.isFinite(numeric) ? Math.abs(numeric) : 0
    }

    let topLeft
    let topRight
    let bottomRight
    let bottomLeft

    if (list.length === 1) {
      topLeft = topRight = bottomRight = bottomLeft = toNumber(list[0])
    } else if (list.length === 2) {
      topLeft = bottomRight = toNumber(list[0])
      topRight = bottomLeft = toNumber(list[1])
    } else if (list.length === 3) {
      topLeft = toNumber(list[0])
      topRight = bottomLeft = toNumber(list[1])
      bottomRight = toNumber(list[2])
    } else {
      topLeft = toNumber(list[0])
      topRight = toNumber(list[1])
      bottomRight = toNumber(list[2])
      bottomLeft = toNumber(list[3])
    }

    // Support negative width/height the same way the native API does.
    const left = width < 0 ? x + width : x
    const top = height < 0 ? y + height : y
    const absWidth = Math.abs(width)
    const absHeight = Math.abs(height)

    // Clamp so opposing corners can never overlap.
    const maxRadius = Math.min(absWidth, absHeight) / 2
    topLeft = Math.min(topLeft, maxRadius)
    topRight = Math.min(topRight, maxRadius)
    bottomRight = Math.min(bottomRight, maxRadius)
    bottomLeft = Math.min(bottomLeft, maxRadius)

    this.moveTo(left + topLeft, top)
    this.lineTo(left + absWidth - topRight, top)
    this.arcTo(left + absWidth, top, left + absWidth, top + topRight, topRight)
    this.lineTo(left + absWidth, top + absHeight - bottomRight)
    this.arcTo(left + absWidth, top + absHeight, left + absWidth - bottomRight, top + absHeight, bottomRight)
    this.lineTo(left + bottomLeft, top + absHeight)
    this.arcTo(left, top + absHeight, left, top + absHeight - bottomLeft, bottomLeft)
    this.lineTo(left, top + topLeft)
    this.arcTo(left, top, left + topLeft, top, topLeft)
    this.closePath()
  }
}