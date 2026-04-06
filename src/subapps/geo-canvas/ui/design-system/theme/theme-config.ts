/**
 * THEME CONFIGURATION - Colors, Variants & CSS Variables
 *
 * Config/data file for theme color definitions and CSS variable generation
 * Contains: light/dark/high-contrast colors, density configs, CSS var generator
 *
 * @module geo-canvas/ui/design-system/theme/theme-config
 * Extracted from ThemeProvider.tsx (ADR-065 Phase 3, #14)
 */

import { GEO_COLORS } from '../../../config/color-config';
import { colors, spacing, typography, shadows, animation, borders } from '../../../../../styles/design-tokens/core';
import { semanticColors } from '../../../../../styles/design-tokens';
import type {
  ThemeColors,
  ThemeMode,
  ColorScheme,
  Density,
  ExtendedBackgroundColors,
  ExtendedTextColors,
  ExtendedSemanticColors,
  ExtendedTypography,
  ExtendedShadows,
  ExtendedBorderRadius,
  ExtendedAnimations,
} from './theme-types';

// ============================================================================
// BASE THEME TOKENS (from centralized design tokens)
// ============================================================================

export const themeTypography = typography || {
  fontFamily: { body: 'system-ui', heading: 'system-ui' },
  fontSize: { sm: '14px', base: '16px', lg: '18px' }
};
export const themeSpacing = spacing || { xs: '4px', sm: '8px', md: '16px', lg: '24px' };
export const themeShadows = shadows || { sm: GEO_COLORS.UI.SHADOW_SM, md: GEO_COLORS.UI.SHADOW_MD };
export const themeBorderRadius = borders?.radius || { sm: '4px', md: '8px', lg: '12px' };
export const themeAnimations = animation || { duration: { fast: '150ms', normal: '300ms' } };

// ============================================================================
// LIGHT THEME COLORS (default)
// ============================================================================

export const themeColors: ThemeColors = {
  ...colors,
  primary: colors.blue,
  semantic: semanticColors || {
    status: {
      success: 'hsl(var(--status-success))',
      info: 'hsl(var(--status-info))',
      warning: 'hsl(var(--status-warning))',
      error: 'hsl(var(--status-error))',
      purple: 'hsl(var(--status-purple))'
    },
    propertyStatus: { available: '#22c55e', pending: '#f97316', unavailable: '#ef4444' },
    buildingStatus: { active: '#3b82f6', inactive: '#6b7280', maintenance: '#f59e0b' },
    success: { main: colors.green?.[500] || '#22c55e', light: colors.green?.[300] || '#86efac', dark: colors.green?.[600] || '#16a34a' },
    warning: { main: colors.orange?.[500] || '#f97316', light: colors.orange?.[300] || '#fdba74', dark: colors.orange?.[600] || '#ea580c' },
    error: { main: colors.red?.[500] || '#ef4444', light: colors.red?.[300] || '#fca5a5', dark: colors.red?.[600] || '#dc2626' },
    info: { main: colors.blue?.[500] || '#3b82f6', light: colors.blue?.[300] || '#93c5fd', dark: colors.blue?.[600] || '#2563eb' }
  },
  severity: {
    critical: { background: '#ef4444', border: '#dc2626', text: '#ffffff', icon: '#ef4444' },
    high: { background: '#f97316', border: '#ea580c', text: '#ffffff', icon: '#f97316' },
    medium: { background: '#3b82f6', border: '#2563eb', text: '#ffffff', icon: '#3b82f6' },
    low: { background: '#22c55e', border: '#16a34a', text: '#ffffff', icon: '#22c55e' },
    info: { background: '#93c5fd', border: '#3b82f6', text: '#1e293b', icon: '#3b82f6' }
  }
} as const;

// ============================================================================
// DARK THEME COLORS
// ============================================================================

export const darkColors: ThemeColors = {
  ...themeColors,
  background: {
    primary: 'hsl(var(--background))',
    secondary: 'hsl(var(--muted))',
    tertiary: 'hsl(var(--card))',
    inverse: 'hsl(var(--foreground))',
    overlay: GEO_COLORS.UI.OVERLAY_DARK,
    disabled: 'hsl(var(--muted))'
  },
  text: {
    primary: 'hsl(var(--foreground))',
    secondary: 'hsl(var(--muted-foreground))',
    tertiary: 'hsl(var(--muted-foreground))',
    inverse: 'hsl(var(--background))',
    disabled: 'hsl(var(--muted-foreground))',
    link: 'hsl(var(--primary))',
    linkHover: 'hsl(var(--primary))'
  },
  border: {
    primary: 'hsl(var(--border))',
    secondary: 'hsl(var(--border))',
    tertiary: 'hsl(var(--border))',
    focus: 'hsl(var(--ring))',
    error: 'hsl(var(--destructive))',
    success: 'hsl(var(--primary))',
    warning: 'hsl(var(--secondary))'
  },
  severity: {
    critical: { background: '#ef4444', border: '#dc2626', text: '#ffffff', icon: '#ef4444' },
    high: { background: '#f97316', border: '#ea580c', text: '#ffffff', icon: '#f97316' },
    medium: { background: '#3b82f6', border: '#2563eb', text: '#ffffff', icon: '#3b82f6' },
    low: { background: '#22c55e', border: '#16a34a', text: '#ffffff', icon: '#22c55e' },
    info: { background: '#93c5fd', border: '#3b82f6', text: '#1e293b', icon: '#3b82f6' }
  }
};

// ============================================================================
// HIGH CONTRAST COLORS
// ============================================================================

export const highContrastColors: ThemeColors = {
  ...themeColors,
  background: {
    primary: 'hsl(var(--background))',
    secondary: 'hsl(var(--background))',
    tertiary: 'hsl(var(--muted))',
    inverse: 'hsl(var(--foreground))',
    overlay: GEO_COLORS.UI.OVERLAY_DARK,
    disabled: 'hsl(var(--muted))'
  },
  text: {
    primary: 'hsl(var(--foreground))',
    secondary: 'hsl(var(--foreground))',
    tertiary: 'hsl(var(--muted-foreground))',
    inverse: 'hsl(var(--background))',
    disabled: 'hsl(var(--muted-foreground))',
    link: 'hsl(var(--primary))',
    linkHover: 'hsl(var(--primary))'
  },
  border: {
    primary: 'hsl(var(--border))',
    secondary: 'hsl(var(--border))',
    tertiary: 'hsl(var(--border))',
    focus: 'hsl(var(--ring))',
    error: 'hsl(var(--destructive))',
    success: 'hsl(var(--primary))',
    warning: 'hsl(var(--secondary))'
  },
  severity: {
    critical: { background: '#000000', border: '#ffffff', text: '#ffffff', icon: '#ffffff' },
    high: { background: '#000000', border: '#ffffff', text: '#ffffff', icon: '#ffffff' },
    medium: { background: '#000000', border: '#ffffff', text: '#ffffff', icon: '#ffffff' },
    low: { background: '#000000', border: '#ffffff', text: '#ffffff', icon: '#ffffff' },
    info: { background: '#000000', border: '#ffffff', text: '#ffffff', icon: '#ffffff' }
  }
};

// ============================================================================
// DENSITY VARIATIONS
// ============================================================================

export const densitySpacing = {
  compact: { multiplier: 0.75, baseUnit: 3 },
  comfortable: { multiplier: 1, baseUnit: 4 },
  spacious: { multiplier: 1.25, baseUnit: 5 }
} as const;

// ============================================================================
// CSS VARIABLES GENERATION
// ============================================================================

export const generateCSSVariables = (
  mode: ThemeMode,
  colorScheme: ColorScheme,
  density: Density,
  systemPrefersDark: boolean
): Record<string, string> => {
  const isDark = mode === 'dark' || (mode === 'auto' && systemPrefersDark);
  const isHighContrast = colorScheme === 'high-contrast';

  let currentThemeColors: ThemeColors = themeColors;
  if (isDark && !isHighContrast) {
    currentThemeColors = darkColors;
  } else if (isHighContrast) {
    currentThemeColors = highContrastColors;
  }

  const densityConfig = densitySpacing[density];

  return {
    // Color variables
    '--color-primary-50': currentThemeColors.primary?.[50] || currentThemeColors.blue?.[50] || '#f0f9ff',
    '--color-primary-100': currentThemeColors.primary?.[100] || currentThemeColors.blue?.[100] || '#e0f2fe',
    '--color-primary-200': currentThemeColors.primary?.[200] || currentThemeColors.blue?.[200] || '#bae6fd',
    '--color-primary-300': currentThemeColors.primary?.[300] || currentThemeColors.blue?.[300] || '#7dd3fc',
    '--color-primary-400': currentThemeColors.primary?.[400] || currentThemeColors.blue?.[400] || '#38bdf8',
    '--color-primary-500': currentThemeColors.primary?.[500] || currentThemeColors.blue?.[500] || '#0ea5e9',
    '--color-primary-600': currentThemeColors.primary?.[600] || currentThemeColors.blue?.[600] || '#0284c7',
    '--color-primary-700': currentThemeColors.primary?.[700] || currentThemeColors.blue?.[700] || '#0369a1',
    '--color-primary-800': currentThemeColors.primary?.[800] || currentThemeColors.blue?.[800] || '#075985',
    '--color-primary-900': currentThemeColors.primary?.[900] || currentThemeColors.blue?.[900] || '#0c4a6e',

    '--color-bg-primary': currentThemeColors.background?.primary || '#ffffff',
    '--color-bg-secondary': currentThemeColors.background?.secondary || '#f8fafc',
    '--color-bg-tertiary': currentThemeColors.background?.tertiary || '#f1f5f9',
    '--color-bg-inverse': (currentThemeColors.background as ExtendedBackgroundColors)?.inverse || currentThemeColors.text?.primary || '#1e293b',
    '--color-bg-overlay': currentThemeColors.background?.overlay || 'rgba(0, 0, 0, 0.5)',
    '--color-bg-disabled': (currentThemeColors.background as ExtendedBackgroundColors)?.disabled || '#f8fafc',

    '--color-text-primary': currentThemeColors.text?.primary || '#1e293b',
    '--color-text-secondary': currentThemeColors.text?.secondary || '#64748b',
    '--color-text-tertiary': currentThemeColors.text?.tertiary || currentThemeColors.text?.muted || '#94a3b8',
    '--color-text-inverse': currentThemeColors.text?.inverse || '#ffffff',
    '--color-text-disabled': (currentThemeColors.text as ExtendedTextColors)?.disabled || currentThemeColors.text?.muted || '#94a3b8',
    '--color-text-link': currentThemeColors.primary?.[500] || currentThemeColors.blue?.[500] || '#3b82f6',
    '--color-text-link-hover': currentThemeColors.primary?.[600] || currentThemeColors.blue?.[600] || '#2563eb',

    '--color-border-primary': currentThemeColors.border?.primary || '#e2e8f0',
    '--color-border-secondary': currentThemeColors.border?.secondary || '#cbd5e1',
    '--color-border-tertiary': currentThemeColors.border?.tertiary || '#f1f5f9',
    '--color-border-focus': currentThemeColors.primary?.[500] || currentThemeColors.blue?.[500] || '#3b82f6',
    '--color-border-error': currentThemeColors.red?.[500] || '#ef4444',
    '--color-border-success': currentThemeColors.green?.[500] || '#22c55e',
    '--color-border-warning': currentThemeColors.orange?.[500] || '#f97316',

    // Semantic colors
    '--color-success': (currentThemeColors.semantic as ExtendedSemanticColors)?.success?.main || currentThemeColors.green?.[500] || '#22c55e',
    '--color-success-light': (currentThemeColors.semantic as ExtendedSemanticColors)?.success?.light || currentThemeColors.green?.[300] || '#86efac',
    '--color-success-dark': (currentThemeColors.semantic as ExtendedSemanticColors)?.success?.dark || currentThemeColors.green?.[600] || '#16a34a',
    '--color-warning': (currentThemeColors.semantic as ExtendedSemanticColors)?.warning?.main || currentThemeColors.orange?.[500] || '#f97316',
    '--color-warning-light': (currentThemeColors.semantic as ExtendedSemanticColors)?.warning?.light || currentThemeColors.orange?.[300] || '#fdba74',
    '--color-warning-dark': (currentThemeColors.semantic as ExtendedSemanticColors)?.warning?.dark || currentThemeColors.orange?.[600] || '#ea580c',
    '--color-error': (currentThemeColors.semantic as ExtendedSemanticColors)?.error?.main || currentThemeColors.red?.[500] || '#ef4444',
    '--color-error-light': (currentThemeColors.semantic as ExtendedSemanticColors)?.error?.light || currentThemeColors.red?.[300] || '#fca5a5',
    '--color-error-dark': (currentThemeColors.semantic as ExtendedSemanticColors)?.error?.dark || currentThemeColors.red?.[600] || '#dc2626',
    '--color-info': (currentThemeColors.semantic as ExtendedSemanticColors)?.info?.main || currentThemeColors.blue?.[500] || '#3b82f6',
    '--color-info-light': (currentThemeColors.semantic as ExtendedSemanticColors)?.info?.light || currentThemeColors.blue?.[300] || '#93c5fd',
    '--color-info-dark': (currentThemeColors.semantic as ExtendedSemanticColors)?.info?.dark || currentThemeColors.blue?.[600] || '#2563eb',

    // Severity colors
    '--color-severity-critical-bg': currentThemeColors.severity?.critical?.background || currentThemeColors.red?.[500] || '#ef4444',
    '--color-severity-critical-border': currentThemeColors.severity?.critical?.border || currentThemeColors.red?.[600] || '#dc2626',
    '--color-severity-critical-text': currentThemeColors.severity?.critical?.text || currentThemeColors.text?.inverse || '#ffffff',
    '--color-severity-critical-icon': currentThemeColors.severity?.critical?.icon || currentThemeColors.red?.[500] || '#ef4444',
    '--color-severity-high-bg': currentThemeColors.severity?.high?.background || currentThemeColors.orange?.[500] || '#f97316',
    '--color-severity-high-border': currentThemeColors.severity?.high?.border || currentThemeColors.orange?.[600] || '#ea580c',
    '--color-severity-high-text': currentThemeColors.severity?.high?.text || currentThemeColors.text?.inverse || '#ffffff',
    '--color-severity-high-icon': currentThemeColors.severity?.high?.icon || currentThemeColors.orange?.[500] || '#f97316',
    '--color-severity-medium-bg': currentThemeColors.severity?.medium?.background || currentThemeColors.blue?.[500] || '#3b82f6',
    '--color-severity-medium-border': currentThemeColors.severity?.medium?.border || currentThemeColors.blue?.[600] || '#2563eb',
    '--color-severity-medium-text': currentThemeColors.severity?.medium?.text || currentThemeColors.text?.inverse || '#ffffff',
    '--color-severity-medium-icon': currentThemeColors.severity?.medium?.icon || currentThemeColors.blue?.[500] || '#3b82f6',
    '--color-severity-low-bg': currentThemeColors.severity?.low?.background || currentThemeColors.green?.[500] || '#22c55e',
    '--color-severity-low-border': currentThemeColors.severity?.low?.border || currentThemeColors.green?.[600] || '#16a34a',
    '--color-severity-low-text': currentThemeColors.severity?.low?.text || currentThemeColors.text?.inverse || '#ffffff',
    '--color-severity-low-icon': currentThemeColors.severity?.low?.icon || currentThemeColors.green?.[500] || '#22c55e',
    '--color-severity-info-bg': currentThemeColors.severity?.info?.background || currentThemeColors.blue?.[300] || '#93c5fd',
    '--color-severity-info-border': currentThemeColors.severity?.info?.border || currentThemeColors.blue?.[500] || '#3b82f6',
    '--color-severity-info-text': currentThemeColors.severity?.info?.text || currentThemeColors.text?.primary || '#1e293b',
    '--color-severity-info-icon': currentThemeColors.severity?.info?.icon || currentThemeColors.blue?.[500] || '#3b82f6',

    // Typography
    '--font-family-sans': (themeTypography as ExtendedTypography).fontFamily?.sans?.join?.(', ') || (themeTypography as ExtendedTypography).fontFamily?.body || 'system-ui, sans-serif',
    '--font-family-mono': (themeTypography as ExtendedTypography).fontFamily?.mono?.join?.(', ') || 'Monaco, Menlo, monospace',
    '--font-family-serif': (themeTypography as ExtendedTypography).fontFamily?.serif?.join?.(', ') || 'Georgia, serif',

    // Spacing (adjusted for density)
    '--spacing-1': `${densityConfig.baseUnit * 0.25 * densityConfig.multiplier}px`,
    '--spacing-2': `${densityConfig.baseUnit * 0.5 * densityConfig.multiplier}px`,
    '--spacing-3': `${densityConfig.baseUnit * 0.75 * densityConfig.multiplier}px`,
    '--spacing-4': `${densityConfig.baseUnit * densityConfig.multiplier}px`,
    '--spacing-5': `${densityConfig.baseUnit * 1.25 * densityConfig.multiplier}px`,
    '--spacing-6': `${densityConfig.baseUnit * 1.5 * densityConfig.multiplier}px`,
    '--spacing-8': `${densityConfig.baseUnit * 2 * densityConfig.multiplier}px`,
    '--spacing-10': `${densityConfig.baseUnit * 2.5 * densityConfig.multiplier}px`,
    '--spacing-12': `${densityConfig.baseUnit * 3 * densityConfig.multiplier}px`,
    '--spacing-16': `${densityConfig.baseUnit * 4 * densityConfig.multiplier}px`,
    '--spacing-20': `${densityConfig.baseUnit * 5 * densityConfig.multiplier}px`,
    '--spacing-24': `${densityConfig.baseUnit * 6 * densityConfig.multiplier}px`,

    // Shadows
    '--shadow-sm': themeShadows?.sm || '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '--shadow-base': (themeShadows as ExtendedShadows)?.base || '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    '--shadow-md': themeShadows?.md || '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    '--shadow-lg': (themeShadows as ExtendedShadows)?.lg || '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    '--shadow-xl': (themeShadows as ExtendedShadows)?.xl || '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '--shadow-2xl': (themeShadows as ExtendedShadows)?.['2xl'] || '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '--shadow-inner': (themeShadows as ExtendedShadows)?.inner || 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    '--shadow-focus': (themeShadows as ExtendedShadows)?.focus || '0 0 0 3px rgba(59, 130, 246, 0.5)',
    '--shadow-card': (themeShadows as ExtendedShadows)?.card || themeShadows?.md || '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    '--shadow-modal': (themeShadows as ExtendedShadows)?.modal || (themeShadows as ExtendedShadows)?.xl || '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    '--shadow-dropdown': (themeShadows as ExtendedShadows)?.dropdown || (themeShadows as ExtendedShadows)?.lg || '0 10px 15px -3px rgba(0, 0, 0, 0.1)',

    // Border radius
    '--radius-sm': themeBorderRadius?.sm || '4px',
    '--radius-base': (themeBorderRadius as ExtendedBorderRadius)?.base || '6px',
    '--radius-md': themeBorderRadius?.md || '8px',
    '--radius-lg': themeBorderRadius?.lg || '12px',
    '--radius-xl': (themeBorderRadius as ExtendedBorderRadius)?.xl || '16px',
    '--radius-2xl': (themeBorderRadius as ExtendedBorderRadius)?.['2xl'] || '20px',
    '--radius-3xl': (themeBorderRadius as ExtendedBorderRadius)?.['3xl'] || '24px',
    '--radius-full': (themeBorderRadius as ExtendedBorderRadius)?.full || '9999px',

    // Animation
    '--duration-fast': (themeAnimations as ExtendedAnimations)?.duration?.fast || '150ms',
    '--duration-base': (themeAnimations as ExtendedAnimations)?.duration?.base || (themeAnimations as ExtendedAnimations)?.duration?.normal || '300ms',
    '--duration-slow': (themeAnimations as ExtendedAnimations)?.duration?.slow || '500ms',
    '--duration-slower': (themeAnimations as ExtendedAnimations)?.duration?.slower || '750ms',
    '--easing-ease-in': (themeAnimations as ExtendedAnimations)?.easing?.easeIn || 'cubic-bezier(0.4, 0, 1, 1)',
    '--easing-ease-out': (themeAnimations as ExtendedAnimations)?.easing?.easeOut || 'cubic-bezier(0, 0, 0.2, 1)',
    '--easing-ease-in-out': (themeAnimations as ExtendedAnimations)?.easing?.easeInOut || 'cubic-bezier(0.4, 0, 0.2, 1)',
    '--easing-bounce': (themeAnimations as ExtendedAnimations)?.easing?.bounce || 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',

    // Theme metadata
    '--theme-mode': mode,
    '--theme-color-scheme': colorScheme,
    '--theme-density': density
  };
};
