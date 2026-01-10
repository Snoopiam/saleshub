const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/saleshub';
const client = new MongoClient(uri);

async function getCollection(collectionName = 'settings') {
  await client.connect();
  return client.db('saleshub').collection(collectionName);
}

/**
 * Get global settings
 */
async function getSettings(req, res) {
  try {
    const collection = await getCollection();
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
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update global settings
 */
async function updateSettings(req, res) {
  try {
    const collection = await getCollection();
    const result = await collection.updateOne(
      { type: 'global' },
      { $set: { ...req.body, type: 'global', updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update branding settings
 */
async function updateBranding(req, res) {
  try {
    const collection = await getCollection('branding');
    const result = await collection.updateOne(
      { type: 'branding' },
      { $set: { ...req.body, type: 'branding', updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getSettings, updateSettings, getBranding, updateBranding };
