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
  AuthError
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { FirebaseAuthUser } from '../types/auth.types';

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
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;

  // User management
  updateUserProfile: (displayName: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;

  // Utilities
  clearError: () => void;
  isAuthenticated: boolean;
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
    'auth/requires-recent-login': 'Απαιτείται πρόσφατη σύνδεση. Παρακαλώ συνδεθείτε ξανά.'
  };

  return errorMessages[error.code] || error.message || 'Άγνωστο σφάλμα authentication.';
}

// =============================================================================
// AUTH PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // AUTH STATE LISTENER
  // ==========================================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      console.log('🔐 [AuthContext] Auth state changed:', firebaseUser?.uid || 'No user');

      if (firebaseUser) {
        const authUser: FirebaseAuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          emailVerified: firebaseUser.emailVerified,
          photoURL: firebaseUser.photoURL
        };
        setUser(authUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
  // AUTHENTICATION METHODS
  // ==========================================================================

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 [AuthContext] Signing in:', email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ [AuthContext] Sign in successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 [AuthContext] Signing up:', email);
      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName && result.user) {
        await updateProfile(result.user, { displayName });
        console.log('✅ [AuthContext] Profile updated with display name');
      }

      if (result.user) {
        await sendEmailVerification(result.user);
        console.log('📧 [AuthContext] Verification email sent');
      }

      console.log('✅ [AuthContext] Sign up successful');
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
      await firebaseSignOut(auth);
      console.log('✅ [AuthContext] Sign out successful');
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

  const updateUserProfileFn = async (displayName: string): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);

      await updateProfile(auth.currentUser, { displayName });
      setUser(prev => prev ? { ...prev, displayName } : null);
      console.log('✅ [AuthContext] Profile updated');
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
  // CONTEXT VALUE
  // ==========================================================================

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateUserProfile: updateUserProfileFn,
    sendVerificationEmail: sendVerificationEmailFn,
    clearError,
    isAuthenticated: !!user
  }), [user, loading, error]);

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
