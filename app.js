const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const dataManager = require('./dataManager'); // Import our data logic

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// Variable to hold the application data (loaded after app is ready)
let appData = null;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Use preload script
            contextIsolation: true, // Recommended security practice
            nodeIntegration: false // Keep this false for security
        }
    });

    // and load the index.html of the app.
    mainWindow.loadFile('index.html');

    // Open the DevTools (optional - useful for debugging)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function () {
        // Dereference the window object
        mainWindow = null;
    });
}

// --- IPC Handlers (Main Process listens for these) ---

// Handle request to get initial data
ipcMain.handle('get-data', async (event) => {
    // Returns the currently loaded application data (cards and collections)
    // Defensively load data if it hasn't been loaded yet (shouldn't happen normally)
    if (appData === null) {
        console.warn("get-data called before data was loaded! Loading now.");
        appData = dataManager.loadData();
    }
    return appData;
});

// Handle request to create a new collection (with Sanitization)
ipcMain.handle('create-collection', async (event, name) => {
    console.log(`IPC Received: create-collection with raw name: "${name}"`); // Log original input

    // Basic validation: Check if name is provided and is a string
    if (!name || typeof name !== 'string' ) {
        return { success: false, message: 'Invalid collection name provided.' };
    }

    // --- Sanitization Step ---
    // Remove characters that look like HTML tags using a simple regex
    // and trim whitespace again.
    const sanitizedName = name.replace(/<[^>]*>/g, '').trim();
    console.log(`Sanitized collection name: "${sanitizedName}"`); // Log the cleaned name

    // Check if the name is empty *after* sanitization
    if (sanitizedName === '') {
         return { success: false, message: 'Collection name cannot be empty or contain only HTML tags.' };
    }
    // --- End Sanitization Step ---

    // Check if the *sanitized* name already exists in the collections
    const nameExists = Object.values(appData.collections).some(col => col.name === sanitizedName);
    if (nameExists) {
         // Use the sanitized name in the error message too
         return { success: false, message: `Collection "${sanitizedName}" already exists.` };
    }

    // Generate a unique ID for the new collection
    const collectionId = dataManager.generateId();

    // Add the new collection to the application data, using the sanitized name
    appData.collections[collectionId] = {
        name: sanitizedName, // *** Store the sanitized name ***
        cardIds: []          // Initialize with an empty array of card IDs
    };

    // Attempt to save the updated application data to the JSON file
    const saved = dataManager.saveData(appData); // Save immediately
    console.log(`Save attempt result for new collection: ${saved}`);

    // Return the result to the renderer process
    return {
        success: saved,                 // Indicate if saving was successful
        collectionId: collectionId,     // The ID of the newly created collection
        name: sanitizedName,            // The sanitized name that was saved
        message: saved ? 'Collection created.' : 'Failed to save data.' // Status message
    };
});

 // Handle request to add a card
 ipcMain.handle('add-card', async (event, { collectionId, front, back }) => {
    // Validate input: ensure IDs and text are present, and collection exists
    if (!collectionId || !front || !back || !appData.collections[collectionId]) {
        return { success: false, message: 'Invalid data or collection ID.'};
    }
    // Generate a unique ID for the new card
    const cardId = dataManager.generateId();
    // Add the card data to the main cards object
    appData.cards[cardId] = { front, back };
    // Add the new card's ID to the specified collection's list of card IDs
    appData.collections[collectionId].cardIds.push(cardId);
    // Save the updated application data
    const saved = dataManager.saveData(appData); // Save immediately
    // Return the result
    return { success: saved, cardId: cardId, message: saved ? 'Card added.' : 'Failed to save data.' };
 });

 // Handle request to save (e.g., triggered explicitly by a save button if added)
 ipcMain.handle('save-data', async (event) => {
     // Save the current application data state
     const saved = dataManager.saveData(appData);
     // Return success status
     return { success: saved };
 });

 // Handle request to delete a collection (MODIFIED TO RESTART APP)
 ipcMain.handle('delete-collection', async (event, collectionId) => {
    console.log(`IPC Received: delete-collection with ID: ${collectionId}`);
    if (!collectionId || !appData.collections[collectionId]) {
        return { success: false, message: 'Invalid collection ID or collection not found.' };
    }

    const collectionName = appData.collections[collectionId].name; // Get name for message
    // Delete the collection entry
    delete appData.collections[collectionId];

    // Note: Cards associated only with this collection remain in appData.cards
    // unless explicitly removed here or by the delete-card handler.

    // Save the changes
    const saved = dataManager.saveData(appData);
    console.log(`Save attempt result after deleting collection: ${saved}`);

    if (saved) {
        console.log(`Collection "${collectionName}" deleted successfully. Relaunching app...`);
        // --- Restart Logic ---
        app.relaunch(); // Relaunch the application
        app.exit(0);    // Exit the current instance cleanly
        // --- End Restart Logic ---
        // The return below might not execute if exit is fast enough, but good practice
        return {
            success: true,
            message: `Collection "${collectionName}" deleted. Restarting application...`
        };
    } else {
        // If saving failed, don't restart, report error
        return {
            success: false,
            message: 'Failed to save data after deleting collection. App not restarted.'
        };
    }
 });

 // Handle request to delete a card
 ipcMain.handle('delete-card', async (event, { cardId, collectionId }) => {
    console.log(`IPC Received: delete-card with Card ID: ${cardId}, from Collection ID: ${collectionId}`);

    let cardExisted = false;
    let removedFromCollection = false;

    // 1. Remove the card from the specific collection's list
    if (collectionId && appData.collections[collectionId]) {
        const initialLength = appData.collections[collectionId].cardIds.length;
        // Filter out the cardId
        appData.collections[collectionId].cardIds = appData.collections[collectionId].cardIds.filter(id => id !== cardId);
        removedFromCollection = appData.collections[collectionId].cardIds.length < initialLength;
        if(removedFromCollection) {
            console.log(`Card ${cardId} removed from collection ${collectionId}`);
        } else {
             console.log(`Card ${cardId} was not found in collection ${collectionId}`);
        }
    } else if (collectionId) {
        console.warn(`Attempted to remove card ${cardId} from non-existent collection ${collectionId}`);
        // Proceed to delete the card globally anyway if it exists
    }


    // 2. Remove the card from the global cards list
    if (cardId && appData.cards[cardId]) {
        console.log(`Deleting card ${cardId} from global list.`);
        delete appData.cards[cardId];
        cardExisted = true;
    } else if (cardId) {
        console.warn(`Attempted to delete non-existent card ${cardId} globally.`);
    } else {
        return { success: false, message: 'Invalid Card ID provided.' };
    }


    // 3. Save changes if anything was actually deleted
    if (cardExisted || removedFromCollection) {
        const saved = dataManager.saveData(appData);
        console.log(`Save attempt result after deleting card: ${saved}`);
        return {
            success: saved,
            message: saved ? 'Card deleted.' : 'Failed to save data after deleting card.'
        };
    } else {
        // Nothing was actually deleted (e.g., card ID didn't exist)
        return { success: false, message: 'Card not found or already deleted.' };
    }
 });


// --- App Lifecycle ---

app.whenReady().then(() => {
    // --- Initialize Data Manager FIRST ---
    const userDataPath = app.getPath('userData');
    dataManager.initDataManager(userDataPath); // Pass the correct path

    // --- Load Data AFTER initializing data manager ---
    appData = dataManager.loadData();
    console.log("Initial data loaded after app ready.");

    // --- Create the window AFTER data setup ---
    createWindow();

    // Handle macOS 'activate' event (recreate window if dock icon clicked)
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Handle the 'window-all-closed' event
app.on('window-all-closed', function () {
    // Quit the app if not on macOS
    if (process.platform !== 'darwin') {
        if (appData) { // Check if data was loaded before saving
             console.log("Attempting to save data before quit...");
             dataManager.saveData(appData);
        }
        app.quit();
    }
    // On macOS, the app usually stays active until explicitly quit
});

// Handle the 'before-quit' event (useful for cleanup/saving)
app.on('before-quit', (event) => {
     if (appData) { // Check if data was loaded before saving
        console.log("Saving data before quit...");
        dataManager.saveData(appData);
    }
});
