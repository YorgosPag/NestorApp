/**
 * POLYGON STYLE CONFIG — Types + Theme Data
 *
 * Types, interfaces, and fallback theme configurations for polygon styling.
 * Extracted from EnterprisePolygonStyleService.ts for SRP compliance (ADR-065 Phase 4).
 *
 * @module services/polygon/polygon-style-config
 */

// Re-export types from core package (canonical path alias)
export type { PolygonType, PolygonStyle } from '@core/polygon-system/types';
import type { PolygonType, PolygonStyle } from '@core/polygon-system/types';

// ============================================================================
// ENTERPRISE STYLE TYPES
// ============================================================================

export interface EnterprisePolygonStyleConfig {
  id: string;
  polygonType: PolygonType;
  style: PolygonStyle;
  tenantId?: string;
  environment?: 'development' | 'staging' | 'production' | 'all';
  theme?: string; // 'default' | 'dark' | 'high-contrast' | 'brand-a' | 'brand-b'
  isEnabled: boolean;
  priority: number;
  metadata?: {
    displayName?: string;
    description?: string;
    category?: 'system' | 'brand' | 'accessibility' | 'custom';
    accessibility?: {
      wcagCompliant?: boolean;
      contrastRatio?: number;
      colorBlindSafe?: boolean;
    };
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
}

export interface StyleTheme {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isDefault: boolean;
  tenantId?: string;
  polygonStyles: Record<PolygonType, PolygonStyle>;
  metadata?: {
    category?: 'system' | 'brand' | 'accessibility';
    accessibility?: {
      wcagLevel?: 'A' | 'AA' | 'AAA';
      contrastRatio?: number;
      colorBlindFriendly?: boolean;
    };
    brandGuidelines?: {
      primaryColor?: string;
      secondaryColor?: string;
      accentColors?: string[];
    };
  };
}

// ============================================================================
// DEFAULT/FALLBACK CONFIGURATION
// ============================================================================

/**
 * 🎨 Fallback style configuration (WCAG AA compliant)
 */
const BASE_FALLBACK_POLYGON_STYLES: Record<Exclude<PolygonType, 'freehand' | 'point'>, PolygonStyle> = {
  simple: {
    strokeColor: '#1e40af',    // Enhanced blue (WCAG AA)
    fillColor: '#3b82f6',
    strokeWidth: 2,
    fillOpacity: 0.25,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#1d4ed8'
  },
  georeferencing: {
    strokeColor: '#d97706',    // Enhanced amber (WCAG AA)
    fillColor: '#f59e0b',
    strokeWidth: 2,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#b45309'
  },
  'alert-zone': {
    strokeColor: '#dc2626',    // Enhanced red (WCAG AA)
    fillColor: '#ef4444',
    strokeWidth: 3,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#b91c1c'
  },
  'real-estate': {
    strokeColor: '#0891b2',    // Enhanced cyan (WCAG AA)
    fillColor: '#06b6d4',
    strokeWidth: 2,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#0e7490'
  },
  measurement: {
    strokeColor: '#059669',    // Enhanced green (WCAG AA)
    fillColor: '#10b981',
    strokeWidth: 2,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#047857'
  },
  annotation: {
    strokeColor: '#7c3aed',    // Enhanced purple (WCAG AA)
    fillColor: '#8b5cf6',
    strokeWidth: 2,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#6d28d9'
  }
};

export const FALLBACK_POLYGON_STYLES: Record<PolygonType, PolygonStyle> = {
  ...BASE_FALLBACK_POLYGON_STYLES,
  freehand: BASE_FALLBACK_POLYGON_STYLES.simple,
  point: BASE_FALLBACK_POLYGON_STYLES.annotation
};

/**
 * 🌙 Dark theme polygon styles
 */
const BASE_DARK_THEME_STYLES: Record<Exclude<PolygonType, 'freehand' | 'point'>, PolygonStyle> = {
  simple: {
    strokeColor: '#60a5fa',
    fillColor: '#3b82f6',
    strokeWidth: 2,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#93c5fd'
  },
  georeferencing: {
    strokeColor: '#fbbf24',
    fillColor: '#f59e0b',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#fcd34d'
  },
  'alert-zone': {
    strokeColor: '#f87171',
    fillColor: '#ef4444',
    strokeWidth: 3,
    fillOpacity: 0.25,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#fca5a5'
  },
  'real-estate': {
    strokeColor: '#22d3ee',
    fillColor: '#06b6d4',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#67e8f9'
  },
  measurement: {
    strokeColor: '#34d399',
    fillColor: '#10b981',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#6ee7b7'
  },
  annotation: {
    strokeColor: '#a78bfa',
    fillColor: '#8b5cf6',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#c4b5fd'
  }
};

export const DARK_THEME_STYLES: Record<PolygonType, PolygonStyle> = {
  ...BASE_DARK_THEME_STYLES,
  freehand: BASE_DARK_THEME_STYLES.simple,
  point: BASE_DARK_THEME_STYLES.annotation
};

/**
 * ♿ High contrast theme (WCAG AAA compliant)
 */
const BASE_HIGH_CONTRAST_STYLES: Record<Exclude<PolygonType, 'freehand' | 'point'>, PolygonStyle> = {
  simple: {
    strokeColor: '#000000',
    fillColor: '#0066cc',
    strokeWidth: 3,
    fillOpacity: 0.4,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#000000'
  },
  georeferencing: {
    strokeColor: '#cc6600',
    fillColor: '#ff8800',
    strokeWidth: 3,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 8,
    pointColor: '#cc6600'
  },
  'alert-zone': {
    strokeColor: '#cc0000',
    fillColor: '#ff3333',
    strokeWidth: 4,
    fillOpacity: 0.4,
    strokeOpacity: 1,
    pointRadius: 7,
    pointColor: '#cc0000'
  },
  'real-estate': {
    strokeColor: '#006666',
    fillColor: '#00aaaa',
    strokeWidth: 3,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#006666'
  },
  measurement: {
    strokeColor: '#006600',
    fillColor: '#00aa00',
    strokeWidth: 3,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#006600'
  },
  annotation: {
    strokeColor: '#6600cc',
    fillColor: '#9933ff',
    strokeWidth: 3,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#6600cc'
  }
};

export const HIGH_CONTRAST_STYLES: Record<PolygonType, PolygonStyle> = {
  ...BASE_HIGH_CONTRAST_STYLES,
  freehand: BASE_HIGH_CONTRAST_STYLES.simple,
  point: BASE_HIGH_CONTRAST_STYLES.annotation
};

// ============================================================================
// THEME RESOLVER
// ============================================================================

/**
 * Get fallback styles based on theme name
 */
export function getFallbackPolygonStyles(theme: string): Record<PolygonType, PolygonStyle> {
  switch (theme) {
    case 'dark':
      return DARK_THEME_STYLES;
    case 'high-contrast':
      return HIGH_CONTRAST_STYLES;
    default:
      return FALLBACK_POLYGON_STYLES;
  }
}
