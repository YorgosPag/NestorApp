/**
 * =============================================================================
 * Upload Entry Points — Barrel Module
 * =============================================================================
 *
 * Re-exports everything from sub-modules.
 * Consumers import from `@/config/upload-entry-points` (unchanged).
 *
 * @module config/upload-entry-points
 * @enterprise ADR-031
 */

// Types
export * from './types';

// Capture capabilities + utilities
export * from './capture-config';

// Assembly + query/utility functions
export * from './queries';

// Note: entries-*.ts are internal — consumed only by queries.ts
