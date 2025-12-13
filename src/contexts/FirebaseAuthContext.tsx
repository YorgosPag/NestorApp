'use client';

// =============================================================================
// 🔑 FIREBASE AUTHENTICATION CONTEXT
// =============================================================================
//
// ✅ Production-grade Firebase Auth implementation
// ❌ Replaces fake localStorage authentication
// 🛡️ Integrates with Firestore Security Rules
//
// =============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface FirebaseAuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  isAuthenticated: true;
}

interface FirebaseAuthContextType {
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

const FirebaseAuthContext = createContext<FirebaseAuthContextType | null>(null);

// =============================================================================
// FIREBASE AUTH PROVIDER
// =============================================================================

interface FirebaseAuthProviderProps {
  children: React.ReactNode;
}

export function FirebaseAuthProvider({ children }: FirebaseAuthProviderProps) {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // AUTH STATE LISTENER
  // ==========================================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔑 Firebase Auth State Changed:', firebaseUser?.uid || 'No user');

      if (firebaseUser) {
        // Convert Firebase User to our interface
        const authUser: FirebaseAuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: firebaseUser.displayName,
          emailVerified: firebaseUser.emailVerified,
          photoURL: firebaseUser.photoURL,
          isAuthenticated: true
        };
        setUser(authUser);
        setLoading(false);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  const getErrorMessage = (error: any): string => {
    const code = error?.code || '';

    switch (code) {
      case 'auth/user-not-found':
        return 'Δεν βρέθηκε χρήστης με αυτό το email.';
      case 'auth/wrong-password':
        return 'Λάθος κωδικός πρόσβασης.';
      case 'auth/invalid-email':
        return 'Μη έγκυρο email.';
      case 'auth/user-disabled':
        return 'Αυτός ο λογαριασμός έχει απενεργοποιηθεί.';
      case 'auth/email-already-in-use':
        return 'Το email χρησιμοποιείται ήδη.';
      case 'auth/weak-password':
        return 'Ο κωδικός είναι πολύ αδύναμος.';
      case 'auth/network-request-failed':
        return 'Πρόβλημα δικτύου. Δοκιμάστε ξανά.';
      case 'auth/too-many-requests':
        return 'Πολλές προσπάθειες. Δοκιμάστε αργότερα.';
      case 'auth/operation-not-allowed':
        return 'Η λειτουργία δεν επιτρέπεται.';
      default:
        console.error('🔥 Firebase Auth Error:', error);
        return error?.message || 'Άγνωστο σφάλμα authentication.';
    }
  };

  const handleError = (error: any) => {
    const message = getErrorMessage(error);
    setError(message);
    console.error('🔥 Firebase Auth Error:', { code: error?.code, message });
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

      console.log('🔑 Attempting sign in for:', email);
      const result = await signInWithEmailAndPassword(auth, email, password);

      console.log('✅ Sign in successful:', result.user.uid);
      // User state will be updated by onAuthStateChanged
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

      console.log('🔑 Attempting sign up for:', email);
      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Update profile with display name if provided
      if (displayName) {
        await updateProfile(result.user, { displayName });
        console.log('✅ Profile updated with display name:', displayName);
      }

      // Send email verification
      await sendEmailVerification(result.user);
      console.log('📧 Verification email sent');

      console.log('✅ Sign up successful:', result.user.uid);
      // User state will be updated by onAuthStateChanged
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔑 Signing out user:', user?.uid);
      await signOut(auth);

      console.log('✅ Sign out successful');
      // User state will be updated by onAuthStateChanged
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

      console.log('🔑 Sending password reset email to:', email);
      await sendPasswordResetEmail(auth, email);

      console.log('✅ Password reset email sent');
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  const updateUserProfile = async (displayName: string): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);

      console.log('🔑 Updating user profile with display name:', displayName);
      await updateProfile(auth.currentUser, { displayName });

      console.log('✅ Profile updated successfully');
      // Force auth state refresh
      setUser(prev => prev ? { ...prev, displayName } : null);
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  const sendVerificationEmail = async (): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);

      console.log('🔑 Sending verification email to:', auth.currentUser.email);
      await sendEmailVerification(auth.currentUser);

      console.log('✅ Verification email sent');
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const value: FirebaseAuthContextType = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut: handleSignOut,
    resetPassword,
    updateUserProfile,
    sendVerificationEmail,
    clearError,
    isAuthenticated: !!user
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

// =============================================================================
// CUSTOM HOOK
// =============================================================================

export function useFirebaseAuth(): FirebaseAuthContextType {
  const context = useContext(FirebaseAuthContext);

  if (!context) {
    throw new Error('useFirebaseAuth must be used within a FirebaseAuthProvider');
  }

  return context;
}

// =============================================================================
// UTILITIES FOR LEGACY COMPATIBILITY
// =============================================================================

/**
 * 🔄 Legacy compatibility hook
 * Provides the same interface as the old UserRoleContext για smooth transition
 */
export function useLegacyAuth() {
  const { user, isAuthenticated, loading, signIn, signOut } = useFirebaseAuth();

  return {
    user: user ? {
      email: user.email,
      role: 'authenticated' as const, // All authenticated users are "authenticated"
      isAuthenticated: true
    } : null,
    isLoading: loading,
    login: async (email: string, password: string) => {
      await signIn(email, password);
      return true;
    },
    logout: signOut,
    isAdmin: false, // Will be implemented with proper role system later
    isPublic: !isAuthenticated,
    isAuthenticated
  };
}

export default FirebaseAuthContext;