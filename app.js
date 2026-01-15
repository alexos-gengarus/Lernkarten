const fileInput = document.getElementById("file-input");
const deckList = document.getElementById("deck-list");
const cardQuestion = document.getElementById("card-question");
const cardAnswer = document.getElementById("card-answer");
const showAnswerButton = document.getElementById("show-answer");
const markWrongButton = document.getElementById("mark-wrong");
const markRightButton = document.getElementById("mark-right");
const activeDeckLabel = document.getElementById("active-deck");
const deckProgress = document.getElementById("deck-progress");
const clearStorageButton = document.getElementById("clear-storage");

const STORAGE_KEY = "lernkarte_decks_v1";
const INTERVALS_DAYS = [1, 1, 1, 7, 14, 28];

let decks = loadDecks();
let activeDeckId = null;
let currentCard = null;

function loadDecks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Fehler beim Laden der Decks", error);
    return [];
  }
}

function saveDecks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function normalizeCards(cards) {
  return cards.map((card, index) => ({
    id: card.id ?? `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    question: card.question ?? "",
    answer: card.answer ?? "",
    categories: Array.isArray(card.categories) ? card.categories : [],
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
    box: 1,
    nextReview: new Date().toISOString(),
    lastReviewed: null,
  }));
}

function calculateStatus(box) {
  if (box <= 3) return "Lernen";
  if (box <= 5) return "Wiederholen";
  return "Wissen";
}

function isDue(card) {
  if (!card.nextReview) return true;
  return new Date(card.nextReview) <= new Date();
}

function getDeckStats(deck) {
  const total = deck.cards.length;
  const due = deck.cards.filter(isDue).length;
  const learned = deck.cards.filter((card) => card.box === 6).length;
  return { total, due, learned };
}

function renderDeckList() {
  deckList.innerHTML = "";
  if (decks.length === 0) {
    deckList.innerHTML = "<p>Noch keine Kartensätze importiert.</p>";
    return;
  }

  decks.forEach((deck) => {
    const stats = getDeckStats(deck);
    const deckItem = document.createElement("div");
    deckItem.className = "deck-item";

    deckItem.innerHTML = `
      <strong>${deck.name}</strong>
      <span>${stats.total} Karten · ${stats.due} fällig · ${stats.learned} in Wissen</span>
      <div class="deck-actions">
        <button type="button" data-action="study" data-id="${deck.id}">Lernen</button>
        <button type="button" data-action="reset" data-id="${deck.id}">Fortschritt zurücksetzen</button>
        <button type="button" data-action="remove" data-id="${deck.id}">Entfernen</button>
      </div>
    `;
    deckList.appendChild(deckItem);
  });
}

function renderActiveDeck() {
  const deck = decks.find((item) => item.id === activeDeckId);
  if (!deck) {
    activeDeckLabel.textContent = "Kein Kartensatz ausgewählt";
    deckProgress.textContent = "";
    cardQuestion.innerHTML = "Bitte Kartensatz auswählen.";
    cardAnswer.innerHTML = "";
    cardAnswer.classList.add("hidden");
    showAnswerButton.disabled = true;
    markWrongButton.disabled = true;
    markRightButton.disabled = true;
    currentCard = null;
    return;
  }

  const stats = getDeckStats(deck);
  activeDeckLabel.textContent = `Aktiver Satz: ${deck.name}`;
  deckProgress.textContent = `${stats.due} fällig · ${stats.learned}/${stats.total} Wissen`;
  showNextCard();
}

function showNextCard() {
  const deck = decks.find((item) => item.id === activeDeckId);
  if (!deck) return;

  const dueCards = deck.cards.filter(isDue);
  currentCard = dueCards[0] ?? null;

  if (!currentCard) {
    cardQuestion.innerHTML = "Keine fälligen Karten. Gute Arbeit!";
    cardAnswer.innerHTML = "";
    cardAnswer.classList.add("hidden");
    showAnswerButton.disabled = true;
    markWrongButton.disabled = true;
    markRightButton.disabled = true;
    return;
  }

  cardQuestion.innerHTML = currentCard.question || "(Keine Frage)";
  cardAnswer.innerHTML = currentCard.answer || "(Keine Antwort)";
  cardAnswer.classList.add("hidden");
  showAnswerButton.disabled = false;
  markWrongButton.disabled = false;
  markRightButton.disabled = false;
}

function updateCardProgress(isCorrect) {
  if (!currentCard) return;
  const deck = decks.find((item) => item.id === activeDeckId);
  if (!deck) return;

  const card = deck.cards.find((item) => item.id === currentCard.id);
  if (!card) return;

  if (isCorrect) {
    card.box = Math.min(card.box + 1, 6);
  } else {
    card.box = 1;
  }

  const intervalDays = INTERVALS_DAYS[card.box - 1];
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  card.nextReview = nextReview.toISOString();
  card.lastReviewed = new Date().toISOString();

  saveDecks();
  renderDeckList();
  renderActiveDeck();
}

function handleFiles(files) {
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!Array.isArray(json)) {
          throw new Error("JSON muss eine Liste von Karten sein.");
        }
        const newDeck = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name.replace(/\.json$/i, ""),
          cards: normalizeCards(json),
        };
        decks.push(newDeck);
        saveDecks();
        renderDeckList();
      } catch (error) {
        alert(`Fehler beim Import: ${error.message}`);
      }
    };
    reader.readAsText(file);
  });
}

fileInput.addEventListener("change", (event) => {
  if (!event.target.files.length) return;
  handleFiles(event.target.files);
  event.target.value = "";
});

deckList.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) return;

  if (action === "study") {
    activeDeckId = id;
    renderActiveDeck();
    return;
  }

  if (action === "reset") {
    const deck = decks.find((item) => item.id === id);
    if (!deck) return;
    deck.cards.forEach((card) => {
      card.box = 1;
      card.nextReview = new Date().toISOString();
      card.lastReviewed = null;
    });
    saveDecks();
    renderDeckList();
    if (activeDeckId === id) {
      renderActiveDeck();
    }
    return;
  }

  if (action === "remove") {
    decks = decks.filter((item) => item.id !== id);
    if (activeDeckId === id) {
      activeDeckId = null;
    }
    saveDecks();
    renderDeckList();
    renderActiveDeck();
  }
});

showAnswerButton.addEventListener("click", () => {
  cardAnswer.classList.remove("hidden");
});

markWrongButton.addEventListener("click", () => {
  updateCardProgress(false);
});

markRightButton.addEventListener("click", () => {
  updateCardProgress(true);
});

clearStorageButton.addEventListener("click", () => {
  if (!confirm("Wirklich alle Decks und Fortschritte löschen?")) return;
  decks = [];
  activeDeckId = null;
  saveDecks();
  renderDeckList();
  renderActiveDeck();
});

renderDeckList();
renderActiveDeck();
