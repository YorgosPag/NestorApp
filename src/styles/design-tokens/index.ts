/**
 * Design Tokens — Barrel re-exports
 *
 * Compatibility layer for imports from `@/styles/design-tokens/`.
 * All tokens live in `modules/` and are re-exported via the main `design-tokens.ts`.
 */

// Re-export everything from the main facade
export {
  colors, semanticColors, spacing, typography, borderRadius, borders,
  canvasUtilities, performanceComponents, configurationComponents,
} from '../design-tokens';

// Component-specific design tokens
export * from './components/user-type';
