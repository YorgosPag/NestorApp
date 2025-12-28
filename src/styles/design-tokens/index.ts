/**
 * TEMPORARY COMPATIBILITY LAYER
 * This file exists only to satisfy cached webpack references
 * All functionality is provided by the main design-tokens.ts
 */

// Essential re-exports only
export { colors, semanticColors, spacing, typography, borderRadius, borders } from '../design-tokens';
export { canvasUtilities, performanceComponents, configurationComponents } from '../design-tokens';

// Component-specific design tokens
export * from './components/user-type';

// Default fallback export
const designTokens = require('../design-tokens.ts');
module.exports = designTokens;