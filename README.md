# Small Game

Current project tuning and variable reference.

This file lists the variables you can change right now, and where each one is defined.

## Recent gameplay updates

- Tools:
  - Sledgehammer and shovel are collectible tools.
  - Tool selection is a single cycle control in the top-left HUD:
    - none -> sledgehammer -> shovel

- Digging and holes:
  - Shovel can dig nearby land tiles into holes.
  - Hole groups flood when connected to water.
  - Flooded holes render and behave like water.
  - Dry holes can trap enemies when the hole area is large enough.

- Water behavior consistency:
  - Player and enemies use water-like checks so flooded holes are treated as water.
  - Player is nudged to nearest safe land if standing on a flooded tile.

- Weapon selection:
  - Weapon selection is a single cycle control:
    - wrist -> apple -> bomb
  - The HUD shows count for the currently selected weapon (or '-' for wrist).

- Bomb inventory flow:
  - Idle bombs on ground are collectible into bomb inventory.
  - With bomb selected, Space (desktop) or A (mobile) places a timed bomb in front of the player.
  - Held-bomb visual appears in the right hand when bomb is selected.

- Tree and vehicle interactions:
  - Cars now collide with tree trunks.
  - Tree canopies render as an overlay so cars and entities appear under leaves.

## Run locally

- Desktop: open `index.html`
- Mobile test server:
  - `npm run serve:mobile`
  - If port is busy: `PORT=5501 npm run serve:mobile`

## 1) Core gameplay constants

Main file: `js/core/constants.js`

### World and camera

- `TILE_SIZE`
- `WORLD_SIZE_MULTIPLIER`
- `WORLD_MAP_SIZE`
- `MINIMAP_VISIBLE_TILES_MOBILE`
- `MINIMAP_VISIBLE_TILES_DESKTOP`
- `MOBILE_VIEWPORT_SCALE`

### Player

- `PLAYER_SIZE`
- `PLAYER_SPEED`
- `PLAYER_HEAL_DELAY_MS`
- `PLAYER_HEAL_UNDER_ROOF_MULTIPLIER`

### Character stat budget

- `CHARACTER_ATTRIBUTE_BUDGET`
  - Shared cap for `health + speed + strength` during character customization.
  - Default is `12`.

### Basic entity sizes and speeds

- `BOMB_SIZE`
- `APPLE_SIZE`
- `SLEDGEHAMMER_SIZE`
- `ROCK_SIZE`
- `CAR_SIZE`
- `BOAT_SIZE`
- `APPLE_THROW_SPEED`

### Enemy defaults and variants

- `ENEMY_SIZE`
- `ENEMY_SPEED`
- `ENEMY_CHASE_SPEED`
- `ENEMY_SWIM_SPEED`
- `ENEMY_SPAWN_INTERVAL`

Per-color enemy tuning:

- `ENEMY_RED_COLOR`
- `ENEMY_RED_SIZE`
- `ENEMY_RED_HEALTH`
- `ENEMY_RED_SPEED`
- `ENEMY_RED_CHASE_SPEED`
- `ENEMY_RED_SWIM_SPEED`

- `ENEMY_YELLOW_COLOR`
- `ENEMY_YELLOW_SIZE`
- `ENEMY_YELLOW_HEALTH`
- `ENEMY_YELLOW_SPEED`
- `ENEMY_YELLOW_CHASE_SPEED`
- `ENEMY_YELLOW_SWIM_SPEED`

- `ENEMY_BLACK_COLOR`
- `ENEMY_BLACK_SIZE`
- `ENEMY_BLACK_HEALTH`
- `ENEMY_BLACK_SPEED`
- `ENEMY_BLACK_CHASE_SPEED`
- `ENEMY_BLACK_SWIM_SPEED`

### Initial world amounts

- `INITIAL_RED_ENEMY_COUNT`
- `INITIAL_YELLOW_ENEMY_COUNT`
- `INITIAL_BLACK_ENEMY_COUNT`
- `INITIAL_ENEMY_COUNT`
- `INITIAL_APPLE_COUNT`
- `INITIAL_BOMB_COUNT`
- `ROCK_COUNT`
- `WOODEN_BOX_COUNT`
- `CAR_COUNT`
- `BOAT_COUNT`
- `SLEDGEHAMMER_COUNT`

### Ongoing spawn/respawn tuning

- `ENEMY_SPAWN_BATCH_RED`
- `ENEMY_SPAWN_BATCH_YELLOW`
- `ENEMY_SPAWN_BATCH_BLACK`
- `ENEMY_SPAWN_BATCH`

- `APPLE_RESPAWN_THRESHOLD`
- `APPLE_RESPAWN_BATCH`

- `BOMB_RESPAWN_THRESHOLD`
- `BOMB_RESPAWN_BATCH`

- `WOODEN_BOX_RESPAWN_THRESHOLD`
- `WOODEN_BOX_RESPAWN_BATCH`

### Wooden box behavior

- `WOODEN_BOX_SIZE`
- `WOODEN_BOX_THROW_MULTIPLIER`
- `WOODEN_BOX_FLOAT_SPEED`
- `WOODEN_BOX_SNAP_DISTANCE`

### Tree system

- `TREE_SIZE`
- `TREE_HIT_POINTS`
- `TREE_MIN_SPACING`
- `TREE_TILE_FILL_CHANCE`
- `TREE_MAX_APPLES`
- `TREE_APPLE_VALUE`

### Vehicle handling

- `CAR_SPEED`
- `CAR_INTERACTION_RANGE`
- `CAR_MAX_HEALTH`
- `CAR_MAX_SPEED`
- `CAR_ACCELERATION`
- `CAR_DECELERATION`
- `CAR_DRIFT_FACTOR`

### Terrain enum mapping

- `TERRAIN_TYPES`

## 2) Day/night cycle variables

Main file: `js/core/day-night-cycle.js`

### Time durations

- `TRANSITION_DURATION`
- `PHASE_SEGMENTS`:
  - `day`
  - `dayToDusk`
  - `dusk`
  - `duskToNight`
  - `night`
  - `nightToDawn`
  - `dawn`
  - `dawnToDay`

### Visual lighting presets

- `LIGHTING_PRESETS.day`
- `LIGHTING_PRESETS.dusk`
- `LIGHTING_PRESETS.night`
- `LIGHTING_PRESETS.dawn`

Each preset supports:

- `overlayColor`
- `overlayAlpha`
- `vignetteAlpha`
- `haloColor`
- `haloAlpha`
- `lightRadius`
- `beamLength`
- `beamWidth`

### Start offsets

- `START_OFFSETS.day`
- `START_OFFSETS.dusk`
- `START_OFFSETS.night`
- `START_OFFSETS.dawn`

### Mobile night override

Function `getNightLighting()` in the same file sets mobile values:

- `lightRadius` (mobile)
- `beamLength` (mobile)
- `beamWidth` (mobile)

## 3) Character and menu tuning

### Character archetypes and limits

Main file: `js/entities/character-factory.js`

- `CHARACTER_TYPES` (per character base values)
  - `default`
  - `rasse`
  - `iida`
  - `andrus`
  - `lidia`
  - `elli`
  - `niko`
  - `mara`
  - `taro`

Per-type fields currently used:

- `size`
- `speed`
- `health`
- `color`
- `strength`
- `handColor`
- `footColor`
- `backpackColor`
- `backpackPocketColor`
- `hairStyle`
- `hairColor`
- `hasGlasses`
- `hasSunglasses`
- `hasLashes`
- `hasBeard`
- `glassesColor`
- `beardColor`
- `backpackWidthScale`
- `backpackHeightScale`
- `backpackRoundness`

Other related variables in this file:

- `SELECTABLE_CHARACTER_TYPES`
- `CHARACTER_DISPLAY_LABELS`
- `CHARACTER_CUSTOMIZATION_RULES.health.min`
- `CHARACTER_CUSTOMIZATION_RULES.health.max`
- `CHARACTER_CUSTOMIZATION_RULES.speed.min`
- `CHARACTER_CUSTOMIZATION_RULES.speed.max`
- `CHARACTER_CUSTOMIZATION_RULES.strength.min`
- `CHARACTER_CUSTOMIZATION_RULES.strength.max`

Budget enforcement for these stats is implemented in:

- `normalizeCharacterCustomization(...)` in `js/entities/character-factory.js`
- `updateCharacterAttributes(...)` in `js/ui/start-menu.js`

### Start menu options and preview tuning

Main file: `js/ui/start-menu.js`

- `PREVIEW_CANVAS_SIZE`
- `PREVIEW_SCALE`
- `TIME_OPTIONS`
- `MENU_COPY.start`
- `MENU_COPY.pause`
- `MENU_COPY.gameover`

## 4) Terrain animation and look tuning

Main file: `js/terrain/terrain-renderer.js`

Global animation variables:

- `windPhase` (inside `drawTerrain`)
- `gustStrength` (inside `drawTerrain`)

Terrain style values are currently set inline in this file, including:

- Water wave speed/amplitude multipliers
- Grass blade count, height range, and bend strength
- Forest sway strength
- Dirt crack counts, branch chance, and segment lengths

If you want slower/faster grass or different crack density, edit these numbers directly in this file.

## 5) Tree behavior details (non-constant file-level tunables)

Main file: `js/entities/trees.js`

- `TRUNK_COLLISION_FACTOR`

Tree look/behavior values currently hardcoded in this file:

- Canopy blob count and radius ranges
- Apple placement radius on canopy
- Trunk width/height ratios
- Tree sway amount
- Tree destruction particle counts/colors/speeds

## 6) Wooden box + trunk details (non-constant file-level tunables)

Main file: `js/entities/wooden-boxes.js`

Main variables are in constants, but these are also editable in-place:

- Trunk size multiplier in `createTrunk` (`WOODEN_BOX_SIZE * 0.85` currently)
- Trunk spawn protection duration in `createTrunk` (`invulnerableUntil` currently `+ 350ms`)
- Trunk visual style in `drawTrunkShape`
- Box/trunk shadow shape choice in `drawAndUpdateWoodenBoxes` and `drawGrabbedWoodenBox`

## 7) Apple pickup amount logic

Main file: `js/entities/apples.js`

Pickup logic uses:

- `player.apples += apple.value || 1`

So:

- Normal apples (no `value`) give 1.
- Special apples (for example tree-dropped apples with `value`) give that custom amount.

Tree apple value is set by:

- `TREE_APPLE_VALUE` in `js/core/constants.js`

## 8) Where major systems are initialized/used

- New-game initial spawn wiring: `js/core/game.js`
- Ongoing refill logic: `js/core/game-maintenance.js`
- Main update/draw order: `js/core/game-loop.js`

If you change any counts or spawn thresholds, these three files are where behavior is applied.

## Notes

- Most numeric tuning is centralized in `js/core/constants.js`.
- Variables listed in other files are still safe to tune; they are just currently not exported to constants.
