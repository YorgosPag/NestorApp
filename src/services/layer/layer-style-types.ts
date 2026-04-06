/**
 * LAYER STYLE TYPES — Types + Fallback Theme Data
 *
 * Type definitions and fallback style/category configurations for the
 * Enterprise Layer Style Service.
 * Extracted from EnterpriseLayerStyleService.ts for SRP compliance (ADR-065 Phase 4).
 *
 * @module services/layer/layer-style-types
 */

import { designTokens } from '@/styles/design-tokens';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Layer element types που υποστηρίζουμε
 */
export type LayerElementType = 'property' | 'annotation' | 'measurement' | 'line' | 'circle' | 'rectangle';

/**
 * Layer categories που υποστηρίζουμε
 */
export type LayerCategory = 'structural' | 'electrical' | 'plumbing' | 'hvac' | 'furniture' | 'annotations' | 'measurements';

/**
 * Enterprise layer style interface
 */
export interface EnterpriseLayerStyle {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  dashArray?: string;
}

/**
 * Layer category configuration
 */
export interface LayerCategoryConfig {
  name: string;
  icon: string;
  color: string;
  description?: string;
  isEnabled?: boolean;
}

/**
 * Complete layer style configuration για Firebase
 */
export interface EnterpriseLayerStyleConfig {
  id: string;
  layerElementType: LayerElementType;
  style: EnterpriseLayerStyle;
  theme: string;
  tenantId?: string;
  environment?: string;
  isEnabled: boolean;
  priority: number;
  metadata?: {
    displayName?: string;
    description?: string;
    category?: string;
    version?: string;
    accessibility?: {
      wcagCompliant: boolean;
      contrastRatio?: number;
      colorBlindSafe?: boolean;
    };
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
}

/**
 * Layer category configuration για Firebase
 */
export interface EnterpriseLayerCategoryConfig {
  id: string;
  category: LayerCategory;
  config: LayerCategoryConfig;
  theme: string;
  tenantId?: string;
  environment?: string;
  isEnabled: boolean;
  priority: number;
  metadata?: {
    displayName?: string;
    description?: string;
    version?: string;
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };
}

// ============================================================================
// DARK THEME COLOR ADJUSTMENT
// ============================================================================

/**
 * 🎨 Adjust color για dark theme
 */
export function adjustColorForDarkTheme(color: string): string {
  const colorMap: Record<string, string> = {
    [designTokens.colors.blue['500']]: designTokens.colors.blue['400'],
    [designTokens.colors.green['500']]: designTokens.colors.green['400'],
    [designTokens.colors.yellow['500']]: designTokens.colors.yellow['400'],
    [designTokens.colors.gray['500']]: designTokens.colors.text.muted,
    [designTokens.colors.purple['500']]: designTokens.colors.purple['400'],
    [designTokens.colors.red['500']]: designTokens.colors.red['300'],
    [designTokens.colors.text.secondary]: designTokens.colors.text.muted,
    [designTokens.colors.orange['500']]: designTokens.colors.orange['300']
  };

  return colorMap[color] || color;
}

// ============================================================================
// FALLBACK STYLES
// ============================================================================

/**
 * 🛡️ Get fallback styles για specific theme
 */
export function getFallbackLayerStyles(theme: string): Record<LayerElementType, EnterpriseLayerStyle> {
  const baseStyles: Record<LayerElementType, EnterpriseLayerStyle> = {
    property: {
      strokeColor: designTokens.colors.blue['500'],
      fillColor: designTokens.colors.blue['500'],
      strokeWidth: 2,
      opacity: 0.3
    },
    annotation: {
      strokeColor: designTokens.colors.green['500'],
      fillColor: designTokens.colors.green['500'],
      strokeWidth: 1,
      opacity: 1
    },
    measurement: {
      strokeColor: designTokens.colors.yellow['500'],
      fillColor: designTokens.colors.yellow['500'],
      strokeWidth: 2,
      opacity: 1,
      dashArray: '5,5'
    },
    line: {
      strokeColor: designTokens.colors.gray['500'],
      fillColor: designTokens.colors.background.transparent,
      strokeWidth: 2,
      opacity: 1
    },
    circle: {
      strokeColor: designTokens.colors.purple['500'],
      fillColor: designTokens.colors.purple['500'],
      strokeWidth: 2,
      opacity: 0.2
    },
    rectangle: {
      strokeColor: designTokens.colors.red['500'],
      fillColor: designTokens.colors.red['500'],
      strokeWidth: 2,
      opacity: 0.2
    }
  };

  // Theme-specific adjustments
  if (theme === 'dark') {
    Object.keys(baseStyles).forEach(key => {
      const style = baseStyles[key as LayerElementType];
      style.strokeColor = adjustColorForDarkTheme(style.strokeColor);
      if (style.fillColor !== designTokens.colors.background.transparent) {
        style.fillColor = adjustColorForDarkTheme(style.fillColor);
      }
    });
  } else if (theme === 'high-contrast') {
    baseStyles.property.strokeColor = designTokens.colors.text.inverse;
    baseStyles.property.fillColor = designTokens.colors.text.primary;
    baseStyles.annotation.strokeColor = designTokens.colors.yellow['500'];
    baseStyles.annotation.fillColor = designTokens.colors.yellow['500'];
    baseStyles.measurement.strokeColor = designTokens.colors.red['500'];
    baseStyles.measurement.fillColor = designTokens.colors.red['500'];
    baseStyles.line.strokeColor = designTokens.colors.text.inverse;
    baseStyles.circle.strokeColor = designTokens.colors.green['500'];
    baseStyles.circle.fillColor = designTokens.colors.green['500'];
    baseStyles.rectangle.strokeColor = designTokens.colors.blue['500'];
    baseStyles.rectangle.fillColor = designTokens.colors.blue['500'];
  }

  return baseStyles;
}

// ============================================================================
// FALLBACK CATEGORIES
// ============================================================================

/**
 * 🛡️ Get fallback categories για specific theme
 */
export function getFallbackLayerCategories(theme: string): Record<LayerCategory, LayerCategoryConfig> {
  const baseCategories: Record<LayerCategory, LayerCategoryConfig> = {
    structural: {
      name: 'Δομικά Στοιχεία',
      icon: 'Building',
      color: designTokens.colors.text.secondary
    },
    electrical: {
      name: 'Ηλεκτρολογικά',
      icon: 'Zap',
      color: designTokens.colors.yellow['500']
    },
    plumbing: {
      name: 'Υδραυλικά',
      icon: 'Droplets',
      color: designTokens.colors.blue['500']
    },
    hvac: {
      name: 'Κλιματισμός',
      icon: 'Wind',
      color: designTokens.colors.green['500']
    },
    furniture: {
      name: 'Έπιπλα',
      icon: 'Armchair',
      color: designTokens.colors.purple['500']
    },
    annotations: {
      name: 'Σημειώσεις',
      icon: 'MessageSquare',
      color: designTokens.colors.orange['500']
    },
    measurements: {
      name: 'Μετρήσεις',
      icon: 'Ruler',
      color: designTokens.colors.red['500']
    }
  };

  // Theme-specific adjustments
  if (theme === 'dark') {
    Object.keys(baseCategories).forEach(key => {
      const category = baseCategories[key as LayerCategory];
      category.color = adjustColorForDarkTheme(category.color);
    });
  }

  return baseCategories;
}
