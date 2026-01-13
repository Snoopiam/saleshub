/**
 * Request Queue Service (M-10)
 * Limits concurrent PDF generation to prevent server overload.
 *
 * Puppeteer is resource-intensive - running too many concurrent instances
 * can cause memory issues and browser crashes. This queue ensures only
 * a limited number of PDFs are generated at once.
 */

// Maximum concurrent PDF generations
const MAX_CONCURRENT = 2;

// Maximum queue size (prevents unbounded memory growth)
const MAX_QUEUE_SIZE = 20;

// Queue state
const queue = [];
let activeCount = 0;

/**
 * Add a task to the queue and execute when slot available
 * @param {Function} task - Async function to execute
 * @returns {Promise} - Resolves when task completes
 */
function enqueue(task) {
  return new Promise((resolve, reject) => {
    // Check queue capacity
    if (queue.length >= MAX_QUEUE_SIZE) {
      reject(new Error('QUEUE_FULL'));
      return;
    }

    // Wrap task with resolve/reject handlers
    const queuedTask = {
      execute: task,
      resolve,
      reject,
      addedAt: Date.now()
    };

    queue.push(queuedTask);
    processQueue();
  });
}

/**
 * Process tasks from the queue when slots are available
 */
function processQueue() {
  // Check if we can run more tasks
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const task = queue.shift();
    activeCount++;

    // Execute the task
    task.execute()
      .then(result => {
        activeCount--;
        task.resolve(result);
        // Process next task in queue
        processQueue();
      })
      .catch(error => {
        activeCount--;
        task.reject(error);
        // Continue processing even after errors
        processQueue();
      });
  }
}

/**
 * Get current queue status
 * @returns {Object} Queue metrics
 */
function getQueueStatus() {
  return {
    active: activeCount,
    queued: queue.length,
    maxConcurrent: MAX_CONCURRENT,
    maxQueueSize: MAX_QUEUE_SIZE,
    oldestQueuedMs: queue.length > 0 ? Date.now() - queue[0].addedAt : 0
  };
}

/**
 * Check if queue has capacity
 * @returns {boolean} True if queue can accept more tasks
 */
function hasCapacity() {
  return queue.length < MAX_QUEUE_SIZE;
}

/**
 * Get estimated wait time in milliseconds
 * Based on average PDF generation time (~3-5 seconds)
 * @returns {number} Estimated wait time in ms
 */
function getEstimatedWaitMs() {
  const avgGenerationTimeMs = 4000; // 4 seconds average
  const position = queue.length;
  const slotsNeeded = Math.ceil(position / MAX_CONCURRENT);
  return slotsNeeded * avgGenerationTimeMs;
}

/**
 * Clear all queued tasks (for shutdown)
 */
function clearQueue() {
  const cleared = queue.length;
  while (queue.length > 0) {
    const task = queue.shift();
    task.reject(new Error('QUEUE_CLEARED'));
  }
  return cleared;
}

module.exports = {
  enqueue,
  getQueueStatus,
  hasCapacity,
  getEstimatedWaitMs,
  clearQueue,
  MAX_CONCURRENT,
  MAX_QUEUE_SIZE
};
