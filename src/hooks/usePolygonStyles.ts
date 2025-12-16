/**
 * 🎨 ENTERPRISE POLYGON STYLES HOOK
 *
 * React hook για database-driven polygon styling με caching και performance optimization.
 *
 * Features:
 * - Async style loading από Firebase
 * - React state management
 * - Error handling και fallbacks
 * - Theme switching support
 * - Tenant-aware styling
 * - Performance optimization
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PolygonType, PolygonStyle } from '../../packages/core/polygon-system/types';
import { polygonStyleService } from '@/services/polygon/EnterprisePolygonStyleService';

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UsePolygonStylesOptions {
  /** Theme name (default, dark, high-contrast, etc.) */
  theme?: string;
  /** Tenant ID για multi-tenant deployment */
  tenantId?: string;
  /** Environment (development, staging, production) */
  environment?: string;
  /** Auto-reload when theme changes */
  autoReload?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UsePolygonStylesReturn {
  /** All polygon styles by type */
  styles: Record<PolygonType, PolygonStyle> | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Available themes */
  availableThemes: string[];
  /** Current theme */
  currentTheme: string;

  // Actions
  /** Get style για specific polygon type */
  getStyle: (polygonType: PolygonType) => PolygonStyle | null;
  /** Switch to different theme */
  switchTheme: (newTheme: string) => Promise<void>;
  /** Reload styles από database */
  reloadStyles: () => Promise<void>;
  /** Clear styles cache */
  clearCache: () => void;

  // State checks
  /** Are styles ready για use? */
  isReady: boolean;
  /** Is specific theme available? */
  hasTheme: (theme: string) => boolean;
}

// ============================================================================
// POLYGON STYLES HOOK
// ============================================================================

/**
 * 🎨 Hook για enterprise polygon styling
 */
export function usePolygonStyles(options: UsePolygonStylesOptions = {}): UsePolygonStylesReturn {
  const {
    theme = 'default',
    tenantId,
    environment,
    autoReload = true,
    debug = false
  } = options;

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [styles, setStyles] = useState<Record<PolygonType, PolygonStyle> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableThemes, setAvailableThemes] = useState<string[]>(['default', 'dark', 'high-contrast']);
  const [currentTheme, setCurrentTheme] = useState(theme);

  // ========================================================================
  // STYLE LOADING LOGIC
  // ========================================================================

  const loadStyles = useCallback(async (targetTheme: string = currentTheme) => {
    try {
      setLoading(true);
      setError(null);

      if (debug) {
        console.log('🎨 Loading polygon styles:', { targetTheme, tenantId, environment });
      }

      // Load styles από service
      const loadedStyles = await polygonStyleService.loadPolygonStyles(
        targetTheme,
        tenantId,
        environment
      );

      // Load available themes
      const themes = await polygonStyleService.getAvailableThemes(tenantId);

      setStyles(loadedStyles);
      setAvailableThemes(themes);
      setCurrentTheme(targetTheme);

      if (debug) {
        console.log('✅ Polygon styles loaded successfully:', {
          stylesCount: Object.keys(loadedStyles).length,
          themesCount: themes.length,
          currentTheme: targetTheme
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load polygon styles';
      setError(errorMessage);

      if (debug) {
        console.error('❌ Failed to load polygon styles:', err);
      }

      // Set fallback styles
      try {
        const fallbackStyles = polygonStyleService.getFallbackStyles(targetTheme);
        setStyles(fallbackStyles);

        if (debug) {
          console.log('🔄 Using fallback polygon styles');
        }
      } catch (fallbackErr) {
        console.error('❌ Failed to load fallback styles:', fallbackErr);
      }

    } finally {
      setLoading(false);
    }
  }, [currentTheme, tenantId, environment, debug]);

  // ========================================================================
  // EFFECT HOOKS
  // ========================================================================

  // Load styles on mount και theme changes
  useEffect(() => {
    if (autoReload) {
      loadStyles(theme);
    }
  }, [theme, tenantId, environment, autoReload, loadStyles]);

  // ========================================================================
  // MEMOIZED VALUES
  // ========================================================================

  const getStyle = useCallback((polygonType: PolygonType): PolygonStyle | null => {
    if (!styles) return null;
    return styles[polygonType] || null;
  }, [styles]);

  const isReady = useMemo(() => {
    return !loading && styles !== null && error === null;
  }, [loading, styles, error]);

  const hasTheme = useCallback((themeToCheck: string): boolean => {
    return availableThemes.includes(themeToCheck);
  }, [availableThemes]);

  // ========================================================================
  // ACTION HANDLERS
  // ========================================================================

  const switchTheme = useCallback(async (newTheme: string) => {
    if (newTheme === currentTheme) return;

    if (debug) {
      console.log(`🎨 Switching theme from ${currentTheme} to ${newTheme}`);
    }

    await loadStyles(newTheme);
  }, [currentTheme, loadStyles, debug]);

  const reloadStyles = useCallback(async () => {
    if (debug) {
      console.log('🔄 Manually reloading polygon styles');
    }

    // Invalidate cache first
    polygonStyleService.invalidateCache();
    await loadStyles();
  }, [loadStyles, debug]);

  const clearCache = useCallback(() => {
    if (debug) {
      console.log('🗑️ Clearing polygon styles cache');
    }

    polygonStyleService.invalidateCache();
  }, [debug]);

  // ========================================================================
  // RETURN HOOK INTERFACE
  // ========================================================================

  return {
    // State
    styles,
    loading,
    error,
    availableThemes,
    currentTheme,

    // Getters
    getStyle,
    isReady,
    hasTheme,

    // Actions
    switchTheme,
    reloadStyles,
    clearCache
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * 🎨 Hook για single polygon style
 */
export function usePolygonStyle(
  polygonType: PolygonType,
  options: UsePolygonStylesOptions = {}
): {
  style: PolygonStyle | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  const { styles, loading, error, reloadStyles } = usePolygonStyles(options);

  const style = useMemo(() => {
    if (!styles) return null;
    return styles[polygonType] || null;
  }, [styles, polygonType]);

  return {
    style,
    loading,
    error,
    reload: reloadStyles
  };
}

/**
 * 🌙 Hook για theme switching
 */
export function usePolygonThemes(options: UsePolygonStylesOptions = {}): {
  availableThemes: string[];
  currentTheme: string;
  loading: boolean;
  switchTheme: (theme: string) => Promise<void>;
  hasTheme: (theme: string) => boolean;
} {
  const {
    availableThemes,
    currentTheme,
    loading,
    switchTheme,
    hasTheme
  } = usePolygonStyles(options);

  return {
    availableThemes,
    currentTheme,
    loading,
    switchTheme,
    hasTheme
  };
}

/**
 * 🎨 Hook για style preloading (performance optimization)
 */
export function usePolygonStylePreloader(
  themes: string[] = ['default', 'dark'],
  options: UsePolygonStylesOptions = {}
): {
  preloadedThemes: string[];
  isPreloading: boolean;
  preloadTheme: (theme: string) => Promise<void>;
  preloadAllThemes: () => Promise<void>;
} {
  const [preloadedThemes, setPreloadedThemes] = useState<string[]>([]);
  const [isPreloading, setIsPreloading] = useState(false);

  const { tenantId, environment, debug } = options;

  const preloadTheme = useCallback(async (theme: string) => {
    if (preloadedThemes.includes(theme)) return;

    try {
      if (debug) {
        console.log(`🚀 Preloading polygon theme: ${theme}`);
      }

      await polygonStyleService.loadPolygonStyles(theme, tenantId, environment);
      setPreloadedThemes(prev => [...prev, theme]);

    } catch (error) {
      if (debug) {
        console.warn(`⚠️ Failed to preload theme ${theme}:`, error);
      }
    }
  }, [preloadedThemes, tenantId, environment, debug]);

  const preloadAllThemes = useCallback(async () => {
    setIsPreloading(true);

    try {
      const preloadPromises = themes.map(theme => preloadTheme(theme));
      await Promise.allSettled(preloadPromises);

      if (debug) {
        console.log('✅ All polygon themes preloaded');
      }
    } catch (error) {
      if (debug) {
        console.error('❌ Theme preloading failed:', error);
      }
    } finally {
      setIsPreloading(false);
    }
  }, [themes, preloadTheme, debug]);

  // Auto-preload on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        preloadAllThemes();
      });
    } else {
      setTimeout(() => {
        preloadAllThemes();
      }, 1000);
    }
  }, [preloadAllThemes]);

  return {
    preloadedThemes,
    isPreloading,
    preloadTheme,
    preloadAllThemes
  };
}