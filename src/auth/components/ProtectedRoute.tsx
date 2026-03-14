'use client';

// =============================================================================
// 🛡️ PROTECTED ROUTE - AUTHENTICATION GUARD
// =============================================================================
//
// Enterprise-grade route protection component
// Redirects unauthenticated users to login page
//
// =============================================================================

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUserRole } from '../contexts/UserRoleContext';
import { Spinner } from '@/components/ui/spinner';
import type { ProtectedRouteProps, UserRole } from '../types/auth.types';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('ProtectedRoute');

// =============================================================================
// PROTECTED ROUTE COMPONENT
// =============================================================================

export function ProtectedRoute({
  children,
  fallback,
  requiredRole,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated, isAdmin } = useUserRole();
  const router = useRouter();

  // ==========================================================================
  // AUTHENTICATION CHECK
  // ==========================================================================

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      logger.info('[ProtectedRoute] User not authenticated, redirecting to', { redirectTo });
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  // ==========================================================================
  // ROLE CHECK
  // ==========================================================================

  useEffect(() => {
    if (!isLoading && isAuthenticated && requiredRole) {
      const hasRequiredRole = checkRole(user?.role, requiredRole);

      if (!hasRequiredRole) {
        logger.info('[ProtectedRoute] User lacks required role', { requiredRole });
        router.push('/unauthorized');
      }
    }
  }, [isAuthenticated, isLoading, user?.role, requiredRole, router]);

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================

  if (isLoading) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="large" />
          <p className="text-muted-foreground">Έλεγχος πρόσβασης...</p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // UNAUTHENTICATED STATE
  // ==========================================================================

  if (!isAuthenticated) {
    // Will redirect, show nothing
    return null;
  }

  // ==========================================================================
  // ROLE CHECK FAILED
  // ==========================================================================

  if (requiredRole && !checkRole(user?.role, requiredRole)) {
    // Will redirect, show nothing
    return null;
  }

  // ==========================================================================
  // AUTHENTICATED - RENDER CHILDREN
  // ==========================================================================

  return <>{children}</>;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Check if user role meets the required role
 * Role hierarchy: admin > authenticated > public
 */
function checkRole(userRole: UserRole | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;

  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    authenticated: 2,
    public: 1
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

// =============================================================================
// LEGACY EXPORT FOR BACKWARD COMPATIBILITY
// =============================================================================

export default ProtectedRoute;
