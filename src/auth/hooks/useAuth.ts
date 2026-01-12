'use client';

// =============================================================================
// 🔐 USE AUTH HOOK - ENTERPRISE AUTH ACCESS
// =============================================================================
//
// 🏢 ENTERPRISE: Single entry point for all auth operations
// Wraps AuthContext for consistent API across the application
//
// Features:
// - user: Current authenticated user
// - loading: Auth state loading indicator
// - signIn: Email/password sign in
// - signUp: Email/password sign up
// - signOut: Logout current user
// - resetPassword: Password reset email
// - error: Current auth error
// - clearError: Clear error state
//
// =============================================================================

import { useAuth as useAuthContext } from '../contexts/AuthContext';

/**
 * 🏢 ENTERPRISE: Main authentication hook
 *
 * Provides full auth operations for components:
 * - Sign in, sign up, sign out
 * - Password reset
 * - User state and loading
 * - Error handling
 *
 * @example
 * ```tsx
 * const { user, signIn, signOut, loading } = useAuth();
 * ```
 */
export function useAuth() {
  return useAuthContext();
}

// Re-export context hook for backward compatibility
export { useAuth as useFirebaseAuth } from '../contexts/AuthContext';
export { useUserRole } from '../contexts/UserRoleContext';
export { useUserType } from '../contexts/UserTypeContext';

export default useAuth;
