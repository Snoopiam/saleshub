/**
 * MongoDB Connection Manager
 *
 * Singleton pattern for MongoDB connection pooling.
 * Fixes C-01: MongoDB connection leak
 */
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/saleshub';

let client = null;
let db = null;

/**
 * Connect to MongoDB (singleton - only connects once)
 */
async function connect() {
  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    await client.connect();
    db = client.db('saleshub');
    console.log('[MongoDB] Connected to database');
  }
  return db;
}

/**
 * Get database instance
 */
async function getDb() {
  if (!db) {
    await connect();
  }
  return db;
}

/**
 * Get collection by name
 */
async function getCollection(name) {
  const database = await getDb();
  return database.collection(name);
}

/**
 * Close MongoDB connection (for graceful shutdown)
 */
async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[MongoDB] Connection closed');
  }
}

/**
 * Check if connected
 */
function isConnected() {
  return client !== null && db !== null;
}

module.exports = {
  connect,
  getDb,
  getCollection,
  close,
  isConnected
};
