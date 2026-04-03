import { useCallback } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type Auth,
  type MultiFactorResolver,
} from 'firebase/auth';
import type { Dispatch, SetStateAction } from 'react';
import type { FirebaseAuthUser, SignUpData } from '@/auth/types/auth.types';
import { safeSetItem, STORAGE_KEYS } from '@/lib/storage';
import { createModuleLogger } from '@/lib/telemetry';
import { getAuthErrorMessage } from './auth-context-errors';

const logger = createModuleLogger('AuthContextActions');

interface UseAuthActionsParams {
  auth: Auth;
  setUser: Dispatch<SetStateAction<FirebaseAuthUser | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMfaRequired: Dispatch<SetStateAction<boolean>>;
  setMfaResolver: Dispatch<SetStateAction<MultiFactorResolver | null>>;
  twoFactorService: {
    getMfaResolver: (error: unknown) => MultiFactorResolver | null;
    verifyTotpForSignIn: (resolver: MultiFactorResolver, code: string, hintIndex: number) => Promise<{ result: string; error?: string }>;
  };
}

export function useAuthActions(params: UseAuthActionsParams) {
  const {
    auth,
    setUser,
    setLoading,
    setError,
    setMfaRequired,
    setMfaResolver,
    twoFactorService,
  } = params;

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const handleError = useCallback((error: unknown) => {
    const message = getAuthErrorMessage(error);
    setError(message);
    logger.error('[AuthContext] Error', { message });
  }, [setError]);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      logger.info('[AuthContext] Signing in:', { email });
      await signInWithEmailAndPassword(auth, email, password);
      logger.info('[AuthContext] Sign in successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, handleError, setError, setLoading]);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      logger.info('[AuthContext] Starting Google Sign-In');

      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });

      await signInWithPopup(auth, provider);
      logger.info('[AuthContext] Google Sign-In successful');
    } catch (error) {
      const resolver = twoFactorService.getMfaResolver(error);
      if (resolver) {
        logger.info('[AuthContext] MFA required - showing verification UI');
        setMfaResolver(resolver);
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, handleError, setError, setLoading, setMfaRequired, setMfaResolver, twoFactorService]);

  const verifyMfaCode = useCallback(async (code: string): Promise<void> => {
    let resolverSnapshot: MultiFactorResolver | null = null;
    setMfaResolver((current) => {
      resolverSnapshot = current;
      return current;
    });

    if (!resolverSnapshot) {
      setError('Δεν υπάρχει ενεργή διαδικασία MFA');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      logger.info('[AuthContext] Verifying MFA code...');

      const result = await twoFactorService.verifyTotpForSignIn(resolverSnapshot, code, 0);
      if (result.result === 'success') {
        logger.info('[AuthContext] MFA verification successful');
        setMfaResolver(null);
        setMfaRequired(false);
        return;
      }

      const errorMessage = result.error || 'Μη έγκυρος κωδικός επαλήθευσης';
      setError(errorMessage);
      logger.error('[AuthContext] MFA verification failed', { errorMessage });
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError, setError, setLoading, setMfaRequired, setMfaResolver, twoFactorService]);

  const cancelMfaVerification = useCallback((): void => {
    logger.info('[AuthContext] MFA verification cancelled');
    setMfaResolver(null);
    setMfaRequired(false);
    setError(null);
    setLoading(false);
  }, [setError, setLoading, setMfaRequired, setMfaResolver]);

  const signUp = useCallback(async (data: SignUpData): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const { email, password, givenName, familyName } = data;
      logger.info('[AuthContext] Signing up:', { email });
      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (result.user) {
        const displayName = `${givenName} ${familyName}`.trim();
        await updateProfile(result.user, { displayName });
        safeSetItem(`${STORAGE_KEYS.AUTH_GIVEN_NAME_PREFIX}${result.user.uid}`, givenName);
        safeSetItem(`${STORAGE_KEYS.AUTH_FAMILY_NAME_PREFIX}${result.user.uid}`, familyName);
        safeSetItem(`${STORAGE_KEYS.AUTH_PROFILE_COMPLETE_PREFIX}${result.user.uid}`, 'true');
        await sendEmailVerification(result.user);

        setUser({
          uid: result.user.uid,
          email: result.user.email,
          displayName,
          givenName,
          familyName,
          emailVerified: result.user.emailVerified,
          photoURL: result.user.photoURL,
          profileIncomplete: false,
        });
      }

      logger.info('[AuthContext] Sign up successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, handleError, setError, setLoading, setUser]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      logger.info('[AuthContext] Signing out');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:logout'));
        logger.info('[AuthContext] Dispatched auth:logout event');
      }

      await firebaseSignOut(auth);
      logger.info('[AuthContext] Sign out successful');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, handleError, setError, setLoading]);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      setError(null);
      logger.info('[AuthContext] Sending password reset to:', { email });
      await sendPasswordResetEmail(auth, email);
      logger.info('[AuthContext] Password reset email sent successfully!');
    } catch (error) {
      logger.error('[AuthContext] Password reset failed', { error });
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError]);

  const updateUserProfile = useCallback(async (givenName: string, familyName: string): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);
      const displayName = `${givenName} ${familyName}`.trim();
      await updateProfile(auth.currentUser, { displayName });
      safeSetItem(`${STORAGE_KEYS.AUTH_GIVEN_NAME_PREFIX}${auth.currentUser.uid}`, givenName);
      safeSetItem(`${STORAGE_KEYS.AUTH_FAMILY_NAME_PREFIX}${auth.currentUser.uid}`, familyName);
      setUser((prev) => prev ? { ...prev, displayName, givenName, familyName } : null);
      logger.info('[AuthContext] Profile updated:', { displayName });
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError, setUser]);

  const completeProfile = useCallback(async (givenName: string, familyName: string): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);
      const displayName = `${givenName} ${familyName}`.trim();
      await updateProfile(auth.currentUser, { displayName });
      safeSetItem(`${STORAGE_KEYS.AUTH_GIVEN_NAME_PREFIX}${auth.currentUser.uid}`, givenName);
      safeSetItem(`${STORAGE_KEYS.AUTH_FAMILY_NAME_PREFIX}${auth.currentUser.uid}`, familyName);
      safeSetItem(`${STORAGE_KEYS.AUTH_PROFILE_COMPLETE_PREFIX}${auth.currentUser.uid}`, 'true');
      setUser((prev) => prev ? { ...prev, displayName, givenName, familyName, profileIncomplete: false } : null);
      logger.info('[AuthContext] Profile completed for Google user:', { displayName });
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError, setUser]);

  const sendVerificationEmailAction = useCallback(async (): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);
      await sendEmailVerification(auth.currentUser);
      logger.info('[AuthContext] Verification email sent');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError]);

  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);
      logger.info('[AuthContext] Force refreshing ID token...');
      const idTokenResult = await auth.currentUser.getIdTokenResult(true);
      setUser((prev) => prev ? {
        ...prev,
        globalRole: typeof idTokenResult.claims.globalRole === 'string' ? idTokenResult.claims.globalRole : prev.globalRole,
        companyId: typeof idTokenResult.claims.companyId === 'string' ? idTokenResult.claims.companyId : prev.companyId,
        permissions: Array.isArray(idTokenResult.claims.permissions) ? idTokenResult.claims.permissions as string[] : prev.permissions,
        mfaEnrolled: typeof idTokenResult.claims.mfaEnrolled === 'boolean' ? idTokenResult.claims.mfaEnrolled : prev.mfaEnrolled,
      } : prev);
      logger.info('[AuthContext] Token refreshed successfully - new permissions loaded');
    } catch (error) {
      logger.error('[AuthContext] Token refresh failed', { error });
      handleError(error);
      throw error;
    }
  }, [auth, handleError, setError, setUser]);

  return {
    clearError,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updateUserProfile,
    completeProfile,
    sendVerificationEmail: sendVerificationEmailAction,
    verifyMfaCode,
    cancelMfaVerification,
    refreshToken,
  };
}
