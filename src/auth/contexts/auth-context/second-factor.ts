/**
 * @fileoverview **Ο ΔΕΥΤΕΡΟΣ ΠΑΡΑΓΟΝΤΑΣ ΩΣ ΟΝΟΜΑΣΜΕΝΗ ΚΑΤΑΣΤΑΣΗ** (ADR-859).
 * @module auth/contexts/auth-context/second-factor
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-09-14
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο έλεγχος του κωδικού MFA ήταν γραμμένος **δύο φορές** (`useAuthActions` και
 * inline στο `AuthContext`, όπου ο δεύτερος σκίαζε τον πρώτο), και **και οι δύο**
 * επέστρεφαν κανονικά σε λάθος κωδικό. Η φόρμα έφευγε από τη σελίδα με λάθος
 * κωδικό (Console `21:41:16.907`), και ο `signInWithGoogle` επέστρεφε επιτυχία όταν
 * η Google ζητούσε δεύτερο παράγοντα ⇒ στο `/invite/<token>` η φόρμα του κωδικού
 * **δεν αποδιδόταν ποτέ** και ο άνθρωπος έβλεπε ξανά «Συνδεθείτε».
 *
 * 🏆 **Πρότυπο Firebase** (`getMultiFactorResolver` → `resolveSignIn`): ο δεύτερος
 * παράγοντας είναι **κατάσταση της σύνδεσης**, όχι επιτυχία. Εδώ ο resolver είναι η
 * **ΜΙΑ** πηγή: το `mfaRequired` **παράγεται** από αυτόν, ώστε boolean και resolver
 * να μην μπορούν να αποκλίνουν.
 */

import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MultiFactorResolver } from 'firebase/auth';
import type {
  SecondFactorOutcome,
  SecondFactorRejection,
  SignInOutcome,
} from '@/auth/types/auth.types';
import type { VerificationResult, VerifyTwoFactorResult } from '@/services/two-factor/two-factor.types';
import { createModuleLogger } from '@/lib/telemetry';
import { getAuthErrorMessage } from './auth-context-errors';

const logger = createModuleLogger('SecondFactor');

export const SIGNED_IN: SignInOutcome = { kind: 'signed-in' };
export const SECOND_FACTOR_REQUIRED: SignInOutcome = { kind: 'second-factor-required' };

/** Ό,τι χρειάζεται από την υπηρεσία 2FA — δομικός τύπος, ώστε τα tests να μη φορτώνουν Firebase. */
export interface SecondFactorService {
  getMfaResolver: (error: unknown) => MultiFactorResolver | null;
  verifyTotpForSignIn: (
    resolver: MultiFactorResolver,
    code: string,
    factorIndex: number,
  ) => Promise<VerifyTwoFactorResult>;
}

interface UseSecondFactorParams {
  twoFactorService: SecondFactorService;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

/** Κάθε αποτυχία της υπηρεσίας σε **ονομασμένο** λόγο — κανένα «απέτυχε» χωρίς όνομα. */
const REJECTION_BY_RESULT: Record<Exclude<VerificationResult, 'success'>, SecondFactorRejection> = {
  invalid_code: 'invalid-code',
  expired: 'expired',
  rate_limited: 'rate-limited',
  error: 'failed',
};

/**
 * Ο κωδικός σφάλματος Firebase του οποίου το μήνυμα δείχνει η φόρμα.
 * ⚠️ Ο TOTP κωδικός «λήγει» κάθε 30″ — για τον άνθρωπο είναι το ίδιο με «μη έγκυρος».
 */
const DISPLAY_CODE_BY_REJECTION: Record<SecondFactorRejection, string> = {
  'invalid-code': 'auth/invalid-verification-code',
  expired: 'auth/invalid-verification-code',
  'rate-limited': 'auth/too-many-requests',
  'no-pending-sign-in': 'auth/internal-error',
  failed: 'auth/internal-error',
};

export function useSecondFactor({ twoFactorService, setLoading, setError }: UseSecondFactorParams) {
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  // Ανάγνωση τη στιγμή της πράξης (getter, όχι στιγμιότυπο closure).
  const resolverRef = useRef<MultiFactorResolver | null>(null);

  const adopt = useCallback((next: MultiFactorResolver | null) => {
    resolverRef.current = next;
    setResolver(next);
  }, []);

  /** `true` ⇒ η σύνδεση **συνεχίζεται** με δεύτερο παράγοντα· `false` ⇒ άλλο σφάλμα. */
  const challenge = useCallback((error: unknown): boolean => {
    const pending = twoFactorService.getMfaResolver(error);
    if (!pending) return false;
    logger.info('Second factor required — sign-in continues on the same screen');
    adopt(pending);
    return true;
  }, [adopt, twoFactorService]);

  const reject = useCallback((reason: SecondFactorRejection): SecondFactorOutcome => {
    setError(getAuthErrorMessage({ code: DISPLAY_CODE_BY_REJECTION[reason], message: '' }));
    logger.warn('Second factor rejected', { reason });
    return { kind: 'rejected', reason };
  }, [setError]);

  const verify = useCallback(async (code: string): Promise<SecondFactorOutcome> => {
    const pending = resolverRef.current;
    if (!pending) return reject('no-pending-sign-in');

    setLoading(true);
    setError(null);
    try {
      const result = await twoFactorService.verifyTotpForSignIn(pending, code, 0);
      if (result.result !== 'success') return reject(REJECTION_BY_RESULT[result.result]);
      adopt(null);
      return SIGNED_IN;
    } catch (error) {
      logger.error('Second factor verification threw', { error });
      return reject('failed');
    } finally {
      setLoading(false);
    }
  }, [adopt, reject, setError, setLoading, twoFactorService]);

  const cancel = useCallback((): void => {
    adopt(null);
    setError(null);
    setLoading(false);
  }, [adopt, setError, setLoading]);

  return { mfaRequired: resolver !== null, challenge, verify, cancel };
}
