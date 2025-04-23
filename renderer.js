console.log("Renderer script loaded.");

// --- Globals ---
let currentData = { cards: {}, collections: {} };
let selectedCollectionId = null;
let reviewSession = { active: false, cards: [], currentIndex: -1 };

// --- UI Elements ---
const collectionSelect = document.getElementById('collection-select');
const newCollectionNameInput = document.getElementById('new-collection-name');
const addCollectionBtn = document.getElementById('add-collection-btn');
const deleteCollectionBtn = document.getElementById('delete-collection-btn');
const currentCollectionNameSpan = document.getElementById('current-collection-name');
const cardListDiv = document.getElementById('card-list'); // UL element
const cardListPlaceholder = document.getElementById('card-list-placeholder'); // Placeholder div
const showCardsBtn = document.getElementById('show-cards-btn'); // Show button
const hideCardsBtn = document.getElementById('hide-cards-btn'); // Hide button (NEW)
const newCardFrontInput = document.getElementById('new-card-front');
const newCardBackInput = document.getElementById('new-card-back');
const addCardBtn = document.getElementById('add-card-btn');
const statusMessageDiv = document.getElementById('status-message');

// Review Elements
const reviewCardDisplay = document.getElementById('review-card-display');
const reviewFrontDiv = document.getElementById('review-front');
const reviewBackDiv = document.getElementById('review-back');
const reviewStartBtn = document.getElementById('review-start-btn');
const reviewShowBackBtn = document.getElementById('review-show-back-btn');
const reviewNextBtn = document.getElementById('review-next-btn');


// --- UI Update Functions ---

function displayStatus(message, isError = false, duration = 4000) {
    // Displays a status message at the bottom of the UI
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = isError ? 'status-error' : 'status-success';
    // Clear message after a delay
    setTimeout(() => { statusMessageDiv.textContent = ''; statusMessageDiv.className = ''; }, duration);
}

function updateCollectionList() {
    // Updates the collection dropdown list based on currentData
    console.log("Updating collection list. Current selected ID before update:", selectedCollectionId);
    // Clear existing options
    collectionSelect.innerHTML = '';

    // Handle case where there are no collections
    if (!currentData.collections || Object.keys(currentData.collections).length === 0) {
         const placeholderOption = document.createElement('option');
         placeholderOption.textContent = "-- No Collections --";
         placeholderOption.disabled = true;
         collectionSelect.appendChild(placeholderOption);
         console.log("updateCollectionList: No collections found.");
         updateCardListForSelection(); // Ensure card list updates even if no collections
         console.log("<<< updateCollectionList END (no collections).");
        return; // Exit early if no collections
    }

    let foundSelectedId = false; // Flag to check if the selected ID still exists

    // Populate the select dropdown
    for (const id in currentData.collections) {
        const collection = currentData.collections[id];
        const option = document.createElement('option');
        option.value = id;
        // Display name and card count
        option.textContent = `${collection.name} (${collection.cardIds.length})`;

        // Check if this ID matches the currently selected one *before* potential reset
        if (id === selectedCollectionId) {
             option.selected = true;
             foundSelectedId = true; // Mark that we found it
        }
        collectionSelect.appendChild(option);
    }

    // Logic to handle selection *after* populating the list
    if (!foundSelectedId) {
        if (collectionSelect.options.length > 0 && !collectionSelect.options[0].disabled) {
             console.log("updateCollectionList: No valid selection found, selecting first item.");
             collectionSelect.selectedIndex = 0;
             selectedCollectionId = collectionSelect.value; // Update variable to match the new selection
        } else {
            console.log("updateCollectionList: No valid selection found, no items to select.");
            selectedCollectionId = null;
        }
    } else {
         selectedCollectionId = collectionSelect.value;
         console.log(`updateCollectionList: Existing selection ${selectedCollectionId} confirmed.`);
    }

    console.log("Finished updating collection list. Selected ID after update:", selectedCollectionId);
    // Update cards based on the final selection state *after* updating the list
    updateCardListForSelection();
    console.log("<<< updateCollectionList END.");
}

function updateCardListForSelection() {
    // Updates the card list panel based on the selectedCollectionId, initially hiding cards
    console.log(">>> updateCardListForSelection START. Selection:", selectedCollectionId);

    // Always hide the actual list and both buttons initially when selection changes
    cardListDiv.innerHTML = ''; // Clear list content
    cardListDiv.style.display = 'none';
    showCardsBtn.style.display = 'none';
    hideCardsBtn.style.display = 'none'; // Also hide the hide button
    cardListPlaceholder.style.display = 'block'; // Show placeholder

    // Disable/Enable buttons based on whether a collection is selected
    deleteCollectionBtn.disabled = !selectedCollectionId;
    reviewStartBtn.disabled = !selectedCollectionId;
    addCardBtn.disabled = !selectedCollectionId;
    newCardFrontInput.disabled = !selectedCollectionId;
    newCardBackInput.disabled = !selectedCollectionId;


    // If no collection is selected, display "None" and exit
    if (!selectedCollectionId || !currentData.collections[selectedCollectionId]) {
        currentCollectionNameSpan.textContent = 'None';
        cardListPlaceholder.innerHTML = '<em>Select a collection to see options.</em>';
        console.log("updateCardListForSelection: Card list cleared, no collection selected.");
        endReview();
        console.log("<<< updateCardListForSelection END (no selection).");
        return; // Exit, showing empty/placeholder state
    }

    // A collection is selected, proceed to display its details
    const collection = currentData.collections[selectedCollectionId];
    currentCollectionNameSpan.textContent = `"${collection.name}"`; // Show collection name

    // Handle empty collection
    if (collection.cardIds.length === 0) {
        reviewStartBtn.disabled = true; // Disable review if no cards
        cardListPlaceholder.innerHTML = '<em>No cards in this collection.</em>';
        console.log(`updateCardListForSelection: Card list updated for "${collection.name}", no cards.`);
        console.log("<<< updateCardListForSelection END (empty collection).");
        return; // Exit, showing empty message in placeholder
    }

    // Collection has cards - show the "Show Cards" button instead of the list
    reviewStartBtn.disabled = false; // Enable review button
    showCardsBtn.style.display = 'inline-block'; // Show the "Show" button
    cardListPlaceholder.style.display = 'none'; // Hide the placeholder message
    console.log(`updateCardListForSelection: Setup complete for "${collection.name}", ${collection.cardIds.length} cards. Show Cards button visible.`);

    console.log("<<< updateCardListForSelection END (show button state).");
}


// --- Function to actually populate the card list ---
function populateAndShowCardList() {
    console.log(">>> populateAndShowCardList START");
    if (!selectedCollectionId || !currentData.collections[selectedCollectionId]) {
        console.warn("populateAndShowCardList called with no valid collection selected.");
        return;
    }
    const collection = currentData.collections[selectedCollectionId];
    if (collection.cardIds.length === 0) {
        console.warn("populateAndShowCardList called for collection with no cards.");
        cardListDiv.innerHTML = '<li><em>No cards in this collection.</em></li>'; // Use LI
        cardListPlaceholder.style.display = 'none';
        cardListDiv.style.display = 'block';
        showCardsBtn.style.display = 'none';
        hideCardsBtn.style.display = 'none'; // Ensure hide button is hidden too
        return;
    }

    // Clear any previous content
    cardListDiv.innerHTML = '';

    // Build list items with delete buttons for each card
    try {
        collection.cardIds.forEach(cardId => {
            const card = currentData.cards[cardId];
            if (card) {
                // Create list item
                const li = document.createElement('li');

                // Span to hold card text
                const textSpan = document.createElement('span');
                textSpan.className = 'card-text';
                textSpan.textContent = `${card.front} / ${card.back}`;
                li.appendChild(textSpan);

                // Delete button for the card
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.className = 'delete-btn delete-card-btn';
                deleteBtn.dataset.cardId = cardId;
                deleteBtn.addEventListener('click', handleDeleteCard);
                li.appendChild(deleteBtn);

                cardListDiv.appendChild(li);
            } else {
                 // Handle data inconsistency
                 const li = document.createElement('li');
                 li.innerHTML = `<em>Error: Card data missing for ID ${cardId}</em>`;
                 li.style.color = 'red';
                 cardListDiv.appendChild(li);
                 console.warn(`populateAndShowCardList: Card data missing for ID ${cardId} listed in collection ${selectedCollectionId}`);
            }
        });

        // Hide the "Show Cards" button, show the populated list and "Hide Cards" button
        showCardsBtn.style.display = 'none';
        hideCardsBtn.style.display = 'inline-block'; // Show the Hide button
        cardListPlaceholder.style.display = 'none';
        cardListDiv.style.display = 'block';
        console.log("populateAndShowCardList: Card list populated and displayed.");

    } catch (error) {
        console.error("!!! CRITICAL ERROR during populateAndShowCardList DOM update !!!", error);
        displayStatus("Error displaying card list!", true, 10000);
        // Reset to placeholder state on error
        showCardsBtn.style.display = 'none';
        hideCardsBtn.style.display = 'none';
        cardListPlaceholder.innerHTML = '<em>Error displaying cards.</em>';
        cardListPlaceholder.style.display = 'block';
        cardListDiv.style.display = 'none';

    }
    console.log("<<< populateAndShowCardList END");
}

// --- Function to hide the card list ---
function hideCardList() {
    console.log(">>> hideCardList START");
    cardListDiv.style.display = 'none'; // Hide the list
    hideCardsBtn.style.display = 'none'; // Hide this button

    // Show the "Show Cards" button again if the collection still has cards
    if (selectedCollectionId && currentData.collections[selectedCollectionId] && currentData.collections[selectedCollectionId].cardIds.length > 0) {
        showCardsBtn.style.display = 'inline-block';
    } else {
        // Otherwise show the placeholder (e.g., if cards were deleted while shown)
        cardListPlaceholder.style.display = 'block';
        cardListPlaceholder.innerHTML = '<em>No cards in this collection.</em>'; // Update placeholder text
    }
    console.log("<<< hideCardList END");
}


// --- Review Functions ---
function startReview() {
    console.log(">>> startReview START");
    if (!selectedCollectionId || !currentData.collections[selectedCollectionId]) {
        displayStatus("Please select a collection to review.", true);
        console.log("<<< startReview END (no collection selected)");
        return;
    }
    const collection = currentData.collections[selectedCollectionId];
    if (collection.cardIds.length === 0) {
        displayStatus("This collection has no cards to review.", true);
        reviewStartBtn.disabled = true;
        console.log("<<< startReview END (no cards in collection)");
        return;
    }
     reviewStartBtn.disabled = false;

    reviewSession.active = true;
    let cardsToReview = collection.cardIds
        .map(id => currentData.cards[id])
        .filter(c => c);
     for (let i = cardsToReview.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardsToReview[i], cardsToReview[j]] = [cardsToReview[j], cardsToReview[i]];
    }
    reviewSession.cards = cardsToReview;
    reviewSession.currentIndex = 0;

    reviewStartBtn.style.display = 'none';
    reviewShowBackBtn.style.display = 'inline-block';
    reviewNextBtn.style.display = 'none';
    displayCardForReview();
    displayStatus(`Review started for "${collection.name}"`);
    console.log("<<< startReview END (session started)");
}
function displayCardForReview() {
    if (!reviewSession.active || reviewSession.currentIndex >= reviewSession.cards.length) {
        endReview(); return;
    }
    const card = reviewSession.cards[reviewSession.currentIndex];
    reviewFrontDiv.textContent = card.front;
    reviewBackDiv.textContent = card.back;
    reviewFrontDiv.style.display = 'block';
    reviewBackDiv.style.display = 'none';
    reviewShowBackBtn.style.display = 'inline-block';
    reviewNextBtn.style.display = 'none';
}
 function showReviewBack() {
     if (!reviewSession.active) return;
     reviewBackDiv.style.display = 'block';
     reviewShowBackBtn.style.display = 'none';
     reviewNextBtn.style.display = 'inline-block';
 }
 function nextReviewCard() {
     if (!reviewSession.active) return;
     reviewSession.currentIndex++;
     if (reviewSession.currentIndex >= reviewSession.cards.length) {
         endReview();
     } else {
         displayCardForReview();
     }
 }
 function endReview() {
    const wasActive = reviewSession.active;
    reviewSession.active = false;
    reviewSession.cards = [];
    reviewSession.currentIndex = -1;
    reviewFrontDiv.textContent = '';
    reviewBackDiv.textContent = '';
    reviewStartBtn.style.display = 'inline-block';
    reviewShowBackBtn.style.display = 'none';
    reviewNextBtn.style.display = 'none';
    if (wasActive) {
         console.log("Review session ended.");
         displayStatus("Review finished.");
    }
    reviewStartBtn.disabled = !selectedCollectionId || !currentData.collections[selectedCollectionId] || currentData.collections[selectedCollectionId].cardIds.length === 0;
 }


// --- Event Listeners ---

// Load initial data when the window's DOM content is ready
window.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Loaded. Requesting data...");
    try {
        currentData = await window.api.getData();
        console.log("Data received:", JSON.stringify(currentData, null, 2));
        updateCollectionList(); // Initial population
    } catch (error) {
        console.error("Error fetching initial data:", error);
        displayStatus("Failed to load data.", true);
    }
});

// Add new collection button click
addCollectionBtn.addEventListener('click', async () => {
    const name = newCollectionNameInput.value.trim();
    if (!name) {
        displayStatus("Please enter a collection name.", true);
        return;
    }
    try {
        const result = await window.api.createCollection(name);
        if (result.success) {
            currentData = await window.api.getData();
            selectedCollectionId = result.collectionId;
            updateCollectionList();
            newCollectionNameInput.value = '';
            displayStatus(result.message || 'Collection created.');
        } else {
             displayStatus(result.message || 'Failed to create collection.', true);
        }
    } catch (error) {
        console.error("Error creating collection:", error);
        displayStatus("An error occurred while creating collection.", true);
    }
});

 // Handle collection selection change in the dropdown
 collectionSelect.addEventListener('change', () => {
    selectedCollectionId = collectionSelect.value;
    console.log("Collection selection changed to:", selectedCollectionId);
    endReview(); // Stop any active review
    updateCardListForSelection(); // Update the card list display (will show button/placeholder)
 });

 // Add new card button click
 addCardBtn.addEventListener('click', async () => {
    const front = newCardFrontInput.value.trim();
    const back = newCardBackInput.value.trim();

    if (!selectedCollectionId) {
        displayStatus("Please select a collection first.", true);
        return;
    }
    if (!front || !back) {
        displayStatus("Card front and back cannot be empty.", true);
        return;
    }

    try {
        const result = await window.api.addCard({ collectionId: selectedCollectionId, front, back });
         if (result.success) {
             currentData = await window.api.getData();
             updateCollectionList(); // This re-renders collection list and card list state
             newCardFrontInput.value = '';
             newCardBackInput.value = '';
             displayStatus(result.message || 'Card added.');
             // If cards were visible, re-populate to show the new one immediately
             if (cardListDiv.style.display === 'block') {
                 populateAndShowCardList();
             }
         } else {
             displayStatus(result.message || 'Failed to add card.', true);
         }
    } catch (error) {
         console.error("Error adding card:", error);
         displayStatus("An error occurred while adding the card.", true);
    }
 });

 // Review Button Listeners
 reviewStartBtn.addEventListener('click', startReview);
 reviewShowBackBtn.addEventListener('click', showReviewBack);
 reviewNextBtn.addEventListener('click', nextReviewCard);

 // Delete Collection Button Listener (Handles App Restart)
 deleteCollectionBtn.addEventListener('click', async () => {
     if (!selectedCollectionId) {
        displayStatus("Please select a collection to delete.", true);
        return;
    }
    const collectionName = currentData.collections[selectedCollectionId]?.name || 'the selected collection';
    const confirmed = confirm(`Are you sure you want to delete the collection "${collectionName}"?\n\nThis action cannot be undone. Cards associated only with this collection will be permanently deleted.`);
    if (!confirmed) {
        displayStatus("Deletion cancelled.");
        return;
    }
    try {
        const collectionIdToDelete = selectedCollectionId;
        console.log(`Requesting deletion of collection ID: ${collectionIdToDelete}`);
        const result = await window.api.deleteCollection(collectionIdToDelete);
        if (!result.success) {
            displayStatus(result.message || 'Failed to delete collection.', true);
        } else {
             displayStatus("Collection deleted. Restarting application...", false, 10000);
             addCollectionBtn.disabled = true;
             deleteCollectionBtn.disabled = true;
             addCardBtn.disabled = true;
             reviewStartBtn.disabled = true;
             showCardsBtn.disabled = true; // Also disable show cards button
             hideCardsBtn.disabled = true; // Also disable hide button
        }
    } catch (error) {
        console.error("Error deleting collection:", error);
        displayStatus("An error occurred while deleting the collection.", true);
    }
 });

 // Delete Card Handler Function (Attached dynamically)
 async function handleDeleteCard(event) {
     console.log(">>> handleDeleteCard START");
    const button = event.currentTarget;
    const cardId = button.dataset.cardId;
    if (!cardId) {
        console.error("handleDeleteCard: Delete button clicked, but no card ID found on dataset.");
        return;
    }
    const collectionIdForDeletion = selectedCollectionId;
    if (!collectionIdForDeletion) {
        console.error("handleDeleteCard: Delete button clicked, but no collection is selected globally.");
        displayStatus("Cannot delete card: No collection selected.", true);
        return;
    }
    const card = currentData.cards[cardId];
    const cardText = card ? `${card.front} / ${card.back}` : `Card ID ${cardId}`;
    const confirmed = confirm(`Are you sure you want to delete this card?\n\n${cardText}\n\nThis will remove the card permanently.`);
    if (!confirmed) {
        console.log("handleDeleteCard: Deletion cancelled by user.");
        return;
    }
    button.disabled = true;
    displayStatus("Deleting card...", false, 5000);
    try {
        console.log(`handleDeleteCard: Requesting deletion of card ID: ${cardId} from collection ID: ${collectionIdForDeletion}`);
        const result = await window.api.deleteCard({ cardId: cardId, collectionId: collectionIdForDeletion });
        console.log("handleDeleteCard: API call result:", result);
        if (result.success) {
             console.log("handleDeleteCard: Deletion successful. Refetching data...");
             currentData = await window.api.getData();
             console.log("handleDeleteCard: Data refetched. Calling updateCollectionList...");
             updateCollectionList(); // This re-renders the collection list and the card list state
             // If cards were visible before deletion, re-populate the list
             if (cardListDiv.style.display === 'block') {
                 populateAndShowCardList();
             }
             console.log("handleDeleteCard: updateCollectionList finished.");
             displayStatus(result.message || 'Card deleted.');
        } else {
             console.error("handleDeleteCard: Deletion failed in main process.", result.message);
             displayStatus(result.message || 'Failed to delete card.', true);
             button.disabled = false;
        }
    } catch (error) {
         console.error("!!! CRITICAL ERROR during handleDeleteCard API call !!!", error);
         displayStatus("An error occurred while deleting the card.", true);
         button.disabled = false;
    }
    console.log("<<< handleDeleteCard END");
 }

 // --- Event listener for the Show Cards button ---
 showCardsBtn.addEventListener('click', populateAndShowCardList);

 // --- Event listener for the Hide Cards button ---
 hideCardsBtn.addEventListener('click', hideCardList);