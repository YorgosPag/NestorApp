'use client';

/**
 * @fileoverview **«ΑΝΑΚΛΗΘΗΚΕ ΑΥΤΗ Η ΣΥΣΚΕΥΗ;» — ΔΥΟ ΣΗΜΑΤΑ, ΕΝΑΣ ΧΕΙΡΙΣΤΗΣ** — ADR-894 §10.1 (στρώση 3) · §10.7.
 * @related services/session/EnterpriseSessionService (`watchSessionRevocation`) · lib/auth/revoked-sign-ins-claim
 * @module auth/contexts/auth-context/use-sign-in-revocation
 *
 * 1. **Η εγγραφή** (`watchSessionRevocation`): ο browser ακούει τη **δική του** εγγραφή συνεδρίας και αποσυνδέεται
 *    μόλις γίνει `revoked` — δευτερόλεπτα μετά το κλικ στην άλλη συσκευή.
 * 2. **Το token** (§10.7): η λίστα ανακλήσεων προβάλλεται στο claim `revokedSignIns`. Κάθε ανανέωση του ID token
 *    (`onIdTokenChanged` — και η αυτόματη ωριαία) ρωτά «είναι το **δικό μου** `auth_time` μέσα;» — **0** αναγνώσεις.
 *
 * 🔴 **Γιατί χρειάζεται το 2 αφού υπάρχει το 1**: συσκευή που ήταν εκτός δικτύου επιστρέφει· το νέο της token φέρνει
 * ήδη το claim ⇒ οι κανόνες (`signInIsLive()`) της αρνούνται **και** τον listener της εγγραφής της ⇒ το σήμα 1 δεν
 * φτάνει ποτέ, και ο άνθρωπος θα έβλεπε σφάλματα `permission-denied` χωρίς να αποσυνδεθεί. Το token όμως το
 * κρατά **η ίδια**.
 * ⚠️ Εξήχθη από το `AuthContext.tsx` (494 γραμμές, όριο 500): το σήμα 1 ζούσε εκεί ως effect.
 */

import { useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';

import type { EndSignInRequest } from '@/auth/identity-change/end-sign-in-destinations';
import { auth } from '@/lib/firebase';
import { isOwnSignInRevoked } from '@/lib/auth/revoked-sign-ins-claim';
import { createModuleLogger } from '@/lib/telemetry';
import { EnterpriseSessionService } from '@/services/session';

const logger = createModuleLogger('UseSignInRevocation');

interface UseSignInRevocationParams {
  readonly uid: string | null | undefined;
  readonly activeSessionId: string | null;
  /** Ο ΕΝΑΣ κάτοχος (ADR-908)· ο λόγος `revoked` ⇒ σύνδεση **με επιστροφή** εδώ, γιατί γυρνά ο ίδιος άνθρωπος. */
  readonly signOut: (request: EndSignInRequest) => Promise<void>;
}

const REVOKED: EndSignInRequest = { reason: 'revoked' };

/** Ακούει και τα δύο σήματα· όποιο φτάσει πρώτο αποσυνδέει (το δεύτερο βρίσκει ήδη αποσυνδεδεμένο browser). */
export function useSignInRevocation({ uid, activeSessionId, signOut }: UseSignInRevocationParams): void {
  useEffect(() => {
    if (!uid || !activeSessionId) return;
    return EnterpriseSessionService.watchSessionRevocation(uid, activeSessionId, () => {
      logger.warn('Session revoked remotely — signing out');
      void signOut(REVOKED);
    });
  }, [uid, activeSessionId, signOut]);

  useEffect(() => {
    if (!uid) return;
    return onIdTokenChanged(auth, (firebaseUser) => {
      if (!firebaseUser || firebaseUser.uid !== uid) return;
      firebaseUser.getIdTokenResult().then(
        (result) => {
          if (!isOwnSignInRevoked(result.claims)) return;
          logger.warn('This sign-in is listed as revoked in its own token — signing out');
          void signOut(REVOKED);
        },
        (error: unknown) => logger.warn('Token claims unreadable (non-blocking)', { error }),
      );
    });
  }, [uid, signOut]);
}
