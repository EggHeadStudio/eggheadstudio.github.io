Build Guide: Helppoa Kotiruokaa

This playbook defines everything needed to implement a static, mobile-first recipe viewer delivered in Finnish. The build should stay lightweight so the MVP ships within an hour. All UI copy, recipe data, and imagery remain Finnish even though the instructions below are in English.

⸻

1. Product Brief

Goal: Publish a single-page web app that shows one affordable Finnish home-cooking recipe per view, supports swipe navigation, and exports the visible card as an image.

Key traits:
	•	Responsive layout tuned for phones first, scales to tablet/desktop.
	•	Offline-friendly: data comes from a bundled JSON file, no backend.
	•	Touch gestures: horizontal swipe to move between recipes.
	•	Action button: “Tallenna kuvana” triggers html2canvas capture of the recipe card.
	•	Finnish content: titles, ingredient lists, instructions, and buttons use simple Finnish.
	•	Deployable on GitHub Pages with relative paths only.

Tech stack:
	•	Vanilla HTML, CSS, JavaScript.
	•	Optional helper: html2canvas (loaded from CDN).
	•	Static hosting via GitHub Pages.

⸻

2. Target Directory Layout

root/
  index.html
  style.css
  app.js
  reseptit.json
  kuvat/
    (placeholder or real photos, Finnish file names)

Add a `README.md` later if helpful, but do not block implementation on documentation.

⸻

3. Feature Requirements
	•	Swipe left/right between recipes with smooth transitions and bounds handling.
	•	Render recipe card with title, hero image, servings info, shopping list, and instructions.
	•	Persist current index in memory; reset gracefully if JSON fails to load.
	•	Fallback UI states: loading indicator, empty-state message, swipe disabled on single recipe.
	•	Capture button uses html2canvas to download a PNG of the current card.
	•	Ensure ARIA labels and focus states so keyboard usage is acceptable even if touch is primary.

⸻

4. Implementation Milestones

Milestone 1: Project bootstrap
	•	Create folder structure, initialize Git, add `.gitignore` (node_modules, dist, DS_Store).
	•	Lay down barebones HTML skeleton referencing `style.css` and `app.js`.
	•	Include viewport meta, web-safe fonts, and root CSS variables.

Milestone 2: Data model
	•	Author `reseptit.json` with 6-8 budget-friendly Finnish dishes aimed at five-person families.
	•	Use consistent object keys: `id`, `title`, `image`, `tags`, `servings`, `shoppingList`, `instructions`, `tips` (optional).
	•	Keep ingredient quantities realistic, align instructions with Finnish cooking terminology.

Milestone 3: UI scaffolding
	•	Build card layout in `index.html` with semantic elements (`main`, `article`, `header`, `section`).
	•	Wire up placeholder text in Finnish so the page is legible without JavaScript.
	•	Add buttons for previous/next and capture (visible on desktop as backups for swipe).

Milestone 4: Styling
	•	In `style.css`, implement a centered card, use flexbox/ grid for layout, keep colors warm and food-friendly.
	•	Optimize for 360px width, add fluid typography, and ensure tap targets ≥ 44px.
	•	Define animation classes for enter/exit transitions triggered by swipe.

Milestone 5: App logic
	•	Fetch `reseptit.json`, hydrate state, handle errors with toast-style message in Finnish.
	•	Implement swipe detection via `touchstart`, `touchmove`, `touchend` with threshold of ~60px.
	•	Trigger CSS transitions; prevent overscrolling beyond first/last recipe.
	•	Implement `renderRecipe(index)` to update DOM nodes efficiently; avoid full reflow.
	•	Hook buttons to the same navigation logic as swipe for accessibility.

Milestone 6: Capture workflow
	•	Load html2canvas from CDN only when capture button is first pressed (lazy load).
	•	Wrap capture logic in `captureCard()`; name download file as `resepti-<slug>.png`.
	•	Provide Finnish success/error toast so the user knows the status.

Milestone 7: Assets and polish
	•	Add royalty-free images to `kuvat/`; use 3:2 ratio JPEGs compressed <200KB.
	•	Fine-tune spacing, colors, and fonts; verify dark text contrast on light backgrounds.
	•	Test gestures on Safari iOS, Chrome Android, and desktop fallback interactions.

Milestone 8: Release prep
	•	Run manual sanity tests: load, swipe both directions, capture image, reload page.
	•	Add short deployment notes to README (buildless).
	•	Enable GitHub Pages from `main` branch `root` folder; validate live URL on phones.

⸻

5. Detailed Task Checklist

index.html:
	•	Meta tags: viewport, language set to `fi`, descriptive title text.
	•	Static fallback markup for the first recipe (so content is visible without JS).
	•	Buttons: `Edellinen`, `Seuraava`, `Tallenna kuvana`.
	•	Include `noscript` block warning that swipe requires JavaScript.

style.css:
	•	Root CSS variables for palette, spacing, font sizes.
	•	Reset styles to ensure consistent look across browsers.
	•	Card styling with soft shadow, rounded corners, subtle gradient header.
	•	Animation classes `.swipe-left` and `.swipe-right` for transitions.

app.js:
	•	Asynchronous init that fetches JSON, sets state, and calls `renderRecipe`.
	•	Event listeners for swipe, buttons, and keyboard arrows.
	•	`renderRecipe` updates DOM text, image `src`/`alt`, and toggles disabled states.
	•	Capture logic handles html2canvas loading, canvas conversion, and download link.
	•	Graceful error handling; log to console and show Finnish toast.

reseptit.json:
	•	Array of objects; ensure valid JSON (double quotes, no trailing commas).
	•	Images referenced with relative paths like `kuvat/makaronilaatikko.jpg`.
	•	Ingredients include measures in metric (g, ml) and Finnish names.
	•	Instructions broken into short sentences for readability on small screens.

kuvat/:
	•	Name files with Finnish slugs, e.g. `broilerikastike.jpg`.
	•	If no real photos, create simple branded placeholders via Figma/Canva.

⸻

6. Prompt Playbook

Quick-start prompt (single message to Copilot Agent):

“Create the Helppoa Kotiruokaa static recipe app (Finnish UI) with index.html, style.css, app.js, reseptit.json, and a kuvat/ folder. One recipe card visible at a time, swipe left/right using touch events, and a ‘Tallenna kuvana’ button that captures the card via html2canvas. Use Finnish labels/content, mobile-first responsive design, smooth transitions, keyboard fallback buttons, and relative asset paths for GitHub Pages.”

Follow-up prompts if iteration is needed:
	1.	“Enhance swipe handling in app.js to debounce rapid gestures and prevent overswiping.”
	2.	“Polish style.css for modern mobile look: center card, soft shadows, warm palette, readable Finnish typography.”
	3.	“Expand reseptit.json with 3 additional edulliset perheruoat including servings, shopping list, and valmistusohjeet.”
	4.	“Lazy-load html2canvas so it only downloads on first capture; add Finnish toast notifications.”
	5.	“Draft README.md with setup, testing, and GitHub Pages deployment steps in Finnish.”

⸻

7. Acceptance Criteria
	•	Page loads instantly on mobile data; bundle size under 250 KB excluding images.
	•	Swipe feels natural on iOS/Android and keyboard buttons still navigate.
	•	Capture saves a PNG with correct Finnish filename and no scrollbars.
	•	All text displayed in Finnish; instructions use clear, everyday language.
	•	Works offline after first load (no external fonts except optional system stack).

⸻

8. Final QA & Launch Notes
	•	Manual test matrix: Chrome Android, Safari iOS, desktop Chrome (keyboard only).
	•	Check that JSON caching is not too aggressive; force refresh after edits during dev.
	•	Verify GitHub Pages build by opening the live URL on devices and repeating swipe/capture tests.
	•	Prepare marketing copy (optional) focusing on arjen helppous and budjettiystavallisyys.

⸻

Use this document as the authoritative script when guiding Copilot Agent. Adjust prompts as you iterate, but keep Finnish-language content intact throughout development.