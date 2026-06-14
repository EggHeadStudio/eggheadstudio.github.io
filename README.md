SMALL_GAME
Vorking version 11 from 2'nd branch

Quick mobile server:

Run `npm run serve:mobile` in the project root.
The server prints the exact `http://<LAN-IP>:5500` address to open on your phone.
If port 5500 is busy, run `PORT=5501 npm run serve:mobile`.
To stop the server, go to the terminal where it is running and press `Ctrl+C`.

World density and minimap tuning:

Main file for easy amount tweaks:
`js/core/constants.js`

Change these values there:

- `WORLD_SIZE_MULTIPLIER`
	Controls how much wider the generated world is.

- `ROCK_COUNT`
	Initial number of rocks placed when a new game starts.

- `WOODEN_BOX_COUNT`
	Initial number of wooden boxes placed when a new game starts.

- `CAR_COUNT`
	Total number of cars in the world. This is kept separate from the other items.

- `SLEDGEHAMMER_COUNT`
	Total number of sledgehammers in the world.

- `INITIAL_BOMB_COUNT`
	Initial number of bombs placed when a new game starts.

- `INITIAL_ENEMY_COUNT`
	Initial number of enemies placed when a new game starts.

- `INITIAL_APPLE_COUNT`
	Initial number of apples placed when a new game starts.

- `ENEMY_SPAWN_INTERVAL`
	How often new enemies spawn during gameplay, in milliseconds.

- `ENEMY_SPAWN_BATCH`
	How many enemies are added each enemy spawn cycle.

- `APPLE_RESPAWN_THRESHOLD`
	If apples drop below this amount, the game adds more.

- `APPLE_RESPAWN_BATCH`
	How many apples are added when the apple refill triggers.

- `BOMB_RESPAWN_THRESHOLD`
	If bombs drop below this amount, the game adds more.

- `BOMB_RESPAWN_BATCH`
	How many bombs are added when the bomb refill triggers.

- `WOODEN_BOX_RESPAWN_THRESHOLD`
	If wooden boxes drop below this amount, the game adds more.

- `WOODEN_BOX_RESPAWN_BATCH`
	How many wooden boxes are added when the wooden box refill triggers.

- `MINIMAP_VISIBLE_TILES_MOBILE`
	Higher number = minimap zooms farther out on mobile.

- `MINIMAP_VISIBLE_TILES_DESKTOP`
	Higher number = minimap zooms farther out on desktop.

Files that use those tuning values:

- `js/core/game.js`
	Uses the initial world counts when a new game starts.

- `js/core/game-maintenance.js`
	Uses the apple, bomb, and wooden box refill values during play.

- `js/entities/enemies.js`
	Uses the enemy respawn interval and enemy spawn batch values during play.

- `js/ui/minimap.js`
	Uses the minimap visible-tile values for zoom level.

Day/night tuning guide:

Main file:
`js/core/day-night-cycle.js`

Exact rows to tweak right now:

- Timings for day, dusk transition, dusk hold, night, dawn transition, and dawn hold:
	rows `3-13` in `js/core/day-night-cycle.js` (`TRANSITION_DURATION` and `PHASE_SEGMENTS`).

- Start-at-phase offsets used when the game begins directly in day, dusk, night, or dawn:
	rows `59-74` in `js/core/day-night-cycle.js` (`START_OFFSETS`).

- Dusk overlay color, strength, halo color, and halo strength:
	rows `27-36` in `js/core/day-night-cycle.js` (`LIGHTING_PRESETS.dusk`).

- Night darkness amount, surrounding light radius, cone length, and cone width:
	rows `37-46` in `js/core/day-night-cycle.js` (`LIGHTING_PRESETS.night`).

- Dawn overlay color, strength, halo color, and halo strength:
	rows `47-56` in `js/core/day-night-cycle.js` (`LIGHTING_PRESETS.dawn`).

- Exact 30-second overlap time for every phase change:
	row `3` in `js/core/day-night-cycle.js` (`TRANSITION_DURATION`).

- Dusk/dawn foggy halo rendering and the general overlay draw logic:
	rows `119-158` in `js/core/day-night-cycle.js` (`drawDayNightOverlay`).

- Night surrounding player light radius gradient:
	rows `179-187` in `js/core/day-night-cycle.js`.

- Night forward cone beam shape and expansion:
	rows `193-209` in `js/core/day-night-cycle.js`.

- Mobile-specific night radius, cone length, and cone width overrides:
	rows `244-250` in `js/core/day-night-cycle.js` (`getNightLighting`).

- Soft overlap logic that fades the current state out while bringing the next state in:
	rows `215-233` and `253-263` in `js/core/day-night-cycle.js` (`getLightingState` and `interpolateLighting`).

last edits:

upcoming edits:
1.
ive made this to work, and now i want to add in the game a night mode that the game appears as night so that around the player is a vignette that kind of lights up the near roundings of the player and then fades in to total darkness We could in the black have a very slight transparency but jus a little lets say 97%. I want you to add this property in the game and I want this firstly to start to fade in present after 10s than the game has started (20s of fade in) keep this night mode on for 30s and then fade it out (20s of fade out) and make in the code a separate file that handles this night mode that i could set the variables by my self. This then needs to come in loops in the game and for this loop time i also need a variable to adjust. So can you add this and then i could try this out? the variables that i need are (fade_in_time, fade_out_time, duration_time(how long does the total darkness last) and a start_loop_time (how long after daylight this night loop starts)), So can you do this for me, please?

2.
Also in the game I would like to have a car where the character could "jump on"(use) by pressing the spacebar (A button in mobile), this car should be attatched beneath the character and the character animation should set the hands foreward, like it is holding the wheel. Also the car should have somekind of animation when moving (spinning the wheels and throwing some particles from the wheels as dirt) and animation when it is in stational mode. The car should give the player more speed as we move along with the car, like in real life. When player wants to exit the wehicle we just press the spacebar (A button in mobile). The car should have collision

3.
thanks and now i would like to have also a starting menu where i can choose a player that has a different kind of look (color, face, maeby a backpack) and stats, so we should read