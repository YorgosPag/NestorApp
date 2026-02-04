'use client';

// =============================================================================
// 🔐 AUTH CONTEXT - CENTRALIZED FIREBASE AUTHENTICATION
// =============================================================================
//
// Enterprise-grade Firebase Auth implementation
// Single Source of Truth for authentication state
//
// Features:
// - Firebase Auth integration
// - Type-safe error handling (no 'any')
// - Localized error messages
// - Email verification support
// - Password reset flow
//
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  AuthError,
  GoogleAuthProvider,
  signInWithPopup,
  MultiFactorResolver
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { sessionService } from '@/services/session';
import { twoFactorService } from '@/services/two-factor/EnterpriseTwoFactorService';
import { API_ROUTES, AUTH_EVENTS } from '@/config/domain-constants';
import type {
  FirebaseAuthUser,
  SignUpData,
  SessionValidationStatus,
  SessionValidationResult,
  SessionIssue
} from '../types/auth.types';

// =============================================================================
// CONTEXT TYPES
// =============================================================================

interface AuthContextType {
  // User state
  user: FirebaseAuthUser | null;
  loading: boolean;
  error: string | null;

  // Authentication methods
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;

  // User management
  updateUserProfile: (givenName: string, familyName: string) => Promise<void>;
  completeProfile: (givenName: string, familyName: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;

  // 🔐 MFA/2FA Support (Enterprise)
  /** True if MFA verification is required during sign-in */
  mfaRequired: boolean;
  /** Verify MFA code to complete sign-in */
  verifyMfaCode: (code: string) => Promise<void>;
  /** Cancel MFA verification and return to login */
  cancelMfaVerification: () => void;

  // Utilities
  clearError: () => void;
  isAuthenticated: boolean;
  /** True if user needs to complete their profile (e.g., Google sign-in) */
  needsProfileCompletion: boolean;

  // 🔐 ENTERPRISE: Force token refresh (for permission updates)
  /** Force refresh Firebase ID token (useful after permission changes) */
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// =============================================================================
// ERROR HANDLING - TYPE-SAFE (NO ANY!)
// =============================================================================

/**
 * Type guard for Firebase AuthError
 */
function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as AuthError).code === 'string'
  );
}

/**
 * Get localized error message from Firebase error
 */
function getErrorMessage(error: unknown): string {
  if (!isAuthError(error)) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Άγνωστο σφάλμα authentication.';
  }

  const errorMessages: Record<string, string> = {
    'auth/user-not-found': 'Δεν βρέθηκε χρήστης με αυτό το email.',
    'auth/wrong-password': 'Λάθος κωδικός πρόσβασης.',
    'auth/invalid-credential': 'Μη έγκυρα στοιχεία σύνδεσης.',
    'auth/invalid-email': 'Μη έγκυρο email.',
    'auth/user-disabled': 'Αυτός ο λογαριασμός έχει απενεργοποιηθεί.',
    'auth/email-already-in-use': 'Το email χρησιμοποιείται ήδη.',
    'auth/weak-password': 'Ο κωδικός είναι πολύ αδύναμος (τουλάχιστον 6 χαρακτήρες).',
    'auth/network-request-failed': 'Πρόβλημα δικτύου. Δοκιμάστε ξανά.',
    'auth/too-many-requests': 'Πολλές προσπάθειες. Δοκιμάστε αργότερα.',
    'auth/operation-not-allowed': 'Η λειτουργία δεν επιτρέπεται.',
    'auth/requires-recent-login': 'Απαιτείται πρόσφατη σύνδεση. Παρακαλώ συνδεθείτε ξανά.',
    // Google Sign-In specific errors
    'auth/popup-closed-by-user': 'Η σύνδεση ακυρώθηκε. Το παράθυρο έκλεισε.',
    'auth/popup-blocked': 'Το παράθυρο σύνδεσης αποκλείστηκε. Ενεργοποιήστε τα popups.',
    'auth/cancelled-popup-request': 'Η αίτηση σύνδεσης ακυρώθηκε.',
    'auth/account-exists-with-different-credential': 'Υπάρχει λογαριασμός με αυτό το email αλλά με διαφορετική μέθοδο σύνδεσης.',
    // 🔐 MFA/2FA specific errors
    'auth/multi-factor-auth-required': 'Απαιτείται επαλήθευση δύο παραγόντων.',
    'auth/invalid-verification-code': 'Μη έγκυρος κωδικός επαλήθευσης.'
  };

  return errorMessages[error.code] || error.message || 'Άγνωστο σφάλμα authentication.';
}

// =============================================================================
// 🛡️ SESSION VALIDATION - ENTERPRISE SECURITY
// =============================================================================
// Following Google/Microsoft/Okta enterprise security standards
// Validates session integrity and handles corrupted auth states
// =============================================================================

/**
 * Validate Firebase user session
 * Enterprise pattern: Detect and handle corrupted/stale auth states
 *
 * @param firebaseUser - The Firebase user object to validate
 * @returns SessionValidationResult with status and recommendations
 */
function validateSession(firebaseUser: FirebaseUser | null): SessionValidationResult {
  const issues: SessionIssue[] = [];
  const timestamp = new Date();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

  // No session - valid state (not logged in)
  if (!firebaseUser) {
    return {
      isValid: true,
      status: 'NO_SESSION',
      issues: [],
      recommendation: 'CONTINUE'
    };
  }

  // Check for missing UID (should never happen, but defensive coding)
  if (!firebaseUser.uid) {
    issues.push({
      code: 'INVALID_NO_UID',
      message: 'User object exists but has no UID - corrupted state',
      timestamp,
      userAgent,
      recoveryAttempted: false
    });
    return {
      isValid: false,
      status: 'INVALID_NO_UID',
      issues,
      recommendation: 'LOGOUT'
    };
  }

  // Check for missing email (common corruption issue)
  if (!firebaseUser.email) {
    // Check if this is an anonymous user (which we don't support)
    const isAnonymous = firebaseUser.isAnonymous;

    if (isAnonymous) {
      issues.push({
        code: 'INVALID_ANONYMOUS',
        message: 'Anonymous authentication detected - not supported in this application',
        timestamp,
        userAgent,
        recoveryAttempted: false
      });
      return {
        isValid: false,
        status: 'INVALID_ANONYMOUS',
        issues,
        recommendation: 'LOGOUT'
      };
    }

    // Non-anonymous user without email - corrupted state
    issues.push({
      code: 'INVALID_NO_EMAIL',
      message: 'Authenticated user has no email - session may be corrupted',
      timestamp,
      userAgent,
      recoveryAttempted: false
    });
    return {
      isValid: false,
      status: 'INVALID_NO_EMAIL',
      issues,
      recommendation: 'LOGOUT'
    };
  }

  // Session is valid
  return {
    isValid: true,
    status: 'VALID',
    issues: [],
    recommendation: 'CONTINUE'
  };
}

/**
 * Clear corrupted localStorage data for a user
 * Enterprise pattern: Clean up stale data to prevent issues
 */
function clearCorruptedUserData(uid: string): void {
  console.log('🧹 [AuthContext] Clearing corrupted user data for:', uid);

  try {
    localStorage.removeItem(`givenName_${uid}`);
    localStorage.removeItem(`familyName_${uid}`);
    localStorage.removeItem(`profile_complete_${uid}`);
    console.log('✅ [AuthContext] Corrupted data cleared');
  } catch (error) {
    console.warn('⚠️ [AuthContext] Could not clear localStorage:', error);
  }
}

function buildAuthUser(firebaseUser: FirebaseUser, customClaims: Record<string, unknown>): FirebaseAuthUser {
  const displayName = firebaseUser.displayName;
  const isGoogleProvider = firebaseUser.providerData.some(
    (provider) => provider.providerId === 'google.com'
  );
  const profileIncomplete = isGoogleProvider && !localStorage.getItem(`profile_complete_${firebaseUser.uid}`);

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName,
    givenName: localStorage.getItem(`givenName_${firebaseUser.uid}`) || null,
    familyName: localStorage.getItem(`familyName_${firebaseUser.uid}`) || null,
    emailVerified: firebaseUser.emailVerified,
    photoURL: firebaseUser.photoURL,
    profileIncomplete,
    globalRole: customClaims.globalRole as string | undefined,
    companyId: customClaims.companyId as string | undefined,
    permissions: customClaims.permissions as string[] | undefined,
    mfaEnrolled: customClaims.mfaEnrolled as boolean | undefined
  };
}

/**
 * Create/refresh server-side session cookie for admin pages.
 * Required for production Server Components that rely on __session.
 */
async function syncServerSession(firebaseUser: FirebaseUser): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const idToken = await firebaseUser.getIdToken(true);

  const response = await fetch(API_ROUTES.AUTH_SESSION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    let payload: SessionApiResponse | null = null;
    try {
      payload = (await response.json()) as SessionApiResponse;
    } catch {
      payload = null;
    }

    const errorMessage = payload?.error || payload?.message || 'Failed to create session cookie';
    throw new Error(errorMessage);
  }
}

/**
 * Clear server-side session cookie on sign-out.
 */
async function clearServerSessionCookie(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  await fetch(API_ROUTES.AUTH_SESSION, {
    method: 'DELETE',
    credentials: 'include',
  });
}

// =============================================================================
// AUTH PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

interface SessionApiResponse {
  success: boolean;
  message: string;
  error?: string;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔐 MFA/2FA State (Enterprise)
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);

  // ==========================================================================
  // AUTH STATE LISTENER
  // ==========================================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log('[ENTERPRISE] [AuthContext] Auth state changed:', firebaseUser?.uid || 'No user');

      // 🛡️ ENTERPRISE: Session Validation
      const validation = validateSession(firebaseUser);
      console.log('[ENTERPRISE] [AuthContext] Session validation:', validation.status);

      // Handle invalid sessions with auto-logout
      if (!validation.isValid && validation.recommendation === 'LOGOUT') {
        console.error('🚨 [AuthContext] INVALID SESSION DETECTED:', validation.status);
        console.error('🚨 [AuthContext] Issues:', validation.issues);

        // Clear corrupted data if UID exists
        if (firebaseUser?.uid) {
          clearCorruptedUserData(firebaseUser.uid);
        }

        // Auto-logout for security
        try {
          console.log('🔐 [AuthContext] Auto-logout triggered for security');
          await firebaseSignOut(auth);
        } catch (logoutError) {
          console.error('⚠️ [AuthContext] Auto-logout failed:', logoutError);
        }

        setUser(null);
        setLoading(false);
        return;
      }

      if (firebaseUser) {
        // 🔐 ENTERPRISE: Load custom claims from Firebase ID token
        // forceRefresh=true ensures we get fresh claims after bootstrap/permission updates
        let customClaims: Record<string, unknown> = {};
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          customClaims = idTokenResult.claims;
          console.log('🔐 [AuthContext] Custom claims loaded:', {
            globalRole: customClaims.globalRole,
            companyId: customClaims.companyId,
            permissions: Array.isArray(customClaims.permissions) ? customClaims.permissions.length : 0
          });
        } catch (claimsError) {
          console.warn('⚠️ [AuthContext] Failed to load custom claims (non-blocking):', claimsError);
        }

        const authUser = buildAuthUser(firebaseUser, customClaims);

        console.log('✅ [AuthContext] Valid session established:', authUser.email);
        setUser(authUser);

        // 🔐 ENTERPRISE: Create/Update session in Firestore for Active Sessions management
        try {
          // Initialize session service with Firestore instance
          if (db) {
            sessionService.initialize(db);

            // Check if we already have a session for this browser (avoid duplicates on page refresh)
            const existingSessionId = typeof sessionStorage !== 'undefined'
              ? sessionStorage.getItem('currentSessionId')
              : null;

            if (existingSessionId) {
              // Session already exists for this browser tab - just update activity
              await sessionService.updateSessionActivity(firebaseUser.uid, existingSessionId);
              console.log('🔐 [AuthContext] Session activity updated:', existingSessionId);
            } else {
              // No existing session - create new one
              const loginMethod = firebaseUser.providerData.some(
                (provider) => provider.providerId === 'google.com'
              ) ? 'google' : 'email';

              await sessionService.createSession({
                userId: firebaseUser.uid,
                loginMethod
              });
              console.log('🔐 [AuthContext] New session created for Active Sessions tracking');
            }
          }
        } catch (sessionError) {
          // Don't block login if session creation fails - just log
          console.warn('⚠️ [AuthContext] Failed to manage session (non-blocking):', sessionError);
        }

        // 🔐 ENTERPRISE: Sync server-side session cookie for Server Components
        try {
          await syncServerSession(firebaseUser);
          console.log('🔐 [AuthContext] Server session cookie synced');
        } catch (sessionError) {
          console.warn('⚠️ [AuthContext] Failed to sync server session cookie (non-blocking):', sessionError);
        }
      } else {
        try {
          await clearServerSessionCookie();
          console.log('🔐 [AuthContext] Server session cookie cleared');
        } catch (sessionError) {
          console.warn('⚠️ [AuthContext] Failed to clear server session cookie (non-blocking):', sessionError);
        }
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 🔐 ENTERPRISE: External session refresh trigger (e.g., after MFA claim sync)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleRefreshSession = async () => {
      if (!auth.currentUser) {
        return;
      }

      try {
        await syncServerSession(auth.currentUser);
        console.log('🔐 [AuthContext] Server session cookie refreshed (event)');

        const idTokenResult = await auth.currentUser.getIdTokenResult(true);
        const updatedUser = buildAuthUser(auth.currentUser, idTokenResult.claims);
        setUser(updatedUser);
      } catch (sessionError) {
        console.warn('⚠️ [AuthContext] Failed to refresh server session cookie (event):', sessionError);
      }
    };

    window.addEventListener(AUTH_EVENTS.REFRESH_SESSION, handleRefreshSession);

    return () => {
      window.removeEventListener(AUTH_EVENTS.REFRESH_SESSION, handleRefreshSession);
    };
  }, []);

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  const handleError = (error: unknown) => {
    const message = getErrorMessage(error);
    setError(message);
    console.error('🔐 [AuthContext] Error:', message);
  };

  const clearError = () => {
    setError(null);
  };

  // ==========================================================================
  // REDIRECT RESULT HANDLING (Google Sign-In Redirect)
  // ==========================================================================
  // AUTHENTICATION METHODS
  // ==========================================================================

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      console.log('[ENTERPRISE] [AuthContext] Signing in:', email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('[OK] [AuthContext] Sign in successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // GOOGLE SIGN-IN - Enterprise OAuth 2.0 with MFA Support
  // ==========================================================================

  const signInWithGoogleFn = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      console.log('[ENTERPRISE] [AuthContext] Starting Google Sign-In');

      // Create Google Auth Provider with enterprise settings
      const provider = new GoogleAuthProvider();

      // Request additional OAuth scopes for enterprise features
      provider.addScope('email');
      provider.addScope('profile');

      // Set custom parameters for better UX
      provider.setCustomParameters({
        prompt: 'select_account' // Always show account selector
      });

      // Use popup flow (works reliably on localhost)
      await signInWithPopup(auth, provider);

      console.log('[OK] [AuthContext] Google Sign-In successful');
    } catch (error) {
      // 🔐 ENTERPRISE: Check if MFA is required
      const resolver = twoFactorService.getMfaResolver(error);

      if (resolver) {
        console.log('🔐 [AuthContext] MFA required - showing verification UI');
        setMfaResolver(resolver);
        setMfaRequired(true);
        setLoading(false);
        // Don't throw - we're handling MFA flow
        return;
      }

      handleError(error);
      throw error;
    } finally {
      if (!mfaRequired) {
        setLoading(false);
      }
    }
  };

  // ==========================================================================
  // MFA VERIFICATION - Enterprise 2FA Support
  // ==========================================================================

  /**
   * Verify MFA code to complete sign-in
   * Called after user enters their TOTP code
   */
  const verifyMfaCodeFn = async (code: string): Promise<void> => {
    if (!mfaResolver) {
      setError('Δεν υπάρχει ενεργή διαδικασία MFA');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔐 [AuthContext] Verifying MFA code...');

      const result = await twoFactorService.verifyTotpForSignIn(mfaResolver, code, 0);

      if (result.result === 'success') {
        console.log('✅ [AuthContext] MFA verification successful');
        // Clear MFA state - auth state listener will handle the rest
        setMfaResolver(null);
        setMfaRequired(false);
      } else {
        // Handle verification errors
        const errorMessage = result.error || 'Μη έγκυρος κωδικός επαλήθευσης';
        setError(errorMessage);
        console.error('❌ [AuthContext] MFA verification failed:', errorMessage);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancel MFA verification and return to login screen
   */
  const cancelMfaVerificationFn = (): void => {
    console.log('🔐 [AuthContext] MFA verification cancelled');
    setMfaResolver(null);
    setMfaRequired(false);
    setError(null);
    setLoading(false);
  };

  const signUp = async (data: SignUpData): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const { email, password, givenName, familyName } = data;

      console.log('[ENTERPRISE] [AuthContext] Signing up:', email);
      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (result.user) {
        // Create displayName from givenName + familyName
        const displayName = `${givenName} ${familyName}`.trim();

        // Update Firebase profile with displayName
        await updateProfile(result.user, { displayName });
        console.log('[OK] [AuthContext] Profile updated with display name:', displayName);

        // Store givenName and familyName separately in localStorage
        // (Firebase Auth doesn't have separate fields for these)
        localStorage.setItem(`givenName_${result.user.uid}`, givenName);
        localStorage.setItem(`familyName_${result.user.uid}`, familyName);
        localStorage.setItem(`profile_complete_${result.user.uid}`, 'true');

        // Send verification email
        await sendEmailVerification(result.user);
        console.log('[OK] [AuthContext] Verification email sent');

        // Update local state with the new user data
        setUser({
          uid: result.user.uid,
          email: result.user.email,
          displayName,
          givenName,
          familyName,
          emailVerified: result.user.emailVerified,
          photoURL: result.user.photoURL,
          profileIncomplete: false
        });
      }

      console.log('[OK] [AuthContext] Sign up successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 [AuthContext] Signing out');

      // 🏢 ENTERPRISE: Dispatch logout event BEFORE signOut
      // This allows other modules (NavigationContext) to cleanup their state
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
        console.log('📡 [AuthContext] Dispatched auth:logout event');
      }

      await firebaseSignOut(auth);
      console.log('✅ [AuthContext] Sign out successful');

      try {
        await clearServerSessionCookie();
        console.log('🔐 [AuthContext] Server session cookie cleared on sign-out');
      } catch (sessionError) {
        console.warn('⚠️ [AuthContext] Failed to clear server session cookie on sign-out:', sessionError);
      }
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      setError(null);

      console.log('🔐 [AuthContext] Sending password reset to:', email);
      console.log('🔐 [AuthContext] Firebase Auth domain:', auth.config.authDomain);

      await sendPasswordResetEmail(auth, email);

      console.log('✅ [AuthContext] Password reset email sent successfully!');
      console.log('📧 [AuthContext] Check your inbox (and spam folder) for:', email);
    } catch (error) {
      console.error('❌ [AuthContext] Password reset failed:', error);
      handleError(error);
      throw error;
    }
  };

  /**
   * Update user profile with separate givenName and familyName
   * Enterprise pattern: Store structured name data
   */
  const updateUserProfileFn = async (givenName: string, familyName: string): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);

      const displayName = `${givenName} ${familyName}`.trim();
      await updateProfile(auth.currentUser, { displayName });

      // Store in localStorage (Firebase doesn't have separate fields)
      localStorage.setItem(`givenName_${auth.currentUser.uid}`, givenName);
      localStorage.setItem(`familyName_${auth.currentUser.uid}`, familyName);

      setUser(prev => prev ? { ...prev, displayName, givenName, familyName } : null);
      console.log('✅ [AuthContext] Profile updated:', displayName);
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  /**
   * Complete profile for Google Sign-In users
   * Called after first Google login to collect structured name data
   */
  const completeProfileFn = async (givenName: string, familyName: string): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);

      const displayName = `${givenName} ${familyName}`.trim();
      await updateProfile(auth.currentUser, { displayName });

      // Store structured name data
      localStorage.setItem(`givenName_${auth.currentUser.uid}`, givenName);
      localStorage.setItem(`familyName_${auth.currentUser.uid}`, familyName);
      localStorage.setItem(`profile_complete_${auth.currentUser.uid}`, 'true');

      // Update local state - profile is now complete
      setUser(prev => prev ? {
        ...prev,
        displayName,
        givenName,
        familyName,
        profileIncomplete: false
      } : null);

      console.log('✅ [AuthContext] Profile completed for Google user:', displayName);
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  const sendVerificationEmailFn = async (): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);

      await sendEmailVerification(auth.currentUser);
      console.log('✅ [AuthContext] Verification email sent');
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  // ==========================================================================
  // 🔐 ENTERPRISE: FORCE TOKEN REFRESH
  // ==========================================================================
  // Used after admin permission updates to get fresh custom claims
  // Pattern: Microsoft/SAP/Google - Force token refresh after role changes
  // ==========================================================================

  const refreshTokenFn = async (): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);
      console.log('🔄 [AuthContext] Force refreshing ID token...');

      // Force refresh (getIdToken with forceRefresh=true)
      const idTokenResult = await auth.currentUser.getIdTokenResult(true);
      setUser(buildAuthUser(auth.currentUser, idTokenResult.claims));

      console.log('✅ [AuthContext] Token refreshed successfully - new permissions loaded');
    } catch (error) {
      console.error('❌ [AuthContext] Token refresh failed:', error);
      handleError(error);
      throw error;
    }
  };

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    error,
    signIn,
    signInWithGoogle: signInWithGoogleFn,
    signUp,
    signOut,
    resetPassword,
    updateUserProfile: updateUserProfileFn,
    completeProfile: completeProfileFn,
    sendVerificationEmail: sendVerificationEmailFn,
    // 🔐 MFA/2FA Support
    mfaRequired,
    verifyMfaCode: verifyMfaCodeFn,
    cancelMfaVerification: cancelMfaVerificationFn,
    // 🔐 ENTERPRISE: Token refresh
    refreshToken: refreshTokenFn,
    clearError,
    isAuthenticated: !!user,
    needsProfileCompletion: user?.profileIncomplete ?? false
  }), [user, loading, error, mfaRequired]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main auth hook - requires AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      '🔴 useAuth must be used within an AuthProvider. ' +
      'Wrap your component tree with <AuthProvider>.'
    );
  }

  return context;
}

/**
 * Optional auth hook - returns null if outside provider
 */
export function useAuthOptional(): AuthContextType | null {
  return useContext(AuthContext);
}

// =============================================================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

// Alias for legacy code
export { AuthProvider as FirebaseAuthProvider };
export { useAuth as useFirebaseAuth };

export default AuthContext;
