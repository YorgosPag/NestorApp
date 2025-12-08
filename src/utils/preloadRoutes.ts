'use client';

// Route preloading utilities for better performance
// These functions can preload components before user navigation

type PreloadableRoute =
  | 'crm-dashboard'
  | 'buildings'
  | 'contacts'
  | 'properties'
  | 'dxf-viewer'
  | 'obligations-new'
  | 'obligations-edit';

const routePreloaders: Record<PreloadableRoute, () => Promise<any>> = {
  'crm-dashboard': () => import('@/components/crm/dashboard/CRMDashboardPageContent'),
  'buildings': () => import('@/components/building-management/BuildingsPageContent'),
  'contacts': () => import('@/components/contacts/ContactsPageContent'),
  'properties': () => import('@/components/properties/PropertiesPageContent'),
  'dxf-viewer': () => import('@/subapps/dxf-viewer/DxfViewerApp'),
  'obligations-new': () => import('@/components/obligations/ObligationForm'),
  'obligations-edit': () => import('@/components/obligations/ObligationEditForm'),
};

// Preload a specific route
export async function preloadRoute(route: PreloadableRoute): Promise<void> {
  try {
    const preloader = routePreloaders[route];
    if (preloader) {
      await preloader();
      console.debug(`Preloaded route: ${route}`);
    }
  } catch (error) {
    console.warn(`Failed to preload route ${route}:`, error);
  }
}

// Preload multiple routes
export async function preloadRoutes(routes: PreloadableRoute[]): Promise<void> {
  const preloadPromises = routes.map(route => preloadRoute(route));
  await Promise.allSettled(preloadPromises);
}

// Preload routes based on user context/role
export function preloadUserRoutes(userRole?: string): void {
  // Use requestIdleCallback for non-blocking preloading
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      const commonRoutes: PreloadableRoute[] = ['buildings', 'contacts', 'properties'];
      
      if (userRole === 'admin') {
        preloadRoutes([...commonRoutes, 'dxf-viewer', 'crm-dashboard']);
      } else if (userRole === 'agent') {
        preloadRoutes([...commonRoutes, 'crm-dashboard']);
      } else {
        preloadRoutes(commonRoutes);
      }
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      const basicRoutes: PreloadableRoute[] = ['buildings', 'contacts'];
      preloadRoutes(basicRoutes);
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

// Critical routes that should be preloaded immediately
export const CRITICAL_ROUTES: PreloadableRoute[] = ['buildings', 'contacts'];

// Heavy routes that should only be preloaded for admin users
export const ADMIN_ROUTES: PreloadableRoute[] = ['dxf-viewer', 'crm-dashboard'];

// Routes that can be preloaded on idle
export const IDLE_ROUTES: PreloadableRoute[] = ['properties'];