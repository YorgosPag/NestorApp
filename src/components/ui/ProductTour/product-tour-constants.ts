/**
 * @module ProductTour/product-tour-constants
 * @description Shared constants for ProductTour components.
 * Extracted from ProductTour.tsx for SRP compliance (ADR-065).
 */

import { zIndex, componentSizes } from '@/styles/design-tokens';

/**
 * Tour styling constants from centralized design-tokens.
 * All values reference centralized sources — ZERO hardcoded values.
 */
export const TOUR_STYLES = {
  zIndex: {
    backdrop: zIndex.overlay,
    tooltip: zIndex.tooltip,
    spotlight: zIndex.modal,
  },
  spotlight: {
    defaultPadding: 8,
    borderRadius: 8,
  },
  tooltip: {
    offset: 12,
    arrowSize: 8,
  },
  stepIndicator: componentSizes.icon.xxs,
} as const;
