# IDEA

## Goal
Make the game open through a special URL or NFC tag so that it loads a specific character profile in the main menu, while still letting the game work normally for everyone else.

## What is already in place
The game already has the right structure for this idea:
- [js/entities/character-factory.js](js/entities/character-factory.js): defines all character types, visual style, stats, and customization rules.
- [js/ui/start-menu.js](js/ui/start-menu.js): renders the character menu and the live preview.
- [js/core/game.js](js/core/game.js): bootstraps the game using `startupConfig`.
- [js/entities/player.js](js/entities/player.js): renders the character preview using the same visual pipeline as the game.

This means the data model is already centralized, and the URL system would be a small layer on top of it rather than a redesign.

## How a special character would work
We would add a URL-based override in the startup flow:
1. read the current URL
2. look for a `hero` or `character` parameter
3. match that value to a known character profile
4. set `gameState.startupConfig` to that profile before the start menu or game loads
5. render the main menu card and preview from that exact profile

Example URL patterns:
- `https://eggheadstudio.github.io/?hero=ember-01`
- `https://eggheadstudio.github.io/?hero=odin-rare`
- `https://www.eggheadstudio.fi/?hero=ember-01`

If the URL is missing or invalid, the app falls back to the normal character menu.

## How new characters are created
A character is basically a data object. Right now the project already does this in [js/entities/character-factory.js](js/entities/character-factory.js):
- name / display label
- palette color
- hair style
- size
- health
- speed
- strength
- special visual flags like glasses, beard, backpack, etc.

To add a new one, we add a new object into the same registry and then expose it in the selectable list. The menu preview will automatically show it because the preview is drawn from the same factory data.

## How to see what each character looks like
The preview already exists in [js/ui/start-menu.js](js/ui/start-menu.js):
- the character list buttons render options
- clicking a character updates `gameState.startupConfig.characterType`
- `renderCharacterPreview()` draws the selected character in a canvas
- the same factory data is used for in-game rendering

So the exact workflow is:
- add or modify the character object in [js/entities/character-factory.js](js/entities/character-factory.js)
- refresh the menu
- the preview canvas updates immediately
- when started, the player is created from the same `createCharacter(...)` logic

## How to create a hero card for the menu
The menu should use a card layout, not just a list item. For each URL hero we can render a card with:
- portrait or preview image
- name
- title
- stats
- lore text
- special ability / perk
- rarity label

This fits very naturally into the current menu model because the current menu already supports an interactive preview area.

## URL design for each character
The cleanest approach is a short static ID instead of putting full character data into the URL.

Example:
- `?hero=ember`
- `?hero=ember-01`
- `?hero=stormblade`
- `?hero=rare-arcane-01`

Then the game maps each ID to a data record such as:
```js
const SPECIAL_CHARACTERS = {
  ember: {
    label: 'Ember',
    type: 'default',
    color: '#ff7a59',
    health: 7,
    speed: 4,
    strength: 3,
    rarity: 'Legendary',
    cardTitle: 'Ashen Warden',
    perk: 'Stronger digging and faster recovery'
  }
}
```

This is very easy to expand, and each new character simply gets a new ID and card config.

## Can we make more modifications later?
Yes. This is one of the best parts of the current design.

Because the character data is centralized in [js/entities/character-factory.js](js/entities/character-factory.js), you can add:
- new hair styles
- new outfits
- new stat ranges
- unique perks
- new card art and cards
- new special character-only traits

The game startup and menu already pass these values through the same config pipeline, so this scales well.

## Important security note
For a basic GitHub Pages product, this is absolutely doable as a hidden or special URL system. But if the goal is to make the character truly unique and not copyable, static GitHub Pages cannot fully protect it from inspection.

For a real premium / one-of-one setup, you would eventually want:
- signed URLs
- backend validation
- owner check / token generation
- or a custom domain / server-managed asset flow

That said, for a prototype, a special URL + unique character ID is perfectly realistic and easy to build.

## Best practical version
The best plan for your case is:
1. Keep the normal character system as it is.
2. Add a special `?hero=` parameter that loads a locked character profile.
3. Show a big hero card in the menu when that profile is active.
4. Keep a fallback normal menu when there is no hero override.
5. Use your custom domain `www.eggheadstudio.fi` as the friendly entry point and redirect to the GitHub Pages app while preserving the query string.

That gives you a clean “special edition character” system without needing a full backend right away.