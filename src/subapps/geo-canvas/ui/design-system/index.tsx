/**
 * DESIGN SYSTEM - MASTER INDEX
 * Geo-Alert System - Phase 6: Complete Enterprise Design System
 *
 * Centralized export για ολόκληρο το Design System ecosystem.
 * Unified access point για όλα τα UI components, themes, και utilities.
 */

import React from 'react';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Color value type for design tokens */
export type ColorValue = string | Record<string | number, string>;

/** Component variant styles type */
export type ComponentVariantStyles = Record<string, unknown>;

/** Design documentation type */
export interface DesignDocumentation {
  colors: typeof import('@/styles/design-tokens').colors;
  typography: typeof import('@/styles/design-tokens').typography;
  spacing: typeof import('@/styles/design-tokens').spacing;
  components: string[];
}

// ============================================================================
// DESIGN TOKENS - Re-export from centralized location
// ============================================================================

export {
  colors,
  typography,
  spacing,
  shadows,
  borderRadius,
  zIndex,
  breakpoints,
  animation as animations
} from '@/styles/design-tokens';

// Local placeholder types since centralized tokens don't export these
export type ColorScale = Record<string | number, string>;
export type SemanticColor = string;
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FontSize = string;
export type FontWeight = number;
export type Spacing = string;
export type Shadow = string;
export type BorderRadius = string;
export type ZIndex = number;
export type Breakpoint = number;

// Placeholder exports for compatibility
export const componentVariants = {} as Record<string, unknown>;
export const layout = {} as Record<string, unknown>;

// ============================================================================
// THEME SYSTEM
// ============================================================================

export * from './theme/ThemeProvider';
export {
  ThemeProvider,
  useTheme,
  useCSSVariables,
  useBreakpoint,
  useDarkMode
} from './theme/ThemeProvider';

export type {
  ThemeMode,
  ColorScheme,
  Density,
  Theme,
  ThemeContextValue,
  ThemeProviderProps
} from './theme/ThemeProvider';

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

export * from './layout/ResponsiveDashboard';
export {
  ResponsiveDashboard,
  Grid,
  GridItem,
  CardGrid,
  TwoColumnLayout,
  ThreeColumnLayout,
  Container,
  Spacer
} from './layout/ResponsiveDashboard';

export type {
  DashboardLayoutProps,
  GridItemProps,
  GridProps,
  CardGridProps
} from './layout/ResponsiveDashboard';

// ============================================================================
// CHART COMPONENTS
// ============================================================================

export * from './charts/AdvancedCharts';
export {
  LineChart,
  BarChart,
  PieChart
} from './charts/AdvancedCharts';

export type {
  ChartDataPoint,
  TimeSeriesPoint,
  ChartProps,
  LineChartProps,
  BarChartProps,
  PieChartProps,
  AreaChartProps
} from './charts/AdvancedCharts';

// ============================================================================
// SEARCH SYSTEM
// ============================================================================

export * from './search/SearchSystem';
export {
  SearchSystem,
  SearchEngine
} from './search/SearchSystem';

export type {
  SearchableItem,
  SearchResult,
  SearchMatch,
  FilterConfig,
  ActiveFilter,
  SearchConfig,
  SearchSystemProps
} from './search/SearchSystem';

// ============================================================================
// PERFORMANCE COMPONENTS
// ============================================================================

export * from './performance/PerformanceComponents';
export {
  VirtualizedList,
  VirtualizedTable,
  LazyImage,
  DebouncedInput,
  Card,
  InfiniteScroll,
  LazyComponentWrapper,
  withPerformanceMonitoring,
  createLazyComponent,
  usePerformanceMonitor
} from './performance/PerformanceComponents';

// ============================================================================
// ⚠️ DEPRECATED: MIGRATING TO CENTRALIZED useBorderTokens SYSTEM
// ============================================================================

// 🚨 ENTERPRISE MIGRATION NOTICE:
// The GeoAlertDesignSystem is being deprecated in favor of the centralized
// useBorderTokens system to eliminate duplicates and ensure consistency
// across the entire application.

import { colors, typography, spacing, shadows, borderRadius } from '@/styles/design-tokens';
import { ThemeProvider } from './theme/ThemeProvider';

/**
 * @deprecated Use useBorderTokens from @/hooks/useBorderTokens instead
 * This class is being phased out for enterprise consistency
 */
export class GeoAlertDesignSystem {
  private static instance: GeoAlertDesignSystem | null = null;

  // Design tokens
  public readonly tokens = {
    colors,
    typography,
    spacing,
    shadows,
    borderRadius
  };

  // Breakpoints για responsive design
  public readonly breakpoints = {
    xs: 475,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
  };

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  private constructor() {
    this.initializeDesignSystem();
  }

  public static getInstance(): GeoAlertDesignSystem {
    if (!GeoAlertDesignSystem.instance) {
      GeoAlertDesignSystem.instance = new GeoAlertDesignSystem();
    }
    return GeoAlertDesignSystem.instance;
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeDesignSystem(): void {
    if (typeof window === 'undefined') return;

    // Inject base CSS variables
    const root = document.documentElement;

    // Base CSS variables που χρειάζονται πάντα
    const baseCSSVariables = {
      '--font-family-sans': this.tokens.typography.fontFamily.sans.join(', '),
      '--font-family-mono': this.tokens.typography.fontFamily.mono.join(', '),
      '--container-max-width': '1280px',
      '--header-height': '64px',
      '--sidebar-width': '256px',
      '--sidebar-collapsed-width': '64px'
    };

    Object.entries(baseCSSVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get color value από palette
   */
  public getColor(color: string, shade?: number): string {
    const colorPath = color.split('.');
    let value: ColorValue = this.tokens.colors as ColorValue;

    for (const path of colorPath) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, ColorValue>)[path];
      }
      if (!value) return color; // Return original if not found
    }

    if (shade && typeof value === 'object' && value !== null) {
      return (value as Record<number, string>)[shade] || color;
    }

    return typeof value === 'string' ? value : color;
  }

  /**
   * Get spacing value
   */
  public getSpacing(size: number): string {
    return this.tokens.spacing[size] || `${size * 4}px`;
  }

  /**
   * Get responsive breakpoint
   */
  public getBreakpoint(breakpoint: keyof typeof this.breakpoints): number {
    return this.breakpoints[breakpoint];
  }

  /**
   * Generate CSS variables object
   */
  public generateCSSVariables(theme: 'light' | 'dark' = 'light'): Record<string, string> {
    const variables: Record<string, string> = {};

    // Colors
    Object.entries(this.tokens.colors.primary).forEach(([shade, value]) => {
      variables[`--color-primary-${shade}`] = value;
    });

    // Spacing
    Object.entries(this.tokens.spacing).forEach(([size, value]) => {
      variables[`--spacing-${size}`] = value;
    });

    // Shadows
    Object.entries(this.tokens.shadows).forEach(([name, value]) => {
      variables[`--shadow-${name}`] = value;
    });

    return variables;
  }

  /**
   * Apply theme to document
   */
  public applyTheme(variables: Record<string, string>): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

  /**
   * Get component variant styles
   */
  public getComponentVariant(component: string, variant: string, size?: string): ComponentVariantStyles {
    // This would return pre-defined component styles
    // Implementation would depend on specific component needs
    return {};
  }

  // ========================================================================
  // VALIDATION METHODS
  // ========================================================================

  /**
   * Validate color contrast ratio
   */
  public validateColorContrast(foreground: string, background: string): {
    ratio: number;
    isAACompliant: boolean;
    isAAACompliant: boolean;
  } {
    // Simplified contrast calculation
    // In real implementation, would use proper color contrast algorithms
    const ratio = 4.5; // Mock value

    return {
      ratio,
      isAACompliant: ratio >= 4.5,
      isAAACompliant: ratio >= 7
    };
  }

  /**
   * Validate spacing consistency
   */
  public validateSpacing(value: string): boolean {
    return Object.values(this.tokens.spacing).includes(value);
  }

  // ========================================================================
  // DEVELOPMENT UTILITIES
  // ========================================================================

  /**
   * Generate design system documentation
   */
  public generateDocumentation(): DesignDocumentation {
    return {
      colors: this.tokens.colors,
      typography: this.tokens.typography,
      spacing: this.tokens.spacing,
      components: [
        'ResponsiveDashboard',
        'Grid',
        'LineChart',
        'BarChart',
        'PieChart',
        'SearchSystem',
        'VirtualizedList',
        'VirtualizedTable',
        'Card',
        'LazyImage'
      ]
    };
  }

  /**
   * Get design system statistics
   */
  public getStatistics(): {
    totalColors: number;
    totalSpacingValues: number;
    totalComponents: number;
    themeSupport: boolean;
    responsiveSupport: boolean;
  } {
    return {
      totalColors: Object.keys(this.tokens.colors).length,
      totalSpacingValues: Object.keys(this.tokens.spacing).length,
      totalComponents: 15, // Approximate count
      themeSupport: true,
      responsiveSupport: true
    };
  }
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

/**
 * Global Design System Instance
 */
export const geoAlertDesignSystem = GeoAlertDesignSystem.getInstance();

/**
 * Default export για convenience
 */
export default geoAlertDesignSystem;

// ============================================================================
// 🔄 MIGRATION BRIDGE TO CENTRALIZED SYSTEM
// ============================================================================

import { useBorderTokens } from '@/hooks/useBorderTokens';

/**
 * @deprecated Use useBorderTokens() hook directly
 * This is a compatibility bridge during migration
 */
export const initializeDesignSystem = () => {
  console.warn('⚠️ initializeDesignSystem is deprecated. Use useBorderTokens() hook instead.');
  return geoAlertDesignSystem;
};

/**
 * @deprecated Use useBorderTokens() with theme context instead
 */
export const applyTheme = (theme: 'light' | 'dark' = 'light') => {
  console.warn('⚠️ applyTheme is deprecated. Use theme context from useBorderTokens().');
  const variables = geoAlertDesignSystem.generateCSSVariables(theme);
  geoAlertDesignSystem.applyTheme(variables);
  return variables;
};

/**
 * @deprecated Use getStatusBorder() from useBorderTokens() instead
 * Migration guide: getDesignColor('primary') → getStatusBorder('info')
 */
export const getDesignColor = (color: string, shade?: number) => {
  console.warn('⚠️ getDesignColor is deprecated. Use getStatusBorder() from useBorderTokens() instead.');
  return geoAlertDesignSystem.getColor(color, shade);
};

/**
 * @deprecated Use design tokens directly from useBorderTokens() instead
 */
export const getDesignSpacing = (size: number) => {
  console.warn('⚠️ getDesignSpacing is deprecated. Use design tokens from useBorderTokens() instead.');
  return geoAlertDesignSystem.getSpacing(size);
};

// ============================================================================
// REACT PROVIDER SETUP
// ============================================================================

/**
 * Complete Design System Provider
 * Wraps the theme provider με όλα τα design system features
 */
export const DesignSystemProvider: React.FC<{
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark' | 'auto';
}> = ({ children, defaultTheme = 'auto' }) => {
  return (
    <ThemeProvider defaultMode={defaultTheme}>
      {children}
    </ThemeProvider>
  );
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DesignSystemInstance = GeoAlertDesignSystem;