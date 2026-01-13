/**
 * Metrics Service (M-06)
 * Tracks performance metrics for monitoring and debugging.
 *
 * Collects:
 * - PDF generation duration and success rate
 * - Error counts and types
 * - Request counts
 *
 * Metrics are stored in-memory with periodic summary logging.
 * Can be extended to send to external monitoring services.
 */

// In-memory metrics storage
const metrics = {
  pdf: {
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    totalDurationMs: 0,
    lastDurationMs: 0,
    minDurationMs: Infinity,
    maxDurationMs: 0,
    errors: {} // Error type -> count
  },
  api: {
    totalRequests: 0,
    requestsByEndpoint: {}
  },
  startTime: Date.now()
};

/**
 * Record a PDF generation attempt
 * @param {boolean} success - Whether generation succeeded
 * @param {number} durationMs - Time taken in milliseconds
 * @param {string|null} errorType - Error type if failed (optional)
 */
function recordPdfGeneration(success, durationMs, errorType = null) {
  metrics.pdf.totalRequests++;

  if (success) {
    metrics.pdf.successCount++;
    metrics.pdf.totalDurationMs += durationMs;
    metrics.pdf.lastDurationMs = durationMs;

    if (durationMs < metrics.pdf.minDurationMs) {
      metrics.pdf.minDurationMs = durationMs;
    }
    if (durationMs > metrics.pdf.maxDurationMs) {
      metrics.pdf.maxDurationMs = durationMs;
    }
  } else {
    metrics.pdf.failureCount++;
    if (errorType) {
      metrics.pdf.errors[errorType] = (metrics.pdf.errors[errorType] || 0) + 1;
    }
  }

  // Log summary every 10 requests
  if (metrics.pdf.totalRequests % 10 === 0) {
    logMetricsSummary();
  }
}

/**
 * Record an API request
 * @param {string} endpoint - The API endpoint
 */
function recordApiRequest(endpoint) {
  metrics.api.totalRequests++;
  metrics.api.requestsByEndpoint[endpoint] = (metrics.api.requestsByEndpoint[endpoint] || 0) + 1;
}

/**
 * Get current metrics snapshot
 * @returns {Object} Current metrics
 */
function getMetrics() {
  const uptimeMs = Date.now() - metrics.startTime;
  const avgDurationMs = metrics.pdf.successCount > 0
    ? Math.round(metrics.pdf.totalDurationMs / metrics.pdf.successCount)
    : 0;
  const successRate = metrics.pdf.totalRequests > 0
    ? ((metrics.pdf.successCount / metrics.pdf.totalRequests) * 100).toFixed(1)
    : 100;

  return {
    uptime: {
      ms: uptimeMs,
      formatted: formatUptime(uptimeMs)
    },
    pdf: {
      totalRequests: metrics.pdf.totalRequests,
      successCount: metrics.pdf.successCount,
      failureCount: metrics.pdf.failureCount,
      successRate: `${successRate}%`,
      avgDurationMs,
      minDurationMs: metrics.pdf.minDurationMs === Infinity ? 0 : metrics.pdf.minDurationMs,
      maxDurationMs: metrics.pdf.maxDurationMs,
      lastDurationMs: metrics.pdf.lastDurationMs,
      errors: { ...metrics.pdf.errors }
    },
    api: {
      totalRequests: metrics.api.totalRequests,
      requestsByEndpoint: { ...metrics.api.requestsByEndpoint }
    }
  };
}

/**
 * Reset all metrics (useful for testing)
 */
function resetMetrics() {
  metrics.pdf.totalRequests = 0;
  metrics.pdf.successCount = 0;
  metrics.pdf.failureCount = 0;
  metrics.pdf.totalDurationMs = 0;
  metrics.pdf.lastDurationMs = 0;
  metrics.pdf.minDurationMs = Infinity;
  metrics.pdf.maxDurationMs = 0;
  metrics.pdf.errors = {};
  metrics.api.totalRequests = 0;
  metrics.api.requestsByEndpoint = {};
  metrics.startTime = Date.now();
}

/**
 * Log metrics summary to console
 */
function logMetricsSummary() {
  const m = getMetrics();
  console.log('[Metrics] PDF Generation Summary:', {
    total: m.pdf.totalRequests,
    success: m.pdf.successCount,
    failed: m.pdf.failureCount,
    successRate: m.pdf.successRate,
    avgDuration: `${m.pdf.avgDurationMs}ms`
  });
}

/**
 * Format uptime as human-readable string
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Middleware to track API requests
 */
function metricsMiddleware(req, res, next) {
  // Only track API routes
  if (req.path.startsWith('/api')) {
    recordApiRequest(req.path);
  }
  next();
}

module.exports = {
  recordPdfGeneration,
  recordApiRequest,
  getMetrics,
  resetMetrics,
  metricsMiddleware
};
