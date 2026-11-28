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

/**
 * 🔑 ADR-280 §11.8 Β4.3 — **ΤΑΥΤΟΤΗΤΑ, ΟΧΙ ΔΕΥΤΕΡΟ ΑΝΤΙΓΡΑΦΟ ΤΟΥ SPECIFIER.** Κάθε γραμμή καλεί το `preload()` της
 * εγγραφής του **μητρώου του τομέα** της: ο ΙΔΙΟΣ φορτωτής με το mount (κώδικας + κείμενα), όπως το React Router
 * `route.lazy` / Remix `prefetch="intent"` / Closure `prefetchModule`. Ποτέ `import()` του στόχου εδώ (κανόνας Ρ).
 *
 * 🔴 **ADR-954 — ΜΟΝΟ ΣΤΗΝ ΠΑΡΑΓΩΓΗ, ΚΑΙ Η ΣΥΝΘΗΚΗ ΓΡΑΦΕΤΑΙ ΚΥΡΙΟΛΕΚΤΙΚΑ.** Αυτό το αρχείο είναι στο κέλυφος
 * (`(app)/layout.tsx` → `useRoutePrefetch`, sidebar)· ο dev bundler μεταγλωττίζει **κάθε** προσβάσιμο `import()`
 * όταν μεταγλωττίζει τη σελίδα (γι' αυτό η Next 16.4 πρόσθεσε το `turbopackLazyDynamicImports`). Με τις ακμές εδώ,
 * **κάθε** σελίδα του `(app)` μεταγλώττιζε και τον DXF viewer (~6.400 αρχεία) ⇒ ο dev server έπεφτε από μνήμη.
 * Ίδια πολιτική με το `<Link prefetch>` της Next: προφόρτωση **μόνο** σε παραγωγή.
 * ⚠️ **ΜΗΝ** βγάλεις τη συνθήκη σε μεταβλητή ή βοηθητική συνάρτηση: ο bundler κόβει τον νεκρό κλάδο (και τις ακμές
 * `import()` του) **μόνο** όταν βλέπει το `process.env.NODE_ENV === 'production'` αυτούσιο (webpack ConstPlugin).
 */
const ROUTE_PRELOADERS: Readonly<Record<PreloadableRoute, () => Promise<void>>> | null =
  process.env.NODE_ENV === 'production'
    ? {
        'crm-dashboard': () => import('@/components/crm/crm-routes').then(({ CrmRoutes }) => CrmRoutes.CRMDashboard.preload()),
        'buildings': () => import('@/components/building-management/building-routes').then(({ BuildingRoutes }) => BuildingRoutes.Buildings.preload()),
        'contacts': () => import('@/components/contacts/contact-routes').then(({ ContactRoutes }) => ContactRoutes.Contacts.preload()),
        'properties': () => import('@/components/properties/property-routes').then(({ PropertyRoutes }) => PropertyRoutes.Properties.preload()),
        'dxf-viewer': () => import('@/utils/routes/dxf-viewer-routes').then(({ DxfViewerRoutes }) => DxfViewerRoutes.DXFViewer.preload()),
        'obligations-new': () => import('@/components/obligations/obligation-routes').then(({ ObligationRoutes }) => ObligationRoutes.ObligationsNew.preload()),
        'obligations-edit': () => import('@/components/obligations/obligation-routes').then(({ ObligationRoutes }) => ObligationRoutes.ObligationsEdit.preload()),
      }
    : null;

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
  '/obligations': 'obligations-new',
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

// Preload a specific route
export async function preloadRoute(route: PreloadableRoute): Promise<void> {
  try {
    const preload = ROUTE_PRELOADERS?.[route];
    if (preload) {
      await preload();
      logger.debug(`Preloaded route: ${route}`);
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



