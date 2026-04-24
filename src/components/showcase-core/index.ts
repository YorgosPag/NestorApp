/**
 * =============================================================================
 * SHOWCASE CORE — Components barrel (ADR-321)
 * =============================================================================
 *
 * Re-exports the generic showcase client + specs grid so downstream surfaces
 * import from `@/components/showcase-core` instead of the individual files.
 * Also keeps the folder registered as "used" by knip during the Phase 2
 * migration window.
 *
 * @module components/showcase-core
 */

export { ShowcaseClient } from './ShowcaseClient';
export type {
  ShowcaseClientConfig,
  ShowcaseClientLocale,
  ShowcaseClientProps,
  ShowcaseClientStateKeys,
  ShowcaseClientT,
  ShowcaseHeaderOverrides,
} from './ShowcaseClient';

export { ShowcaseSpecsGrid, pushSpecRow } from './ShowcaseSpecsGrid';
export type { ShowcaseSpecsGridProps, ShowcaseSpecsGridRow } from './ShowcaseSpecsGrid';
