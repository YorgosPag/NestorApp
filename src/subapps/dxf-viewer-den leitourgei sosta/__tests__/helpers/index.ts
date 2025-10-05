/**
 * 🎯 TEST HELPERS - Centralized Test Utilities
 *
 * Single entry point για όλα τα test helpers.
 * Import από εδώ instead of importing από individual files.
 *
 * @module __tests__/helpers
 *
 * @example
 * ```typescript
 * // ✅ ΣΩΣΤΟ - Import από centralized helpers
 * import {
 *   createTestScene,
 *   publishHighlight,
 *   querySelector,
 *   measureTest
 * } from '@/__tests__/helpers';
 *
 * // ❌ ΛΑΘΟΣ - Embedded utilities σε test file
 * function createTestScene() { ... }  // DON'T DO THIS!
 * ```
 */

// Test Data Helpers
export * from './testData';

// Event Helpers
export * from './eventHelpers';

// DOM Helpers
export * from './domHelpers';

// Performance Helpers
export * from './performanceHelpers';
