// =============================================================================
// 🔐 AUTH MODULE - PUBLIC API
// =============================================================================
//
// Centralized authentication module following Fortune 500 standards
// Single entry point for all auth-related functionality
//
// Usage:
//   import { AuthProvider, useAuth, AuthForm } from '@/auth';
//
// =============================================================================

// =============================================================================
// CONTEXTS
// =============================================================================

export {
  AuthProvider,
  FirebaseAuthProvider,
  useAuth as useAuthContext,
  useFirebaseAuth,
  useAuthOptional
} from './contexts/AuthContext';

export {
  UserRoleProvider,
  useUserRole,
  useSidebarType,
  useFirebaseAuthUser,
  useLegacyAuth
} from './contexts/UserRoleContext';

export {
  UserTypeProvider,
  useUserType,
  useUserTypeOptional,
  getUserTypeLabel,
  getUserTypeCapabilities
} from './contexts/UserTypeContext';

// =============================================================================
// COMPONENTS
// =============================================================================

export {
  AuthForm,
  FirebaseLoginForm
} from './components/AuthForm';

export {
  ProtectedRoute
} from './components/ProtectedRoute';

// =============================================================================
// HOOKS
// =============================================================================

export {
  useAuth
} from './hooks/useAuth';

export {
  useAuthProviderInfo
} from './hooks/useAuthProviderInfo';

// =============================================================================
// UTILITIES
// =============================================================================

export {
  getAuthProviderInfo,
  canChangePassword,
  hasProvider,
  type AuthProviderId,
  type AuthProviderInfo
} from './utils/authProviders';

// =============================================================================
// TYPES
// =============================================================================

export type {
  UserRole,
  UserType,
  User,
  FirebaseAuthUser,
  AuthContextState,
  AuthContextActions,
  AuthContextType,
  UserRoleContextType,
  UserTypeContextType,
  AuthFormMode,
  AuthFormProps,
  ProtectedRouteProps
} from './types/auth.types';

// =============================================================================
// DEFAULT EXPORT - COMBINED PROVIDERS
// =============================================================================

/**
 * Combined auth providers for convenience
 * Wraps children with AuthProvider and UserRoleProvider
 *
 * Usage in layout.tsx:
 *   import { AuthProviders } from '@/auth';
 *   <AuthProviders>{children}</AuthProviders>
 */
export { AuthProvider as default } from './contexts/AuthContext';
