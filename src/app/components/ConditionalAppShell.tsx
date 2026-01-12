'use client';

/**
 * 🏢 ENTERPRISE: Conditional App Shell
 *
 * Controls layout rendering based on route type:
 * - Auth routes (/login): Standalone layout (no sidebar/header)
 * - App routes: Full layout (sidebar + header + content)
 *
 * Pattern used by: SAP, Salesforce, Microsoft Azure Portal, Google Cloud Console
 *
 * @file ConditionalAppShell.tsx
 * @created 2026-01-11
 */

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

/**
 * Routes that should display standalone (no sidebar/header)
 * Enterprise pattern: Authentication pages are always standalone
 */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'] as const;

interface ConditionalAppShellProps {
  children: React.ReactNode;
}

/**
 * Checks if the current path is an auth route
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export function ConditionalAppShell({ children }: ConditionalAppShellProps) {
  const pathname = usePathname();
  const isStandaloneRoute = isAuthRoute(pathname);
  // 🏢 ENTERPRISE: Centralized design system hooks
  const layout = useLayoutClasses();
  const colors = useSemanticColors();

  // 🔐 AUTH ROUTES: Standalone layout (no sidebar/header)
  if (isStandaloneRoute) {
    return (
      <main className={`${layout.shellAuthStandalone} ${colors.bg.primary}`}>
        {children}
      </main>
    );
  }

  // 🏢 APP ROUTES: Full layout (sidebar + header + content)
  return (
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
  );
}
