/**
 * 🏢 ENTERPRISE POLYGON STYLE SERVICE
 *
 * Database-driven polygon styling configuration για multi-tenant deployments.
 * Αντικατέστησε τα hardcoded DEFAULT_POLYGON_STYLES με configurable Firebase collections.
 *
 * Features:
 * - Multi-tenant style configurations
 * - Brand-specific styling themes
 * - Environment-specific styles
 * - Real-time style updates
 * - Theme inheritance & overrides
 * - Accessibility compliance (WCAG colors)
 * - Performance-optimized caching
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

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

const FALLBACK_POLYGON_STYLES: Record<PolygonType, PolygonStyle> = {
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

const DARK_THEME_STYLES: Record<PolygonType, PolygonStyle> = {
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

const HIGH_CONTRAST_STYLES: Record<PolygonType, PolygonStyle> = {
  ...BASE_HIGH_CONTRAST_STYLES,
  freehand: BASE_HIGH_CONTRAST_STYLES.simple,
  point: BASE_HIGH_CONTRAST_STYLES.annotation
};

// ============================================================================
// ENTERPRISE POLYGON STYLE SERVICE CLASS
// ============================================================================

export class EnterprisePolygonStyleService {
  private static instance: EnterprisePolygonStyleService;
  private styleCache: Map<string, Record<PolygonType, PolygonStyle>> = new Map();
  private configCache: Map<string, EnterprisePolygonStyleConfig[]> = new Map();
  private cacheTimestamp: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (styles cache longer)

  constructor() {
    if (EnterprisePolygonStyleService.instance) {
      return EnterprisePolygonStyleService.instance;
    }
    EnterprisePolygonStyleService.instance = this;
  }

  // ========================================================================
  // STYLE LOADING & MANAGEMENT
  // ========================================================================

  /**
   * 🎨 Load polygon styles για specific theme and tenant
   */
  async loadPolygonStyles(
    theme: string = 'default',
    tenantId?: string,
    environment?: string
  ): Promise<Record<PolygonType, PolygonStyle>> {
    try {
      const cacheKey = `${theme}-${tenantId || 'default'}-${environment || 'default'}`;

      // Check cache first
      if (this.isCacheValid(cacheKey)) {
        console.debug('🚀 Using cached polygon styles:', cacheKey);
        return this.styleCache.get(cacheKey)!;
      }

      console.log('🎨 Loading polygon styles from Firebase...', { theme, tenantId, environment });

      // Load style configurations from Firebase
      const configs = await this.loadStyleConfigurations(tenantId, environment);

      if (configs.length === 0) {
        console.warn('⚠️ No style configurations found, initializing defaults');
        await this.initializeDefaultStyles(tenantId, environment);
        return this.getFallbackStyles(theme);
      }

      // Build styles από configurations
      const styles = this.buildStylesFromConfigs(configs, theme);

      // Cache the results
      this.styleCache.set(cacheKey, styles);
      this.cacheTimestamp.set(cacheKey, Date.now());

      console.log(`✅ Loaded polygon styles for theme: ${theme}`);
      return styles;

    } catch (error) {
      console.error('❌ Error loading polygon styles:', error);
      return this.getFallbackStyles(theme);
    }
  }

  /**
   * 📥 Load style configurations από Firebase
   */
  private async loadStyleConfigurations(
    tenantId?: string,
    environment?: string
  ): Promise<EnterprisePolygonStyleConfig[]> {
    const cacheKey = `configs-${tenantId || 'default'}-${environment || 'default'}`;

    if (this.configCache.has(cacheKey) && this.isCacheValid(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    const constraints: QueryConstraint[] = [orderBy('priority', 'asc')];

    // Add tenant filter
    if (tenantId) {
      constraints.push(where('tenantId', '==', tenantId));
    }

    // Add environment filter
    const currentEnv = environment || process.env.NODE_ENV || 'development';
    constraints.push(where('environment', 'in', ['all', currentEnv]));

    const configQuery = query(
      collection(db, COLLECTIONS.CONFIG),
      ...constraints
    );

    const snapshot = await getDocs(configQuery);
    const configs: EnterprisePolygonStyleConfig[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.polygonType && data.style && data.isEnabled) {
        configs.push({
          id: doc.id,
          ...data
        } as EnterprisePolygonStyleConfig);
      }
    });

    // Cache configurations
    this.configCache.set(cacheKey, configs);
    this.cacheTimestamp.set(cacheKey, Date.now());

    return configs;
  }

  /**
   * 🏗️ Build styles από configurations
   */
  private buildStylesFromConfigs(
    configs: EnterprisePolygonStyleConfig[],
    theme: string
  ): Record<PolygonType, PolygonStyle> {
    const styles: Partial<Record<PolygonType, PolygonStyle>> = {};

    // Start με fallback styles
    const fallbackStyles = this.getFallbackStyles(theme);
    Object.assign(styles, fallbackStyles);

    // Override με database configurations (by priority)
    configs
      .filter(config => !config.theme || config.theme === theme)
      .sort((a, b) => a.priority - b.priority)
      .forEach(config => {
        styles[config.polygonType] = {
          ...styles[config.polygonType],
          ...config.style
        };
      });

    return styles as Record<PolygonType, PolygonStyle>;
  }

  // ========================================================================
  // STYLE UTILITIES
  // ========================================================================

  /**
   * 🎨 Get style για specific polygon type
   */
  async getPolygonStyle(
    polygonType: PolygonType,
    theme: string = 'default',
    tenantId?: string
  ): Promise<PolygonStyle> {
    const styles = await this.loadPolygonStyles(theme, tenantId);
    return styles[polygonType] || FALLBACK_POLYGON_STYLES[polygonType];
  }

  /**
   * 🔄 Get fallback styles based on theme
   */
  getFallbackStyles(theme: string): Record<PolygonType, PolygonStyle> {
    switch (theme) {
      case 'dark':
        return DARK_THEME_STYLES;
      case 'high-contrast':
        return HIGH_CONTRAST_STYLES;
      default:
        return FALLBACK_POLYGON_STYLES;
    }
  }

  /**
   * 🌈 Get available themes
   */
  async getAvailableThemes(tenantId?: string): Promise<string[]> {
    try {
      const configs = await this.loadStyleConfigurations(tenantId);
      const themes = new Set<string>();

      // Add system themes
      themes.add('default');
      themes.add('dark');
      themes.add('high-contrast');

      // Add custom themes από database
      configs.forEach(config => {
        if (config.theme) {
          themes.add(config.theme);
        }
      });

      return Array.from(themes).sort();
    } catch (error) {
      console.error('❌ Error loading available themes:', error);
      return ['default', 'dark', 'high-contrast'];
    }
  }

  // ========================================================================
  // CONFIGURATION MANAGEMENT
  // ========================================================================

  /**
   * 📝 Update polygon style configuration
   */
  async updateStyleConfig(
    configId: string,
    updates: Partial<EnterprisePolygonStyleConfig>
  ): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTIONS.CONFIG, configId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date()
      });

      // Invalidate cache
      this.invalidateCache();

      console.log(`✅ Updated polygon style config: ${configId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating style config ${configId}:`, error);
      return false;
    }
  }

  /**
   * 🆕 Add new style configuration
   */
  async addStyleConfig(
    config: Omit<EnterprisePolygonStyleConfig, 'id'>
  ): Promise<string | null> {
    try {
      const docRef = doc(collection(db, COLLECTIONS.CONFIG));
      const newConfig = {
        ...config,
        id: docRef.id,
        metadata: {
          ...config.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      await setDoc(docRef, newConfig);

      // Invalidate cache
      this.invalidateCache();

      console.log(`✅ Added new polygon style config: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding style config:', error);
      return null;
    }
  }

  /**
   * 🏗️ Initialize default style configurations στη Firebase
   */
  async initializeDefaultStyles(tenantId?: string, environment?: string): Promise<void> {
    try {
      console.log('🏗️ Initializing default polygon styles in Firebase...');

      const configs: Omit<EnterprisePolygonStyleConfig, 'id'>[] = [];

      // Create configurations για κάθε polygon type
      Object.entries(FALLBACK_POLYGON_STYLES).forEach(([type, style], index) => {
        // Default theme config
        configs.push({
          polygonType: type as PolygonType,
          style,
          tenantId,
          environment: (environment || 'all') as EnterprisePolygonStyleConfig['environment'],
          theme: 'default',
          isEnabled: true,
          priority: index + 1,
          metadata: {
            displayName: `${type} - Default Theme`,
            description: `Default styling για ${type} polygons`,
            category: 'system',
            accessibility: {
              wcagCompliant: true,
              contrastRatio: 4.5,
              colorBlindSafe: true
            },
            createdBy: 'system'
          }
        });

        // Dark theme config
        configs.push({
          polygonType: type as PolygonType,
          style: DARK_THEME_STYLES[type as PolygonType],
          tenantId,
          environment: (environment || 'all') as EnterprisePolygonStyleConfig['environment'],
          theme: 'dark',
          isEnabled: true,
          priority: index + 1,
          metadata: {
            displayName: `${type} - Dark Theme`,
            description: `Dark theme styling για ${type} polygons`,
            category: 'system',
            accessibility: {
              wcagCompliant: true,
              contrastRatio: 3.0,
              colorBlindSafe: true
            },
            createdBy: 'system'
          }
        });

        // High contrast theme config
        configs.push({
          polygonType: type as PolygonType,
          style: HIGH_CONTRAST_STYLES[type as PolygonType],
          tenantId,
          environment: (environment || 'all') as EnterprisePolygonStyleConfig['environment'],
          theme: 'high-contrast',
          isEnabled: true,
          priority: index + 1,
          metadata: {
            displayName: `${type} - High Contrast`,
            description: `High contrast styling για ${type} polygons (WCAG AAA)`,
            category: 'accessibility',
            accessibility: {
              wcagCompliant: true,
              contrastRatio: 7.0,
              colorBlindSafe: true
            },
            createdBy: 'system'
          }
        });
      });

      // Save configurations
      const promises = configs.map(config => this.addStyleConfig(config));
      await Promise.all(promises);

      console.log('✅ Default polygon styles initialized in Firebase');
    } catch (error) {
      console.error('❌ Error initializing default styles:', error);
    }
  }

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  /**
   * ⏰ Check if cache is valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamp.get(cacheKey);
    if (!timestamp) return false;

    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  /**
   * 🗑️ Invalidate all caches
   */
  invalidateCache(): void {
    this.styleCache.clear();
    this.configCache.clear();
    this.cacheTimestamp.clear();
    console.log('🗑️ Polygon style cache invalidated');
  }

  /**
   * 🧹 Clear specific cache
   */
  clearCacheForTenant(tenantId: string): void {
    const keysToDelete: string[] = [];

    this.styleCache.forEach((_, key) => {
      if (key.includes(tenantId)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.styleCache.delete(key);
      this.configCache.delete(key);
      this.cacheTimestamp.delete(key);
    });

    console.log(`🧹 Cleared polygon style cache for tenant: ${tenantId}`);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const polygonStyleService = new EnterprisePolygonStyleService();

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * ⚠️ LEGACY: Maintain backward compatibility
 * TODO: Remove after all imports are updated to use polygonStyleService
 */

// Legacy export with fallback values
export const DEFAULT_POLYGON_STYLES = FALLBACK_POLYGON_STYLES;

/**
 * 🎨 Enterprise style loader function (async)
 */
export async function getPolygonStyles(
  theme: string = 'default',
  tenantId?: string
): Promise<Record<PolygonType, PolygonStyle>> {
  return polygonStyleService.loadPolygonStyles(theme, tenantId);
}

/**
 * 🔍 Get single polygon style
 */
export async function getPolygonStyle(
  polygonType: PolygonType,
  theme: string = 'default',
  tenantId?: string
): Promise<PolygonStyle> {
  return polygonStyleService.getPolygonStyle(polygonType, theme, tenantId);
}
