import type { FirebaseAuthUser } from '@/auth/types/auth.types';
import type { User as FirebaseUser } from 'firebase/auth';
import { API_ROUTES, AUTH_EVENTS } from '@/config/domain-constants';
import { safeGetItem, STORAGE_KEYS } from '@/lib/storage';
import { readPermissionsClaim } from '@/lib/auth/claim-permissions';
import { SIGN_IN_REVOKED_ERROR_CODE } from '@/lib/auth/session-issue-wire';
import { currentIdentityEpoch, identityChangedSince } from './identity-epoch';

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
    // ADR-801 §2.8 — ο ΕΝΑΣ αναγνώστης, κοινός με τον server.
    // ⚠️ ΜΗΝ γυρίσεις σε `Array.isArray(...) as string[]`: το ωμό cast δεν
    //    επικυρώνει τίποτα, και ήταν ο **πρώτος** από τους τρεις κανόνες που
    //    διάβαζαν αυτό το claim διαφορετικά.
    permissions: readPermissionsClaim(customClaims.permissions),
    mfaEnrolled: typeof customClaims.mfaEnrolled === 'boolean' ? customClaims.mfaEnrolled : undefined,
    claimsUpdatedAt: typeof customClaims.claimsUpdatedAt === 'number' ? customClaims.claimsUpdatedAt : undefined,
  };
}

interface SessionApiResponse {
  success: boolean;
  message: string;
  error?: string;
  code?: string;
}

/**
 * **Ο διακομιστής ΑΡΝΗΘΗΚΕ να εκδώσει συνεδρία γιατί αυτή η σύνδεση ανακλήθηκε** (ADR-908 §3.5).
 *
 * 🔑 Ξεχωριστός τύπος και όχι σκέτο `Error`: κάθε άλλη αποτυχία του `POST` είναι **παροδική** (ο άνθρωπος
 * συνεχίζει, και το cookie ξαναζητείται στην επόμενη ανανέωση). Αυτή είναι **οριστική** — το token αυτής της
 * σύνδεσης δεν θα γίνει ποτέ δεκτό, άρα ο μόνος σωστός δρόμος είναι ο κάτοχος της αποσύνδεσης.
 */
export class SignInRevokedError extends Error {
  constructor() {
    super('This sign-in was revoked');
    this.name = 'SignInRevokedError';
  }
}

export async function syncServerSession(firebaseUser: FirebaseUser): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // 🔴 ADR-908 §3.2 — ο ΕΝΑΣ φρουρός για όλους τους καλούντες: αν ο άνθρωπος άλλαξε όσο περιμέναμε το token,
  //    το cookie ΔΕΝ ζητείται. Μετρημένο: χωρίς αυτό, το `__session` ξαναστηνόταν 0,25 s μετά την αποσύνδεση.
  const startedAt = currentIdentityEpoch();
  const idToken = await firebaseUser.getIdToken(true);
  if (identityChangedSince(startedAt)) return;

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

    if (payload?.code === SIGN_IN_REVOKED_ERROR_CODE) throw new SignInRevokedError();

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
