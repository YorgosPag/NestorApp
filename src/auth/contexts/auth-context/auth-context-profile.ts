import { doc, getDoc, increment, setDoc, type Firestore } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfileDocument } from '@/auth/types/auth.types';
import { API_ROUTES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AuthContextProfile');

export async function syncUserProfileToFirestore(
  db: Firestore,
  firebaseUser: FirebaseUser,
  customClaims: Record<string, unknown>,
): Promise<void> {
  const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);

  try {
    const userSnapshot = await getDoc(userDocRef);
    const now = new Date();
    const authProvider = firebaseUser.providerData[0]?.providerId ?? 'unknown';

    if (!userSnapshot.exists()) {
      const newProfile: UserProfileDocument = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName: firebaseUser.displayName ?? null,
        givenName: null,
        familyName: null,
        photoURL: firebaseUser.photoURL ?? null,
        companyId: typeof customClaims.companyId === 'string' ? customClaims.companyId : null,
        globalRole: typeof customClaims.globalRole === 'string' ? customClaims.globalRole : null,
        status: 'active',
        emailVerified: firebaseUser.emailVerified,
        loginCount: 1,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        authProvider,
      };

      await setDoc(userDocRef, newProfile, { merge: true });
      logger.info('[AuthContext] User profile created successfully');
      return;
    }

    const existingData = userSnapshot.data();
    await setDoc(userDocRef, {
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? null,
      photoURL: firebaseUser.photoURL ?? null,
      emailVerified: firebaseUser.emailVerified,
      lastLoginAt: now,
      loginCount: increment(1),
      updatedAt: now,
      companyId: typeof customClaims.companyId === 'string'
        ? customClaims.companyId
        : existingData.companyId ?? null,
      globalRole: typeof customClaims.globalRole === 'string'
        ? customClaims.globalRole
        : existingData.globalRole ?? null,
      authProvider,
    }, { merge: true });

    logger.info('[AuthContext] User profile updated successfully');
  } catch (syncError) {
    logger.warn('[AuthContext] User profile sync failed (non-blocking)', { error: syncError });
  }
}

export async function ensureDevUserProfile(): Promise<void> {
  try {
    const response = await fetch(API_ROUTES.ADMIN.ENSURE_USER_PROFILE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: 'dev-admin',
        email: 'dev@localhost',
        displayName: 'Dev Admin',
        givenName: 'Dev',
        familyName: 'Admin',
        globalRole: 'admin',
        authProvider: 'development-bypass',
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json() as { created?: boolean };
    if (data.created) {
      logger.info('[AuthContext] Dev-admin user profile created via Admin SDK');
    }
  } catch (devError) {
    logger.warn('[AuthContext] Failed to create dev-admin profile (non-blocking)', { error: devError });
  }
}
