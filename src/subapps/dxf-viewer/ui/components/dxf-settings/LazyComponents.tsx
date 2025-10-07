// LazyComponents.tsx - Lazy loading infrastructure for DxfSettings components
// STATUS: ACTIVE - Phase 1 Step 1.3
// PURPOSE: Code-splitting για performance optimization

import { lazy } from 'react';

/**
 * LazyComponents - Centralized lazy loading για όλα τα DxfSettings components
 *
 * Benefits:
 * - Μειώνει το initial bundle size
 * - Faster initial page load
 * - Components φορτώνονται on-demand (όταν ο χρήστης τα χρειάζεται)
 *
 * Performance Target:
 * - Initial bundle: <100KB (χωρίς τα settings components)
 * - Per-tab lazy load: <50KB
 * - Per-category lazy load: <30KB
 *
 * @see docs/dxf-settings/ARCHITECTURE.md#Performance - Lazy Loading Strategy
 * @see docs/dxf-settings/TESTING_STRATEGY.md#Performance - Bundle Size Tests
 */

// ============================================================================
// PANELS (Top-level containers)
// ============================================================================

/**
 * DxfSettingsPanel - Root component
 * Lazy loaded: NO (always needed)
 */
export { DxfSettingsPanel } from './panels/DxfSettingsPanel';

/**
 * GeneralSettingsPanel - Container για General settings (Lines, Text, Grips)
 * Lazy loaded: YES (φορτώνεται όταν χρήστης επιλέγει "Γενικές Ρυθμίσεις")
 */
export const LazyGeneralSettingsPanel = lazy(
  () => import('./panels/GeneralSettingsPanel')
);

/**
 * SpecificSettingsPanel - Container για Specific settings (7 categories)
 * Lazy loaded: YES (φορτώνεται όταν χρήστης επιλέγει "Ειδικές Ρυθμίσεις")
 */
export const LazySpecificSettingsPanel = lazy(
  () => import('./panels/SpecificSettingsPanel')
);

// ============================================================================
// TABS (General Settings - Lines, Text, Grips)
// ============================================================================

/**
 * LinesTab - Lines settings tab
 * Lazy loaded: YES (φορτώνεται όταν χρήστης επιλέγει "Lines" tab)
 */
export const LazyLinesTab = lazy(() => import('./tabs/general/LinesTab'));

/**
 * TextTab - Text settings tab
 * Lazy loaded: YES (φορτώνεται όταν χρήστης επιλέγει "Text" tab)
 */
export const LazyTextTab = lazy(() => import('./tabs/general/TextTab'));

/**
 * GripsTab - Grips settings tab
 * Lazy loaded: YES (φορτώνεται όταν χρήστης επιλέγει "Grips" tab)
 */
export const LazyGripsTab = lazy(() => import('./tabs/general/GripsTab'));

// ============================================================================
// CATEGORIES (Specific Settings - 7 categories)
// ============================================================================

/**
 * SelectionCategory - Επιλογή (Selection) category
 * Lazy loaded: YES
 */
export const LazySelectionCategory = lazy(
  () => import('./categories/SelectionCategory')
);

/**
 * CursorCategory - Κέρσορας (Cursor) category
 * Lazy loaded: YES
 */
export const LazyCursorCategory = lazy(
  () => import('./categories/CursorCategory')
);

/**
 * LayersCategory - Layers category
 * Lazy loaded: YES
 */
export const LazyLayersCategory = lazy(
  () => import('./categories/LayersCategory')
);

/**
 * EntitiesCategory - Entities category
 * Lazy loaded: YES
 */
export const LazyEntitiesCategory = lazy(
  () => import('./categories/EntitiesCategory')
);

/**
 * BackgroundCategory - Φόντο (Background) category
 * Lazy loaded: YES
 */
export const LazyBackgroundCategory = lazy(
  () => import('./categories/BackgroundCategory')
);

/**
 * DrawingCategory - Χάραξη (Drawing) category
 * Lazy loaded: YES
 */
export const LazyDrawingCategory = lazy(
  () => import('./categories/DrawingCategory')
);

/**
 * ImportCategory - Εισαγωγή (Import) category
 * Lazy loaded: YES
 */
export const LazyImportCategory = lazy(
  () => import('./categories/ImportCategory')
);

// ============================================================================
// USAGE EXAMPLE (για Phase 2 implementation)
// ============================================================================

/**
 * Example usage με React.Suspense:
 *
 * ```tsx
 * import { Suspense } from 'react';
 * import { LazyGeneralSettingsPanel } from './LazyComponents';
 *
 * function DxfSettingsPanel() {
 *   return (
 *     <Suspense fallback={<LoadingSpinner />}>
 *       <LazyGeneralSettingsPanel />
 *     </Suspense>
 *   );
 * }
 * ```
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md - Lazy Loading Examples
 */

// ============================================================================
// EXPORT ALL (για convenience)
// ============================================================================

export default {
  // Panels
  DxfSettingsPanel,
  LazyGeneralSettingsPanel,
  LazySpecificSettingsPanel,

  // Tabs (General)
  LazyLinesTab,
  LazyTextTab,
  LazyGripsTab,

  // Categories (Specific)
  LazySelectionCategory,
  LazyCursorCategory,
  LazyLayersCategory,
  LazyEntitiesCategory,
  LazyBackgroundCategory,
  LazyDrawingCategory,
  LazyImportCategory,
};
