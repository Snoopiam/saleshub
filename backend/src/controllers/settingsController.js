/**
 * Settings Controller
 *
 * Fixed:
 * - C-01: Uses connection manager instead of creating new connections
 * - C-11: Sanitizes error messages for production
 */
const { getCollection } = require('../db/connection');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Sanitize error for response (C-11)
 */
function sanitizeError(error) {
  if (isProduction) {
    return { error: 'Internal Server Error', message: 'An unexpected error occurred' };
  }
  return { error: error.name || 'Error', message: error.message };
}

/**
 * Get global settings
 */
async function getSettings(req, res) {
  try {
    const collection = await getCollection('settings');
    let settings = await collection.findOne({ type: 'global' });

    // Default settings if none exist
    if (!settings) {
      settings = {
        type: 'global',
        pageSize: 'A4',
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        imageQuality: 100,
        dpi: 300,
        defaultTemplate: 'landscape'
      };
    }

    res.json(settings);
  } catch (error) {
    console.error('[Settings] Get error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

/**
 * Update global settings
 */
async function updateSettings(req, res) {
  try {
    const collection = await getCollection('settings');
    await collection.updateOne(
      { type: 'global' },
      { $set: { ...req.body, type: 'global', updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[Settings] Update error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

/**
 * Get branding settings
 */
async function getBranding(req, res) {
  try {
    const collection = await getCollection('branding');
    let branding = await collection.findOne({ type: 'branding' });

    // Default branding
    if (!branding) {
      branding = {
        type: 'branding',
        companyName: 'Your Company Name',
        logo: null,
        logoWidth: 100,
        primaryColor: '#1a365d',
        secondaryColor: '#2c5282',
        address: '',
        phone: '',
        email: '',
        website: ''
      };
    }

    res.json(branding);
  } catch (error) {
    console.error('[Settings] Get branding error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

/**
 * Update branding settings
 */
async function updateBranding(req, res) {
  try {
    const collection = await getCollection('branding');
    await collection.updateOne(
      { type: 'branding' },
      { $set: { ...req.body, type: 'branding', updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[Settings] Update branding error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

module.exports = { getSettings, updateSettings, getBranding, updateBranding };
