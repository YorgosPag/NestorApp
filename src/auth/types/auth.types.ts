// =============================================================================
// 🔐 AUTH TYPES - CENTRALIZED TYPE DEFINITIONS
// =============================================================================
//
// Enterprise-grade type definitions for authentication and authorization
// Following Fortune 500 standards (SAP, Salesforce, Microsoft)
//
// Single Source of Truth for all auth-related types
//
// =============================================================================

/**
 * User role levels for authorization
 */
export type UserRole = 'admin' | 'authenticated' | 'public';

/**
 * GEO-ALERT User Types - Different interface capabilities
 * - citizen: Simple point/polygon selection
 * - professional: Image/PDF upload with auto-detection
 * - technical: Full DXF/DWG support with CAD precision
 */
export type UserType = 'citizen' | 'professional' | 'technical';

/**
 * Firebase authenticated user interface
 */
export interface FirebaseAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

/**
 * Legacy user interface for backward compatibility
 */
export interface User {
  email: string;
  role: UserRole;
  isAuthenticated: boolean;
  uid?: string;
  displayName?: string | null;
  userType?: UserType;
}

/**
 * Auth context state interface
 */
export interface AuthContextState {
  user: FirebaseAuthUser | null;
  loading: boolean;
  error: string | null;
}

/**
 * Auth context actions interface
 */
export interface AuthContextActions {
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateUserProfile: (displayName: string) => Promise<boolean>;
  sendVerificationEmail: () => Promise<boolean>;
}

/**
 * Complete auth context type
 */
export type AuthContextType = AuthContextState & AuthContextActions;

/**
 * User role context interface
 */
export interface UserRoleContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isPublic: boolean;
  isAuthenticated: boolean;
  firebaseUser: FirebaseAuthUser | null;
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
}

/**
 * User type context interface for GEO-ALERT
 */
export interface UserTypeContextType {
  userType: UserType | null;
  setUserType: (type: UserType) => void;
  isCitizen: boolean;
  isProfessional: boolean;
  isTechnical: boolean;
  isLoading: boolean;
}

/**
 * Auth form modes
 */
export type AuthFormMode = 'signin' | 'signup' | 'reset';

/**
 * Auth form props
 */
export interface AuthFormProps {
  defaultMode?: AuthFormMode;
  onSuccess?: () => void;
  redirectTo?: string;
}

/**
 * Protected route props
 */
export interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
}
