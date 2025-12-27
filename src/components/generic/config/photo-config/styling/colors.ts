// ============================================================================
// PHOTO COLORS - ENTERPRISE MODULE
// ============================================================================
//
// 🎨 Color configurations for photo components
// Background colors, borders, and semantic color schemes
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

import { borderVariants } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/**
 * Hook για enterprise-grade photo background colors με centralized semantic colors
 *
 * @returns Photo color configuration με centralized colors
 */
export const usePhotoColors = () => {
  const colors = useSemanticColors();

  return {
    /** Main photo container background - ENTERPRISE CENTRALIZED */
    PHOTO_BACKGROUND: colors.bg.secondary,

    /** Empty state background */
    EMPTY_STATE_BACKGROUND: 'rgb(43, 59, 85)',

    /** Muted background για placeholders */
    MUTED_BACKGROUND: 'bg-muted',

    /** Overlay background για hover effects */
    OVERLAY_BACKGROUND: 'bg-black',

    /** Label background για photo names */
    LABEL_BACKGROUND: 'bg-black bg-opacity-60',

    /** Light background για upload zones - ENTERPRISE CENTRALIZED */
    UPLOAD_BACKGROUND: colors.bg.secondary,

    /** Loading overlay background - ENTERPRISE CENTRALIZED */
    LOADING_OVERLAY: `${colors.bg.secondary} bg-opacity-75`,

    /** Progress bar background - ENTERPRISE CENTRALIZED */
    PROGRESS_BACKGROUND: colors.bg.secondary,

    /** Cancel button background - ENTERPRISE CENTRALIZED */
    CANCEL_BUTTON: colors.bg.hover
  } as const;
};

/**
 * Photo border colors για consistent styling
 */
export const PHOTO_BORDERS = {
  /** Dashed borders για empty states */
  EMPTY_STATE: `border-2 border-dashed ${borderVariants.input.default.className.split(' ')[1]}`,

  /** Hover border για empty states */
  EMPTY_HOVER: `hover:${borderVariants.input.focus.className}`,

  /** Primary border για active states */
  PRIMARY: 'border-primary',

  /** Standard border */
  STANDARD: 'border-border'
} as const;

/**
 * Photo text colors για consistent typography
 */
export const PHOTO_TEXT_COLORS = {
  /** Muted text για empty states */
  MUTED: 'text-muted-foreground',

  /** White text για overlays */
  OVERLAY: 'text-white',

  /** Muted foreground */
  FOREGROUND_MUTED: 'text-muted-foreground',

  /** Light gray text για secondary content */
  LIGHT_MUTED: 'text-muted-foreground',

  /** Medium gray text για upload states */
  MEDIUM: 'text-foreground/80',

  /** Light icon colors για inactive states */
  ICON_LIGHT: 'text-muted-foreground/60',

  /** Gray text για form labels */
  LABEL: 'text-foreground'
} as const;

/**
 * ✅ ENTERPRISE PHOTO COLORS - SINGLE SOURCE OF TRUTH
 *
 * 🏢 ARCHITECTURE: Centralized constants που χρησιμοποιούν semantic color system
 * 🎯 COMPATIBILITY: Zero breaking changes για 30+ existing files
 * 🔧 INTEGRATION: useSemanticColors hook για dynamic theming
 *
 * @see useSemanticColors για dynamic color access
 * @see usePhotoColors για hook-based API
 */

/**
 * Core photo colors με semantic mapping
 * Enterprise pattern: Static constants για performance + semantic fallbacks
 */
export const PHOTO_COLORS = {
  /** Main photo container background - Uses semantic secondary */
  PHOTO_BACKGROUND: 'bg-secondary',

  /** Empty state background - Semantic muted background */
  EMPTY_STATE_BACKGROUND: 'bg-muted/50',

  /** Muted background για placeholders - Direct semantic */
  MUTED_BACKGROUND: 'bg-muted',

  /** Overlay background για hover effects - High contrast overlay */
  OVERLAY_BACKGROUND: 'bg-black/60',

  /** Label background για photo names - Text overlay με opacity */
  LABEL_BACKGROUND: 'bg-black/60',

  /** Light background για upload zones - Matches container */
  UPLOAD_BACKGROUND: 'bg-secondary',

  /** Loading overlay background - Semi-transparent secondary */
  LOADING_OVERLAY: 'bg-secondary/75',

  /** Progress bar background - Matches semantic secondary */
  PROGRESS_BACKGROUND: 'bg-secondary',

  /** Cancel button background - Interactive muted state */
  CANCEL_BUTTON: 'bg-muted hover:bg-muted/80'
} as const;

/**
 * Photo semantic colors για consistent meaning
 */
export const PHOTO_SEMANTIC_COLORS = {
  /** Error states */
  ERROR: 'text-red-600',

  /** Success states */
  SUCCESS: 'text-green-600',

  /** Loading states */
  LOADING: 'text-blue-600',

  /** Warning states */
  WARNING: 'text-yellow-600',

  /** Info states */
  INFO: 'text-blue-700'
} as const;