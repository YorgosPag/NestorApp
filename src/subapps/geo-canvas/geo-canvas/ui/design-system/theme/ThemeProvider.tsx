/**
 * THEME PROVIDER & SYSTEM
 * Geo-Alert System - Phase 6: Enterprise Theme Management
 *
 * Comprehensive theme system με dark mode, high contrast, και accessibility support.
 * Implements enterprise theme patterns με CSS variables και React Context.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { colors, typography, spacing, shadows, borderRadius, animations } from '../tokens/design-tokens';

// ============================================================================
// THEME TYPES
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ColorScheme = 'default' | 'high-contrast' | 'colorblind-friendly';
export type Density = 'compact' | 'comfortable' | 'spacious';

export interface Theme {
  mode: ThemeMode;
  colorScheme: ColorScheme;
  density: Density;
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  shadows: typeof shadows;
  borderRadius: typeof borderRadius;
  animations: typeof animations;
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
// DARK THEME COLORS
// ============================================================================

const darkColors = {
  ...colors,

  // Override specific colors για dark mode
  background: {
    primary: '#0F172A',      // slate-900
    secondary: '#1E293B',    // slate-800
    tertiary: '#334155',     // slate-700
    inverse: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.8)',
    disabled: '#334155'
  },

  text: {
    primary: '#F8FAFC',      // slate-50
    secondary: '#CBD5E1',    // slate-300
    tertiary: '#94A3B8',     // slate-400
    inverse: '#0F172A',
    disabled: '#64748B',     // slate-500
    link: '#60A5FA',         // blue-400
    linkHover: '#3B82F6'     // blue-500
  },

  border: {
    primary: '#475569',      // slate-600
    secondary: '#64748B',    // slate-500
    tertiary: '#94A3B8',     // slate-400
    focus: '#60A5FA',        // blue-400
    error: '#F87171',        // red-400
    success: '#4ADE80',      // green-400
    warning: '#FBBF24'       // amber-400
  },

  severity: {
    critical: {
      background: '#7F1D1D',  // red-900
      border: '#DC2626',      // red-600
      text: '#FCA5A5',        // red-300
      icon: '#F87171'         // red-400
    },
    high: {
      background: '#78350F',  // amber-900
      border: '#D97706',      // amber-600
      text: '#FCD34D',        // amber-300
      icon: '#FBBF24'         // amber-400
    },
    medium: {
      background: '#1E3A8A',  // blue-900
      border: '#2563EB',      // blue-600
      text: '#93C5FD',        // blue-300
      icon: '#60A5FA'         // blue-400
    },
    low: {
      background: '#14532D',  // green-900
      border: '#16A34A',      // green-600
      text: '#86EFAC',        // green-300
      icon: '#4ADE80'         // green-400
    },
    info: {
      background: '#0C4A6E',  // sky-900
      border: '#0284C7',      // sky-600
      text: '#7DD3FC',        // sky-300
      icon: '#38BDF8'         // sky-400
    }
  }
} as const;

// ============================================================================
// HIGH CONTRAST COLORS
// ============================================================================

const highContrastColors = {
  ...colors,

  background: {
    primary: '#FFFFFF',
    secondary: '#FFFFFF',
    tertiary: '#F5F5F5',
    inverse: '#000000',
    overlay: 'rgba(0, 0, 0, 0.9)',
    disabled: '#F5F5F5'
  },

  text: {
    primary: '#000000',
    secondary: '#000000',
    tertiary: '#333333',
    inverse: '#FFFFFF',
    disabled: '#666666',
    link: '#0000EE',
    linkHover: '#0000CC'
  },

  border: {
    primary: '#000000',
    secondary: '#333333',
    tertiary: '#666666',
    focus: '#FF6600',
    error: '#CC0000',
    success: '#008800',
    warning: '#FF8800'
  }
} as const;

// ============================================================================
// DENSITY VARIATIONS
// ============================================================================

const densitySpacing = {
  compact: {
    multiplier: 0.75,
    baseUnit: 3 // 12px base instead of 16px
  },
  comfortable: {
    multiplier: 1,
    baseUnit: 4 // 16px base (default)
  },
  spacious: {
    multiplier: 1.25,
    baseUnit: 5 // 20px base
  }
} as const;

// ============================================================================
// CSS VARIABLES GENERATION
// ============================================================================

const generateCSSVariables = (
  mode: ThemeMode,
  colorScheme: ColorScheme,
  density: Density,
  systemPrefersDark: boolean
): Record<string, string> => {
  const isDark = mode === 'dark' || (mode === 'auto' && systemPrefersDark);
  const isHighContrast = colorScheme === 'high-contrast';

  let themeColors = colors;
  if (isDark && !isHighContrast) {
    themeColors = darkColors;
  } else if (isHighContrast) {
    themeColors = highContrastColors;
  }

  const densityConfig = densitySpacing[density];

  return {
    // Color variables
    '--color-primary-50': themeColors.primary[50],
    '--color-primary-100': themeColors.primary[100],
    '--color-primary-200': themeColors.primary[200],
    '--color-primary-300': themeColors.primary[300],
    '--color-primary-400': themeColors.primary[400],
    '--color-primary-500': themeColors.primary[500],
    '--color-primary-600': themeColors.primary[600],
    '--color-primary-700': themeColors.primary[700],
    '--color-primary-800': themeColors.primary[800],
    '--color-primary-900': themeColors.primary[900],

    '--color-bg-primary': themeColors.background.primary,
    '--color-bg-secondary': themeColors.background.secondary,
    '--color-bg-tertiary': themeColors.background.tertiary,
    '--color-bg-inverse': themeColors.background.inverse,
    '--color-bg-overlay': themeColors.background.overlay,
    '--color-bg-disabled': themeColors.background.disabled,

    '--color-text-primary': themeColors.text.primary,
    '--color-text-secondary': themeColors.text.secondary,
    '--color-text-tertiary': themeColors.text.tertiary,
    '--color-text-inverse': themeColors.text.inverse,
    '--color-text-disabled': themeColors.text.disabled,
    '--color-text-link': themeColors.text.link,
    '--color-text-link-hover': themeColors.text.linkHover,

    '--color-border-primary': themeColors.border.primary,
    '--color-border-secondary': themeColors.border.secondary,
    '--color-border-tertiary': themeColors.border.tertiary,
    '--color-border-focus': themeColors.border.focus,
    '--color-border-error': themeColors.border.error,
    '--color-border-success': themeColors.border.success,
    '--color-border-warning': themeColors.border.warning,

    // Semantic colors
    '--color-success': themeColors.semantic.success.main,
    '--color-success-light': themeColors.semantic.success.light,
    '--color-success-dark': themeColors.semantic.success.dark,
    '--color-warning': themeColors.semantic.warning.main,
    '--color-warning-light': themeColors.semantic.warning.light,
    '--color-warning-dark': themeColors.semantic.warning.dark,
    '--color-error': themeColors.semantic.error.main,
    '--color-error-light': themeColors.semantic.error.light,
    '--color-error-dark': themeColors.semantic.error.dark,
    '--color-info': themeColors.semantic.info.main,
    '--color-info-light': themeColors.semantic.info.light,
    '--color-info-dark': themeColors.semantic.info.dark,

    // Severity colors
    '--color-severity-critical-bg': themeColors.severity.critical.background,
    '--color-severity-critical-border': themeColors.severity.critical.border,
    '--color-severity-critical-text': themeColors.severity.critical.text,
    '--color-severity-critical-icon': themeColors.severity.critical.icon,

    '--color-severity-high-bg': themeColors.severity.high.background,
    '--color-severity-high-border': themeColors.severity.high.border,
    '--color-severity-high-text': themeColors.severity.high.text,
    '--color-severity-high-icon': themeColors.severity.high.icon,

    '--color-severity-medium-bg': themeColors.severity.medium.background,
    '--color-severity-medium-border': themeColors.severity.medium.border,
    '--color-severity-medium-text': themeColors.severity.medium.text,
    '--color-severity-medium-icon': themeColors.severity.medium.icon,

    '--color-severity-low-bg': themeColors.severity.low.background,
    '--color-severity-low-border': themeColors.severity.low.border,
    '--color-severity-low-text': themeColors.severity.low.text,
    '--color-severity-low-icon': themeColors.severity.low.icon,

    '--color-severity-info-bg': themeColors.severity.info.background,
    '--color-severity-info-border': themeColors.severity.info.border,
    '--color-severity-info-text': themeColors.severity.info.text,
    '--color-severity-info-icon': themeColors.severity.info.icon,

    // Typography
    '--font-family-sans': typography.fontFamily.sans.join(', '),
    '--font-family-mono': typography.fontFamily.mono.join(', '),
    '--font-family-serif': typography.fontFamily.serif.join(', '),

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
    '--shadow-sm': shadows.sm,
    '--shadow-base': shadows.base,
    '--shadow-md': shadows.md,
    '--shadow-lg': shadows.lg,
    '--shadow-xl': shadows.xl,
    '--shadow-2xl': shadows['2xl'],
    '--shadow-inner': shadows.inner,
    '--shadow-focus': shadows.focus,
    '--shadow-card': shadows.card,
    '--shadow-modal': shadows.modal,
    '--shadow-dropdown': shadows.dropdown,

    // Border radius
    '--radius-sm': borderRadius.sm,
    '--radius-base': borderRadius.base,
    '--radius-md': borderRadius.md,
    '--radius-lg': borderRadius.lg,
    '--radius-xl': borderRadius.xl,
    '--radius-2xl': borderRadius['2xl'],
    '--radius-3xl': borderRadius['3xl'],
    '--radius-full': borderRadius.full,

    // Animation
    '--duration-fast': animations.duration.fast,
    '--duration-base': animations.duration.base,
    '--duration-slow': animations.duration.slow,
    '--duration-slower': animations.duration.slower,
    '--easing-ease-in': animations.easing.easeIn,
    '--easing-ease-out': animations.easing.easeOut,
    '--easing-ease-in-out': animations.easing.easeInOut,
    '--easing-bounce': animations.easing.bounce,

    // Theme metadata
    '--theme-mode': mode,
    '--theme-color-scheme': colorScheme,
    '--theme-density': density
  };
};

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

    // Dark mode preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(darkModeQuery.matches);

    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    darkModeQuery.addEventListener('change', handleDarkModeChange);

    // Reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(reducedMotionQuery.matches);

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

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
    try {
      localStorage.setItem(`${storageKey}-mode`, mode);
    } catch (error) {
      console.warn('Failed to save theme mode to localStorage:', error);
    }
  }, [mode, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${storageKey}-color-scheme`, colorScheme);
    } catch (error) {
      console.warn('Failed to save color scheme to localStorage:', error);
    }
  }, [colorScheme, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${storageKey}-density`, density);
    } catch (error) {
      console.warn('Failed to save density to localStorage:', error);
    }
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
    colors: isDark && !isHighContrast ? darkColors : isHighContrast ? highContrastColors : colors,
    typography,
    spacing,
    shadows,
    borderRadius,
    animations,
    cssVariables: generateCSSVariables(mode, colorScheme, density, systemPrefersDark)
  };

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleSetMode = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const handleSetColorScheme = (newScheme: ColorScheme) => {
    setColorScheme(newScheme);
  };

  const handleSetDensity = (newDensity: Density) => {
    setDensity(newDensity);
  };

  const toggleMode = () => {
    if (mode === 'light') {
      setMode('dark');
    } else if (mode === 'dark') {
      setMode('auto');
    } else {
      setMode('light');
    }
  };

  // ========================================================================
  // CSS VARIABLES APPLICATION
  // ========================================================================

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Apply CSS variables
    Object.entries(theme.cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Set data attributes για CSS selectors
    root.setAttribute('data-theme-mode', isDark ? 'dark' : 'light');
    root.setAttribute('data-color-scheme', colorScheme);
    root.setAttribute('data-density', density);
    root.setAttribute('data-reduced-motion', prefersReducedMotion.toString());

    return () => {
      // Cleanup on unmount
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
    setMode: handleSetMode,
    setColorScheme: handleSetColorScheme,
    setDensity: handleSetDensity,
    toggleMode,
    isDark,
    isHighContrast,
    prefersReducedMotion
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// ============================================================================
// THEME HOOK
// ============================================================================

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook για accessing CSS variables
 */
export const useCSSVariables = () => {
  const { theme } = useTheme();
  return theme.cssVariables;
};

/**
 * Hook για responsive design
 */
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

/**
 * Hook για dark mode detection
 */
export const useDarkMode = () => {
  const { isDark, toggleMode, setMode } = useTheme();
  return { isDark, toggle: toggleMode, setMode };
};

export default ThemeProvider;