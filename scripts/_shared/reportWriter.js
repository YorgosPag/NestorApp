/**
 * =============================================================================
 * MIGRATION REPORT WRITER - Structured Audit Artifacts
 * =============================================================================
 *
 * Produces mandatory JSONL audit reports for all migration operations.
 * Every migration MUST produce a report file for compliance.
 *
 * @module scripts/_shared/reportWriter
 * @enterprise Zero Duplicates - Centralized Report System
 * @governance Created as SSoT after repo-wide pre-check confirmed no equivalents exist
 *
 * IMPORTANT: Only JSONL format is supported. CSV is NOT implemented.
 * Any attempt to use format='csv' will throw an error (fail-closed).
 *
 * USAGE:
 * ```javascript
 * const { createReportWriter } = require('./_shared/reportWriter');
 * const report = createReportWriter('projects', { outputPath: 'migration-reports' });
 * report.recordUpdate({ id: 'doc1', before: null, after: 'companyA' });
 * report.recordSkip({ id: 'doc2', reason: 'already_has_companyId' });
 * await report.finalize();
 * ```
 *
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const { DEFAULTS, REPORT_CONFIG } = require('./migrationConfig');

/**
 * Create a report writer for a migration script
 *
 * @param {string} collection - Collection name being migrated
 * @param {Object} options - Configuration options
 * @param {string} [options.outputPath] - Output directory (env REPORT_OUTPUT_PATH or default)
 * @returns {ReportWriter} Report writer instance
 *
 * NOTE: Only JSONL format is supported. CSV is NOT implemented.
 * Any attempt to use CSV format will throw an error (fail-closed).
 */
function createReportWriter(collection, options = {}) {
  const outputDir = options.outputPath || process.env.REPORT_OUTPUT_PATH || REPORT_CONFIG.OUTPUT_DIR;

  // COMPLIANCE: JSONL-only - fail-closed if CSV requested
  const requestedFormat = options.format || process.env.REPORT_FORMAT || DEFAULTS.REPORT_FORMAT;
  if (requestedFormat !== 'jsonl') {
    throw new Error(
      `[reportWriter] VALIDATION ERROR: Only 'jsonl' format is supported. ` +
      `Requested format '${requestedFormat}' is not implemented. ` +
      `Remove REPORT_FORMAT env or set it to 'jsonl'.`
    );
  }
  const format = 'jsonl'; // Hardcoded to JSONL - only supported format

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${collection}-${timestamp}.${format}`;
  const filePath = path.join(outputDir, fileName);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Statistics
  const stats = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    startTime: Date.now(),
  };

  // Skip reasons breakdown
  const skipReasons = {};

  // Sample entries for dry-run preview
  const samples = {
    updates: [],
    skips: [],
    errors: [],
  };

  // File stream
  const stream = fs.createWriteStream(filePath, { flags: 'a' });

  /**
   * Write a single entry to the report
   * @param {Object} entry
   */
  function writeEntry(entry) {
    const line = JSON.stringify(entry);
    stream.write(line + '\n');
  }

  return {
    /**
     * Get the report file path
     * @returns {string}
     */
    getFilePath() {
      return filePath;
    },

    /**
     * Increment scanned counter
     * @param {number} [count=1]
     */
    incrementScanned(count = 1) {
      stats.scanned += count;
    },

    /**
     * Record a successful update
     * @param {Object} data
     * @param {string} data.id - Document ID
     * @param {*} data.before - Value before
     * @param {*} data.after - Value after
     * @param {Object} [data.metadata] - Additional metadata
     */
    recordUpdate(data) {
      stats.updated++;

      const entry = {
        timestamp: new Date().toISOString(),
        action: 'update',
        docId: data.id,
        before: data.before,
        after: data.after,
        ...(data.metadata && { metadata: data.metadata }),
      };

      writeEntry(entry);

      // Keep sample for preview
      if (samples.updates.length < DEFAULTS.DRY_RUN_SAMPLE_SIZE) {
        samples.updates.push(entry);
      }
    },

    /**
     * Record a skipped document
     * @param {Object} data
     * @param {string} data.id - Document ID
     * @param {string} data.reason - Skip reason code
     * @param {string} [data.details] - Additional details
     */
    recordSkip(data) {
      stats.skipped++;

      // Track skip reasons
      skipReasons[data.reason] = (skipReasons[data.reason] || 0) + 1;

      const entry = {
        timestamp: new Date().toISOString(),
        action: 'skip',
        docId: data.id,
        reason: data.reason,
        ...(data.details && { details: data.details }),
      };

      writeEntry(entry);

      // Keep sample for preview
      if (samples.skips.length < DEFAULTS.DRY_RUN_SAMPLE_SIZE) {
        samples.skips.push(entry);
      }
    },

    /**
     * Record an error
     * @param {Object} data
     * @param {string} data.id - Document ID
     * @param {string} data.error - Error message
     * @param {string} [data.stack] - Stack trace
     */
    recordError(data) {
      stats.errors++;

      const entry = {
        timestamp: new Date().toISOString(),
        action: 'error',
        docId: data.id,
        error: data.error,
        ...(data.stack && { stack: data.stack }),
      };

      writeEntry(entry);

      // Keep sample for preview
      if (samples.errors.length < DEFAULTS.DRY_RUN_SAMPLE_SIZE) {
        samples.errors.push(entry);
      }
    },

    /**
     * Get current statistics
     * @returns {Object}
     */
    getStats() {
      return { ...stats, skipReasons };
    },

    /**
     * Get sample entries for dry-run preview
     * @returns {Object}
     */
    getSamples() {
      return samples;
    },

    /**
     * Finalize the report and write summary
     * @returns {Promise<Object>} Final report summary
     */
    async finalize() {
      const duration = Date.now() - stats.startTime;

      // Write summary entry
      const summary = {
        timestamp: new Date().toISOString(),
        action: 'summary',
        collection,
        stats: {
          scanned: stats.scanned,
          updated: stats.updated,
          skipped: stats.skipped,
          errors: stats.errors,
          durationMs: duration,
        },
        skipReasons,
      };

      writeEntry(summary);

      // Close stream
      return new Promise((resolve, reject) => {
        stream.end(() => {
          console.log(`📄 Report written to: ${filePath}`);
          resolve({
            filePath,
            ...summary.stats,
            skipReasons,
          });
        });
        stream.on('error', reject);
      });
    },
  };
}

module.exports = {
  createReportWriter,
};
