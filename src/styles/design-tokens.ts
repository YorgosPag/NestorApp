/**
 * Design Tokens — Re-export Facade
 *
 * SSoT for the unified design system. All tokens are defined in
 * `design-tokens/modules/` and re-exported here for backward compatibility.
 *
 * Consumers import from `@/styles/design-tokens` — zero changes needed.
 */

// ── Foundations ──────────────────────────────────────────────────────────────
export {
  colors, spacing, typography, shadows, animation, transitions,
  semanticColors,
  getSpacing, getTypography, getShadow, getAnimation,
} from './design-tokens/modules/foundations';

// ── Borders ─────────────────────────────────────────────────────────────────
export {
  borders, borderWidth, borderColors, borderStyle, borderVariants,
  borderUtils, responsiveBorders, coreBorderRadius, borderRadius,
} from './design-tokens/modules/borders';

// ── Layout ──────────────────────────────────────────────────────────────────
export {
  zIndex, DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL, gridPatterns,
  breakpoints, interactiveStates, ENTITY_LIST_TOKENS, designTokens,
} from './design-tokens/modules/layout';
export type { EntityListTokens } from './design-tokens/modules/layout';

// ── Component Sizes ─────────────────────────────────────────────────────────
export { componentSizes } from './design-tokens/modules/component-sizes';

// ── Layout Utilities ────────────────────────────────────────────────────────
export { layoutUtilities } from './design-tokens/modules/layout-utilities-constants';

// ── Portal & Overlay ────────────────────────────────────────────────────────
export {
  portalComponents, portalComponentsExtended,
  svgUtilities, interactionUtilities,
  photoPreviewComponents, photoPreviewLayout,
} from './design-tokens/modules/portal-overlay';

// ── Canvas Utilities ────────────────────────────────────────────────────────
export {
  canvasUtilities, autoSaveStatusTokens, statusIndicatorComponents,
} from './design-tokens/modules/canvas-utilities';

// ── Performance ─────────────────────────────────────────────────────────────
export {
  performanceComponents, FloatingStyleUtils,
  PerformanceDashboardTokens, performanceMonitorUtilities,
} from './design-tokens/modules/performance-components';

// ── Canvas UI ───────────────────────────────────────────────────────────────
export { canvasUI } from './design-tokens/modules/canvas-ui';

// ── Configuration ───────────────────────────────────────────────────────────
export { configurationComponents } from './design-tokens/modules/configuration-components';

// ── Brand, Map, Misc ────────────────────────────────────────────────────────
export {
  brandClasses, getBrandClass,
  mapInteractionTokens, mapControlPointTokens,
  bg, DESIGN_TOKENS_V2_INFO,
} from './design-tokens/modules/brand-map';
