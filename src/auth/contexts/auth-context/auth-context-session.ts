import type { FirebaseAuthUser } from '@/auth/types/auth.types';
import type { User as FirebaseUser } from 'firebase/auth';
import { API_ROUTES, AUTH_EVENTS } from '@/config/domain-constants';
import { safeGetItem, STORAGE_KEYS } from '@/lib/storage';

export function buildAuthUser(firebaseUser: FirebaseUser, customClaims: Record<string, unknown>): FirebaseAuthUser {
  const displayName = firebaseUser.displayName;
  const isGoogleProvider = firebaseUser.providerData.some(
    (provider) => provider.providerId === 'google.com',
  );
  const profileIncomplete = isGoogleProvider && !safeGetItem(`${STORAGE_KEYS.AUTH_PROFILE_COMPLETE_PREFIX}${firebaseUser.uid}`, '');

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName,
    givenName: safeGetItem(`${STORAGE_KEYS.AUTH_GIVEN_NAME_PREFIX}${firebaseUser.uid}`, '') || null,
    familyName: safeGetItem(`${STORAGE_KEYS.AUTH_FAMILY_NAME_PREFIX}${firebaseUser.uid}`, '') || null,
    emailVerified: firebaseUser.emailVerified,
    photoURL: firebaseUser.photoURL,
    profileIncomplete,
    globalRole: typeof customClaims.globalRole === 'string' ? customClaims.globalRole : undefined,
    companyId: typeof customClaims.companyId === 'string' ? customClaims.companyId : undefined,
    permissions: Array.isArray(customClaims.permissions) ? customClaims.permissions as string[] : undefined,
    mfaEnrolled: typeof customClaims.mfaEnrolled === 'boolean' ? customClaims.mfaEnrolled : undefined,
  };
}

interface SessionApiResponse {
  success: boolean;
  message: string;
  error?: string;
}

export async function syncServerSession(firebaseUser: FirebaseUser): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const idToken = await firebaseUser.getIdToken(true);
  const response = await fetch(API_ROUTES.AUTH.SESSION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    let payload: SessionApiResponse | null = null;
    try {
      payload = await response.json() as SessionApiResponse;
    } catch {
      payload = null;
    }

    const errorMessage = payload?.error || payload?.message || 'Failed to create session cookie';
    throw new Error(errorMessage);
  }
}

export async function clearServerSessionCookie(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  await fetch(API_ROUTES.AUTH.SESSION, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export function bindRefreshSessionListener(handler: () => Promise<void>): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const listener = () => {
    void handler();
  };

  window.addEventListener(AUTH_EVENTS.REFRESH_SESSION, listener);
  return () => {
    window.removeEventListener(AUTH_EVENTS.REFRESH_SESSION, listener);
  };
}
