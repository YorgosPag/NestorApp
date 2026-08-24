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
  saveDeclaredOccupation,
  syncUserProfileToFirestore,
} from './auth-context/auth-context-profile';
import type { DeclaredOccupation } from '@/types/professional-identity';
import { useAuthActions } from './auth-context/useAuthActions';
import { useClaimsRefresh } from './auth-context/use-claims-refresh';

const logger = createModuleLogger('AuthContext');

export interface AuthContextType {
  user: FirebaseAuthUser | null;
  /**
   * 🆕 Το **δηλωμένο επάγγελμα** του συνδεδεμένου ανθρώπου (ADR-798 Φάση 2).
   *
   * Ζει στο `users/{uid}` και **ποτέ στα claims** (Α4) — άρα δεν βρίσκεται πάνω
   * στο `user`, που χτίζεται από το token. Γεμίζει από το `getDoc` που το
   * `syncUserProfileToFirestore` έκανε **ήδη**, με **μηδέν επιπλέον αίτημα**.
   *
   * ⚠️ **`null` σημαίνει «δεν ρωτήθηκε ακόμη» (`unknown`), ΠΟΤΕ «δεν έχει».**
   * Κάθε πεδίο μέσα του είναι επίσης προαιρετικό: ένας άνθρωπος **μπορεί** να
   * μην έχει δηλώσει επάγγελμα, και αυτό είναι νόμιμη κατάσταση, όχι κενό προς
   * συμπλήρωση (ADR-798 §7 · Α5: καμία ερώτηση, καμία modal).
   *
   * ⛔ **ΠΟΤΕ ως πηγή δικαιώματος** — είναι **αυτο-δηλωμένο**.
   */
  declaredOccupation: DeclaredOccupation | null;
  /**
   * ADR-798 Φάση 3 (Κ4) — η **δήλωση** του επαγγέλματος από τον ίδιο τον χρήστη.
   *
   * ⚠️ **Α5: ΚΑΜΙΑ modal, καμία ερώτηση πριν ή μετά το login.** Καλείται **μόνο**
   * από σελίδα προφίλ, όποτε το θελήσει **ο ίδιος**.
   *
   * ⛔ **ΔΕΝ δίνει κανένα δικαίωμα** — το αποτέλεσμα σπάει **ισοβαθμία** στην
   * πρόταση δουλειάς και τίποτε άλλο (`isco-job-affinity.ts`).
   */
  updateDeclaredOccupation: (occupation: DeclaredOccupation) => Promise<void>;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (givenName: string, familyName: string) => Promise<void>;
  /**
   * 🖼️ ADR-798 §16 — η φωτογραφία προφίλ. `null` = **επαναφορά στην εικόνα του
   * παρόχου** (Google), ΟΧΙ «καμία εικόνα». Γράφει μόνο στο Firebase Auth —
   * ποτέ στον λογαριασμό Google.
   */
  updateUserPhoto: (photoURL: string | null) => Promise<void>;
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
      logger.debug('[AuthContext] Session activity updated:', { sessionId: existingSessionId });
      return;
    }

    const loginMethod = firebaseUser.providerData.some(
      (provider) => provider.providerId === 'google.com',
    ) ? 'google' : 'email';

    await sessionService.createSession({
      userId: firebaseUser.uid,
      loginMethod,
    });
    logger.debug('[AuthContext] New session created for Active Sessions tracking');
  } catch (sessionError) {
    logger.warn('[AuthContext] Failed to manage session (non-blocking)', { error: sessionError });
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [declaredOccupation, setDeclaredOccupation] = useState<DeclaredOccupation | null>(null);
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
      logger.debug('[AuthContext] Auth state changed:', { uid: firebaseUser?.uid || 'No user' });

      const validation = validateSession(firebaseUser);
      logger.debug('[AuthContext] Session validation:', { status: validation.status });

      if (!validation.isValid && validation.recommendation === 'LOGOUT') {
        logger.error('[AuthContext] INVALID SESSION DETECTED:', { status: validation.status });
        logger.error('[AuthContext] Issues:', { issues: validation.issues });

        if (firebaseUser?.uid) {
          clearCorruptedUserData(firebaseUser.uid);
        }

        try {
          logger.debug('[AuthContext] Auto-logout triggered for security');
          await auth.signOut();
        } catch (logoutError) {
          logger.error('[AuthContext] Auto-logout failed', { error: logoutError });
        }

        setUser(null);
        setDeclaredOccupation(null);
        setLoading(false);
        return;
      }

      if (!firebaseUser) {
        try {
          await clearServerSessionCookie();
          logger.debug('[AuthContext] Server session cookie cleared');
        } catch (sessionError) {
          logger.warn('[AuthContext] Failed to clear server session cookie (non-blocking)', { error: sessionError });
        }
        setUser(null);
        setDeclaredOccupation(null);
        setLoading(false);
        return;
      }

      let customClaims: Record<string, unknown> = {};
      try {
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        customClaims = idTokenResult.claims;
        logger.debug('[AuthContext] Custom claims loaded:', {
          globalRole: customClaims.globalRole,
          companyId: customClaims.companyId,
          permissions: Array.isArray(customClaims.permissions) ? customClaims.permissions.length : 0,
        });
      } catch (claimsError) {
        logger.warn('[AuthContext] Failed to load custom claims (non-blocking)', { error: claimsError });
      }

      const { occupation } = await syncUserProfileToFirestore(db, firebaseUser, customClaims);
      setDeclaredOccupation(occupation);
      const authUser = buildAuthUser(firebaseUser, customClaims);
      logger.info('[AuthContext] Valid session established:', { email: authUser.email });
      setUser(authUser);

      await syncActiveSession(firebaseUser);

      try {
        await syncServerSession(firebaseUser);
        logger.debug('[AuthContext] Server session cookie synced');
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

  // ADR-360: Auto-refresh ID token when server bumps claimsUpdatedAt mirror
  useClaimsRefresh({
    uid: user?.uid,
    tokenClaimsUpdatedAt: user?.claimsUpdatedAt,
    setUser,
  });

  useEffect(() => {
    return bindRefreshSessionListener(async () => {
      if (!auth.currentUser) {
        return;
      }

      try {
        await syncServerSession(auth.currentUser);
        logger.debug('[AuthContext] Server session cookie refreshed (event)');
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
    declaredOccupation,
    loading,
    error,
    signIn: actions.signIn,
    signInWithGoogle: actions.signInWithGoogle,
    signUp: actions.signUp,
    signOut: async () => {
      await actions.signOut();
      try {
        await clearServerSessionCookie();
        logger.debug('[AuthContext] Server session cookie cleared on sign-out');
      } catch (sessionError) {
        logger.warn('[AuthContext] Failed to clear server session cookie on sign-out', { error: sessionError });
      }
    },
    resetPassword: actions.resetPassword,
    updateUserProfile: actions.updateUserProfile,
    updateUserPhoto: actions.updateUserPhoto,
    completeProfile: actions.completeProfile,
    // ADR-798 Φάση 3 (Κ4) — ζει **εδώ** και όχι στο `useAuthActions`: εκείνο
    // γράφει σε Firebase Auth + localStorage και **δεν αγγίζει Firestore**
    // πουθενά, ενώ το επάγγελμα ζει στο `users/{uid}`. Δύο αποθετήρια, δύο
    // ιδιοκτήτες. 🔑 Η κατάσταση τίθεται από ό,τι **γράφτηκε πραγματικά**
    // (`written`), ποτέ από ό,τι πληκτρολογήθηκε: ο γραφέας καθαρίζει κενά και
    // **σβήνει** τη μισή ταξινόμηση, οπότε η οθόνη οφείλει να δει το αληθινό
    // αποτέλεσμα — αλλιώς θα έδειχνε ταξινομημένο κάτι που δεν αποθηκεύτηκε.
    updateDeclaredOccupation: async (occupation: DeclaredOccupation) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('No authenticated user');
      setDeclaredOccupation(await saveDeclaredOccupation(db, uid, occupation));
    },
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
        logger.debug('[AuthContext] Verifying MFA code...');
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
    // ⚠️ Το `declaredOccupation` ΠΡΕΠΕΙ να είναι εδώ: χωρίς αυτό η τιμή του
    // context παγώνει στο `null` της πρώτης απόδοσης, και το επάγγελμα θα
    // φαινόταν «μη δηλωμένο» για πάντα — σφάλμα που **καμία** πύλη δεν πιάνει
    // και που στην οθόνη μοιάζει με «ο χρήστης δεν έχει επάγγελμα».
  }), [actions, declaredOccupation, error, loading, mfaRequired, mfaResolver, user]);

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
