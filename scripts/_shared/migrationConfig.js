/**
 * =============================================================================
 * CENTRALIZED MIGRATION CONFIG - Single Source of Truth
 * =============================================================================
 *
 * All migration scripts read defaults from HERE - ZERO hardcoded values in scripts.
 *
 * @module scripts/_shared/migrationConfig
 * @enterprise Zero Duplicates - Centralized Configuration
 * @governance Created as SSoT after repo-wide pre-check confirmed no equivalents exist
 *
 * USAGE:
 * ```javascript
 * const { DEFAULTS } = require('./_shared/migrationConfig');
 * const pageSize = getNumericEnv('PAGE_SIZE', DEFAULTS.PAGE_SIZE);
 * ```
 *
 * =============================================================================
 */

/**
 * Default values for migration scripts
 * Scripts MUST use these instead of hardcoded literals
 */
const DEFAULTS = {
  /** Number of documents to fetch per page (pagination) */
  PAGE_SIZE: 100,

  /** Maximum documents per Firestore batch write (Firestore limit is 500) */
  BATCH_SIZE: 500,

  /** Number of sample documents to show in dry-run mode */
  DRY_RUN_SAMPLE_SIZE: 5,

  /** Report file format - JSONL ONLY (CSV not implemented) */
  REPORT_FORMAT: 'jsonl',
};

/**
 * Report output configuration
 */
const REPORT_CONFIG = {
  /** Default output directory (relative to project root) */
  OUTPUT_DIR: 'migration-reports',
};

module.exports = {
  DEFAULTS,
  REPORT_CONFIG,
};
