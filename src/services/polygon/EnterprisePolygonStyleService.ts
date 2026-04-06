/**
 * 🏢 ENTERPRISE POLYGON STYLE SERVICE
 *
 * Database-driven polygon styling configuration για multi-tenant deployments.
 * Αντικατέστησε τα hardcoded DEFAULT_POLYGON_STYLES με configurable Firebase collections.
 *
 * Split into 2 files for SRP compliance (ADR-065 Phase 4):
 * - polygon-style-config.ts              — Types + theme data (EXEMPT: config/data)
 * - EnterprisePolygonStyleService.ts      — Service class (this file)
 */

import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

// Re-export everything from config for backward compatibility
export type { PolygonType, PolygonStyle } from './polygon-style-config';
export type { EnterprisePolygonStyleConfig, StyleTheme } from './polygon-style-config';
export { FALLBACK_POLYGON_STYLES, DARK_THEME_STYLES, HIGH_CONTRAST_STYLES } from './polygon-style-config';

import type { PolygonType, PolygonStyle } from './polygon-style-config';
import type { EnterprisePolygonStyleConfig } from './polygon-style-config';
import {
  FALLBACK_POLYGON_STYLES,
  DARK_THEME_STYLES,
  HIGH_CONTRAST_STYLES,
  getFallbackPolygonStyles,
} from './polygon-style-config';

const logger = createModuleLogger('EnterprisePolygonStyleService');

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
        logger.debug('Using cached polygon styles', { cacheKey });
        return this.styleCache.get(cacheKey)!;
      }

      logger.info('Loading polygon styles from Firebase', { theme, tenantId, environment });

      // Load style configurations from Firebase
      const configs = await this.loadStyleConfigurations(tenantId, environment);

      if (configs.length === 0) {
        logger.warn('No style configurations found, initializing defaults');
        await this.initializeDefaultStyles(tenantId, environment);
        return this.getFallbackStyles(theme);
      }

      // Build styles από configurations
      const styles = this.buildStylesFromConfigs(configs, theme);

      // Cache the results
      this.styleCache.set(cacheKey, styles);
      this.cacheTimestamp.set(cacheKey, Date.now());

      logger.info('Loaded polygon styles for theme', { theme });
      return styles;

    } catch (error) {
      logger.error('Error loading polygon styles', { error });
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

    const result = await firestoreQueryService.getAll<EnterprisePolygonStyleConfig>(
      'CONFIG', { constraints, tenantOverride: 'skip' }
    );

    const configs: EnterprisePolygonStyleConfig[] = result.documents.filter(
      data => data.polygonType && data.style && data.isEnabled
    );

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
    return getFallbackPolygonStyles(theme);
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
      logger.error('Error loading available themes', { error });
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
      await firestoreQueryService.update('CONFIG', configId, {
        ...updates,
        updatedAt: new Date()
      } as Record<string, unknown>);

      // Invalidate cache
      this.invalidateCache();

      logger.info('Updated polygon style config', { configId });
      return true;
    } catch (error) {
      logger.error('Error updating style config', { configId, error });
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
      const docId = `polygon-style-${config.polygonType}-${config.theme || 'default'}-${Date.now()}`;
      const newConfig = {
        ...config,
        id: docId,
        metadata: {
          ...config.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      await firestoreQueryService.create('CONFIG', newConfig as Record<string, unknown>, {
        documentId: docId,
        addTimestamps: false,
        addTenantContext: false
      });

      // Invalidate cache
      this.invalidateCache();

      logger.info('Added new polygon style config', { configId: docId });
      return docId;
    } catch (error) {
      logger.error('Error adding style config', { error });
      return null;
    }
  }

  /**
   * 🏗️ Initialize default style configurations στη Firebase
   */
  async initializeDefaultStyles(tenantId?: string, environment?: string): Promise<void> {
    try {
      logger.info('Initializing default polygon styles in Firebase');

      const configs: Omit<EnterprisePolygonStyleConfig, 'id'>[] = [];
      const themeMap = {
        default: FALLBACK_POLYGON_STYLES,
        dark: DARK_THEME_STYLES,
        'high-contrast': HIGH_CONTRAST_STYLES,
      };

      // Create configurations για κάθε polygon type × theme
      Object.entries(FALLBACK_POLYGON_STYLES).forEach(([type, style], index) => {
        const polygonType = type as PolygonType;

        Object.entries(themeMap).forEach(([themeName, themeStyles]) => {
          const category = themeName === 'high-contrast' ? 'accessibility' : 'system';
          const wcagRatio = themeName === 'high-contrast' ? 7.0 : themeName === 'dark' ? 3.0 : 4.5;

          configs.push({
            polygonType,
            style: themeStyles[polygonType] ?? style,
            tenantId,
            environment: (environment || 'all') as EnterprisePolygonStyleConfig['environment'],
            theme: themeName,
            isEnabled: true,
            priority: index + 1,
            metadata: {
              displayName: `${type} - ${themeName.charAt(0).toUpperCase() + themeName.slice(1)} Theme`,
              description: `${themeName} theme styling για ${type} polygons`,
              category,
              accessibility: {
                wcagCompliant: true,
                contrastRatio: wcagRatio,
                colorBlindSafe: true
              },
              createdBy: SYSTEM_IDENTITY.ID
            }
          });
        });
      });

      // Save configurations
      const promises = configs.map(config => this.addStyleConfig(config));
      await Promise.all(promises);

      logger.info('Default polygon styles initialized in Firebase');
    } catch (error) {
      logger.error('Error initializing default styles', { error });
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
    logger.info('Polygon style cache invalidated');
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

    logger.info('Cleared polygon style cache for tenant', { tenantId });
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
