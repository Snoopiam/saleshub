/**
 * Image Storage Module - IndexedDB for Original Quality Images
 *
 * Provides persistent storage for original quality images using IndexedDB.
 * Solves the problem of window.originalImages being lost on page refresh.
 *
 * STORAGE STRATEGY:
 * - IndexedDB: Original quality images (persistent, large capacity)
 * - localStorage: Compressed previews (quick access, limited to 5MB)
 * - window.originalImages: Runtime cache (fast access, lost on refresh)
 */

const DB_NAME = 'SalesHubImages';
const DB_VERSION = 1;
const STORE_NAME = 'originalImages';

let db = null;

/**
 * Initialize IndexedDB connection
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[ImageStorage] Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('[ImageStorage] IndexedDB connected');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                console.log('[ImageStorage] Created object store');
            }
        };
    });
}

/**
 * Save an image to IndexedDB
 * @param {string} key - Image key ('floorPlan' or 'logo')
 * @param {File|Blob} file - The image file to store
 * @returns {Promise<void>}
 */
export async function saveImage(key, file) {
    if (!file) return;

    try {
        const database = await openDB();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Store the file as a Blob with metadata
            const record = {
                id: key,
                blob: file,
                name: file.name || `${key}.jpg`,
                type: file.type || 'image/jpeg',
                size: file.size,
                savedAt: Date.now()
            };

            const request = store.put(record);

            request.onsuccess = () => {
                console.log(`[ImageStorage] Saved ${key} (${(file.size / 1024).toFixed(1)}KB)`);
                resolve();
            };

            request.onerror = () => {
                console.error(`[ImageStorage] Failed to save ${key}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`[ImageStorage] Error saving ${key}:`, error);
    }
}

/**
 * Load an image from IndexedDB
 * @param {string} key - Image key ('floorPlan' or 'logo')
 * @returns {Promise<File|null>}
 */
export async function loadImage(key) {
    try {
        const database = await openDB();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                const record = request.result;
                if (record && record.blob) {
                    // Convert Blob back to File with original metadata
                    const file = new File([record.blob], record.name, { type: record.type });
                    console.log(`[ImageStorage] Loaded ${key} (${(file.size / 1024).toFixed(1)}KB)`);
                    resolve(file);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error(`[ImageStorage] Failed to load ${key}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`[ImageStorage] Error loading ${key}:`, error);
        return null;
    }
}

/**
 * Delete an image from IndexedDB
 * @param {string} key - Image key ('floorPlan' or 'logo')
 * @returns {Promise<void>}
 */
export async function deleteImage(key) {
    try {
        const database = await openDB();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => {
                console.log(`[ImageStorage] Deleted ${key}`);
                resolve();
            };

            request.onerror = () => {
                console.error(`[ImageStorage] Failed to delete ${key}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`[ImageStorage] Error deleting ${key}:`, error);
    }
}

/**
 * Clear all images from IndexedDB
 * @returns {Promise<void>}
 */
export async function clearAllImages() {
    try {
        const database = await openDB();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[ImageStorage] Cleared all images');
                resolve();
            };

            request.onerror = () => {
                console.error('[ImageStorage] Failed to clear:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('[ImageStorage] Error clearing:', error);
    }
}

/**
 * Restore images from IndexedDB to window.originalImages
 * Called on page load to restore persistent images to memory
 * @returns {Promise<void>}
 */
export async function restoreImages() {
    try {
        const [floorPlan, logo] = await Promise.all([
            loadImage('floorPlan'),
            loadImage('logo')
        ]);

        if (floorPlan) {
            window.originalImages.floorPlan = floorPlan;
            console.log('[ImageStorage] Restored floor plan to memory');
        }

        if (logo) {
            window.originalImages.logo = logo;
            console.log('[ImageStorage] Restored logo to memory');
        }

        return { floorPlan, logo };
    } catch (error) {
        console.error('[ImageStorage] Failed to restore images:', error);
        return { floorPlan: null, logo: null };
    }
}

/**
 * Get image as base64 for PDF export
 * Tries IndexedDB first, falls back to window.originalImages
 * @param {string} key - Image key ('floorPlan' or 'logo')
 * @returns {Promise<string|null>} Base64 data URL or null
 */
export async function getImageAsBase64(key) {
    try {
        // First try to load from IndexedDB (persistent)
        let file = await loadImage(key);

        // Fallback to window.originalImages (session)
        if (!file && window.originalImages && window.originalImages[key]) {
            file = window.originalImages[key];
        }

        if (!file) {
            return null;
        }

        // Convert to base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    } catch (error) {
        console.error(`[ImageStorage] Error getting ${key} as base64:`, error);
        return null;
    }
}
