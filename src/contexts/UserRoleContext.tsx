'use client';

// =============================================================================
// 🔄 USER ROLE CONTEXT - FIREBASE AUTH INTEGRATION
// =============================================================================
//
// ✅ Production-grade Firebase Auth implementation
// ❌ Replaces fake localStorage authentication
// 🛡️ Integrates with Firestore Security Rules
// 🔄 Maintains API compatibility με το παλιό context για smooth transition
//
// =============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useFirebaseAuth, type FirebaseAuthUser } from './FirebaseAuthContext';

// =============================================================================
// LEGACY TYPES - MAINTAINED FOR COMPATIBILITY
// =============================================================================

export type UserRole = 'admin' | 'public' | 'authenticated';

interface User {
  email: string;
  role: UserRole;
  isAuthenticated: boolean;
  uid?: string; // Added for Firebase integration
  displayName?: string | null;
}

interface UserRoleContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isPublic: boolean;
  isAuthenticated: boolean;
  // New Firebase-specific methods
  firebaseUser: FirebaseAuthUser | null;
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
}

const UserRoleContext = createContext<UserRoleContextType | null>(null);

// =============================================================================
// ADMIN CONFIGURATION
// =============================================================================

/**
 * 🏢 ENTERPRISE: Environment-driven Admin Configuration (MICROSOFT/GOOGLE-CLASS)
 *
 * ✅ BEFORE: Hardcoded admin emails (ΚΡΙΣΙΜΟ SECURITY RISK!)
 * ✅ AFTER: Environment variables με enterprise-grade security patterns
 *
 * ZERO HARDCODED EMAILS - Όλες οι admin emails από configuration
 */

/**
 * Enterprise-grade admin email loading από environment variables
 */
const getEnterpriseAdminEmails = (): readonly string[] => {
  // 🔐 ENTERPRISE: Load από environment variables με type safety
  const envAdminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;

  if (envAdminEmails) {
    try {
      const emails = envAdminEmails.split(',').map(email => email.trim()).filter(Boolean);
      if (emails.length > 0) {
        console.log(`🔐 Enterprise Admin Configuration loaded: ${emails.length} admin(s)`);
        return emails;
      }
    } catch (error) {
      console.error('🚨 Enterprise Admin Configuration Parse Error:', error);
    }
  }

  // 🚨 DEVELOPMENT FALLBACK ONLY - Never for production
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Using development admin fallback - Configure NEXT_PUBLIC_ADMIN_EMAILS for production');
    return ['admin@company.local', 'developer@company.local'] as const;
  }

  // 🔒 PRODUCTION: No fallback admins για maximum security
  console.error('🚨 NO ADMIN CONFIGURATION FOUND - Set NEXT_PUBLIC_ADMIN_EMAILS environment variable');
  return [] as const;
};

const ADMIN_EMAILS = getEnterpriseAdminEmails();

// =============================================================================
// USER ROLE PROVIDER - FIREBASE INTEGRATION
// =============================================================================

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const {
    user: firebaseUser,
    loading: firebaseLoading,
    signIn,
    signUp: firebaseSignUp,
    signOut,
    resetPassword: firebaseResetPassword,
    error: firebaseError
  } = useFirebaseAuth();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================================================
  // FIREBASE USER TO LEGACY USER MAPPING
  // ==========================================================================

  useEffect(() => {
    console.log('🔄 UserRoleContext: Firebase user state changed', {
      firebaseUserId: firebaseUser?.uid,
      email: firebaseUser?.email
    });

    if (firebaseUser) {
      // Determine role based on email (temporary solution)
      const role: UserRole = ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase())
        ? 'admin'
        : 'authenticated';

      const legacyUser: User = {
        email: firebaseUser.email,
        role,
        isAuthenticated: true,
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName
      };

      console.log('✅ UserRoleContext: Legacy user mapped', {
        uid: legacyUser.uid,
        email: legacyUser.email,
        role: legacyUser.role
      });

      setUser(legacyUser);
    } else {
      console.log('🔄 UserRoleContext: No Firebase user, setting to null');
      setUser(null);
    }

    setIsLoading(firebaseLoading);
  }, [firebaseUser, firebaseLoading]);

  // ==========================================================================
  // LEGACY AUTH METHODS - FIREBASE INTEGRATION
  // ==========================================================================

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔑 UserRoleContext: Attempting login for', email);

      await signIn(email, password);
      console.log('✅ UserRoleContext: Login successful');
      return true;
    } catch (error) {
      console.error('🔥 UserRoleContext: Login failed', error);
      return false;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<boolean> => {
    try {
      console.log('🔑 UserRoleContext: Attempting sign up for', email);

      await firebaseSignUp(email, password, displayName);
      console.log('✅ UserRoleContext: Sign up successful');
      return true;
    } catch (error) {
      console.error('🔥 UserRoleContext: Sign up failed', error);
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      console.log('🔑 UserRoleContext: Attempting password reset for', email);

      await firebaseResetPassword(email);
      console.log('✅ UserRoleContext: Password reset email sent');
      return true;
    } catch (error) {
      console.error('🔥 UserRoleContext: Password reset failed', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log('🔑 UserRoleContext: Attempting logout');

      await signOut();
      console.log('✅ UserRoleContext: Logout successful');
    } catch (error) {
      console.error('🔥 UserRoleContext: Logout failed', error);
    }
  };

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const value: UserRoleContextType = {
    user,
    isLoading,
    login,
    logout,
    signUp,
    resetPassword,
    isAdmin: user?.role === 'admin',
    isPublic: !user?.isAuthenticated,
    isAuthenticated: user?.isAuthenticated || false,
    firebaseUser // Provide access to Firebase user for advanced use cases
  };

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

// =============================================================================
// LEGACY HOOKS - MAINTAINED FOR COMPATIBILITY
// =============================================================================

export function useUserRole(): UserRoleContextType {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}

// Hook to determine which sidebar to show
export function useSidebarType() {
  const { isAdmin, isPublic } = useUserRole();

  if (isAdmin) return 'admin';
  if (isPublic) return 'public';
  return 'public'; // Default for authenticated non-admin users
}

// =============================================================================
// MIGRATION UTILITIES
// =============================================================================

/**
 * 🔄 Migration helper για components που χρειάζονται τη νέα Firebase Auth
 */
export function useFirebaseAuthUser() {
  const { firebaseUser } = useUserRole();
  return firebaseUser;
}

/**
 * ⚠️ DEPRECATED: Use useUserRole instead
 * Kept για backward compatibility κατά τη migration period
 */
export function useLegacyAuth() {
  console.warn('⚠️ useLegacyAuth is deprecated. Use useUserRole instead.');
  return useUserRole();
}

export default UserRoleContext;