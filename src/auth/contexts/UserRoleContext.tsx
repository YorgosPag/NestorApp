'use client';

// =============================================================================
// 🔐 USER ROLE CONTEXT - ROLE-BASED ACCESS CONTROL
// =============================================================================
//
// Enterprise-grade role management with Firebase Auth integration
// Uses EnterpriseSecurityService for database-driven role determination
//
// Features:
// - Database-driven role management (no hardcoded admin emails!)
// - Integration with EnterpriseSecurityService
// - Legacy API compatibility
// - Secure fallback on errors
//
// =============================================================================

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { EnterpriseSecurityService } from '@/services/security/EnterpriseSecurityService';
import { db } from '@/lib/firebase';
import type { User, FirebaseAuthUser, UserRoleContextType, SignUpData } from '../types/auth.types';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('UserRoleContext');

// =============================================================================
// CONTEXT
// =============================================================================

const UserRoleContext = createContext<UserRoleContextType | null>(null);

// =============================================================================
// SECURITY SERVICE SINGLETON
// =============================================================================

const securityService = EnterpriseSecurityService.getInstance();

// =============================================================================
// PROVIDER
// =============================================================================

interface UserRoleProviderProps {
  children: React.ReactNode;
}

export function UserRoleProvider({ children }: UserRoleProviderProps) {
  const {
    user: firebaseUser,
    loading: authLoading,
    signIn,
    signUp: authSignUp,
    signOut,
    resetPassword: authResetPassword
  } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [securityInitialized, setSecurityInitialized] = useState(false);

  // ==========================================================================
  // INITIALIZE SECURITY SERVICE
  // ==========================================================================

  useEffect(() => {
    const initSecurity = async () => {
      if (!securityInitialized && db) {
        try {
          await securityService.initialize(db);
          setSecurityInitialized(true);
          logger.info('[UserRoleContext] Security service initialized');
        } catch (error) {
          logger.error('[UserRoleContext] Failed to initialize security', { error });
          // Continue without security service - will use fallback role
          setSecurityInitialized(true);
        }
      }
    };

    initSecurity();
  }, [securityInitialized]);

  // ==========================================================================
  // DETERMINE USER ROLE
  // ==========================================================================

  useEffect(() => {
    const determineRole = async () => {
      // 🏢 ENTERPRISE: Critical - Wait for both Firebase auth AND security initialization
      if (authLoading || !securityInitialized) {
        setIsLoading(true);
        return;
      }

      if (firebaseUser) {
        try {
          // Use EnterpriseSecurityService for role determination
          const role = await securityService.checkUserRole(
            firebaseUser.email || '',
            'default',
            process.env.NODE_ENV || 'development'
          );

          const mappedUser: User = {
            email: firebaseUser.email || '',
            role,
            isAuthenticated: true,
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName
          };

          setUser(mappedUser);
          logger.info('[UserRoleContext] User role determined', { role });
        } catch (error) {
          logger.error('[UserRoleContext] Role determination failed', { error });

          // Secure fallback - NEVER grant admin on error
          const fallbackUser: User = {
            email: firebaseUser.email || '',
            role: 'authenticated',
            isAuthenticated: true,
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName
          };

          setUser(fallbackUser);
          logger.warn('[UserRoleContext] Using secure fallback role: authenticated');
        }
      } else {
        // No Firebase user - clear user state
        setUser(null);
      }

      // 🏢 ENTERPRISE: Loading is false ONLY after all checks complete
      setIsLoading(false);
    };

    determineRole();
  }, [firebaseUser, authLoading, securityInitialized]);

  // ==========================================================================
  // AUTH METHODS
  // ==========================================================================

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      logger.info('[UserRoleContext] Login attempt', { email });
      await signIn(email, password);
      return true;
    } catch (error) {
      logger.error('[UserRoleContext] Login failed', { error });
      return false;
    }
  };

  const signUp = async (data: SignUpData): Promise<boolean> => {
    try {
      logger.info('[UserRoleContext] Sign up attempt', { email: data.email });
      // 🏢 ENTERPRISE: Pass SignUpData directly to AuthContext
      await authSignUp(data);
      return true;
    } catch (error) {
      logger.error('[UserRoleContext] Sign up failed', { error });
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      logger.info('[UserRoleContext] Password reset attempt', { email });
      await authResetPassword(email);
      return true;
    } catch (error) {
      logger.error('[UserRoleContext] Password reset failed', { error });
      return false;
    }
  };

  const logout = async () => {
    try {
      logger.info('[UserRoleContext] Logout');
      await signOut();
    } catch (error) {
      logger.error('[UserRoleContext] Logout failed', { error });
    }
  };

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const value = useMemo<UserRoleContextType>(() => ({
    user,
    isLoading,
    login,
    logout,
    signUp,
    resetPassword,
    isAdmin: user?.role === 'admin',
    isPublic: !user?.isAuthenticated,
    isAuthenticated: user?.isAuthenticated || false,
    firebaseUser: firebaseUser as FirebaseAuthUser | null
  }), [user, isLoading, firebaseUser]);

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main hook for user role context
 */
export function useUserRole(): UserRoleContextType {
  const context = useContext(UserRoleContext);

  if (!context) {
    throw new Error(
      '🔴 useUserRole must be used within a UserRoleProvider. ' +
      'Wrap your component tree with <UserRoleProvider>.'
    );
  }

  return context;
}

/**
 * Hook to determine sidebar type based on role
 */
export function useSidebarType(): 'admin' | 'public' {
  const { isAdmin } = useUserRole();
  return isAdmin ? 'admin' : 'public';
}

/**
 * Hook to get Firebase user directly
 */
export function useFirebaseAuthUser(): FirebaseAuthUser | null {
  const { firebaseUser } = useUserRole();
  return firebaseUser;
}

// =============================================================================
// DEPRECATED - FOR BACKWARD COMPATIBILITY ONLY
// =============================================================================

/**
 * @deprecated Use useUserRole instead
 */
export function useLegacyAuth() {
  logger.warn('useLegacyAuth is deprecated. Use useUserRole instead.');
  return useUserRole();
}

export default UserRoleContext;
