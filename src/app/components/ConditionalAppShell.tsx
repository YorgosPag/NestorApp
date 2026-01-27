'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Conditional App Shell with Provider Separation
 * =============================================================================
 *
 * Controls layout AND provider loading based on route type:
 * - Auth routes (/login): Standalone layout, NO heavy providers
 * - App routes: Full layout with sidebar/header + ALL providers
 *
 * Pattern used by: SAP, Salesforce, Microsoft Azure Portal, Google Cloud Console
 *
 * ENTERPRISE PERFORMANCE OPTIMIZATION:
 * Heavy providers (WorkspaceProvider, FloorplanProvider, NotificationProvider,
 * SharedPropertiesProvider) are loaded ONLY for authenticated app routes.
 * This significantly reduces bundle size and compilation time for auth routes.
 *
 * ROUTE PREFETCHING (2026-01-27):
 * Activates enterprise route preloading system on app layout mount.
 * Uses requestIdleCallback for non-blocking background compilation.
 *
 * @file ConditionalAppShell.tsx
 * @created 2026-01-11
 * @updated 2026-01-27 - Added conditional provider loading (ADR-040)
 * @updated 2026-01-27 - Activated enterprise route prefetching
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { NavigationProvider } from '@/components/navigation';
import { PhotoPreviewProvider } from '@/providers/PhotoPreviewProvider';
import { MainContentBridge } from './MainContentBridge';
// 🏢 ENTERPRISE: Centralized design system hooks
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Heavy providers - loaded only for app routes
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { FloorplanProvider } from '@/contexts/FloorplanContext';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { SharedPropertiesProvider } from '@/contexts/SharedPropertiesProvider';
// 🏢 ENTERPRISE: Global components that need NotificationProvider
import { NotificationDrawer } from '@/components/NotificationDrawer.enterprise';
import { ToasterClient } from '@/components/ToasterClient';
import { GlobalErrorSetup } from '@/components/GlobalErrorSetup';
// 🚀 ENTERPRISE: Route prefetching system (SAP/Salesforce/Google pattern)
import { preloadUserRoutes } from '@/utils/preloadRoutes';
import { useAuth } from '@/auth';

/**
 * Routes that should display standalone (no sidebar/header, minimal providers)
 * Enterprise pattern: Authentication pages don't need full app providers
 */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/action'] as const;

interface ConditionalAppShellProps {
  children: React.ReactNode;
}

/**
 * Checks if the current path is an auth route
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * 🔐 AUTH LAYOUT: Standalone with minimal providers
 * No WorkspaceProvider, FloorplanProvider, NotificationProvider, SharedPropertiesProvider
 */
function AuthLayout({ children }: { children: React.ReactNode }) {
  const layout = useLayoutClasses();
  const colors = useSemanticColors();

  return (
    <main className={`${layout.shellAuthStandalone} ${colors.bg.primary}`}>
      {children}
    </main>
  );
}

/**
 * 🏢 APP LAYOUT: Full layout with ALL providers
 * Includes: WorkspaceProvider, FloorplanProvider, NotificationProvider, SharedPropertiesProvider
 * Plus: Sidebar, Header, Navigation, PhotoPreview
 *
 * 🚀 ENTERPRISE: Activates route prefetching on mount
 * Pattern: Salesforce Lightning, SAP Fiori, Google Cloud Console
 */
function AppLayout({ children }: { children: React.ReactNode }) {
  const layout = useLayoutClasses();
  const { user } = useAuth();
  const prefetchInitialized = useRef(false);

  // 🚀 ENTERPRISE: Activate route prefetching on app layout mount
  // Uses requestIdleCallback for non-blocking background compilation
  // Pattern: SAP Fiori, Salesforce Lightning - Wait for auth then prefetch
  useEffect(() => {
    // 🛡️ GUARD: Wait until user is loaded before prefetching
    // This ensures we have the correct role for role-based prefetching
    if (!user) return;
    if (prefetchInitialized.current) return;
    prefetchInitialized.current = true;

    // 🏢 ENTERPRISE: Map Firebase globalRole to preload UserRole
    // globalRole from Firebase custom claims → preload system role
    const mapGlobalRoleToPreloadRole = (globalRole?: string): 'admin' | 'agent' | 'user' | 'viewer' => {
      if (!globalRole) return 'user';
      if (globalRole === 'super_admin' || globalRole === 'company_admin' || globalRole === 'admin') {
        return 'admin';
      }
      if (globalRole === 'agent' || globalRole === 'sales') {
        return 'agent';
      }
      if (globalRole === 'viewer' || globalRole === 'guest') {
        return 'viewer';
      }
      return 'user';
    };

    const userRole = mapGlobalRoleToPreloadRole(user.globalRole);
    const tenantId = user.companyId;

    // 🏢 ENTERPRISE: Trigger background route preloading
    // This compiles routes before user navigates, improving perceived performance
    preloadUserRoutes(userRole, tenantId);
  }, [user]);

  return (
    <WorkspaceProvider>
      <FloorplanProvider>
        <NotificationProvider>
          <SharedPropertiesProvider>
            <NavigationProvider>
              <PhotoPreviewProvider>
                <SidebarProvider>
                  <div className={layout.shellAppContainer}>
                    <AppSidebar />
                    <SidebarInset className={layout.shellAppContent}>
                      <AppHeader />
                      <MainContentBridge>
                        {children}
                      </MainContentBridge>
                    </SidebarInset>
                  </div>
                </SidebarProvider>
              </PhotoPreviewProvider>
            </NavigationProvider>

            {/* 🏢 ENTERPRISE: Global components that need providers */}
            <NotificationDrawer />
            <ToasterClient />
            <GlobalErrorSetup />
          </SharedPropertiesProvider>
        </NotificationProvider>
      </FloorplanProvider>
    </WorkspaceProvider>
  );
}

/**
 * 🏢 ENTERPRISE: Main Conditional App Shell
 *
 * Routes auth vs app and loads appropriate layout + providers
 */
export function ConditionalAppShell({ children }: ConditionalAppShellProps) {
  const pathname = usePathname();
  const isStandaloneRoute = isAuthRoute(pathname);

  // 🔐 AUTH ROUTES: Minimal providers, standalone layout
  if (isStandaloneRoute) {
    return <AuthLayout>{children}</AuthLayout>;
  }

  // 🏢 APP ROUTES: Full providers, full layout
  return <AppLayout>{children}</AppLayout>;
}
