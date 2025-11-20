const state = {
  recipes: [],
  currentIndex: 0,
  isTransitioning: false,
  html2canvasPromise: null,
  lastSwipeTime: 0,
  loadTimeoutId: null
};

const elements = {
  card: document.getElementById("recipe-card"),
  title: document.getElementById("recipe-title"),
  tags: document.getElementById("recipe-tags"),
  image: document.getElementById("recipe-image"),
  servings: document.getElementById("recipe-servings"),
  ingredients: document.getElementById("recipe-ingredients"),
  instructions: document.getElementById("recipe-instructions"),
  tipsSection: document.getElementById("recipe-tips"),
  tipsText: document.getElementById("recipe-tips-text"),
  prevButton: document.getElementById("prev-button"),
  nextButton: document.getElementById("next-button"),
  randomButton: document.getElementById("random-button"),
  captureButton: document.getElementById("capture-button"),
  toast: document.getElementById("toast"),
  loadingOverlay: document.getElementById("loading-overlay"),
  app: document.getElementById("app")
};

const swipe = {
  startX: null,
  startY: null,
  diffX: 0,
  diffY: 0,
  active: false
};

const SWIPE_THRESHOLD = 60;
const SWIPE_COOLDOWN_MS = 320;
const SWIPE_DRAG_MULTIPLIER = 0.55;
const LOAD_FAIL_TIMEOUT_MS = 5000;

async function init() {
  toggleLoading(true);
  startLoadFailSafeguard();
  try {
    attachEventListeners();
    const recipes = await fetchRecipes();
    state.recipes = recipes;
    if (!recipes.length) {
      showToast("Reseptit puuttuvat", "error");
      renderEmptyState();
      return;
    }
    renderRecipe(0);
    clearLoadFailSafeguard();
  } catch (error) {
    console.error("Reseptien lataus epäonnistui", error);
    const isFileProtocol = window.location.protocol === "file:";
    const errorMessage = isFileProtocol
      ? "Avaa sivu paikallisen palvelimen kautta (esim. http://localhost:8000/)."
      : `Reseptien lataus epäonnistui: ${error.message}`;

    renderEmptyState(errorMessage);
    toggleLoading(false);
    showToast(errorMessage, "error");
  } finally {
    toggleLoading(false);
    clearLoadFailSafeguard();
  }
}

async function fetchRecipes() {
  const response = await fetch("reseptit.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Virhekoodi ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("JSON ei sisällä reseptilistaa");
  }
  return data;
}

function renderRecipe(index, options = {}) {
  const recipe = state.recipes[index];
  if (!recipe) {
    return;
  }

  state.currentIndex = index;
  updateCardContent(recipe);
  updateNavButtons();

  if (options.animateDirection) {
    state.isTransitioning = true;
    if (typeof elements.card.animate === "function") {
      const offset = options.animateDirection === "next" ? 36 : -36;
      const animation = elements.card.animate(
        [
          { transform: `translateX(${offset}px)`, opacity: 0 },
          { transform: "translateX(0)", opacity: 1 }
        ],
        {
          duration: 260,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)"
        }
      );
      animation.addEventListener("finish", () => {
        state.isTransitioning = false;
      });
      animation.addEventListener("cancel", () => {
        state.isTransitioning = false;
      });
    } else {
      state.isTransitioning = false;
    }
  } else {
    state.isTransitioning = false;
  }

  resetCardTransform();
}

function updateCardContent(recipe) {
  elements.title.textContent = recipe.title;
  elements.image.src = recipe.image || "kuvat/placeholder.svg";
  elements.image.alt = recipe.imageAlt || recipe.title;
  if (recipe.servings) {
    elements.servings.textContent = recipe.servings;
    elements.servings.hidden = false;
  } else {
    elements.servings.textContent = "";
    elements.servings.hidden = true;
  }

  if (Array.isArray(recipe.tags) && recipe.tags.length) {
    elements.tags.textContent = recipe.tags.join(" · ");
    elements.tags.hidden = false;
  } else {
    elements.tags.textContent = "";
    elements.tags.hidden = true;
  }

  populateList(elements.ingredients, recipe.shoppingList);
  populateList(elements.instructions, recipe.instructions, true);

  if (recipe.tips) {
    elements.tipsText.textContent = recipe.tips;
    elements.tipsSection.hidden = false;
  } else {
    elements.tipsText.textContent = "";
    elements.tipsSection.hidden = true;
  }
}

function populateList(container, items, ordered = false) {
  container.innerHTML = "";
  if (!Array.isArray(items) || !items.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = ordered ? "Ei ohjeita saatavilla." : "Ei tarvikkeita saatavilla.";
    container.append(emptyItem);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.append(li);
  });
}

function updateNavButtons() {
  const total = state.recipes.length;
  const single = total <= 1;
  elements.prevButton.disabled = single || state.currentIndex === 0;
  elements.nextButton.disabled = single || state.currentIndex === total - 1;
  if (elements.randomButton) {
    elements.randomButton.disabled = single;
  }
}

function resetCardTransform() {
  elements.card.style.transition = "";
  elements.card.style.transform = "";
}

function renderEmptyState(message = "Lisää reseptit reseptit.json-tiedostoon") {
  state.recipes = [];
  state.currentIndex = 0;
  elements.title.textContent = "Reseptit puuttuvat";
  elements.tags.textContent = "";
  elements.image.src = "kuvat/placeholder.svg";
  elements.image.alt = "Paikkakuva";
  elements.servings.textContent = "";
  elements.servings.hidden = true;
  elements.ingredients.innerHTML = `<li>${message}</li>`;
  elements.instructions.innerHTML = `<li>${message}</li>`;
  elements.tipsSection.hidden = true;
  updateNavButtons();
}

function startLoadFailSafeguard() {
  clearLoadFailSafeguard();
  state.loadTimeoutId = window.setTimeout(() => {
    if (state.recipes.length) {
      return;
    }
    const message = window.location.protocol === "file:"
      ? "Avaa sivu paikallisen palvelimen kautta (esim. http://localhost:8000/)."
      : "Reseptien lataus kestää odotettua pidempään. Päivitä sivu tai tarkista yhteys.";
    renderEmptyState(message);
    toggleLoading(false);
    showToast(message, "error");
  }, LOAD_FAIL_TIMEOUT_MS);
}

function clearLoadFailSafeguard() {
  if (state.loadTimeoutId) {
    window.clearTimeout(state.loadTimeoutId);
    state.loadTimeoutId = null;
  }
}

function navigate(direction, origin = "button") {
  if (!state.recipes.length || state.isTransitioning) {
    if (origin === "swipe") bounceCard(direction);
    return;
  }

  const atStart = state.currentIndex === 0;
  const atEnd = state.currentIndex === state.recipes.length - 1;

  if ((direction < 0 && atStart) || (direction > 0 && atEnd)) {
    if (origin === "swipe") bounceCard(direction);
    return;
  }

  if (origin === "swipe") {
    const now = performance.now();
    if (now - state.lastSwipeTime < SWIPE_COOLDOWN_MS) {
      return;
    }
    state.lastSwipeTime = now;
  }

  if (direction > 0) {
    renderRecipe(state.currentIndex + 1, { animateDirection: "next" });
  } else {
    renderRecipe(state.currentIndex - 1, { animateDirection: "prev" });
  }
}

function showPrevRecipe() {
  navigate(-1);
}

function showNextRecipe() {
  navigate(1);
}

function showRandomRecipe() {
  const total = state.recipes.length;
  if (state.isTransitioning || total <= 1) {
    if (total <= 1) {
      showToast("Tarvitaan useampi resepti arvontaa varten.", "info");
    }
    return;
  }

  let randomIndex = state.currentIndex;
  while (randomIndex === state.currentIndex) {
    randomIndex = Math.floor(Math.random() * total);
  }

  const animateDirection = randomIndex > state.currentIndex ? "next" : "prev";
  renderRecipe(randomIndex, { animateDirection });
}

function attachEventListeners() {
  if (!elements.card) {
    console.error("Reseptikortin elementti puuttuu.");
    return;
  }

  if (elements.prevButton) {
    elements.prevButton.addEventListener("click", showPrevRecipe);
  }
  if (elements.nextButton) {
    elements.nextButton.addEventListener("click", showNextRecipe);
  }
  if (elements.randomButton) {
    elements.randomButton.addEventListener("click", showRandomRecipe);
  }
  if (elements.captureButton) {
    elements.captureButton.addEventListener("click", captureCard);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevRecipe();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNextRecipe();
    }
  });

  elements.card.addEventListener("touchstart", onTouchStart, { passive: true });
  elements.card.addEventListener("touchmove", onTouchMove, { passive: false });
  elements.card.addEventListener("touchend", onTouchEnd);
  elements.card.addEventListener("touchcancel", resetTouch);
}

function onTouchStart(event) {
  if (event.touches.length > 1) return;
  const touch = event.touches[0];
  swipe.startX = touch.clientX;
  swipe.startY = touch.clientY;
  swipe.diffX = 0;
  swipe.diffY = 0;
  swipe.active = true;
}

function onTouchMove(event) {
  if (!swipe.active || event.touches.length > 1) return;
  const touch = event.touches[0];
  swipe.diffX = touch.clientX - swipe.startX;
  swipe.diffY = touch.clientY - swipe.startY;
  const isHorizontalIntent = Math.abs(swipe.diffX) > Math.abs(swipe.diffY);
  if (isHorizontalIntent) {
    event.preventDefault();
    const direction = swipe.diffX < 0 ? 1 : -1;
    const atBoundary = (direction < 0 && state.currentIndex === 0) ||
      (direction > 0 && state.currentIndex === state.recipes.length - 1);
    const multiplier = atBoundary ? SWIPE_DRAG_MULTIPLIER / 2 : SWIPE_DRAG_MULTIPLIER;
    elements.card.style.transform = `translateX(${swipe.diffX * multiplier}px)`;
  }
}

function onTouchEnd() {
  if (!swipe.active) return;
  const threshold = SWIPE_THRESHOLD;
  const isHorizontalIntent = Math.abs(swipe.diffX) > Math.abs(swipe.diffY);
  if (isHorizontalIntent && Math.abs(swipe.diffX) > threshold) {
    const direction = swipe.diffX < 0 ? 1 : -1;
    navigate(direction, "swipe");
  } else {
    bounceCard(0);
  }
  resetTouch();
}

function resetTouch() {
  swipe.startX = null;
  swipe.startY = null;
  swipe.diffX = 0;
  swipe.diffY = 0;
  swipe.active = false;
  elements.card.style.transition = "transform 180ms ease-out";
  elements.card.style.transform = "translateX(0)";
  window.requestAnimationFrame(() => {
    elements.card.style.transition = "";
  });
}

function bounceCard(direction) {
  if (typeof elements.card.animate !== "function") {
    resetCardTransform();
    return;
  }
  const amplitude = direction > 0 ? -16 : direction < 0 ? 16 : 8;
  elements.card.animate(
    [
      { transform: `translateX(${amplitude}px)` },
      { transform: "translateX(0)" }
    ],
    {
      duration: 240,
      easing: "cubic-bezier(0.33, 1, 0.68, 1)"
    }
  );
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function loadHtml2canvas() {
  if (state.html2canvasPromise) {
    return state.html2canvasPromise;
  }
  state.html2canvasPromise = new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve(window.html2canvas);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.defer = true;
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error("html2canvas ei latautunut"));
    document.head.append(script);
  });
  return state.html2canvasPromise;
}

async function captureCard() {
  if (!state.recipes.length) {
    showToast("Ei reseptejä tallennettavaksi", "error");
    return;
  }
  try {
    showToast("Tallennetaan kuvaa…");
    const html2canvas = await loadHtml2canvas();
    if (!html2canvas) {
      throw new Error("html2canvas puuttuu");
    }
    const canvas = await html2canvas(elements.card, {
      backgroundColor: getComputedStyle(document.body).backgroundColor
    });
    await downloadCanvas(canvas, state.recipes[state.currentIndex]);
    showToast("Resepti tallennettu!", "success");
  } catch (error) {
    console.error("Kuvankaappaus epäonnistui", error);
    showToast("Tallennus epäonnistui", "error");
  }
}

function downloadCanvas(canvas, recipe) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Blobin luonti epäonnistui"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug = slugify(recipe?.title || "resepti");
      link.href = url;
      link.download = `resepti-${slug || "kotiruoka"}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png", 1);
  });
}

function showToast(message, type = "info") {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.hidden = false;
  elements.toast.dataset.visible = "true";
  clearTimeout(showToast.timeoutId);
  clearTimeout(showToast.hideId);
  showToast.timeoutId = setTimeout(() => {
    elements.toast.dataset.visible = "false";
    showToast.hideId = setTimeout(() => {
      elements.toast.hidden = true;
    }, 320);
  }, 2600);
}

function toggleLoading(show) {
  if (!elements.loadingOverlay) return;
  elements.loadingOverlay.hidden = !show;
  elements.loadingOverlay.style.display = show ? "flex" : "none";
}

document.addEventListener("DOMContentLoaded", init);
