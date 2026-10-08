'use client';

/**
 * @fileoverview **«ΑΝΑΝΕΩΣΕ ΤΗ ΣΥΝΕΔΡΙΑ ΤΩΡΑ»** — ο ακροατής του συμβάντος `AUTH_EVENTS.REFRESH_SESSION`.
 * @related ./auth-context-session (`bindRefreshSessionListener`, `syncServerSession`) · ./identity-epoch
 * @module auth/contexts/auth-context/use-session-refresh-event
 *
 * ⚠️ Εξήχθη από το `AuthContext.tsx` (όριο 500 γραμμών) μαζί με τη διόρθωση του ADR-908 §3.2: η διαδρομή έκανε
 * δύο `await` και μετά `setUser` διαβάζοντας **ξανά** το `auth.currentUser` — δηλαδή μπορούσε να γράψει πίσω
 * άνθρωπο που είχε ήδη αποσυνδεθεί, ή να σκάσει σε `null`. Τώρα κρατά **τον ίδιο** χρήστη και ρωτά την εποχή.
 */

import { useEffect } from 'react';

import { auth } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import type { FirebaseAuthUser } from '@/auth/types/auth.types';

import { bindRefreshSessionListener, buildAuthUser, syncServerSession } from './auth-context-session';
import { currentIdentityEpoch, identityChangedSince } from './identity-epoch';

const logger = createModuleLogger('UseSessionRefreshEvent');

export function useSessionRefreshEvent(setUser: (user: FirebaseAuthUser) => void): void {
  useEffect(() => {
    return bindRefreshSessionListener(async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

      const startedAt = currentIdentityEpoch();
      try {
        await syncServerSession(firebaseUser);
        logger.debug('Server session cookie refreshed (event)');
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        // Ο άνθρωπος άλλαξε όσο περιμέναμε ⇒ δεν γράφουμε τον παλιό πίσω.
        if (identityChangedSince(startedAt)) return;
        setUser(buildAuthUser(firebaseUser, idTokenResult.claims));
      } catch (sessionError) {
        logger.warn('Failed to refresh server session cookie (event)', { error: sessionError });
      }
    });
  }, [setUser]);
}
