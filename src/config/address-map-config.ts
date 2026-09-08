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
  // ⛔ ΚΑΔΡΑΡΙΣΜΑ — ΔΕΝ ΖΕΙ ΠΙΑ ΕΔΩ
  // ===========================================================================
  //
  // 🔴 Τα `FIT_BOUNDS_PADDING: 50`, `DEFAULT_MAX_ZOOM: 18` και
  //    `ANIMATION.FIT_BOUNDS: 1000` ήταν **η τρίτη από τρεις ανεξάρτητες
  //    κεντρικοποιήσεις** που δεν γνωρίζονταν μεταξύ τους — καθεμιά «κεντρική» για τη
  //    δική της οθόνη, και οι τρεις μαζί ο λόγος που ο ίδιος χάρτης πετούσε αλλού
  //    900 ms και αλλού πηδούσε ακαριαία.
  //
  // ✅ Η μία αρχή είναι το **`@/lib/geo/camera-motion`**. Το `50` δεν είχε μέτρηση
  //    πίσω του *(έγραφε «Pattern: Google Maps fitBounds padding»)*, ενώ το `18`
  //    είχε — και **επιβίωσε ονομασμένο** ως `'confirmed'`.

  // ===========================================================================
  // ANIMATION SETTINGS
  // ===========================================================================

  /**
   * Animation durations (milliseconds)
   * Pattern: Material Design motion guidelines
   */
  ANIMATION: {
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
 * Height preset keys for AddressMap
 */
export type AddressMapHeightPreset = keyof typeof ADDRESS_MAP_CONFIG.HEIGHT_PRESETS;

