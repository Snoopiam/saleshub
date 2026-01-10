const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/saleshub';
const client = new MongoClient(uri);

async function getCollection() {
  await client.connect();
  return client.db('saleshub').collection('templates');
}

/**
 * List all templates
 */
async function listTemplates(req, res) {
  try {
    const collection = await getCollection();
    const templates = await collection.find({}).toArray();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create new template
 */
async function createTemplate(req, res) {
  try {
    const collection = await getCollection();
    const template = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await collection.insertOne(template);
    template._id = result.insertedId;
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get template by ID
 */
async function getTemplate(req, res) {
  try {
    const collection = await getCollection();
    const template = await collection.findOne({ _id: new ObjectId(req.params.id) });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update template
 */
async function updateTemplate(req, res) {
  try {
    const collection = await getCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete template
 */
async function deleteTemplate(req, res) {
  try {
    const collection = await getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { listTemplates, createTemplate, getTemplate, updateTemplate, deleteTemplate };
