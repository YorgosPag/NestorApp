/**
 * THEME PROVIDER & SYSTEM
 * Geo-Alert System - Phase 6: Enterprise Theme Management
 *
 * Split (ADR-065 Phase 3, #14):
 * - theme-types.ts — Type definitions
 * - theme-config.ts — Color configs + CSS variable generation
 * - ThemeProvider.tsx — Provider component + hooks (this file)
 */

import * as React from 'react';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { ThemeMode, ColorScheme, Density } from './theme-types';
import {
  themeColors,
  darkColors,
  highContrastColors,
  themeTypography,
  themeSpacing,
  themeShadows,
  themeBorderRadius,
  themeAnimations,
  generateCSSVariables,
} from './theme-config';

// Re-export types for consumers
export type { ThemeMode, ColorScheme, Density } from './theme-types';
export type {
  ThemeColors,
  ExtendedBackgroundColors,
  ExtendedTextColors,
  ExtendedSemanticColors,
  ExtendedTypography,
  ExtendedShadows,
  ExtendedBorderRadius,
  ExtendedAnimations,
  SemanticColorVariant,
  ColorScale,
  SeverityLevel,
} from './theme-types';

// ============================================================================
// THEME INTERFACE
// ============================================================================

export interface Theme {
  mode: ThemeMode;
  colorScheme: ColorScheme;
  density: Density;
  colors: typeof themeColors;
  typography: typeof themeTypography;
  spacing: typeof themeSpacing;
  shadows: typeof themeShadows;
  borderRadius: typeof themeBorderRadius;
  animations: typeof themeAnimations;
  cssVariables: Record<string, string>;
}

export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  colorScheme: ColorScheme;
  density: Density;
  setMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setDensity: (density: Density) => void;
  toggleMode: () => void;
  isDark: boolean;
  isHighContrast: boolean;
  prefersReducedMotion: boolean;
}

// ============================================================================
// THEME CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ============================================================================
// THEME PROVIDER COMPONENT
// ============================================================================

export interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
  defaultColorScheme?: ColorScheme;
  defaultDensity?: Density;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'auto',
  defaultColorScheme = 'default',
  defaultDensity = 'comfortable',
  storageKey = 'geo-alert-theme'
}) => {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    try {
      const stored = localStorage.getItem(`${storageKey}-mode`);
      return (stored as ThemeMode) || defaultMode;
    } catch {
      return defaultMode;
    }
  });

  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    if (typeof window === 'undefined') return defaultColorScheme;
    try {
      const stored = localStorage.getItem(`${storageKey}-color-scheme`);
      return (stored as ColorScheme) || defaultColorScheme;
    } catch {
      return defaultColorScheme;
    }
  });

  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === 'undefined') return defaultDensity;
    try {
      const stored = localStorage.getItem(`${storageKey}-density`);
      return (stored as Density) || defaultDensity;
    } catch {
      return defaultDensity;
    }
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // ========================================================================
  // SYSTEM PREFERENCES DETECTION
  // ========================================================================

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(darkModeQuery.matches);
    const handleDarkModeChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    darkModeQuery.addEventListener('change', handleDarkModeChange);

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(reducedMotionQuery.matches);
    const handleReducedMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    return () => {
      darkModeQuery.removeEventListener('change', handleDarkModeChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
    };
  }, []);

  // ========================================================================
  // PERSISTENCE
  // ========================================================================

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(`${storageKey}-mode`, mode); }
    catch (err) { console.warn('Failed to save theme mode:', err); }
  }, [mode, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(`${storageKey}-color-scheme`, colorScheme); }
    catch (err) { console.warn('Failed to save color scheme:', err); }
  }, [colorScheme, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(`${storageKey}-density`, density); }
    catch (err) { console.warn('Failed to save density:', err); }
  }, [density, storageKey]);

  // ========================================================================
  // THEME COMPUTATION
  // ========================================================================

  const isDark = mode === 'dark' || (mode === 'auto' && systemPrefersDark);
  const isHighContrast = colorScheme === 'high-contrast';

  const theme: Theme = {
    mode,
    colorScheme,
    density,
    colors: (isDark && !isHighContrast ? darkColors : isHighContrast ? highContrastColors : themeColors) as typeof themeColors,
    typography: themeTypography,
    spacing: themeSpacing,
    shadows: themeShadows,
    borderRadius: themeBorderRadius,
    animations: themeAnimations,
    cssVariables: generateCSSVariables(mode, colorScheme, density, systemPrefersDark)
  };

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const toggleMode = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('auto');
    else setMode('light');
  };

  // ========================================================================
  // CSS VARIABLES APPLICATION
  // ========================================================================

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    Object.entries(theme.cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    root.setAttribute('data-theme-mode', isDark ? 'dark' : 'light');
    root.setAttribute('data-color-scheme', colorScheme);
    root.setAttribute('data-density', density);
    root.setAttribute('data-reduced-motion', prefersReducedMotion.toString());

    return () => {
      Object.keys(theme.cssVariables).forEach(property => {
        root.style.removeProperty(property);
      });
    };
  }, [theme, isDark, colorScheme, density, prefersReducedMotion]);

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  const contextValue: ThemeContextValue = {
    theme,
    mode,
    colorScheme,
    density,
    setMode,
    setColorScheme,
    setDensity,
    toggleMode,
    isDark,
    isHighContrast,
    prefersReducedMotion
  };

  return React.createElement(ThemeContext.Provider, { value: contextValue }, children);
};

// ============================================================================
// THEME HOOKS
// ============================================================================

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const useCSSVariables = () => {
  const { theme } = useTheme();
  return theme.cssVariables;
};

export const useBreakpoint = () => {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('xs');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width >= 1536) setCurrentBreakpoint('2xl');
      else if (width >= 1280) setCurrentBreakpoint('xl');
      else if (width >= 1024) setCurrentBreakpoint('lg');
      else if (width >= 768) setCurrentBreakpoint('md');
      else if (width >= 640) setCurrentBreakpoint('sm');
      else setCurrentBreakpoint('xs');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return currentBreakpoint;
};

export const useDarkMode = () => {
  const { isDark, toggleMode, setMode } = useTheme();
  return { isDark, toggle: toggleMode, setMode };
};

export default ThemeProvider;
