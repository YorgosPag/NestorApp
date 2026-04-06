/**
 * THEME TYPE DEFINITIONS
 *
 * Enterprise theme type system for Geo-Canvas
 *
 * @module geo-canvas/ui/design-system/theme/theme-types
 * Extracted from ThemeProvider.tsx (ADR-065 Phase 3, #14)
 */

// ============================================================================
// COLOR TYPE DEFINITIONS
// ============================================================================

/** Extended background colors with inverse and disabled */
export interface ExtendedBackgroundColors {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  inverse?: string;
  overlay?: string;
  disabled?: string;
}

/** Extended text colors with disabled field */
export interface ExtendedTextColors {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  muted?: string;
  inverse?: string;
  disabled?: string;
  link?: string;
  linkHover?: string;
}

/** Semantic color variant */
export interface SemanticColorVariant {
  main?: string;
  light?: string;
  dark?: string;
}

/** Extended semantic colors */
export interface ExtendedSemanticColors {
  success?: SemanticColorVariant;
  warning?: SemanticColorVariant;
  error?: SemanticColorVariant;
  info?: SemanticColorVariant;
  status?: Record<string, string>;
  propertyStatus?: Record<string, string>;
  buildingStatus?: Record<string, string>;
}

/** Extended typography with font family variants */
export interface ExtendedTypography {
  fontFamily?: {
    body?: string;
    heading?: string;
    sans?: string[];
    mono?: string[];
    serif?: string[];
  };
  fontSize?: Record<string, string>;
}

/** Extended shadows with all variants */
export interface ExtendedShadows {
  sm?: string;
  base?: string;
  md?: string;
  lg?: string;
  xl?: string;
  '2xl'?: string;
  inner?: string;
  focus?: string;
  card?: string;
  modal?: string;
  dropdown?: string;
}

/** Extended border radius */
export interface ExtendedBorderRadius {
  sm?: string;
  base?: string;
  md?: string;
  lg?: string;
  xl?: string;
  '2xl'?: string;
  '3xl'?: string;
  full?: string;
}

/** Extended animations */
export interface ExtendedAnimations {
  duration?: {
    fast?: string;
    base?: string;
    normal?: string;
    slow?: string;
    slower?: string;
  };
  easing?: {
    easeIn?: string;
    easeOut?: string;
    easeInOut?: string;
    bounce?: string;
  };
}

export type ColorScale = Partial<Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>>;

// ============================================================================
// THEME TYPES
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ColorScheme = 'default' | 'high-contrast' | 'colorblind-friendly';
export type Density = 'compact' | 'comfortable' | 'spacious';

export interface SeverityLevel {
  background?: string;
  border?: string;
  text?: string;
  icon?: string;
}

export type ThemeColors = {
  background?: Record<string, string>;
  text?: Record<string, string>;
  border?: Record<string, string>;
  surface?: Record<string, string>;
  primary?: ColorScale;
  blue?: ColorScale;
  green?: ColorScale;
  orange?: ColorScale;
  red?: ColorScale;
  purple?: ColorScale;
  teal?: ColorScale;
  gray?: ColorScale;
  semantic?: ExtendedSemanticColors;
  severity?: Record<'critical' | 'high' | 'medium' | 'low' | 'info', SeverityLevel>;
  [key: string]: unknown;
};
