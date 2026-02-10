/**
 * 🎨 ENTERPRISE LAYER STYLE SERVICE
 *
 * Database-driven layer styling system για multi-tenant deployments.
 * Replaces hardcoded DEFAULT_LAYER_STYLES με configurable, tenant-specific solutions.
 *
 * Features:
 * - Database-driven layer styles (Firestore)
 * - Multi-tenant styling support
 * - Theme system (default, dark, high-contrast)
 * - Environment-specific configurations
 * - Performance-optimized caching
 * - WCAG accessibility compliance
 * - Real-time style updates
 * - Fallback style support
 *
 * @version 1.0.0
 * @enterprise-ready true
 */

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { designTokens } from '@/styles/design-tokens';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('EnterpriseLayerStyleService');

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
// ENTERPRISE LAYER STYLE SERVICE
// ============================================================================

class EnterpriseLayerStyleService {
  private readonly CONFIG_COLLECTION = COLLECTIONS.CONFIG;
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

    // Find all cache keys που περιέχουν το tenantId
    for (const key of this.cacheTimestamps.keys()) {
      if (key.includes(tenantId)) {
        keysToDelete.push(key);
      }
    }

    // Delete matching entries
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

      // Query Firestore
      const q = query(collection(db, this.CONFIG_COLLECTION), ...constraints);
      const querySnapshot = await getDocs(q);

      const styles: Record<LayerElementType, EnterpriseLayerStyle> = {} as Record<LayerElementType, EnterpriseLayerStyle>;

      querySnapshot.forEach((doc) => {
        const config = doc.data() as EnterpriseLayerStyleConfig;
        if (config.layerElementType && config.style) {
          styles[config.layerElementType] = config.style;
        }
      });

      // Ensure all layer types have styles (use fallbacks if needed)
      const completeStyles = await this.ensureCompleteStyles(styles, theme);

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

      // Query Firestore
      const q = query(collection(db, this.CONFIG_COLLECTION), ...constraints);
      const querySnapshot = await getDocs(q);

      const categories: Record<LayerCategory, LayerCategoryConfig> = {} as Record<LayerCategory, LayerCategoryConfig>;

      querySnapshot.forEach((doc) => {
        const config = doc.data() as EnterpriseLayerCategoryConfig;
        if (config.category && config.config) {
          categories[config.category] = config.config;
        }
      });

      // Ensure all categories have configs (use fallbacks if needed)
      const completeCategories = await this.ensureCompleteCategories(categories, theme);

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
      const fullConfig: EnterpriseLayerStyleConfig = {
        ...config,
        id,
        type: 'layer-style',
        metadata: {
          ...config.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } as EnterpriseLayerStyleConfig & { type: string };

      await setDoc(doc(db, this.CONFIG_COLLECTION, id), fullConfig);

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

      await updateDoc(doc(db, this.CONFIG_COLLECTION, configId), updateData);

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
      const fullConfig: EnterpriseLayerCategoryConfig = {
        ...config,
        id,
        type: 'layer-category',
        metadata: {
          ...config.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } as EnterpriseLayerCategoryConfig & { type: string };

      await setDoc(doc(db, this.CONFIG_COLLECTION, id), fullConfig);

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

      const q = query(collection(db, this.CONFIG_COLLECTION), ...constraints);
      const querySnapshot = await getDocs(q);

      const themes = new Set<string>();
      querySnapshot.forEach((doc) => {
        const config = doc.data() as EnterpriseLayerStyleConfig;
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
  // FALLBACK SYSTEMS
  // ========================================================================

  /**
   * 🛡️ Get fallback styles για specific theme
   */
  getFallbackStyles(theme: string): Record<LayerElementType, EnterpriseLayerStyle> {
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
      // Adjust colors για dark theme
      Object.keys(baseStyles).forEach(key => {
        const style = baseStyles[key as LayerElementType];
        style.strokeColor = this.adjustColorForDarkTheme(style.strokeColor);
        if (style.fillColor !== designTokens.colors.background.transparent) {
          style.fillColor = this.adjustColorForDarkTheme(style.fillColor);
        }
      });
    } else if (theme === 'high-contrast') {
      // High contrast colors για accessibility
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

  /**
   * 🛡️ Get fallback categories για specific theme
   */
  getFallbackCategories(theme: string): Record<LayerCategory, LayerCategoryConfig> {
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
        category.color = this.adjustColorForDarkTheme(category.color);
      });
    }

    return baseCategories;
  }

  /**
   * 🎨 Adjust color για dark theme
   */
  private adjustColorForDarkTheme(color: string): string {
    // Simple color adjustment για dark theme (could be more sophisticated)
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

  /**
   * 🔧 Ensure all layer types have styles
   */
  private async ensureCompleteStyles(
    styles: Record<LayerElementType, EnterpriseLayerStyle>,
    theme: string
  ): Promise<Record<LayerElementType, EnterpriseLayerStyle>> {
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
  private async ensureCompleteCategories(
    categories: Record<LayerCategory, LayerCategoryConfig>,
    theme: string
  ): Promise<Record<LayerCategory, LayerCategoryConfig>> {
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

