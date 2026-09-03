import {
  createCharacter,
  getAvailableCharacterTypes,
  getCharacterTypeLabel,
  getCharacterTypeProperties,
  getSelectableCharacterTypes,
  getSpecialCharacterConfig,
} from "../entities/character-factory.js"
import { drawCharacterPreview } from "../entities/player.js"

const HAIR_STYLE_OPTIONS = ["none", "mohawk", "long", "ultraLong", "short", "bob", "curly", "bun"]

const PARAM_SCHEMA = [
  { key: "size", label: "Size", type: "numberRange", min: 8, max: 30, step: 0.1, defaultValue: 18 },
  { key: "speed", label: "Speed", type: "numberRange", min: 1, max: 10, step: 0.1, defaultValue: 5 },
  { key: "health", label: "Health", type: "numberRange", min: 1, max: 12, step: 1, defaultValue: 5 },
  { key: "strength", label: "Strength", type: "numberRange", min: 0.5, max: 10, step: 0.1, defaultValue: 3 },
  { key: "color", label: "Body Color", type: "color", defaultValue: "#f8cc8e" },
  { key: "handColor", label: "Hand Color", type: "color", defaultValue: "#f8cc8e" },
  { key: "footColor", label: "Foot Color", type: "color", defaultValue: "#444444" },
  { key: "backpackColor", label: "Backpack Color", type: "color", defaultValue: "#8B4513" },
  { key: "backpackPocketColor", label: "Backpack Pocket Color", type: "color", defaultValue: "#A0522D" },
  { key: "hairStyle", label: "Hair Style", type: "select", options: HAIR_STYLE_OPTIONS, defaultValue: "none" },
  { key: "hairColor", label: "Hair Color", type: "color", defaultValue: "#2d2d2d" },
  { key: "hairSideScale", label: "Hair Side Scale", type: "numberRange", min: 0.4, max: 1.8, step: 0.01, defaultValue: 0.72 },
  { key: "hairTopScale", label: "Hair Top Scale", type: "numberRange", min: 0.4, max: 1.8, step: 0.01, defaultValue: 0.94 },
  { key: "hairBackScale", label: "Hair Back Scale", type: "numberRange", min: 0.4, max: 1.8, step: 0.01, defaultValue: 0.88 },
  { key: "noseColor", label: "Nose Color", type: "color", defaultValue: "#b5966a" },
  { key: "noseSizeScale", label: "Nose Size Scale", type: "numberRange", min: 0.05, max: 0.45, step: 0.01, defaultValue: 0.2 },
  { key: "backpackWidthScale", label: "Backpack Width Scale", type: "numberRange", min: 0.5, max: 1.8, step: 0.01, defaultValue: 1 },
  { key: "backpackHeightScale", label: "Backpack Height Scale", type: "numberRange", min: 0.5, max: 1.8, step: 0.01, defaultValue: 1 },
  { key: "hasLashes", label: "Has Lashes", type: "boolean", defaultValue: false },
  { key: "hasGlasses", label: "Has Glasses", type: "boolean", defaultValue: false },
  { key: "hasSunglasses", label: "Has Sunglasses", type: "boolean", defaultValue: false },
  { key: "glassesColor", label: "Glasses Color", type: "color", defaultValue: "#2b2b2b" },
  { key: "hasBeard", label: "Has Beard", type: "boolean", defaultValue: false },
  { key: "beardColor", label: "Beard Color", type: "color", defaultValue: "#554535" },
]

const ui = {
  templateType: document.getElementById("templateType"),
  characterKey: document.getElementById("characterKey"),
  displayLabel: document.getElementById("displayLabel"),
  addToSelectable: document.getElementById("addToSelectable"),
  isSpecialHero: document.getElementById("isSpecialHero"),
  specialFields: document.getElementById("specialFields"),
  specialHeroId: document.getElementById("specialHeroId"),
  specialLabel: document.getElementById("specialLabel"),
  specialTitle: document.getElementById("specialTitle"),
  specialRarity: document.getElementById("specialRarity"),
  specialDescription: document.getElementById("specialDescription"),
  specialPerk: document.getElementById("specialPerk"),
  parameterControls: document.getElementById("parameterControls"),
  outputSnippet: document.getElementById("outputSnippet"),
  copyOutputButton: document.getElementById("copyOutputButton"),
  exportJsonButton: document.getElementById("exportJsonButton"),
  importJsonFileInput: document.getElementById("importJsonFileInput"),
  applyJsonTextButton: document.getElementById("applyJsonTextButton"),
  jsonDraft: document.getElementById("jsonDraft"),
  previewCanvas: document.getElementById("previewCanvas"),
  previewDirection: document.getElementById("previewDirection"),
  previewDirectionValue: document.getElementById("previewDirectionValue"),
  previewMovingToggle: document.getElementById("previewMovingToggle"),
}

const state = {
  templateType: "default",
  characterKey: "newHero",
  displayLabel: "New Hero",
  addToSelectable: false,
  isSpecialHero: false,
  special: {
    heroId: "newhero",
    label: "New Hero",
    title: "Arc Runner",
    rarity: "Legendary",
    description: "A composed survivor with balanced skills.",
    perk: "Keeps control when situations turn chaotic.",
  },
  properties: {},
  previewDirectionDeg: -90,
  previewMoving: true,
}

function init() {
  populateTemplateOptions()
  bindMetaFields()
  buildParameterControls()
  loadTemplate("default")
  bindCopyButton()
  bindJsonDraftTools()
  startPreviewLoop()
}

function populateTemplateOptions() {
  const availableTypes = getAvailableCharacterTypes()
  const selectableTypes = new Set(getSelectableCharacterTypes())

  ui.templateType.innerHTML = ""
  for (const type of availableTypes) {
    const option = document.createElement("option")
    const label = getCharacterTypeLabel(type)
    const inMenu = selectableTypes.has(type) ? "menu" : "hidden"
    const isSpecial = getSpecialCharacterConfig(type) ? "special" : "normal"
    option.value = type
    option.textContent = `${label} (${type}, ${inMenu}, ${isSpecial})`
    ui.templateType.append(option)
  }

  ui.templateType.value = state.templateType
}

function getNormalizedPropertiesFromTemplate(type) {
  const templateProps = { ...getCharacterTypeProperties(type) }
  const resolved = {}

  for (const schema of PARAM_SCHEMA) {
    const fromTemplate = templateProps[schema.key]
    resolved[schema.key] = fromTemplate != null ? fromTemplate : schema.defaultValue
  }

  return resolved
}

function loadTemplate(type) {
  state.templateType = type
  state.properties = getNormalizedPropertiesFromTemplate(type)
  syncPropertyInputsFromState()
  updateOutput()
}

function bindMetaFields() {
  ui.templateType.addEventListener("change", (event) => {
    loadTemplate(event.target.value)
  })

  ui.characterKey.addEventListener("input", (event) => {
    state.characterKey = sanitizeKey(event.target.value)
    syncMetaOutputFields()
    updateOutput()
  })

  ui.displayLabel.addEventListener("input", (event) => {
    state.displayLabel = event.target.value
    if (!state.isSpecialHero) {
      state.special.label = event.target.value
      ui.specialLabel.value = event.target.value
    }
    syncMetaOutputFields()
    updateOutput()
  })

  ui.addToSelectable.addEventListener("change", (event) => {
    state.addToSelectable = event.target.checked
    updateOutput()
  })

  ui.isSpecialHero.addEventListener("change", (event) => {
    state.isSpecialHero = event.target.checked
    ui.specialFields.classList.toggle("hidden", !state.isSpecialHero)
    updateOutput()
  })

  ui.specialHeroId.addEventListener("input", (event) => {
    state.special.heroId = sanitizeKey(event.target.value)
    event.target.value = state.special.heroId
    updateOutput()
  })

  ui.specialLabel.addEventListener("input", (event) => {
    state.special.label = event.target.value
    updateOutput()
  })

  ui.specialTitle.addEventListener("input", (event) => {
    state.special.title = event.target.value
    updateOutput()
  })

  ui.specialRarity.addEventListener("input", (event) => {
    state.special.rarity = event.target.value
    updateOutput()
  })

  ui.specialDescription.addEventListener("input", (event) => {
    state.special.description = event.target.value
    updateOutput()
  })

  ui.specialPerk.addEventListener("input", (event) => {
    state.special.perk = event.target.value
    updateOutput()
  })

  ui.previewDirection.addEventListener("input", (event) => {
    state.previewDirectionDeg = Number(event.target.value)
    ui.previewDirectionValue.textContent = `${state.previewDirectionDeg}deg`
  })

  ui.previewMovingToggle.addEventListener("change", (event) => {
    state.previewMoving = event.target.checked
  })

  syncMetaOutputFields()
}

function syncMetaOutputFields() {
  ui.characterKey.value = state.characterKey
  ui.displayLabel.value = state.displayLabel
}

function sanitizeKey(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .trim() || "newHero"
}

function coerceValueFromSchema(schema, value) {
  if (schema.type === "boolean") {
    return Boolean(value)
  }

  if (schema.type === "select") {
    const resolved = String(value ?? schema.defaultValue)
    return (schema.options || []).includes(resolved) ? resolved : schema.defaultValue
  }

  if (schema.type === "color") {
    const resolved = String(value ?? schema.defaultValue).trim()
    return resolved || schema.defaultValue
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return schema.defaultValue
  }

  return Math.max(schema.min, Math.min(schema.max, numeric))
}

function buildParameterControls() {
  ui.parameterControls.innerHTML = ""

  for (const schema of PARAM_SCHEMA) {
    const row = document.createElement("div")
    row.className = "parameter-row"

    const head = document.createElement("div")
    head.className = "parameter-row-head"

    const title = document.createElement("strong")
    title.textContent = schema.label

    const keyText = document.createElement("span")
    keyText.textContent = schema.key

    head.append(title, keyText)
    row.append(head)

    const control = createControlForSchema(schema)
    row.append(control)

    ui.parameterControls.append(row)
  }
}

function createControlForSchema(schema) {
  if (schema.type === "boolean") {
    const wrap = document.createElement("label")
    wrap.className = "checkbox-field"

    const input = document.createElement("input")
    input.type = "checkbox"
    input.dataset.paramKey = schema.key
    input.addEventListener("change", () => {
      state.properties[schema.key] = input.checked
      updateOutput()
    })

    const text = document.createElement("span")
    text.textContent = "Enabled"
    wrap.append(input, text)
    return wrap
  }

  if (schema.type === "select") {
    const select = document.createElement("select")
    select.dataset.paramKey = schema.key

    for (const optionValue of schema.options || []) {
      const option = document.createElement("option")
      option.value = optionValue
      option.textContent = optionValue
      select.append(option)
    }

    select.addEventListener("change", () => {
      state.properties[schema.key] = select.value
      updateOutput()
    })

    return select
  }

  if (schema.type === "color") {
    const wrap = document.createElement("div")
    wrap.className = "color-duo"

    const colorInput = document.createElement("input")
    colorInput.type = "color"
    colorInput.dataset.paramKey = schema.key
    colorInput.dataset.variant = "picker"

    const textInput = document.createElement("input")
    textInput.type = "text"
    textInput.dataset.paramKey = schema.key
    textInput.dataset.variant = "text"
    textInput.spellcheck = false

    colorInput.addEventListener("input", () => {
      state.properties[schema.key] = colorInput.value
      textInput.value = colorInput.value
      updateOutput()
    })

    textInput.addEventListener("input", () => {
      const value = textInput.value.trim()
      state.properties[schema.key] = value
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        colorInput.value = value
      }
      updateOutput()
    })

    wrap.append(colorInput, textInput)
    return wrap
  }

  const wrap = document.createElement("div")
  wrap.className = "input-duo"

  const range = document.createElement("input")
  range.type = "range"
  range.min = String(schema.min)
  range.max = String(schema.max)
  range.step = String(schema.step)
  range.dataset.paramKey = schema.key
  range.dataset.variant = "range"

  const number = document.createElement("input")
  number.type = "number"
  number.min = String(schema.min)
  number.max = String(schema.max)
  number.step = String(schema.step)
  number.dataset.paramKey = schema.key
  number.dataset.variant = "number"

  const sync = (value) => {
    const parsed = Number(value)
    const clamped = Number.isFinite(parsed)
      ? Math.max(schema.min, Math.min(schema.max, parsed))
      : schema.defaultValue

    state.properties[schema.key] = clamped
    range.value = String(clamped)
    number.value = String(clamped)
    updateOutput()
  }

  range.addEventListener("input", () => sync(range.value))
  number.addEventListener("input", () => sync(number.value))

  wrap.append(range, number)
  return wrap
}

function syncPropertyInputsFromState() {
  for (const schema of PARAM_SCHEMA) {
    const value = state.properties[schema.key]

    if (schema.type === "boolean") {
      const input = ui.parameterControls.querySelector(`input[data-param-key="${schema.key}"]`)
      if (input) {
        input.checked = Boolean(value)
      }
      continue
    }

    if (schema.type === "select") {
      const input = ui.parameterControls.querySelector(`select[data-param-key="${schema.key}"]`)
      if (input) {
        input.value = String(value)
      }
      continue
    }

    if (schema.type === "color") {
      const picker = ui.parameterControls.querySelector(`input[data-param-key="${schema.key}"][data-variant="picker"]`)
      const text = ui.parameterControls.querySelector(`input[data-param-key="${schema.key}"][data-variant="text"]`)
      const resolvedValue = String(value || schema.defaultValue)
      if (text) {
        text.value = resolvedValue
      }
      if (picker) {
        picker.value = /^#[0-9a-fA-F]{6}$/.test(resolvedValue) ? resolvedValue : schema.defaultValue
      }
      continue
    }

    const range = ui.parameterControls.querySelector(`input[data-param-key="${schema.key}"][data-variant="range"]`)
    const number = ui.parameterControls.querySelector(`input[data-param-key="${schema.key}"][data-variant="number"]`)
    if (range) {
      range.value = String(value)
    }
    if (number) {
      number.value = String(value)
    }
  }
}

function bindCopyButton() {
  ui.copyOutputButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ui.outputSnippet.value)
      ui.copyOutputButton.textContent = "Copied"
      window.setTimeout(() => {
        ui.copyOutputButton.textContent = "Copy Snippet"
      }, 1200)
    } catch {
      ui.copyOutputButton.textContent = "Copy failed"
      window.setTimeout(() => {
        ui.copyOutputButton.textContent = "Copy Snippet"
      }, 1200)
    }
  })
}

function buildDraftObject() {
  const serializedProps = {}
  for (const schema of PARAM_SCHEMA) {
    serializedProps[schema.key] = state.properties[schema.key]
  }

  return {
    version: 1,
    templateType: state.templateType,
    characterKey: sanitizeKey(state.characterKey),
    displayLabel: state.displayLabel,
    addToSelectable: state.addToSelectable,
    isSpecialHero: state.isSpecialHero,
    special: {
      heroId: sanitizeKey(state.special.heroId),
      label: state.special.label,
      title: state.special.title,
      rarity: state.special.rarity,
      description: state.special.description,
      perk: state.special.perk,
    },
    preview: {
      directionDeg: state.previewDirectionDeg,
      moving: state.previewMoving,
    },
    properties: serializedProps,
  }
}

function downloadJsonDraft() {
  const payload = JSON.stringify(buildDraftObject(), null, 2)
  ui.jsonDraft.value = payload

  const blob = new Blob([payload], { type: "application/json" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `${sanitizeKey(state.characterKey)}-character-draft.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}

function applyDraftObject(draft) {
  const availableTypes = new Set(getAvailableCharacterTypes())
  const resolvedTemplate = availableTypes.has(draft?.templateType) ? draft.templateType : "default"

  state.templateType = resolvedTemplate
  state.characterKey = sanitizeKey(draft?.characterKey)
  state.displayLabel = String(draft?.displayLabel ?? state.displayLabel)
  state.addToSelectable = Boolean(draft?.addToSelectable)
  state.isSpecialHero = Boolean(draft?.isSpecialHero)

  state.special.heroId = sanitizeKey(draft?.special?.heroId ?? state.special.heroId)
  state.special.label = String(draft?.special?.label ?? state.displayLabel)
  state.special.title = String(draft?.special?.title ?? state.special.title)
  state.special.rarity = String(draft?.special?.rarity ?? state.special.rarity)
  state.special.description = String(draft?.special?.description ?? state.special.description)
  state.special.perk = String(draft?.special?.perk ?? state.special.perk)

  const templateProps = getNormalizedPropertiesFromTemplate(resolvedTemplate)
  state.properties = { ...templateProps }
  for (const schema of PARAM_SCHEMA) {
    if (draft?.properties && Object.prototype.hasOwnProperty.call(draft.properties, schema.key)) {
      state.properties[schema.key] = coerceValueFromSchema(schema, draft.properties[schema.key])
    }
  }

  const previewDirection = Number(draft?.preview?.directionDeg)
  state.previewDirectionDeg = Number.isFinite(previewDirection)
    ? Math.max(-180, Math.min(180, previewDirection))
    : state.previewDirectionDeg
  state.previewMoving = draft?.preview?.moving == null ? state.previewMoving : Boolean(draft.preview.moving)

  ui.templateType.value = state.templateType
  ui.characterKey.value = state.characterKey
  ui.displayLabel.value = state.displayLabel
  ui.addToSelectable.checked = state.addToSelectable
  ui.isSpecialHero.checked = state.isSpecialHero
  ui.specialFields.classList.toggle("hidden", !state.isSpecialHero)
  ui.specialHeroId.value = state.special.heroId
  ui.specialLabel.value = state.special.label
  ui.specialTitle.value = state.special.title
  ui.specialRarity.value = state.special.rarity
  ui.specialDescription.value = state.special.description
  ui.specialPerk.value = state.special.perk
  ui.previewDirection.value = String(Math.round(state.previewDirectionDeg))
  ui.previewDirectionValue.textContent = `${Math.round(state.previewDirectionDeg)}deg`
  ui.previewMovingToggle.checked = state.previewMoving

  syncPropertyInputsFromState()
  updateOutput()
}

function parseAndApplyJsonDraft(rawJson) {
  let parsed

  try {
    parsed = JSON.parse(rawJson)
  } catch {
    window.alert("Invalid JSON format. Please check your draft and try again.")
    return
  }

  if (!parsed || typeof parsed !== "object") {
    window.alert("Draft JSON must be an object.")
    return
  }

  applyDraftObject(parsed)
  ui.jsonDraft.value = JSON.stringify(buildDraftObject(), null, 2)
}

function bindJsonDraftTools() {
  ui.exportJsonButton.addEventListener("click", () => {
    downloadJsonDraft()
  })

  ui.applyJsonTextButton.addEventListener("click", () => {
    parseAndApplyJsonDraft(ui.jsonDraft.value)
  })

  ui.importJsonFileInput.addEventListener("change", async () => {
    const file = ui.importJsonFileInput.files?.[0]
    if (!file) {
      return
    }

    try {
      const contents = await file.text()
      parseAndApplyJsonDraft(contents)
    } catch {
      window.alert("Could not read the selected JSON file.")
    } finally {
      ui.importJsonFileInput.value = ""
    }
  })
}

function formatJsValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "0"
    }
    const rounded = Math.round(value * 1000) / 1000
    return Number.isInteger(rounded) ? String(rounded) : String(rounded)
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return "null"
}

function buildCharacterTypeSnippet() {
  const key = sanitizeKey(state.characterKey)
  const lines = [`${key}: {`]

  for (const schema of PARAM_SCHEMA) {
    lines.push(`  ${schema.key}: ${formatJsValue(state.properties[schema.key])},`)
  }

  lines.push("},")
  return lines.join("\n")
}

function buildDisplayLabelSnippet() {
  const key = sanitizeKey(state.characterKey)
  return `${key}: ${formatJsValue(state.displayLabel || key)},`
}

function buildSelectableSnippet() {
  if (!state.addToSelectable) {
    return "(disabled)"
  }

  return `${formatJsValue(sanitizeKey(state.characterKey))},`
}

function buildSpecialSnippet() {
  if (!state.isSpecialHero) {
    return "(disabled)"
  }

  const key = sanitizeKey(state.characterKey)
  const heroId = sanitizeKey(state.special.heroId)

  return [
    `${key}: {`,
    `  heroId: ${formatJsValue(heroId)},`,
    `  characterType: ${formatJsValue(key)},`,
    `  label: ${formatJsValue(state.special.label || state.displayLabel || key)},`,
    `  title: ${formatJsValue(state.special.title || "Legendary Hero")},`,
    `  rarity: ${formatJsValue(state.special.rarity || "Legendary")},`,
    `  description: ${formatJsValue(state.special.description || "")},`,
    `  perk: ${formatJsValue(state.special.perk || "")},`,
    `},`,
  ].join("\n")
}

function updateOutput() {
  const sections = [
    "// Paste into CHARACTER_TYPES",
    buildCharacterTypeSnippet(),
    "",
    "// Paste into CHARACTER_DISPLAY_LABELS",
    buildDisplayLabelSnippet(),
    "",
    "// Optional: add into SELECTABLE_CHARACTER_TYPES array",
    buildSelectableSnippet(),
    "",
    "// Optional: paste into SPECIAL_CHARACTER_DEFINITIONS",
    buildSpecialSnippet(),
  ]

  ui.outputSnippet.value = sections.join("\n")
  ui.jsonDraft.value = JSON.stringify(buildDraftObject(), null, 2)
}

function startPreviewLoop() {
  const ctx = ui.previewCanvas.getContext("2d")
  if (!ctx) {
    return
  }

  let lastTime = performance.now()
  let animationTime = 0

  const render = (now) => {
    const dt = Math.min(34, now - lastTime)
    lastTime = now
    animationTime += dt * 0.015

    const width = ui.previewCanvas.width
    const height = ui.previewCanvas.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "rgba(3, 12, 16, 0.88)"
    ctx.fillRect(0, 0, width, height)

    const character = createCharacter(state.templateType, { ...state.properties })
    character.health = Math.max(1, Math.round(Number(character.health) || 1))

    const directionRad = (state.previewDirectionDeg * Math.PI) / 180
    drawCharacterPreview(ctx, character, {
      x: width / 2,
      y: height / 2,
      scale: 2.3,
      direction: directionRad,
      isMoving: state.previewMoving,
      animationTime,
    })

    requestAnimationFrame(render)
  }

  requestAnimationFrame(render)
}

init()
