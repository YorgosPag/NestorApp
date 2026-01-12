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
 * Enterprise pattern: givenName + familyName + displayName
 */
export interface FirebaseAuthUser {
  uid: string;
  email: string | null;
  /** Combined display name (givenName + familyName) */
  displayName: string | null;
  /** First name / Given name */
  givenName: string | null;
  /** Last name / Family name */
  familyName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  /** True if profile needs completion (e.g., Google sign-in without name details) */
  profileIncomplete?: boolean;
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
  givenName?: string | null;
  familyName?: string | null;
  userType?: UserType;
}

/**
 * Sign-up data interface for email/password registration
 */
export interface SignUpData {
  email: string;
  password: string;
  givenName: string;
  familyName: string;
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
  signInWithGoogle: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateUserProfile: (givenName: string, familyName: string) => Promise<boolean>;
  sendVerificationEmail: () => Promise<boolean>;
  /** Complete profile for users who signed up via Google without full name details */
  completeProfile: (givenName: string, familyName: string) => Promise<boolean>;
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
  signUp: (data: SignUpData) => Promise<boolean>;
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

// =============================================================================
// 🛡️ SESSION VALIDATION - ENTERPRISE SECURITY
// =============================================================================
// Following enterprise security standards (Google, Microsoft, Okta)
// Validates session integrity and detects corrupted auth states
// =============================================================================

/**
 * Session validation status codes
 * Enterprise pattern: Explicit status codes for debugging and telemetry
 */
export type SessionValidationStatus =
  | 'VALID'                    // Session is fully valid
  | 'INVALID_NO_EMAIL'         // User authenticated but no email (corrupted state)
  | 'INVALID_NO_UID'           // User object exists but no UID (corrupted state)
  | 'INVALID_ANONYMOUS'        // Anonymous user (not supported in this app)
  | 'EXPIRED'                  // Session token expired
  | 'NO_SESSION';              // No active session

/**
 * Detected session issues for logging/telemetry
 */
export interface SessionIssue {
  code: SessionValidationStatus;
  message: string;
  timestamp: Date;
  /** User agent for debugging */
  userAgent?: string;
  /** Whether auto-recovery was attempted */
  recoveryAttempted: boolean;
}

/**
 * Session validation result
 * Enterprise pattern: Detailed validation result for debugging
 */
export interface SessionValidationResult {
  isValid: boolean;
  status: SessionValidationStatus;
  /** Detected issues (empty if valid) */
  issues: SessionIssue[];
  /** Recommendation for handling the session */
  recommendation: 'CONTINUE' | 'LOGOUT' | 'REFRESH' | 'RE_AUTHENTICATE';
}
