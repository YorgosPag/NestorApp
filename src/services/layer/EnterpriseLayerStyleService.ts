/**
 * 🎨 ENTERPRISE LAYER STYLE SERVICE
 *
 * Database-driven layer styling system για multi-tenant deployments.
 * Replaces hardcoded DEFAULT_LAYER_STYLES με configurable, tenant-specific solutions.
 *
 * Split into 2 files for SRP compliance (ADR-065 Phase 4):
 * - layer-style-types.ts              — Types + fallback data (EXEMPT: types/config)
 * - EnterpriseLayerStyleService.ts     — Service class (this file)
 */

import { db } from '@/lib/firebase';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';

// Re-export all types for backward compatibility
export type {
  LayerElementType,
  LayerCategory,
  EnterpriseLayerStyle,
  LayerCategoryConfig,
  EnterpriseLayerStyleConfig,
  EnterpriseLayerCategoryConfig,
} from './layer-style-types';

import type {
  LayerElementType,
  LayerCategory,
  EnterpriseLayerStyle,
  LayerCategoryConfig,
  EnterpriseLayerStyleConfig,
  EnterpriseLayerCategoryConfig,
} from './layer-style-types';
import { getFallbackLayerStyles, getFallbackLayerCategories } from './layer-style-types';

const logger = createModuleLogger('EnterpriseLayerStyleService');

// ============================================================================
// ENTERPRISE LAYER STYLE SERVICE
// ============================================================================

class EnterpriseLayerStyleService {
  private readonly styleCache = new Map<string, Record<LayerElementType, EnterpriseLayerStyle>>();
  private readonly categoryCache = new Map<string, Record<LayerCategory, LayerCategoryConfig>>();
  private readonly cacheTTL = 10 * 60 * 1000; // 10 minutes
  private cacheTimestamps = new Map<string, number>();

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  /**
   * Check if cache is valid για specific key
   */
  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.cacheTTL;
  }

  /**
   * Set cache με timestamp
   */
  private setCache<T>(cacheMap: Map<string, T>, cacheKey: string, data: T): void {
    cacheMap.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  /**
   * Invalidate all caches
   */
  invalidateCache(): void {
    this.styleCache.clear();
    this.categoryCache.clear();
    this.cacheTimestamps.clear();
    logger.info('Layer style caches invalidated');
  }

  /**
   * Clear cache για specific tenant
   */
  clearCacheForTenant(tenantId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cacheTimestamps.keys()) {
      if (key.includes(tenantId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.styleCache.delete(key);
      this.categoryCache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    logger.info('Cleared layer style cache for tenant', { tenantId });
  }

  // ========================================================================
  // STYLE LOADING - CORE FUNCTIONALITY
  // ========================================================================

  /**
   * 🎨 Load all layer styles για specific theme/tenant
   */
  async loadLayerStyles(
    theme: string = 'default',
    tenantId?: string,
    environment?: string
  ): Promise<Record<LayerElementType, EnterpriseLayerStyle>> {
    const cacheKey = `styles_${theme}_${tenantId || 'default'}_${environment || 'production'}`;

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.styleCache.get(cacheKey);
      if (cached) {
        logger.debug('Layer styles loaded from cache', { cacheKey });
        return cached;
      }
    }

    try {
      logger.info('Loading layer styles from Firebase', { theme, tenantId, environment });

      // Build query constraints
      const constraints = [
        where('type', '==', 'layer-style'),
        where('theme', '==', theme),
        where('isEnabled', '==', true)
      ];

      if (tenantId) {
        constraints.push(where('tenantId', '==', tenantId));
      }

      if (environment) {
        constraints.push(where('environment', '==', environment));
      }

      // Query Firestore via centralized service
      const result = await firestoreQueryService.getAll<EnterpriseLayerStyleConfig>(
        'CONFIG', { constraints, tenantOverride: 'skip' }
      );

      const styles: Record<LayerElementType, EnterpriseLayerStyle> = {} as Record<LayerElementType, EnterpriseLayerStyle>;

      result.documents.forEach((config) => {
        if (config.layerElementType && config.style) {
          styles[config.layerElementType] = config.style;
        }
      });

      // Ensure all layer types have styles (use fallbacks if needed)
      const completeStyles = this.ensureCompleteStyles(styles, theme);

      // Cache the results
      this.setCache(this.styleCache, cacheKey, completeStyles);

      logger.info('Layer styles loaded successfully', {
        theme,
        tenantId,
        stylesCount: Object.keys(completeStyles).length
      });

      return completeStyles;

    } catch (error) {
      logger.error('Error loading layer styles', { error });

      // Return fallback styles
      logger.info('Using fallback layer styles', { theme });
      return this.getFallbackStyles(theme);
    }
  }

  /**
   * 🎯 Get style για specific layer element type
   */
  async getLayerStyle(
    layerElementType: LayerElementType,
    theme: string = 'default',
    tenantId?: string,
    environment?: string
  ): Promise<EnterpriseLayerStyle | null> {
    try {
      const styles = await this.loadLayerStyles(theme, tenantId, environment);
      return styles[layerElementType] || null;
    } catch (error) {
      logger.error('Error getting style', { layerElementType, error });
      return null;
    }
  }

  /**
   * 🏢 Load layer categories για specific theme/tenant
   */
  async loadLayerCategories(
    theme: string = 'default',
    tenantId?: string,
    environment?: string
  ): Promise<Record<LayerCategory, LayerCategoryConfig>> {
    const cacheKey = `categories_${theme}_${tenantId || 'default'}_${environment || 'production'}`;

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.categoryCache.get(cacheKey);
      if (cached) {
        logger.debug('Layer categories loaded from cache', { cacheKey });
        return cached;
      }
    }

    try {
      logger.info('Loading layer categories from Firebase', { theme, tenantId, environment });

      // Build query constraints
      const constraints = [
        where('type', '==', 'layer-category'),
        where('theme', '==', theme),
        where('isEnabled', '==', true)
      ];

      if (tenantId) {
        constraints.push(where('tenantId', '==', tenantId));
      }

      if (environment) {
        constraints.push(where('environment', '==', environment));
      }

      // Query Firestore via centralized service
      const result = await firestoreQueryService.getAll<EnterpriseLayerCategoryConfig>(
        'CONFIG', { constraints, tenantOverride: 'skip' }
      );

      const categories: Record<LayerCategory, LayerCategoryConfig> = {} as Record<LayerCategory, LayerCategoryConfig>;

      result.documents.forEach((config) => {
        if (config.category && config.config) {
          categories[config.category] = config.config;
        }
      });

      // Ensure all categories have configs (use fallbacks if needed)
      const completeCategories = this.ensureCompleteCategories(categories, theme);

      // Cache the results
      this.setCache(this.categoryCache, cacheKey, completeCategories);

      logger.info('Layer categories loaded successfully', {
        theme,
        tenantId,
        categoriesCount: Object.keys(completeCategories).length
      });

      return completeCategories;

    } catch (error) {
      logger.error('Error loading layer categories', { error });

      // Return fallback categories
      logger.info('Using fallback layer categories', { theme });
      return this.getFallbackCategories(theme);
    }
  }

  // ========================================================================
  // CONFIGURATION MANAGEMENT
  // ========================================================================

  /**
   * ➕ Add new layer style configuration
   */
  async addStyleConfig(config: Omit<EnterpriseLayerStyleConfig, 'id'>): Promise<string> {
    try {
      const id = `layer-style-${config.layerElementType}-${config.theme}-${Date.now()}`;
      const fullConfig = {
        ...config,
        id,
        type: 'layer-style',
        metadata: {
          ...config.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      await firestoreQueryService.create('CONFIG', fullConfig as Record<string, unknown>, {
        documentId: id,
        addTimestamps: false,
        addTenantContext: false
      });

      // Invalidate relevant caches
      this.clearCacheForTenant(config.tenantId || 'default');

      logger.info('Layer style configuration added', { id });
      return id;
    } catch (error) {
      logger.error('Error adding layer style configuration', { error });
      throw error;
    }
  }

  /**
   * 📝 Update existing layer style configuration
   */
  async updateStyleConfig(configId: string, updates: Partial<EnterpriseLayerStyleConfig>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        'metadata.updatedAt': new Date()
      };

      await firestoreQueryService.update('CONFIG', configId, updateData as Record<string, unknown>);

      // Invalidate all caches (we don't know which tenant this affects)
      this.invalidateCache();

      logger.info('Layer style configuration updated', { configId });
    } catch (error) {
      logger.error('Error updating layer style configuration', { error });
      throw error;
    }
  }

  /**
   * ➕ Add new layer category configuration
   */
  async addCategoryConfig(config: Omit<EnterpriseLayerCategoryConfig, 'id'>): Promise<string> {
    try {
      const id = `layer-category-${config.category}-${config.theme}-${Date.now()}`;
      const fullConfig = {
        ...config,
        id,
        type: 'layer-category',
        metadata: {
          ...config.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      await firestoreQueryService.create('CONFIG', fullConfig as Record<string, unknown>, {
        documentId: id,
        addTimestamps: false,
        addTenantContext: false
      });

      // Invalidate relevant caches
      this.clearCacheForTenant(config.tenantId || 'default');

      logger.info('Layer category configuration added', { id });
      return id;
    } catch (error) {
      logger.error('Error adding layer category configuration', { error });
      throw error;
    }
  }

  // ========================================================================
  // THEME MANAGEMENT
  // ========================================================================

  /**
   * 🎨 Get available themes για tenant
   */
  async getAvailableThemes(tenantId?: string): Promise<string[]> {
    try {
      const constraints = [where('type', '==', 'layer-style')];

      if (tenantId) {
        constraints.push(where('tenantId', '==', tenantId));
      }

      const result = await firestoreQueryService.getAll<EnterpriseLayerStyleConfig>(
        'CONFIG', { constraints, tenantOverride: 'skip' }
      );

      const themes = new Set<string>();
      result.documents.forEach((config) => {
        themes.add(config.theme);
      });

      const themesArray = Array.from(themes);

      // Always include default themes
      if (!themesArray.includes('default')) themesArray.unshift('default');
      if (!themesArray.includes('dark')) themesArray.push('dark');
      if (!themesArray.includes('high-contrast')) themesArray.push('high-contrast');

      return themesArray;
    } catch (error) {
      logger.error('Error getting available themes', { error });
      return ['default', 'dark', 'high-contrast'];
    }
  }

  // ========================================================================
  // FALLBACK & COMPLETION HELPERS
  // ========================================================================

  /**
   * 🛡️ Get fallback styles — delegates to extracted config module
   */
  getFallbackStyles(theme: string): Record<LayerElementType, EnterpriseLayerStyle> {
    return getFallbackLayerStyles(theme);
  }

  /**
   * 🛡️ Get fallback categories — delegates to extracted config module
   */
  getFallbackCategories(theme: string): Record<LayerCategory, LayerCategoryConfig> {
    return getFallbackLayerCategories(theme);
  }

  /**
   * 🔧 Ensure all layer types have styles
   */
  private ensureCompleteStyles(
    styles: Record<LayerElementType, EnterpriseLayerStyle>,
    theme: string
  ): Record<LayerElementType, EnterpriseLayerStyle> {
    const fallbackStyles = this.getFallbackStyles(theme);
    const completeStyles = { ...fallbackStyles };

    // Override με loaded styles
    Object.keys(styles).forEach(key => {
      if (styles[key as LayerElementType]) {
        completeStyles[key as LayerElementType] = styles[key as LayerElementType];
      }
    });

    return completeStyles;
  }

  /**
   * 🔧 Ensure all layer categories have configs
   */
  private ensureCompleteCategories(
    categories: Record<LayerCategory, LayerCategoryConfig>,
    theme: string
  ): Record<LayerCategory, LayerCategoryConfig> {
    const fallbackCategories = this.getFallbackCategories(theme);
    const completeCategories = { ...fallbackCategories };

    // Override με loaded categories
    Object.keys(categories).forEach(key => {
      if (categories[key as LayerCategory]) {
        completeCategories[key as LayerCategory] = categories[key as LayerCategory];
      }
    });

    return completeCategories;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * 🧪 Check if service is ready
   */
  isReady(): boolean {
    try {
      return !!db;
    } catch {
      return false;
    }
  }

  /**
   * 📊 Get cache statistics
   */
  getCacheStats() {
    return {
      styleCacheSize: this.styleCache.size,
      categoryCacheSize: this.categoryCache.size,
      totalCacheEntries: this.cacheTimestamps.size,
      cacheTTL: this.cacheTTL
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const layerStyleService = new EnterpriseLayerStyleService();
export default layerStyleService;
