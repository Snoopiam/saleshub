/**
 * Template Controller
 *
 * Fixed:
 * - C-01: Uses connection manager instead of creating new connections
 * - C-10: Validates ObjectId before queries
 * - C-11: Sanitizes error messages for production
 */
const { ObjectId } = require('mongodb');
const { getCollection } = require('../db/connection');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Validate ObjectId format (C-10)
 */
function isValidObjectId(id) {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
}

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
 * List all templates
 */
async function listTemplates(req, res) {
  try {
    const collection = await getCollection('templates');
    const templates = await collection.find({}).toArray();
    res.json(templates);
  } catch (error) {
    console.error('[Templates] List error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

/**
 * Create new template
 */
async function createTemplate(req, res) {
  try {
    const collection = await getCollection('templates');
    const template = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await collection.insertOne(template);
    template._id = result.insertedId;
    res.status(201).json(template);
  } catch (error) {
    console.error('[Templates] Create error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

/**
 * Get template by ID
 */
async function getTemplate(req, res) {
  try {
    // C-10: Validate ObjectId before query
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid template ID format' });
    }

    const collection = await getCollection('templates');
    const template = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!template) {
      return res.status(404).json({ error: 'Not Found', message: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('[Templates] Get error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

/**
 * Update template
 */
async function updateTemplate(req, res) {
  try {
    // C-10: Validate ObjectId before query
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid template ID format' });
    }

    const collection = await getCollection('templates');
    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Template not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Templates] Update error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

/**
 * Delete template
 */
async function deleteTemplate(req, res) {
  try {
    // C-10: Validate ObjectId before query
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid template ID format' });
    }

    const collection = await getCollection('templates');
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Template not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Templates] Delete error:', error.message);
    res.status(500).json(sanitizeError(error));
  }
}

module.exports = { listTemplates, createTemplate, getTemplate, updateTemplate, deleteTemplate };
