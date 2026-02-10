'use client';

// 🏢 ENTERPRISE ROUTE PRELOADING UTILITIES
// Database-driven route configuration με fallback support

import {
  PreloadableRoute,
  UserRole,
  routeConfigService,
  CRITICAL_ROUTES,
  ADMIN_ROUTES,
  IDLE_ROUTES
} from '@/services/routes/EnterpriseRouteConfigService';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('RoutePreload');

// Re-export types for backward compatibility
export type { PreloadableRoute, UserRole };

// 🏢 ENTERPRISE: Dynamic module import type
type DynamicModuleImport = Record<string, unknown>;

const routePreloaders: Record<PreloadableRoute, () => Promise<DynamicModuleImport>> = {
  'crm-dashboard': () => import('@/components/crm/dashboard/CRMDashboardPageContent'),
  'buildings': () => import('@/components/building-management/BuildingsPageContent'),
  'contacts': () => import('@/components/contacts/ContactsPageContent'),
  'properties': () => import('@/components/properties/PropertiesPageContent'),
  'dxf-viewer': () => import('@/subapps/dxf-viewer/DxfViewerApp'),
  'obligations-new': () => import('@/components/obligations/ObligationForm'),
  'obligations-edit': () => import('@/components/obligations/ObligationEditForm'),
};

// ============================================================================
// 🏢 ENTERPRISE: HREF TO PRELOADABLE ROUTE MAPPING
// ============================================================================
// Pattern: SAP Fiori, Salesforce Lightning - Centralized route mapping
// Single source of truth for href → PreloadableRoute conversion
// ============================================================================

/**
 * 🏢 ENTERPRISE: Mapping από navigation hrefs → PreloadableRoute types
 * Used by sidebar hover prefetching για type-safe route preloading
 */
const HREF_TO_PRELOADABLE_ROUTE: Record<string, PreloadableRoute> = {
  // Critical routes
  '/buildings': 'buildings',
  '/contacts': 'contacts',
  '/properties': 'properties',

  // CRM routes
  '/crm/dashboard': 'crm-dashboard',
  '/crm': 'crm-dashboard', // Parent route also preloads dashboard

  // Tools routes
  '/dxf/viewer': 'dxf-viewer',

  // Form routes
  '/obligations/new': 'obligations-new',
  '/obligations/edit': 'obligations-edit',
};

/**
 * 🏢 ENTERPRISE: Get PreloadableRoute from navigation href
 * Returns undefined if href doesn't have a preloadable route
 *
 * @param href - Navigation href (e.g., '/buildings', '/crm/dashboard')
 * @returns PreloadableRoute or undefined
 *
 * @example
 * const route = getPreloadableRouteFromHref('/buildings'); // 'buildings'
 * const route = getPreloadableRouteFromHref('/settings');  // undefined
 */
export function getPreloadableRouteFromHref(href: string): PreloadableRoute | undefined {
  return HREF_TO_PRELOADABLE_ROUTE[href];
}

/**
 * 🏢 ENTERPRISE: Check if href has a preloadable route
 *
 * @param href - Navigation href to check
 * @returns true if href has a preloadable route
 */
export function isPreloadableHref(href: string): boolean {
  return href in HREF_TO_PRELOADABLE_ROUTE;
}

// Preload a specific route
export async function preloadRoute(route: PreloadableRoute): Promise<void> {
  try {
    const preloader = routePreloaders[route];
    if (preloader) {
      await preloader();
      console.debug(`Preloaded route: ${route}`);
    }
  } catch (error) {
    logger.warn(`Failed to preload route ${route}`, { error });
  }
}

// Preload multiple routes
export async function preloadRoutes(routes: PreloadableRoute[]): Promise<void> {
  const preloadPromises = routes.map(route => preloadRoute(route));
  await Promise.allSettled(preloadPromises);
}

// 🏢 ENTERPRISE: Database-driven route preloading based on user context/role
export function preloadUserRoutes(userRole?: UserRole, tenantId?: string): void {
  // Use requestIdleCallback for non-blocking preloading
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(async () => {
      try {
        // Load routes από Firebase/Database based on user role
        const routes = await routeConfigService.getRoutesForRole(
          userRole || 'user',
          tenantId
        );

        await preloadRoutes(routes);

      } catch (error) {
        logger.warn('[RoutePreload] Database route loading failed, using fallback', { error });

        // Fallback to hardcoded routes if database fails
        const commonRoutes: PreloadableRoute[] = CRITICAL_ROUTES;

        if (userRole === 'admin') {
          await preloadRoutes([...commonRoutes, ...ADMIN_ROUTES]);
        } else if (userRole === 'agent') {
          await preloadRoutes([...commonRoutes, 'crm-dashboard']);
        } else {
          await preloadRoutes(commonRoutes);
        }
      }
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(async () => {
      try {
        const routes = await routeConfigService.getRoutesForRole(userRole || 'user', tenantId);
        await preloadRoutes(routes.slice(0, 2)); // Limit για fallback
      } catch (error) {
        // Ultimate fallback
        const basicRoutes: PreloadableRoute[] = CRITICAL_ROUTES.slice(0, 2);
        await preloadRoutes(basicRoutes);
      }
    }, 2000);
  }
}

// Preload on link hover (for navigation optimization)
export function preloadOnHover(route: PreloadableRoute) {
  return {
    onMouseEnter: () => preloadRoute(route),
    onFocus: () => preloadRoute(route),
  };
}

// Hook for component-based preloading
export function useRoutePreload() {
  return {
    preloadRoute,
    preloadRoutes,
    preloadUserRoutes,
    preloadOnHover,
  };
}

// ============================================================================
// 🏢 ENTERPRISE ROUTE CONFIGURATION
// ============================================================================

/**
 * ✅ These constants are now loaded from Firebase/Database!
 *
 * Configuration υπάρχει στο: COLLECTIONS.CONFIG
 * Management μέσω: EnterpriseRouteConfigService
 * Fallback: FALLBACK_ROUTE_CONFIG
 *
 * Features:
 * - Multi-tenant support
 * - Role-based access
 * - Environment-specific routes
 * - Performance optimization
 * - Real-time configuration updates
 */

// Re-exported from EnterpriseRouteConfigService (με fallback values)
export { CRITICAL_ROUTES, ADMIN_ROUTES, IDLE_ROUTES };

// ============================================================================
// 🔧 ENTERPRISE UTILITIES
// ============================================================================

/**
 * 🏢 Get route configuration από database
 */
export async function getEnterpriseRouteConfig(userRole?: UserRole, tenantId?: string) {
  return routeConfigService.getRoutesByCategory(userRole, tenantId);
}

/**
 * 📊 Get routes ordered by priority
 */
export async function getPrioritizedRoutes(userRole?: UserRole, tenantId?: string) {
  return routeConfigService.getRoutesByPriority(userRole, tenantId);
}

/**
 * ⚙️ Update route configuration (admin only)
 */
export async function updateRouteConfig(configId: string, updates: Record<string, unknown>) {
  return routeConfigService.updateRouteConfig(configId, updates);
}

/**
 * 🔄 Invalidate route configuration cache
 */
export function invalidateRouteCache() {
  routeConfigService.invalidateCache();
}