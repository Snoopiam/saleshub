/**
 * ============================================================================
 * CRYPTO.JS - Client-Side Encryption for Sensitive Data (C-09)
 * ============================================================================
 *
 * PURPOSE: Encrypts sensitive financial data in localStorage to protect
 *          against XSS attacks that could read localStorage.
 *
 * ALGORITHM: AES-GCM (256-bit) via Web Crypto API
 *
 * KEY MANAGEMENT:
 * - A random encryption key is generated on first use
 * - Key is stored in localStorage (separate from encrypted data)
 * - NOTE: This protects against XSS reading raw data, but sophisticated
 *         attacks could still extract the key. For higher security,
 *         consider server-side storage or hardware keys.
 *
 * WHAT'S ENCRYPTED:
 * - Financial values (prices, fees, amounts)
 * - Payment plan amounts
 * - NOT encrypted: project names, unit numbers, areas (non-sensitive)
 *
 * ============================================================================
 */

const CRYPTO_KEY_STORAGE = 'salesOfferCryptoKey';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

// Cached key to avoid repeated localStorage reads
let cachedKey = null;

/**
 * Check if Web Crypto API is available
 */
export function isCryptoAvailable() {
  return typeof crypto !== 'undefined' &&
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues !== 'undefined';
}

/**
 * Generate a new encryption key
 */
async function generateKey() {
  return await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,  // extractable (so we can export/import)
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to storable format (base64)
 */
async function exportKey(key) {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Import key from stored format
 */
async function importKey(base64Key) {
  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create the encryption key
 */
async function getKey() {
  // Return cached key if available
  if (cachedKey) {
    return cachedKey;
  }

  // Try to load existing key
  const storedKey = localStorage.getItem(CRYPTO_KEY_STORAGE);

  if (storedKey) {
    try {
      cachedKey = await importKey(storedKey);
      return cachedKey;
    } catch (e) {
      console.warn('[Crypto] Failed to import stored key, generating new one');
    }
  }

  // Generate new key
  cachedKey = await generateKey();

  // Store for future use
  const exported = await exportKey(cachedKey);
  localStorage.setItem(CRYPTO_KEY_STORAGE, exported);

  return cachedKey;
}

/**
 * Encrypt a string value
 *
 * @param {string} plaintext - Text to encrypt
 * @returns {string} Encrypted data as base64 string (includes IV)
 */
export async function encrypt(plaintext) {
  if (!isCryptoAvailable()) {
    console.warn('[Crypto] Web Crypto not available, returning plaintext');
    return plaintext;
  }

  if (!plaintext || plaintext === '') {
    return plaintext;
  }

  try {
    const key = await getKey();

    // Generate random IV (Initialization Vector) for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encode plaintext to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    // Combine IV + encrypted data and encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return 'enc:' + btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error('[Crypto] Encryption failed:', e.message);
    return plaintext;  // Fallback to plaintext
  }
}

/**
 * Decrypt a string value
 *
 * @param {string} ciphertext - Encrypted data (base64 with 'enc:' prefix)
 * @returns {string} Decrypted plaintext
 */
export async function decrypt(ciphertext) {
  if (!isCryptoAvailable()) {
    return ciphertext;
  }

  // Check if this is encrypted data
  if (!ciphertext || !ciphertext.startsWith('enc:')) {
    return ciphertext;  // Not encrypted, return as-is
  }

  try {
    const key = await getKey();

    // Decode from base64
    const combined = Uint8Array.from(
      atob(ciphertext.slice(4)),  // Remove 'enc:' prefix
      c => c.charCodeAt(0)
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );

    // Decode bytes to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (e) {
    console.error('[Crypto] Decryption failed:', e.message);
    return ciphertext;  // Return as-is if decryption fails
  }
}

/**
 * Encrypt sensitive fields in an offer object
 *
 * @param {Object} offer - Offer data with plaintext values
 * @returns {Object} Offer data with encrypted sensitive fields
 */
export async function encryptOffer(offer) {
  if (!offer || !isCryptoAvailable()) {
    return offer;
  }

  const sensitiveFields = [
    'originalPrice', 'sellingPrice', 'amountPaid', 'refund',
    'balanceResale', 'premium', 'adminFees', 'adgm', 'adgmTransfer',
    'adgmTermination', 'adgmElectronic', 'agencyFees', 'totalPayment'
  ];

  const encrypted = { ...offer };

  // Encrypt sensitive string fields
  for (const field of sensitiveFields) {
    if (encrypted[field] && typeof encrypted[field] === 'string' && encrypted[field] !== '') {
      encrypted[field] = await encrypt(encrypted[field]);
    }
  }

  // Encrypt payment plan amounts
  if (encrypted.paymentPlan && Array.isArray(encrypted.paymentPlan)) {
    encrypted.paymentPlan = await Promise.all(
      encrypted.paymentPlan.map(async (row) => ({
        ...row,
        amount: row.amount ? await encrypt(String(row.amount)) : row.amount
      }))
    );
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in an offer object
 *
 * @param {Object} offer - Offer data with encrypted values
 * @returns {Object} Offer data with decrypted sensitive fields
 */
export async function decryptOffer(offer) {
  if (!offer || !isCryptoAvailable()) {
    return offer;
  }

  const sensitiveFields = [
    'originalPrice', 'sellingPrice', 'amountPaid', 'refund',
    'balanceResale', 'premium', 'adminFees', 'adgm', 'adgmTransfer',
    'adgmTermination', 'adgmElectronic', 'agencyFees', 'totalPayment'
  ];

  const decrypted = { ...offer };

  // Decrypt sensitive string fields
  for (const field of sensitiveFields) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      decrypted[field] = await decrypt(decrypted[field]);
    }
  }

  // Decrypt payment plan amounts
  if (decrypted.paymentPlan && Array.isArray(decrypted.paymentPlan)) {
    decrypted.paymentPlan = await Promise.all(
      decrypted.paymentPlan.map(async (row) => ({
        ...row,
        amount: row.amount ? await decrypt(String(row.amount)) : row.amount
      }))
    );
  }

  return decrypted;
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('enc:');
}
