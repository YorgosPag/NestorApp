'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type MultiFactorResolver, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { sessionService, EnterpriseSessionService } from '@/services/session';
import { twoFactorService } from '@/services/two-factor/EnterpriseTwoFactorService';
import { AUTH_EVENTS } from '@/config/domain-constants';
import type { FirebaseAuthUser, SignUpData } from '../types/auth.types';
import { RealtimeService } from '@/services/realtime';
import type { UserSettingsUpdatedPayload } from '@/services/realtime';
import { userPreferencesService } from '@/services/user/EnterpriseUserPreferencesService';
import { createModuleLogger } from '@/lib/telemetry';
import {
  clearCorruptedUserData,
  getAuthErrorMessage,
  validateSession,
} from './auth-context/auth-context-errors';
import {
  bindRefreshSessionListener,
  buildAuthUser,
  clearServerSessionCookie,
  syncServerSession,
} from './auth-context/auth-context-session';
import {
  ensureDevUserProfile,
  syncUserProfileToFirestore,
} from './auth-context/auth-context-profile';
import { useAuthActions } from './auth-context/useAuthActions';

const logger = createModuleLogger('AuthContext');

export interface AuthContextType {
  user: FirebaseAuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (givenName: string, familyName: string) => Promise<void>;
  completeProfile: (givenName: string, familyName: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  mfaRequired: boolean;
  verifyMfaCode: (code: string) => Promise<void>;
  cancelMfaVerification: () => void;
  clearError: () => void;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

async function syncActiveSession(firebaseUser: FirebaseUser): Promise<void> {
  try {
    if (!db) {
      return;
    }

    sessionService.initialize(db);
    const existingSessionId = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('currentSessionId')
      : null;

    if (existingSessionId) {
      await sessionService.updateSessionActivity(firebaseUser.uid, existingSessionId);
      logger.info('[AuthContext] Session activity updated:', { sessionId: existingSessionId });
      return;
    }

    const loginMethod = firebaseUser.providerData.some(
      (provider) => provider.providerId === 'google.com',
    ) ? 'google' : 'email';

    await sessionService.createSession({
      userId: firebaseUser.uid,
      loginMethod,
    });
    logger.info('[AuthContext] New session created for Active Sessions tracking');
  } catch (sessionError) {
    logger.warn('[AuthContext] Failed to manage session (non-blocking)', { error: sessionError });
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);

  const actions = useAuthActions({
    auth,
    setUser,
    setLoading,
    setError,
    setMfaRequired,
    setMfaResolver,
    twoFactorService,
  });

  useEffect(() => {
    void ensureDevUserProfile();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      logger.info('[AuthContext] Auth state changed:', { uid: firebaseUser?.uid || 'No user' });

      const validation = validateSession(firebaseUser);
      logger.info('[AuthContext] Session validation:', { status: validation.status });

      if (!validation.isValid && validation.recommendation === 'LOGOUT') {
        logger.error('[AuthContext] INVALID SESSION DETECTED:', { status: validation.status });
        logger.error('[AuthContext] Issues:', { issues: validation.issues });

        if (firebaseUser?.uid) {
          clearCorruptedUserData(firebaseUser.uid);
        }

        try {
          logger.info('[AuthContext] Auto-logout triggered for security');
          await auth.signOut();
        } catch (logoutError) {
          logger.error('[AuthContext] Auto-logout failed', { error: logoutError });
        }

        setUser(null);
        setLoading(false);
        return;
      }

      if (!firebaseUser) {
        try {
          await clearServerSessionCookie();
          logger.info('[AuthContext] Server session cookie cleared');
        } catch (sessionError) {
          logger.warn('[AuthContext] Failed to clear server session cookie (non-blocking)', { error: sessionError });
        }
        setUser(null);
        setLoading(false);
        return;
      }

      let customClaims: Record<string, unknown> = {};
      try {
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        customClaims = idTokenResult.claims;
        logger.info('[AuthContext] Custom claims loaded:', {
          globalRole: customClaims.globalRole,
          companyId: customClaims.companyId,
          permissions: Array.isArray(customClaims.permissions) ? customClaims.permissions.length : 0,
        });
      } catch (claimsError) {
        logger.warn('[AuthContext] Failed to load custom claims (non-blocking)', { error: claimsError });
      }

      await syncUserProfileToFirestore(db, firebaseUser, customClaims);
      const authUser = buildAuthUser(firebaseUser, customClaims);
      logger.info('[AuthContext] Valid session established:', { email: authUser.email });
      setUser(authUser);

      await syncActiveSession(firebaseUser);

      try {
        await syncServerSession(firebaseUser);
        logger.info('[AuthContext] Server session cookie synced');
      } catch (sessionError) {
        logger.warn('[AuthContext] Failed to sync server session cookie (non-blocking)', { error: sessionError });
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sessionId = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('currentSessionId')
      : null;

    if (!sessionId || !user) {
      return;
    }

    return EnterpriseSessionService.subscribeToSessionEvents(sessionId, () => {
      logger.warn('[AuthContext] Session revoked remotely — signing out');
      void actions.signOut();
    });
  }, [actions, user]);

  useEffect(() => {
    return bindRefreshSessionListener(async () => {
      if (!auth.currentUser) {
        return;
      }

      try {
        await syncServerSession(auth.currentUser);
        logger.info('[AuthContext] Server session cookie refreshed (event)');
        const idTokenResult = await auth.currentUser.getIdTokenResult(true);
        const updatedUser = buildAuthUser(auth.currentUser, idTokenResult.claims);
        setUser(updatedUser);
      } catch (sessionError) {
        logger.warn('[AuthContext] Failed to refresh server session cookie (event)', { error: sessionError });
      }
    });
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleSettingsUpdated = (payload: UserSettingsUpdatedPayload) => {
      if (payload.userId === user.uid) {
        userPreferencesService.clearCacheForUser(user.uid);
      }
    };

    return RealtimeService.subscribe('USER_SETTINGS_UPDATED', handleSettingsUpdated);
  }, [user]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    error,
    signIn: actions.signIn,
    signInWithGoogle: actions.signInWithGoogle,
    signUp: actions.signUp,
    signOut: async () => {
      await actions.signOut();
      try {
        await clearServerSessionCookie();
        logger.info('[AuthContext] Server session cookie cleared on sign-out');
      } catch (sessionError) {
        logger.warn('[AuthContext] Failed to clear server session cookie on sign-out', { error: sessionError });
      }
    },
    resetPassword: actions.resetPassword,
    updateUserProfile: actions.updateUserProfile,
    completeProfile: actions.completeProfile,
    sendVerificationEmail: actions.sendVerificationEmail,
    mfaRequired,
    verifyMfaCode: async (code: string) => {
      if (!mfaResolver) {
        setError('Δεν υπάρχει ενεργή διαδικασία MFA');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        logger.info('[AuthContext] Verifying MFA code...');
        const result = await twoFactorService.verifyTotpForSignIn(mfaResolver, code, 0);
        if (result.result === 'success') {
          logger.info('[AuthContext] MFA verification successful');
          setMfaResolver(null);
          setMfaRequired(false);
          return;
        }

        const errorMessage = result.error || 'Μη έγκυρος κωδικός επαλήθευσης';
        setError(errorMessage);
        logger.error('[AuthContext] MFA verification failed', { errorMessage });
      } catch (mfaError) {
        const message = getAuthErrorMessage(mfaError);
        setError(message);
        logger.error('[AuthContext] Error', { message });
      } finally {
        setLoading(false);
      }
    },
    cancelMfaVerification: actions.cancelMfaVerification,
    refreshToken: actions.refreshToken,
    clearError: actions.clearError,
    isAuthenticated: !!user,
    needsProfileCompletion: user?.profileIncomplete ?? false,
  }), [actions, error, loading, mfaRequired, mfaResolver, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('🔴 useAuth must be used within an AuthProvider. Wrap your component tree with <AuthProvider>.');
  }
  return context;
}

export function useAuthOptional(): AuthContextType | null {
  return useContext(AuthContext);
}

export { AuthProvider as FirebaseAuthProvider };
export { useAuth as useFirebaseAuth };
export default AuthContext;
