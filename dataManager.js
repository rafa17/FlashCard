const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let DATA_FILE_PATH = '';

const DEFAULT_DATA = { cards: {}, collections: {} };

function initDataManager(userDataPath) {
    // Define the path for flashcards.json within the app's user data folder
    DATA_FILE_PATH = path.join(userDataPath, 'flashcards.json');
    console.log(`Data file path set to: ${DATA_FILE_PATH}`);

    // Ensure the directory exists (important for first run)
    try {
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
            console.log(`Created user data directory: ${userDataPath}`);
        }
    } catch (e) {
         console.error("Error creating user data directory:", e);
         // Handle error appropriately, maybe fallback or exit
    }
}


function generateId() {
    return crypto.randomUUID();
}

function loadData() {
    if (!DATA_FILE_PATH) {
        console.error("Data manager not initialized. Call initDataManager first.");
        return { ...DEFAULT_DATA };
    }

    try {
        if (!fs.existsSync(DATA_FILE_PATH)) {
            console.log(`File not found at ${DATA_FILE_PATH}. Creating a new one.`);
            saveData(DEFAULT_DATA); // Save default if not found
            return { ...DEFAULT_DATA };
        }
        const dataBuffer = fs.readFileSync(DATA_FILE_PATH);
        const dataJSON = dataBuffer.toString('utf-8');
        if (!dataJSON) return { ...DEFAULT_DATA }; // Handle empty file
        const parsedData = JSON.parse(dataJSON);
        return {
            cards: parsedData.cards || {},
            collections: parsedData.collections || {}
        };
    } catch (e) {
        console.error(`Error loading data from ${DATA_FILE_PATH}:`, e.message);
        // Attempt to recover by returning default data, but log the error
        return { ...DEFAULT_DATA };
    }
}

function saveData(data) {
     // Ensure the path has been initialized
    if (!DATA_FILE_PATH) {
        console.error("Data manager not initialized. Cannot save data.");
        return false;
    }
    try {
        const dataJSON = JSON.stringify(data, null, 2);
        fs.writeFileSync(DATA_FILE_PATH, dataJSON, 'utf-8');
        return true;
    } catch (e) {
        console.error(`Error saving data to ${DATA_FILE_PATH}:`, e.message);
        return false;
    }
}

module.exports = {
    initDataManager,
    loadData,
    saveData,
    generateId
};
