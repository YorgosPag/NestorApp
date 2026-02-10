/**
 * 🏢 ENTERPRISE ROUTE CONFIGURATION SERVICE
 *
 * Database-driven route configuration για multi-tenant deployments.
 * Αντικατέστησε τα hardcoded route arrays με configurable Firebase collections.
 *
 * Features:
 * - Multi-tenant route configuration
 * - Role-based route access
 * - Performance-optimized preloading
 * - Fallback configuration for offline mode
 * - Environment-specific route overrides
 */

import { collection, doc, getDocs, setDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EnterpriseRouteConfigService');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type PreloadableRoute =
  | 'crm-dashboard'
  | 'buildings'
  | 'contacts'
  | 'properties'
  | 'dxf-viewer'
  | 'obligations-new'
  | 'obligations-edit';

export type RouteCategory = 'critical' | 'admin' | 'idle' | 'user-specific';

export type UserRole = 'admin' | 'agent' | 'user' | 'viewer';

export interface RouteConfig {
  id: string;
  route: PreloadableRoute;
  category: RouteCategory;
  priority: number;
  requiredRoles: UserRole[];
  isEnabled: boolean;
  preloadOnIdle?: boolean;
  preloadOnHover?: boolean;
  environment?: 'development' | 'staging' | 'production' | 'all';
  tenantId?: string;
  order: number;
  metadata?: {
    description?: string;
    estimatedLoadTime?: number;
    bundleSize?: number;
    dependencies?: string[];
  };
}

export interface RouteConfigCollection {
  critical: PreloadableRoute[];
  admin: PreloadableRoute[];
  idle: PreloadableRoute[];
  userSpecific: Record<UserRole, PreloadableRoute[]>;
}

// ============================================================================
// DEFAULT/FALLBACK CONFIGURATION
// ============================================================================

/**
 * 🔄 Fallback configuration για offline mode ή όταν η Firebase δεν είναι διαθέσιμη
 */
const FALLBACK_ROUTE_CONFIG: RouteConfig[] = [
  {
    id: 'buildings-critical',
    route: 'buildings',
    category: 'critical',
    priority: 1,
    requiredRoles: ['admin', 'agent', 'user'],
    isEnabled: true,
    preloadOnIdle: false,
    preloadOnHover: true,
    environment: 'all',
    order: 1,
    metadata: {
      description: 'Building management interface',
      estimatedLoadTime: 800,
      bundleSize: 120000
    }
  },
  {
    id: 'contacts-critical',
    route: 'contacts',
    category: 'critical',
    priority: 2,
    requiredRoles: ['admin', 'agent', 'user'],
    isEnabled: true,
    preloadOnIdle: false,
    preloadOnHover: true,
    environment: 'all',
    order: 2,
    metadata: {
      description: 'Contact management interface',
      estimatedLoadTime: 600,
      bundleSize: 90000
    }
  },
  {
    id: 'dxf-viewer-admin',
    route: 'dxf-viewer',
    category: 'admin',
    priority: 1,
    requiredRoles: ['admin'],
    isEnabled: true,
    preloadOnIdle: true,
    preloadOnHover: false,
    environment: 'all',
    order: 3,
    metadata: {
      description: 'CAD/DXF file viewer',
      estimatedLoadTime: 2000,
      bundleSize: 450000
    }
  },
  {
    id: 'crm-dashboard-admin',
    route: 'crm-dashboard',
    category: 'admin',
    priority: 2,
    requiredRoles: ['admin', 'agent'],
    isEnabled: true,
    preloadOnIdle: true,
    preloadOnHover: true,
    environment: 'all',
    order: 4,
    metadata: {
      description: 'CRM analytics dashboard',
      estimatedLoadTime: 1200,
      bundleSize: 200000
    }
  },
  {
    id: 'properties-idle',
    route: 'properties',
    category: 'idle',
    priority: 1,
    requiredRoles: ['admin', 'agent', 'user'],
    isEnabled: true,
    preloadOnIdle: true,
    preloadOnHover: true,
    environment: 'all',
    order: 5,
    metadata: {
      description: 'Property listing and management',
      estimatedLoadTime: 900,
      bundleSize: 150000
    }
  }
];

// ============================================================================
// ENTERPRISE ROUTE CONFIG SERVICE CLASS
// ============================================================================

export class EnterpriseRouteConfigService {
  private static instance: EnterpriseRouteConfigService;
  private configCache: RouteConfig[] = [];
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly CONFIG_DOCUMENT_ID = 'route-preloading';

  constructor() {
    if (EnterpriseRouteConfigService.instance) {
      return EnterpriseRouteConfigService.instance;
    }
    EnterpriseRouteConfigService.instance = this;
  }

  // ========================================================================
  // CONFIGURATION LOADING
  // ========================================================================

  /**
   * 📥 Load route configuration από Firebase με caching
   */
  async loadRouteConfig(tenantId?: string): Promise<RouteConfig[]> {
    try {
      // Check cache first
      if (this.isCacheValid()) {
        logger.info('🚀 Using cached route configuration');
        return this.configCache;
      }

      logger.info('📥 Loading route configuration from Firebase...');

      const configQuery = query(
        collection(db, COLLECTIONS.CONFIG),
        orderBy('order', 'asc')
      );

      const snapshot = await getDocs(configQuery);

      if (snapshot.empty) {
        logger.warn('⚠️ No route configuration found in Firebase, using fallback');
        return this.initializeDefaultConfig(tenantId);
      }

      const routeConfigs: RouteConfig[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();

        // Filter by tenant if specified
        if (tenantId && data.tenantId && data.tenantId !== tenantId) {
          return;
        }

        // Filter by environment
        const currentEnv = process.env.NODE_ENV || 'development';
        if (data.environment && data.environment !== 'all' && data.environment !== currentEnv) {
          return;
        }

        routeConfigs.push({
          id: doc.id,
          ...data
        } as RouteConfig);
      });

      // Update cache
      this.configCache = routeConfigs;
      this.cacheTimestamp = Date.now();

      logger.info(`✅ Loaded ${routeConfigs.length} route configurations from Firebase`);
      return routeConfigs;

    } catch (error) {
      logger.error('❌ Error loading route configuration from Firebase:', error);
      return this.getFallbackConfig();
    }
  }

  /**
   * 🏗️ Initialize default configuration στη Firebase
   */
  async initializeDefaultConfig(tenantId?: string): Promise<RouteConfig[]> {
    try {
      logger.info('🏗️ Initializing default route configuration in Firebase...');

      const batch = [];
      for (const config of FALLBACK_ROUTE_CONFIG) {
        const configWithTenant = tenantId
          ? { ...config, tenantId }
          : config;

        const docRef = doc(db, COLLECTIONS.CONFIG, config.id);
        batch.push(setDoc(docRef, configWithTenant));
      }

      await Promise.all(batch);
      logger.info('✅ Default route configuration initialized in Firebase');

      return FALLBACK_ROUTE_CONFIG;
    } catch (error) {
      logger.error('❌ Error initializing default route configuration:', error);
      return this.getFallbackConfig();
    }
  }

  // ========================================================================
  // ROUTE CATEGORIZATION
  // ========================================================================

  /**
   * 📋 Get categorized routes για preload optimization
   */
  async getRoutesByCategory(userRole?: UserRole, tenantId?: string): Promise<RouteConfigCollection> {
    const routeConfigs = await this.loadRouteConfig(tenantId);

    const result: RouteConfigCollection = {
      critical: [],
      admin: [],
      idle: [],
      userSpecific: {
        admin: [],
        agent: [],
        user: [],
        viewer: []
      }
    };

    routeConfigs
      .filter(config => config.isEnabled)
      .filter(config => !userRole || config.requiredRoles.includes(userRole))
      .sort((a, b) => a.priority - b.priority)
      .forEach(config => {
        switch (config.category) {
          case 'critical':
            result.critical.push(config.route);
            break;
          case 'admin':
            result.admin.push(config.route);
            break;
          case 'idle':
            result.idle.push(config.route);
            break;
          case 'user-specific':
            config.requiredRoles.forEach(role => {
              if (!result.userSpecific[role].includes(config.route)) {
                result.userSpecific[role].push(config.route);
              }
            });
            break;
        }
      });

    return result;
  }

  /**
   * 🎯 Get routes για specific user role
   */
  async getRoutesForRole(userRole: UserRole, tenantId?: string): Promise<PreloadableRoute[]> {
    const categories = await this.getRoutesByCategory(userRole, tenantId);

    const routes = new Set<PreloadableRoute>();

    // Add critical routes for everyone
    categories.critical.forEach(route => routes.add(route));

    // Add role-specific routes
    if (userRole === 'admin') {
      categories.admin.forEach(route => routes.add(route));
    }

    // Add user-specific routes
    categories.userSpecific[userRole]?.forEach(route => routes.add(route));

    return Array.from(routes);
  }

  // ========================================================================
  // CONFIGURATION MANAGEMENT
  // ========================================================================

  /**
   * 📝 Update route configuration
   */
  async updateRouteConfig(configId: string, updates: Partial<RouteConfig>): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTIONS.CONFIG, configId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date()
      });

      // Invalidate cache
      this.invalidateCache();

      logger.info(`✅ Updated route configuration: ${configId}`);
      return true;
    } catch (error) {
      logger.error(`❌ Error updating route configuration ${configId}:`, error);
      return false;
    }
  }

  /**
   * 🆕 Add new route configuration
   */
  async addRouteConfig(config: Omit<RouteConfig, 'id'>): Promise<string | null> {
    try {
      const docRef = doc(collection(db, COLLECTIONS.CONFIG));
      const newConfig = {
        ...config,
        id: docRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(docRef, newConfig);

      // Invalidate cache
      this.invalidateCache();

      logger.info(`✅ Added new route configuration: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      logger.error('❌ Error adding new route configuration:', error);
      return null;
    }
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  /**
   * 🔄 Fallback configuration
   */
  getFallbackConfig(): RouteConfig[] {
    logger.info('📋 Using fallback route configuration');
    return FALLBACK_ROUTE_CONFIG;
  }

  /**
   * ⏰ Check if cache is valid
   */
  private isCacheValid(): boolean {
    return (
      this.configCache.length > 0 &&
      (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION
    );
  }

  /**
   * 🗑️ Invalidate cache
   */
  invalidateCache(): void {
    this.configCache = [];
    this.cacheTimestamp = 0;
  }

  /**
   * 🏷️ Get routes by priority for loading order
   */
  async getRoutesByPriority(userRole?: UserRole, tenantId?: string): Promise<PreloadableRoute[]> {
    const routeConfigs = await this.loadRouteConfig(tenantId);

    return routeConfigs
      .filter(config => config.isEnabled)
      .filter(config => !userRole || config.requiredRoles.includes(userRole))
      .sort((a, b) => a.priority - b.priority)
      .map(config => config.route);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const routeConfigService = new EnterpriseRouteConfigService();

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS (για smooth migration)
// ============================================================================

/**
 * ⚠️ LEGACY: These exports maintain backward compatibility
 * TODO: Remove after all imports are updated to use routeConfigService
 */

// Legacy export για immediate use (fallback values)
export const CRITICAL_ROUTES: PreloadableRoute[] = FALLBACK_ROUTE_CONFIG
  .filter(config => config.category === 'critical')
  .sort((a, b) => a.priority - b.priority)
  .map(config => config.route);

export const ADMIN_ROUTES: PreloadableRoute[] = FALLBACK_ROUTE_CONFIG
  .filter(config => config.category === 'admin')
  .sort((a, b) => a.priority - b.priority)
  .map(config => config.route);

export const IDLE_ROUTES: PreloadableRoute[] = FALLBACK_ROUTE_CONFIG
  .filter(config => config.category === 'idle')
  .sort((a, b) => a.priority - b.priority)
  .map(config => config.route);