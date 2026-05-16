'use client';

/**
 * Client-side listener that auto-refreshes the Firebase ID token whenever the
 * server bumps `claimsUpdatedAt` on the `users/{uid}` mirror doc (ADR-360).
 *
 * Why: `setCustomUserClaims` on the server does NOT push to connected clients.
 * The client's cached ID token keeps the old claims until either the user
 * logs out and back in, or the app explicitly calls `getIdToken(true)`.
 * Listening on `users/{uid}.claimsUpdatedAt` lets us detect the change and
 * force-refresh the token within seconds — same UX as Google Workspace
 * admin actions.
 */
import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { FirebaseAuthUser } from '@/auth/types/auth.types';
import { buildAuthUser, syncServerSession } from './auth-context-session';

const logger = createModuleLogger('UseClaimsRefresh');

interface UseClaimsRefreshParams {
  uid: string | null | undefined;
  /** Current `claimsUpdatedAt` claim baked into the active ID token. */
  tokenClaimsUpdatedAt: number | undefined;
  setUser: (user: FirebaseAuthUser) => void;
}

/**
 * Subscribes to `users/{uid}` for `claimsUpdatedAt` changes. When the
 * mirror value is greater than the value embedded in the active token,
 * force-refreshes the token and propagates new claims to the AuthContext.
 *
 * Cleans up on uid change or unmount.
 */
export function useClaimsRefresh({
  uid,
  tokenClaimsUpdatedAt,
  setUser,
}: UseClaimsRefreshParams): void {
  const lastHandledRef = useRef<number>(tokenClaimsUpdatedAt ?? 0);

  useEffect(() => {
    lastHandledRef.current = tokenClaimsUpdatedAt ?? 0;
  }, [tokenClaimsUpdatedAt]);

  useEffect(() => {
    if (!uid) return;

    const userDocRef = doc(db, COLLECTIONS.USERS, uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      async (snapshot) => {
        const data = snapshot.data();
        const mirroredAt = typeof data?.claimsUpdatedAt === 'number'
          ? data.claimsUpdatedAt
          : 0;

        if (mirroredAt === 0) return;
        if (mirroredAt <= lastHandledRef.current) return;

        const firebaseUser: FirebaseUser | null = auth.currentUser;
        if (!firebaseUser || firebaseUser.uid !== uid) return;

        lastHandledRef.current = mirroredAt;
        logger.info('Detected claims update, forcing token refresh', { uid, mirroredAt });

        try {
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          const updatedUser = buildAuthUser(firebaseUser, idTokenResult.claims);
          setUser(updatedUser);
          await syncServerSession(firebaseUser);
          logger.info('Claims refreshed successfully', {
            uid,
            globalRole: idTokenResult.claims.globalRole,
            companyId: idTokenResult.claims.companyId,
          });
        } catch (error) {
          logger.warn('Failed to refresh claims (non-blocking)', { uid, error });
        }
      },
      (error) => {
        logger.warn('Claims-refresh listener error (non-blocking)', { uid, error });
      },
    );

    return () => unsubscribe();
  }, [uid, setUser]);
}
