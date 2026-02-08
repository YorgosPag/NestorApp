/**
 * =============================================================================
 * 🗺️ ADDRESS MAP CONFIGURATION
 * =============================================================================
 *
 * Centralized configuration για AddressMap component
 * Pattern: Microsoft Azure Maps, Google Maps Platform, MapLibre
 *
 * Features:
 * - Map display settings (height, zoom levels)
 * - Marker visual configuration (sizes, colors)
 * - Animation durations
 * - Bounds padding
 *
 * @file address-map-config.ts
 * @created 2026-02-02
 */

import { layoutUtilities } from '@/styles/design-tokens';

// =============================================================================
// MAP DISPLAY SETTINGS
// =============================================================================

export const ADDRESS_MAP_CONFIG = {
  /**
   * Default map height preset
   * Uses centralized layout tokens (no hardcoded heights)
   */
  DEFAULT_HEIGHT_PRESET: 'viewerStandard',

  /**
   * Height presets (Tailwind classes from centralized layout tokens)
   */
  HEIGHT_PRESETS: {
    viewerCompact: layoutUtilities.contentAreas.tailwind.viewerCompact,
    viewerStandard: layoutUtilities.contentAreas.tailwind.viewerStandard,
    viewerExpanded: layoutUtilities.contentAreas.tailwind.viewerExpanded,
    viewerFullscreen: layoutUtilities.contentAreas.tailwind.viewerFullscreen
  },

  /**
   * Default zoom level
   * 15 = Street level (suitable for addresses)
   */
  DEFAULT_ZOOM: 15,

  /**
   * Maximum zoom level
   * 18 = Building level (για detailed view)
   */
  DEFAULT_MAX_ZOOM: 18,

  /**
   * Minimum zoom level
   * 10 = Neighborhood level (context view)
   */
  DEFAULT_MIN_ZOOM: 10,

  // ===========================================================================
  // MARKER VISUAL CONFIGURATION
  // ===========================================================================

  /**
   * Marker sizes (pixels)
   * Pattern: Material Design icon sizes
   */
  MARKER_SIZE: {
    /** Primary address marker (largest, most prominent) */
    PRIMARY: 40,

    /** Secondary address marker (standard size) */
    SECONDARY: 32,

    /** Hover/Selected state (enlarged for emphasis) */
    HOVER: 48
  },

  // ===========================================================================
  // FIT BOUNDS CONFIGURATION
  // ===========================================================================

  /**
   * Padding when fitting bounds to markers
   * Pattern: Google Maps fitBounds padding
   */
  FIT_BOUNDS_PADDING: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50
  },

  // ===========================================================================
  // ANIMATION SETTINGS
  // ===========================================================================

  /**
   * Animation durations (milliseconds)
   * Pattern: Material Design motion guidelines
   */
  ANIMATION: {
    /** fitBounds animation duration (smooth, professional) */
    FIT_BOUNDS: 1000,

    /** Marker highlight animation duration (quick, responsive) */
    MARKER_HIGHLIGHT: 300
  },

  // ===========================================================================
  // VISUAL THEME
  // ===========================================================================

  /**
   * Color scheme
   * Uses CSS variables για consistency με application theme
   */
  COLORS: {
    /** Primary marker color (κύρια διεύθυνση) */
    PRIMARY_MARKER: 'hsl(var(--primary))',

    /** Secondary marker color (δευτερεύουσες διευθύνσεις) */
    SECONDARY_MARKER: 'hsl(var(--accent))'
  }
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Type-safe config access
 */
export type AddressMapConfig = typeof ADDRESS_MAP_CONFIG;

/**
 * Height preset keys for AddressMap
 */
export type AddressMapHeightPreset = keyof typeof ADDRESS_MAP_CONFIG.HEIGHT_PRESETS;

