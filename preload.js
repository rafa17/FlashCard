const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', // This creates window.api in the renderer
    {
        // Define functions renderer can call
        getData: () => ipcRenderer.invoke('get-data'),
        createCollection: (name) => ipcRenderer.invoke('create-collection', name),
        addCard: (cardData) => ipcRenderer.invoke('add-card', cardData), // cardData = {collectionId, front, back}
        saveData: () => ipcRenderer.invoke('save-data'),

        // --- NEW: Expose delete functions ---
        deleteCollection: (collectionId) => ipcRenderer.invoke('delete-collection', collectionId),
        deleteCard: (ids) => ipcRenderer.invoke('delete-card', ids) // ids = { cardId, collectionId }
    }
);

console.log("Preload script loaded."); // Verify it runs
