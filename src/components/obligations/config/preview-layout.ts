import { layoutUtilities } from '@/styles/design-tokens';

/**
 * 🏢 ENTERPRISE: Obligation preview layout constants
 * Centralized to avoid hardcoded values in UI.
 */
export const OBLIGATION_PREVIEW_LAYOUT = {
  headerHeightPx: 120,
  minHeightPx: 400,
  fixedPreviewHeightPx: 2300,
  initialPreviewHeight: `calc(100vh - 120px)`,
  splitLayoutGridClass: 'lg:grid-cols-[1fr_1fr] lg:items-start',
  singleLayoutGridClass: 'lg:grid-cols-1',
  toPixels: (value: number) => layoutUtilities.pixels(value),
} as const;
