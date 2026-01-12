/**
 * =============================================================================
 * USE AUTH PROVIDER INFO HOOK
 * =============================================================================
 *
 * Enterprise Pattern: Typed provider detection from Firebase
 * Provides reliable detection of auth providers (password, Google, etc.)
 *
 * @module auth/hooks/useAuthProviderInfo
 * @enterprise ADR-024 - Security Standards
 */

'use client';

import { useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { getAuthProviderInfo, type AuthProviderInfo } from '../utils/authProviders';

/**
 * Hook to get authentication provider information
 *
 * Uses Firebase providerData for reliable detection
 * of password vs OAuth users
 *
 * @returns AuthProviderInfo with typed properties
 *
 * @example
 * ```tsx
 * function SecurityPage() {
 *   const { isPasswordUser, isOAuthUser, isGoogleUser } = useAuthProviderInfo();
 *
 *   if (isPasswordUser) {
 *     return <PasswordResetForm />;
 *   }
 *   if (isGoogleUser) {
 *     return <GoogleAccountInfo />;
 *   }
 * }
 * ```
 */
export function useAuthProviderInfo(): AuthProviderInfo {
  const auth = getAuth();

  return useMemo(() => {
    return getAuthProviderInfo(auth.currentUser);
  }, [auth.currentUser]);
}

export default useAuthProviderInfo;
